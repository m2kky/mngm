import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Plus, CheckSquare, FileText, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useShortcut } from "@/lib/shortcuts";

type QuickCreateAction = "task" | "page" | "invite";

type Ctx = {
  trigger: (kind: QuickCreateAction) => void;
};

const QuickCreateContext = createContext<Ctx | null>(null);

export function useQuickCreate() {
  const ctx = useContext(QuickCreateContext);
  if (!ctx) throw new Error("useQuickCreate must be used within QuickCreateProvider");
  return ctx;
}

export function QuickCreateProvider({ children }: { children: React.ReactNode }) {
  const [, navigate] = useLocation();

  const trigger = useCallback(
    (kind: QuickCreateAction) => {
      // For now the create modals live inside their target pages; we navigate
      // with a hash flag so the page can auto-open the right modal.
      if (kind === "task") navigate("/tasks#new");
      else if (kind === "page") navigate("/pages#new");
      else if (kind === "invite") navigate("/team#invite");
    },
    [navigate],
  );

  useShortcut({
    id: "create.task",
    keys: "c",
    label: "Create task",
    group: "Creation",
    handler: () => trigger("task"),
  });
  useShortcut({
    id: "create.page",
    keys: "n",
    label: "Create page",
    group: "Creation",
    handler: () => trigger("page"),
  });

  const value = useMemo(() => ({ trigger }), [trigger]);

  return <QuickCreateContext.Provider value={value}>{children}</QuickCreateContext.Provider>;
}

export function QuickCreateButton({ collapsed = false }: { collapsed?: boolean }) {
  const { trigger } = useQuickCreate();
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          className="w-full justify-start gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-sm"
          data-testid="button-quick-create"
        >
          <Plus className="h-4 w-4" />
          {!collapsed && <span>Quick create</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuItem onClick={() => trigger("task")} className="gap-2">
          <CheckSquare className="h-4 w-4" />
          New task
          <span className="ml-auto text-xs text-muted-foreground">C</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => trigger("page")} className="gap-2">
          <FileText className="h-4 w-4" />
          New page
          <span className="ml-auto text-xs text-muted-foreground">N</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => trigger("invite")} className="gap-2">
          <UserPlus className="h-4 w-4" />
          Invite member
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
