// @ts-nocheck
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { ProjectStage } from "@shared/schema";
import { Task } from "@shared/schema";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Loader2, LogOut, CheckCircle, Clock, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { motion } from "framer-motion";
import { format } from "date-fns";

export default function ClientPortalPage() {
  const { userProfile, logoutMutation } = useAuth();
  
  const { data: tasks, isLoading } = useQuery<Task[]>({
    queryKey: ["/api/client-portal/tasks"],
    enabled: !!userProfile,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FDFDFD] dark:bg-[#0A0A0A] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  // Group tasks for simpler client view
  const reviewTasks = tasks?.filter((t: any) => t.stage?.isClientReview) || [];
  const inProgressTasks = tasks?.filter((t: any) => !t.stage?.isDone && !t.stage?.isClientReview) || [];
  const completedTasks = tasks?.filter((t: any) => t.stage?.isDone) || [];

  return (
    <div className="min-h-screen bg-[#FDFDFD] dark:bg-[#0A0A0A] font-sans selection:bg-indigo-500/30">
      {/* Premium Header */}
      <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-white/70 dark:bg-black/70 border-b border-black/5 dark:border-white/10">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <span className="text-white font-bold text-lg">
                {userProfile?.name?.charAt(0) || "C"}
              </span>
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Client Portal</h1>
              <p className="text-sm text-muted-foreground">Welcome back, {userProfile?.name}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <Avatar className="h-9 w-9 ring-2 ring-indigo-500/20">
              {userProfile?.image && <AvatarImage src={userProfile.image} />}
              <AvatarFallback>{userProfile?.name?.charAt(0) || "C"}</AvatarFallback>
            </Avatar>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => logoutMutation.mutate()}
              className="text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12 space-y-12">
        {/* Welcome Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-600 to-purple-700 p-10 text-white shadow-2xl shadow-indigo-500/20"
        >
          <div className="relative z-10 max-w-2xl space-y-4">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Your Project Overview
            </h2>
            <p className="text-indigo-100 text-lg leading-relaxed">
              Track the progress of your tasks, review deliverables, and collaborate with our team all in one place.
            </p>
          </div>
          
          {/* Abstract background elements */}
          <div className="absolute top-0 right-0 -translate-y-1/4 translate-x-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 translate-y-1/4 w-64 h-64 bg-purple-400/20 rounded-full blur-3xl" />
        </motion.div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard 
            title="Needs Review" 
            value={reviewTasks.length} 
            icon={<Clock className="h-5 w-5 text-amber-500" />} 
            
          />
          <StatCard 
            title="In Progress" 
            value={inProgressTasks.length} 
            icon={<LayoutGrid className="h-5 w-5 text-indigo-500" />} 
            
          />
          <StatCard 
            title="Completed" 
            value={completedTasks.length} 
            icon={<CheckCircle className="h-5 w-5 text-emerald-500" />} 
            
          />
        </div>

        {/* Task Lists */}
        <div className="space-y-8">
          {reviewTasks.length > 0 && (
            <TaskSection title="Pending Your Review" tasks={reviewTasks as any} type="review" />
          )}
          
          {inProgressTasks.length > 0 && (
            <TaskSection title="Currently In Progress" tasks={inProgressTasks as any} type="progress" />
          )}

          {completedTasks.length > 0 && (
            <TaskSection title="Recently Completed" tasks={completedTasks as any} type="completed" />
          )}

          {tasks?.length === 0 && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              
              className="text-center py-20"
            >
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-50 dark:bg-indigo-500/10 mb-4">
                <LayoutGrid className="h-8 w-8 text-indigo-500" />
              </div>
              <h3 className="text-xl font-medium text-foreground">No tasks yet</h3>
              <p className="text-muted-foreground mt-2">We haven't started tracking any tasks for you yet.</p>
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
}

function StatCard({ title, value, icon, delay }: { title: string; value: number; icon: React.ReactNode;  }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      
    >
      <Card className="border-0 shadow-sm shadow-black/5 dark:bg-white/5 backdrop-blur-xl">
        <CardContent className="p-6 flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-muted/50 flex items-center justify-center">
            {icon}
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold tracking-tight">{value}</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function TaskSection({ title, tasks, type }: { title: string; tasks: Task[]; type: "review" | "progress" | "completed";  }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      
      className="space-y-4"
    >
      <h3 className="text-xl font-semibold tracking-tight">{title}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tasks.map((task) => (
          <Card key={task.id} className="group border border-border/50 shadow-sm hover:shadow-md hover:border-indigo-500/30 transition-all duration-300 cursor-pointer overflow-hidden dark:bg-white/5">
            <CardContent className="p-5">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <h4 className="font-medium leading-tight group-hover:text-indigo-500 transition-colors">
                    {task.title}
                  </h4>
                  {type === "review" && (
                    <span className="shrink-0 inline-flex items-center rounded-full bg-amber-500/10 px-2 py-1 text-[10px] font-medium text-amber-600 dark:text-amber-400 ring-1 ring-inset ring-amber-500/20">
                      Needs Review
                    </span>
                  )}
                </div>
                {task.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {task.description}
                  </p>
                )}
                <div className="pt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    {format(new Date(task.updatedAt), "MMM d, yyyy")}
                  </span>
                  {type === "review" && (
                    <span className="text-indigo-500 font-medium group-hover:underline">
                      Review now &rarr;
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </motion.div>
  );
}
