import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { isSameDay } from 'date-fns';
import { onAuthStateChanged, User } from 'firebase/auth';
import { AppData, Subject, Attendance, CTMark, AcademicEvent, UserProfile, SemesterGPA } from '../types';
import { loadData, saveData } from '../lib/storage';
import { auth, firebaseConfig } from '../lib/firebase';
import {
  formatAuthError,
  loginWithEmailPassword,
  logoutFirebaseUser,
  registerWithEmailPassword,
} from '../lib/auth';
import {
  getOrCreateUserProfile,
  fetchUserDocumentData,
  isPermissionDeniedError,
  saveUserProfileToFirestore,
  sanitizeUserProfile,
  loadOrMigrateUserSubjects,
  createSubjectInFirestore,
  updateSubjectInFirestore,
  deleteSubjectFromFirestore,
  sanitizeSubject,
  loadOrMigrateUserAttendance,
  createAttendanceInFirestore,
  updateAttendanceInFirestore,
  deleteAttendanceFromFirestore,
  sanitizeAttendance,
  buildAttendanceId,
  loadOrMigrateUserCTMarks,
  createCTMarkInFirestore,
  updateCTMarkInFirestore,
  deleteCTMarkFromFirestore,
  sanitizeCTMark,
  buildCTMarkId,
  getCTMarkUniqueKey,
  loadOrMigrateUserEvents,
  createAcademicEventInFirestore,
  updateAcademicEventInFirestore,
  deleteAcademicEventFromFirestore,
  sanitizeAcademicEvent,
  getAcademicEventUniqueKey,
  loadOrMigrateUserSemesters,
  updateSemesterGPAInFirestore,
  deleteSemesterGPAFromFirestore,
  sanitizeSemesterGPA,
  normalizeEightSemesters,
  isValidSemesterId,
} from '../lib/firestore';

