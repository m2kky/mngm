import { useState } from "react";
import { Plus, Play } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { FloatingTimer } from "@/components/layout/FloatingTimer";
import { DashboardStats } from "@/components/dashboard/DashboardStats";
import { RecentTasks } from "@/components/dashboard/RecentTasks";
import { TeamActivity } from "@/components/dashboard/TeamActivity";
import { PerformanceChart } from "@/components/dashboard/PerformanceChart";

import { ClientPortal } from "@/components/client-portal/ClientPortal";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useTimer } from "@/hooks/useTimer";

export default function Dashboard() {
  const { userProfile } = useAuth();
  const { startTimer } = useTimer();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleCreateTask = () => {
    // TODO: Implement task creation modal
    console.log("Create task clicked");
  };

  const handleStartWork = async () => {
    await startTimer();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800 transition-colors duration-300">
      <Header onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)} />
      
      <div className="flex">
        <Sidebar isCollapsed={sidebarCollapsed} />
        
        <main className="flex-1 p-4 space-y-6">
          {/* Dashboard Header */}
          <GlassCard className="p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                  Good morning, {userProfile?.name || "User"}! 👋
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Here's what's happening with your team today.
                </p>
              </div>
              <div className="flex items-center space-x-4 mt-4 md:mt-0">
                <Button 
                  onClick={handleCreateTask}
                  className="bg-indigo-500 hover:bg-indigo-600 text-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Task
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleStartWork}
                  className="bg-white/10 hover:bg-white/20 border-white/20"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Start Work
                </Button>
              </div>
            </div>
          </GlassCard>

          {/* Quick Stats */}
          <DashboardStats />

          {/* Dashboard Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            <RecentTasks />
            <TeamActivity />
            <PerformanceChart />
          </div>

          {/* Client Portal Preview */}
          <ClientPortal />
        </main>
      </div>
      
      <FloatingTimer />
    </div>
  );
}
