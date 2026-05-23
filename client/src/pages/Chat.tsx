import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Hash, Plus, Send, MessageCircle, Lock, SmilePlus, ChevronLeft, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { PageShell } from "@/components/layout/PageShell";
import { SmartTextarea } from "@/components/ui/smart-textarea";
import { MentionRenderer } from "@/components/ui/mention-renderer";
import EmojiPicker, { EmojiClickData, Theme } from "emoji-picker-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface Channel {
  id: string;
  name: string;
  description?: string | null;
  type: string;
  agencyId: string;
  createdById?: string | null;
  createdAt: string;
}

interface Sender {
  id: string;
  name: string;
  avatarUrl?: string | null;
}

interface Message {
  id: string;
  content: string;
  channelId: string;
  userId: string;
  createdAt: string;
  sender?: Sender | null;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return (
    d.toLocaleDateString([], { month: "short", day: "numeric" }) +
    " " +
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  );
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const PRESET_STICKERS = [
  "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Partying%20Face.png",
  "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Red%20Heart.png",
  "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Travel%20and%20places/Fire.png",
  "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Hand%20gestures/Thumbs%20Up.png",
  "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Star-Struck.png"
];

export function ChatInterface({ isCompact = false }: { isCompact?: boolean }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelDesc, setNewChannelDesc] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [showMobileList, setShowMobileList] = useState(true);

  // ── Fetch channels ──────────────────────────────────────────────────────────
  const { data: channels = [] } = useQuery<Channel[]>({
    queryKey: ["/api/chat/channels"],
  });

  // Auto-select first channel
  useEffect(() => {
    if (channels.length > 0 && !activeChannelId) {
      setActiveChannelId(channels[0].id);
      setShowMobileList(false);
    }
  }, [channels, activeChannelId]);

