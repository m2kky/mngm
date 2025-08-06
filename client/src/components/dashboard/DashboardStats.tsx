import { useEffect, useState } from "react";
import { CheckSquare, Users, CheckCircle, Clock } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string;
  change: string;
  changeType: "positive" | "negative" | "neutral";
  icon: React.ElementType;
  iconColor: string;
}

function StatCard({ title, value, change, changeType, icon: Icon, iconColor }: StatCardProps) {
  const changeColors = {
    positive: "text-green-600 bg-green-100 dark:bg-green-900/30",
    negative: "text-red-600 bg-red-100 dark:bg-red-900/30",
    neutral: "text-orange-600 bg-orange-100 dark:bg-orange-900/30"
  };

  return (
    <GlassCard className="p-6 animate-slide-up">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
          <p className="text-2xl font-bold text-gray-800 dark:text-gray-200 mt-1">{value}</p>
          <div className="flex items-center mt-2">
            <span className={cn("text-xs px-2 py-1 rounded-full", changeColors[changeType])}>
              {change}
            </span>
          </div>
        </div>
        <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center", iconColor)}>
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
    </GlassCard>
  );
}

export function DashboardStats() {
  const [stats, setStats] = useState({
    activeTasks: "0",
    teamPresent: "0/0",
    completedToday: "0",
    timeTracked: "0h"
  });

  useEffect(() => {
    // TODO: Fetch real stats from Firebase
    // For now showing placeholder data
    setStats({
      activeTasks: "12",
      teamPresent: "8/10",
      completedToday: "7",
      timeTracked: "6.5h"
    });
  }, []);

  const statsData = [
    {
      title: "Active Tasks",
      value: stats.activeTasks,
      change: "+2 today",
      changeType: "positive" as const,
      icon: CheckSquare,
      iconColor: "bg-gradient-to-r from-blue-500 to-blue-600"
    },
    {
      title: "Team Present",
      value: stats.teamPresent,
      change: "Good",
      changeType: "positive" as const,
      icon: Users,
      iconColor: "bg-gradient-to-r from-green-500 to-green-600"
    },
    {
      title: "Completed Today",
      value: stats.completedToday,
      change: "-1 vs yesterday",
      changeType: "neutral" as const,
      icon: CheckCircle,
      iconColor: "bg-gradient-to-r from-orange-500 to-orange-600"
    },
    {
      title: "Time Tracked",
      value: stats.timeTracked,
      change: "On track",
      changeType: "positive" as const,
      icon: Clock,
      iconColor: "bg-gradient-to-r from-purple-500 to-purple-600"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {statsData.map((stat, index) => (
        <StatCard key={index} {...stat} />
      ))}
    </div>
  );
}
