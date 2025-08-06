import { useState } from "react";
import { Link, useLocation } from "wouter";
import { 
  Home, 
  CheckSquare, 
  FileText, 
  Folder, 
  MessageCircle, 
  Clock, 
  BarChart3,
  ChevronDown,
  Users,
  Building
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface SidebarProps {
  isCollapsed: boolean;
}

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: Home },
  { name: "Tasks", href: "/tasks", icon: CheckSquare },
  { name: "Pages", href: "/pages", icon: FileText },
  { name: "Files", href: "/files", icon: Folder },
  { name: "Chat", href: "/chat", icon: MessageCircle },
  { name: "Attendance", href: "/attendance", icon: Clock },
  { name: "Reports", href: "/reports", icon: BarChart3 },
];

export function Sidebar({ isCollapsed }: SidebarProps) {
  const [location] = useLocation();
  const { userProfile } = useAuth();
  const [workspaceExpanded, setWorkspaceExpanded] = useState(true);

  const mockTeamMembers = [
    { id: "1", name: "Sarah Wilson", role: "Designer", avatar: "", online: true },
    { id: "2", name: "Mike Chen", role: "Developer", avatar: "", online: false },
    { id: "3", name: "Lisa Park", role: "Manager", avatar: "", online: true },
  ];

  return (
    <aside
      className={cn(
        "transition-all duration-300 p-4 space-y-4",
        isCollapsed ? "w-20" : "w-64"
      )}
    >
      <GlassCard className="p-4">
        {/* Workspace Selector */}
        {!isCollapsed && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Workspace
              </h3>
              <Button 
                variant="ghost" 
                size="sm"
                className="text-xs text-indigo-500 hover:text-indigo-600 p-0 h-auto"
              >
                Switch
              </Button>
            </div>
            <div className="flex items-center space-x-2 p-2 rounded-lg bg-white/10">
              <div className="w-6 h-6 rounded bg-gradient-to-r from-green-400 to-blue-500 flex items-center justify-center">
                <Building className="w-3 h-3 text-white" />
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                Digital Agency Pro
              </span>
            </div>
          </div>
        )}

        {/* Navigation Menu */}
        <nav className="space-y-1">
          {navigation.map((item) => {
            const isActive = location === item.href;
            const Icon = item.icon;
            
            return (
              <Link key={item.name} href={item.href}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start transition-colors duration-200",
                    isActive && "bg-indigo-500/20 text-indigo-600 dark:text-indigo-400",
                    !isActive && "hover:bg-white/10",
                    isCollapsed && "px-2"
                  )}
                >
                  <Icon className={cn("h-4 w-4", !isCollapsed && "mr-3")} />
                  {!isCollapsed && (
                    <>
                      <span>{item.name}</span>
                      {item.name === "Tasks" && (
                        <span className="ml-auto bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                          3
                        </span>
                      )}
                      {item.name === "Chat" && (
                        <span className="ml-auto w-2 h-2 bg-green-500 rounded-full" />
                      )}
                    </>
                  )}
                </Button>
              </Link>
            );
          })}
        </nav>

        {/* Team Section */}
        {!isCollapsed && (
          <div className="mt-6 pt-6 border-t border-white/10">
            <Button
              variant="ghost"
              onClick={() => setWorkspaceExpanded(!workspaceExpanded)}
              className="w-full justify-between p-0 mb-3 h-auto hover:bg-transparent"
            >
              <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Team
              </h4>
              <ChevronDown 
                className={cn(
                  "h-3 w-3 transition-transform",
                  workspaceExpanded && "transform rotate-180"
                )}
              />
            </Button>
            
            {workspaceExpanded && (
              <div className="space-y-2">
                {mockTeamMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center space-x-2 p-2 rounded-lg hover:bg-white/10 transition-colors duration-200 cursor-pointer"
                  >
                    <Avatar className="w-6 h-6">
                      <AvatarImage src={member.avatar} />
                      <AvatarFallback className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs">
                        {member.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                        {member.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {member.role}
                      </p>
                    </div>
                    <div 
                      className={cn(
                        "w-2 h-2 rounded-full",
                        member.online ? "bg-green-500" : "bg-gray-400"
                      )}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </GlassCard>
    </aside>
  );
}