interface AppContextType {
  data: AppData;
  currentUser: User | null;
  authLoading: boolean;
  profileSyncing: boolean;
  subjectsLoading: boolean;
  subjectsSyncing: boolean;
  subjectsError: string | null;
  clearSubjectsError: () => void;
  attendanceLoading: boolean;
  attendanceSyncing: boolean;
  attendanceError: string | null;
  clearAttendanceError: () => void;
  ctMarksLoading: boolean;
  ctMarksSyncing: boolean;
  ctMarksError: string | null;
  clearCTMarksError: () => void;
  eventsLoading: boolean;
  eventsSyncing: boolean;
  eventsError: string | null;
  clearEventsError: () => void;
  semestersLoading: boolean;
  semestersSyncing: boolean;
  semestersError: string | null;
  clearSemestersError: () => void;
  authError: string | null;
  clearAuthError: () => void;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, name: string) => Promise<boolean>;
  logout: () => Promise<void>;
  addSubject: (s: Omit<Subject, 'id'>) => boolean;
  updateSubject: (s: Subject) => boolean;
  deleteSubject: (id: string) => void;
  markAttendance: (a: Omit<Attendance, 'id'>) => void;
  deleteAttendance: (id: string) => void;
  addCTMark: (m: Omit<CTMark, 'id'>) => boolean;
  updateCTMark: (m: CTMark) => boolean;
  deleteCTMark: (id: string) => void;
  addEvent: (e: Omit<AcademicEvent, 'id'>) => void;
  updateEvent: (e: AcademicEvent) => void;
  deleteEvent: (id: string) => void;
  updateProfile: (p: UserProfile) => void;
  updateSemesterGPA: (id: number, gpa: number, credits: number) => void;
  resetSemesterGPA: (id: number) => void;
  toggleTheme: () => void;
  resetData: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [localData, setLocalData] = useState<AppData>(loadData());
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [firestoreProfile, setFirestoreProfile] = useState<UserProfile | null>(null);
  const [firestoreSubjects, setFirestoreSubjects] = useState<Subject[]>([]);
  const [firestoreAttendance, setFirestoreAttendance] = useState<Attendance[]>([]);
  const [firestoreCTMarks, setFirestoreCTMarks] = useState<CTMark[]>([]);
  const [firestoreEvents, setFirestoreEvents] = useState<AcademicEvent[]>([]);
  const [firestoreSemesters, setFirestoreSemesters] = useState<SemesterGPA[]>(() =>
    normalizeEightSemesters([])
  );
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [profileSyncing, setProfileSyncing] = useState<boolean>(false);
  const [subjectsLoading, setSubjectsLoading] = useState<boolean>(false);
  const [subjectsSyncing, setSubjectsSyncing] = useState<boolean>(false);
  const [subjectsError, setSubjectsError] = useState<string | null>(null);
  const [attendanceLoading, setAttendanceLoading] = useState<boolean>(false);
  const [attendanceSyncing, setAttendanceSyncing] = useState<boolean>(false);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);
  const [ctMarksLoading, setCTMarksLoading] = useState<boolean>(false);
  const [ctMarksSyncing, setCTMarksSyncing] = useState<boolean>(false);
  const [ctMarksError, setCTMarksError] = useState<string | null>(null);
  const [eventsLoading, setEventsLoading] = useState<boolean>(false);
  const [eventsSyncing, setEventsSyncing] = useState<boolean>(false);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [semestersLoading, setSemestersLoading] = useState<boolean>(false);
  const [semestersSyncing, setSemestersSyncing] = useState<boolean>(false);
  const [semestersError, setSemestersError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const isManualAuthInProgressRef = useRef(false);
  const firestoreUnavailableRef = useRef(false);
  const localDataRef = useRef(localData);
  localDataRef.current = localData;
  const firestoreAttendanceRef = useRef<Attendance[]>(firestoreAttendance);
  firestoreAttendanceRef.current = firestoreAttendance;
  const firestoreCTMarksRef = useRef<CTMark[]>(firestoreCTMarks);
  firestoreCTMarksRef.current = firestoreCTMarks;
  const firestoreEventsRef = useRef<AcademicEvent[]>(firestoreEvents);
  firestoreEventsRef.current = firestoreEvents;
  const firestoreSemestersRef = useRef<SemesterGPA[]>(firestoreSemesters);
  firestoreSemestersRef.current = firestoreSemesters;

  const applyLocalFallbackToFirestoreState = (user: User, fallbackProfileOverride?: UserProfile) => {
    const currentLocal = localDataRef.current;
    const fallbackProfile =
      fallbackProfileOverride ||
      sanitizeUserProfile({
        ...currentLocal.profile,
        name: user.displayName?.trim() || currentLocal.profile.name || 'Student',
        email: user.email?.trim() || currentLocal.profile.email || '',
      });
    const fallbackSemesters = normalizeEightSemesters(currentLocal.semesters);
    setFirestoreProfile(fallbackProfile);
    setFirestoreSubjects(currentLocal.subjects);
    setFirestoreAttendance(currentLocal.attendance);
    firestoreAttendanceRef.current = currentLocal.attendance;
    setFirestoreCTMarks(currentLocal.ctMarks);
    firestoreCTMarksRef.current = currentLocal.ctMarks;
    setFirestoreEvents(currentLocal.events);
    firestoreEventsRef.current = currentLocal.events;
    setFirestoreSemesters(fallbackSemesters);
    firestoreSemestersRef.current = fallbackSemesters;
  };

  // Keep localStorage persistence untouched for localData
  useEffect(() => {
    saveData(localData);
    if (localData.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [localData]);

  // Listen to Firebase Auth state changes and load/create users/{uid}/profile, subjects, attendance, ctMarks, events, and semesters
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);

      if (!user) {
        firestoreUnavailableRef.current = false;
        setFirestoreProfile(null);
        setFirestoreSubjects([]);
        setFirestoreAttendance([]);
        firestoreAttendanceRef.current = [];
        setFirestoreCTMarks([]);
        firestoreCTMarksRef.current = [];
        setFirestoreEvents([]);
        firestoreEventsRef.current = [];
        const emptySemesters = normalizeEightSemesters([]);
        setFirestoreSemesters(emptySemesters);
        firestoreSemestersRef.current = emptySemesters;
        setSubjectsError(null);
        setAttendanceError(null);
        setCTMarksError(null);
        setEventsError(null);
        setSemestersError(null);
        setSubjectsLoading(false);
        setAttendanceLoading(false);
        setCTMarksLoading(false);
        setEventsLoading(false);
        setSemestersLoading(false);
        setAuthLoading(false);
        return;
      }

      if (isManualAuthInProgressRef.current) {
        setAuthLoading(false);
        return;
      }

      setProfileSyncing(true);
      setSubjectsLoading(true);
      setAttendanceLoading(true);
      setCTMarksLoading(true);
      setEventsLoading(true);
      setSemestersLoading(true);
      try {
        // Fetch single users/{uid} document containing top-level profile fields, subjects, and subjectMarks map
        const userDocData = await fetchUserDocumentData(user.uid);
        const profile =
          userDocData.profile ||
          (await getOrCreateUserProfile(
            user.uid,
            localDataRef.current.profile,
            user.email,
            user.displayName,
            localDataRef.current.theme
          ));

        let subjects = userDocData.subjects;
        if (subjects.length === 0 && localDataRef.current.subjects.length > 0) {
          subjects = await loadOrMigrateUserSubjects(user.uid, localDataRef.current.subjects);
        }

        let ctMarks = userDocData.ctMarks;
        if (ctMarks.length === 0 && localDataRef.current.ctMarks.length > 0) {
          ctMarks = await loadOrMigrateUserCTMarks(user.uid, localDataRef.current.ctMarks);
        }

        firestoreUnavailableRef.current = false;

        const [attendance, semesters] = await Promise.all([
          loadOrMigrateUserAttendance(user.uid, localDataRef.current.attendance),
          loadOrMigrateUserSemesters(user.uid, localDataRef.current.semesters),
        ]);
        const validSubjectIds = new Set(subjects.map(s => s.id));
        const events = await loadOrMigrateUserEvents(
          user.uid,
          localDataRef.current.events,
          validSubjectIds
        );
        setFirestoreProfile(profile);
        setFirestoreSubjects(subjects);
        setFirestoreAttendance(attendance);
        firestoreAttendanceRef.current = attendance;
        setFirestoreCTMarks(ctMarks);
        firestoreCTMarksRef.current = ctMarks;
        setFirestoreEvents(events);
        firestoreEventsRef.current = events;
        setFirestoreSemesters(semesters);
        firestoreSemestersRef.current = semesters;
      } catch (err) {
        console.warn('Failed to sync user data from Firestore:', err);
        const formatted = formatAuthError(err);
        setAuthError(formatted);
        setSubjectsError(formatted);
        setAttendanceError(formatted);
        setCTMarksError(formatted);
        setEventsError(formatted);
        setSemestersError(formatted);
      } finally {
        setProfileSyncing(false);
        setSubjectsLoading(false);
        setAttendanceLoading(false);
        setCTMarksLoading(false);
        setEventsLoading(false);
        setSemestersLoading(false);
        setAuthLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const clearAuthError = () => setAuthError(null);
  const clearSubjectsError = () => setSubjectsError(null);
  const clearAttendanceError = () => setAttendanceError(null);
  const clearCTMarksError = () => setCTMarksError(null);
  const clearEventsError = () => setEventsError(null);
  const clearSemestersError = () => setSemestersError(null);

  const login = async (email: string, password: string): Promise<boolean> => {
    setAuthError(null);
    setSubjectsError(null);
    setAttendanceError(null);
    setCTMarksError(null);
    setEventsError(null);
    setSemestersError(null);
    isManualAuthInProgressRef.current = true;
    setProfileSyncing(true);
    setSubjectsLoading(true);
    setAttendanceLoading(true);
    setCTMarksLoading(true);
    setEventsLoading(true);
    setSemestersLoading(true);
    try {
      const { user, profile, firestorePermissionDenied } = await loginWithEmailPassword(
        email,
        password,
        localDataRef.current.profile,
        localDataRef.current.theme
      );
      setCurrentUser(user);

      if (firestorePermissionDenied) {
        const permMsg =
          'Missing or insufficient Firestore permissions. Please publish the security rules from firestore.rules in Firebase Console > Firestore Database > Rules for academic-tracker-pro-5418a.';
        setAuthError(permMsg);
        setSubjectsError(permMsg);
        setAttendanceError(permMsg);
        setCTMarksError(permMsg);
        setEventsError(permMsg);
        setSemestersError(permMsg);
        return true;
      }

      firestoreUnavailableRef.current = false;
      const userDocData = await fetchUserDocumentData(user.uid);
      let subjects = userDocData.subjects;
      if (subjects.length === 0 && localDataRef.current.subjects.length > 0) {
        subjects = await loadOrMigrateUserSubjects(user.uid, localDataRef.current.subjects);
      }
      let ctMarks = userDocData.ctMarks;
      if (ctMarks.length === 0 && localDataRef.current.ctMarks.length > 0) {
        ctMarks = await loadOrMigrateUserCTMarks(user.uid, localDataRef.current.ctMarks);
      }
      const [attendance, semesters] = await Promise.all([
        loadOrMigrateUserAttendance(user.uid, localDataRef.current.attendance),
        loadOrMigrateUserSemesters(user.uid, localDataRef.current.semesters),
      ]);
      const validSubjectIds = new Set(subjects.map(s => s.id));
      const events = await loadOrMigrateUserEvents(
        user.uid,
        localDataRef.current.events,
        validSubjectIds
      );
      setFirestoreProfile(profile);
      setFirestoreSubjects(subjects);
      setFirestoreAttendance(attendance);
      firestoreAttendanceRef.current = attendance;
      setFirestoreCTMarks(ctMarks);
      firestoreCTMarksRef.current = ctMarks;
      setFirestoreEvents(events);
      firestoreEventsRef.current = events;
      setFirestoreSemesters(semesters);
      firestoreSemestersRef.current = semesters;
      return true;
    } catch (err) {
      const formatted = formatAuthError(err);
      setAuthError(formatted);
      if (auth.currentUser && isPermissionDeniedError(err)) {
        setCurrentUser(auth.currentUser);
        setSubjectsError(formatted);
        setAttendanceError(formatted);
        setCTMarksError(formatted);
        setEventsError(formatted);
        setSemestersError(formatted);
      }
      return false;
    } finally {
      isManualAuthInProgressRef.current = false;
      setProfileSyncing(false);
      setSubjectsLoading(false);
      setAttendanceLoading(false);
      setCTMarksLoading(false);
      setEventsLoading(false);
      setSemestersLoading(false);
    }
  };

  const register = async (email: string, password: string, name: string): Promise<boolean> => {
    setAuthError(null);
    setSubjectsError(null);
    setAttendanceError(null);
    setCTMarksError(null);
    setEventsError(null);
    setSemestersError(null);
    isManualAuthInProgressRef.current = true;
    setProfileSyncing(true);
    setSubjectsLoading(true);
    setAttendanceLoading(true);
    setCTMarksLoading(true);
    setEventsLoading(true);
    setSemestersLoading(true);
    try {
      const { user, profile, firestorePermissionDenied } = await registerWithEmailPassword(
        email,
        password,
        name,
        localDataRef.current.profile,
        localDataRef.current.theme
      );
      setCurrentUser(user);
      setLocalData(prev => ({ ...prev, profile }));

      if (firestorePermissionDenied) {
        const permMsg =
          'Missing or insufficient Firestore permissions. Please publish the security rules from firestore.rules in Firebase Console > Firestore Database > Rules for academic-tracker-pro-5418a.';
        setAuthError(permMsg);
        setSubjectsError(permMsg);
        setAttendanceError(permMsg);
        setCTMarksError(permMsg);
        setEventsError(permMsg);
        setSemestersError(permMsg);
        return true;
      }

      firestoreUnavailableRef.current = false;
      const [subjects, attendance, semesters] = await Promise.all([
        loadOrMigrateUserSubjects(user.uid, localDataRef.current.subjects),
        loadOrMigrateUserAttendance(user.uid, localDataRef.current.attendance),
        loadOrMigrateUserSemesters(user.uid, localDataRef.current.semesters),
      ]);
      const validSubjectIds = new Set(subjects.map(s => s.id));
      const events = await loadOrMigrateUserEvents(
        user.uid,
        localDataRef.current.events,
        validSubjectIds
      );
      setFirestoreProfile(profile);
      setFirestoreSubjects(subjects);
      setFirestoreAttendance(attendance);
      firestoreAttendanceRef.current = attendance;
      setFirestoreCTMarks([]);
      firestoreCTMarksRef.current = [];
      setFirestoreEvents(events);
      firestoreEventsRef.current = events;
      setFirestoreSemesters(semesters);
      firestoreSemestersRef.current = semesters;
      return true;
    } catch (err) {
      const formatted = formatAuthError(err);
      setAuthError(formatted);
      if (auth.currentUser && isPermissionDeniedError(err)) {
        setCurrentUser(auth.currentUser);
        setSubjectsError(formatted);
        setAttendanceError(formatted);
        setCTMarksError(formatted);
        setEventsError(formatted);
        setSemestersError(formatted);
      }
      return false;
    } finally {
      isManualAuthInProgressRef.current = false;
      setProfileSyncing(false);
      setSubjectsLoading(false);
      setAttendanceLoading(false);
      setCTMarksLoading(false);
      setEventsLoading(false);
      setSemestersLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    setAuthError(null);
    setSubjectsError(null);
    setAttendanceError(null);
    setCTMarksError(null);
    setEventsError(null);
    setSemestersError(null);
    try {
      await logoutFirebaseUser();
      firestoreUnavailableRef.current = false;
      setCurrentUser(null);
      setFirestoreProfile(null);
      setFirestoreSubjects([]);
      setFirestoreAttendance([]);
      firestoreAttendanceRef.current = [];
      setFirestoreCTMarks([]);
      firestoreCTMarksRef.current = [];
      setFirestoreEvents([]);
      firestoreEventsRef.current = [];
      const emptySemesters = normalizeEightSemesters([]);
      setFirestoreSemesters(emptySemesters);
      firestoreSemestersRef.current = emptySemesters;
    } catch (err) {
      setAuthError(formatAuthError(err));
    }
  };

  // Effective app data uses Firestore profile, subjects, attendance, ctMarks, events, and semesters when authenticated, while keeping localStorage data intact
  const data: AppData = {
    ...localData,
    profile: currentUser && firestoreProfile ? firestoreProfile : localData.profile,
    subjects: currentUser ? firestoreSubjects : localData.subjects,
    attendance: currentUser ? firestoreAttendance : localData.attendance,
    ctMarks: currentUser ? firestoreCTMarks : localData.ctMarks,
    events: currentUser ? firestoreEvents : localData.events,
    semesters: currentUser
      ? firestoreSemesters
      : normalizeEightSemesters(localData.semesters),
  };

  const addSubject = (s: Omit<Subject, 'id'>): boolean => {
    const normalizedName = s.name.trim().toLowerCase();
    if (!normalizedName) return false;

    const currentList = currentUser ? firestoreSubjects : localData.subjects;
    const duplicate = currentList.some(
      item => item.name.trim().toLowerCase() === normalizedName
    );
    if (duplicate) {
      setSubjectsError(`"${s.name.trim()}" already exists in your subjects.`);
      return false;
    }

    const newSubject = sanitizeSubject({ ...s, id: crypto.randomUUID() });
    setSubjectsError(null);

    if (currentUser) {
      const uid = currentUser.uid;
      const previousSubjects = firestoreSubjects;
      setFirestoreSubjects(prev => {
        if (prev.some(item => item.id === newSubject.id || item.name.trim().toLowerCase() === normalizedName)) {
          return prev;
        }
        return [...prev, newSubject];
      });
      setSubjectsSyncing(true);
      createSubjectInFirestore(uid, newSubject)
        .catch(err => {
          console.warn('Error creating subject in Firestore:', err);
          setFirestoreSubjects(previousSubjects);
          setSubjectsError(formatAuthError(err));
        })
        .finally(() => {
          setSubjectsSyncing(false);
        });
      return true;
    }

    console.info(
      `[Firestore Subject Test]\nauthenticated UID: ${auth.currentUser?.uid ?? 'null'}\nFirestore project: ${firebaseConfig.projectId}\nFirestore database: ${firebaseConfig.firestoreDatabaseId}\nexact document path: users/null/subjects/${newSubject.id}\nwrite started: false\nwrite succeeded: false\nwrite error: auth.currentUser is null (unauthenticated local mode — saved only to localStorage)`
    );

    setLocalData(prev => {
      if (prev.subjects.some(item => item.name.trim().toLowerCase() === normalizedName)) {
        return prev;
      }
      return { ...prev, subjects: [...prev.subjects, newSubject] };
    });
    return true;
  };

  const updateSubject = (s: Subject): boolean => {
    const normalizedName = s.name.trim().toLowerCase();
    if (!normalizedName) return false;

    const currentList = currentUser ? firestoreSubjects : localData.subjects;
    const duplicateOther = currentList.some(
      item => item.id !== s.id && item.name.trim().toLowerCase() === normalizedName
    );
    if (duplicateOther) {
      setSubjectsError(`Another subject named "${s.name.trim()}" already exists.`);
      return false;
    }

    const sanitized = sanitizeSubject(s);
    setSubjectsError(null);

    if (currentUser) {
      const uid = currentUser.uid;
      const previousSubjects = firestoreSubjects;
      setFirestoreSubjects(prev =>
        prev.map(item => (item.id === sanitized.id ? sanitized : item))
      );
      setSubjectsSyncing(true);
      updateSubjectInFirestore(uid, sanitized)
        .catch(err => {
          console.warn('Error updating subject in Firestore:', err);
          setFirestoreSubjects(previousSubjects);
          setSubjectsError(formatAuthError(err));
        })
        .finally(() => {
          setSubjectsSyncing(false);
        });
      return true;
    }

    setLocalData(prev => ({
      ...prev,
      subjects: prev.subjects.map(item => (item.id === sanitized.id ? sanitized : item)),
    }));
    return true;
  };

  const deleteSubject = (id: string) => {
    setSubjectsError(null);

    if (currentUser) {
      const uid = currentUser.uid;
      const previousSubjects = firestoreSubjects;
      const subjectToDelete = previousSubjects.find(s => s.id === id);
      const previousAttendance = firestoreAttendanceRef.current;
      const previousCTMarks = firestoreCTMarksRef.current;
      const previousEvents = firestoreEventsRef.current;

      const linkedAttendanceIds = previousAttendance
        .filter(a => a.subjectId === id)
        .map(a => a.id);
      const linkedCTMarkIds = previousCTMarks
        .filter(m => m.subjectId === id)
        .map(m => m.id);
      const linkedEventIds = previousEvents
        .filter(e => e.subjectId === id)
        .map(e => e.id);

      setFirestoreSubjects(prev => prev.filter(s => s.id !== id));

      if (linkedAttendanceIds.length > 0) {
        const nextAttendance = previousAttendance.filter(a => a.subjectId !== id);
        firestoreAttendanceRef.current = nextAttendance;
        setFirestoreAttendance(nextAttendance);
      }
      if (linkedCTMarkIds.length > 0) {
        const nextCTMarks = previousCTMarks.filter(m => m.subjectId !== id);
        firestoreCTMarksRef.current = nextCTMarks;
        setFirestoreCTMarks(nextCTMarks);
      }
      if (linkedEventIds.length > 0) {
        const nextEvents = previousEvents.filter(e => e.subjectId !== id);
        firestoreEventsRef.current = nextEvents;
        setFirestoreEvents(nextEvents);
      }

      setSubjectsSyncing(true);
      Promise.all([
        deleteSubjectFromFirestore(uid, id, subjectToDelete?.name),
        ...linkedAttendanceIds.map(attId =>
          deleteAttendanceFromFirestore(uid, attId).catch(() => {})
        ),
        ...linkedEventIds.map(evId =>
          deleteAcademicEventFromFirestore(uid, evId).catch(() => {})
        ),
      ])
        .catch(err => {
          console.warn('Error deleting subject in Firestore:', err);
          setFirestoreSubjects(previousSubjects);
          firestoreAttendanceRef.current = previousAttendance;
          setFirestoreAttendance(previousAttendance);
          firestoreCTMarksRef.current = previousCTMarks;
          setFirestoreCTMarks(previousCTMarks);
          firestoreEventsRef.current = previousEvents;
          setFirestoreEvents(previousEvents);
          setSubjectsError(formatAuthError(err));
        })
        .finally(() => {
          setSubjectsSyncing(false);
        });
      return;
    }

    setLocalData(prev => ({
      ...prev,
      subjects: prev.subjects.filter(s => s.id !== id),
      attendance: prev.attendance.filter(a => a.subjectId !== id),
      ctMarks: prev.ctMarks.filter(m => m.subjectId !== id),
      events: prev.events.filter(e => e.subjectId !== id),
    }));
  };

  const markAttendance = (a: Omit<Attendance, 'id'>) => {
    const targetDate = new Date(a.date);
    setAttendanceError(null);

    if (currentUser) {
      const uid = currentUser.uid;
      const previousAttendance = firestoreAttendanceRef.current;
      const existingIndex = previousAttendance.findIndex(
        item => item.subjectId === a.subjectId && isSameDay(new Date(item.date), targetDate)
      );

      if (existingIndex !== -1) {
        const existingRecord = previousAttendance[existingIndex];
        const updatedRecord = sanitizeAttendance({
          id: existingRecord.id,
          subjectId: a.subjectId,
          date: a.date,
          isPresent: Boolean(a.isPresent),
        });

        // Remove any legacy duplicate entries in memory for the same subject + day
        const duplicateIdsToDelete = previousAttendance
          .filter(
            (item, idx) =>
              idx !== existingIndex &&
              item.subjectId === a.subjectId &&
              isSameDay(new Date(item.date), targetDate)
          )
          .map(item => item.id);

        const nextAttendance = previousAttendance
          .filter(
            (item, idx) =>
              idx === existingIndex ||
              !(item.subjectId === a.subjectId && isSameDay(new Date(item.date), targetDate))
          )
          .map(item => (item.id === existingRecord.id ? updatedRecord : item));

        firestoreAttendanceRef.current = nextAttendance;
        setFirestoreAttendance(nextAttendance);
        setAttendanceSyncing(true);

        Promise.all([
          updateAttendanceInFirestore(uid, updatedRecord).catch(() =>
            createAttendanceInFirestore(uid, updatedRecord)
          ),
          ...duplicateIdsToDelete.map(dupId =>
            deleteAttendanceFromFirestore(uid, dupId).catch(() => {})
          ),
        ])
          .catch(err => {
            console.warn('Error updating attendance in Firestore:', err);
            firestoreAttendanceRef.current = previousAttendance;
            setFirestoreAttendance(previousAttendance);
            setAttendanceError(formatAuthError(err));
          })
          .finally(() => {
            setAttendanceSyncing(false);
          });
        return;
      }

      const deterministicId = buildAttendanceId(a.subjectId, a.date);
      const newAttendance = sanitizeAttendance({
        id: deterministicId,
        subjectId: a.subjectId,
        date: a.date,
        isPresent: Boolean(a.isPresent),
      });

      const nextAttendance = [...previousAttendance, newAttendance];
      firestoreAttendanceRef.current = nextAttendance;
      setFirestoreAttendance(nextAttendance);
      setAttendanceSyncing(true);

      createAttendanceInFirestore(uid, newAttendance)
        .catch(err => {
          console.warn('Error creating attendance in Firestore:', err);
          firestoreAttendanceRef.current = previousAttendance;
          setFirestoreAttendance(previousAttendance);
          setAttendanceError(formatAuthError(err));
        })
        .finally(() => {
          setAttendanceSyncing(false);
        });
      return;
    }

    setLocalData(prev => {
      const existingIndex = prev.attendance.findIndex(
        item => item.subjectId === a.subjectId && isSameDay(new Date(item.date), targetDate)
      );

      if (existingIndex !== -1) {
        const existingId = prev.attendance[existingIndex].id;
        const updatedAttendance = prev.attendance
          .filter((item, idx) => idx === existingIndex || !(item.subjectId === a.subjectId && isSameDay(new Date(item.date), targetDate)))
          .map(item => item.id === existingId ? { ...item, date: a.date, isPresent: Boolean(a.isPresent) } : item);

        return { ...prev, attendance: updatedAttendance };
      }

      const newAttendance = sanitizeAttendance({
        id: buildAttendanceId(a.subjectId, a.date),
        subjectId: a.subjectId,
        date: a.date,
        isPresent: Boolean(a.isPresent),
      });
      return { ...prev, attendance: [...prev.attendance, newAttendance] };
    });
  };

  const deleteAttendance = (id: string) => {
    setAttendanceError(null);

    if (currentUser) {
      const uid = currentUser.uid;
      const previousAttendance = firestoreAttendanceRef.current;
      const nextAttendance = previousAttendance.filter(item => item.id !== id);
      firestoreAttendanceRef.current = nextAttendance;
      setFirestoreAttendance(nextAttendance);
      setAttendanceSyncing(true);

      deleteAttendanceFromFirestore(uid, id)
        .catch(err => {
          console.warn('Error deleting attendance in Firestore:', err);
          firestoreAttendanceRef.current = previousAttendance;
          setFirestoreAttendance(previousAttendance);
          setAttendanceError(formatAuthError(err));
        })
        .finally(() => {
          setAttendanceSyncing(false);
        });
      return;
    }

    setLocalData(prev => ({
      ...prev,
      attendance: prev.attendance.filter(item => item.id !== id),
    }));
  };

  const addCTMark = (m: Omit<CTMark, 'id'>): boolean => {
    const trimmedExam = String(m.examName || '').trim();
    const trimmedSubj = String(m.subjectId || '').trim();
    if (!trimmedExam || !trimmedSubj) return false;

    const targetKey = getCTMarkUniqueKey(trimmedSubj, trimmedExam);
    const currentList = currentUser ? firestoreCTMarksRef.current : localDataRef.current.ctMarks;
    const exists = currentList.some(
      item => getCTMarkUniqueKey(item.subjectId, item.examName) === targetKey
    );
    if (exists) {
      return false;
    }

    setCTMarksError(null);

    const baseDeterministicId = buildCTMarkId(trimmedSubj, trimmedExam);
    const idInUse = currentList.some(item => item.id === baseDeterministicId);
    const finalId = idInUse
      ? `${baseDeterministicId.slice(0, 118)}_${crypto.randomUUID().slice(0, 8)}`
      : baseDeterministicId;

    const currentSubjects = currentUser ? firestoreSubjects : localDataRef.current.subjects;
    const matchedSubject = currentSubjects.find(s => s.id === trimmedSubj);
    const resolvedSubjectName = String(m.subjectName || matchedSubject?.name || '').trim();

    const newMark = sanitizeCTMark({
      id: finalId,
      subjectId: trimmedSubj,
      subjectName: resolvedSubjectName,
      examName: trimmedExam,
      markObtained: m.markObtained,
      totalMark: m.totalMark,
    });

    if (currentUser) {
      const uid = currentUser.uid;
      const previousMarks = firestoreCTMarksRef.current;

      if (previousMarks.some(item => getCTMarkUniqueKey(item.subjectId, item.examName) === targetKey)) {
        return false;
      }

      const nextMarks = [...previousMarks, newMark];
      firestoreCTMarksRef.current = nextMarks;
      setFirestoreCTMarks(nextMarks);
      setCTMarksSyncing(true);

      createCTMarkInFirestore(uid, newMark)
        .catch(err => {
          console.warn('Error creating CT mark in Firestore:', err);
          firestoreCTMarksRef.current = previousMarks;
          setFirestoreCTMarks(previousMarks);
          setCTMarksError(formatAuthError(err));
        })
        .finally(() => {
          setCTMarksSyncing(false);
        });
      return true;
    }

    console.info(
      `[Firestore CT Mark Test]\nauthenticated UID: ${auth.currentUser?.uid ?? 'null'}\nFirestore project: ${firebaseConfig.projectId}\nFirestore database: ${firebaseConfig.firestoreDatabaseId}\nexact document path: users/null/ctMarks/${newMark.id}\nwrite started: false\nwrite succeeded: false\nwrite error: auth.currentUser is null (unauthenticated local mode — saved only to localStorage)`
    );

    setLocalData(prev => {
      const duplicateInPrev = prev.ctMarks.some(
        item => getCTMarkUniqueKey(item.subjectId, item.examName) === targetKey
      );
      if (duplicateInPrev) return prev;
      return { ...prev, ctMarks: [...prev.ctMarks, newMark] };
    });
    return true;
  };

  const updateCTMark = (m: CTMark): boolean => {
    const trimmedExam = String(m.examName || '').trim();
    const trimmedSubj = String(m.subjectId || '').trim();
    if (!trimmedExam || !trimmedSubj) return false;

    const targetKey = getCTMarkUniqueKey(trimmedSubj, trimmedExam);
    const currentList = currentUser ? firestoreCTMarksRef.current : localDataRef.current.ctMarks;
    const duplicateOther = currentList.some(
      item =>
        item.id !== m.id &&
        getCTMarkUniqueKey(item.subjectId, item.examName) === targetKey
    );
    if (duplicateOther) {
      return false;
    }

    const currentSubjects = currentUser ? firestoreSubjects : localDataRef.current.subjects;
    const matchedSubject = currentSubjects.find(s => s.id === trimmedSubj);
    const resolvedSubjectName = String(m.subjectName || matchedSubject?.name || '').trim();

    const sanitized = sanitizeCTMark({
      ...m,
      subjectName: resolvedSubjectName,
    });
    setCTMarksError(null);

    if (currentUser) {
      const uid = currentUser.uid;
      const previousMarks = firestoreCTMarksRef.current;

      if (
        previousMarks.some(
          item =>
            item.id !== sanitized.id &&
            getCTMarkUniqueKey(item.subjectId, item.examName) === targetKey
        )
      ) {
        return false;
      }

      const nextMarks = previousMarks.map(item =>
        item.id === sanitized.id ? sanitized : item
      );
      firestoreCTMarksRef.current = nextMarks;
      setFirestoreCTMarks(nextMarks);
      setCTMarksSyncing(true);

      updateCTMarkInFirestore(uid, sanitized)
        .catch(err => {
          console.warn('Error updating CT mark in Firestore:', err);
          firestoreCTMarksRef.current = previousMarks;
          setFirestoreCTMarks(previousMarks);
          setCTMarksError(formatAuthError(err));
        })
        .finally(() => {
          setCTMarksSyncing(false);
        });
      return true;
    }

    setLocalData(prev => ({
      ...prev,
      ctMarks: prev.ctMarks.map(item => (item.id === sanitized.id ? sanitized : item)),
    }));
    return true;
  };

  const deleteCTMark = (id: string) => {
    setCTMarksError(null);

    if (currentUser) {
      const uid = currentUser.uid;
      const previousMarks = firestoreCTMarksRef.current;
      const target = previousMarks.find(m => m.id === id);
      const targetKey = target ? getCTMarkUniqueKey(target.subjectId, target.examName) : null;

      const idsToDelete = previousMarks
        .filter(
          m =>
            m.id === id ||
            (targetKey !== null && getCTMarkUniqueKey(m.subjectId, m.examName) === targetKey)
        )
        .map(m => m.id);

      const nextMarks = previousMarks.filter(m => !idsToDelete.includes(m.id));
      firestoreCTMarksRef.current = nextMarks;
      setFirestoreCTMarks(nextMarks);
      setCTMarksSyncing(true);

      Promise.all(
        idsToDelete.map(delId => {
          const item = previousMarks.find(m => m.id === delId);
          return deleteCTMarkFromFirestore(uid, delId, item?.subjectName, item?.examName);
        })
      )
        .catch(err => {
          console.warn('Error deleting CT mark in Firestore:', err);
          firestoreCTMarksRef.current = previousMarks;
          setFirestoreCTMarks(previousMarks);
          setCTMarksError(formatAuthError(err));
        })
        .finally(() => {
          setCTMarksSyncing(false);
        });
      return;
    }

    setLocalData(prev => {
      const target = prev.ctMarks.find(m => m.id === id);
      if (!target) return prev;
      return {
        ...prev,
        ctMarks: prev.ctMarks.filter(
          m =>
            m.id !== id &&
            !(
              m.subjectId === target.subjectId &&
              m.examName.trim().toLowerCase() === target.examName.trim().toLowerCase()
            )
        ),
      };
    });
  };

  const addEvent = (e: Omit<AcademicEvent, 'id'>) => {
    const newEvent = sanitizeAcademicEvent({
      ...e,
      id: crypto.randomUUID(),
    });
    const targetKey = getAcademicEventUniqueKey(newEvent);
    setEventsError(null);

    if (currentUser) {
      const uid = currentUser.uid;
      const previousEvents = firestoreEventsRef.current;

      // Prevent accidental duplicates from rapid repeated clicks
      if (previousEvents.some(item => getAcademicEventUniqueKey(item) === targetKey)) {
        return;
      }

      const nextEvents = [...previousEvents, newEvent];
      firestoreEventsRef.current = nextEvents;
      setFirestoreEvents(nextEvents);
      setEventsSyncing(true);

      createAcademicEventInFirestore(uid, newEvent)
        .catch(err => {
          console.warn('Error creating academic event in Firestore:', err);
          firestoreEventsRef.current = previousEvents;
          setFirestoreEvents(previousEvents);
          setEventsError(formatAuthError(err));
        })
        .finally(() => {
          setEventsSyncing(false);
        });
      return;
    }

    setLocalData(prev => {
      if (prev.events.some(item => getAcademicEventUniqueKey(item) === targetKey)) {
        return prev;
      }
      return { ...prev, events: [...prev.events, newEvent] };
    });
  };

  const updateEvent = (e: AcademicEvent) => {
    const sanitized = sanitizeAcademicEvent(e);
    setEventsError(null);

    if (currentUser) {
      const uid = currentUser.uid;
      const previousEvents = firestoreEventsRef.current;
      const nextEvents = previousEvents.map(item =>
        item.id === sanitized.id ? sanitized : item
      );
      firestoreEventsRef.current = nextEvents;
      setFirestoreEvents(nextEvents);
      setEventsSyncing(true);

      updateAcademicEventInFirestore(uid, sanitized)
        .catch(err => {
          console.warn('Error updating academic event in Firestore:', err);
          firestoreEventsRef.current = previousEvents;
          setFirestoreEvents(previousEvents);
          setEventsError(formatAuthError(err));
        })
        .finally(() => {
          setEventsSyncing(false);
        });
      return;
    }

    setLocalData(prev => ({
      ...prev,
      events: prev.events.map(item => (item.id === sanitized.id ? sanitized : item)),
    }));
  };

  const deleteEvent = (id: string) => {
    setEventsError(null);

    if (currentUser) {
      const uid = currentUser.uid;
      const previousEvents = firestoreEventsRef.current;
      const nextEvents = previousEvents.filter(e => e.id !== id);
      firestoreEventsRef.current = nextEvents;
      setFirestoreEvents(nextEvents);
      setEventsSyncing(true);

      deleteAcademicEventFromFirestore(uid, id)
        .catch(err => {
          console.warn('Error deleting academic event in Firestore:', err);
          firestoreEventsRef.current = previousEvents;
          setFirestoreEvents(previousEvents);
          setEventsError(formatAuthError(err));
        })
        .finally(() => {
          setEventsSyncing(false);
        });
      return;
    }

    setLocalData(prev => ({ ...prev, events: prev.events.filter(e => e.id !== id) }));
  };

  const updateProfile = (p: UserProfile) => {
    const sanitized = sanitizeUserProfile(p);
    if (currentUser) {
      setFirestoreProfile(sanitized);
      setProfileSyncing(true);
      saveUserProfileToFirestore(currentUser.uid, sanitized, localData.theme)
        .catch(err => {
          console.warn('Error updating profile in Firestore:', err);
          setAuthError(formatAuthError(err));
        })
        .finally(() => {
          setProfileSyncing(false);
        });
    } else {
      setLocalData(prev => ({ ...prev, profile: sanitized }));
    }
  };

  const updateSemesterGPA = (id: number, gpa: number, credits: number) => {
    if (!isValidSemesterId(id)) {
      setSemestersError('Invalid semester ID. Only semesters 1 through 8 are supported.');
      return;
    }

    const sanitized = sanitizeSemesterGPA({ id, gpa, credits });
    setSemestersError(null);

    if (currentUser) {
      const uid = currentUser.uid;
      const previousSemesters = firestoreSemestersRef.current;
      const nextSemesters = normalizeEightSemesters(
        previousSemesters.map(s => (s.id === sanitized.id ? sanitized : s))
      );
      firestoreSemestersRef.current = nextSemesters;
      setFirestoreSemesters(nextSemesters);
      setSemestersSyncing(true);

      updateSemesterGPAInFirestore(uid, sanitized)
        .catch(err => {
          console.warn('Error updating semester GPA in Firestore:', err);
          firestoreSemestersRef.current = previousSemesters;
          setFirestoreSemesters(previousSemesters);
          setSemestersError(formatAuthError(err));
        })
        .finally(() => {
          setSemestersSyncing(false);
        });
      return;
    }

    setLocalData(prev => ({
      ...prev,
      semesters: normalizeEightSemesters(prev.semesters).map(s =>
        s.id === sanitized.id ? sanitized : s
      ),
    }));
  };

  const resetSemesterGPA = (id: number) => {
    if (!isValidSemesterId(id)) {
      setSemestersError('Invalid semester ID. Only semesters 1 through 8 are supported.');
      return;
    }

    const resetRecord: SemesterGPA = { id: Math.trunc(Number(id)), gpa: 0, credits: 0 };
    setSemestersError(null);

    if (currentUser) {
      const uid = currentUser.uid;
      const previousSemesters = firestoreSemestersRef.current;
      const nextSemesters = normalizeEightSemesters(
        previousSemesters.map(s => (s.id === resetRecord.id ? resetRecord : s))
      );
      firestoreSemestersRef.current = nextSemesters;
      setFirestoreSemesters(nextSemesters);
      setSemestersSyncing(true);

      deleteSemesterGPAFromFirestore(uid, resetRecord.id)
        .catch(err => {
          console.warn('Error resetting semester GPA in Firestore:', err);
          firestoreSemestersRef.current = previousSemesters;
          setFirestoreSemesters(previousSemesters);
          setSemestersError(formatAuthError(err));
        })
        .finally(() => {
          setSemestersSyncing(false);
        });
      return;
    }

    setLocalData(prev => ({
      ...prev,
      semesters: normalizeEightSemesters(prev.semesters).map(s =>
        s.id === resetRecord.id ? resetRecord : s
      ),
    }));
  };

  const toggleTheme = () => {
    setLocalData(prev => {
      const nextTheme = prev.theme === 'light' ? 'dark' : 'light';
      if (currentUser && firestoreProfile) {
        saveUserProfileToFirestore(currentUser.uid, firestoreProfile, nextTheme).catch(() => {});
      }
      return { ...prev, theme: nextTheme };
    });
  };

  const resetData = () => {
    localStorage.removeItem('academic_tracker_pro_data');
    window.location.reload();
  };

  return (
    <AppContext.Provider value={{
      data,
      currentUser,
      authLoading,
      profileSyncing,
      subjectsLoading,
      subjectsSyncing,
      subjectsError,
      clearSubjectsError,
      attendanceLoading,
      attendanceSyncing,
      attendanceError,
      clearAttendanceError,
      ctMarksLoading,
      ctMarksSyncing,
      ctMarksError,
      clearCTMarksError,
      eventsLoading,
      eventsSyncing,
      eventsError,
      clearEventsError,
      semestersLoading,
      semestersSyncing,
      semestersError,
      clearSemestersError,
      authError,
      clearAuthError,
      login,
      register,
      logout,
      addSubject,
      updateSubject,
      deleteSubject,
      markAttendance,
      deleteAttendance,
      addCTMark,
      updateCTMark,
      deleteCTMark,
      addEvent,
      updateEvent,
      deleteEvent,
      updateProfile,
      updateSemesterGPA,
      resetSemesterGPA,
      toggleTheme,
      resetData
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};

