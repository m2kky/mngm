import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock } from "lucide-react";
import { Link } from "wouter";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useDetailPanel } from "@/components/detail/DetailPanel";
import type { Task } from "@shared/schema";

const priorityColors: Record<string, string> = {
  LOW: "bg-green-500",
  MEDIUM: "bg-yellow-500",
  HIGH: "bg-orange-500",
  URGENT: "bg-red-500",
};

function relativeDue(due: string | Date | null) {
  if (!due) return "—";
  const d = new Date(due).getTime();
  const diff = d - Date.now();
  const abs = Math.abs(diff);
  const day = 86_400_000;
  if (abs < day) return diff >= 0 ? `${Math.max(1, Math.round(abs / 3_600_000))}h` : "overdue";
  return `${Math.round(abs / day)}d${diff < 0 ? " ago" : ""}`;
}

export function RecentTasks() {
  const { currentUser } = useAuth();
  const agencyId = currentUser?.agencyId ?? "";
  const { open: openDetail } = useDetailPanel();

  const { data: allTasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ["/api/tasks", { agencyId }],
    queryFn: async () => {
      const token = localStorage.getItem("wk_token") ?? "";
      const res = await fetch(`/api/tasks?agencyId=${encodeURIComponent(agencyId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load tasks");
      return res.json();
    },
    enabled: !!agencyId,
  });

  const tasks = useMemo(() => {
    return [...allTasks]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }, [allTasks]);

  return (
    <GlassCard className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
          Recent Tasks
        </h3>
        <Button asChild variant="ghost" size="sm" className="text-indigo-500 hover:text-indigo-600 p-0">
          <Link href="/tasks">View All</Link>
        </Button>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <div className="text-center py-8">
            <Clock className="h-8 w-8 text-gray-400 mx-auto mb-2 animate-pulse" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">No recent tasks</p>
          </div>
        ) : (
          tasks.map((task) => (
            <div
              key={task.id}
              role="button"
              tabIndex={0}
              onClick={() => openDetail("task", task.id)}
              onKeyDown={(e) => { if (e.key === "Enter") openDetail("task", task.id); }}
              data-testid={`recent-task-${task.id}`}
              className="flex items-center space-x-3 p-3 rounded-lg hover:bg-white/10 transition-colors duration-200 cursor-pointer group"
            >
              <div className={cn("w-2 h-2 rounded-full", priorityColors[task.priority] ?? "bg-gray-400")} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                  {task.title}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                  {task.type?.toString().replace(/_/g, " ").toLowerCase() ?? ""}
                </p>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center space-x-1">
                <Clock className="h-3 w-3" />
                <span>{relativeDue(task.dueDate)}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </GlassCard>
  );
}
