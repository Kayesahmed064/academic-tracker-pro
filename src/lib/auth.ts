import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile as updateFirebaseAuthProfile,
  User,
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserProfile } from '../types';
import {
  getOrCreateUserProfile,
  isPermissionDeniedError,
  saveUserProfileToFirestore,
  sanitizeUserProfile,
} from './firestore';

export function formatAuthError(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';
  let message = error instanceof Error ? error.message : String(error);

  // If message is a FirestoreErrorInfo JSON string from handleFirestoreError, extract the inner error message
  if (message.startsWith('{') && message.includes('"operationType"')) {
    try {
      const parsed = JSON.parse(message) as { error?: string };
      if (parsed.error) {
        message = parsed.error;
      }
    } catch {
      // Keep original message if JSON parsing fails
    }
  }

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email or password. Please check your credentials and try again.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Please sign in instead.';
    case 'auth/weak-password':
      return 'Password is too weak. Please enter at least 6 characters.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/missing-password':
      return 'Please enter your password.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please wait a moment and try again.';
    case 'auth/network-request-failed':
    case 'unavailable':
      return 'Network error. Please check your internet connection and try again.';
    case 'auth/operation-not-allowed':
      return 'Email/Password sign-in is not enabled in the Firebase Console yet. Enable the Email/Password provider in Firebase Console > Authentication > Sign-in method.';
    case 'permission-denied':
      return 'Missing or insufficient Firestore permissions. Please publish the security rules from firestore.rules in Firebase Console > Firestore Database > Rules for academic-tracker-pro-5418a.';
    default:
      if (message.includes('auth/invalid-credential')) {
        return 'Invalid email or password. Please check your credentials and try again.';
      }
      if (message.includes('auth/email-already-in-use')) {
        return 'An account with this email already exists. Please sign in instead.';
      }
      if (message.includes('auth/weak-password')) {
        return 'Password is too weak. Please enter at least 6 characters.';
      }
      if (message.includes('auth/invalid-email')) {
        return 'Please enter a valid email address.';
      }
      if (message.includes('auth/operation-not-allowed')) {
        return 'Email/Password sign-in is not enabled in the Firebase Console yet. Enable the Email/Password provider in Firebase Console > Authentication > Sign-in method.';
      }
      if (
        message.includes('Missing or insufficient permissions') ||
        message.includes('permission-denied')
      ) {
        return 'Missing or insufficient Firestore permissions. Please publish the security rules from firestore.rules in Firebase Console > Firestore Database > Rules for academic-tracker-pro-5418a.';
      }
      if (
        message.toLowerCase().includes('offline') ||
        message.toLowerCase().includes('network') ||
        message.toLowerCase().includes('unavailable')
      ) {
        return 'Unable to reach Firebase. Please check your internet connection and try again.';
      }
      return message || 'Operation failed. Please try again.';
  }
}

export async function registerWithEmailPassword(
  email: string,
  password: string,
  name: string,
  _baseProfile: UserProfile,
  theme?: 'light' | 'dark'
): Promise<{ user: User; profile: UserProfile; firestorePermissionDenied?: boolean }> {
  const trimmedEmail = email.trim();
  const trimmedName = name.trim() || 'Student';

  const credential = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
  const user = credential.user;

  try {
    await updateFirebaseAuthProfile(user, { displayName: trimmedName });
  } catch {
    // Non-fatal if displayName update fails
  }

  const newProfile: UserProfile = sanitizeUserProfile({
    name: trimmedName,
    profilePic: null,
    targetGPA: 0,
    greeting: '',
    studentId: '',
    department: '',
    semester: '',
    batch: '',
    email: user.email || trimmedEmail,
    phone: '',
    address: '',
  });

  try {
    const savedProfile = await saveUserProfileToFirestore(user.uid, newProfile, theme);
    try {
      await setDoc(doc(db, 'users', user.uid), { ctMarks: [] }, { merge: true });
    } catch {
      // non-fatal if ctMarks init fails
    }
    return { user, profile: savedProfile, firestorePermissionDenied: false };
  } catch (err) {
    if (isPermissionDeniedError(err)) {
      return { user, profile: newProfile, firestorePermissionDenied: true };
    }
    throw err;
  }
}

export async function loginWithEmailPassword(
  email: string,
  password: string,
  fallbackProfile: UserProfile,
  theme?: 'light' | 'dark'
): Promise<{ user: User; profile: UserProfile; firestorePermissionDenied?: boolean }> {
  const trimmedEmail = email.trim();
  const credential = await signInWithEmailAndPassword(auth, trimmedEmail, password);
  const user = credential.user;

  const fallbackSanitized = sanitizeUserProfile({
    name: user.displayName?.trim() || 'Student',
    profilePic: null,
    targetGPA: 0,
    greeting: '',
    studentId: '',
    department: '',
    semester: '',
    batch: '',
    email: user.email || trimmedEmail || '',
    phone: '',
    address: '',
  });

  try {
    const profile = await getOrCreateUserProfile(
      user.uid,
      fallbackProfile,
      user.email || trimmedEmail,
      user.displayName,
      theme
    );
    return { user, profile, firestorePermissionDenied: false };
  } catch (err) {
    if (isPermissionDeniedError(err)) {
      return { user, profile: fallbackSanitized, firestorePermissionDenied: true };
    }
    throw err;
  }
}

export async function logoutFirebaseUser(): Promise<void> {
  await signOut(auth);
}
