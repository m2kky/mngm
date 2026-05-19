import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, AreaChart, Area, Legend,
} from "recharts";
import {
  CheckCircle2, Clock, Briefcase, Users, TrendingUp, AlertTriangle,
  CalendarCheck, Filter, Download, FileText, FileSpreadsheet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

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

interface TaskOverTime {
  date: string;
  created: number;
  completed: number;
}

interface TaskByProject {
  projectId: string;
  name: string;
  total: number;
  completed: number;
}

interface TimeMember {
  userId: string;
  name: string;
  hours: number;
}

interface Project {
  id: string;
  name: string;
}

const STATUS_COLORS: Record<string, string> = {
  IN_PROGRESS: "#6366f1",
  IN_REVIEW:   "#8b5cf6",
  DONE:        "#22c55e",
  OVERDUE:     "#ef4444",
  TODO:        "#94a3b8",
};

const STATUS_LABELS: Record<string, string> = {
  IN_PROGRESS: "In Progress",
  IN_REVIEW:   "In Review",
  DONE:        "Done",
  OVERDUE:     "Overdue",
  TODO:        "To Do",
};

type DateRange = "7d" | "30d" | "90d" | "all";

function dateRangeBounds(range: DateRange): { startDate?: string; endDate?: string } {
  if (range === "all") return {};
  const now = new Date();
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: now.toISOString().slice(0, 10),
  };
}

function buildParams(bounds: ReturnType<typeof dateRangeBounds>, projectId: string): string {
  const p = new URLSearchParams();
  if (bounds.startDate) p.set("startDate", bounds.startDate);
  if (bounds.endDate)   p.set("endDate", bounds.endDate);
  if (projectId && projectId !== "all") p.set("projectId", projectId);
  const s = p.toString();
  return s ? `?${s}` : "";
}

