export type Subject = {
  id: string;
  name: string;
  creditHours: number;
  colorTag: string;
};

export type Attendance = {
  id: string;
  subjectId: string;
  date: string; // ISO string
  isPresent: boolean;
};

export type SubjectMark = {
  examName: string;
  markObtained: number;
  totalMark: number;
};

export type SubjectMarks = Record<string, SubjectMark[]>;

export type CTMark = {
  id: string;
  subjectId: string;
  subjectName?: string;
  examName: string;
  markObtained: number;
  totalMark: number;
};

export type AcademicEvent = {
  id: string;
  title: string;
  description: string;
  eventDate: string;
  type: 'Assignment' | 'Quiz' | 'Presentation' | 'Lab Final' | 'Exam' | 'Class Test' | 'Other';
  subjectId?: string;
};

export type UserProfile = {
  name: string;
  profilePic: string | null;
  targetGPA: number;
  greeting: string;
  studentId: string;
  department: string;
  semester: string;
  batch: string;
  email: string;
  phone: string;
  address: string;
};

export type SemesterGPA = {
  id: number;
  gpa: number;
  credits: number;
};

export type AppData = {
  subjects: Subject[];
  subjectMarks?: SubjectMarks;
  attendance: Attendance[];
  ctMarks: CTMark[];
  events: AcademicEvent[];
  semesters: SemesterGPA[];
  profile: UserProfile;
  theme: 'light' | 'dark';
};
