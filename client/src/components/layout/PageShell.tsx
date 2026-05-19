import { ReactNode, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { ChevronLeft, MoreHorizontal } from "lucide-react";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { FloatingTimer } from "./FloatingTimer";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/GlassCard";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSidebarUI } from "@/contexts/SidebarUIContext";
import { cn } from "@/lib/utils";

export type Crumb = {
  label: string;
  href?: string;
};

const SECTION_FOR_PATH: Record<string, { section: string; label: string }> = {
  dashboard: { section: "Workspace", label: "Dashboard" },
  tasks: { section: "Work", label: "Tasks" },
  pages: { section: "Work", label: "Pages" },
  files: { section: "Work", label: "Files" },
  chat: { section: "Communication", label: "Chat" },
  attendance: { section: "Insights", label: "Attendance" },
  reports: { section: "Insights", label: "Reports" },
  team: { section: "Insights", label: "Team" },
  settings: { section: "Workspace", label: "Settings" },
  profile: { section: "Workspace", label: "Profile" },
};

function deriveCrumbsFromPath(path: string): Crumb[] | undefined {
  const seg = path.replace(/^\/+/, "").split("/")[0]?.split("?")[0];
  if (!seg) return undefined;
  const entry = SECTION_FOR_PATH[seg];
  if (!entry) return undefined;
  return [{ label: entry.section }, { label: entry.label, href: `/${seg}` }];
}

type PageShellProps = {
  title?: ReactNode;
  description?: ReactNode;
  breadcrumbs?: Crumb[];
  /** Optional explicit "back to <parent>" link shown above the title. */
  back?: { label: string; href: string };
  primaryAction?: ReactNode;
  /** Items rendered inside an overflow "More" dropdown menu. */
  overflow?: ReactNode;
  /** A view/tab strip rendered just under the header card. */
  tabs?: ReactNode;
  /** Optional secondary actions rendered inline next to the primary action. */
  secondaryActions?: ReactNode;
  children: ReactNode;
  /** When true, the children render full-bleed (no padding card wrapper) — used by Pages/Chat/Tasks. */
  fullBleed?: boolean;
  contentClassName?: string;
};

export function PageShell({
  title,
  description,
  breadcrumbs,
  back,
  primaryAction,
  overflow,
  tabs,
  secondaryActions,
  children,
  fullBleed = false,
  contentClassName,
}: PageShellProps) {
  const { collapsed, setCollapsed, closeMobile } = useSidebarUI();
  const [location] = useLocation();

  // Auto-close mobile sidebar whenever the route changes.
  useEffect(() => {
    closeMobile();
  }, [location, closeMobile]);

  // Derive default breadcrumbs from the route when none provided.
  // Hierarchical pages (Tasks/Pages/Chat) pass explicit breadcrumbs.
  const effectiveCrumbs: Crumb[] | undefined =
    breadcrumbs ?? deriveCrumbsFromPath(location);

  const hasHeader =
    title || description || effectiveCrumbs?.length || primaryAction || secondaryActions || overflow || back;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800 transition-colors duration-300">
      <Header onToggleSidebar={() => setCollapsed(!collapsed)} />
      <div className="flex">
        <Sidebar isCollapsed={collapsed} />
        <main className="flex-1 min-w-0 p-4 space-y-4">
          {hasHeader && (
            <GlassCard className="p-4 sm:p-6">
              {back && (
                <Link href={back.href}>
                  <a className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground mb-2">
                    <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                    Back to {back.label}
                  </a>
                </Link>
              )}
              {effectiveCrumbs && effectiveCrumbs.length > 0 && (
                <Breadcrumb className="mb-2">
                  <BreadcrumbList>
                    {effectiveCrumbs.map((c, i) => {
                      const last = i === effectiveCrumbs!.length - 1;
                      return (
                        <span key={`${c.label}-${i}`} className="contents">
                          <BreadcrumbItem>
                            {last || !c.href ? (
                              <BreadcrumbPage>{c.label}</BreadcrumbPage>
                            ) : (
                              <BreadcrumbLink asChild>
                                <Link href={c.href}>{c.label}</Link>
                              </BreadcrumbLink>
                            )}
                          </BreadcrumbItem>
                          {!last && <BreadcrumbSeparator />}
                        </span>
                      );
                    })}
                  </BreadcrumbList>
                </Breadcrumb>
              )}
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="min-w-0">
                  {title && (
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white truncate">
                      {title}
                    </h1>
                  )}
                  {description && (
                    <p className="text-sm text-muted-foreground mt-1">{description}</p>
                  )}
                </div>
                {(primaryAction || secondaryActions || overflow) && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {secondaryActions}
                    {primaryAction}
                    {overflow && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label="More actions">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">{overflow}</DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                )}
              </div>
              {tabs && <div className="mt-4">{tabs}</div>}
            </GlassCard>
          )}

          <div className={cn(fullBleed ? "" : "", contentClassName)}>{children}</div>
        </main>
      </div>
      <FloatingTimer />
    </div>
  );
}
