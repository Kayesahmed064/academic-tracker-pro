import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, Clock, X } from 'lucide-react';
import { format, addDays, startOfToday } from 'date-fns';
import { cn } from '../lib/utils';

interface DateTimePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (date: Date) => void;
  initialDate?: Date;
}

export const DateTimePickerModal: React.FC<DateTimePickerModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  initialDate
}) => {
  const [tempDate, setTempDate] = useState<Date>(initialDate || new Date());

  useEffect(() => {
    if (isOpen && initialDate) {
      setTempDate(initialDate);
    }
  }, [isOpen, initialDate]);

  const handleQuickSelect = (days: number) => {
    const newDate = addDays(startOfToday(), days);
    newDate.setHours(tempDate.getHours(), tempDate.getMinutes());
    setTempDate(newDate);
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const [y, m, d] = e.target.value.split('-').map(Number);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      const updated = new Date(tempDate);
      updated.setFullYear(y, m - 1, d);
      setTempDate(updated);
    }
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const [h, m] = e.target.value.split(':').map(Number);
    if (!isNaN(h) && !isNaN(m)) {
      const updated = new Date(tempDate);
      updated.setHours(h, m);
      setTempDate(updated);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center p-0 md:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="relative bg-card w-full max-w-md rounded-t-[2.5rem] md:rounded-[2.5rem] p-8 shadow-2xl border border-border z-10"
          >
            <div className="w-12 h-1.5 bg-muted rounded-full mx-auto mb-6 md:hidden" />
            
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Select Date & Time</h2>
              <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors md:hidden">
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    <Calendar size={12} /> Date
                  </label>
                  <input
                    type="date"
                    value={format(tempDate, 'yyyy-MM-dd')}
                    onChange={handleDateChange}
                    className="w-full bg-muted border-none rounded-2xl p-4 font-bold outline-none focus:ring-2 focus:ring-primary transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    <Clock size={12} /> Time
                  </label>
                  <input
                    type="time"
                    value={format(tempDate, 'HH:mm')}
                    onChange={handleTimeChange}
                    className="w-full bg-muted border-none rounded-2xl p-4 font-bold outline-none focus:ring-2 focus:ring-primary transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Quick Select</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: 'Today', days: 0 },
                    { label: 'Tomorrow', days: 1 },
                    { label: 'Next Week', days: 7 }
                  ].map(preset => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => handleQuickSelect(preset.days)}
                      className="px-4 py-2 rounded-xl bg-muted hover:bg-primary/10 hover:text-primary text-xs font-bold transition-all border border-transparent hover:border-primary/20"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  type="button"
                  onClick={onClose} 
                  className="flex-1 py-4 rounded-2xl font-bold text-muted-foreground hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  onClick={() => onConfirm(tempDate)} 
                  className="flex-1 py-4 bg-primary text-white rounded-2xl font-bold hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  Confirm
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
