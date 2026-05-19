import { useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { SidebarUIProvider } from "./contexts/SidebarUIContext";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "./hooks/useAuth";
import { ShortcutsProvider } from "@/lib/shortcuts";
import { CommandPaletteProvider } from "@/components/layout/CommandPalette";
import { QuickCreateProvider, useQuickCreate } from "@/components/layout/QuickCreate";
import { ShortcutsHelp } from "@/components/layout/ShortcutsHelp";

import Dashboard from "@/pages/Dashboard";
import Login from "@/pages/Login";
import Onboarding from "@/pages/Onboarding";
import Tasks from "@/pages/Tasks";
import Chat from "@/pages/Chat";
import Attendance from "@/pages/Attendance";
import Reports from "@/pages/Reports";
import Files from "@/pages/Files";
import Pages from "@/pages/Pages";
import Team from "@/pages/Team";
import ClientPortalPage from "@/pages/ClientPortalPage";
import Settings from "@/pages/Settings";
import NotFound from "@/pages/not-found";

function LoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800">
      <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
    </div>
  );
}

function ClientRoute({ children }: { children: React.ReactNode }) {
  const { currentUser, userProfile, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && currentUser && userProfile?.agencyId && userProfile.role !== "CLIENT") {
      navigate("/dashboard");
    }
  }, [loading, currentUser, userProfile, navigate]);

  if (loading) return <LoadingSpinner />;
  if (!currentUser) return <Login />;
  if (!userProfile?.agencyId) return <Onboarding />;
  if (userProfile.role !== "CLIENT") return null;

  return <>{children}</>;
}

function InternalRoute({ children }: { children: React.ReactNode }) {
  const { currentUser, userProfile, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && currentUser && userProfile?.agencyId && userProfile.role === "CLIENT") {
      navigate("/client-portal");
    }
  }, [loading, currentUser, userProfile, navigate]);

  if (loading) return <LoadingSpinner />;
  if (!currentUser) return <Login />;
  if (!userProfile?.agencyId) return <Onboarding />;
  if (userProfile.role === "CLIENT") return null;

  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/client-portal">
        <ClientRoute>
          <ClientPortalPage />
        </ClientRoute>
      </Route>
      <Route path="/">
        <InternalRoute>
          <Dashboard />
        </InternalRoute>
      </Route>
      <Route path="/dashboard">
        <InternalRoute>
          <Dashboard />
        </InternalRoute>
      </Route>
      <Route path="/tasks">
        <InternalRoute>
          <Tasks />
        </InternalRoute>
      </Route>
      <Route path="/pages">
        <InternalRoute>
          <Pages />
        </InternalRoute>
      </Route>
      <Route path="/files">
        <InternalRoute>
          <Files />
        </InternalRoute>
      </Route>
      <Route path="/chat">
        <InternalRoute>
          <Chat />
        </InternalRoute>
      </Route>
      <Route path="/attendance">
        <InternalRoute>
          <Attendance />
        </InternalRoute>
      </Route>
      <Route path="/reports">
        <InternalRoute>
          <Reports />
        </InternalRoute>
      </Route>
      <Route path="/team">
        <InternalRoute>
          <Team />
        </InternalRoute>
      </Route>
      <Route path="/settings">
        <InternalRoute>
          <Settings />
        </InternalRoute>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function PaletteShellBridge({ children }: { children: React.ReactNode }) {
  // Inside QuickCreateProvider, we wire the palette's quick-create callback to
  // the same triggers exposed elsewhere in the app.
  const { trigger } = useQuickCreate();
  return (
    <CommandPaletteProvider onQuickCreate={trigger}>
      <ShortcutsHelp />
      {children}
    </CommandPaletteProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider delayDuration={200}>
            <SidebarUIProvider>
              <ShortcutsProvider>
                <QuickCreateProvider>
                  <PaletteShellBridge>
                    <Toaster />
                    <Router />
                  </PaletteShellBridge>
                </QuickCreateProvider>
              </ShortcutsProvider>
            </SidebarUIProvider>
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
