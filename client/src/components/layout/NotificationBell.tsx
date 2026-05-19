import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { Bell, Check, CheckCheck } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  deepLink: string | null;
  readAt: string | null;
  createdAt: string;
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function NotificationBell() {
  const { userProfile } = useAuth();
  const { isRTL } = useTheme();
  const [open, setOpen] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["/api/notifications", { limit: 20 }],
    queryFn: async () => {
      const res = await fetch("/api/notifications?limit=20", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("wk_token") ?? ""}`,
        },
      });
      if (!res.ok) throw new Error("Failed to load notifications");
      return res.json();
    },
    enabled: !!userProfile,
    staleTime: 30_000,
  });

  const { data: countData } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    enabled: !!userProfile,
    staleTime: 30_000,
  });
  const unreadCount = countData?.count ?? 0;

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("PATCH", `/api/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", "/api/notifications/read-all");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  // Live updates: open a WS connection authenticated with the user's JWT and
  // refetch lists whenever the server pushes a notification.
  useEffect(() => {
    if (!userProfile) return;
    const token = localStorage.getItem("wk_token");
    if (!token) return;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(
      `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}`,
    );
    wsRef.current = ws;
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "notification") {
          queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
          queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
        }
      } catch {
        // ignore
      }
    };
    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [userProfile]);

  const handleItemClick = (n: Notification) => {
    if (!n.readAt) markRead.mutate(n.id);
    setOpen(false);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="p-2 hover:bg-white/10 relative"
          data-testid="button-notifications"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span
              className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center"
              data-testid="badge-notification-count"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={isRTL ? "start" : "end"}
        className="w-80 p-0"
        data-testid="menu-notifications"
      >
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <span className="text-sm font-semibold">Notifications</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
              data-testid="button-mark-all-read"
            >
              <CheckCheck className="h-3 w-3 mr-1" />
              Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-96">
          {notifications.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              You're all caught up.
            </div>
          ) : (
            <ul className="divide-y">
              {notifications.map((n) => {
                const unread = !n.readAt;
                const inner = (
                  <div
                    className={`flex items-start gap-2 px-3 py-2.5 hover:bg-accent/50 cursor-pointer ${
                      unread ? "bg-accent/20" : ""
                    }`}
                    onClick={() => handleItemClick(n)}
                    data-testid={`notification-${n.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {unread && (
                          <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                        )}
                        <p className="text-sm font-medium truncate">{n.title}</p>
                      </div>
                      {n.body && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {n.body}
                        </p>
                      )}
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {timeAgo(n.createdAt)}
                      </p>
                    </div>
                    {!unread && (
                      <Check className="h-3 w-3 text-muted-foreground shrink-0 mt-1" />
                    )}
                  </div>
                );
                return (
                  <li key={n.id}>
                    {n.deepLink ? (
                      <Link href={n.deepLink}>{inner}</Link>
                    ) : (
                      inner
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
