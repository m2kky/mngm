import { createContext, useCallback, useContext, useMemo, useState } from "react";

type SidebarUIValue = {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  toggleCollapsed: () => void;
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
  openMobile: () => void;
  closeMobile: () => void;
};

const SidebarUIContext = createContext<SidebarUIValue | null>(null);

export function useSidebarUI() {
  const ctx = useContext(SidebarUIContext);
  if (!ctx) throw new Error("useSidebarUI must be used within SidebarUIProvider");
  return ctx;
}

export function SidebarUIProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleCollapsed = useCallback(() => setCollapsed((v) => !v), []);
  const openMobile = useCallback(() => setMobileOpen(true), []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);

  const value = useMemo<SidebarUIValue>(
    () => ({
      collapsed,
      setCollapsed,
      toggleCollapsed,
      mobileOpen,
      setMobileOpen,
      openMobile,
      closeMobile,
    }),
    [collapsed, mobileOpen, toggleCollapsed, openMobile, closeMobile],
  );

  return <SidebarUIContext.Provider value={value}>{children}</SidebarUIContext.Provider>;
}
