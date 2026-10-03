import React from 'react';
import { useApp } from '../context/AppContext';
import { motion } from 'motion/react';
import { GraduationCap, Calculator, TrendingUp, Info, AlertCircle, Loader2, X } from 'lucide-react';
import { cn } from '../lib/utils';

export const GPACalculator = () => {
  const {
    data,
    updateSemesterGPA,
    semestersLoading,
    semestersSyncing,
    semestersError,
    clearSemestersError,
  } = useApp();
  const { semesters } = data;

  const calculateCGPA = () => {
    let totalWeightedGPA = 0;
    let totalCredits = 0;

    (semesters || []).forEach(s => {
      if (s.credits > 0) {
        totalWeightedGPA += s.gpa * s.credits;
        totalCredits += s.credits;
      }
    });

    if (totalCredits === 0) return { cgpa: 0, totalCredits: 0 };
    return {
      cgpa: parseFloat((totalWeightedGPA / totalCredits).toFixed(2)),
      totalCredits
    };
  };

  const { cgpa, totalCredits } = calculateCGPA();

  const handleInputChange = (id: number, field: 'gpa' | 'credits', value: string) => {
    const numValue = parseFloat(value) || 0;
    const semester = semesters.find(s => s.id === id);
    if (!semester) return;

    if (field === 'gpa') {
      // Clamp GPA between 0 and 4
      const clampedGPA = Math.min(4, Math.max(0, numValue));
      updateSemesterGPA(id, clampedGPA, semester.credits);
    } else {
      // Clamp credits between 0 and 100
      const clampedCredits = Math.min(100, Math.max(0, numValue));
      updateSemesterGPA(id, semester.gpa, clampedCredits);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">GPA Calculator</h1>
            {(semestersLoading || semestersSyncing) && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                <Loader2 size={12} className="animate-spin text-primary" />
                {semestersLoading ? 'Loading...' : 'Syncing...'}
              </span>
            )}
          </div>
          <p className="text-muted-foreground mt-1">Track your academic progress across 8 semesters</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="p-4 bg-primary/10 rounded-3xl border border-primary/20 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-white shadow-lg">
              <Calculator size={24} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Current CGPA</p>
              <p className="text-2xl font-black">{cgpa.toFixed(2)}</p>
            </div>
          </div>
          <div className="p-4 bg-muted rounded-3xl border border-border flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-background flex items-center justify-center text-muted-foreground">
              <TrendingUp size={24} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total Credits</p>
              <p className="text-2xl font-black">{totalCredits}</p>
            </div>
          </div>
        </div>
      </header>

      {semestersError && (
        <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <AlertCircle size={18} className="shrink-0" />
            <span>{semestersError}</span>
          </div>
          <button
            type="button"
            onClick={clearSemestersError}
            className="p-1 hover:bg-destructive/10 rounded-lg transition-colors"
            aria-label="Dismiss error"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {semesters.map((s, idx) => (
          <motion.div
            key={s.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="m3-card group hover:border-primary/50 transition-all"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center font-bold text-sm">
                  S{s.id}
                </div>
                <h3 className="font-bold">Semester {s.id}</h3>
              </div>
              {s.credits > 0 && (
                <span className="text-[10px] font-bold px-2 py-1 bg-primary/10 text-primary rounded-full uppercase tracking-wider">
                  Completed
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">
                  GPA (0.0 - 4.0)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="4"
                  value={s.gpa || ''}
                  onChange={(e) => handleInputChange(s.id, 'gpa', e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-muted border-none rounded-2xl p-4 focus:ring-2 focus:ring-primary outline-none font-bold"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">
                  Credits
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={s.credits || ''}
                  onChange={(e) => handleInputChange(s.id, 'credits', e.target.value)}
                  placeholder="0"
                  className="w-full bg-muted border-none rounded-2xl p-4 focus:ring-2 focus:ring-primary outline-none font-bold"
                />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="p-6 bg-muted/30 rounded-[2rem] border border-dashed border-border flex items-start gap-4">
        <div className="p-2 bg-background rounded-xl text-muted-foreground">
          <Info size={20} />
        </div>
        <div className="space-y-1">
          <h4 className="font-bold text-sm">How is CGPA calculated?</h4>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Cumulative Grade Point Average (CGPA) is calculated as the weighted average of all semester GPAs. 
            Formula: Σ (Semester GPA × Semester Credits) / Σ (Total Credits).
          </p>
        </div>
      </div>
    </div>
  );
};
