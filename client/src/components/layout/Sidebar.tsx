import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import {
  Home,
  CheckSquare,
  FileText,
  Folder,
  MessageCircle,
  Clock,
  BarChart3,
  Users,
  Building,
  Settings2,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useSidebarUI } from "@/contexts/SidebarUIContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { QuickCreateButton } from "./QuickCreate";
import { useShortcut } from "@/lib/shortcuts";

interface SidebarProps {
  isCollapsed: boolean;
}

type NavItem = { name: string; href: string; icon: typeof Home; shortcut?: string };
type NavSection = { id: string; label: string; items: NavItem[] };

const SECTIONS: NavSection[] = [
  {
    id: "workspace",
    label: "Workspace",
    items: [
      { name: "Dashboard", href: "/dashboard", icon: Home, shortcut: "G D" },
    ],
  },
  {
    id: "work",
    label: "Work",
    items: [
      { name: "Tasks", href: "/tasks", icon: CheckSquare, shortcut: "G T" },
      { name: "Pages", href: "/pages", icon: FileText, shortcut: "G P" },
      { name: "Files", href: "/files", icon: Folder, shortcut: "G F" },
    ],
  },
  {
    id: "communication",
    label: "Communication",
    items: [
      { name: "Chat", href: "/chat", icon: MessageCircle, shortcut: "G C" },
    ],
  },
  {
    id: "insights",
    label: "Insights",
    items: [
      { name: "Attendance", href: "/attendance", icon: Clock, shortcut: "G A" },
      { name: "Reports", href: "/reports", icon: BarChart3, shortcut: "G R" },
      { name: "Team", href: "/team", icon: Users, shortcut: "G M" },
    ],
  },
];

const ADMIN_SECTION: NavSection = {
  id: "admin",
  label: "Admin",
  items: [{ name: "Settings", href: "/settings", icon: Settings2, shortcut: "G S" }],
};

