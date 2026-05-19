import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock, LogIn, LogOut, Calendar, CheckCircle2, AlertCircle, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { PageShell } from "@/components/layout/PageShell";

interface AttendanceRecord {
  id: string;
  userId: string;
  agencyId: string;
  date: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  totalMinutes: number | null;
  status: string;
  notes: string | null;
}

function formatTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(minutes: number | null) {
  if (!minutes) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString([], {
    weekday: "short", month: "short", day: "numeric",
  });
}

const statusConfig: Record<string, { label: string; color: string }> = {
  present:  { label: "Present",  color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  half_day: { label: "Half Day", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  late:     { label: "Late",     color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  absent:   { label: "Absent",   color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
};

export default function Attendance() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [now, setNow] = useState(new Date());

  // Refresh clock every minute
  useState(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  });

  const { data: records = [], isLoading } = useQuery<AttendanceRecord[]>({
    queryKey: ["/api/attendance"],
  });

  const today = records.find(r => r.date === todayStr());
  const isCheckedIn = !!today?.checkInAt && !today?.checkOutAt;
  const isCheckedOut = !!today?.checkOutAt;

  const checkInMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/attendance/check-in", {}).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/attendance"] });
      toast({ title: "Checked in successfully!" });
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const checkOutMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/attendance/check-out", {}).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/attendance"] });
      toast({ title: "Checked out successfully!" });
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  // Calculate live duration if checked in
  const liveDuration = isCheckedIn && today?.checkInAt
    ? Math.round((now.getTime() - new Date(today.checkInAt).getTime()) / 60000)
    : null;

  const recentRecords = records.slice(0, 30);

  return (
    <PageShell
      breadcrumbs={[{ label: "Insights" }, { label: "Attendance" }]}
      title="Attendance"
      description={now.toLocaleDateString([], { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
    >
      <div className="space-y-6 max-w-4xl mx-auto">
      {/* Today's status card */}
      <Card className="border-2 border-primary/10">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            {/* Clock */}
            <div className="text-center">
              <div className="text-5xl font-bold tabular-nums tracking-tight text-primary">
                {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
              <p className="text-muted-foreground text-sm mt-1">Current time</p>
            </div>

            <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Check In</p>
                <p className="font-semibold text-lg">{formatTime(today?.checkInAt ?? null)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Check Out</p>
                <p className="font-semibold text-lg">{formatTime(today?.checkOutAt ?? null)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Duration</p>
                <p className="font-semibold text-lg flex items-center justify-center gap-1">
                  {isCheckedIn && liveDuration !== null ? (
                    <><Timer className="h-4 w-4 text-primary animate-pulse" />{formatDuration(liveDuration)}</>
                  ) : formatDuration(today?.totalMinutes ?? null)}
                </p>
              </div>
            </div>

            {/* Action button */}
            <div className="flex flex-col items-center gap-2">
              {!today?.checkInAt ? (
                <Button
                  size="lg"
                  className="gap-2 px-8"
                  onClick={() => checkInMutation.mutate()}
                  disabled={checkInMutation.isPending}
                >
                  <LogIn className="h-5 w-5" />
                  {checkInMutation.isPending ? "Checking in…" : "Check In"}
                </Button>
              ) : !today.checkOutAt ? (
                <Button
                  size="lg"
                  variant="outline"
                  className="gap-2 px-8 border-orange-300 text-orange-600 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400"
                  onClick={() => checkOutMutation.mutate()}
                  disabled={checkOutMutation.isPending}
                >
                  <LogOut className="h-5 w-5" />
                  {checkOutMutation.isPending ? "Checking out…" : "Check Out"}
                </Button>
              ) : (
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-medium">Day complete</span>
                </div>
              )}
              {today && (
                <Badge className={cn("text-xs", statusConfig[today.status]?.color ?? "")}>
                  {statusConfig[today.status]?.label ?? today.status}
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "This Month", value: records.filter(r => r.date.startsWith(new Date().toISOString().slice(0, 7))).length, icon: Calendar, color: "text-blue-500" },
          { label: "Present Days", value: records.filter(r => r.status === "present").length, icon: CheckCircle2, color: "text-green-500" },
          { label: "Half Days", value: records.filter(r => r.status === "half_day").length, icon: Clock, color: "text-yellow-500" },
          { label: "Total Hours", value: `${Math.round(records.reduce((s, r) => s + (r.totalMinutes ?? 0), 0) / 60)}h`, icon: Timer, color: "text-purple-500" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <Icon className={cn("h-4 w-4", color)} />
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
              <p className="text-2xl font-bold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Attendance log */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Attendance Log</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Loading…</div>
          ) : recentRecords.length === 0 ? (
            <div className="p-8 text-center">
              <Clock className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-muted-foreground text-sm">No attendance records yet. Check in to get started.</p>
            </div>
          ) : (
            <div className="divide-y">
              {recentRecords.map(record => (
                <div key={record.id} className="flex items-center gap-4 px-6 py-3 hover:bg-muted/30 transition-colors">
                  <div className="w-28 text-sm font-medium">{formatDate(record.date)}</div>
                  <Badge className={cn("text-xs w-20 justify-center", statusConfig[record.status]?.color ?? "")}>
                    {statusConfig[record.status]?.label ?? record.status}
                  </Badge>
                  <div className="flex gap-6 text-sm text-muted-foreground flex-1">
                    <span>In: <span className="text-foreground font-medium">{formatTime(record.checkInAt)}</span></span>
                    <span>Out: <span className="text-foreground font-medium">{formatTime(record.checkOutAt)}</span></span>
                    <span>Duration: <span className="text-foreground font-medium">{formatDuration(record.totalMinutes)}</span></span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </PageShell>
  );
}
