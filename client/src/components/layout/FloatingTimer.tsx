import { useState, useEffect } from "react";
import { Play, Pause, X, Bell, Layers, ChevronDown, Plus } from "lucide-react";
import { useTimer, ActiveTimerData } from "@/hooks/useTimer";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

export function FloatingTimer() {
  const { activeTimers } = useTimer();
  const [isGlobalExpanded, setIsGlobalExpanded] = useState(false);
  const [previousLength, setPreviousLength] = useState(0);

  useEffect(() => {
    // Auto-expand if a new timer is added
    if (activeTimers.length > previousLength) {
      setIsGlobalExpanded(true);
    }
    setPreviousLength(activeTimers.length);
  }, [activeTimers.length, previousLength]);

  if (activeTimers.length === 0) {
    return null;
  }

  const runningCount = activeTimers.filter(t => t.isRunning).length;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3 drop-shadow-2xl">
      {/* Expanded Stack */}
      <div 
        className={cn(
          "flex flex-col items-end gap-3 transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] origin-bottom-right",
          isGlobalExpanded ? "scale-100 opacity-100 translate-y-0" : "scale-90 opacity-0 translate-y-8 pointer-events-none absolute bottom-16 right-0"
        )}
      >
        {activeTimers.map((timerData) => (
          <TimerBubble key={timerData.timer.id} data={timerData} />
        ))}
      </div>

      {/* Global Toggle Button */}
      <div
        onClick={() => setIsGlobalExpanded(!isGlobalExpanded)}
        className={cn(
          "bg-black text-white rounded-full overflow-hidden cursor-pointer relative transition-[width,height,border-color,background-color] duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ring-1 hover:ring-white/30 flex items-center justify-center",
          isGlobalExpanded ? "w-12 h-12 ring-white/20 bg-slate-900" : "w-[140px] h-[40px] ring-white/10"
        )}
      >
        {/* Expanded: Just an arrow to collapse */}
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center transition-opacity duration-300",
            isGlobalExpanded ? "opacity-100 delay-200" : "opacity-0 pointer-events-none"
          )}
        >
          <ChevronDown className="w-5 h-5 text-slate-400" />
        </div>

        {/* Collapsed: Summary View */}
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-between px-4 transition-opacity duration-300",
            !isGlobalExpanded ? "opacity-100 delay-200" : "opacity-0 pointer-events-none"
          )}
        >
           <div className="flex items-center gap-2">
             <Layers className={cn("w-4 h-4", runningCount > 0 ? "text-orange-500" : "text-slate-400")} />
             <span className="font-semibold text-sm">{activeTimers.length} Tasks</span>
           </div>
           {runningCount > 0 && (
             <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
           )}
        </div>
      </div>
    </div>
  );
}

