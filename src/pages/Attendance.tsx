import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Check, X, Calendar as CalendarIcon, ChevronLeft, ChevronRight, AlertCircle, Loader2 } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export const Attendance = () => {
  const {
    data,
    markAttendance,
    attendanceLoading,
    attendanceSyncing,
    attendanceError,
    clearAttendanceError,
  } = useApp();
  const [selectedSubjectId, setSelectedSubjectId] = useState(data.subjects[0]?.id || '');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDateForModal, setSelectedDateForModal] = useState<Date | null>(null);

  React.useEffect(() => {
    if (data.subjects.length > 0) {
      const exists = data.subjects.some(s => s.id === selectedSubjectId);
      if (!selectedSubjectId || !exists) {
        setSelectedSubjectId(data.subjects[0].id);
      }
    } else if (selectedSubjectId) {
      setSelectedSubjectId('');
    }
  }, [data.subjects, selectedSubjectId]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getAttendanceForDay = (date: Date) => {
    return (data.attendance || []).find(a => 
      a.subjectId === selectedSubjectId && 
      isSameDay(new Date(a.date), date)
    );
  };

  const handleMark = (date: Date, isPresent: boolean) => {
    if (!selectedSubjectId) return;
    markAttendance({
      subjectId: selectedSubjectId,
      date: date.toISOString(),
      isPresent
    });
    setSelectedDateForModal(null);
  };

  const selectedSubject = (data.subjects || []).find(s => s.id === selectedSubjectId);
  const selectedDayRecord = selectedDateForModal ? getAttendanceForDay(selectedDateForModal) : undefined;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">Attendance Tracker</h1>
            {(attendanceLoading || attendanceSyncing) && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-xl">
                <Loader2 size={14} className="animate-spin" />
                {attendanceLoading ? 'Loading...' : 'Syncing...'}
              </span>
            )}
          </div>
          <p className="text-muted-foreground">Log your daily presence for each subject</p>
        </div>
        
        <select 
          value={selectedSubjectId}
          onChange={(e) => setSelectedSubjectId(e.target.value)}
          className="bg-card border border-border rounded-2xl px-6 py-3 font-bold focus:ring-2 focus:ring-primary outline-none min-w-[200px]"
        >
          <option value="" disabled>Select Subject</option>
          {(data.subjects || []).map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {attendanceError && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-between gap-3 text-sm font-bold">
          <div className="flex items-center gap-3">
            <AlertCircle size={18} className="shrink-0" />
            <span>{attendanceError}</span>
          </div>
          <button
            type="button"
            onClick={clearAttendanceError}
            className="p-1 hover:bg-red-500/10 rounded-lg transition-colors"
            aria-label="Dismiss error"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 m3-card">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-bold">{format(currentMonth, 'MMMM yyyy')}</h2>
            <div className="flex gap-2">
              <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 hover:bg-muted rounded-xl transition-colors">
                <ChevronLeft size={20} />
              </button>
              <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 hover:bg-muted rounded-xl transition-colors">
                <ChevronRight size={20} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2 mb-4">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-xs font-bold text-muted-foreground uppercase">{day}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: monthStart.getDay() }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            
            {days.map(day => {
              const record = getAttendanceForDay(day);
              const isToday = isSameDay(day, new Date());
              
              return (
                <button
                  type="button"
                  key={day.toString()}
                  onClick={() => {
                    if (selectedSubjectId) {
                      setSelectedDateForModal(day);
                    }
                  }}
                  disabled={!selectedSubjectId}
                  className={cn(
                    "aspect-square rounded-2xl flex flex-col items-center justify-center relative transition-all cursor-pointer border",
                    isToday ? "ring-2 ring-primary ring-offset-2" : "",
                    !selectedSubjectId && "opacity-50 cursor-not-allowed",
                    record
                      ? record.isPresent
                        ? "bg-green-500/15 dark:bg-green-500/20 border-green-500/40 text-green-700 dark:text-green-400 hover:bg-green-500/25"
                        : "bg-red-500/15 dark:bg-red-500/20 border-red-500/40 text-red-700 dark:text-red-400 hover:bg-red-500/25"
                      : "bg-card border-transparent hover:bg-muted hover:border-border"
                  )}
                >
                  <span className="text-sm font-bold">{format(day, 'd')}</span>
                  <div className="mt-1 h-4 flex items-center justify-center">
                    {record && (
                      record.isPresent ? 
                        <Check size={14} className="text-green-600 dark:text-green-400 stroke-[3]" /> : 
                        <X size={14} className="text-red-600 dark:text-red-400 stroke-[3]" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-6">
          <div className="m3-card bg-primary text-white">
            <h3 className="text-sm font-bold opacity-80 uppercase tracking-wider">Current Percentage</h3>
            <p className="text-5xl font-black mt-2">
              {(() => {
                const logs = data.attendance.filter(a => a.subjectId === selectedSubjectId);
                if (logs.length === 0) return '0%';
                const present = logs.filter(l => l.isPresent).length;
                return `${Math.round((present / logs.length) * 100)}%`;
              })()}
            </p>
          </div>
        </div>
      </div>

      {/* Attendance Status Selection Modal */}
      <AnimatePresence>
        {selectedDateForModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDateForModal(null)}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-card w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-border z-10"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <CalendarIcon size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">{format(selectedDateForModal, 'MMMM d, yyyy')}</h3>
                    <p className="text-xs text-muted-foreground font-medium">
                      {selectedSubject?.name || 'Select Attendance Status'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDateForModal(null)}
                  className="p-2 rounded-xl hover:bg-muted transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {selectedDayRecord && (
                <div className="mb-4 px-3 py-2 rounded-xl bg-muted text-xs font-bold flex items-center justify-between">
                  <span className="text-muted-foreground uppercase tracking-wider">Current Status</span>
                  <span className={cn(
                    "px-2.5 py-0.5 rounded-full font-black uppercase",
                    selectedDayRecord.isPresent
                      ? "bg-green-500/15 text-green-600 dark:text-green-400"
                      : "bg-red-500/15 text-red-600 dark:text-red-400"
                  )}>
                    {selectedDayRecord.isPresent ? 'Present' : 'Absent'}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleMark(selectedDateForModal, true)}
                  className={cn(
                    "flex items-center justify-center gap-2 py-4 px-4 rounded-2xl font-bold text-white bg-green-600 hover:bg-green-700 active:scale-[0.98] transition-all shadow-lg shadow-green-600/20 cursor-pointer",
                    selectedDayRecord?.isPresent === true && "ring-2 ring-offset-2 ring-green-500"
                  )}
                >
                  <Check size={20} className="stroke-[3]" />
                  <span>Present</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleMark(selectedDateForModal, false)}
                  className={cn(
                    "flex items-center justify-center gap-2 py-4 px-4 rounded-2xl font-bold text-white bg-red-600 hover:bg-red-700 active:scale-[0.98] transition-all shadow-lg shadow-red-600/20 cursor-pointer",
                    selectedDayRecord?.isPresent === false && "ring-2 ring-offset-2 ring-red-500"
                  )}
                >
                  <X size={20} className="stroke-[3]" />
                  <span>Absent</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
