import {
  collection,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  writeBatch,
  arrayUnion,
  CollectionReference,
  DocumentReference,
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  SnapshotOptions,
  WithFieldValue,
} from 'firebase/firestore';
import { format } from 'date-fns';
import { db, auth, firebaseConfig } from './firebase';
import {
  Subject,
  SubjectMark,
  SubjectMarks,
  Attendance,
  CTMark,
  AcademicEvent,
  UserProfile,
  SemesterGPA,
  AppData,
} from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function isPermissionDeniedError(error: unknown): boolean {
  const code = (error as { code?: string })?.code || '';
  const message = error instanceof Error ? error.message : String(error ?? '');
  return (
    code === 'permission-denied' ||
    code === 'firestore/permission-denied' ||
    message.includes('Missing or insufficient permissions') ||
    message.includes('permission-denied')
  );
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
  userId?: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid ?? userId ?? null,
      email: auth.currentUser?.email ?? null,
      emailVerified: auth.currentUser?.emailVerified ?? null,
      isAnonymous: auth.currentUser?.isAnonymous ?? null,
      tenantId: auth.currentUser?.tenantId ?? null,
      providerInfo:
        auth.currentUser?.providerData?.map(provider => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.warn('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Per-user Firestore document & subcollection paths:
 * users/{userId}/
 *   profile
 *   subjects
 *   attendance
 *   ctMarks
 *   events
 *   semesters
 */
export const USER_SUBCOLLECTIONS = {
  PROFILE: 'profile',
  SUBJECTS: 'subjects',
  ATTENDANCE: 'attendance',
  CT_MARKS: 'ctMarks',
  EVENTS: 'events',
  SEMESTERS: 'semesters',
} as const;

export type UserProfileDocument = UserProfile & {
  theme?: 'light' | 'dark';
};

export type UserRootDocument = Partial<UserProfile> & {
  profile?: UserProfile;
  theme?: 'light' | 'dark';
  updatedAt?: string;
  subjects?: Subject[];
  subjectMarks?: SubjectMarks;
  ctMarks?: CTMark[];
};

export interface UserAcademicCollections {
  userDoc: DocumentReference<UserRootDocument>;
  profileCollection: CollectionReference<UserProfileDocument>;
  profileDoc: DocumentReference<UserProfileDocument>;
  subjects: CollectionReference<Subject>;
  attendance: CollectionReference<Attendance>;
  ctMarks: CollectionReference<CTMark>;
  events: CollectionReference<AcademicEvent>;
  semesters: CollectionReference<SemesterGPA>;
}

function createConverter<T extends Record<string, unknown>>(): FirestoreDataConverter<T> {
  return {
    toFirestore(modelObject: WithFieldValue<T>) {
      return modelObject;
    },
    fromFirestore(snapshot: QueryDocumentSnapshot, options: SnapshotOptions): T {
      return snapshot.data(options) as T;
    },
  };
}

export const userRootConverter = createConverter<UserRootDocument>();
export const profileConverter = createConverter<UserProfileDocument>();
export const subjectConverter = createConverter<Subject>();
export const attendanceConverter = createConverter<Attendance>();
export const ctMarkConverter = createConverter<CTMark>();
export const eventConverter = createConverter<AcademicEvent>();
export const semesterConverter = createConverter<SemesterGPA>();

/**
 * Helper to build Firestore path strings for a specific userId.
 */
export const getUserFirestorePaths = (userId: string) => ({
  userRoot: `users/${userId}`,
  profile: `users/${userId}/${USER_SUBCOLLECTIONS.PROFILE}`,
  profileMainDoc: `users/${userId}/${USER_SUBCOLLECTIONS.PROFILE}/main`,
  subjects: `users/${userId}/${USER_SUBCOLLECTIONS.SUBJECTS}`,
  attendance: `users/${userId}/${USER_SUBCOLLECTIONS.ATTENDANCE}`,
  ctMarks: `users/${userId}/${USER_SUBCOLLECTIONS.CT_MARKS}`,
  events: `users/${userId}/${USER_SUBCOLLECTIONS.EVENTS}`,
  semesters: `users/${userId}/${USER_SUBCOLLECTIONS.SEMESTERS}`,
});

/**
 * Returns typed Firestore references for a given userId:
 * users/{userId}/
 *   profile
 *   subjects
 *   attendance
 *   ctMarks
 *   events
 *   semesters
 */
export const getUserRefs = (userId: string): UserAcademicCollections => {
  const paths = getUserFirestorePaths(userId);
  return {
    userDoc: doc(db, paths.userRoot).withConverter(userRootConverter),
    profileCollection: collection(db, paths.profile).withConverter(profileConverter),
    profileDoc: doc(db, paths.profileMainDoc).withConverter(profileConverter),
    subjects: collection(db, paths.subjects).withConverter(subjectConverter),
    attendance: collection(db, paths.attendance).withConverter(attendanceConverter),
    ctMarks: collection(db, paths.ctMarks).withConverter(ctMarkConverter),
    events: collection(db, paths.events).withConverter(eventConverter),
    semesters: collection(db, paths.semesters).withConverter(semesterConverter),
  };
};

/**
 * Returns typed DocumentReferences for individual items under `users/{userId}/...`
 */
export const getUserItemDocRefs = (userId: string) => {
  const paths = getUserFirestorePaths(userId);
  return {
    subjectDoc: (subjectId: string) =>
      doc(db, paths.subjects, subjectId).withConverter(subjectConverter),
    attendanceDoc: (attendanceId: string) =>
      doc(db, paths.attendance, attendanceId).withConverter(attendanceConverter),
    ctMarkDoc: (ctMarkId: string) =>
      doc(db, paths.ctMarks, ctMarkId).withConverter(ctMarkConverter),
    eventDoc: (eventId: string) =>
      doc(db, paths.events, eventId).withConverter(eventConverter),
    semesterDoc: (semesterId: number | string) =>
      doc(db, paths.semesters, String(semesterId)).withConverter(semesterConverter),
  };
};

/**
 * Sanitizes a UserProfile payload to strictly adhere to firebase-blueprint.json
 * and firestore.rules constraints.
 */
export function sanitizeUserProfile(profile: UserProfile): UserProfile {
  const rawName = (profile.name || '').trim();
  const safeName = (rawName.length > 0 ? rawName : 'Student').slice(0, 100);
  const safeTargetGPA = Math.max(0, Math.min(4.0, Number(profile.targetGPA) || 0));
  const safeProfilePic =
    typeof profile.profilePic === 'string' && profile.profilePic.length <= 500000
      ? profile.profilePic
      : null;

  return {
    name: safeName,
    profilePic: safeProfilePic,
    targetGPA: safeTargetGPA,
    greeting: String(profile.greeting ?? '').slice(0, 120),
    studentId: String(profile.studentId ?? '').slice(0, 64),
    department: String(profile.department ?? '').slice(0, 120),
    semester: String(profile.semester ?? '').slice(0, 64),
    batch: String(profile.batch ?? '').slice(0, 64),
    email: String(profile.email ?? '').slice(0, 150),
    phone: String(profile.phone ?? '').slice(0, 50),
    address: String(profile.address ?? '').slice(0, 250),
  };
}

/**
 * Strictly verifies that the requested uid belongs to the currently authenticated user.
 */
function assertCurrentUserAccess(uid: string): void {
  if (!auth.currentUser || auth.currentUser.uid !== uid) {
    throw new Error('Unauthorized access: Cannot access another user\'s Firestore data.');
  }
}

/**
 * Reads the authenticated user's profile directly from the main user document at `users/{uid}`.
 */
export async function getUserProfileFromFirestore(uid: string): Promise<UserProfile | null> {
  assertCurrentUserAccess(uid);
  const paths = getUserFirestorePaths(uid);
  const refs = getUserRefs(uid);

  try {
    const rootSnap = await getDoc(refs.userDoc);
    if (rootSnap.exists()) {
      const data = rootSnap.data();
      // Check top-level profile fields on users/{uid}
      if (data.name !== undefined || data.email !== undefined) {
        return sanitizeUserProfile(data as unknown as UserProfile);
      }
      // Check legacy rootData.profile
      if (data.profile) {
        return sanitizeUserProfile(data.profile);
      }
    }

    // Seamless legacy fallback check: users/{uid}/profile/main
    try {
      const legacyDocRef = doc(db, paths.userRoot, 'profile', 'main');
      const legacySnap = await getDoc(legacyDocRef);
      if (legacySnap.exists()) {
        const legacyData = legacySnap.data() as UserProfile;
        const sanitized = sanitizeUserProfile(legacyData);
        // Automatically migrate to top-level users/{uid}
        await setDoc(refs.userDoc, { ...sanitized }, { merge: true });
        return sanitized;
      }
    } catch {
      // Non-fatal legacy read error
    }

    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, paths.userRoot, uid);
  }
}

/**
 * Saves the authenticated user's profile as top-level fields directly in `users/{uid}`.
 */
export async function saveUserProfileToFirestore(
  uid: string,
  profile: UserProfile,
  theme?: 'light' | 'dark'
): Promise<UserProfile> {
  assertCurrentUserAccess(uid);
  const paths = getUserFirestorePaths(uid);
  const refs = getUserRefs(uid);
  const sanitized = sanitizeUserProfile(profile);
  const payload: Record<string, unknown> = {
    ...sanitized,
    updatedAt: new Date().toISOString(),
  };
  if (theme) {
    payload.theme = theme;
  }

  try {
    await setDoc(refs.userDoc, payload, { merge: true });
    return sanitized;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, paths.userRoot, uid);
  }
}

/**
 * Loads the user's profile from `users/{uid}`, or creates it if it doesn't exist yet.
 */
export async function getOrCreateUserProfile(
  uid: string,
  _fallbackProfile: UserProfile,
  authEmail?: string | null,
  authDisplayName?: string | null,
  theme?: 'light' | 'dark'
): Promise<UserProfile> {
  assertCurrentUserAccess(uid);
  const existing = await getUserProfileFromFirestore(uid);
  if (existing) {
    return existing;
  }

  const initialProfile: UserProfile = sanitizeUserProfile({
    name: authDisplayName?.trim() || 'Student',
    profilePic: null,
    targetGPA: 0,
    greeting: '',
    studentId: '',
    department: '',
    semester: '',
    batch: '',
    email: authEmail?.trim() || '',
    phone: '',
    address: '',
  });

  return await saveUserProfileToFirestore(uid, initialProfile, theme);
}

/**
 * Fetches the single `users/{uid}` document and extracts top-level profile fields,
 * subjects, the nested `subjectMarks` map, and derived `ctMarks` array.
 */
export async function fetchUserDocumentData(uid: string): Promise<{
  profile: UserProfile | null;
  subjects: Subject[];
  subjectMarks: SubjectMarks;
  ctMarks: CTMark[];
  theme?: 'light' | 'dark';
}> {
  assertCurrentUserAccess(uid);
  const paths = getUserFirestorePaths(uid);
  const userRef = doc(db, paths.userRoot);

  try {
    const rootSnap = await getDoc(userRef);
    if (!rootSnap.exists()) {
      return {
        profile: null,
        subjects: [],
        subjectMarks: {},
        ctMarks: [],
      };
    }

    const data = rootSnap.data();
    let profile: UserProfile | null = null;
    if (data.name !== undefined || data.email !== undefined) {
      profile = sanitizeUserProfile(data as unknown as UserProfile);
    } else if (data.profile) {
      profile = sanitizeUserProfile(data.profile);
    }

    const subjectMarks: SubjectMarks =
      typeof data.subjectMarks === 'object' && data.subjectMarks !== null
        ? (data.subjectMarks as SubjectMarks)
        : {};

    // Extract subjects stored directly on users/{uid}
    const storedSubjects: Subject[] = Array.isArray(data.subjects)
      ? data.subjects.map(sanitizeSubject)
      : [];

    const subjectsMap = new Map<string, Subject>();
    for (const s of storedSubjects) {
      subjectsMap.set(s.name.trim().toLowerCase(), s);
    }

    // Ensure all keys in subjectMarks are represented in subjects
    for (const subjName of Object.keys(subjectMarks)) {
      const lower = subjName.trim().toLowerCase();
      if (!subjectsMap.has(lower) && subjName.trim().length > 0) {
        const generatedSubject: Subject = {
          id: `subj_${lower.replace(/[^a-z0-9]/g, '_')}`,
          name: subjName.trim(),
          creditHours: 3,
          colorTag: '#1a237e',
        };
        subjectsMap.set(lower, generatedSubject);
      }
    }

    const subjects = Array.from(subjectsMap.values());

    // Flatten subjectMarks into CTMark[] for UI components
    const ctMarks: CTMark[] = [];
    for (const [subjName, marks] of Object.entries(subjectMarks)) {
      if (!Array.isArray(marks)) continue;
      const matchingSubject = subjects.find(
        s => s.name.trim().toLowerCase() === subjName.trim().toLowerCase()
      );
      const subjectId = matchingSubject?.id || `subj_${subjName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

      for (const m of marks) {
        if (!m || typeof m.examName !== 'string') continue;
        ctMarks.push({
          id: buildCTMarkId(subjectId, m.examName),
          subjectId,
          subjectName: subjName,
          examName: m.examName,
          markObtained: Number(m.markObtained) || 0,
          totalMark: Number(m.totalMark) || 20,
        });
      }
    }

    return {
      profile,
      subjects,
      subjectMarks,
      ctMarks: deduplicateCTMarkRecords(ctMarks),
      theme: data.theme as 'light' | 'dark' | undefined,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, paths.userRoot, uid);
  }
}

const SUBJECTS_MIGRATION_STORAGE_KEY = 'academic_tracker_pro_subjects_migration_v1';

interface SubjectsMigrationState {
  migratedGlobal?: boolean;
  migratedByUser?: Record<string, boolean>;
}

function getSubjectsMigrationState(): SubjectsMigrationState {
  try {
    const raw = localStorage.getItem(SUBJECTS_MIGRATION_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as SubjectsMigrationState;
  } catch {
    return {};
  }
}

function markSubjectsMigrationDone(uid: string, didMigrateLocalData: boolean): void {
  try {
    const current = getSubjectsMigrationState();
    const next: SubjectsMigrationState = {
      migratedGlobal: current.migratedGlobal || didMigrateLocalData,
      migratedByUser: {
        ...(current.migratedByUser || {}),
        [uid]: true,
      },
    };
    localStorage.setItem(SUBJECTS_MIGRATION_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage write errors
  }
}

/**
 * Sanitizes a Subject payload to strictly adhere to firebase-blueprint.json
 * and firestore.rules constraints (`id`, `name`, `creditHours`, `colorTag`).
 */
export function sanitizeSubject(subject: Subject): Subject {
  const validIdPattern = /^[a-zA-Z0-9_\-]+$/;
  const rawId = String(subject.id || '').trim();
  const safeId =
    rawId.length >= 1 && rawId.length <= 128 && validIdPattern.test(rawId)
      ? rawId
      : crypto.randomUUID();

  const rawName = String(subject.name || '').trim();
  const safeName = (rawName.length > 0 ? rawName : 'Untitled Subject').slice(0, 150);

  const parsedCredits = Number(subject.creditHours);
  const safeCreditHours = Number.isFinite(parsedCredits)
    ? Math.max(0, Math.min(30, parsedCredits))
    : 3;

  const rawColor = String(subject.colorTag || '').trim();
  const safeColorTag = (rawColor.length > 0 ? rawColor : '#1a237e').slice(0, 32);

  return {
    id: safeId,
    name: safeName,
    creditHours: safeCreditHours,
    colorTag: safeColorTag,
  };
}

/**
 * Reads all subjects for the authenticated user from the main user document at `users/{uid}`.
 * NO subcollections are queried.
 */
export async function getUserSubjectsFromFirestore(uid: string): Promise<Subject[]> {
  assertCurrentUserAccess(uid);
  const userDocData = await fetchUserDocumentData(uid);
  return userDocData.subjects;
}

/**
 * Creates a new subject directly inside the main user document at `users/{uid}`.
 * NO subcollections are created.
 */
export async function createSubjectInFirestore(uid: string, subject: Subject): Promise<Subject> {
  assertCurrentUserAccess(uid);
  const sanitized = sanitizeSubject(subject);
  const paths = getUserFirestorePaths(uid);
  const userRef = doc(db, paths.userRoot);

  try {
    const snap = await getDoc(userRef);
    const existingSubjects: Subject[] = Array.isArray(snap.data()?.subjects)
      ? snap.data()!.subjects.map(sanitizeSubject)
      : [];
    const nextSubjects = existingSubjects.some(
      s => s.id === sanitized.id || s.name.trim().toLowerCase() === sanitized.name.trim().toLowerCase()
    )
      ? existingSubjects
      : [...existingSubjects, sanitized];

    await setDoc(
      userRef,
      {
        subjects: nextSubjects,
        [`subjectMarks.${sanitized.name}`]: [],
      },
      { merge: true }
    );

    return sanitized;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, paths.userRoot, uid);
  }
}

/**
 * Updates an existing subject directly inside the main user document at `users/{uid}`.
 * NO subcollections are updated.
 */
export async function updateSubjectInFirestore(
  uid: string,
  subject: Subject,
  oldName?: string
): Promise<Subject> {
  assertCurrentUserAccess(uid);
  const sanitized = sanitizeSubject(subject);
  const paths = getUserFirestorePaths(uid);
  const userRef = doc(db, paths.userRoot);

  try {
    const snap = await getDoc(userRef);
    const existingSubjects: Subject[] = Array.isArray(snap.data()?.subjects)
      ? snap.data()!.subjects.map(sanitizeSubject)
      : [];
    const updatedSubjects = existingSubjects.map(s => (s.id === sanitized.id ? sanitized : s));

    const existingSubjectMarks = (snap.data()?.subjectMarks ?? {}) as SubjectMarks;
    const previousName = oldName || existingSubjects.find(s => s.id === sanitized.id)?.name || '';

    const updatePayload: Record<string, any> = {
      subjects: updatedSubjects,
    };

    if (previousName && previousName !== sanitized.name && existingSubjectMarks[previousName]) {
      updatePayload[`subjectMarks.${sanitized.name}`] = existingSubjectMarks[previousName];
      updatePayload[`subjectMarks.${previousName}`] = deleteField();
    }

    await updateDoc(userRef, updatePayload);
    return sanitized;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, paths.userRoot, uid);
  }
}

/**
 * Deletes a subject directly from the main user document at `users/{uid}`.
 * Completely removes its entry from `subjectMarks` and `subjects`.
 * NO subcollections are deleted.
 */
export async function deleteSubjectFromFirestore(
  uid: string,
  subjectId: string,
  subjectName?: string
): Promise<void> {
  assertCurrentUserAccess(uid);
  const paths = getUserFirestorePaths(uid);
  const userRef = doc(db, paths.userRoot);

  try {
    const snap = await getDoc(userRef);
    if (!snap.exists()) return;
    const existingSubjects: Subject[] = Array.isArray(snap.data()?.subjects)
      ? snap.data()!.subjects.map(sanitizeSubject)
      : [];
    const nextSubjects = existingSubjects.filter(s => s.id !== subjectId);
    const resolvedName =
      subjectName ||
      existingSubjects.find(s => s.id === subjectId)?.name ||
      '';

    const updatePayload: Record<string, any> = {
      subjects: nextSubjects,
    };
    if (resolvedName) {
      updatePayload[`subjectMarks.${resolvedName}`] = deleteField();
    }

    await updateDoc(userRef, updatePayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, paths.userRoot, uid);
  }
}

/**
 * Loads the authenticated user's subjects from `users/{uid}.subjects` and `users/{uid}.subjectMarks`.
 * If not yet in Firestore, migrates localSubjects directly into `users/{uid}`.
 * NO subcollections are used.
 */
export async function loadOrMigrateUserSubjects(
  uid: string,
  localSubjects: Subject[]
): Promise<Subject[]> {
  assertCurrentUserAccess(uid);
  const paths = getUserFirestorePaths(uid);
  const userRef = doc(db, paths.userRoot);

  const existing = await getUserSubjectsFromFirestore(uid);
  if (existing.length > 0) {
    markSubjectsMigrationDone(uid, false);
    return existing;
  }

  const migrationState = getSubjectsMigrationState();
  const alreadyMigratedForUser = Boolean(migrationState.migratedByUser?.[uid]);
  const alreadyMigratedGlobally = Boolean(migrationState.migratedGlobal);

  if (
    alreadyMigratedForUser ||
    alreadyMigratedGlobally ||
    !Array.isArray(localSubjects) ||
    localSubjects.length === 0
  ) {
    markSubjectsMigrationDone(uid, false);
    return [];
  }

  const toMigrate = localSubjects.map(sanitizeSubject);
  const initialSubjectMarks: Record<string, any[]> = {};
  for (const s of toMigrate) {
    initialSubjectMarks[s.name] = [];
  }

  try {
    await setDoc(
      userRef,
      {
        subjects: toMigrate,
        subjectMarks: initialSubjectMarks,
      },
      { merge: true }
    );
    markSubjectsMigrationDone(uid, true);
    return toMigrate;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, paths.userRoot, uid);
  }
}

const ATTENDANCE_MIGRATION_STORAGE_KEY = 'academic_tracker_pro_attendance_migration_v1';

interface AttendanceMigrationState {
  migratedGlobal?: boolean;
  migratedByUser?: Record<string, boolean>;
}

function getAttendanceMigrationState(): AttendanceMigrationState {
  try {
    const raw = localStorage.getItem(ATTENDANCE_MIGRATION_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as AttendanceMigrationState;
  } catch {
    return {};
  }
}

function markAttendanceMigrationDone(uid: string, didMigrateLocalData: boolean): void {
  try {
    const current = getAttendanceMigrationState();
    const next: AttendanceMigrationState = {
      migratedGlobal: current.migratedGlobal || didMigrateLocalData,
      migratedByUser: {
        ...(current.migratedByUser || {}),
        [uid]: true,
      },
    };
    localStorage.setItem(ATTENDANCE_MIGRATION_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage write errors
  }
}

/**
 * Returns the canonical calendar date key (YYYY-MM-DD in local time) for an attendance date.
 */
export function getAttendanceDateKey(dateStr: string): string {
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) {
    return String(dateStr || '').slice(0, 10);
  }
  return format(parsed, 'yyyy-MM-dd');
}

/**
 * Returns a deterministic composite uniqueness key for (subjectId + date).
 */
export function getAttendanceUniqueKey(subjectId: string, dateStr: string): string {
  return `${subjectId.trim()}__${getAttendanceDateKey(dateStr)}`;
}

/**
 * Builds a deterministic Firestore-safe document ID for (subjectId + calendar date)
 * matching `^[a-zA-Z0-9_\-]+$` and <= 128 chars.
 */
export function buildAttendanceId(subjectId: string, dateStr: string): string {
  const safeSubj = subjectId.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 90) || 'subj';
  const dateKey = getAttendanceDateKey(dateStr).replace(/[^0-9\-]/g, '');
  return `${safeSubj}_${dateKey || 'date'}`.slice(0, 128);
}

/**
 * Sanitizes an Attendance payload to strictly adhere to firebase-blueprint.json
 * and firestore.rules constraints (`id`, `subjectId`, `date`, `isPresent`).
 */
export function sanitizeAttendance(attendance: Attendance): Attendance {
  const validIdPattern = /^[a-zA-Z0-9_\-]+$/;
  const rawSubjectId = String(attendance.subjectId || '').trim();
  const safeSubjectId =
    rawSubjectId.length >= 1 && rawSubjectId.length <= 128 && validIdPattern.test(rawSubjectId)
      ? rawSubjectId
      : rawSubjectId.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 128) || 'subject';

  const parsedDate = new Date(attendance.date);
  const safeDate = !Number.isNaN(parsedDate.getTime())
    ? parsedDate.toISOString()
    : new Date().toISOString();

  const rawId = String(attendance.id || '').trim();
  const safeId =
    rawId.length >= 1 && rawId.length <= 128 && validIdPattern.test(rawId)
      ? rawId
      : buildAttendanceId(safeSubjectId, safeDate);

  return {
    id: safeId,
    subjectId: safeSubjectId,
    date: safeDate.slice(0, 64),
    isPresent: Boolean(attendance.isPresent),
  };
}

/**
 * Deduplicates an array of attendance records by (subjectId + calendar day),
 * keeping the latest entry for each unique (subjectId, date) pair.
 */
export function deduplicateAttendanceRecords(records: Attendance[]): Attendance[] {
  const byUniqueKey = new Map<string, Attendance>();
  for (const rec of records) {
    const sanitized = sanitizeAttendance(rec);
    const key = getAttendanceUniqueKey(sanitized.subjectId, sanitized.date);
    const existing = byUniqueKey.get(key);
    if (existing) {
      // Preserve the first/existing document ID for this (subjectId, date) while taking latest status
      byUniqueKey.set(key, {
        ...sanitized,
        id: existing.id,
      });
    } else {
      byUniqueKey.set(key, sanitized);
    }
  }
  return Array.from(byUniqueKey.values());
}

/**
 * Reads all attendance records for the authenticated user from `users/{uid}/attendance`.
 */
export async function getUserAttendanceFromFirestore(uid: string): Promise<Attendance[]> {
  assertCurrentUserAccess(uid);
  const paths = getUserFirestorePaths(uid);
  const refs = getUserRefs(uid);

  try {
    const snapshot = await getDocs(refs.attendance);
    const rawRecords: Attendance[] = [];

    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      rawRecords.push(
        sanitizeAttendance({
          ...data,
          id: docSnap.id,
        })
      );
    });

    return deduplicateAttendanceRecords(rawRecords);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, paths.attendance, uid);
  }
}

/**
 * Creates a new attendance record at `users/{uid}/attendance/{attendanceId}`.
 */
export async function createAttendanceInFirestore(
  uid: string,
  attendance: Attendance
): Promise<Attendance> {
  assertCurrentUserAccess(uid);
  const sanitized = sanitizeAttendance(attendance);
  const paths = getUserFirestorePaths(uid);
  const docRef = getUserItemDocRefs(uid).attendanceDoc(sanitized.id);

  try {
    await setDoc(docRef, sanitized);
    return sanitized;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `${paths.attendance}/${sanitized.id}`, uid);
  }
}

/**
 * Updates an existing attendance record at `users/{uid}/attendance/{attendanceId}`.
 */
export async function updateAttendanceInFirestore(
  uid: string,
  attendance: Attendance
): Promise<Attendance> {
  assertCurrentUserAccess(uid);
  const sanitized = sanitizeAttendance(attendance);
  const paths = getUserFirestorePaths(uid);
  const docRef = getUserItemDocRefs(uid).attendanceDoc(sanitized.id);

  try {
    await updateDoc(docRef, {
      subjectId: sanitized.subjectId,
      date: sanitized.date,
      isPresent: sanitized.isPresent,
    });
    return sanitized;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${paths.attendance}/${sanitized.id}`, uid);
  }
}

/**
 * Deletes an attendance record at `users/{uid}/attendance/{attendanceId}`.
 */
export async function deleteAttendanceFromFirestore(
  uid: string,
  attendanceId: string
): Promise<void> {
  assertCurrentUserAccess(uid);
  const paths = getUserFirestorePaths(uid);
  const docRef = getUserItemDocRefs(uid).attendanceDoc(attendanceId);

  try {
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${paths.attendance}/${attendanceId}`, uid);
  }
}

/**
 * Loads the authenticated user's attendance records from `users/{uid}/attendance`.
 * If Firestore has no attendance records for this user and a one-time migration from
 * localStorage has not yet occurred, safely migrates deduplicated localAttendance
 * records to `users/{uid}/attendance` without deleting localStorage data.
 */
export async function loadOrMigrateUserAttendance(
  uid: string,
  localAttendance: Attendance[]
): Promise<Attendance[]> {
  assertCurrentUserAccess(uid);
  const existingFirestoreAttendance = await getUserAttendanceFromFirestore(uid);

  if (existingFirestoreAttendance.length > 0) {
    markAttendanceMigrationDone(uid, false);
    return existingFirestoreAttendance;
  }

  const migrationState = getAttendanceMigrationState();
  const alreadyMigratedForUser = Boolean(migrationState.migratedByUser?.[uid]);
  const alreadyMigratedGlobally = Boolean(migrationState.migratedGlobal);

  if (
    alreadyMigratedForUser ||
    alreadyMigratedGlobally ||
    !Array.isArray(localAttendance) ||
    localAttendance.length === 0
  ) {
    markAttendanceMigrationDone(uid, false);
    return [];
  }

  const toMigrate = deduplicateAttendanceRecords(localAttendance);

  if (toMigrate.length === 0) {
    markAttendanceMigrationDone(uid, false);
    return [];
  }

  const paths = getUserFirestorePaths(uid);
  const itemRefs = getUserItemDocRefs(uid);

  try {
    const batch = writeBatch(db);
    for (const record of toMigrate) {
      batch.set(itemRefs.attendanceDoc(record.id), record);
    }
    await batch.commit();
    markAttendanceMigrationDone(uid, true);
    return toMigrate;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, paths.attendance, uid);
  }
}

const CT_MARKS_MIGRATION_STORAGE_KEY = 'academic_tracker_pro_ct_marks_migration_v1';

interface CTMarksMigrationState {
  migratedGlobal?: boolean;
  migratedByUser?: Record<string, boolean>;
}

function getCTMarksMigrationState(): CTMarksMigrationState {
  try {
    const raw = localStorage.getItem(CT_MARKS_MIGRATION_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as CTMarksMigrationState;
  } catch {
    return {};
  }
}

function markCTMarksMigrationDone(uid: string, didMigrateLocalData: boolean): void {
  try {
    const current = getCTMarksMigrationState();
    const next: CTMarksMigrationState = {
      migratedGlobal: current.migratedGlobal || didMigrateLocalData,
      migratedByUser: {
        ...(current.migratedByUser || {}),
        [uid]: true,
      },
    };
    localStorage.setItem(CT_MARKS_MIGRATION_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage write errors
  }
}

export const VALID_CT_EXAM_NAMES = ['ct 1', 'ct 2', 'ct 3', 'ct 4'] as const;

/**
 * Returns true if and only if examName is one of CT 1, CT 2, CT 3, or CT 4 (case-insensitive).
 * Assignment, Quiz, Other, and any non-CT assessments return false.
 */
export function isClassTestExam(examName: string): boolean {
  return (VALID_CT_EXAM_NAMES as readonly string[]).includes(
    String(examName || '').trim().toLowerCase()
  );
}

/**
 * Calculates the Best-3 CT Average and CT count for a given subjectId.
 * Strictly includes ONLY Class Test marks (CT 1, CT 2, CT 3, CT 4).
 * Normalizes each CT mark to 20, selects the highest 3, averages them, and rounds up via Math.ceil().
 */
export function calculateBest3CTStats(
  ctMarks: CTMark[],
  subjectId: string
): { avg: number; count: number } {
  const validMarks = (ctMarks || [])
    .filter(
      m =>
        m.subjectId === subjectId &&
        isClassTestExam(m.examName) &&
        Number(m.totalMark) > 0
    )
    .map(m => {
      const total = Number(m.totalMark);
      const obtained = Math.min(Math.max(0, Number(m.markObtained) || 0), total);
      return (obtained / total) * 20;
    });

  if (validMarks.length === 0) return { avg: 0, count: 0 };
  const sorted = [...validMarks].sort((a, b) => b - a);
  const best3 = sorted.slice(0, 3);
  const avg = best3.reduce((acc, val) => acc + val, 0) / Math.min(best3.length, 3);
  return { avg: Math.ceil(avg), count: validMarks.length };
}

/**
 * Returns a deterministic composite uniqueness key for (subjectId + normalized examName).
 */
export function getCTMarkUniqueKey(subjectId: string, examName: string): string {
  return `${String(subjectId || '').trim()}__${String(examName || '').trim().toLowerCase()}`;
}

/**
 * Builds a deterministic Firestore-safe document ID for (subjectId + examName)
 * matching `^[a-zA-Z0-9_\-]+$` and <= 128 chars.
 */
export function buildCTMarkId(subjectId: string, examName: string): string {
  const safeSubj = String(subjectId || '').trim().replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 80) || 'subj';
  const safeExam =
    String(examName || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_\-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 40) || 'exam';
  return `${safeSubj}_${safeExam}`.slice(0, 128);
}

/**
 * Sanitizes a CTMark payload to strictly adhere to firebase-blueprint.json
 * and firestore.rules constraints (`id`, `subjectId`, `subjectName`, `examName`, `markObtained`, `totalMark`).
 */
export function sanitizeCTMark(mark: CTMark): CTMark {
  const validIdPattern = /^[a-zA-Z0-9_\-]+$/;
  const rawSubjectId = String(mark.subjectId || '').trim();
  const safeSubjectId =
    rawSubjectId.length >= 1 && rawSubjectId.length <= 128 && validIdPattern.test(rawSubjectId)
      ? rawSubjectId
      : rawSubjectId.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 128) || 'subject';

  const safeSubjectName = String(mark.subjectName ?? '').trim().slice(0, 150);

  const rawExamName = String(mark.examName || '').trim();
  const safeExamName = (rawExamName.length > 0 ? rawExamName : 'CT 1').slice(0, 64);

  const parsedTotal = Number(mark.totalMark);
  const safeTotalMark = Number.isFinite(parsedTotal) && parsedTotal > 0 ? parsedTotal : 20;

  const parsedObtained = Number(mark.markObtained);
  const safeMarkObtained = Number.isFinite(parsedObtained)
    ? Math.min(Math.max(0, parsedObtained), safeTotalMark)
    : 0;

  const rawId = String(mark.id || '').trim();
  const safeId =
    rawId.length >= 1 && rawId.length <= 128 && validIdPattern.test(rawId)
      ? rawId
      : buildCTMarkId(safeSubjectId, safeExamName);

  return {
    id: safeId,
    subjectId: safeSubjectId,
    subjectName: safeSubjectName,
    examName: safeExamName,
    markObtained: safeMarkObtained,
    totalMark: safeTotalMark,
  };
}

/**
 * Deduplicates CTMark records by (subjectId + case-insensitive examName),
 * preserving the first record for each unique (subjectId, examName) pair.
 */
export function deduplicateCTMarkRecords(records: CTMark[]): CTMark[] {
  const seenKeys = new Set<string>();
  const seenIds = new Set<string>();
  const result: CTMark[] = [];

  for (const rec of records) {
    const sanitized = sanitizeCTMark(rec);
    const key = getCTMarkUniqueKey(sanitized.subjectId, sanitized.examName);
    if (!seenKeys.has(key) && !seenIds.has(sanitized.id)) {
      seenKeys.add(key);
      seenIds.add(sanitized.id);
      result.push(sanitized);
    }
  }

  return result;
}

/**
 * Reads all CT marks for the authenticated user by extracting them from the `subjectMarks` map inside `users/{uid}`.
 */
export async function getUserCTMarksFromFirestore(uid: string): Promise<CTMark[]> {
  assertCurrentUserAccess(uid);
  const userDocData = await fetchUserDocumentData(uid);
  return userDocData.ctMarks;
}

/**
 * Appends a new mark to the `subjectMarks.${subjectName}` array inside `users/{uid}` using Firestore's `arrayUnion`.
 */
export async function createCTMarkInFirestore(
  uid: string,
  ctMark: CTMark
): Promise<CTMark> {
  assertCurrentUserAccess(uid);
  const sanitized = sanitizeCTMark(ctMark);
  const paths = getUserFirestorePaths(uid);
  const userRef = doc(db, paths.userRoot);
  const subjectName = (sanitized.subjectName || sanitized.subjectId || 'General').trim();

  const newMarkObject: SubjectMark = {
    examName: sanitized.examName,
    markObtained: sanitized.markObtained,
    totalMark: sanitized.totalMark,
  };

  console.info(
    `[Firestore CT Mark Test]\nauthenticated UID: ${auth.currentUser?.uid ?? 'null'}\nFirestore project: ${firebaseConfig.projectId}\nFirestore database: ${firebaseConfig.firestoreDatabaseId}\nexact document path: ${paths.userRoot} (field: subjectMarks.${subjectName})\nwrite started: true`
  );

  try {
    // Dynamic dot notation with arrayUnion as requested:
    // updateDoc(userRef, { [`subjectMarks.${subjectName}`]: arrayUnion(newMarkObject) })
    await updateDoc(userRef, {
      [`subjectMarks.${subjectName}`]: arrayUnion(newMarkObject),
    });

    console.info(
      `[Firestore CT Mark Test]\nexact document path: ${paths.userRoot}\nwrite succeeded: true\nwrite error: none`
    );

    return sanitized;
  } catch (error) {
    // If subjectMarks map does not exist yet on document, initialize it safely
    try {
      await setDoc(
        userRef,
        {
          subjectMarks: {
            [subjectName]: arrayUnion(newMarkObject),
          },
        },
        { merge: true }
      );
      return sanitized;
    } catch (innerError) {
      console.info(
        `[Firestore CT Mark Test]\nexact document path: ${paths.userRoot}\nwrite succeeded: false\nwrite error: ${innerError instanceof Error ? innerError.message : String(innerError)}`
      );
      handleFirestoreError(innerError, OperationType.CREATE, paths.userRoot, uid);
    }
  }
}

/**
 * Updates an existing mark in the `subjectMarks.${subjectName}` array inside `users/{uid}`.
 */
export async function updateCTMarkInFirestore(
  uid: string,
  ctMark: CTMark,
  previousExamName?: string
): Promise<CTMark> {
  assertCurrentUserAccess(uid);
  const sanitized = sanitizeCTMark(ctMark);
  const paths = getUserFirestorePaths(uid);
  const userRef = doc(db, paths.userRoot);
  const subjectName = (sanitized.subjectName || sanitized.subjectId || 'General').trim();

  const newMarkObject: SubjectMark = {
    examName: sanitized.examName,
    markObtained: sanitized.markObtained,
    totalMark: sanitized.totalMark,
  };

  try {
    const snap = await getDoc(userRef);
    const existingSubjectMarks = (snap.data()?.subjectMarks ?? {}) as SubjectMarks;
    const marksForSubject = Array.isArray(existingSubjectMarks[subjectName])
      ? [...existingSubjectMarks[subjectName]]
      : [];

    const targetExam = (previousExamName || sanitized.examName).trim().toLowerCase();
    const existingIndex = marksForSubject.findIndex(
      m => m.examName.trim().toLowerCase() === targetExam
    );

    if (existingIndex !== -1) {
      marksForSubject[existingIndex] = newMarkObject;
    } else {
      marksForSubject.push(newMarkObject);
    }

    await updateDoc(userRef, {
      [`subjectMarks.${subjectName}`]: marksForSubject,
    });
    return sanitized;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, paths.userRoot, uid);
  }
}

/**
 * Deletes a mark from the `subjectMarks.${subjectName}` array inside `users/{uid}`.
 */
export async function deleteCTMarkFromFirestore(
  uid: string,
  ctMarkId: string,
  subjectName?: string,
  examName?: string
): Promise<void> {
  assertCurrentUserAccess(uid);
  const paths = getUserFirestorePaths(uid);
  const userRef = doc(db, paths.userRoot);

  try {
    const snap = await getDoc(userRef);
    if (!snap.exists()) return;
    const existingSubjectMarks = (snap.data()?.subjectMarks ?? {}) as SubjectMarks;

    if (subjectName && Array.isArray(existingSubjectMarks[subjectName])) {
      const nextList = existingSubjectMarks[subjectName].filter(
        m => m.examName.trim().toLowerCase() !== (examName || '').trim().toLowerCase()
      );
      await updateDoc(userRef, {
        [`subjectMarks.${subjectName}`]: nextList,
      });
      return;
    }

    // Fallback: search across all subjectMarks keys
    for (const [subj, marks] of Object.entries(existingSubjectMarks)) {
      if (!Array.isArray(marks)) continue;
      const matchingIdx = marks.findIndex(
        m =>
          `${subj}_${m.examName}` === ctMarkId ||
          (examName && m.examName.trim().toLowerCase() === examName.trim().toLowerCase())
      );
      if (matchingIdx !== -1) {
        const nextList = marks.filter((_, idx) => idx !== matchingIdx);
        await updateDoc(userRef, {
          [`subjectMarks.${subj}`]: nextList,
        });
        break;
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, paths.userRoot, uid);
  }
}

/**
 * Loads the authenticated user's CT marks from the `ctMarks` array inside `users/{uid}`.
 * If Firestore has no CT marks for this user and a one-time migration from
 * localStorage has not yet occurred, safely migrates deduplicated localCTMarks
 * to `users/{uid}.ctMarks` without deleting localStorage data.
 */
export async function loadOrMigrateUserCTMarks(
  uid: string,
  localCTMarks: CTMark[]
): Promise<CTMark[]> {
  assertCurrentUserAccess(uid);
  const existingFirestoreCTMarks = await getUserCTMarksFromFirestore(uid);

  if (existingFirestoreCTMarks.length > 0) {
    markCTMarksMigrationDone(uid, false);
    return existingFirestoreCTMarks;
  }

  const migrationState = getCTMarksMigrationState();
  const alreadyMigratedForUser = Boolean(migrationState.migratedByUser?.[uid]);
  const alreadyMigratedGlobally = Boolean(migrationState.migratedGlobal);

  if (
    alreadyMigratedForUser ||
    alreadyMigratedGlobally ||
    !Array.isArray(localCTMarks) ||
    localCTMarks.length === 0
  ) {
    markCTMarksMigrationDone(uid, false);
    return [];
  }

  const toMigrate = deduplicateCTMarkRecords(localCTMarks);

  if (toMigrate.length === 0) {
    markCTMarksMigrationDone(uid, false);
    return [];
  }

  const initialSubjectMarks: Record<string, SubjectMark[]> = {};
  for (const m of toMigrate) {
    const subj = (m.subjectName || m.subjectId || 'General').trim();
    if (!initialSubjectMarks[subj]) initialSubjectMarks[subj] = [];
    initialSubjectMarks[subj].push({
      examName: m.examName,
      markObtained: m.markObtained,
      totalMark: m.totalMark,
    });
  }

  const paths = getUserFirestorePaths(uid);
  const userDocRef = doc(db, paths.userRoot);

  try {
    await setDoc(userDocRef, { subjectMarks: initialSubjectMarks }, { merge: true });
    markCTMarksMigrationDone(uid, true);
    return toMigrate;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, paths.userRoot, uid);
  }
}

const EVENTS_MIGRATION_STORAGE_KEY = 'academic_tracker_pro_events_migration_v1';

interface EventsMigrationState {
  migratedGlobal?: boolean;
  migratedByUser?: Record<string, boolean>;
}

function getEventsMigrationState(): EventsMigrationState {
  try {
    const raw = localStorage.getItem(EVENTS_MIGRATION_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as EventsMigrationState;
  } catch {
    return {};
  }
}

function markEventsMigrationDone(uid: string, didMigrateLocalData: boolean): void {
  try {
    const current = getEventsMigrationState();
    const next: EventsMigrationState = {
      migratedGlobal: current.migratedGlobal || didMigrateLocalData,
      migratedByUser: {
        ...(current.migratedByUser || {}),
        [uid]: true,
      },
    };
    localStorage.setItem(EVENTS_MIGRATION_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage write errors
  }
}

export const VALID_ACADEMIC_EVENT_TYPES: readonly AcademicEvent['type'][] = [
  'Assignment',
  'Quiz',
  'Presentation',
  'Lab Final',
  'Exam',
  'Class Test',
  'Other',
] as const;

/**
 * Normalizes any valid date/time string into a canonical ISO-8601 string so
 * date/time comparisons (`isSameDay`, `isAfter`, `differenceInDays`, sorting)
 * remain consistent across sessions and reloads.
 */
export function normalizeEventDateISO(dateStr: string): string {
  const parsed = new Date(dateStr);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }
  return new Date().toISOString();
}

/**
 * Returns a deterministic logical uniqueness signature for an AcademicEvent
 * to prevent duplicate events during migration or repeated submissions.
 */
export function getAcademicEventUniqueKey(
  event: Pick<AcademicEvent, 'title' | 'eventDate' | 'type' | 'subjectId'>
): string {
  const titleKey = String(event.title || '').trim().toLowerCase();
  const typeKey = String(event.type || 'Other').trim();
  const dateKey = normalizeEventDateISO(event.eventDate);
  const subjKey = String(event.subjectId || '').trim();
  return `${titleKey}__${typeKey}__${dateKey}__${subjKey}`;
}

/**
 * Sanitizes an AcademicEvent payload to strictly adhere to firebase-blueprint.json
 * and firestore.rules constraints (`id`, `title`, `description`, `eventDate`, `type`, optional `subjectId`).
 */
export function sanitizeAcademicEvent(event: AcademicEvent): AcademicEvent {
  const validIdPattern = /^[a-zA-Z0-9_\-]+$/;
  const rawId = String(event.id || '').trim();
  const safeId =
    rawId.length >= 1 && rawId.length <= 128 && validIdPattern.test(rawId)
      ? rawId
      : crypto.randomUUID();

  const rawTitle = String(event.title || '').trim();
  const safeTitle = (rawTitle.length > 0 ? rawTitle : 'Academic Event').slice(0, 150);

  const safeDescription = String(event.description ?? '').slice(0, 1000);
  const safeEventDate = normalizeEventDateISO(event.eventDate).slice(0, 64);

  const safeType: AcademicEvent['type'] = (
    VALID_ACADEMIC_EVENT_TYPES as readonly string[]
  ).includes(event.type)
    ? event.type
    : 'Other';

  const rawSubjectId = typeof event.subjectId === 'string' ? event.subjectId.trim() : '';
  const safeSubjectId =
    rawSubjectId.length >= 1 && rawSubjectId.length <= 128 && validIdPattern.test(rawSubjectId)
      ? rawSubjectId
      : undefined;

  const sanitized: AcademicEvent = {
    id: safeId,
    title: safeTitle,
    description: safeDescription,
    eventDate: safeEventDate,
    type: safeType,
  };

  if (safeSubjectId) {
    sanitized.subjectId = safeSubjectId;
  }

  return sanitized;
}

/**
 * Deduplicates AcademicEvent records by document ID and logical signature.
 */
export function deduplicateAcademicEvents(
  events: AcademicEvent[],
  validSubjectIds?: Set<string>
): AcademicEvent[] {
  const seenIds = new Set<string>();
  const seenKeys = new Set<string>();
  const result: AcademicEvent[] = [];

  for (const ev of events) {
    const sanitized = sanitizeAcademicEvent(ev);
    if (
      validSubjectIds &&
      sanitized.subjectId &&
      validSubjectIds.size > 0 &&
      !validSubjectIds.has(sanitized.subjectId)
    ) {
      delete sanitized.subjectId;
    }
    const key = getAcademicEventUniqueKey(sanitized);
    if (!seenIds.has(sanitized.id) && !seenKeys.has(key)) {
      seenIds.add(sanitized.id);
      seenKeys.add(key);
      result.push(sanitized);
    }
  }

  return result;
}

/**
 * Reads all academic events for the authenticated user from `users/{uid}/events`.
 */
export async function getUserEventsFromFirestore(uid: string): Promise<AcademicEvent[]> {
  assertCurrentUserAccess(uid);
  const paths = getUserFirestorePaths(uid);
  const refs = getUserRefs(uid);

  try {
    const snapshot = await getDocs(refs.events);
    const rawEvents: AcademicEvent[] = [];

    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      rawEvents.push(
        sanitizeAcademicEvent({
          ...data,
          id: docSnap.id,
        })
      );
    });

    return deduplicateAcademicEvents(rawEvents);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, paths.events, uid);
  }
}

/**
 * Creates a new academic event document at `users/{uid}/events/{eventId}`.
 */
export async function createAcademicEventInFirestore(
  uid: string,
  event: AcademicEvent
): Promise<AcademicEvent> {
  assertCurrentUserAccess(uid);
  const sanitized = sanitizeAcademicEvent(event);
  const paths = getUserFirestorePaths(uid);
  const docRef = getUserItemDocRefs(uid).eventDoc(sanitized.id);

  try {
    await setDoc(docRef, sanitized);
    return sanitized;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `${paths.events}/${sanitized.id}`, uid);
  }
}

/**
 * Updates an existing academic event document at `users/{uid}/events/{eventId}`.
 */
export async function updateAcademicEventInFirestore(
  uid: string,
  event: AcademicEvent
): Promise<AcademicEvent> {
  assertCurrentUserAccess(uid);
  const sanitized = sanitizeAcademicEvent(event);
  const paths = getUserFirestorePaths(uid);
  const docRef = getUserItemDocRefs(uid).eventDoc(sanitized.id);

  try {
    await updateDoc(docRef, {
      title: sanitized.title,
      description: sanitized.description,
      eventDate: sanitized.eventDate,
      type: sanitized.type,
      subjectId: sanitized.subjectId ? sanitized.subjectId : deleteField(),
    });
    return sanitized;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${paths.events}/${sanitized.id}`, uid);
  }
}