function TimerBubble({ data }: { data: ActiveTimerData }) {
  const { stopTimer, pauseTimer, resumeTimer, updateTimerSettings, addTime, formatTime } = useTimer();
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasShown, setHasShown] = useState(false);
  const queryClient = useQueryClient();

  const { timer, timeLeft, isRunning } = data;

  useEffect(() => {
    if (!hasShown) {
      setIsExpanded(true);
      setHasShown(true);
      const t = setTimeout(() => setIsExpanded(false), 3000);
      return () => clearTimeout(t);
    }
  }, [hasShown]);

  const { data: task } = useQuery<any>({
    queryKey: [`/api/tasks/${timer.taskId}`],
    enabled: !!timer.taskId,
  });

  // Sync Timer when task estimatedMinutes changes
  useEffect(() => {
    if (task && task.estimatedMinutes !== undefined) {
      const expectedSeconds = task.estimatedMinutes ? task.estimatedMinutes * 60 : 0;
      if (timer.durationSeconds !== expectedSeconds) {
        updateTimerSettings(timer.id, task.estimatedMinutes);
      }
    }
  }, [task?.estimatedMinutes, timer.id, timer.durationSeconds, updateTimerSettings]);

  const title = task?.title || "Focus Timer";
  const estimatedEndTime = timer.isCountDown && timeLeft > 0 
    ? new Date(Date.now() + timeLeft * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  const isFinished = timer.isCountDown && timeLeft === 0;

  useEffect(() => {
    if (isFinished) {
      const audio = new Audio("https://cdn.freesound.org/previews/320/320181_527080-lq.mp3");
      audio.volume = 0.8;
      audio.play().catch(e => console.error("Audio play failed:", e));
    }
  }, [isFinished]);

  const handleAddTime = (minutes: number) => {
    addTime(timer.id, minutes);
    if (task) {
      const newEstimatedMinutes = (task.estimatedMinutes || 0) + minutes;
      apiRequest("PUT", `/api/tasks/${task.id}`, { estimatedMinutes: newEstimatedMinutes }).then(() => {
        queryClient.invalidateQueries({ queryKey: [`/api/tasks/${task.id}`] });
        queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      });
    }
  };

  return (
    <div
      className={cn(
        "text-white rounded-[32px] overflow-hidden cursor-pointer relative transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ring-offset-0",
        isFinished ? "bg-red-950 ring-2 ring-red-500 animate-[pulse_1.5s_ease-in-out_infinite]" : "bg-black",
        isExpanded ? "w-[340px] h-[110px]" : "w-[130px] h-[36px]",
        !isFinished && (isExpanded ? "ring-2 ring-orange-500" : "ring-1 ring-white/10 hover:ring-white/20")
      )}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <div className="relative w-full h-full">
        {/* Collapsed State */}
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-between px-3 transition-opacity duration-300",
            isExpanded ? "opacity-0 pointer-events-none" : "opacity-100 delay-200"
          )}
        >
           <div className={cn("w-4 h-4 rounded-full border-2 border-t-transparent", isRunning ? "border-orange-500 animate-spin" : isFinished ? "border-red-500" : "border-slate-500")} />
           <span className={cn("font-mono font-semibold text-sm", isRunning ? "text-orange-500" : isFinished ? "text-red-500" : "text-slate-400")}>{formatTime(timeLeft)}</span>
        </div>

        {/* Expanded State */}
        <div
          className={cn(
            "absolute inset-0 p-4 flex items-center justify-between transition-opacity duration-300",
            isExpanded ? "opacity-100 delay-200" : "opacity-0 pointer-events-none"
          )}
        >
           {/* Left: Pause/Play Button OR +5m/+10m */}
           <div className="flex flex-col gap-1 w-[60px] shrink-0">
             {isFinished ? (
               <>
                 <button
                   onClick={(e) => { e.stopPropagation(); handleAddTime(5); }}
                   className="w-full h-[28px] rounded-full bg-red-900/50 flex items-center justify-center hover:bg-red-800 transition-colors border border-red-500/30 text-[10px] font-bold text-red-200"
                 >
                   +5m
                 </button>
                 <button
                   onClick={(e) => { e.stopPropagation(); handleAddTime(10); }}
                   className="w-full h-[28px] rounded-full bg-red-900/50 flex items-center justify-center hover:bg-red-800 transition-colors border border-red-500/30 text-[10px] font-bold text-red-200"
                 >
                   +10m
                 </button>
               </>
             ) : (
               <button
                 onClick={(e) => {
                   e.stopPropagation();
                   isRunning ? pauseTimer(timer.id) : resumeTimer(timer.id);
                 }}
                 className="w-[60px] h-[60px] rounded-full bg-[#2A2A2A] flex items-center justify-center hover:bg-[#333] transition-colors"
               >
                 {isRunning ? (
                   <Pause className="w-8 h-8 text-white fill-white" />
                 ) : (
                   <Play className="w-8 h-8 text-white fill-white ml-1" />
                 )}
               </button>
             )}
           </div>

           {/* Center: Info */}
           <div className="flex flex-col items-center justify-center flex-1 px-2 pt-1">
              {isFinished ? (
                <div className="flex items-center gap-1.5 text-red-400 text-[10px] font-bold mb-0.5 uppercase tracking-widest animate-pulse">
                  <Bell className="w-3 h-3" />
                  <span>Time's Up</span>
                </div>
              ) : estimatedEndTime ? (
                <div className="flex items-center gap-1.5 text-[#888] text-[10px] font-medium mb-0.5">
                  <Bell className="w-3 h-3" />
                  <span>{estimatedEndTime}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-[#888] text-[10px] font-medium mb-0.5">
                  <div className={cn("w-1.5 h-1.5 rounded-full", isRunning ? "bg-green-500 animate-pulse" : "bg-slate-500")} />
                  <span>{isRunning ? "Tracking Time" : "Paused"}</span>
                </div>
              )}
              <div className="flex items-center justify-center gap-3 mb-1">
                <button 
                  onClick={(e) => { e.stopPropagation(); handleAddTime(-5); }}
                  className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-[#888] hover:text-white hover:bg-white/10 transition-colors text-xs font-bold"
                  title="-5 Minutes"
                >
                  -5
                </button>
                <div className={cn("font-mono text-[40px] font-bold tracking-tighter leading-none", isFinished ? "text-red-100" : "")}>
                  {formatTime(timeLeft)}
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleAddTime(5); }}
                  className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-[#888] hover:text-white hover:bg-white/10 transition-colors text-xs font-bold"
                  title="+5 Minutes"
                >
                  +5
                </button>
              </div>
              <div className={cn("text-xs font-medium truncate max-w-[140px] text-center", isFinished ? "text-red-300" : "text-[#888]")}>
                {title}
              </div>
           </div>

           {/* Right: Stop (X) Button */}
           <button
             onClick={(e) => {
               e.stopPropagation();
               stopTimer(timer.id);
             }}
             className="w-[60px] h-[60px] rounded-full bg-[#3D1D1D] flex items-center justify-center hover:bg-[#4A2222] transition-colors shrink-0"
           >
             <X className="w-8 h-8 text-[#FF453A]" strokeWidth={3} />
           </button>
        </div>
      </div>
    </div>
  );
}
