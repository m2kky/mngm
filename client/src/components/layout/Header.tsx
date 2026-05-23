import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  Search,
  Moon,
  Sun,
  Menu,
  LogOut,
  Settings,
  User,
  Keyboard,
} from "lucide-react";
import { NotificationInbox } from "./NotificationInbox";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useCommandPalette } from "./CommandPalette";
import { useShortcuts } from "@/lib/shortcuts";
import { useSidebarUI } from "@/contexts/SidebarUIContext";
import { useIsMobile } from "@/hooks/use-mobile";

interface HeaderProps {
  onToggleSidebar?: () => void;
}

export function Header({ onToggleSidebar }: HeaderProps) {
  const { userProfile, logout } = useAuth();
  const { theme, setTheme, language, setLanguage, isRTL } = useTheme();
  const { open: openPalette, openWithQuery, isOpen: paletteOpen } = useCommandPalette();
  const { showHelp } = useShortcuts();
  const { openMobile, toggleCollapsed } = useSidebarUI();
  const isMobile = useIsMobile();
  const [searchValue, setSearchValue] = useState("");

  // Clear the visible search text whenever the palette closes so the field
  // doesn't show a stale query the next time the user opens it.
  useEffect(() => {
    if (!paletteOpen) setSearchValue("");
  }, [paletteOpen]);

  const handleThemeToggle = () => setTheme(theme === "dark" ? "light" : "dark");
  const handleLanguageToggle = () => setLanguage(language === "en" ? "ar" : "en");

  const handleToggleSidebar = () => {
    if (isMobile) openMobile();
    else if (onToggleSidebar) onToggleSidebar();
    else toggleCollapsed();
  };

  return (
    <nav className="sticky top-0 z-40 p-4 mx-4 mt-4">
      <GlassCard className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center space-x-3 min-w-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleToggleSidebar}
                  className="p-2 hover:bg-white/10 shrink-0"
                  aria-label="Toggle sidebar"
                  data-testid="button-toggle-sidebar"
                >
                  <Menu className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Toggle sidebar ([)</TooltipContent>
            </Tooltip>

            <Link href="/dashboard" className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center">
                <span className="text-white font-bold text-sm">W</span>
              </div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent hidden sm:block">
                Workit.OS
              </h1>
            </Link>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Search input — opens the command palette in search mode */}
            <div className="hidden md:flex items-center gap-2 h-9 px-3 rounded-md bg-white/10 hover:bg-white/15 border border-white/20 transition-colors min-w-[260px] focus-within:ring-2 focus-within:ring-indigo-300/40">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={searchValue}
                onChange={(e) => {
                  setSearchValue(e.target.value);
                  if (e.target.value) openWithQuery(e.target.value);
                }}
                onFocus={() => openPalette()}
                placeholder="Search anything…"
                className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground outline-none"
                data-testid="input-header-search"
                aria-label="Search"
              />
              <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted/60 border border-border/50">
                ⌘K
              </kbd>
            </div>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openPalette()}
                  className="md:hidden p-2 hover:bg-white/10"
                  aria-label="Search"
                >
                  <Search className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Search (⌘K)</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleThemeToggle}
                  className="p-2 hover:bg-white/10"
                  aria-label="Toggle theme"
                >
                  {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Toggle theme</TooltipContent>
            </Tooltip>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleLanguageToggle}
              className="p-2 hover:bg-white/10"
              aria-label="Switch language"
            >
              <span className="text-sm font-medium">{language === "en" ? "عر" : "EN"}</span>
            </Button>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={showHelp}
                  className="p-2 hover:bg-white/10 hidden sm:inline-flex"
                  aria-label="Keyboard shortcuts"
                >
                  <Keyboard className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Keyboard shortcuts (?)</TooltipContent>
            </Tooltip>

            <NotificationInbox />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="p-0 hover:bg-white/10 rounded-full">
                  <div className="flex items-center space-x-2 p-1">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={userProfile?.image || ""} />
                      <AvatarFallback className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
                        {userProfile?.name?.charAt(0) || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 hidden md:block">
                      {userProfile?.name || "User"}
                    </span>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align={isRTL ? "start" : "end"} className="w-56">
                <DropdownMenuItem asChild>
                  <Link href="/profile" className="flex items-center space-x-2">
                    <User className="h-4 w-4" />
                    <span>Profile</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="flex items-center space-x-2">
                    <Settings className="h-4 w-4" />
                    <span>Settings</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={showHelp} className="flex items-center space-x-2">
                  <Keyboard className="h-4 w-4" />
                  <span>Keyboard shortcuts</span>
                  <span className="ml-auto text-xs text-muted-foreground">?</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="flex items-center space-x-2 text-red-600">
                  <LogOut className="h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </GlassCard>
    </nav>
  );
}
