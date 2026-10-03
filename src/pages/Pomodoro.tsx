import React from 'react';
import { useApp } from '../context/AppContext';
import { Play, Pause, RotateCcw, Coffee, Brain } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

export const Pomodoro = () => {
  const [timeLeft, setTimeLeft] = React.useState(25 * 60);
  const [isActive, setIsActive] = React.useState(false);
  const [isBreak, setIsBreak] = React.useState(false);

  React.useEffect(() => {
    let interval: any = null;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((time) => time - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsActive(false);
      const nextMode = !isBreak;
      setIsBreak(nextMode);
      setTimeLeft(nextMode ? 5 * 60 : 25 * 60);
      // Play sound or notification here
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft, isBreak]);

  const toggleTimer = () => setIsActive(!isActive);
  const resetTimer = () => {
    setIsActive(false);
    setIsBreak(false);
    setTimeLeft(25 * 60);
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="max-w-2xl mx-auto space-y-8 text-center">
      <header>
        <h1 className="text-3xl font-bold">Focus Timer</h1>
        <p className="text-muted-foreground">Boost your productivity with Pomodoro</p>
      </header>

      <div className="m3-card py-16 space-y-12 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-muted">
          <motion.div 
            className="h-full bg-primary"
            initial={{ width: '0%' }}
            animate={{ width: `${((isBreak ? 5 * 60 : 25 * 60) - timeLeft) / (isBreak ? 5 * 60 : 25 * 60) * 100}%` }}
          />
        </div>

        <div className="flex justify-center gap-4">
          <div className={cn(
            "px-6 py-2 rounded-full font-bold flex items-center gap-2 transition-colors",
            !isBreak ? "bg-primary text-white" : "bg-muted text-muted-foreground"
          )}>
            <Brain size={18} />
            Work Session
          </div>
          <div className={cn(
            "px-6 py-2 rounded-full font-bold flex items-center gap-2 transition-colors",
            isBreak ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"
          )}>
            <Coffee size={18} />
            Short Break
          </div>
        </div>

        <div className="text-8xl md:text-9xl font-mono font-black tracking-tighter text-primary">
          {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
        </div>

        <div className="flex justify-center gap-6">
          <button
            onClick={resetTimer}
            className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <RotateCcw size={24} />
          </button>
          <button
            onClick={toggleTimer}
            className="w-24 h-24 rounded-full bg-primary text-white flex items-center justify-center hover:shadow-2xl hover:scale-105 transition-all"
          >
            {isActive ? <Pause size={32} /> : <Play size={32} className="ml-1" />}
          </button>
          <div className="w-16" /> {/* Spacer for symmetry */}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="m3-card p-4">
          <p className="text-xs font-bold text-muted-foreground uppercase">Sessions Today</p>
          <p className="text-2xl font-bold">4</p>
        </div>
        <div className="m3-card p-4">
          <p className="text-xs font-bold text-muted-foreground uppercase">Focus Time</p>
          <p className="text-2xl font-bold">1h 40m</p>
        </div>
        <div className="m3-card p-4">
          <p className="text-xs font-bold text-muted-foreground uppercase">Daily Goal</p>
          <p className="text-2xl font-bold">80%</p>
        </div>
      </div>
    </div>
  );
};