/**
 * Deletes an academic event document at `users/{uid}/events/{eventId}`.
 */
export async function deleteAcademicEventFromFirestore(
  uid: string,
  eventId: string
): Promise<void> {
  assertCurrentUserAccess(uid);
  const paths = getUserFirestorePaths(uid);
  const docRef = getUserItemDocRefs(uid).eventDoc(eventId);

  try {
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${paths.events}/${eventId}`, uid);
  }
}

/**
 * Loads the authenticated user's events from `users/{uid}/events`.
 * If Firestore has no events for this user and a one-time migration from
 * localStorage has not yet occurred, safely migrates deduplicated localEvents
 * to `users/{uid}/events` without deleting localStorage data.
 */
export async function loadOrMigrateUserEvents(
  uid: string,
  localEvents: AcademicEvent[],
  validSubjectIds?: Set<string>
): Promise<AcademicEvent[]> {
  assertCurrentUserAccess(uid);
  const existingFirestoreEvents = await getUserEventsFromFirestore(uid);

  if (existingFirestoreEvents.length > 0) {
    markEventsMigrationDone(uid, false);
    return existingFirestoreEvents;
  }

  const migrationState = getEventsMigrationState();
  const alreadyMigratedForUser = Boolean(migrationState.migratedByUser?.[uid]);
  const alreadyMigratedGlobally = Boolean(migrationState.migratedGlobal);

  if (
    alreadyMigratedForUser ||
    alreadyMigratedGlobally ||
    !Array.isArray(localEvents) ||
    localEvents.length === 0
  ) {
    markEventsMigrationDone(uid, false);
    return [];
  }

  const toMigrate = deduplicateAcademicEvents(localEvents, validSubjectIds);

  if (toMigrate.length === 0) {
    markEventsMigrationDone(uid, false);
    return [];
  }

  const paths = getUserFirestorePaths(uid);
  const itemRefs = getUserItemDocRefs(uid);

  try {
    const batch = writeBatch(db);
    for (const record of toMigrate) {
      batch.set(itemRefs.eventDoc(record.id), record);
    }
    await batch.commit();
    markEventsMigrationDone(uid, true);
    return toMigrate;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, paths.events, uid);
  }
}

const SEMESTERS_MIGRATION_STORAGE_KEY = 'academic_tracker_pro_semesters_migration_v1';

interface SemestersMigrationState {
  migratedGlobal?: boolean;
  migratedByUser?: Record<string, boolean>;
}

function getSemestersMigrationState(): SemestersMigrationState {
  try {
    const raw = localStorage.getItem(SEMESTERS_MIGRATION_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as SemestersMigrationState;
  } catch {
    return {};
  }
}

function markSemestersMigrationDone(uid: string, didMigrateLocalData: boolean): void {
  try {
    const current = getSemestersMigrationState();
    const next: SemestersMigrationState = {
      migratedGlobal: current.migratedGlobal || didMigrateLocalData,
      migratedByUser: {
        ...(current.migratedByUser || {}),
        [uid]: true,
      },
    };
    localStorage.setItem(SEMESTERS_MIGRATION_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage write errors
  }
}

export const VALID_SEMESTER_IDS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

/**
 * Checks whether a value is a valid semester ID from 1 through 8.
 */
export function isValidSemesterId(id: unknown): boolean {
  const num = Number(id);
  return Number.isInteger(num) && num >= 1 && num <= 8;
}

/**
 * Sanitizes a SemesterGPA payload to strictly adhere to firebase-blueprint.json
 * and firestore.rules constraints (`id`: 1..8, `gpa`: 0..4.0, `credits`: 0..100).
 */
export function sanitizeSemesterGPA(semester: SemesterGPA): SemesterGPA {
  const parsedId = Math.trunc(Number(semester.id));
  const safeId =
    Number.isFinite(parsedId) && parsedId >= 1 && parsedId <= 8 ? parsedId : 1;

  const parsedGPA = Number(semester.gpa);
  const safeGPA = Number.isFinite(parsedGPA)
    ? Math.min(4.0, Math.max(0, parsedGPA))
    : 0;

  const parsedCredits = Number(semester.credits);
  const safeCredits = Number.isFinite(parsedCredits)
    ? Math.min(100, Math.max(0, parsedCredits))
    : 0;

  return {
    id: safeId,
    gpa: safeGPA,
    credits: safeCredits,
  };
}

/**
 * Filters and deduplicates SemesterGPA records so only valid semester IDs (1..8)
 * are kept and each semester ID appears at most once.
 */
export function deduplicateSemesterGPARecords(records: SemesterGPA[]): SemesterGPA[] {
  const seenIds = new Set<number>();
  const result: SemesterGPA[] = [];

  for (const rec of records || []) {
    if (!rec || !isValidSemesterId(rec.id)) continue;
    const sanitized = sanitizeSemesterGPA(rec);
    if (!seenIds.has(sanitized.id)) {
      seenIds.add(sanitized.id);
      result.push(sanitized);
    }
  }

  return result.sort((a, b) => a.id - b.id);
}

/**
 * Ensures the full 1st–8th semester structure is always present in ascending order (1..8),
 * merging any existing semester records by their semester ID.
 */
export function normalizeEightSemesters(records: SemesterGPA[]): SemesterGPA[] {
  const deduplicated = deduplicateSemesterGPARecords(records);
  const byId = new Map<number, SemesterGPA>();
  for (const item of deduplicated) {
    byId.set(item.id, item);
  }
  return VALID_SEMESTER_IDS.map(id => byId.get(id) ?? { id, gpa: 0, credits: 0 });
}

/**
 * Calculates CGPA and total credits across semesters using the existing weighted average formula:
 * Σ (Semester GPA × Semester Credits) / Σ (Total Credits), rounded to 2 decimal places.
 */
export function calculateCGPAStats(
  semesters: SemesterGPA[]
): { cgpa: number; totalCredits: number } {
  let totalWeightedGPA = 0;
  let totalCredits = 0;

  (semesters || []).forEach(s => {
    if (s.credits > 0) {
      totalWeightedGPA += s.gpa * s.credits;
      totalCredits += s.credits;
    }
  });

  if (totalCredits === 0) return { cgpa: 0, totalCredits: 0 };
  return {
    cgpa: parseFloat((totalWeightedGPA / totalCredits).toFixed(2)),
    totalCredits,
  };
}

/**
 * Reads all semester GPA documents for the authenticated user from `users/{uid}/semesters`.
 */
export async function getUserSemestersFromFirestore(uid: string): Promise<SemesterGPA[]> {
  assertCurrentUserAccess(uid);
  const paths = getUserFirestorePaths(uid);
  const refs = getUserRefs(uid);

  try {
    const snapshot = await getDocs(refs.semesters);
    const rawSemesters: SemesterGPA[] = [];

    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const docIdNum = Number(docSnap.id);
      const resolvedId = isValidSemesterId(docIdNum) ? docIdNum : data.id;
      if (isValidSemesterId(resolvedId)) {
        rawSemesters.push(
          sanitizeSemesterGPA({
            ...data,
            id: Number(resolvedId),
          })
        );
      }
    });

    return deduplicateSemesterGPARecords(rawSemesters);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, paths.semesters, uid);
  }
}

/**
 * Creates/saves a semester GPA document at `users/{uid}/semesters/{semesterId}`
 * where `{semesterId}` is `String(semester.id)` ("1".."8").
 */
export async function createSemesterGPAInFirestore(
  uid: string,
  semester: SemesterGPA
): Promise<SemesterGPA> {
  assertCurrentUserAccess(uid);
  if (!isValidSemesterId(semester.id)) {
    throw new Error(`Invalid semester ID: ${String(semester.id)}. Expected 1..8.`);
  }
  const sanitized = sanitizeSemesterGPA(semester);
  const paths = getUserFirestorePaths(uid);
  const docId = String(sanitized.id);
  const docRef = getUserItemDocRefs(uid).semesterDoc(docId);

  try {
    await setDoc(docRef, sanitized);
    return sanitized;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `${paths.semesters}/${docId}`, uid);
  }
}

/**
 * Updates an existing semester GPA document at `users/{uid}/semesters/{semesterId}`,
 * or creates it if it does not yet exist in Firestore.
 */
export async function updateSemesterGPAInFirestore(
  uid: string,
  semester: SemesterGPA
): Promise<SemesterGPA> {
  assertCurrentUserAccess(uid);
  if (!isValidSemesterId(semester.id)) {
    throw new Error(`Invalid semester ID: ${String(semester.id)}. Expected 1..8.`);
  }
  const sanitized = sanitizeSemesterGPA(semester);
  const paths = getUserFirestorePaths(uid);
  const docId = String(sanitized.id);
  const docRef = getUserItemDocRefs(uid).semesterDoc(docId);

  try {
    const existingSnap = await getDoc(docRef);
    if (existingSnap.exists()) {
      await updateDoc(docRef, {
        gpa: sanitized.gpa,
        credits: sanitized.credits,
      });
    } else {
      await setDoc(docRef, sanitized);
    }
    return sanitized;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${paths.semesters}/${docId}`, uid);
  }
}

