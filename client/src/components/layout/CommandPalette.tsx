import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  Home,
  CheckSquare,
  FileText,
  Folder,
  MessageCircle,
  Clock,
  BarChart3,
  Users,
  Settings2,
  Plus,
  FilePlus,
  UserPlus,
  Sun,
  Moon,
  Languages,
  LogOut,
  Hash,
  File as FileIcon,
  User as UserIcon,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { useShortcut } from "@/lib/shortcuts";

type SearchResults = {
  tasks: { id: string; title: string; projectId: string }[];
  pages: { id: string; title: string; isFolder: boolean }[];
  files: { id: string; fileName: string; fileUrl: string }[];
  channels: { id: string; name: string }[];
  users: { id: string; name: string | null; email: string }[];
};

type RecentItem = {
  id: string;
  label: string;
  path: string;
  kind: string;
  at: number;
};

const RECENTS_KEY = "wk_palette_recent";
const MAX_RECENTS = 8;

function loadRecents(): RecentItem[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveRecent(item: Omit<RecentItem, "at">) {
  try {
    const list = loadRecents().filter((r) => r.id !== item.id);
    list.unshift({ ...item, at: Date.now() });
    localStorage.setItem(RECENTS_KEY, JSON.stringify(list.slice(0, MAX_RECENTS)));
  } catch {
    /* ignore */
  }
}

type PaletteContextValue = {
  open: () => void;
  openWithQuery: (q: string) => void;
  close: () => void;
  isOpen: boolean;
};

const PaletteContext = createContext<PaletteContextValue | null>(null);

export function useCommandPalette() {
  const ctx = useContext(PaletteContext);
  if (!ctx) throw new Error("useCommandPalette must be used within CommandPaletteProvider");
  return ctx;
}

const NAV_ITEMS = [
  { id: "nav-dashboard", label: "Dashboard", path: "/dashboard", icon: Home, key: "d" },
  { id: "nav-tasks", label: "Tasks", path: "/tasks", icon: CheckSquare, key: "t" },
  { id: "nav-pages", label: "Pages", path: "/pages", icon: FileText, key: "p" },
  { id: "nav-files", label: "Files", path: "/files", icon: Folder, key: "f" },
  { id: "nav-chat", label: "Chat", path: "/chat", icon: MessageCircle, key: "c" },
  { id: "nav-attendance", label: "Attendance", path: "/attendance", icon: Clock, key: "a" },
  { id: "nav-reports", label: "Reports", path: "/reports", icon: BarChart3, key: "r" },
  { id: "nav-team", label: "Team", path: "/team", icon: Users, key: "m" },
  { id: "nav-settings", label: "Settings", path: "/settings", icon: Settings2, key: "s" },
];

type QuickCreateAction = "task" | "page" | "invite";
type DetailKind = "task" | "page" | "file" | "member" | "channel";

type ProviderProps = {
  children: React.ReactNode;
  onQuickCreate?: (kind: QuickCreateAction) => void;
  onOpenDetail?: (kind: DetailKind, id: string) => void;
};

export function CommandPaletteProvider({ children, onQuickCreate, onOpenDetail }: ProviderProps) {
  const [, navigate] = useLocation();
  const { logout, userProfile } = useAuth();
  const { theme, setTheme, language, setLanguage } = useTheme();
  // CLIENT-role users must not see workspace search/navigation. We still
  // render the provider so descendants can safely call useCommandPalette(),
  // but the open/keyboard handlers are no-ops and the dialog is not mounted.
  const isClient = userProfile?.role === "CLIENT";
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>({
    tasks: [],
    pages: [],
    files: [],
    channels: [],
    users: [],
  });
  const [recents, setRecents] = useState<RecentItem[]>([]);

  useEffect(() => {
    if (open) setRecents(loadRecents());
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (!open || isClient) return;
    const q = query.trim();
    if (!q) {
      setResults({ tasks: [], pages: [], files: [], channels: [], users: [] });
      return;
    }
    const ctl = new AbortController();
    const t = window.setTimeout(async () => {
      try {
        const token = localStorage.getItem("wk_token") ?? "";
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=6`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: ctl.signal,
        });
        if (!res.ok) return;
        const data = (await res.json()) as SearchResults;
        setResults(data);
      } catch {
        /* ignore */
      }
    }, 180);
    return () => {
      ctl.abort();
      window.clearTimeout(t);
    };
  }, [query, open]);

  const handleOpen = useCallback(() => {
    if (isClient) return;
    setQuery("");
    setOpen(true);
  }, [isClient]);
  const handleClose = useCallback(() => setOpen(false), []);
  const openWithQuery = useCallback((q: string) => {
    if (isClient) return;
    setQuery(q);
    setOpen(true);
  }, [isClient]);

  // Global Cmd/Ctrl+K
  useEffect(() => {
    if (isClient) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isClient]);

  // "/" focuses search => open palette
  useShortcut({
    id: "global.focus-search",
    keys: "/",
    label: "Focus search",
    group: "Global",
    handler: handleOpen,
  });

  const value = useMemo<PaletteContextValue>(
    () => ({ open: handleOpen, openWithQuery, close: handleClose, isOpen: open }),
    [handleOpen, openWithQuery, handleClose, open],
  );

  const go = (path: string, label: string, kind: string, id?: string) => {
    saveRecent({ id: id ?? path, label, path, kind });
    navigate(path);
    setOpen(false);
  };

  // Open an entity in the universal slide-over detail panel, recording it
  // in recents and closing the palette. Path is recorded for recents only.
  const openEntity = (kind: DetailKind, id: string, label: string, recentPath: string) => {
    saveRecent({ id, label, path: recentPath, kind });
    onOpenDetail?.(kind, id);
    setOpen(false);
  };

  const runAction = (fn: () => void) => {
    fn();
    setOpen(false);
  };

  const trimmed = query.trim();
  const hasResults =
    results.tasks.length +
      results.pages.length +
      results.files.length +
      results.channels.length +
      results.users.length >
    0;

  if (isClient) {
    const clientValue: PaletteContextValue = {
      open: () => {},
      openWithQuery: () => {},
      close: () => {},
      isOpen: false,
    };
    return (
      <PaletteContext.Provider value={clientValue}>{children}</PaletteContext.Provider>
    );
  }

  return (
    <PaletteContext.Provider value={value}>
      {children}
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Search or jump to…"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>

          {!trimmed && recents.length > 0 && (
            <>
              <CommandGroup heading="Recent">
                {recents.map((r) => (
                  <CommandItem
                    key={r.id}
                    value={`recent-${r.id}`}
                    onSelect={() => go(r.path, r.label, r.kind, r.id)}
                  >
                    <Clock className="text-muted-foreground" />
                    <span>{r.label}</span>
                    <span className="ml-auto text-xs text-muted-foreground capitalize">{r.kind}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
            </>
          )}

          <CommandGroup heading="Navigate">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <CommandItem
                  key={item.id}
                  value={`nav ${item.label}`}
                  onSelect={() => go(item.path, item.label, "page")}
                >
                  <Icon />
                  <span>{item.label}</span>
                  {item.key && <CommandShortcut>G {item.key.toUpperCase()}</CommandShortcut>}
                </CommandItem>
              );
            })}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Actions">
            <CommandItem
              value="action create task"
              onSelect={() => runAction(() => onQuickCreate?.("task"))}
            >
              <Plus />
              <span>Create task</span>
              <CommandShortcut>C</CommandShortcut>
            </CommandItem>
            <CommandItem
              value="action create page"
              onSelect={() => runAction(() => onQuickCreate?.("page"))}
            >
              <FilePlus />
              <span>Create page</span>
              <CommandShortcut>N</CommandShortcut>
            </CommandItem>
            <CommandItem
              value="action invite member"
              onSelect={() => runAction(() => onQuickCreate?.("invite"))}
            >
              <UserPlus />
              <span>Invite member</span>
            </CommandItem>
            <CommandItem
              value="action toggle theme"
              onSelect={() =>
                runAction(() => setTheme(theme === "dark" ? "light" : "dark"))
              }
            >
              {theme === "dark" ? <Sun /> : <Moon />}
              <span>Toggle theme ({theme === "dark" ? "Light" : "Dark"})</span>
            </CommandItem>

            <CommandItem
              value="action sign out"
              onSelect={() => runAction(() => void logout())}
              className="text-red-600"
            >
              <LogOut />
              <span>Sign out</span>
            </CommandItem>
          </CommandGroup>

          {trimmed && hasResults && (
            <>
              <CommandSeparator />
              {results.tasks.length > 0 && (
                <CommandGroup heading="Tasks">
                  {results.tasks.map((t) => (
                    <CommandItem
                      key={`task-${t.id}`}
                      value={`task ${t.title} ${t.id}`}
                      onSelect={() => openEntity("task", t.id, t.title, `/tasks?project=${t.projectId}`)}
                    >
                      <CheckSquare />
                      <span className="truncate">{t.title}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {results.pages.length > 0 && (
                <CommandGroup heading="Pages">
                  {results.pages.map((p) => (
                    <CommandItem
                      key={`page-${p.id}`}
                      value={`page ${p.title} ${p.id}`}
                      onSelect={() => openEntity("page", p.id, p.title || "Untitled", `/pages?id=${p.id}`)}
                    >
                      {p.isFolder ? <Folder /> : <FileText />}
                      <span className="truncate">{p.title || "Untitled"}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {results.files.length > 0 && (
                <CommandGroup heading="Files">
                  {results.files.map((f) => (
                    <CommandItem
                      key={`file-${f.id}`}
                      value={`file ${f.fileName} ${f.id}`}
                      onSelect={() => openEntity("file", f.id, f.fileName, "/files")}
                    >
                      <FileIcon />
                      <span className="truncate">{f.fileName}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {results.channels.length > 0 && (
                <CommandGroup heading="Channels">
                  {results.channels.map((c) => (
                    <CommandItem
                      key={`channel-${c.id}`}
                      value={`channel ${c.name} ${c.id}`}
                      onSelect={() => openEntity("channel", c.id, `#${c.name}`, "/chat")}
                    >
                      <Hash />
                      <span className="truncate">{c.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {results.users.length > 0 && (
                <CommandGroup heading="People">
                  {results.users.map((u) => (
                    <CommandItem
                      key={`user-${u.id}`}
                      value={`user ${u.name ?? ""} ${u.email} ${u.id}`}
                      onSelect={() => openEntity("member", u.id, u.name ?? u.email, "/team")}
                    >
                      <UserIcon />
                      <span className="truncate">{u.name ?? u.email}</span>
                      {u.name && (
                        <span className="ml-auto text-xs text-muted-foreground truncate">{u.email}</span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </>
          )}
        </CommandList>
      </CommandDialog>
    </PaletteContext.Provider>
  );
}
