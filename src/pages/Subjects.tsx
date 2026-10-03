import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Plus, Trash2, Edit3, BookOpen, TrendingUp, Calculator, Calendar, Clock, AlertCircle, Loader2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { format, isAfter } from 'date-fns';
import { CTMark, Subject } from '../types';
import { calculateBest3CTStats } from '../lib/firestore';

const COLORS = ['#1a237e', '#c2185b', '#00796b', '#f57c00', '#512da8', '#388e3c', '#d32f2f', '#1976d2'];

export const Subjects = () => {
  const {
    data,
    addSubject,
    updateSubject,
    deleteSubject,
    addCTMark,
    updateCTMark,
    deleteCTMark,
    subjectsLoading,
    subjectsSyncing,
    subjectsError,
    clearSubjectsError,
    ctMarksLoading,
    ctMarksSyncing,
    ctMarksError,
    clearCTMarksError,
  } = useApp();
  const [isAdding, setIsAdding] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [subjectFormError, setSubjectFormError] = useState<string | null>(null);
  const [subjectToDelete, setSubjectToDelete] = useState<string | null>(null);
  const [isAddingMark, setIsAddingMark] = useState<string | null>(null);
  const [editingMark, setEditingMark] = useState<CTMark | null>(null);
  const [markError, setMarkError] = useState<string | null>(null);
  const [expandedSubjectId, setExpandedSubjectId] = useState<string | null>(null);
  const [newSubject, setNewSubject] = useState({ name: '', creditHours: 3, colorTag: COLORS[0] });
  const [newMark, setNewMark] = useState({ examName: 'CT 1', markObtained: 0, totalMark: 20 });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newSubject.name.trim();
    if (!trimmedName) {
      setSubjectFormError('Please enter a subject name.');
      return;
    }
    const duplicate = (data.subjects || []).some(
      s => s.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (duplicate) {
      setSubjectFormError(`"${trimmedName}" already exists.`);
      return;
    }
    const created = addSubject({
      ...newSubject,
      name: trimmedName,
      creditHours: Number.isFinite(newSubject.creditHours) ? newSubject.creditHours : 3,
    });
    if (!created) {
      setSubjectFormError(`"${trimmedName}" already exists.`);
      return;
    }
    setSubjectFormError(null);
    setNewSubject({ name: '', creditHours: 3, colorTag: COLORS[0] });
    setIsAdding(false);
  };

  const handleEditSubjectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSubject) return;
    const trimmedName = editingSubject.name.trim();
    if (!trimmedName) {
      setSubjectFormError('Please enter a subject name.');
      return;
    }
    const duplicate = (data.subjects || []).some(
      s => s.id !== editingSubject.id && s.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (duplicate) {
      setSubjectFormError(`"${trimmedName}" already exists.`);
      return;
    }
    const updated = updateSubject({
      ...editingSubject,
      name: trimmedName,
      creditHours: Number.isFinite(editingSubject.creditHours) ? editingSubject.creditHours : 3,
    });
    if (!updated) {
      setSubjectFormError(`"${trimmedName}" already exists.`);
      return;
    }
    setSubjectFormError(null);
    setEditingSubject(null);
  };

  const handleAddMark = (subjectId: string) => {
    if (!Number.isFinite(newMark.totalMark) || newMark.totalMark <= 0) {
      setMarkError('Total mark must be greater than 0.');
      return;
    }
    if (!Number.isFinite(newMark.markObtained) || newMark.markObtained < 0) {
      setMarkError('Obtained mark cannot be negative.');
      return;
    }
    if (newMark.markObtained > newMark.totalMark) {
      setMarkError('Obtained mark cannot exceed total mark.');
      return;
    }

    const duplicateExists = (data.ctMarks || []).some(
      m =>
        m.subjectId === subjectId &&
        m.examName.trim().toLowerCase() === newMark.examName.trim().toLowerCase()
    );

    if (duplicateExists) {
      setMarkError(`${newMark.examName} already exists for this subject. Please edit the existing mark.`);
      return;
    }

    const selectedSubject = (data.subjects || []).find(s => s.id === subjectId);
    const subjectName = selectedSubject?.name || '';

    const added = addCTMark({
      subjectId,
      subjectName,
      ...newMark
    });

    if (!added) {
      setMarkError(`${newMark.examName} already exists for this subject. Please edit the existing mark.`);
      return;
    }

    setMarkError(null);
    setIsAddingMark(null);
    setNewMark({ examName: 'CT 1', markObtained: 0, totalMark: 20 });
  };

  const handleUpdateMark = () => {
    if (!editingMark) return;

    if (!Number.isFinite(editingMark.totalMark) || editingMark.totalMark <= 0) {
      setMarkError('Total mark must be greater than 0.');
      return;
    }
    if (!Number.isFinite(editingMark.markObtained) || editingMark.markObtained < 0) {
      setMarkError('Obtained mark cannot be negative.');
      return;
    }
    if (editingMark.markObtained > editingMark.totalMark) {
      setMarkError('Obtained mark cannot exceed total mark.');
      return;
    }

    const duplicateExists = (data.ctMarks || []).some(
      m =>
        m.id !== editingMark.id &&
        m.subjectId === editingMark.subjectId &&
        m.examName.trim().toLowerCase() === editingMark.examName.trim().toLowerCase()
    );

    if (duplicateExists) {
      setMarkError(`${editingMark.examName} already exists for this subject. Please edit the existing mark.`);
      return;
    }

    const selectedSubject = (data.subjects || []).find(s => s.id === editingMark.subjectId);
    const subjectName = selectedSubject?.name || editingMark.subjectName || '';

    const updated = updateCTMark({
      ...editingMark,
      subjectName,
    });
    if (!updated) {
      setMarkError(`${editingMark.examName} already exists for this subject. Please edit the existing mark.`);
      return;
    }

    setMarkError(null);
    setEditingMark(null);
  };

  const calculateBest3 = (subjectId: string) => {
    return calculateBest3CTStats(data.ctMarks || [], subjectId);
  };

  const isLoadingAny = subjectsLoading || ctMarksLoading;
  const isSyncingAny = subjectsSyncing || ctMarksSyncing;
  const activeError = subjectsError || ctMarksError;

  const handleClearErrors = () => {
    clearSubjectsError();
    clearCTMarksError();
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">Subjects & CT Marks</h1>
            {(isLoadingAny || isSyncingAny) && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-xl">
                <Loader2 size={14} className="animate-spin" />
                {isLoadingAny ? 'Loading...' : 'Syncing...'}
              </span>
            )}
          </div>
          <p className="text-muted-foreground">Manage your courses and exam scores</p>
        </div>
        <button
          onClick={() => {
            setSubjectFormError(null);
            handleClearErrors();
            setIsAdding(true);
          }}
          className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-2xl font-bold hover:shadow-lg transition-all"
        >
          <Plus size={20} />
          Add Subject
        </button>
      </div>

      {activeError && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-between gap-3 text-sm font-bold">
          <div className="flex items-center gap-3">
            <AlertCircle size={18} className="shrink-0" />
            <span>{activeError}</span>
          </div>
          <button
            type="button"
            onClick={handleClearErrors}
            className="p-1 hover:bg-red-500/10 rounded-lg transition-colors"
            aria-label="Dismiss error"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {subjectsLoading && (data.subjects || []).length === 0 ? (
        <div className="m3-card p-12 flex flex-col items-center justify-center gap-3 text-center">
          <Loader2 size={28} className="animate-spin text-primary" />
          <p className="text-sm font-bold text-muted-foreground">Loading your subjects...</p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4">
        <AnimatePresence mode="popLayout">
          {(data.subjects || []).map((subject) => {
            const { avg, count } = calculateBest3(subject.id);
            const marks = (data.ctMarks || []).filter(m => m.subjectId === subject.id);
            const upcomingEvents = (data.events || []).filter(e => 
              e.subjectId === subject.id && 
              isAfter(new Date(e.eventDate), new Date())
            ).sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());
            const isExpanded = expandedSubjectId === subject.id;

            return (
              <motion.div
                key={subject.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={cn(
                  "m3-card group cursor-pointer overflow-hidden transition-all duration-500",
                  isExpanded ? "ring-2 ring-primary ring-offset-4 shadow-2xl" : "hover:border-primary/40 hover:shadow-lg"
                )}
                onClick={() => setExpandedSubjectId(isExpanded ? null : subject.id)}
              >
                {/* Collapsed Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-5 flex-1">
                    <div 
                      className="w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0 transition-transform group-hover:scale-105" 
                      style={{ backgroundColor: subject.colorTag }}
                    >
                      <BookOpen size={28} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-2xl font-black tracking-tight truncate">{subject.name}</h3>
                      <div className="flex items-center gap-4 mt-1">
                        <span className="text-xs text-muted-foreground font-bold uppercase tracking-widest">{subject.creditHours} Credits</span>
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-primary flex items-center justify-center shadow-sm">
                            <Calculator size={12} className="text-white" />
                          </div>
                          <span className="text-[11px] font-black text-primary uppercase tracking-tighter">Avg: {avg}/20</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => {
                        setMarkError(null);
                        setIsAddingMark(subject.id);
                      }}
                      className="p-3 rounded-2xl bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all shadow-sm hover:shadow-md"
                      title="Add CT Mark"
                    >
                      <Plus size={20} />
                    </button>
                    <button
                      onClick={() => {
                        setSubjectFormError(null);
                        clearSubjectsError();
                        setEditingSubject(subject);
                      }}
                      className="p-3 rounded-2xl hover:bg-muted text-muted-foreground hover:text-primary transition-all hover:shadow-md"
                      title="Edit Subject"
                    >
                      <Edit3 size={20} />
                    </button>
                    <button
                      onClick={() => setSubjectToDelete(subject.id)}
                      className="p-3 rounded-2xl hover:bg-red-50 text-red-500 transition-all hover:shadow-md"
                      title="Delete Subject"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>

                {/* Expanded Content */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                    >
                      <div className="mt-6 pt-6 border-t border-border space-y-6">
                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          <div className="p-4 bg-muted/50 rounded-2xl border border-border/50">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1 tracking-wider">Best 3 Average</p>
                            <div className="flex items-baseline gap-1">
                              <p className="text-3xl font-black text-primary">{avg}</p>
                              <p className="text-xs text-muted-foreground">/ 20</p>
                            </div>
                          </div>
                          <div className="p-4 bg-muted/50 rounded-2xl border border-border/50">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1 tracking-wider">CTs Logged</p>
                            <div className="flex items-baseline gap-1">
                              <p className="text-3xl font-black">{count}</p>
                              <p className="text-xs text-muted-foreground">/ 4</p>
                            </div>
                          </div>
                          <div className="p-4 bg-muted/50 rounded-2xl border border-border/50 col-span-2 md:col-span-1">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1 tracking-wider">Status</p>
                            <div className="flex items-center gap-2 mt-1">
                              <div className={cn(
                                "w-2.5 h-2.5 rounded-full",
                                avg >= 15 ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" : 
                                avg >= 10 ? "bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]" : 
                                "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"
                              )} />
                              <span className="font-bold text-sm">
                                {avg >= 15 ? 'Excellent' : avg >= 10 ? 'Good' : 'Needs Focus'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Upcoming CTs */}
                        {upcomingEvents.length > 0 && (
                          <div className="p-5 bg-primary/5 rounded-3xl space-y-4 border border-primary/10">
                            <div className="flex items-center justify-between px-1">
                              <div className="flex items-center gap-2 text-primary">
                                <Calendar size={16} />
                                <h4 className="text-[11px] font-black uppercase tracking-[0.3em]">Upcoming CTs</h4>
                              </div>
                              <span className="text-[10px] font-bold text-primary/60">{upcomingEvents.length} Scheduled</span>
                            </div>
                            
                            <div className="space-y-2.5">
                              {upcomingEvents.map(event => (
                                <div 
                                  key={event.id} 
                                  className="flex items-center justify-between p-4 bg-white/50 dark:bg-primary/10 border border-primary/20 rounded-2xl"
                                >
                                  <div className="flex items-center gap-4">
                                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                                    <div>
                                      <span className="font-bold text-sm block">{event.title}</span>
                                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-medium">
                                        <Clock size={10} />
                                        <span>{format(new Date(event.eventDate), 'MMM do, hh:mm a')}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Marks List */}
                        <div className="p-5 bg-zinc-950 dark:bg-black/60 rounded-3xl space-y-4 shadow-inner">
                          <div className="flex items-center justify-between px-1">
                            <div className="flex items-center gap-2">
                              <TrendingUp size={16} className="text-primary" />
                              <h4 className="text-[11px] font-black text-zinc-400 uppercase tracking-[0.3em]">Performance Log</h4>
                            </div>
                            <span className="text-[10px] font-bold text-zinc-600">{marks.length} Entries</span>
                          </div>
                          
                          <div className="space-y-2.5">
                            {marks.length > 0 ? (
                              marks.map(m => (
                                <div 
                                  key={m.id} 
                                  className="flex items-center justify-between p-4 bg-zinc-900/80 dark:bg-white/5 border border-white/5 rounded-2xl hover:bg-zinc-800 hover:border-primary/30 transition-all group/item"
                                  onClick={e => e.stopPropagation()}
                                >
                                  <div className="flex items-center gap-4">
                                    <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                                    <div>
                                      <span className="font-black text-sm text-zinc-100 block">{m.examName}</span>
                                      <span className="text-[10px] text-zinc-500 uppercase font-bold">Recorded Score</span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className="text-right mr-2">
                                      <span className="text-xl font-black text-white">{m.markObtained}</span>
                                      <span className="text-xs text-zinc-500 ml-1.5 font-bold">/ {m.totalMark}</span>
                                    </div>
                                    <button 
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setMarkError(null);
                                        setEditingMark(m);
                                      }}
                                      className="p-2 text-zinc-400 hover:text-primary hover:bg-primary/10 rounded-xl transition-all cursor-pointer"
                                      title="Edit Mark"
                                    >
                                      <Edit3 size={16} />
                                    </button>
                                    <button 
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setMarkError(null);
                                        deleteCTMark(m.id);
                                      }}
                                      className="p-2 text-red-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all cursor-pointer"
                                      title="Delete Mark"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="text-center py-10 border-2 border-dashed border-white/5 rounded-2xl">
                                <p className="text-xs text-zinc-600 font-bold uppercase tracking-widest">No data points available</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Add Mark Modal */}
      {isAddingMark && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card w-full max-w-md rounded-3xl p-8 shadow-2xl border border-border"
          >
            <h2 className="text-2xl font-bold mb-6">Add CT Mark</h2>
            <div className="space-y-6">
              {markError && (
                <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-500 flex items-start gap-3 text-sm font-bold">
                  <AlertCircle size={18} className="shrink-0 mt-0.5" />
                  <span>{markError}</span>
                </div>
              )}
              <div>
                <label className="block text-sm font-bold mb-2 uppercase text-muted-foreground">Exam Name</label>
                <select 
                  value={newMark.examName}
                  onChange={e => {
                    setMarkError(null);
                    setNewMark({ ...newMark, examName: e.target.value });
                  }}
                  className="w-full bg-muted border-none rounded-2xl p-4 focus:ring-2 focus:ring-primary outline-none font-bold"
                >
                  <option>CT 1</option>
                  <option>CT 2</option>
                  <option>CT 3</option>
                  <option>CT 4</option>
                  <option>Assignment</option>
                  <option>Quiz</option>
                  <option>Other</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-2 uppercase text-muted-foreground">Obtained</label>
                  <input
                    type="number"
                    value={newMark.markObtained}
                    onChange={e => setNewMark({ ...newMark, markObtained: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-muted border-none rounded-2xl p-4 focus:ring-2 focus:ring-primary outline-none font-bold"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2 uppercase text-muted-foreground">Total</label>
                  <input
                    type="number"
                    value={newMark.totalMark}
                    onChange={e => setNewMark({ ...newMark, totalMark: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-muted border-none rounded-2xl p-4 focus:ring-2 focus:ring-primary outline-none font-bold"
                  />
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => {
                    setMarkError(null);
                    setIsAddingMark(null);
                  }}
                  className="flex-1 py-4 rounded-2xl font-bold text-muted-foreground hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button onClick={() => handleAddMark(isAddingMark)} className="flex-1 py-4 bg-primary text-white rounded-2xl font-bold hover:shadow-lg transition-all">
                  Save Mark
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Edit Mark Modal */}
      {editingMark && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card w-full max-w-md rounded-3xl p-8 shadow-2xl border border-border"
          >
            <h2 className="text-2xl font-bold mb-6">Edit CT Mark</h2>
            <div className="space-y-6">
              {markError && (
                <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-500 flex items-start gap-3 text-sm font-bold">
                  <AlertCircle size={18} className="shrink-0 mt-0.5" />
                  <span>{markError}</span>
                </div>
              )}
              <div>
                <label className="block text-sm font-bold mb-2 uppercase text-muted-foreground">Exam Name</label>
                <select 
                  value={editingMark.examName}
                  onChange={e => {
                    setMarkError(null);
                    setEditingMark({ ...editingMark, examName: e.target.value });
                  }}
                  className="w-full bg-muted border-none rounded-2xl p-4 focus:ring-2 focus:ring-primary outline-none font-bold"
                >
                  <option>CT 1</option>
                  <option>CT 2</option>
                  <option>CT 3</option>
                  <option>CT 4</option>
                  <option>Assignment</option>
                  <option>Quiz</option>
                  <option>Other</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-2 uppercase text-muted-foreground">Obtained</label>
                  <input
                    type="number"
                    value={editingMark.markObtained}
                    onChange={e => setEditingMark({ ...editingMark, markObtained: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-muted border-none rounded-2xl p-4 focus:ring-2 focus:ring-primary outline-none font-bold"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2 uppercase text-muted-foreground">Total</label>
                  <input
                    type="number"
                    value={editingMark.totalMark}
                    onChange={e => setEditingMark({ ...editingMark, totalMark: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-muted border-none rounded-2xl p-4 focus:ring-2 focus:ring-primary outline-none font-bold"
                  />
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => {
                    setMarkError(null);
                    setEditingMark(null);
                  }}
                  className="flex-1 py-4 rounded-2xl font-bold text-muted-foreground hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button onClick={handleUpdateMark} className="flex-1 py-4 bg-primary text-white rounded-2xl font-bold hover:shadow-lg transition-all">
                  Update Mark
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Add Subject Modal (Existing) */}
      {isAdding && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-card w-full max-w-md rounded-3xl p-8 shadow-2xl border border-border"
          >
            <h2 className="text-2xl font-bold mb-6">New Subject</h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              {subjectFormError && (
                <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-500 flex items-start gap-3 text-sm font-bold">
                  <AlertCircle size={18} className="shrink-0 mt-0.5" />
                  <span>{subjectFormError}</span>
                </div>
              )}
              <div>
                <label className="block text-sm font-bold mb-2 uppercase text-muted-foreground">Subject Name</label>
                <input
                  autoFocus
                  type="text"
                  value={newSubject.name}
                  onChange={e => {
                    setSubjectFormError(null);
                    setNewSubject({ ...newSubject, name: e.target.value });
                  }}
                  className="w-full bg-muted border-none rounded-2xl p-4 focus:ring-2 focus:ring-primary outline-none"
                  placeholder="e.g. Data Structures"
                />
              </div>
              <div>
                <label className="block text-sm font-bold mb-2 uppercase text-muted-foreground">Credit Hours</label>
                <input
                  type="number"
                  step="0.5"
                  value={newSubject.creditHours}
                  onChange={e => setNewSubject({ ...newSubject, creditHours: parseFloat(e.target.value) })}
                  className="w-full bg-muted border-none rounded-2xl p-4 focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold mb-2 uppercase text-muted-foreground">Color Tag</label>
                <div className="flex flex-wrap gap-3">
                  {COLORS.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewSubject({ ...newSubject, colorTag: color })}
                      className={cn(
                        "w-8 h-8 rounded-full transition-transform",
                        newSubject.colorTag === color ? "scale-125 ring-2 ring-offset-2 ring-primary" : "hover:scale-110"
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setSubjectFormError(null);
                    setIsAdding(false);
                  }}
                  className="flex-1 py-4 rounded-2xl font-bold text-muted-foreground hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-4 bg-primary text-white rounded-2xl font-bold hover:shadow-lg transition-all"
                >
                  Create
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Edit Subject Modal */}
      {editingSubject && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-card w-full max-w-md rounded-3xl p-8 shadow-2xl border border-border"
          >
            <h2 className="text-2xl font-bold mb-6">Edit Subject</h2>
            <form onSubmit={handleEditSubjectSubmit} className="space-y-6">
              {subjectFormError && (
                <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-500 flex items-start gap-3 text-sm font-bold">
                  <AlertCircle size={18} className="shrink-0 mt-0.5" />
                  <span>{subjectFormError}</span>
                </div>
              )}
              <div>
                <label className="block text-sm font-bold mb-2 uppercase text-muted-foreground">Subject Name</label>
                <input
                  autoFocus
                  type="text"
                  value={editingSubject.name}
                  onChange={e => {
                    setSubjectFormError(null);
                    setEditingSubject({ ...editingSubject, name: e.target.value });
                  }}
                  className="w-full bg-muted border-none rounded-2xl p-4 focus:ring-2 focus:ring-primary outline-none"
                  placeholder="e.g. Data Structures"
                />
              </div>
              <div>
                <label className="block text-sm font-bold mb-2 uppercase text-muted-foreground">Credit Hours</label>
                <input
                  type="number"
                  step="0.5"
                  value={editingSubject.creditHours}
                  onChange={e =>
                    setEditingSubject({ ...editingSubject, creditHours: parseFloat(e.target.value) })
                  }
                  className="w-full bg-muted border-none rounded-2xl p-4 focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold mb-2 uppercase text-muted-foreground">Color Tag</label>
                <div className="flex flex-wrap gap-3">
                  {COLORS.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setEditingSubject({ ...editingSubject, colorTag: color })}
                      className={cn(
                        "w-8 h-8 rounded-full transition-transform",
                        editingSubject.colorTag === color ? "scale-125 ring-2 ring-offset-2 ring-primary" : "hover:scale-110"
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setSubjectFormError(null);
                    setEditingSubject(null);
                  }}
                  className="flex-1 py-4 rounded-2xl font-bold text-muted-foreground hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-4 bg-primary text-white rounded-2xl font-bold hover:shadow-lg transition-all"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Delete Subject Confirmation Modal */}
      <AnimatePresence>
        {subjectToDelete && (
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
              <h2 className="text-xl font-bold mb-2">Delete Subject?</h2>
              <p className="text-muted-foreground mb-6">
                Delete this subject and all its marks? This action cannot be undone.
              </p>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setSubjectToDelete(null)}
                  className="flex-1 py-3 rounded-2xl font-bold text-muted-foreground hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    deleteSubject(subjectToDelete);
                    setSubjectToDelete(null);
                  }}
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