/**
 * Deletes a semester GPA document at `users/{uid}/semesters/{semesterId}`.
 */
export async function deleteSemesterGPAFromFirestore(
  uid: string,
  semesterId: number | string
): Promise<void> {
  assertCurrentUserAccess(uid);
  if (!isValidSemesterId(semesterId)) {
    throw new Error(`Invalid semester ID: ${String(semesterId)}. Expected 1..8.`);
  }
  const paths = getUserFirestorePaths(uid);
  const docId = String(Math.trunc(Number(semesterId)));
  const docRef = getUserItemDocRefs(uid).semesterDoc(docId);

  try {
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${paths.semesters}/${docId}`, uid);
  }
}

/**
 * Loads the authenticated user's semesters from `users/{uid}/semesters`.
 * If Firestore has no semester documents for this user and a one-time migration from
 * localStorage has not yet occurred, safely migrates valid 1..8 deduplicated localSemesters
 * to `users/{uid}/semesters` without deleting localStorage data, and returns the full 1..8 array.
 */
export async function loadOrMigrateUserSemesters(
  uid: string,
  localSemesters: SemesterGPA[]
): Promise<SemesterGPA[]> {
  assertCurrentUserAccess(uid);
  const existingFirestoreSemesters = await getUserSemestersFromFirestore(uid);

  if (existingFirestoreSemesters.length > 0) {
    markSemestersMigrationDone(uid, false);
    return normalizeEightSemesters(existingFirestoreSemesters);
  }

  const migrationState = getSemestersMigrationState();
  const alreadyMigratedForUser = Boolean(migrationState.migratedByUser?.[uid]);
  const alreadyMigratedGlobally = Boolean(migrationState.migratedGlobal);

  const deduplicatedLocal = deduplicateSemesterGPARecords(localSemesters);
  const hasMeaningfulLocalData = deduplicatedLocal.some(
    s => s.gpa > 0 || s.credits > 0
  );

  if (alreadyMigratedForUser || alreadyMigratedGlobally || !hasMeaningfulLocalData) {
    markSemestersMigrationDone(uid, false);
    return normalizeEightSemesters([]);
  }

  const toMigrate = normalizeEightSemesters(deduplicatedLocal);
  const paths = getUserFirestorePaths(uid);
  const itemRefs = getUserItemDocRefs(uid);

  try {
    const batch = writeBatch(db);
    for (const sem of toMigrate) {
      batch.set(itemRefs.semesterDoc(String(sem.id)), sem);
    }
    await batch.commit();
    markSemestersMigrationDone(uid, true);
    return toMigrate;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, paths.semesters, uid);
  }
}

export type FirestoreUserDataStructure = AppData;

