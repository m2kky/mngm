import React from "react";
import { render, RenderOptions } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createTestQueryClient } from "./query-client";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { SidebarUIProvider } from "@/contexts/SidebarUIContext";
import { CommandPaletteProvider } from "@/components/layout/CommandPalette";
import { ShortcutsProvider } from "@/lib/shortcuts";
import { DetailPanelProvider } from "@/components/detail/DetailPanel";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QuickCreateProvider } from "@/components/layout/QuickCreate";

interface CustomRenderOptions extends Omit<RenderOptions, "queries"> {
  route?: string;
}

export function renderWithProviders(
  ui: React.ReactElement,
  { route = "/", ...renderOptions }: CustomRenderOptions = {}
) {
  window.history.pushState({}, "Test page", route);
  const queryClient = createTestQueryClient();
  
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <ShortcutsProvider>
              <CommandPaletteProvider>
                <SidebarUIProvider>
                  <TooltipProvider>
                    <QuickCreateProvider>
                      <DetailPanelProvider>
                        {children}
                      </DetailPanelProvider>
                    </QuickCreateProvider>
                  </TooltipProvider>
                </SidebarUIProvider>
              </CommandPaletteProvider>
            </ShortcutsProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    );
  }
  
  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    queryClient,
  };
}
