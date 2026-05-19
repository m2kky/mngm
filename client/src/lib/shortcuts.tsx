import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

export type Shortcut = {
  id: string;
  keys: string;
  label: string;
  group: "Global" | "Navigation" | "Creation" | "Layout";
  handler: () => void;
  sequence?: string[];
};

type ShortcutsContextValue = {
  shortcuts: Shortcut[];
  register: (s: Shortcut) => () => void;
  showHelp: () => void;
  hideHelp: () => void;
  isHelpOpen: boolean;
};

const ShortcutsContext = createContext<ShortcutsContextValue | null>(null);

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if (target.isContentEditable) return true;
  return false;
}

export function ShortcutsProvider({ children }: { children: React.ReactNode }) {
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const pendingPrefix = useRef<string | null>(null);
  const prefixTimer = useRef<number | null>(null);

  const register = useCallback((s: Shortcut) => {
    setShortcuts((prev) => {
      if (prev.some((x) => x.id === s.id)) return prev;
      return [...prev, s];
    });
    return () => setShortcuts((prev) => prev.filter((x) => x.id !== s.id));
  }, []);

  const showHelp = useCallback(() => setIsHelpOpen(true), []);
  const hideHelp = useCallback(() => setIsHelpOpen(false), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Always allow Esc and Cmd/Ctrl+K — those are handled by their own listeners.
      if (e.defaultPrevented) return;
      if (isTypingTarget(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key;

      // Handle a pending sequence prefix (e.g. "G" then "D").
      if (pendingPrefix.current) {
        const seq = `${pendingPrefix.current} ${key.toLowerCase()}`;
        const match = shortcuts.find(
          (s) => s.sequence && s.sequence.join(" ").toLowerCase() === seq,
        );
        pendingPrefix.current = null;
        if (prefixTimer.current) window.clearTimeout(prefixTimer.current);
        if (match) {
          e.preventDefault();
          match.handler();
        }
        return;
      }

      // Check if this key starts any registered sequence.
      const startsSequence = shortcuts.some(
        (s) => s.sequence && s.sequence[0]?.toLowerCase() === key.toLowerCase(),
      );
      if (startsSequence) {
        e.preventDefault();
        pendingPrefix.current = key.toLowerCase();
        if (prefixTimer.current) window.clearTimeout(prefixTimer.current);
        prefixTimer.current = window.setTimeout(() => {
          pendingPrefix.current = null;
        }, 1200);
        return;
      }

      // Single-key shortcuts.
      const single = shortcuts.find((s) => !s.sequence && s.keys === key);
      if (single) {
        e.preventDefault();
        single.handler();
        return;
      }

      // "?" opens help.
      if (key === "?" || (e.shiftKey && key === "/")) {
        e.preventDefault();
        setIsHelpOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [shortcuts]);

  const value = useMemo<ShortcutsContextValue>(
    () => ({ shortcuts, register, showHelp, hideHelp, isHelpOpen }),
    [shortcuts, register, showHelp, hideHelp, isHelpOpen],
  );

  return <ShortcutsContext.Provider value={value}>{children}</ShortcutsContext.Provider>;
}

export function useShortcuts() {
  const ctx = useContext(ShortcutsContext);
  if (!ctx) throw new Error("useShortcuts must be used within ShortcutsProvider");
  return ctx;
}

export function useShortcut(s: Omit<Shortcut, "id"> & { id: string }) {
  const { register } = useShortcuts();
  const handlerRef = useRef(s.handler);
  handlerRef.current = s.handler;
  useEffect(() => {
    return register({
      ...s,
      handler: () => handlerRef.current(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.id, s.keys, s.label, s.group, register, s.sequence?.join("|")]);
}

export function formatKey(s: Shortcut): string {
  if (s.sequence) return s.sequence.map((k) => k.toUpperCase()).join(" then ");
  return s.keys.toUpperCase();
}
