import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Calendar, Clock, BookOpen, CheckCircle2, CalendarPlus } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { cn } from '../lib/utils';
import { DateTimePickerModal } from './DateTimePickerModal';
import { format } from 'date-fns';

interface CTSchedulerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CTSchedulerModal: React.FC<CTSchedulerModalProps> = ({ isOpen, onClose }) => {
  const { data, addEvent } = useApp();
  const [subjectId, setSubjectId] = useState(data.subjects[0]?.id || '');
  const [eventType, setEventType] = useState<'Class Test' | 'Quiz' | 'Assignment' | 'Presentation' | 'Exam' | 'Lab Final' | 'Other'>('Class Test');
  const [ctCategory, setCtCategory] = useState('CT 1');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dateTime, setDateTime] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  // Update subjectId if it was empty and subjects are now available
  React.useEffect(() => {
    if (!subjectId && data.subjects.length > 0) {
      setSubjectId(data.subjects[0].id);
    }
  }, [data.subjects, subjectId]);

  const requiresSubject = eventType !== 'Presentation' && eventType !== 'Other';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((requiresSubject && !subjectId) || !dateTime) return;

    const subject = data.subjects.find(s => s.id === subjectId);
    
    const finalTitle = eventType === 'Class Test'
      ? `${subject?.name || 'Course'} ${ctCategory}`
      : (title.trim() || `${subject?.name ? `${subject.name} ` : ''}${eventType}`);

    const finalDescription = description.trim() || (
      subject ? `Scheduled ${eventType} for ${subject.name}` : `Scheduled ${eventType}`
    );
    
    addEvent({
      title: finalTitle,
      description: finalDescription,
      eventDate: new Date(dateTime).toISOString(),
      type: eventType,
      subjectId: subjectId || undefined
    });

    setIsSuccess(true);
    setTimeout(() => {
      setIsSuccess(false);
      onClose();
      setDateTime('');
      setTitle('');
      setDescription('');
    }, 1500);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-lg bg-card border border-border rounded-3xl shadow-2xl overflow-hidden my-auto z-10"
          >
            {isSuccess ? (
              <div className="p-12 flex flex-col items-center justify-center text-center space-y-4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="w-20 h-20 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center"
                >
                  <CheckCircle2 size={40} />
                </motion.div>
                <h2 className="text-2xl font-bold">Event Scheduled!</h2>
                <p className="text-muted-foreground">The event has been added to your calendar and dashboard.</p>
              </div>
            ) : (
              <>
                <div className="p-6 border-b border-border flex items-center justify-between bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                      <Calendar size={20} />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">Add Events</h2>
                      <p className="text-xs text-muted-foreground">Schedule an upcoming academic event</p>
                    </div>
                  </div>
                  <button 
                    onClick={onClose}
                    className="p-2 hover:bg-muted rounded-xl transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-5 max-h-[80vh] overflow-y-auto">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <Clock size={14} /> Event Type
                    </label>
                    <select
                      value={eventType}
                      onChange={(e) => setEventType(e.target.value as any)}
                      className="w-full bg-muted border-none rounded-2xl p-4 focus:ring-2 focus:ring-primary outline-none font-bold cursor-pointer"
                    >
                      <option value="Class Test">Class Test</option>
                      <option value="Quiz">Quiz</option>
                      <option value="Assignment">Assignment</option>
                      <option value="Presentation">Presentation</option>
                      <option value="Exam">Exam</option>
                      <option value="Lab Final">Lab Final</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <BookOpen size={14} /> Select Subject {!requiresSubject && '(Optional)'}
                    </label>
                    <select
                      value={subjectId}
                      onChange={(e) => setSubjectId(e.target.value)}
                      className="w-full bg-muted border-none rounded-2xl p-4 focus:ring-2 focus:ring-primary outline-none font-bold appearance-none cursor-pointer"
                      required={requiresSubject}
                    >
                      <option value="" disabled={requiresSubject}>
                        {requiresSubject ? 'Choose a subject' : 'No specific subject'}
                      </option>
                      {data.subjects.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  {eventType === 'Class Test' ? (
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                        <Clock size={14} /> CT Number
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {['CT 1', 'CT 2', 'CT 3', 'CT 4'].map(cat => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setCtCategory(cat)}
                            className={cn(
                              "py-3 rounded-xl text-sm font-bold transition-all border",
                              ctCategory === cat 
                                ? "bg-primary text-white border-primary shadow-md" 
                                : "bg-muted border-transparent text-muted-foreground hover:border-muted-foreground/30"
                            )}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Title
                      </label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder={`e.g. ${eventType} Preparation`}
                        className="w-full bg-muted border-none rounded-2xl p-4 focus:ring-2 focus:ring-primary outline-none font-bold"
                        required
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <Calendar size={14} /> Date & Time
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsDatePickerOpen(true)}
                      className="w-full bg-muted border-none rounded-2xl p-4 focus:ring-2 focus:ring-primary outline-none font-bold text-left flex items-center justify-between hover:bg-accent transition-all group"
                    >
                      <span className={cn(dateTime ? "text-foreground" : "text-muted-foreground")}>
                        {dateTime ? format(new Date(dateTime), 'PPP p') : 'Select Date & Time'}
                      </span>
                      <CalendarPlus size={20} className="text-primary group-hover:scale-110 transition-transform" />
                    </button>
                  </div>

                  <DateTimePickerModal 
                    isOpen={isDatePickerOpen}
                    onClose={() => setIsDatePickerOpen(false)}
                    initialDate={dateTime ? new Date(dateTime) : new Date()}
                    onConfirm={(date) => {
                      setDateTime(date.toISOString());
                      setIsDatePickerOpen(false);
                    }}
                  />

                  <div className="pt-4 flex gap-3">
                    <button
                      type="button"
                      onClick={onClose}
                      className="flex-1 py-4 rounded-2xl font-bold text-muted-foreground hover:bg-muted transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={(requiresSubject && !subjectId) || !dateTime || (eventType !== 'Class Test' && !title.trim())}
                      className="flex-1 py-4 bg-primary text-white rounded-2xl font-bold hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:scale-100"
                    >
                      Schedule Now
                    </button>
                  </div>
                </form>
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
