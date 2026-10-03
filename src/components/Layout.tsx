import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, BookOpen, Calendar, GraduationCap, Settings, CalendarPlus, LogOut, LogIn } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';
import { CTSchedulerModal } from './CTSchedulerModal';
import { useApp } from '../context/AppContext';

interface NavItemProps {
  to: string;
  icon: any;
  label: string;
  active: boolean;
}

const NavItem: React.FC<NavItemProps> = ({ to, icon: Icon, label, active }) => (
  <Link to={to} className="relative group">
    <div className={cn(
      "flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-300",
      active ? "text-primary" : "text-muted-foreground hover:text-foreground"
    )}>
      <Icon size={24} className={cn("transition-transform", active && "scale-110")} />
      <span className="text-[10px] mt-1 font-medium">{label}</span>
      {active && (
        <motion.div
          layoutId="nav-pill"
          className="absolute inset-0 bg-primary/10 rounded-2xl -z-10"
          transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
        />
      )}
    </div>
  </Link>
);

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, logout } = useApp();
  const [isCTModalOpen, setIsCTModalOpen] = React.useState(false);

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Home' },
    { to: '/subjects', icon: BookOpen, label: 'Subjects' },
    { to: '/attendance', icon: Calendar, label: 'Attendance' },
    { onClick: () => setIsCTModalOpen(true), icon: CalendarPlus, label: 'Add Events' },
    { to: '/gpa', icon: GraduationCap, label: 'GPA' },
    { to: '/settings', icon: Settings, label: 'Settings' },
  ];

  const handleAuthAction = async () => {
    if (currentUser) {
      await logout();
      navigate('/login');
    } else {
      navigate('/login');
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-center">
        <main className="w-full max-w-7xl mx-auto p-4 md:p-8">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {children}
          </motion.div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-[calc(env(safe-area-inset-bottom,0px)+6rem)] md:pb-0 md:pl-20 bg-background pt-[env(safe-area-inset-top,0px)]">
      <CTSchedulerModal isOpen={isCTModalOpen} onClose={() => setIsCTModalOpen(false)} />
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-20 flex-col items-center py-8 bg-card border-r border-border z-50">
        <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-white mb-12">
          <GraduationCap size={28} />
        </div>
        <nav className="flex flex-col gap-4 flex-1">
          {navItems.map((item, idx) => (
            'to' in item ? (
              <NavItem key={item.to} to={item.to} icon={item.icon} label={item.label} active={location.pathname === item.to} />
            ) : (
              <button key={idx} onClick={item.onClick} className="relative group cursor-pointer">
                <div className="flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-300 text-muted-foreground hover:text-foreground">
                  <item.icon size={24} className="transition-transform" />
                  <span className="text-[10px] mt-1 font-medium">{item.label}</span>
                </div>
              </button>
            )
          ))}
        </nav>
        <button
          onClick={handleAuthAction}
          title={currentUser ? `Logout (${currentUser.email})` : 'Sign In'}
          className="relative group cursor-pointer mt-auto"
        >
          <div className={cn(
            "flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-300",
            currentUser ? "text-muted-foreground hover:text-red-500" : "text-primary hover:text-primary/80"
          )}>
            {currentUser ? <LogOut size={22} /> : <LogIn size={22} />}
            <span className="text-[10px] mt-1 font-medium">{currentUser ? 'Logout' : 'Sign In'}</span>
          </div>
        </button>
      </aside>


      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-6 left-6 right-6 h-20 glass-card rounded-3xl flex items-center justify-around px-2 z-50">
        {navItems.map((item, idx) => (
          'to' in item ? (
            <NavItem key={item.to} to={item.to} icon={item.icon} label={item.label} active={location.pathname === item.to} />
          ) : (
            <button key={idx} onClick={item.onClick} className="relative group cursor-pointer">
              <div className="flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-300 text-muted-foreground hover:text-foreground">
                <item.icon size={24} className="transition-transform" />
                <span className="text-[10px] mt-1 font-medium">{item.label}</span>
              </div>
            </button>
          )
        ))}
      </nav>

      <main className="max-w-7xl mx-auto p-6 md:p-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
};
