import React from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Subjects } from './pages/Subjects';
import { Pomodoro } from './pages/Pomodoro';
import { Attendance } from './pages/Attendance';
import { Profile } from './pages/Profile';
import { GPACalculator } from './pages/GPACalculator';
import { Auth } from './pages/Auth';
import { Moon, Sun, Download, Trash2, AlertTriangle, LogOut, LogIn, UserCheck, Loader2 } from 'lucide-react';
import { exportData } from './lib/storage';
import { AnimatePresence, motion } from 'motion/react';

// Settings page
const Settings = () => {
  const { data, toggleTheme, resetData, currentUser, logout } = useApp();
  const navigate = useNavigate();
  const [showResetConfirm, setShowResetConfirm] = React.useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold">Settings</h1>
      <div className="space-y-4">
        <div className="m3-card flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h3 className="font-bold flex items-center gap-2">
              <UserCheck size={18} className="text-primary shrink-0" />
              <span>Account</span>
            </h3>
            {currentUser ? (
              <div className="space-y-0.5 mt-1">
                <p className="text-sm text-muted-foreground truncate">{currentUser.email}</p>
                <p className="text-[11px] font-mono text-muted-foreground truncate">
                  UID: {currentUser.uid}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Sign in with email & password to sync your profile
              </p>
            )}
          </div>
          {currentUser ? (
            <button
              onClick={handleLogout}
              className="px-4 py-3 rounded-2xl bg-red-50 dark:bg-red-500/10 text-red-500 font-bold hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors flex items-center gap-2 shrink-0 cursor-pointer"
            >
              <LogOut size={18} />
              <span className="text-sm">Logout</span>
            </button>
          ) : (
            <button
              onClick={() => navigate('/login')}
              className="px-4 py-3 rounded-2xl bg-primary text-white font-bold hover:shadow-lg transition-all flex items-center gap-2 shrink-0 cursor-pointer"
            >
              <LogIn size={18} />
              <span className="text-sm">Sign In</span>
            </button>
          )}
        </div>

        <div className="m3-card flex items-center justify-between">
          <div>
            <h3 className="font-bold">Appearance</h3>
            <p className="text-sm text-muted-foreground">Switch between light and dark mode</p>
          </div>
          <button onClick={toggleTheme} className="p-3 rounded-2xl bg-muted hover:bg-accent transition-colors">
            {data.theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          </button>
        </div>

        <div className="m3-card flex items-center justify-between">
          <div>
            <h3 className="font-bold">Export Data</h3>
            <p className="text-sm text-muted-foreground">Download a backup of your academic data</p>
          </div>
          <button onClick={exportData} className="p-3 rounded-2xl bg-muted hover:bg-accent transition-colors">
            <Download size={20} />
          </button>
        </div>

        <div className="m3-card flex items-center justify-between border-red-100 dark:border-red-900/30">
          <div>
            <h3 className="font-bold text-red-500">Reset All Data</h3>
            <p className="text-sm text-muted-foreground">Permanently delete all subjects and records</p>
          </div>
          <button 
            onClick={() => setShowResetConfirm(true)} 
            className="p-3 rounded-2xl bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
          >
            <Trash2 size={20} />
          </button>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      <AnimatePresence>
        {showResetConfirm && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-card w-full max-w-md rounded-3xl p-8 shadow-2xl border border-border"
            >
              <div className="flex items-center gap-4 text-red-500 mb-6">
                <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-500/10">
                  <AlertTriangle size={32} />
                </div>
                <h2 className="text-2xl font-bold">Are you sure?</h2>
              </div>
              
              <p className="text-muted-foreground mb-8 leading-relaxed">
                This will permanently delete all your subjects, attendance records, CT marks, and profile settings. This action <span className="font-bold text-foreground">cannot be undone</span>.
              </p>

              <div className="flex gap-4">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="flex-1 p-4 rounded-2xl bg-muted font-bold hover:bg-accent transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={resetData}
                  className="flex-1 p-4 rounded-2xl bg-red-500 text-white font-bold hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20"
                >
                  Reset Everything
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const AppRoutes = () => {
  const { authLoading, currentUser } = useApp();

  if (authLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="m3-card p-8 flex flex-col items-center gap-4">
          <Loader2 size={32} className="animate-spin text-primary" />
          <p className="text-sm font-bold text-muted-foreground">Loading your account...</p>
        </div>
      </div>
    );
  }

  // Strictly require authentication: unauthenticated users cannot access dashboard or pages
  if (!currentUser) {
    return (
      <Routes>
        <Route path="/signup" element={<Auth initialMode="signup" />} />
        <Route path="*" element={<Auth initialMode="login" />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/login" element={<Dashboard />} />
      <Route path="/signup" element={<Dashboard />} />
      <Route path="/subjects" element={<Subjects />} />
      <Route path="/attendance" element={<Attendance />} />
      <Route path="/pomodoro" element={<Pomodoro />} />
      <Route path="/gpa" element={<GPACalculator />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="*" element={<Dashboard />} />
    </Routes>
  );
};

export default function App() {
  return (
    <AppProvider>
      <Router>
        <Layout>
          <AppRoutes />
        </Layout>
      </Router>
    </AppProvider>
  );
}

