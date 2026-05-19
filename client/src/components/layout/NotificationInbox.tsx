import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { Bell, CheckCheck, Inbox } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/useAuth";

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

export function NotificationInbox() {
  const { userProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["/api/notifications", { limit: 50 }],
    queryFn: async () => {
      const res = await fetch("/api/notifications?limit=50", {
        headers: { Authorization: `Bearer ${localStorage.getItem("wk_token") ?? ""}` },
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
        /* ignore */
      }
    };
    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [userProfile]);

  const unread = notifications.filter((n) => !n.readAt);
  const read = notifications.filter((n) => n.readAt);

  const renderItem = (n: Notification) => {
    const isUnread = !n.readAt;
    const inner = (
      <div
        className={`flex items-start gap-3 px-4 py-3 hover:bg-accent/50 cursor-pointer border-b border-border/40 ${
          isUnread ? "bg-accent/20" : ""
        }`}
        onClick={() => {
          if (isUnread) markRead.mutate(n.id);
          setOpen(false);
        }}
        data-testid={`notification-${n.id}`}
      >
        <div className="mt-1 shrink-0">
          {isUnread ? (
            <span className="block w-2 h-2 rounded-full bg-indigo-500" />
          ) : (
            <span className="block w-2 h-2 rounded-full bg-transparent" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{n.title}</p>
          {n.body && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
          )}
          <p className="text-[11px] text-muted-foreground mt-1">{timeAgo(n.createdAt)}</p>
        </div>
      </div>
    );
    return n.deepLink ? (
      <Link key={n.id} href={n.deepLink}>
        {inner}
      </Link>
    ) : (
      <div key={n.id}>{inner}</div>
    );
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
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
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b">
          <div className="flex items-center justify-between gap-2">
            <SheetTitle>Inbox</SheetTitle>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
                className="h-7 text-xs gap-1"
                data-testid="button-mark-all-read"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </Button>
            )}
          </div>
        </SheetHeader>
        <ScrollArea className="flex-1">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-6">
              <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-3">
                <Inbox className="h-7 w-7 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">You're all caught up</p>
              <p className="text-xs text-muted-foreground mt-1">
                New notifications will show up here.
              </p>
            </div>
          ) : (
            <div>
              {unread.length > 0 && (
                <div>
                  <h4 className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Unread · {unread.length}
                  </h4>
                  {unread.map(renderItem)}
                </div>
              )}
              {read.length > 0 && (
                <div>
                  <h4 className="px-4 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Earlier
                  </h4>
                  {read.map(renderItem)}
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
