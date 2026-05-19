import { useState, useEffect, useCallback } from "react";
import { collection, addDoc, query, where, orderBy, limit, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";

interface TimerState {
  id: string;
  userId: string;
  taskId: string | null;
  agencyId: string | null;
  startTime: Date;
  endTime: Date | null;
  durationSeconds: number;
  isActive: boolean;
  createdAt: Date;
}

interface InsertTimerState {
  userId: string;
  taskId: string | null;
  agencyId: string | null;
  startTime: Date;
  endTime: Date | null;
  durationSeconds: number;
  isActive: boolean;
}

export function useTimer() {
  const { userProfile } = useAuth();
  const [activeTimer, setActiveTimer] = useState<TimerState | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    if (!userProfile || !db) return;

    const loadActiveTimer = async () => {
      try {
        const q = query(
          collection(db!, "timers"),
          where("userId", "==", userProfile.id),
          where("isActive", "==", true),
          orderBy("createdAt", "desc"),
          limit(1)
        );

        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const timerDoc = querySnapshot.docs[0];
          const data = timerDoc.data();
          const timerData: TimerState = {
            id: timerDoc.id,
            userId: data.userId,
            taskId: data.taskId ?? null,
            agencyId: data.agencyId ?? null,
            startTime: data.startTime?.toDate() ?? new Date(),
            endTime: data.endTime?.toDate() ?? null,
            durationSeconds: data.durationSeconds ?? 1500,
            isActive: data.isActive ?? true,
            createdAt: data.createdAt?.toDate() ?? new Date(),
          };

          setActiveTimer(timerData);

          const now = new Date();
          const elapsed = Math.floor((now.getTime() - timerData.startTime.getTime()) / 1000);
          const remaining = Math.max(0, timerData.durationSeconds - elapsed);

          setTimeLeft(remaining);
          setIsRunning(remaining > 0);
        }
      } catch (error) {
        console.error("Error loading active timer:", error);
      }
    };

    loadActiveTimer();
  }, [userProfile]);

  useEffect(() => {
    if (!isRunning || timeLeft <= 0) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setIsRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, timeLeft]);

  const startTimer = useCallback(
    async (taskId?: string, durationSeconds: number = 1500) => {
      if (!userProfile || !db) return;

      try {
        const timerData: InsertTimerState = {
          userId: userProfile.id,
          taskId: taskId ?? null,
          agencyId: userProfile.agencyId ?? null,
          startTime: new Date(),
          endTime: null,
          durationSeconds,
          isActive: true,
        };

        const docRef = await addDoc(collection(db!, "timers"), {
          ...timerData,
          createdAt: new Date(),
        });

        const newTimer: TimerState = {
          ...timerData,
          id: docRef.id,
          createdAt: new Date(),
        };

        setActiveTimer(newTimer);
        setTimeLeft(durationSeconds);
        setIsRunning(true);
      } catch (error) {
        console.error("Error starting timer:", error);
      }
    },
    [userProfile]
  );

  const stopTimer = useCallback(async () => {
    if (!activeTimer || !userProfile || !db) return;

    try {
      const endTime = new Date();
      const actualDuration = Math.floor((endTime.getTime() - activeTimer.startTime.getTime()) / 1000);

      await updateDoc(doc(db!, "timers", activeTimer.id), {
        endTime,
        durationSeconds: actualDuration,
        isActive: false,
      });

      setActiveTimer(null);
      setTimeLeft(0);
      setIsRunning(false);
    } catch (error) {
      console.error("Error stopping timer:", error);
    }
  }, [activeTimer, userProfile]);

  const pauseTimer = useCallback(() => {
    setIsRunning(false);
  }, []);

  const resumeTimer = useCallback(() => {
    if (timeLeft > 0) {
      setIsRunning(true);
    }
  }, [timeLeft]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return {
    activeTimer,
    timeLeft,
    isRunning,
    startTimer,
    stopTimer,
    pauseTimer,
    resumeTimer,
    formatTime,
  };
}
