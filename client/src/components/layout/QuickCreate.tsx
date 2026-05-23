import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Plus, CheckSquare, FileText, UserPlus, Upload, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useShortcut } from "@/lib/shortcuts";

export type QuickCreateAction = "task" | "page" | "invite" | "file" | "channel";

type Ctx = {
  /** Run a specific create action immediately (used by command palette, etc). */
  trigger: (kind: QuickCreateAction) => void;
  /** Open the universal Quick-create chooser dialog. */
  openMenu: () => void;
};

const QuickCreateContext = createContext<Ctx | null>(null);

export function useQuickCreate() {
  const ctx = useContext(QuickCreateContext);
  if (!ctx) throw new Error("useQuickCreate must be used within QuickCreateProvider");
  return ctx;
}

const ACTIONS: Array<{
  kind: QuickCreateAction;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcut?: string;
}> = [
  { kind: "task",    label: "New task",      description: "Add a task to the current project board.", icon: CheckSquare, shortcut: "T" },
  { kind: "page",    label: "New page",      description: "Create a doc or folder in the workspace.", icon: FileText,    shortcut: "N" },
  { kind: "file",    label: "Upload file",   description: "Upload an asset to the Files library.",    icon: Upload },
  { kind: "channel", label: "New channel",   description: "Start a new chat channel.",                icon: Hash },
  { kind: "invite",  label: "Invite member", description: "Send an invite to your team.",             icon: UserPlus },
];

export function QuickCreateProvider({ children }: { children: React.ReactNode }) {
  const [, navigate] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const trigger = useCallback(
    (kind: QuickCreateAction) => {
      // The create modals live inside their target pages; we navigate
      // with a hash flag so the page can auto-open the right modal.
      if (kind === "task")    navigate("/tasks#new");
      else if (kind === "page")    navigate("/pages#new");
      else if (kind === "invite")  navigate("/team#invite");
      else if (kind === "file")    navigate("/files#upload");
      else if (kind === "channel") navigate("/chat#new");
    },
    [navigate],
  );

  const openMenu = useCallback(() => setMenuOpen(true), []);

  // `C` is the universal quick-create chooser. Direct-creation shortcuts
  // (e.g. T for task, N for page) are exposed *inside* the chooser dialog.
  useShortcut({
    id: "create.menu",
    keys: "c",
    label: "Quick create…",
    group: "Creation",
    handler: openMenu,
  });

  const value = useMemo(() => ({ trigger, openMenu }), [trigger, openMenu]);

  return (
    <QuickCreateContext.Provider value={value}>
      {children}
      <QuickCreateChooser
        open={menuOpen}
        onOpenChange={setMenuOpen}
        onPick={(kind) => {
          setMenuOpen(false);
          trigger(kind);
        }}
      />
    </QuickCreateContext.Provider>
  );
}

function QuickCreateChooser({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPick: (kind: QuickCreateAction) => void;
}) {
  // Single-key direct shortcuts while the chooser is focused.
  const onKeyDown = (e: React.KeyboardEvent) => {
    const k = e.key.toLowerCase();
    const hit = ACTIONS.find((a) => a.shortcut?.toLowerCase() === k);
    if (hit) {
      e.preventDefault();
      onPick(hit.kind);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" onKeyDown={onKeyDown}>
        <DialogHeader>
          <DialogTitle>Quick create</DialogTitle>
          <DialogDescription>What would you like to create?</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 mt-2">
          {ACTIONS.map((a) => {
            const Icon = a.icon;
            return (
              <button
                key={a.kind}
                type="button"
                onClick={() => onPick(a.kind)}
                data-testid={`quick-create-${a.kind}`}
                className="flex items-center gap-3 rounded-md border p-3 text-left hover:bg-muted/60 focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
              >
                <div className="rounded-md bg-muted p-2"><Icon className="h-4 w-4" /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-none">{a.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">{a.description}</p>
                </div>
                {a.shortcut && (
                  <kbd className="ml-2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                    {a.shortcut}
                  </kbd>
                )}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function QuickCreateButton({ collapsed = false }: { collapsed?: boolean }) {
  const { openMenu } = useQuickCreate();
  return (
    <Button
      size="sm"
      onClick={openMenu}
      className="w-full justify-start gap-2"
      data-testid="button-quick-create"
    >
      <Plus className="h-4 w-4" />
      {!collapsed && <span>Quick create</span>}
    </Button>
  );
}