function StatCard({
  label, value, sub, icon: Icon, color,
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string;
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

function formatDateLabel(dateStr: string, range: DateRange): string {
  const d = new Date(dateStr);
  if (range === "90d") return d.toLocaleDateString("en", { month: "short", day: "numeric" });
  return d.toLocaleDateString("en", { month: "short", day: "numeric" });
}

function downloadCSV(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const FORMULA_CHARS = /^[=+\-@\t\r]/;

function sanitizeCSVValue(v: string | number): string {
  const s = String(v ?? "");
  const safe = FORMULA_CHARS.test(s) ? `'${s}` : s;
  return safe.includes(",") || safe.includes('"') || safe.includes("\n")
    ? `"${safe.replace(/"/g, '""')}"`
    : safe;
}

function toCSVRow(values: (string | number)[]) {
  return values.map(sanitizeCSVValue).join(",");
}

export default function Reports() {
  const { userProfile } = useAuth();
  const [dateRange, setDateRange] = useState<DateRange>("30d");
  const [projectId, setProjectId] = useState<string>("all");

  const bounds = useMemo(() => dateRangeBounds(dateRange), [dateRange]);
  const params = useMemo(() => buildParams(bounds, projectId), [bounds, projectId]);
  const overviewParams = useMemo(() => {
    const p = new URLSearchParams();
    if (bounds.startDate) p.set("startDate", bounds.startDate);
    if (bounds.endDate)   p.set("endDate", bounds.endDate);
    if (projectId && projectId !== "all") p.set("projectId", projectId);
    const s = p.toString();
    return s ? `?${s}` : "";
  }, [bounds, projectId]);

  const agencyId = (userProfile as any)?.agencyId;

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects", agencyId],
    queryFn: () => fetch(`/api/projects${agencyId ? `?agencyId=${agencyId}` : ""}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    }).then(r => r.json()),
    enabled: !!agencyId,
  });

  const { data: overview, isLoading: loadingOverview } = useQuery<ReportOverview>({
    queryKey: ["/api/reports/overview", overviewParams],
    queryFn: () => fetch(`/api/reports/overview${overviewParams}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    }).then(r => r.json()),
  });

  const { data: tasksOverTime = [], isLoading: loadingTime } = useQuery<TaskOverTime[]>({
    queryKey: ["/api/reports/tasks-over-time", params],
    queryFn: () => fetch(`/api/reports/tasks-over-time${params}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    }).then(r => r.json()),
  });

  const { data: tasksByProject = [], isLoading: loadingProjects } = useQuery<TaskByProject[]>({
    queryKey: ["/api/reports/tasks-by-project", params],
    queryFn: () => fetch(`/api/reports/tasks-by-project${params}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    }).then(r => r.json()),
  });

  const { data: timeByMember = [], isLoading: loadingMembers } = useQuery<TimeMember[]>({
    queryKey: ["/api/reports/time-by-member", params],
    queryFn: () => fetch(`/api/reports/time-by-member${params}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    }).then(r => r.json()),
  });

  const isLoading = loadingOverview;

  const completionRate = overview && overview.totalTasks > 0
    ? Math.round((overview.completedTasks / overview.totalTasks) * 100)
    : 0;

  const statusBarData = overview
    ? Object.entries(overview.tasksByStatus)
        .filter(([, count]) => count > 0)
        .map(([status, count]) => ({
          name: STATUS_LABELS[status] ?? status,
          count,
          color: STATUS_COLORS[status] ?? "#94a3b8",
        }))
    : [];

  const pieData = statusBarData.filter(d => d.count > 0);

  const timelineData = useMemo(() => {
    if (dateRange === "90d") {
      const weekly: Record<string, TaskOverTime> = {};
      tasksOverTime.forEach(d => {
        const date = new Date(d.date);
        const monday = new Date(date);
        monday.setDate(date.getDate() - date.getDay() + 1);
        const key = monday.toISOString().slice(0, 10);
        if (!weekly[key]) weekly[key] = { date: key, created: 0, completed: 0 };
        weekly[key].created += d.created;
        weekly[key].completed += d.completed;
      });
      return Object.values(weekly);
    }
    return tasksOverTime;
  }, [tasksOverTime, dateRange]);

  const efficiencyRate = overview && overview.totalTasks > 0
    ? Math.round(((overview.totalTasks - overview.overdueTasks) / overview.totalTasks) * 100)
    : 0;

  const handleExportCSV = () => {
    const lines: string[] = [];
    const rangeLabel = dateRange === "all" ? "All Time" : `Last ${dateRange.replace("d", " days")}`;
    const projectLabel = projectId === "all" ? "All Projects" : projects.find(p => p.id === projectId)?.name ?? projectId;

    lines.push("Workit.OS — Report Export");
    lines.push(toCSVRow(["Date Range", rangeLabel]));
    lines.push(toCSVRow(["Project Filter", projectLabel]));
    lines.push(toCSVRow(["Exported At", new Date().toLocaleString()]));
    lines.push("");

    lines.push("SUMMARY STATS");
    lines.push(toCSVRow(["Metric", "Value"]));
    lines.push(toCSVRow(["Total Tasks", overview?.totalTasks ?? 0]));
    lines.push(toCSVRow(["Completed Tasks", overview?.completedTasks ?? 0]));
    lines.push(toCSVRow(["Overdue Tasks", overview?.overdueTasks ?? 0]));
    lines.push(toCSVRow(["Completion Rate (%)", completionRate]));
    lines.push(toCSVRow(["Team Efficiency (%)", efficiencyRate]));
    lines.push(toCSVRow(["Active Projects", overview?.activeProjects ?? 0]));
    lines.push(toCSVRow(["Total Projects", overview?.totalProjects ?? 0]));
    lines.push(toCSVRow(["Total Clients", overview?.totalClients ?? 0]));
    lines.push(toCSVRow(["Team Size", overview?.teamSize ?? 0]));
    lines.push(toCSVRow(["Hours Logged", overview?.totalHoursLogged ?? 0]));
    lines.push(toCSVRow(["Present Today", overview?.presentToday ?? 0]));
    lines.push("");

    lines.push("TASKS BY STATUS");
    lines.push(toCSVRow(["Status", "Count"]));
    statusBarData.forEach(d => lines.push(toCSVRow([d.name, d.count])));
    lines.push("");

    lines.push("TASKS OVER TIME");
    lines.push(toCSVRow(["Date", "Created", "Completed"]));
    timelineData.forEach(d => lines.push(toCSVRow([d.date, d.created, d.completed])));
    lines.push("");

    lines.push("TASKS BY PROJECT");
    lines.push(toCSVRow(["Project", "Total Tasks", "Completed Tasks", "Completion Rate (%)"]));
    tasksByProject.forEach(d =>
      lines.push(toCSVRow([d.name, d.total, d.completed, d.total > 0 ? Math.round((d.completed / d.total) * 100) : 0]))
    );
    lines.push("");

    lines.push("TIME LOGGED PER TEAM MEMBER");
    lines.push(toCSVRow(["Member", "Hours Logged"]));
    timeByMember.forEach(d => lines.push(toCSVRow([d.name, d.hours])));

    const dateSuffix = new Date().toISOString().slice(0, 10);
    downloadCSV(`workit-report-${dateSuffix}.csv`, lines.join("\n"));
  };

  const handleExportPDF = () => {
    document.body.classList.add("printing-reports");
    window.print();
    document.body.classList.remove("printing-reports");
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        <div className="h-8 w-40 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}><CardContent className="pt-5 h-24 bg-muted/30 animate-pulse" /></Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Reports & Analytics</h1>
          <p className="text-muted-foreground text-sm mt-1">Track performance, productivity, and project health</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={dateRange} onValueChange={v => setDateRange(v as DateRange)}>
            <SelectTrigger className="w-36 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger className="w-44 h-9">
              <SelectValue placeholder="All projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All projects</SelectItem>
              {projects.map((p: Project) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1.5">
                <Download className="h-4 w-4" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportCSV} className="gap-2 cursor-pointer">
                <FileSpreadsheet className="h-4 w-4 text-green-600" />
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportPDF} className="gap-2 cursor-pointer">
                <FileText className="h-4 w-4 text-red-500" />
                Print / Save as PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Tasks"
          value={overview?.totalTasks ?? 0}
          sub={`${overview?.completedTasks ?? 0} completed`}
          icon={CheckCircle2}
          color="bg-primary"
        />
        <StatCard
          label="Completion Rate"
          value={`${completionRate}%`}
          sub={`${overview?.overdueTasks ?? 0} overdue`}
          icon={TrendingUp}
          color="bg-green-500"
        />
        <StatCard
          label="Active Projects"
          value={overview?.activeProjects ?? 0}
          sub={`${overview?.totalProjects ?? 0} total`}
          icon={Briefcase}
          color="bg-blue-500"
        />
        <StatCard
          label="Clients"
          value={overview?.totalClients ?? 0}
          icon={Users}
          color="bg-purple-500"
        />
        <StatCard
          label="Team Size"
          value={overview?.teamSize ?? 0}
          sub={`${overview?.presentToday ?? 0} present today`}
          icon={CalendarCheck}
          color="bg-orange-500"
        />
        <StatCard
          label="Hours Logged"
          value={`${overview?.totalHoursLogged ?? 0}h`}
          sub="all time"
          icon={Clock}
          color="bg-teal-500"
        />
        <StatCard
          label="Overdue Tasks"
          value={overview?.overdueTasks ?? 0}
          sub="need attention"
          icon={AlertTriangle}
          color="bg-red-500"
        />
        <StatCard
          label="Team Efficiency"
          value={`${efficiencyRate}%`}
          sub="tasks on track"
          icon={TrendingUp}
          color="bg-emerald-500"
        />
      </div>

      {/* Overall completion progress */}
      <Card>
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Overall Completion</span>
            <span className="text-sm font-bold text-primary">{completionRate}%</span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-700"
              style={{ width: `${completionRate}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>{overview?.completedTasks ?? 0} completed</span>
            <span>{(overview?.totalTasks ?? 0) - (overview?.completedTasks ?? 0)} remaining</span>
          </div>
        </CardContent>
      </Card>

      {/* Tasks over time */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Tasks Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingTime ? (
            <div className="h-52 bg-muted/30 animate-pulse rounded" />
          ) : timelineData.length === 0 || timelineData.every(d => d.created === 0 && d.completed === 0) ? (
            <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">
              No task activity in this period
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={timelineData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradCreated" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradCompleted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  tickFormatter={d => formatDateLabel(d, dateRange)}
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, fontSize: 12 }}
                  labelFormatter={d => formatDateLabel(d as string, dateRange)}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area
                  type="monotone"
                  dataKey="created"
                  name="Created"
                  stroke="#6366f1"
                  fill="url(#gradCreated)"
                  strokeWidth={2}
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey="completed"
                  name="Completed"
                  stroke="#22c55e"
                  fill="url(#gradCompleted)"
                  strokeWidth={2}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Charts row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Tasks by status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Tasks by Status</CardTitle>
          </CardHeader>
          <CardContent>
            {statusBarData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No task data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={statusBarData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number) => [v, "Tasks"]}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {statusBarData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Task distribution pie */}
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
                    outerRadius={75}
                    label={({ name, percent }: { name: string; percent: number }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                    fontSize={10}
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

      {/* Tasks by project */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Tasks by Project</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingProjects ? (
            <div className="h-52 bg-muted/30 animate-pulse rounded" />
          ) : tasksByProject.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">No project data in this period</div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(220, tasksByProject.length * 44)}>
              <BarChart
                data={tasksByProject}
                layout="vertical"
                margin={{ top: 4, right: 40, left: 4, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  width={120}
                  tickFormatter={n => n.length > 16 ? n.slice(0, 15) + "…" : n}
                />
                <Tooltip
                  contentStyle={{ borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number, name: string) => [v, name === "total" ? "Total" : "Completed"]}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="total" name="Total" fill="#6366f1" radius={[0, 4, 4, 0]} />
                <Bar dataKey="completed" name="Completed" fill="#22c55e" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Time logged per member */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Time Logged per Team Member</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingMembers ? (
            <div className="h-52 bg-muted/30 animate-pulse rounded" />
          ) : timeByMember.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">
              No time entries recorded in this period
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(220, timeByMember.length * 44)}>
              <BarChart
                data={timeByMember}
                layout="vertical"
                margin={{ top: 4, right: 40, left: 4, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} unit="h" allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  width={120}
                  tickFormatter={n => n.length > 16 ? n.slice(0, 15) + "…" : n}
                />
                <Tooltip
                  contentStyle={{ borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => [`${v}h`, "Hours"]}
                />
                <Bar dataKey="hours" name="Hours logged" fill="#f59e0b" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
