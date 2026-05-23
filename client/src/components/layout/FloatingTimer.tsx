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
          className="rounded-full h-14 w-14 shadow-lg"
          size="icon"
        >
          <Play className="h-5 w-5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <GlassCard
        className={cn(
          "p-4 cursor-pointer transition-all duration-300",
          isExpanded ? "w-72" : "w-auto"
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-mono font-semibold text-xs shrink-0">
            {formatTime(timeLeft)}
          </div>

          {isExpanded && (
            <div className="flex-1 animate-fade-in min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {activeTimer?.taskId ? "Task Timer" : "Focus Timer"}
              </p>
              <div className="w-full h-1 bg-muted rounded-full overflow-hidden mt-1.5">
                <div
                  className="h-full bg-primary transition-all duration-1000"
                  style={{
                    width: `${((activeTimer?.durationSeconds || 1500) - timeLeft) / (activeTimer?.durationSeconds || 1500) * 100}%`,
                  }}
                />
              </div>

              <div className="flex gap-2 mt-2.5">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    isRunning ? pauseTimer() : resumeTimer();
                  }}
                  className="flex-1 h-7"
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
                  className="flex-1 h-7"
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