function NavLinks({
  collapsed,
  sections,
  onNavigate,
}: {
  collapsed: boolean;
  sections: NavSection[];
  onNavigate?: () => void;
}) {
  const [location] = useLocation();
  return (
    <nav className="space-y-3">
      {sections.map((section) => (
        <div key={section.id}>
          {!collapsed && (
            <h4 className="px-2 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              {section.label}
            </h4>
          )}
          <div className="space-y-0.5">
            {section.items.map((item) => {
              const isActive = location === item.href;
              const Icon = item.icon;
              const navBtn = (
                <Button
                  key={item.name}
                  asChild
                  variant={isActive ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start transition-colors duration-200 h-9",
                    isActive && "bg-indigo-500/20 text-indigo-600 dark:text-indigo-400",
                    !isActive && "hover:bg-white/10",
                    collapsed && "px-2 justify-center",
                  )}
                >
                  <Link href={item.href} onClick={onNavigate}>
                    <Icon className={cn("h-4 w-4", !collapsed && "mr-3")} />
                    {!collapsed && (
                      <>
                        <span>{item.name}</span>
                        {item.shortcut && (
                          <span className="ml-auto text-[10px] font-mono text-muted-foreground opacity-60">
                            {item.shortcut}
                          </span>
                        )}
                      </>
                    )}
                  </Link>
                </Button>
              );
              return collapsed ? (
                <Tooltip key={item.name}>
                  <TooltipTrigger asChild>{navBtn}</TooltipTrigger>
                  <TooltipContent side="right">
                    {item.name}
                    {item.shortcut && (
                      <span className="ml-2 text-xs text-muted-foreground">{item.shortcut}</span>
                    )}
                  </TooltipContent>
                </Tooltip>
              ) : (
                navBtn
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

function SidebarInner({
  collapsed,
  agencyName,
  onNavigate,
  isAdmin,
}: {
  collapsed: boolean;
  agencyName: string;
  onNavigate?: () => void;
  isAdmin: boolean;
}) {
  const sections = isAdmin ? [...SECTIONS, ADMIN_SECTION] : SECTIONS;
  return (
    <>
      {!collapsed && (
        <div className="mb-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 px-2">
            Workspace
          </h3>
          <div className="flex items-center space-x-2 p-2 rounded-lg bg-white/10">
            <div className="w-6 h-6 rounded bg-gradient-to-r from-green-400 to-blue-500 flex items-center justify-center shrink-0">
              <Building className="w-3 h-3 text-white" />
            </div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
              {agencyName}
            </span>
          </div>
        </div>
      )}

      <div className="mb-4">
        <QuickCreateButton collapsed={collapsed} />
      </div>

      <NavLinks collapsed={collapsed} sections={sections} onNavigate={onNavigate} />
    </>
  );
}

export function Sidebar({ isCollapsed }: SidebarProps) {
  const [, navigate] = useLocation();
  const { userProfile } = useAuth();
  const { mobileOpen, setMobileOpen, closeMobile, toggleCollapsed } = useSidebarUI();
  const isMobile = useIsMobile();

  const isAdmin = userProfile?.role === "OWNER" || userProfile?.role === "ADMIN";
  const agencyId = userProfile?.agencyId;

  const { data: agency } = useQuery<{ id: string; name: string }>({
    queryKey: ["/api/agencies", agencyId],
    queryFn: async () => {
      const res = await fetch(`/api/agencies/${agencyId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("wk_token") ?? ""}` },
      });
      if (!res.ok) throw new Error("Failed to load agency");
      return res.json();
    },
    enabled: !!agencyId,
  });
  const agencyName = agency?.name ?? "Workspace";

  // Layout shortcut: "[" toggles the sidebar.
  useShortcut({
    id: "layout.toggle-sidebar",
    keys: "[",
    label: "Toggle sidebar",
    group: "Layout",
    handler: () => {
      if (isMobile) setMobileOpen(!mobileOpen);
      else toggleCollapsed();
    },
  });

  // Navigation shortcuts: G then <key>.
  useShortcut({ id: "nav.dashboard", keys: "g+d", sequence: ["g", "d"], label: "Go to Dashboard", group: "Navigation", handler: () => navigate("/dashboard") });
  useShortcut({ id: "nav.tasks", keys: "g+t", sequence: ["g", "t"], label: "Go to Tasks", group: "Navigation", handler: () => navigate("/tasks") });
  useShortcut({ id: "nav.pages", keys: "g+p", sequence: ["g", "p"], label: "Go to Pages", group: "Navigation", handler: () => navigate("/pages") });
  useShortcut({ id: "nav.files", keys: "g+f", sequence: ["g", "f"], label: "Go to Files", group: "Navigation", handler: () => navigate("/files") });
  useShortcut({ id: "nav.chat", keys: "g+c", sequence: ["g", "c"], label: "Go to Chat", group: "Navigation", handler: () => navigate("/chat") });
  useShortcut({ id: "nav.attendance", keys: "g+a", sequence: ["g", "a"], label: "Go to Attendance", group: "Navigation", handler: () => navigate("/attendance") });
  useShortcut({ id: "nav.reports", keys: "g+r", sequence: ["g", "r"], label: "Go to Reports", group: "Navigation", handler: () => navigate("/reports") });
  useShortcut({ id: "nav.team", keys: "g+m", sequence: ["g", "m"], label: "Go to Team", group: "Navigation", handler: () => navigate("/team") });
  useShortcut({ id: "nav.settings", keys: "g+s", sequence: ["g", "s"], label: "Go to Settings", group: "Navigation", handler: () => navigate("/settings") });

  if (isMobile) {
    return (
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-4 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
          </SheetHeader>
          <SidebarInner
            collapsed={false}
            agencyName={agencyName}
            isAdmin={isAdmin}
            onNavigate={closeMobile}
          />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <aside
      className={cn(
        "transition-all duration-300 p-4 space-y-4 hidden md:block",
        isCollapsed ? "w-20" : "w-64",
      )}
    >
      <GlassCard className="p-4">
        <SidebarInner collapsed={isCollapsed} agencyName={agencyName} isAdmin={isAdmin} />
      </GlassCard>
    </aside>
  );
}
