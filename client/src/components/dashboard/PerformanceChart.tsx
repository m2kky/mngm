import { useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface PerformanceMetric {
  name: string;
  value: number;
  color: string;
}

export function PerformanceChart() {
  const [period, setPeriod] = useState("week");
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([]);

  useEffect(() => {
    // TODO: Fetch real performance data from Firebase
    // For now showing placeholder data
    setMetrics([
      {
        name: "Tasks Completed",
        value: 87,
        color: "from-green-500 to-green-600"
      },
      {
        name: "Time Efficiency", 
        value: 72,
        color: "from-blue-500 to-blue-600"
      },
      {
        name: "Team Collaboration",
        value: 94,
        color: "from-purple-500 to-purple-600"
      }
    ]);
  }, [period]);

  return (
    <GlassCard className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
          Weekly Performance
        </h3>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-32 bg-white/10 border-white/20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">This Week</SelectItem>
            <SelectItem value="last-week">Last Week</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div className="space-y-4">
        {metrics.length === 0 ? (
          <div className="text-center py-8">
            <TrendingUp className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">No performance data available</p>
          </div>
        ) : (
          metrics.map((metric) => (
            <div key={metric.name}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {metric.name}
                </span>
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  {metric.value}%
                </span>
              </div>
              <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r ${metric.color} transition-all duration-500 ease-out`}
                  style={{ width: `${metric.value}%` }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </GlassCard>
  );
}
