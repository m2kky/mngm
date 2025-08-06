import { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface ActivityItem {
  id: string;
  user: string;
  action: string;
  target: string;
  time: string;
  avatar: string;
}

export function TeamActivity() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  useEffect(() => {
    // TODO: Fetch real activity data from Firebase
    // For now showing placeholder data
    setActivities([
      {
        id: "1",
        user: "Sarah Wilson",
        action: "completed",
        target: "Logo Design",
        time: "2 minutes ago",
        avatar: ""
      },
      {
        id: "2",
        user: "Mike Chen", 
        action: "started working on",
        target: "API Integration",
        time: "15 minutes ago",
        avatar: ""
      },
      {
        id: "3",
        user: "Lisa Park",
        action: "uploaded files to",
        target: "Project Alpha",
        time: "1 hour ago", 
        avatar: ""
      }
    ]);
  }, []);

  return (
    <GlassCard className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
          Team Activity
        </h3>
        <Button variant="ghost" size="sm" className="text-indigo-500 hover:text-indigo-600 p-0">
          View All
        </Button>
      </div>
      
      <div className="space-y-4">
        {activities.length === 0 ? (
          <div className="text-center py-8">
            <Activity className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">No recent activity</p>
          </div>
        ) : (
          activities.map((activity) => (
            <div key={activity.id} className="flex items-start space-x-3">
              <Avatar className="w-8 h-8">
                <AvatarImage src={activity.avatar} />
                <AvatarFallback className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs">
                  {activity.user.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <span className="font-medium">{activity.user}</span>{' '}
                  {activity.action}{' '}
                  <span className="font-medium text-indigo-500">{activity.target}</span>
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {activity.time}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </GlassCard>
  );
}
