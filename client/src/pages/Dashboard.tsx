import { Plus, Play, Rocket, FolderPlus, Users, CheckSquare } from "lucide-react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PageShell } from "@/components/layout/PageShell";
import { DashboardStats } from "@/components/dashboard/DashboardStats";
import { RecentTasks } from "@/components/dashboard/RecentTasks";
import { TeamActivity } from "@/components/dashboard/TeamActivity";
import { PerformanceChart } from "@/components/dashboard/PerformanceChart";
import { ClientPortal } from "@/components/client-portal/ClientPortal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useTimer } from "@/hooks/useTimer";
import { useQuickCreate } from "@/components/layout/QuickCreate";

function FirstRunState() {
  const { trigger } = useQuickCreate();
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-6">
      <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-6 shadow-lg">
        <Rocket className="h-10 w-10 text-white" />
      </div>
      <h2 className="text-2xl font-bold mb-2">Welcome to Workit.OS</h2>
      <p className="text-muted-foreground max-w-sm mb-8">
        Your workspace is ready. Start by creating a project, inviting your team, or adding your first task.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-xl">
        <Card
          className="cursor-pointer hover:border-primary/50 hover:shadow-sm transition-all group"
          onClick={() => trigger("task")}
        >
          <CardContent className="flex flex-col items-center gap-3 pt-6 pb-5">
            <div className="h-10 w-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center group-hover:scale-110 transition-transform">
              <CheckSquare className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <p className="font-medium text-sm">Create a Task</p>
              <p className="text-xs text-muted-foreground mt-0.5">Start tracking work</p>
            </div>
          </CardContent>
        </Card>

        <Link href="/tasks">
          <Card className="cursor-pointer hover:border-primary/50 hover:shadow-sm transition-all group">
            <CardContent className="flex flex-col items-center gap-3 pt-6 pb-5">
              <div className="h-10 w-10 rounded-xl bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center group-hover:scale-110 transition-transform">
                <FolderPlus className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="font-medium text-sm">New Project</p>
                <p className="text-xs text-muted-foreground mt-0.5">Organise your work</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/team">
          <Card className="cursor-pointer hover:border-primary/50 hover:shadow-sm transition-all group">
            <CardContent className="flex flex-col items-center gap-3 pt-6 pb-5">
              <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Users className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="font-medium text-sm">Invite Team</p>
                <p className="text-xs text-muted-foreground mt-0.5">Collaborate together</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { userProfile } = useAuth();
  const { trigger } = useQuickCreate();
  const { toast } = useToast();
  const qc = useQueryClient();

  const agencyId = (userProfile as any)?.agencyId;

  const { data: projects = [], isLoading: projectsLoading } = useQuery<any[]>({
    queryKey: [`/api/projects?agencyId=${agencyId}`],
    enabled: !!agencyId,
  });

  const showFirstRun = !projectsLoading && projects.length === 0;

  const checkInMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/attendance/check-in", {}).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/attendance"] });
      toast({ title: "Checked in successfully!" });
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const handleStartWork = async () => {
    checkInMutation.mutate();
  };

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  return (
    <PageShell
      breadcrumbs={[{ label: "Workspace" }, { label: "Dashboard" }]}
      title={`${greeting}, ${userProfile?.name || "User"} 👋`}
      description={showFirstRun ? "Let's get you set up." : "Here's what's happening with your team today."}
      primaryAction={
        !showFirstRun ? (
          <Button
            onClick={() => trigger("task")}
            className="bg-indigo-500 hover:bg-indigo-600 text-white"
            data-testid="button-dashboard-create-task"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Task
          </Button>
        ) : undefined
      }
      secondaryActions={
        !showFirstRun ? (
          <Button
            variant="outline"
            onClick={handleStartWork}
            data-testid="button-dashboard-start-work"
          >
            <Play className="h-4 w-4 mr-2" />
            Start Work
          </Button>
        ) : undefined
      }
    >
      {showFirstRun ? (
        <FirstRunState />
      ) : (
        <div className="space-y-6">
          <DashboardStats />
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            <RecentTasks />
            <TeamActivity />
            <PerformanceChart />
          </div>
          <ClientPortal />
        </div>
      )}
    </PageShell>
  );
}
