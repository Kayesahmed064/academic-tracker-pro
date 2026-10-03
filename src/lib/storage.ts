import { AppData } from '../types';

const STORAGE_KEY = 'academic_tracker_pro_data';

const DEFAULT_DATA: AppData = {
  subjects: [],
  attendance: [],
  ctMarks: [],
  events: [],
  semesters: Array.from({ length: 8 }, (_, i) => ({ id: i + 1, gpa: 0, credits: 0 })),
  profile: {
    name: 'Student',
    profilePic: null,
    targetGPA: 3.5,
    greeting: 'Welcome back',
    studentId: 'UG-2023-4567',
    department: 'Computer Science & Engineering',
    semester: '4th Semester',
    batch: '2023-2027',
    email: 'student@university.edu',
    phone: '+1 (555) 000-1234',
    address: 'University Dormitory, Block B, Room 302',
  },
  theme: 'light',
};

export const loadData = (): AppData => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return DEFAULT_DATA;
  try {
    const parsed = JSON.parse(stored);
    // Ensure all top-level properties exist by merging with DEFAULT_DATA
    return {
      ...DEFAULT_DATA,
      ...parsed,
      profile: { ...DEFAULT_DATA.profile, ...parsed.profile },
      // Ensure arrays are actually arrays
      subjects: Array.isArray(parsed.subjects) ? parsed.subjects : DEFAULT_DATA.subjects,
      attendance: Array.isArray(parsed.attendance) ? parsed.attendance : DEFAULT_DATA.attendance,
      ctMarks: Array.isArray(parsed.ctMarks) ? parsed.ctMarks : DEFAULT_DATA.ctMarks,
      events: Array.isArray(parsed.events) ? parsed.events : DEFAULT_DATA.events,
      semesters: Array.isArray(parsed.semesters) ? parsed.semesters : DEFAULT_DATA.semesters,
    };
  } catch (e) {
    return DEFAULT_DATA;
  }
};

export const saveData = (data: AppData) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

export const exportData = () => {
  const data = loadData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `academic_tracker_backup_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
};
