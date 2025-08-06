import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Task {
  id: string;
  title: string;
  assignee: string;
  dueTime: string;
  priority: "low" | "medium" | "high" | "urgent";
}

const priorityColors = {
  low: "bg-green-500",
  medium: "bg-yellow-500", 
  high: "bg-orange-500",
  urgent: "bg-red-500"
};

export function RecentTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    // TODO: Fetch real tasks from Firebase
    // For now showing placeholder data
    setTasks([
      {
        id: "1",
        title: "Review marketing campaign wireframes",
        assignee: "Sarah Wilson",
        dueTime: "2h",
        priority: "urgent"
      },
      {
        id: "2", 
        title: "Update client presentation slides",
        assignee: "Mike Chen",
        dueTime: "4h",
        priority: "high"
      },
      {
        id: "3",
        title: "Code review for new features",
        assignee: "You",
        dueTime: "1d",
        priority: "medium"
      }
    ]);
  }, []);

  return (
    <GlassCard className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
          Recent Tasks
        </h3>
        <Button variant="ghost" size="sm" className="text-indigo-500 hover:text-indigo-600 p-0">
          View All
        </Button>
      </div>
      
      <div className="space-y-3">
        {tasks.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">No recent tasks</p>
          </div>
        ) : (
          tasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center space-x-3 p-3 rounded-lg hover:bg-white/10 transition-colors duration-200 cursor-pointer group"
            >
              <div className={cn("w-2 h-2 rounded-full", priorityColors[task.priority])} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                  {task.title}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Assigned to {task.assignee}
                </p>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center space-x-1">
                <Clock className="h-3 w-3" />
                <span>{task.dueTime}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </GlassCard>
  );
}
