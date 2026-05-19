import { useState, useEffect, useCallback } from "react";
import { collection, addDoc, query, where, orderBy, limit, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { Timer, InsertTimer } from "@shared/schema";

export function useTimer() {
  const { userProfile } = useAuth();
  const [activeTimer, setActiveTimer] = useState<Timer | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isRunning, setIsRunning] = useState(false);

  // Load active timer on mount
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
          const timerData = {
            ...timerDoc.data(),
            id: timerDoc.id,
            startTime: timerDoc.data().startTime?.toDate(),
            endTime: timerDoc.data().endTime?.toDate(),
            createdAt: timerDoc.data().createdAt?.toDate(),
          } as Timer;
          
          setActiveTimer(timerData);
          
          // Calculate remaining time
          const now = new Date();
          const elapsed = Math.floor((now.getTime() - timerData.startTime.getTime()) / 1000);
          const duration = timerData.duration || 1500;
          const remaining = Math.max(0, duration - elapsed);
          
          setTimeLeft(remaining);
          setIsRunning(remaining > 0);
        }
      } catch (error) {
        console.error("Error loading active timer:", error);
      }
    };

    loadActiveTimer();
  }, [userProfile]);

  // Timer countdown effect
  useEffect(() => {
    if (!isRunning || timeLeft <= 0) return;

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setIsRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, timeLeft]);

  const startTimer = useCallback(async (taskId?: string, duration: number = 1500) => {
    if (!userProfile || !db) return;

    try {
      const timerData: InsertTimer = {
        userId: userProfile.id,
        taskId: taskId || null,
        startTime: new Date(),
        endTime: null,
        duration,
        isActive: true,
        workspaceId: userProfile.workspaceId,
      };

      const docRef = await addDoc(collection(db!, "timers"), {
        ...timerData,
        createdAt: new Date(),
      });

      const newTimer: Timer = {
        ...timerData,
        id: docRef.id,
        endTime: null,
        createdAt: new Date(),
      };

      setActiveTimer(newTimer);
      setTimeLeft(duration);
      setIsRunning(true);
    } catch (error) {
      console.error("Error starting timer:", error);
    }
  }, [userProfile]);

  const stopTimer = useCallback(async () => {
    if (!activeTimer || !userProfile || !db) return;

    try {
      const endTime = new Date();
      const actualDuration = Math.floor((endTime.getTime() - activeTimer.startTime.getTime()) / 1000);

      await updateDoc(doc(db!, "timers", activeTimer.id), {
        endTime,
        duration: actualDuration,
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
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return {
    activeTimer,
    timeLeft,
    isRunning,
    startTimer,
    stopTimer,
    pauseTimer,
    resumeTimer,
    formatTime
  };
}
