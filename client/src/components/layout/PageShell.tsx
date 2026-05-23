import { ReactNode, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { ChevronLeft, MoreHorizontal } from "lucide-react";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { FloatingTimer } from "./FloatingTimer";
import { FloatingChat } from "./FloatingChat";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSidebarUI } from "@/contexts/SidebarUIContext";
import { cn } from "@/lib/utils";

export type Crumb = {
  label: string;
  href?: string;
};

const SECTION_FOR_PATH: Record<string, { section: string; label: string }> = {
  dashboard:  { section: "Workspace",     label: "Dashboard" },
  tasks:      { section: "Work",          label: "Tasks" },
  pages:      { section: "Work",          label: "Pages" },
  files:      { section: "Work",          label: "Files" },
  chat:       { section: "Communication", label: "Chat" },
  attendance: { section: "Insights",      label: "Attendance" },
  reports:    { section: "Insights",      label: "Reports" },
  team:       { section: "Insights",      label: "Team" },
  settings:   { section: "Workspace",     label: "Settings" },
  profile:    { section: "Workspace",     label: "Profile" },
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
  back?: { label: string; href: string };
  primaryAction?: ReactNode;
  overflow?: ReactNode;
  tabs?: ReactNode;
  secondaryActions?: ReactNode;
  children: ReactNode;
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

  useEffect(() => {
    closeMobile();
  }, [location, closeMobile]);

  const effectiveCrumbs: Crumb[] | undefined =
    breadcrumbs ?? deriveCrumbsFromPath(location);

  const hasHeader =
    title || description || effectiveCrumbs?.length || primaryAction || secondaryActions || overflow || back;

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      <Header onToggleSidebar={() => setCollapsed(!collapsed)} />

      <div className="flex flex-1 min-h-0">
        <Sidebar isCollapsed={collapsed} />

        <main className="flex-1 min-w-0 p-4 md:p-5 space-y-4 overflow-auto">
          {hasHeader && (
            <div className="bg-background border border-border rounded-xl shadow-sm px-5 py-4">
              {back && (
                <Link
                  href={back.href}
                  className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground mb-2 transition-colors"
                >
                  <ChevronLeft className="h-3.5 w-3.5 mr-0.5" />
                  Back to {back.label}
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
                    <h1 className="text-[22px] font-semibold text-foreground truncate tracking-tight">
                      {title}
                    </h1>
                  )}
                  {description && (
                    <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
                  )}
                </div>
                {(primaryAction || secondaryActions || overflow) && (
                  <div className="flex items-center gap-2 flex-wrap shrink-0">
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

              {tabs && <div className="mt-3 -mb-1">{tabs}</div>}
            </div>
          )}

          <div className={cn(contentClassName, "flex flex-1 flex-col overflow-hidden")}>
            {children}
          </div>
        </main>
      </div>

      <FloatingTimer />
      <FloatingChat />
    </div>
  );
}
