import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { Bell, Calendar as CalendarIcon, TrendingUp, CheckCircle2, AlertCircle, Clock, Plus, X, Info, Trash2, Edit3, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { 
  format, 
  isSameDay, 
  differenceInDays, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isToday, 
  addMonths, 
  subMonths,
  addDays,
  startOfToday
} from 'date-fns';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { cn } from '../lib/utils';
import { DateTimePickerModal } from '../components/DateTimePickerModal';
import { calculateBest3CTStats, isClassTestExam } from '../lib/firestore';
import { AcademicEvent } from '../types';

export const Dashboard = () => {
  const {
    data,
    addEvent,
    updateEvent,
    deleteEvent,
    deleteCTMark,
    eventsLoading,
    eventsSyncing,
    eventsError,
    clearEventsError,
  } = useApp();
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [eventToDelete, setEventToDelete] = useState<string | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    eventDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    type: 'Assignment' as any,
    subjectId: '',
    ctNumber: ''
  });

  const [now, setNow] = useState(new Date());

  // Update 'now' every minute to ensure dynamic notification updates
  React.useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const today = now;

  // Notification Filtering Logic
  const allowedNotificationTypes = ['EXAM', 'ASSIGNMENT', 'QUIZ', 'CT', 'UPCOMING_EVENT'];
  
  const isNotificationDue = (eventDate: string) => {
    const eventTime = new Date(eventDate).getTime();
    const currentTime = now.getTime();
    const diff = eventTime - currentTime;
    const oneDayInMs = 24 * 60 * 60 * 1000;
    return diff > 0 && diff <= oneDayInMs;
  };

  const getNotifications = () => {
    const allEvents = (data.events || []).map(event => {
      let type = event.type.toUpperCase();
      if (type === 'CLASS TEST') type = 'CT';
      if (type === 'LAB FINAL') type = 'EXAM';
      if (type === 'PRESENTATION') type = 'UPCOMING_EVENT';
      if (type === 'OTHER') type = 'UPCOMING_EVENT';
      
      // Map to allowed types for notification filtering
      const mappedType = ['EXAM', 'ASSIGNMENT', 'QUIZ', 'CT'].includes(type) ? type : 'UPCOMING_EVENT';

      return { ...event, mappedType };
    });

    return allEvents.filter(event => 
      allowedNotificationTypes.includes(event.mappedType) && 
      isNotificationDue(event.eventDate)
    ).sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());
  };

  const activeNotifications = getNotifications();

  const calculateCGPA = () => {
    let totalWeightedGPA = 0;
    let totalCredits = 0;

    (data.semesters || []).forEach(s => {
      if (s.credits > 0) {
        totalWeightedGPA += s.gpa * s.credits;
        totalCredits += s.credits;
      }
    });

    if (totalCredits === 0) return 0;
    return parseFloat((totalWeightedGPA / totalCredits).toFixed(2));
  };

  const cgpa = calculateCGPA();

  const todaysExams = (data.events || []).filter(e => 
    isSameDay(new Date(e.eventDate), today) && 
    (e.type === 'Exam' || e.type === 'Quiz' || e.type === 'Lab Final' || e.type === 'Class Test')
  );

  const calculateAttendance = (subjectId: string) => {
    const logs = (data.attendance || []).filter(a => a.subjectId === subjectId);
    const total = logs.length;
    const present = logs.filter(l => l.isPresent).length;
    const missed = total - present;
    return { 
      percentage: total === 0 ? 0 : Math.round((present / total) * 100),
      present,
      missed,
      total
    };
  };

  const calculateBest3Average = (subjectId: string) => {
    return calculateBest3CTStats(data.ctMarks || [], subjectId).avg;
  };

  const openEditEventModal = (event: AcademicEvent) => {
    const matchedCT =
      event.type === 'Class Test'
        ? ['CT 1', 'CT 2', 'CT 3', 'CT 4'].find(ct =>
            event.title.toUpperCase().includes(ct)
          ) || 'CT 1'
        : '';
    setEditingEventId(event.id);
    setNewEvent({
      title: event.title,
      description: event.description || '',
      eventDate: event.eventDate,
      type: event.type,
      subjectId: event.subjectId || '',
      ctNumber: matchedCT,
    });
    setIsAddingEvent(true);
  };

  const resetEventModal = () => {
    setIsAddingEvent(false);
    setEditingEventId(null);
    setNewEvent({
      title: '',
      description: '',
      eventDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      type: 'Assignment',
      subjectId: '',
      ctNumber: '',
    });
  };

  const handleAddEvent = (e: React.FormEvent) => {
    e.preventDefault();
    
    let finalTitle = newEvent.title.trim();
    if (newEvent.type === 'Class Test' && newEvent.ctNumber && newEvent.subjectId) {
      const subject = (data.subjects || []).find(s => s.id === newEvent.subjectId);
      finalTitle = `${subject?.name || 'Course'} ${newEvent.ctNumber}`;
    }

    const parsedDate = new Date(newEvent.eventDate);
    const isoEventDate = !Number.isNaN(parsedDate.getTime())
      ? parsedDate.toISOString()
      : new Date().toISOString();

    const requiresSubj =
      newEvent.type === 'Class Test' ||
      newEvent.type === 'Quiz' ||
      newEvent.type === 'Assignment' ||
      newEvent.type === 'Exam' ||
      newEvent.type === 'Lab Final';

    const resolvedSubjectId =
      requiresSubj && newEvent.subjectId ? newEvent.subjectId : undefined;

    if (editingEventId) {
      updateEvent({
        id: editingEventId,
        title: finalTitle || newEvent.type,
        description: newEvent.description,
        eventDate: isoEventDate,
        type: newEvent.type,
        subjectId: resolvedSubjectId,
      });
    } else {
      addEvent({
        title: finalTitle || newEvent.type,
        description: newEvent.description,
        eventDate: isoEventDate,
        type: newEvent.type,
        subjectId: resolvedSubjectId,
      });
    }
    
    resetEventModal();
  };

  const handleDeleteEvent = async (id: string) => {
    deleteEvent(id);
    setEventToDelete(null);
  };

  const selectedSubject = (data.subjects || []).find(s => s.id === selectedSubjectId);
  const selectedSubjectAttendance = selectedSubject ? calculateAttendance(selectedSubject.id) : null;
  const selectedSubjectMarks = selectedSubject 
    ? (data.ctMarks || [])
        .filter(m => m.subjectId === selectedSubject.id)
        .map(m => ({
          ...m,
          markObtained: Math.min(m.markObtained, m.totalMark) // Sanitize existing data
        }))
        .sort((a, b) => {
          const numA = parseInt(a.examName.replace(/\D/g, '')) || 0;
          const numB = parseInt(b.examName.replace(/\D/g, '')) || 0;
          return numA - numB;
        })
    : [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="flex items-center justify-between pt-4 md:pt-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{data.profile.greeting}, {data.profile.name}</h1>
          <p className="text-muted-foreground">{format(today, 'EEEE, MMMM do')}</p>
        </div>
        <div className="flex gap-4 relative">
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className={cn(
              "p-3 rounded-2xl bg-card border border-border transition-all relative",
              showNotifications ? "ring-2 ring-primary bg-accent" : "hover:bg-accent"
            )}
          >
            <Bell size={20} />
            {activeNotifications.length > 0 && (
              <span className="absolute top-2 right-2 w-4 h-4 bg-red-500 text-[10px] font-bold text-white rounded-full flex items-center justify-center">
                {activeNotifications.length}
              </span>
            )}
          </button>

          <AnimatePresence>
            {showNotifications && (
              <>
                <div className="fixed inset-0 z-[60]" onClick={() => setShowNotifications(false)} />
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute top-16 right-0 w-80 bg-card border border-border rounded-3xl shadow-2xl z-[70] overflow-hidden"
                >
                  <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between">
                    <h3 className="font-bold text-sm">Notifications</h3>
                    <span className="text-[10px] font-bold text-primary uppercase tracking-widest">{activeNotifications.length} New</span>
                  </div>
                  <div className="max-h-96 overflow-y-auto p-2 space-y-1">
                    {activeNotifications.length > 0 ? (
                      activeNotifications.map(notif => {
                        const eventTime = new Date(notif.eventDate).getTime();
                        const diff = eventTime - now.getTime();
                        const hoursLeft = Math.floor(diff / (1000 * 60 * 60));
                        const minutesLeft = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                        
                        let timeLabel = '';
                        if (hoursLeft > 0) {
                          timeLabel = `In ${hoursLeft}h ${minutesLeft}m`;
                        } else if (minutesLeft > 0) {
                          timeLabel = `In ${minutesLeft}m`;
                        } else {
                          timeLabel = 'Starting now';
                        }

                        return (
                          <div key={notif.id} className="p-3 rounded-2xl hover:bg-muted transition-colors flex gap-3 items-start group">
                            <div className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                              notif.mappedType === 'EXAM' ? "bg-red-500/10 text-red-500" :
                              notif.mappedType === 'ASSIGNMENT' ? "bg-blue-500/10 text-blue-500" :
                              notif.mappedType === 'CT' || notif.mappedType === 'QUIZ' ? "bg-amber-500/10 text-amber-500" :
                              "bg-primary/10 text-primary"
                            )}>
                              <Info size={14} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold truncate">{notif.title}</p>
                              <p className="text-[10px] text-muted-foreground font-medium">
                                {notif.mappedType} • {timeLabel}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="py-8 text-center">
                        <p className="text-sm text-muted-foreground italic">All caught up!</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
          <Link 
            to="/profile" 
            className="w-12 h-12 rounded-2xl bg-slate-200 dark:bg-slate-800 overflow-hidden hover:opacity-80 active:scale-95 transition-all shadow-sm hover:shadow-md"
            title="View Profile"
          >
            {data.profile.profilePic ? (
              <img src={data.profile.profilePic} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xl font-bold text-primary">
                {data.profile.name[0]}
              </div>
            )}
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Today's Exams/CTs */}
        <section className="lg:col-span-2 space-y-6">
          <div 
            className="flex items-center justify-between cursor-pointer group"
            onClick={() => setIsCalendarOpen(true)}
          >
            <h2 className="text-xl font-semibold flex items-center gap-2 group-hover:text-primary transition-colors">
              <CalendarIcon size={20} className="text-primary" />
              Today's Exams/CTs
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{todaysExams.length} scheduled</span>
              <div className="p-1 rounded-lg bg-primary/10 text-primary opacity-0 group-hover:opacity-100 transition-all">
                <Plus size={14} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {todaysExams.length > 0 ? (
              todaysExams.map((exam, idx) => (
                <motion.div
                  key={exam.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="m3-card flex items-center gap-4 bg-primary/5 border-primary/20"
                >
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-primary text-white">
                    <AlertCircle size={20} />
                  </div>
                  <div>
                    <h3 className="font-semibold">{exam.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {(exam.subjectId && (data.subjects || []).find(s => s.id === exam.subjectId)?.name) || exam.type} • {format(new Date(exam.eventDate), 'hh:mm a')}
                    </p>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="col-span-full p-8 text-center bg-muted rounded-3xl border-2 border-dashed border-border">
                <p className="text-muted-foreground">No exams today. Keep studying!</p>
              </div>
            )}
          </div>

          {/* Subject Overview */}
          <div className="space-y-6">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <TrendingUp size={20} className="text-primary" />
              Subject Performance
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {(data.subjects || []).map((subject) => {
                const { percentage: attendance, total, present } = calculateAttendance(subject.id);
                const ctAvg = calculateBest3Average(subject.id);
                const isWarning = attendance < 75 && total > 0;
                const upcomingCTs = data.events.filter(e => e.subjectId === subject.id && e.type === 'Quiz' && new Date(e.eventDate) >= today);

                return (
                  <motion.div
                    key={subject.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedSubjectId(subject.id)}
                    className="m3-card group cursor-pointer transition-all hover:shadow-lg active:shadow-sm relative overflow-hidden"
                  >
                    {upcomingCTs.length > 0 && (
                      <div className="absolute top-0 right-0 bg-primary text-white text-[8px] font-black px-3 py-1 rounded-bl-xl uppercase tracking-widest animate-pulse">
                        {upcomingCTs.length} Upcoming CT
                      </div>
                    )}
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: subject.colorTag }} />
                        <h3 className="font-bold text-lg">{subject.name}</h3>
                      </div>
                      <div className="text-xs font-medium px-2 py-1 rounded-full bg-muted">
                        {subject.creditHours} Credits
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="relative w-16 h-16">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={[
                                  { value: attendance || 0.1 },
                                  { value: 100 - (attendance || 0.1) }
                                ]}
                                innerRadius={20}
                                outerRadius={30}
                                paddingAngle={0}
                                dataKey="value"
                                startAngle={90}
                                endAngle={-270}
                              >
                                <Cell fill={isWarning ? '#ef4444' : subject.colorTag} />
                                <Cell fill="rgba(0,0,0,0.05)" />
                              </Pie>
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">
                            {attendance}%
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Attendance</p>
                          <div className="flex items-center gap-1">
                            {isWarning ? (
                              <AlertCircle size={14} className="text-red-500" />
                            ) : (
                              <CheckCircle2 size={14} className="text-green-500" />
                            )}
                            <span className={cn("text-sm font-semibold", isWarning && "text-red-500")}>
                              {total === 0 ? 'No Data' : isWarning ? 'Warning' : 'Good'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">CT Avg (Best 3)</p>
                        <p className="text-2xl font-black text-primary">{ctAvg}<span className="text-sm font-normal text-muted-foreground">/20</span></p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Sidebar: Stats & Events */}
        <aside className="space-y-8">
          <div className="m3-card bg-primary text-white overflow-hidden relative">
            <div className="relative z-10">
              <h3 className="text-lg font-semibold opacity-80">Overall CGPA</h3>
              <p className="text-5xl font-bold my-2">{cgpa.toFixed(2)}</p>
              <div className="flex items-center gap-2 text-sm opacity-90">
                <TrendingUp size={16} />
                <span>Target: {data.profile.targetGPA.toFixed(2)}</span>
              </div>
            </div>
            <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
          </div>

          <div className="m3-card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold">Upcoming Events</h3>
                {(eventsLoading || eventsSyncing) && (
                  <Loader2 size={14} className="animate-spin text-primary" />
                )}
              </div>
              <button 
                onClick={() => {
                  clearEventsError();
                  setEditingEventId(null);
                  setNewEvent({
                    title: '',
                    description: '',
                    eventDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
                    type: 'Assignment',
                    subjectId: '',
                    ctNumber: '',
                  });
                  setIsAddingEvent(true);
                }}
                className="p-2 rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all"
              >
                <Plus size={18} />
              </button>
            </div>
            {eventsError && (
              <div className="mb-4 p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-between gap-2 text-xs font-bold">
                <div className="flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{eventsError}</span>
                </div>
                <button
                  type="button"
                  onClick={clearEventsError}
                  className="p-1 hover:bg-red-500/10 rounded-lg transition-colors"
                  aria-label="Dismiss error"
                >
                  <X size={14} />
                </button>
              </div>
            )}
            <div className="space-y-4">
              {data.events.length > 0 ? (
                data.events
                  .filter(e => new Date(e.eventDate) >= today)
                  .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime())
                  .slice(0, 4)
                  .map(event => {
                    const daysLeft = differenceInDays(new Date(event.eventDate), today);
                    return (
                      <div key={event.id} className="flex gap-4 items-start p-2 rounded-2xl hover:bg-muted transition-colors group relative">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                          <CalendarIcon size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm truncate">{event.title}</h4>
                          <p className="text-[10px] text-muted-foreground uppercase font-bold">
                            {(event.subjectId && (data.subjects || []).find(s => s.id === event.subjectId)?.name) || event.type}
                          </p>
                          <p className="text-xs font-semibold text-primary mt-1">
                            {daysLeft === 0 ? 'Today' : daysLeft === 1 ? 'Tomorrow' : `In ${daysLeft} days`}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          <button
                            onClick={() => openEditEventModal(event)}
                            className="p-2 text-muted-foreground hover:text-primary transition-all"
                            title="Edit Event"
                          >
                            <Edit3 size={16} />
                          </button>
                          <button
                            onClick={() => setEventToDelete(event.id)}
                            className="p-2 text-muted-foreground hover:text-red-500 transition-all"
                            title="Delete Event"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })
              ) : (
                <p className="text-sm text-muted-foreground italic">No upcoming exams or assignments.</p>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* Calendar Modal */}
      <AnimatePresence>
        {isCalendarOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[150] flex items-center justify-center p-4 md:p-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-card w-full max-w-4xl rounded-[2.5rem] overflow-hidden shadow-2xl border border-border flex flex-col md:flex-row h-[90vh] md:h-auto max-h-[90vh] md:max-h-[85vh]"
            >
              {/* Calendar Section */}
              <div className="flex-1 p-6 md:p-8 border-b md:border-b-0 md:border-r border-border">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-2xl font-bold">{format(currentMonth, 'MMMM yyyy')}</h2>
                    <p className="text-sm text-muted-foreground">Academic Schedule</p>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                      className="p-2 rounded-xl hover:bg-muted transition-colors"
                    >
                      <ChevronLeft size={20} />
                      <span className="sr-only">Previous</span>
                    </button>
                    <button 
                      onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                      className="p-2 rounded-xl hover:bg-muted transition-colors"
                    >
                      <ChevronRight size={20} />
                      <span className="sr-only">Next</span>
                    </button>
                    <button 
                      onClick={() => setIsCalendarOpen(false)}
                      className="p-2 rounded-xl hover:bg-red-500/10 text-red-500 transition-colors ml-2"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-1 mb-2">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground py-2">
                      {day}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {(() => {
                    const monthStart = startOfMonth(currentMonth);
                    const monthEnd = endOfMonth(monthStart);
                    const startDate = startOfWeek(monthStart);
                    const endDate = endOfWeek(monthEnd);
                    const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

                    return calendarDays.map((day, idx) => {
                      const dayEvents = data.events.filter(e => isSameDay(new Date(e.eventDate), day));
                      const isSel = isSameDay(day, selectedDate);
                      const isCurrMonth = isSameMonth(day, monthStart);
                      const isTday = isToday(day);

                      return (
                        <button
                          key={idx}
                          onClick={() => setSelectedDate(day)}
                          className={cn(
                            "aspect-square rounded-2xl flex flex-col items-center justify-center relative transition-all",
                            !isCurrMonth && "opacity-20",
                            isSel ? "bg-primary text-white shadow-lg scale-105 z-10" : "hover:bg-muted",
                            isTday && !isSel && "ring-2 ring-primary/30"
                          )}
                        >
                          <span className={cn("text-sm font-bold", isSel ? "text-white" : "text-foreground")}>
                            {format(day, 'd')}
                          </span>
                          {dayEvents.length > 0 && (
                            <div className="flex gap-0.5 mt-1">
                              {dayEvents.slice(0, 3).map((e, i) => (
                                <div 
                                  key={i} 
                                  className={cn(
                                    "w-1 h-1 rounded-full",
                                    isSel ? "bg-white" : 
                                    e.type === 'Exam' || e.type === 'Lab Final' ? "bg-red-500" :
                                    e.type === 'Assignment' ? "bg-blue-500" :
                                    e.type === 'Class Test' || e.type === 'Quiz' ? "bg-amber-500" : "bg-primary"
                                  )} 
                                />
                              ))}
                            </div>
                          )}
                        </button>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Details Section */}
              <div className="w-full md:w-80 bg-muted/30 p-6 md:p-8 pb-8 md:pb-10 flex flex-col">
                <div className="mb-6">
                  <h3 className="text-lg font-bold">{format(selectedDate, 'EEEE')}</h3>
                  <p className="text-sm text-muted-foreground">{format(selectedDate, 'MMMM do, yyyy')}</p>
                </div>

                <div className="flex-1 overflow-y-auto space-y-4 pr-2 -mr-2 pb-4">
                  {(() => {
                    const dayEvents = data.events.filter(e => isSameDay(new Date(e.eventDate), selectedDate));
                    if (dayEvents.length === 0) {
                      return (
                        <div className="h-full flex flex-col items-center justify-center text-center p-4">
                          <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-4 text-muted-foreground">
                            <CalendarIcon size={24} />
                          </div>
                          <p className="text-sm text-muted-foreground italic">No tasks scheduled for this day.</p>
                        </div>
                      );
                    }

                    return dayEvents.map(event => (
                      <div key={event.id} className="p-4 bg-card rounded-2xl border border-border shadow-sm group hover:border-primary/50 transition-colors">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={cn(
                              "w-2 h-2 rounded-full shrink-0",
                              event.type === 'Exam' || event.type === 'Lab Final' ? "bg-red-500" :
                              event.type === 'Assignment' ? "bg-blue-500" :
                              event.type === 'Class Test' || event.type === 'Quiz' ? "bg-amber-500" : "bg-primary"
                            )} />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground truncate">
                              {(event.subjectId && (data.subjects || []).find(s => s.id === event.subjectId)?.name) || event.type}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                            <button
                              type="button"
                              onClick={() => openEditEventModal(event)}
                              className="p-1 text-muted-foreground hover:text-primary transition-colors"
                              title="Edit Event"
                            >
                              <Edit3 size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEventToDelete(event.id)}
                              className="p-1 text-muted-foreground hover:text-red-500 transition-colors"
                              title="Delete Event"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                        <h4 className="font-bold text-sm mb-1">{event.title}</h4>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          <Clock size={10} />
                          <span>{format(new Date(event.eventDate), 'hh:mm a')}</span>
                        </div>
                        {event.description && (
                          <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed break-words">{event.description}</p>
                        )}
                      </div>
                    ));
                  })()}
                </div>

                <button 
                  onClick={() => {
                    setEditingEventId(null);
                    setNewEvent({
                      title: '',
                      description: '',
                      eventDate: format(selectedDate, "yyyy-MM-dd'T'HH:mm"),
                      type: 'Assignment',
                      subjectId: '',
                      ctNumber: '',
                    });
                    setIsAddingEvent(true);
                  }}
                  className="mt-6 w-full py-4 bg-primary text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:shadow-lg transition-all"
                >
                  <Plus size={18} />
                  Add Task
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Subject Detail Modal */}
      <AnimatePresence>
        {selectedSubjectId && selectedSubject && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-card w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl border border-border"
            >
              <div className="p-6 border-b border-border flex items-center justify-between" style={{ borderTop: `8px solid ${selectedSubject.colorTag}` }}>
                <div>
                  <h2 className="text-2xl font-bold">{selectedSubject.name}</h2>
                  <p className="text-sm text-muted-foreground">{selectedSubject.creditHours} Credit Hours</p>
                </div>
                <button 
                  onClick={() => setSelectedSubjectId(null)}
                  className="p-2 rounded-full hover:bg-muted transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-6 space-y-8 max-h-[70vh] overflow-y-auto">
                {/* Attendance Detail */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <CheckCircle2 size={16} /> Attendance Breakdown
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-green-500/10 rounded-2xl border border-green-500/20">
                      <p className="text-xs font-bold text-green-600 uppercase">Attended</p>
                      <p className="text-3xl font-black text-green-600">{selectedSubjectAttendance?.present}</p>
                    </div>
                    <div className="p-4 bg-red-500/10 rounded-2xl border border-red-500/20">
                      <p className="text-xs font-bold text-red-600 uppercase">Missed</p>
                      <p className="text-3xl font-black text-red-600">{selectedSubjectAttendance?.missed}</p>
                    </div>
                  </div>
                  <div className="p-4 bg-muted rounded-2xl">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-bold">Overall Attendance</span>
                      <span className="text-sm font-black">{selectedSubjectAttendance?.percentage}%</span>
                    </div>
                    <div className="h-2 bg-background rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary transition-all duration-500" 
                        style={{ width: `${selectedSubjectAttendance?.percentage}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* CT Marks Detail */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <TrendingUp size={16} /> CT Marks Breakdown
                  </h3>

                  <div className="space-y-2">
                    {selectedSubjectMarks.length > 0 ? (
                      selectedSubjectMarks.map(mark => {
                        const isCT = isClassTestExam(mark.examName);
                        return (
                          <div key={mark.id} className="flex items-center justify-between p-4 bg-muted rounded-2xl">
                            <div>
                              <span className="font-bold block">{mark.examName}</span>
                              <span className="text-[10px] text-muted-foreground font-bold uppercase">
                                {isCT ? 'Class Test' : 'Excluded from CT Avg'}
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <span className="text-lg font-black text-primary block">
                                  {mark.markObtained}<span className="text-xs font-normal text-muted-foreground">/{mark.totalMark}</span>
                                </span>
                                <span className="text-[10px] font-bold text-muted-foreground">{Math.round((mark.markObtained / mark.totalMark) * 100)}%</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => deleteCTMark(mark.id)}
                                className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all cursor-pointer"
                                title="Delete Mark"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-center py-8 text-sm text-muted-foreground italic bg-muted rounded-2xl border-2 border-dashed border-border">No marks recorded yet.</p>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Event Modal */}
      <AnimatePresence>
        {isAddingEvent && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-card w-full max-w-md rounded-3xl p-8 shadow-2xl border border-border"
            >
              <h2 className="text-2xl font-bold mb-6">
                {editingEventId ? 'Edit Academic Event' : 'Add Academic Event'}
              </h2>
              <form onSubmit={handleAddEvent} className="space-y-6">
                <div>
                  <label className="block text-sm font-bold mb-2 uppercase text-muted-foreground">Type</label>
                  <select 
                    value={newEvent.type}
                    onChange={e => setNewEvent({ ...newEvent, type: e.target.value as any })}
                    className="w-full bg-muted border-none rounded-2xl p-4 focus:ring-2 focus:ring-primary outline-none font-bold"
                  >
                    <option value="Assignment">Assignment</option>
                    <option value="Class Test">Class Test (CT)</option>
                    <option value="Quiz">Quiz</option>
                    <option value="Presentation">Presentation</option>
                    <option value="Lab Final">Lab Final</option>
                    <option value="Exam">Exam</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                {/* Subject Selection for Academic Tasks */}
                {(newEvent.type === 'Class Test' || newEvent.type === 'Quiz' || newEvent.type === 'Assignment' || newEvent.type === 'Exam' || newEvent.type === 'Lab Final') && (
                  <div>
                    <label className="block text-sm font-bold mb-2 uppercase text-muted-foreground">Subject</label>
                    <select 
                      required
                      value={newEvent.subjectId}
                      onChange={e => setNewEvent({ ...newEvent, subjectId: e.target.value })}
                      className="w-full bg-muted border-none rounded-2xl p-4 focus:ring-2 focus:ring-primary outline-none font-bold"
                    >
                      <option value="">Select Subject</option>
                      {data.subjects.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {newEvent.type === 'Class Test' ? (
                  <div>
                    <label className="block text-sm font-bold mb-2 uppercase text-muted-foreground">CT Number</label>
                    <select 
                      required
                      value={newEvent.ctNumber}
                      onChange={e => setNewEvent({ ...newEvent, ctNumber: e.target.value })}
                      className="w-full bg-muted border-none rounded-2xl p-4 focus:ring-2 focus:ring-primary outline-none font-bold"
                    >
                      <option value="">Select CT</option>
                      <option value="CT 1">CT 1</option>
                      <option value="CT 2">CT 2</option>
                      <option value="CT 3">CT 3</option>
                      <option value="CT 4">CT 4</option>
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-bold mb-2 uppercase text-muted-foreground">Title</label>
                    <input
                      required
                      type="text"
                      value={newEvent.title}
                      onChange={e => setNewEvent({ ...newEvent, title: e.target.value })}
                      className="w-full bg-muted border-none rounded-2xl p-4 focus:ring-2 focus:ring-primary outline-none font-bold"
                      placeholder="e.g. Lab Final Preparation"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-bold mb-2 uppercase text-muted-foreground">Date & Time</label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsDatePickerOpen(true);
                    }}
                    className="w-full bg-muted border-none rounded-2xl p-4 focus:ring-2 focus:ring-primary outline-none font-bold text-left flex items-center justify-between hover:bg-accent transition-colors"
                  >
                    <span>{format(new Date(newEvent.eventDate), 'PPP p')}</span>
                    <CalendarIcon size={20} className="text-primary" />
                  </button>
                </div>
                <DateTimePickerModal 
                  isOpen={isDatePickerOpen}
                  onClose={() => setIsDatePickerOpen(false)}
                  initialDate={new Date(newEvent.eventDate)}
                  onConfirm={(date) => {
                    setNewEvent({ ...newEvent, eventDate: date.toISOString() });
                    setIsDatePickerOpen(false);
                  }}
                />
                <div>
                  <label className="block text-sm font-bold mb-2 uppercase text-muted-foreground">Description</label>
                  <textarea
                    value={newEvent.description}
                    onChange={e => setNewEvent({ ...newEvent, description: e.target.value })}
                    className="w-full bg-muted border-none rounded-2xl p-4 focus:ring-2 focus:ring-primary outline-none font-bold h-24 resize-none"
                    placeholder="Add some details..."
                  />
                </div>
                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={resetEventModal} className="flex-1 py-4 rounded-2xl font-bold text-muted-foreground hover:bg-muted transition-colors">
                    Cancel
                  </button>
                  <button type="submit" className="flex-1 py-4 bg-primary text-white rounded-2xl font-bold hover:shadow-lg transition-all">
                    {editingEventId ? 'Save Changes' : 'Add Event'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Event Confirmation Modal */}
      <AnimatePresence>
        {eventToDelete && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[110] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-card w-full max-w-sm rounded-3xl p-8 shadow-2xl border border-border text-center"
            >
              <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={32} />
              </div>
              <h2 className="text-xl font-bold mb-2">Delete Event?</h2>
              <p className="text-muted-foreground mb-6">Are you sure you want to remove this event? This action cannot be undone.</p>
              <div className="flex gap-4">
                <button
                  onClick={() => setEventToDelete(null)}
                  className="flex-1 py-3 rounded-2xl font-bold text-muted-foreground hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteEvent(eventToDelete)}
                  className="flex-1 py-3 bg-red-500 text-white rounded-2xl font-bold hover:bg-red-600 transition-colors"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
