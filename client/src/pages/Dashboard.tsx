import { Plus, Play } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { DashboardStats } from "@/components/dashboard/DashboardStats";
import { RecentTasks } from "@/components/dashboard/RecentTasks";
import { TeamActivity } from "@/components/dashboard/TeamActivity";
import { PerformanceChart } from "@/components/dashboard/PerformanceChart";
import { ClientPortal } from "@/components/client-portal/ClientPortal";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useTimer } from "@/hooks/useTimer";
import { useQuickCreate } from "@/components/layout/QuickCreate";

export default function Dashboard() {
  const { userProfile } = useAuth();
  const { startTimer } = useTimer();
  const { trigger } = useQuickCreate();

  const handleStartWork = async () => {
    await startTimer();
  };

  return (
    <PageShell
      breadcrumbs={[{ label: "Workspace" }, { label: "Dashboard" }]}
      title={`Good morning, ${userProfile?.name || "User"}! 👋`}
      description="Here's what's happening with your team today."
      primaryAction={
        <Button
          onClick={() => trigger("task")}
          className="bg-indigo-500 hover:bg-indigo-600 text-white"
          data-testid="button-dashboard-create-task"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Task
        </Button>
      }
      secondaryActions={
        <Button
          variant="outline"
          onClick={handleStartWork}
          className="bg-white/10 hover:bg-white/20 border-white/20"
          data-testid="button-dashboard-start-work"
        >
          <Play className="h-4 w-4 mr-2" />
          Start Work
        </Button>
      }
    >
      <div className="space-y-6">
        <DashboardStats />
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          <RecentTasks />
          <TeamActivity />
          <PerformanceChart />
        </div>
        <ClientPortal />
      </div>
    </PageShell>
  );
}
