import { useEffect, useState } from "react";
import { Building, ExternalLink, MessageCircle, Clock } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Project {
  id: string;
  name: string;
  status: "planning" | "active" | "completed" | "on_hold";
  progress: number;
  dueDate: string;
}

interface Update {
  id: string;
  content: string;
  timestamp: string;
  actionUrl?: string;
}

export function ClientPortal() {
  const [project, setProject] = useState<Project | null>(null);
  const [updates, setUpdates] = useState<Update[]>([]);

  useEffect(() => {
    // TODO: Fetch real client project data from Firebase
    // For now showing placeholder data
    setProject({
      id: "1",
      name: "Marketing Campaign Project",
      status: "active",
      progress: 65,
      dueDate: "Dec 20, 2024"
    });

    setUpdates([
      {
        id: "1",
        content: "Initial wireframes have been completed and are ready for your review.",
        timestamp: "2 hours ago",
        actionUrl: "/files"
      },
      {
        id: "2",
        content: "Brand guidelines document has been uploaded to the files section.",
        timestamp: "1 day ago",
        actionUrl: "/files"
      }
    ]);
  }, []);

  const statusColors = {
    planning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    active: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    on_hold: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
  };

  if (!project) {
    return (
      <GlassCard className="p-6">
        <div className="text-center py-8">
          <Building className="h-8 w-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400">No project data available</p>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
          Client Portal Preview
        </h3>
        <Badge variant="outline" className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 border-blue-200">
          Client View
        </Badge>
      </div>

      {/* Client Branded Header */}
      <div className="mb-6 p-4 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-lg bg-white/20 flex items-center justify-center">
            <Building className="h-6 w-6 text-white" />
          </div>
          <div>
            <h4 className="text-lg font-semibold">TechCorp Solutions</h4>
            <p className="text-purple-100">{project.name}</p>
          </div>
        </div>
      </div>

      {/* Project Status */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400">
            Project Status
          </h4>
          <Badge className={statusColors[project.status]}>
            {project.status.replace('_', ' ').toUpperCase()}
          </Badge>
        </div>
        <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-500"
            style={{ width: `${project.progress}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {project.progress}% Complete
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center space-x-1">
            <Clock className="h-3 w-3" />
            <span>Due {project.dueDate}</span>
          </span>
        </div>
      </div>

      {/* Project Timeline */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-3">
          Project Timeline
        </h4>
        <div className="space-y-3">
          <div className="flex items-center space-x-4">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Project Kickoff & Research
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Completed on Dec 1, 2024
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Design & Content Creation
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                In progress - Due Dec 15, 2024
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="w-3 h-3 rounded-full bg-gray-300 dark:bg-gray-600" />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Campaign Launch
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Scheduled for Dec 20, 2024
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Updates */}
      <div>
        <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-3">
          Recent Updates
        </h4>
        <div className="space-y-3">
          {updates.length === 0 ? (
            <div className="text-center py-4">
              <MessageCircle className="h-6 w-6 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400">No recent updates</p>
            </div>
          ) : (
            updates.map((update) => (
              <div key={update.id} className="p-3 rounded-lg bg-white/10">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {update.content}
                </p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {update.timestamp}
                  </span>
                  {update.actionUrl && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="text-xs text-indigo-500 hover:text-indigo-600 p-0 h-auto"
                    >
                      View Details <ExternalLink className="h-3 w-3 ml-1" />
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </GlassCard>
  );
}
