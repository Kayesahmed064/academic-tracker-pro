import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  GraduationCap,
  Mail,
  Lock,
  User as UserIcon,
  LogIn,
  UserPlus,
  AlertCircle,
  Loader2,
  CheckCircle2,
  LogOut,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { cn } from '../lib/utils';

interface AuthProps {
  onSuccess?: () => void;
  initialMode?: 'login' | 'signup';
}

export const Auth: React.FC<AuthProps> = ({ onSuccess, initialMode = 'login' }) => {
  const {
    currentUser,
    data,
    login,
    register,
    logout,
    authError,
    clearAuthError,
    profileSyncing,
  } = useApp();
  const navigate = useNavigate();

  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const switchMode = (nextMode: 'login' | 'signup') => {
    setMode(nextMode);
    setLocalError(null);
    clearAuthError();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearAuthError();

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setLocalError('Please enter your email address.');
      return;
    }

    if (!password) {
      setLocalError('Please enter your password.');
      return;
    }

    if (mode === 'signup') {
      if (!name.trim()) {
        setLocalError('Please enter your full name.');
        return;
      }
      if (password.length < 6) {
        setLocalError('Password must be at least 6 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setLocalError('Passwords do not match.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const success =
        mode === 'login'
          ? await login(trimmedEmail, password)
          : await register(trimmedEmail, password, name.trim());

      if (success) {
        setPassword('');
        setConfirmPassword('');
        if (onSuccess) {
          onSuccess();
        } else {
          navigate('/');
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayedError = localError || authError;
  const busy = isSubmitting || profileSyncing;

  if (currentUser) {
    return (
      <div className="max-w-md mx-auto py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="m3-card space-y-6 p-8"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <CheckCircle2 size={28} />
            </div>
            <div className="min-w-0">
              <h2 className="text-2xl font-bold truncate">{data.profile.name}</h2>
              <p className="text-sm text-muted-foreground truncate">{currentUser.email}</p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-muted space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold uppercase text-muted-foreground">Status</span>
              <span className="font-bold text-green-600 dark:text-green-400">Authenticated</span>
            </div>
            <div className="flex items-center justify-between text-xs gap-4">
              <span className="font-bold uppercase text-muted-foreground shrink-0">User UID</span>
              <span className="font-mono text-[11px] truncate text-foreground">{currentUser.uid}</span>
            </div>
            <div className="flex items-center justify-between text-xs gap-4">
              <span className="font-bold uppercase text-muted-foreground shrink-0">Firestore Profile</span>
              <span className="font-mono text-[11px] truncate text-primary">
                users/{currentUser.uid}/profile
              </span>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="flex-1 py-4 rounded-2xl bg-muted font-bold hover:bg-accent transition-colors"
            >
              Go to Dashboard
            </button>
            <button
              type="button"
              onClick={logout}
              className="flex-1 py-4 rounded-2xl bg-red-500 text-white font-bold hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
            >
              <LogOut size={18} />
              Logout
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto py-4 md:py-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="m3-card p-8 space-y-6"
      >
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-primary text-white flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/20">
            <GraduationCap size={32} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Academic Tracker Pro</h1>
          <p className="text-sm text-muted-foreground">
            {mode === 'login'
              ? 'Sign in with your email and password to sync your student profile'
              : 'Create an account to store your student profile in Firestore'}
          </p>
        </div>

        {/* Mode Toggle Tabs */}
        <div className="grid grid-cols-2 gap-2 p-1.5 bg-muted rounded-2xl">
          <button
            type="button"
            disabled={busy}
            onClick={() => switchMode('login')}
            className={cn(
              'py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2',
              mode === 'login'
                ? 'bg-card text-primary shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <LogIn size={16} />
            Sign In
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => switchMode('signup')}
            className={cn(
              'py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2',
              mode === 'signup'
                ? 'bg-card text-primary shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <UserPlus size={16} />
            Sign Up
          </button>
        </div>

        {/* Error Banner */}
        <AnimatePresence>
          {displayedError && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-start gap-3 text-sm"
              role="alert"
            >
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <div className="flex-1 font-medium leading-relaxed">{displayedError}</div>
              <button
                type="button"
                onClick={() => {
                  setLocalError(null);
                  clearAuthError();
                }}
                className="p-1 hover:bg-red-500/10 rounded-lg transition-colors"
                aria-label="Dismiss error"
              >
                <X size={16} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {mode === 'signup' && (
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase text-muted-foreground">
                Full Name
              </label>
              <div className="relative">
                <UserIcon
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  type="text"
                  required
                  disabled={busy}
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Alex Johnson"
                  className="w-full bg-muted border-none rounded-2xl pl-12 pr-4 py-4 focus:ring-2 focus:ring-primary outline-none font-bold text-sm"
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase text-muted-foreground">
              Email Address
            </label>
            <div className="relative">
              <Mail
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="email"
                required
                disabled={busy}
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="student@university.edu"
                className="w-full bg-muted border-none rounded-2xl pl-12 pr-4 py-4 focus:ring-2 focus:ring-primary outline-none font-bold text-sm"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase text-muted-foreground">
              Password
            </label>
            <div className="relative">
              <Lock
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="password"
                required
                disabled={busy}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={mode === 'signup' ? 'At least 6 characters' : 'Enter your password'}
                className="w-full bg-muted border-none rounded-2xl pl-12 pr-4 py-4 focus:ring-2 focus:ring-primary outline-none font-bold text-sm"
              />
            </div>
          </div>

          {mode === 'signup' && (
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase text-muted-foreground">
                Confirm Password
              </label>
              <div className="relative">
                <Lock
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  type="password"
                  required
                  disabled={busy}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  className="w-full bg-muted border-none rounded-2xl pl-12 pr-4 py-4 focus:ring-2 focus:ring-primary outline-none font-bold text-sm"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full py-4 bg-primary text-white rounded-2xl font-bold hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
          >
            {busy ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                <span>{mode === 'login' ? 'Signing In...' : 'Creating Account...'}</span>
              </>
            ) : mode === 'login' ? (
              <>
                <LogIn size={20} />
                <span>Sign In</span>
              </>
            ) : (
              <>
                <UserPlus size={20} />
                <span>Create Account</span>
              </>
            )}
          </button>
        </form>

        <div className="pt-2 border-t border-border text-center text-xs text-muted-foreground">
          {mode === 'login' ? (
            <p>
              Don&apos;t have an account?{' '}
              <button
                type="button"
                onClick={() => switchMode('signup')}
                className="font-bold text-primary hover:underline cursor-pointer"
              >
                Sign Up
              </button>
            </p>
          ) : (
            <p>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="font-bold text-primary hover:underline cursor-pointer"
              >
                Sign In
              </button>
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
};
