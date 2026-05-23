import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export interface TimerState {
  id: string;
  userId: string;
  taskId: string | null;
  agencyId: string | null;
  startTime: Date;
  endTime: Date | null;
  durationSeconds: number;
  isCountDown: boolean;
  isActive: boolean;
  hasAlerted?: boolean;
  accumulatedSeconds: number;
  createdAt: Date;
}

export interface ActiveTimerData {
  timer: TimerState;
  timeLeft: number;
  isRunning: boolean;
}

// Global event emitter to sync state across hooks in the same window
class TimerEmitter extends EventTarget {
  emitChange() {
    this.dispatchEvent(new Event("change"));
  }
}
const timerEmitter = new TimerEmitter();

const STORAGE_KEY = "mngm_active_timers";

export function useTimer() {
  const { userProfile } = useAuth();
  const [activeTimers, setActiveTimers] = useState<ActiveTimerData[]>([]);
  const { toast } = useToast();

  // Load timer from storage
  const loadTimers = useCallback(() => {
    if (!userProfile) return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsedTimers = JSON.parse(stored) as any[];
        const validTimers: ActiveTimerData[] = [];
        
        const now = new Date();
        for (const data of parsedTimers) {
          if (data.userId === userProfile.id) {
            const timer: TimerState = {
              ...data,
              startTime: new Date(data.startTime),
              endTime: data.endTime ? new Date(data.endTime) : null,
              createdAt: new Date(data.createdAt),
              accumulatedSeconds: data.accumulatedSeconds || 0,
            };
            
            const isCD = timer.isCountDown ?? (timer.durationSeconds > 0);
            
            let elapsed = timer.accumulatedSeconds;
            if (timer.isActive) {
               elapsed += Math.floor((now.getTime() - timer.startTime.getTime()) / 1000);
            }
            
            const currentVal = isCD ? Math.max(0, timer.durationSeconds - elapsed) : elapsed;
            
            validTimers.push({
              timer,
              timeLeft: currentVal,
              isRunning: timer.isActive && (isCD ? currentVal > 0 : true),
            });
          }
        }
        setActiveTimers(validTimers);
        return;
      }
      setActiveTimers([]);
    } catch (e) {
      console.error("Error loading timers from local storage", e);
    }
  }, [userProfile]);

  // Sync with storage on mount and changes
  useEffect(() => {
    loadTimers();
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) loadTimers();
    };
    const handleLocalChange = () => loadTimers();
    
    window.addEventListener("storage", handleStorage);
    timerEmitter.addEventListener("change", handleLocalChange);
    
    return () => {
      window.removeEventListener("storage", handleStorage);
      timerEmitter.removeEventListener("change", handleLocalChange);
    };
  }, [loadTimers]);

  // Timer interval
  const hasRunning = activeTimers.some(t => t.isRunning);
  useEffect(() => {
    if (!hasRunning) return;

    const interval = setInterval(() => {
      setActiveTimers((prev) => prev.map(t => {
        if (!t.isRunning) return t;
        
        let newTimeLeft = t.timer.isCountDown ? t.timeLeft - 1 : t.timeLeft + 1;
        let newIsRunning = true;
        
        if (t.timer.isCountDown && newTimeLeft <= 0) {
           newTimeLeft = 0;
           newIsRunning = false;
        }
        
        return { ...t, timeLeft: newTimeLeft, isRunning: newIsRunning };
      }));
    }, 1000);
    return () => clearInterval(interval);
  }, [hasRunning]);

  // Audio and Toast Alerts
  useEffect(() => {
    activeTimers.forEach((t) => {
      if (t.timer.isCountDown && t.timeLeft === 0 && !t.timer.hasAlerted) {
        // Play Audio
        const audio = new Audio("https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg");
        audio.play().catch(console.error);

        // Show Toast
        toast({
          title: "Timer Finished!",
          description: "Your countdown has ended.",
        });

        // Update Storage to mark as alerted
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const currentTimers: TimerState[] = JSON.parse(stored);
          const updatedTimers = currentTimers.map(ct => ct.id === t.timer.id ? { ...ct, hasAlerted: true } : ct);
          saveTimers(updatedTimers);
        }
      }
    });
  }, [activeTimers, toast]);

  const saveTimers = (timers: TimerState[]) => {
    if (timers.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(timers));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    timerEmitter.emitChange();
  };

  const startTimer = useCallback(async (taskId?: string, estimatedMinutes?: number | null) => {
    if (!userProfile) return;

    // Load fresh timers to avoid overriding
    const stored = localStorage.getItem(STORAGE_KEY);
    let currentTimers: TimerState[] = stored ? JSON.parse(stored) : [];
    
    // Prevent starting duplicate timers for the same task
    if (taskId && currentTimers.some(t => t.taskId === taskId)) {
      return; // A timer for this task already exists
    }

    const isCD = !!estimatedMinutes && estimatedMinutes > 0;
    const durationSeconds = isCD ? estimatedMinutes * 60 : 0;

    const timer: TimerState = {
      id: crypto.randomUUID(),
      userId: userProfile.id,
      taskId: taskId ?? null,
      agencyId: userProfile.agencyId ?? null,
      startTime: new Date(),
      endTime: null,
      durationSeconds,
      isCountDown: isCD,
      isActive: true,
      accumulatedSeconds: 0,
      createdAt: new Date(),
    };
    
    currentTimers.push(timer);
    saveTimers(currentTimers);

    if (taskId) {
      apiRequest("POST", `/api/tasks/${taskId}/activities`, {
        eventType: "TIMER_STARTED",
        newState: "Started",
      }).catch(console.error);
    }
  }, [userProfile]);

  const stopTimer = useCallback(async (timerId: string) => {
    if (!userProfile) return;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    
    const currentTimers: TimerState[] = JSON.parse(stored);
    const targetTimer = currentTimers.find(t => t.id === timerId);
    
    if (targetTimer) {
      const elapsed = targetTimer.isActive 
        ? Math.floor((new Date().getTime() - new Date(targetTimer.startTime).getTime()) / 1000)
        : 0;
      const totalSeconds = (targetTimer.accumulatedSeconds || 0) + elapsed;

      if (targetTimer.taskId && totalSeconds > 0) {
        // Save TimeEntry
        apiRequest("POST", "/api/time-entries", {
          taskId: targetTimer.taskId,
          durationSeconds: totalSeconds,
          startTime: new Date(targetTimer.createdAt).toISOString(),
          endTime: new Date().toISOString(),
          description: "Time logged from timer",
        }).catch(console.error);

        // TimeEntry backend route already logs the formatted activity summary
      }
    }

    const updatedTimers = currentTimers.filter(t => t.id !== timerId);
    saveTimers(updatedTimers);
  }, [userProfile]);

  const pauseTimer = useCallback((timerId: string) => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    
    const currentTimers: TimerState[] = JSON.parse(stored);
    const updatedTimers = currentTimers.map(t => {
      if (t.id === timerId && t.isActive) {
        const elapsed = Math.floor((new Date().getTime() - new Date(t.startTime).getTime()) / 1000);
        
        if (t.taskId) {
          apiRequest("POST", `/api/tasks/${t.taskId}/activities`, {
            eventType: "TIMER_PAUSED",
            newState: "Paused",
          }).catch(console.error);
        }

        return {
          ...t,
          isActive: false,
          accumulatedSeconds: (t.accumulatedSeconds || 0) + elapsed
        };
      }
      return t;
    });
    saveTimers(updatedTimers);
  }, []);

  const resumeTimer = useCallback((timerId: string) => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    
    const currentTimers: TimerState[] = JSON.parse(stored);
    const updatedTimers = currentTimers.map(t => {
      if (t.id === timerId && !t.isActive) {
        if (t.taskId) {
          apiRequest("POST", `/api/tasks/${t.taskId}/activities`, {
            eventType: "TIMER_RESUMED",
            newState: "Resumed",
          }).catch(console.error);
        }
        return {
          ...t,
          isActive: true,
          startTime: new Date(),
        };
      }
      return t;
    });
    saveTimers(updatedTimers);
  }, []);

  const updateTimerSettings = useCallback((timerId: string, estimatedMinutes: number | null) => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    
    const currentTimers: TimerState[] = JSON.parse(stored);
    const updatedTimers = currentTimers.map(t => {
      if (t.id === timerId) {
        const isCD = !!estimatedMinutes && estimatedMinutes > 0;
        const durationSeconds = isCD ? estimatedMinutes * 60 : 0;
        return {
          ...t,
          isCountDown: isCD,
          durationSeconds,
          hasAlerted: false, // Reset alert so it can trigger again if time increases
        };
      }
      return t;
    });
    saveTimers(updatedTimers);
  }, []);

  const addTime = useCallback((timerId: string, extraMinutes: number) => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    
    const currentTimers: TimerState[] = JSON.parse(stored);
    const updatedTimers = currentTimers.map(t => {
      if (t.id === timerId) {
        const extraSeconds = extraMinutes * 60;
        return {
          ...t,
          durationSeconds: t.durationSeconds + extraSeconds,
          hasAlerted: false,
          isActive: true, // Auto resume when time is added
          startTime: t.isActive ? t.startTime : new Date()
        };
      }
      return t;
    });
    saveTimers(updatedTimers);
  }, []);

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return {
    activeTimers,
    startTimer,
    stopTimer,
    pauseTimer,
    resumeTimer,
    updateTimerSettings,
    addTime,
    formatTime,
  };
}