  // ── Fetch messages ──────────────────────────────────────────────────────────
  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ["/api/chat/channels", activeChannelId, "messages"],
    queryFn: async () => {
      if (!activeChannelId) return [];
      const res = await fetch(`/api/chat/channels/${activeChannelId}/messages`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("wk_token")}` },
      });
      if (!res.ok) throw new Error("Failed to load messages");
      return res.json();
    },
    enabled: !!activeChannelId,
  });

  // ── Auto-scroll to bottom ───────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── WebSocket for real-time delivery ───────────────────────────────────────
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "chat_message") {
          qc.setQueryData<Message[]>(
            ["/api/chat/channels", data.channelId, "messages"],
            (old = []) => {
              if (old.find((m) => m.id === data.message.id)) return old;
              return [...old, data.message];
            }
          );
        }
      } catch {}
    };

    return () => ws.close();
  }, [qc]);

  // ── Send message ────────────────────────────────────────────────────────────
  const sendMutation = useMutation({
    mutationFn: (content: string) =>
      apiRequest("POST", `/api/chat/channels/${activeChannelId}/messages`, { content }).then((r) => r.json() as Promise<Message>),
    onSuccess: (newMsg: Message) => {
      qc.setQueryData<Message[]>(
        ["/api/chat/channels", activeChannelId, "messages"],
        (old = []) => (old.find((m) => m.id === newMsg.id) ? old : [...old, newMsg])
      );
    },
    onError: () => toast({ title: "Failed to send message", variant: "destructive" }),
  });

  const handleSend = useCallback(() => {
    const content = draft.trim();
    if (!content || !activeChannelId) return;
    setDraft("");
    sendMutation.mutate(content);
  }, [draft, activeChannelId, sendMutation]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSendSticker = (url: string) => {
    if (!activeChannelId) return;
    sendMutation.mutate(`[STICKER:${url}]`);
  };

  const onEmojiClick = (emojiData: EmojiClickData) => {
    setDraft((prev) => prev + emojiData.emoji);
    inputRef.current?.focus();
  };

  // ── Create channel ──────────────────────────────────────────────────────────
  const createChannelMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/chat/channels", {
        name: newChannelName.toLowerCase().replace(/\s+/g, "-"),
        description: newChannelDesc || undefined,
        type: "channel",
      }).then((r) => r.json() as Promise<Channel>),
    onSuccess: (channel: Channel) => {
      qc.invalidateQueries({ queryKey: ["/api/chat/channels"] });
      setActiveChannelId(channel.id);
      setShowMobileList(false);
      setShowNewChannel(false);
      setNewChannelName("");
      setNewChannelDesc("");
    },
    onError: () => toast({ title: "Failed to create channel", variant: "destructive" }),
  });

  const activeChannel = channels.find((c) => c.id === activeChannelId);

  // Group consecutive messages from the same sender (within 5 min)
  const messageGroups = messages.reduce<{ msgs: Message[]; key: string }[]>((groups, msg, i) => {
    const prev = messages[i - 1];
    const sameUser =
      prev?.userId === msg.userId &&
      new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60 * 1000;
    if (sameUser) {
      groups[groups.length - 1].msgs.push(msg);
    } else {
      groups.push({ msgs: [msg], key: msg.id });
    }
    return groups;
  }, []);

  const selectChannel = (id: string) => {
    setActiveChannelId(id);
    if (isCompact) setShowMobileList(false);
  };

  const sidebarVisible = !isCompact || showMobileList;
  const mainVisible = !isCompact || !showMobileList;

  return (
    <div className={cn("flex h-full overflow-hidden bg-background", isCompact ? "" : "min-h-[70vh] rounded-xl border")}>
      {/* ── Channel list sidebar ────────────────────────────────────────── */}
      {sidebarVisible && (
        <aside className={cn("flex-shrink-0 border-r bg-muted/20 flex flex-col transition-all", isCompact ? "w-full" : "w-60")}>
          <ScrollArea className="flex-1 py-2">
            <div className="px-3 mb-1 mt-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Channels
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-muted-foreground hover:text-foreground"
                onClick={() => setShowNewChannel(true)}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>

            {channels.map((channel) => (
              <button
                key={channel.id}
                onClick={() => selectChannel(channel.id)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-1.5 rounded-md mx-1 text-sm transition-colors text-left",
                  activeChannelId === channel.id && !isCompact
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Hash className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{channel.name}</span>
              </button>
            ))}

            {channels.length === 0 && (
              <p className="text-xs text-muted-foreground px-4 py-2">No channels yet</p>
            )}
          </ScrollArea>
        </aside>
      )}

      {/* ── Main area ───────────────────────────────────────────────────── */}
      {mainVisible && (
        activeChannel ? (
          <div className="flex-1 flex flex-col overflow-hidden relative">
            {/* Channel header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b bg-background/80 backdrop-blur-sm shadow-sm z-10">
              {isCompact && (
                <Button variant="ghost" size="icon" className="h-8 w-8 -ml-2" onClick={() => setShowMobileList(true)}>
                  <ChevronLeft className="h-5 w-5" />
                </Button>
              )}
              <div className="flex items-center gap-2">
                <Hash className="h-5 w-5 text-muted-foreground" />
                <div>
                  <h3 className="font-semibold">{activeChannel.name}</h3>
                  {activeChannel.description && !isCompact && (
                    <p className="text-xs text-muted-foreground leading-tight">{activeChannel.description}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Messages list */}
            <ScrollArea className="flex-1 px-4 py-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <Hash className="h-8 w-8 text-primary" />
                  </div>
                  <h4 className="font-semibold text-lg mb-1">Welcome to #{activeChannel.name}!</h4>
                  <p className="text-muted-foreground text-sm max-w-sm">
                    {activeChannel.description ||
                      "This is the beginning of this channel. Send a message to get started."}
                  </p>
                </div>
              ) : (
                <div className="space-y-0.5 pb-2">
                  {messageGroups.map(({ msgs, key }) => {
                    const first = msgs[0];
                    const sender = first.sender;
                    return (
                      <div
                        key={key}
                        className="flex gap-3 group py-1 hover:bg-muted/40 rounded-lg px-2 -mx-2 transition-colors"
                      >
                        <div className="flex-shrink-0 pt-0.5">
                          <Avatar className="h-8 w-8">
                            {sender?.avatarUrl && <AvatarImage src={sender.avatarUrl} />}
                            <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                              {sender ? getInitials(sender.name) : "?"}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2 mb-0.5">
                            <span className="font-semibold text-sm">{sender?.name ?? "Unknown"}</span>
                            <span className="text-xs text-muted-foreground">
                              {formatTime(first.createdAt)}
                            </span>
                          </div>
                          {msgs.map((msg) => {
                            if (msg.content.startsWith("[STICKER:") && msg.content.endsWith("]")) {
                              const url = msg.content.slice(9, -1);
                              return (
                                <div key={msg.id} className="mt-1">
                                  <img src={url} alt="Sticker" className="max-w-[120px] rounded-lg shadow-sm" />
                                </div>
                              );
                            }
                            return (
                              <p key={msg.id} className="text-sm leading-relaxed break-words text-foreground/90 whitespace-pre-wrap">
                                <MentionRenderer content={msg.content} />
                              </p>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={bottomRef} />
                </div>
              )}
            </ScrollArea>

            {/* Message input */}
            <div className="px-4 pb-4 pt-2 bg-background border-t">
              <div className="flex items-center gap-2 border rounded-xl bg-muted/30 px-3 py-2 focus-within:ring-2 focus-within:ring-primary/30 transition-all">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground shrink-0 hover:text-foreground">
                      <SmilePlus className="h-5 w-5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent side="top" align="start" className="w-auto p-0 border-none shadow-none">
                    <EmojiPicker theme={Theme.DARK} onEmojiClick={onEmojiClick} />
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground shrink-0 hover:text-foreground">
                      <ImageIcon className="h-5 w-5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent side="top" align="start" className="w-64 p-3 bg-popover/90 backdrop-blur-md border-border/50">
                    <p className="text-xs font-semibold text-muted-foreground mb-3 px-1 uppercase tracking-wider">Stickers</p>
                    <div className="grid grid-cols-3 gap-2">
                      {PRESET_STICKERS.map((url) => (
                        <button
                          key={url}
                          onClick={() => handleSendSticker(url)}
                          className="aspect-square rounded-md overflow-hidden hover:scale-105 active:scale-95 transition-transform"
                        >
                          <img src={url} alt="Sticker" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
                <SmartTextarea
                  value={draft}
                  onChange={setDraft}
                  onKeyDown={handleKeyDown}
                  placeholder={`Message #${activeChannel?.name || 'channel'}`}
                  className="flex-1 min-h-[36px]"
                />
                <Button
                  size="icon"
                  className="h-8 w-8 flex-shrink-0 rounded-lg shrink-0"
                  onClick={handleSend}
                  disabled={!draft.trim() || sendMutation.isPending}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">Select a channel to start chatting</p>
            </div>
          </div>
        )
      )}

      {/* ── New Channel Dialog ───────────────────────────────────────────── */}
      <Dialog open={showNewChannel} onOpenChange={setShowNewChannel}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Create a channel
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="ch-name">Channel name</Label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="ch-name"
                  className="pl-8"
                  placeholder="e.g. design-team"
                  value={newChannelName}
                  onChange={(e) =>
                    setNewChannelName(e.target.value.replace(/\s+/g, "-").toLowerCase())
                  }
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ch-desc">
                Description{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Textarea
                id="ch-desc"
                placeholder="What's this channel about?"
                rows={2}
                value={newChannelDesc}
                onChange={(e) => setNewChannelDesc(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewChannel(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createChannelMutation.mutate()}
              disabled={!newChannelName.trim() || createChannelMutation.isPending}
            >
              {createChannelMutation.isPending ? "Creating…" : "Create channel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ChatPage() {
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const { data: channels = [] } = useQuery<Channel[]>({ queryKey: ["/api/chat/channels"] });
  const activeChannel = channels.find((c) => c.id === activeChannelId);

  // Deep link
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash !== "#new") return;
    // Handled in interface now roughly, but we can ignore for now
  }, []);

  const chatCrumbs = [
    { label: "Communication" },
    { label: "Chat", href: "/chat" },
    ...(activeChannel ? [{ label: `#${activeChannel.name}` }] : []),
  ];

  return (
    <PageShell
      fullBleed
      breadcrumbs={chatCrumbs}
      title={activeChannel ? `#${activeChannel.name}` : "Chat"}
      description={
        activeChannel?.description ??
        (channels.length > 0 ? "Select a channel to start chatting" : "Create your first channel")
      }
      back={activeChannel ? { label: "Chat", href: "/chat" } : undefined}
    >
      <ChatInterface />
    </PageShell>
  );
}
