import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  Search, Moon, Sun, Menu, LogOut,
  Settings, User, Keyboard,
} from "lucide-react";
import { NotificationInbox } from "./NotificationInbox";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
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
    <nav className="sticky top-0 z-40 h-14 flex items-center px-4 gap-3 bg-background/95 backdrop-blur-md border-b border-border">
      <div className="flex items-center gap-2 min-w-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleToggleSidebar}
              className="p-2 shrink-0"
              aria-label="Toggle sidebar"
              data-testid="button-toggle-sidebar"
            >
              <Menu className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Toggle sidebar ([)</TooltipContent>
        </Tooltip>

        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-[8px] bg-primary flex items-center justify-center shrink-0">
            <span className="text-primary-foreground font-semibold text-xs">W</span>
          </div>
          <span className="text-[15px] font-semibold text-foreground hidden sm:block tracking-tight">
            Workit.OS
          </span>
        </Link>
      </div>

      {/* Search */}
      <div className="flex-1 flex justify-center">
        <div className="hidden md:flex items-center gap-2 h-8 px-3 rounded-lg bg-muted border border-border hover:border-border/80 transition-colors w-full max-w-md focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary/50">
          <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => {
              setSearchValue(e.target.value);
              if (e.target.value) openWithQuery(e.target.value);
            }}
            onFocus={() => openPalette()}
            placeholder="Search…"
            className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground outline-none min-w-0"
            data-testid="input-header-search"
            aria-label="Search"
          />
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-background border border-border text-muted-foreground shrink-0">
            ⌘K
          </kbd>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openPalette()}
              className="md:hidden p-2"
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
              className="p-2"
              aria-label="Toggle theme"
            >
              {theme === "dark"
                ? <Sun className="h-4 w-4" />
                : <Moon className="h-4 w-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Toggle theme</TooltipContent>
        </Tooltip>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleLanguageToggle}
          className="p-2 text-sm font-medium"
          aria-label="Switch language"
        >
          {language === "en" ? "عر" : "EN"}
        </Button>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={showHelp}
              className="p-2 hidden sm:inline-flex"
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
            <Button variant="ghost" className="p-1 rounded-full h-auto">
              <div className="flex items-center gap-2">
                <Avatar className="w-7 h-7">
                  <AvatarImage src={userProfile?.image || ""} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                    {userProfile?.name?.charAt(0) || "U"}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium text-foreground hidden md:block">
                  {userProfile?.name || "User"}
                </span>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={isRTL ? "start" : "end"} className="w-56">
            <DropdownMenuItem asChild>
              <Link href="/profile" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span>Profile</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                <span>Settings</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={showHelp} className="flex items-center gap-2">
              <Keyboard className="h-4 w-4" />
              <span>Keyboard shortcuts</span>
              <span className="ml-auto text-xs text-muted-foreground">?</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="flex items-center gap-2 text-destructive focus:text-destructive">
              <LogOut className="h-4 w-4" />
              <span>Sign out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}
