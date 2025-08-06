import { useState } from "react";
import { Play, Pause, Square } from "lucide-react";
import { useTimer } from "@/hooks/useTimer";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function FloatingTimer() {
  const { activeTimer, timeLeft, isRunning, startTimer, stopTimer, pauseTimer, resumeTimer, formatTime } = useTimer();
  const [isExpanded, setIsExpanded] = useState(false);

  if (!activeTimer && timeLeft === 0) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={() => startTimer()}
          className="rounded-full h-14 w-14 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-lg"
        >
          <Play className="h-6 w-6" />
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <GlassCard
        className={cn(
          "p-4 cursor-pointer transition-all duration-300 animate-float",
          isExpanded ? "w-80" : "w-auto"
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center text-white font-mono font-bold text-sm">
            {formatTime(timeLeft)}
          </div>
          
          {isExpanded && (
            <div className="flex-1 animate-fade-in">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                {activeTimer?.taskId ? "Task Timer" : "Focus Timer"}
              </p>
              <div className="w-full h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mt-1">
                <div 
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-1000"
                  style={{ 
                    width: `${((activeTimer?.duration || 1500) - timeLeft) / (activeTimer?.duration || 1500) * 100}%` 
                  }}
                />
              </div>
              
              <div className="flex space-x-2 mt-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    isRunning ? pauseTimer() : resumeTimer();
                  }}
                  className="flex-1"
                >
                  {isRunning ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    stopTimer();
                  }}
                  className="flex-1"
                >
                  <Square className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </GlassCard>
    </div>
  );
}
