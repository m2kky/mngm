import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie,
} from "recharts";
import { CheckCircle2, Clock, Briefcase, Users, TrendingUp, AlertTriangle, CalendarCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ReportOverview {
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  activeProjects: number;
  totalProjects: number;
  totalClients: number;
  teamSize: number;
  totalHoursLogged: number;
  presentToday: number;
  tasksByStatus: Record<string, number>;
}

const STATUS_COLORS: Record<string, string> = {
  TODO:        "#6366f1",
  IN_PROGRESS: "#f59e0b",
  IN_REVIEW:   "#8b5cf6",
  DONE:        "#22c55e",
  CANCELLED:   "#ef4444",
};

const STATUS_LABELS: Record<string, string> = {
  TODO:        "To Do",
  IN_PROGRESS: "In Progress",
  IN_REVIEW:   "In Review",
  DONE:        "Done",
  CANCELLED:   "Cancelled",
};

function StatCard({
  label, value, sub, icon: Icon, color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", color)}>
            <Icon className="h-5 w-5 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Reports() {
  const { data: overview, isLoading } = useQuery<ReportOverview>({
    queryKey: ["/api/reports/overview"],
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        <div className="h-8 w-40 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}><CardContent className="pt-5 h-24 bg-muted/30 animate-pulse" /></Card>
          ))}
        </div>
      </div>
    );
  }

  if (!overview) return null;

  const completionRate = overview.totalTasks > 0
    ? Math.round((overview.completedTasks / overview.totalTasks) * 100)
    : 0;

  const barData = Object.entries(overview.tasksByStatus).map(([status, count]) => ({
    name: STATUS_LABELS[status] ?? status,
    count,
    color: STATUS_COLORS[status] ?? "#94a3b8",
  }));

  const pieData = barData.filter(d => d.count > 0);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-muted-foreground text-sm mt-1">Overview of your agency's performance</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Tasks"
          value={overview.totalTasks}
          sub={`${overview.completedTasks} completed`}
          icon={CheckCircle2}
          color="bg-primary"
        />
        <StatCard
          label="Completion Rate"
          value={`${completionRate}%`}
          sub={`${overview.overdueTasks} overdue`}
          icon={TrendingUp}
          color="bg-green-500"
        />
        <StatCard
          label="Active Projects"
          value={overview.activeProjects}
          sub={`${overview.totalProjects} total`}
          icon={Briefcase}
          color="bg-blue-500"
        />
        <StatCard
          label="Clients"
          value={overview.totalClients}
          icon={Users}
          color="bg-purple-500"
        />
        <StatCard
          label="Team Size"
          value={overview.teamSize}
          sub={`${overview.presentToday} present today`}
          icon={CalendarCheck}
          color="bg-orange-500"
        />
        <StatCard
          label="Hours Logged"
          value={`${overview.totalHoursLogged}h`}
          sub="all time"
          icon={Clock}
          color="bg-teal-500"
        />
        <StatCard
          label="Overdue Tasks"
          value={overview.overdueTasks}
          sub="need attention"
          icon={AlertTriangle}
          color="bg-red-500"
        />
        <StatCard
          label="Present Today"
          value={overview.presentToday}
          sub={`of ${overview.teamSize} team members`}
          icon={CheckCircle2}
          color="bg-emerald-500"
        />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Bar chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Tasks by Status</CardTitle>
          </CardHeader>
          <CardContent>
            {barData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No task data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={barData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number) => [v, "Tasks"]}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {barData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Pie chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Task Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No task data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }: { name: string; percent: number }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                    fontSize={11}
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => [v, "Tasks"]} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Overall completion progress bar */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Overall Completion</span>
            <span className="text-sm font-bold text-primary">{completionRate}%</span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${completionRate}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>{overview.completedTasks} completed</span>
            <span>{overview.totalTasks - overview.completedTasks} remaining</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
