import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Home,
  FolderKanban,
  Folder,
  MessageCircle,
  LogOut,
  Sun,
  Moon,
  Send,
  Building,
  CheckCircle2,
  Clock,
  AlertCircle,
  File,
  Download,
  User,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { getAuthToken } from "@/contexts/AuthContext";

type Section = "overview" | "project" | "files" | "messages";

const navItems = [
  { id: "overview" as Section, label: "Dashboard", icon: Home },
  { id: "project" as Section, label: "My Project", icon: FolderKanban },
  { id: "files" as Section, label: "Files", icon: Folder },
  { id: "messages" as Section, label: "Messages", icon: MessageCircle },
];

function authHeaders() {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function getPriorityColor(priority: string) {
  switch (priority) {
    case "URGENT": return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    case "HIGH": return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";
    case "MEDIUM": return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
    default: return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
  }
}

function getStatusIcon(task: any) {
  if (task.completedAt) return <CheckCircle2 className="h-4 w-4 text-green-500" />;
  if (task.dueDate && new Date(task.dueDate) < new Date()) return <AlertCircle className="h-4 w-4 text-red-500" />;
  return <Clock className="h-4 w-4 text-blue-500" />;
}

function formatDate(date: string | null | undefined) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function portalFetch<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: authHeaders() as Record<string, string> });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

export default function ClientPortalPage() {
  const { userProfile, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [activeSection, setActiveSection] = useState<Section>("overview");
  const [messageInput, setMessageInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  // ── Scoped portal queries (server enforces role=CLIENT and clientId link) ─
  const { data: projects = [], isError: projectsError } = useQuery<any[]>({
    queryKey: ["/api/client-portal/projects"],
    queryFn: () => portalFetch("/api/client-portal/projects"),
    retry: false,
  });

  const featuredProject = projects[0] ?? null;

  const { data: tasks = [] } = useQuery<any[]>({
    queryKey: ["/api/client-portal/tasks", featuredProject?.id],
    queryFn: () => portalFetch(`/api/client-portal/tasks?projectId=${featuredProject.id}`),
    enabled: !!featuredProject?.id,
    retry: false,
  });

  const { data: files = [] } = useQuery<any[]>({
    queryKey: ["/api/client-portal/files"],
    queryFn: () => portalFetch("/api/client-portal/files"),
    retry: false,
  });

  const { data: clientChannel } = useQuery<any>({
    queryKey: ["/api/client-portal/channel"],
    queryFn: () => portalFetch("/api/client-portal/channel"),
    retry: false,
  });

  // Fetch messages through the existing channel endpoint (also requires auth)
  const { data: messages = [] } = useQuery<any[]>({
    queryKey: ["/api/chat/channels", clientChannel?.id, "messages"],
    queryFn: () => portalFetch(`/api/chat/channels/${clientChannel.id}/messages`),
    enabled: !!clientChannel?.id,
    refetchInterval: 5000,
  });

  const sendMessage = useMutation({
    mutationFn: (content: string) =>
      apiRequest("POST", `/api/chat/channels/${clientChannel?.id}/messages`, { content }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/chat/channels", clientChannel?.id, "messages"] });
      setMessageInput("");
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const completedTasks = tasks.filter((t: any) => t.completedAt).length;
  const totalTasks = tasks.length;
  const progress = totalTasks > 0
    ? Math.round((completedTasks / totalTasks) * 100)
    : (featuredProject?.progress ?? 0);

  const handleSendMessage = () => {
    if (!messageInput.trim() || !clientChannel?.id) return;
    sendMessage.mutate(messageInput.trim());
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800 transition-colors duration-300 flex flex-col">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 px-4 pt-4">
        <GlassCard className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center">
                <span className="text-white font-bold text-sm">W</span>
              </div>
              <div>
                <h1 className="text-lg font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent leading-tight">
                  Client Portal
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-tight">Workit.OS</p>
              </div>
              <Badge variant="outline" className="ml-2 text-xs bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border-indigo-200">
                Client View
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="p-2 hover:bg-white/10"
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>

              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10">
                <Avatar className="w-7 h-7">
                  <AvatarImage src={userProfile?.image || ""} />
                  <AvatarFallback className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs">
                    {userProfile?.name?.charAt(0) || "C"}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 hidden sm:block">
                  {userProfile?.name || "Client"}
                </span>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={logout}
                className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 hover:text-red-600"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </GlassCard>
      </header>

      <div className="flex flex-1 px-4 pb-4 pt-4 gap-4 min-h-0">
        {/* Sidebar — only 4 sections, no internal tools */}
        <aside className="w-56 shrink-0">
          <GlassCard className="p-4 flex flex-col h-full">
            {/* Project info */}
            <div className="mb-6">
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-200/30">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
                  <Building className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate">
                    {featuredProject?.name ?? "Your Project"}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Client Portal</p>
                </div>
              </div>
            </div>

            <nav className="space-y-1">
              {navItems.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveSection(id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                    activeSection === id
                      ? "bg-indigo-500/20 text-indigo-600 dark:text-indigo-400"
                      : "text-gray-600 dark:text-gray-400 hover:bg-white/10 hover:text-gray-800 dark:hover:text-gray-200"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                  {id === "messages" && messages.length > 0 && (
                    <span className="ml-auto w-2 h-2 bg-green-500 rounded-full" />
                  )}
                </button>
              ))}
            </nav>

            <div className="mt-auto pt-6 border-t border-white/10">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full" />
                <span className="text-xs text-gray-500 dark:text-gray-400">Online</span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                {userProfile?.email}
              </p>
            </div>
          </GlassCard>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0 space-y-4">

          {/* ── Not linked to a client warning ────────── */}
          {projectsError && (
            <GlassCard className="p-6 border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-amber-800 dark:text-amber-400">Portal Not Yet Configured</h3>
                  <p className="text-sm text-amber-700 dark:text-amber-500 mt-1">
                    Your account hasn't been linked to a client record yet. Please contact your agency — an admin will connect your account to your project.
                  </p>
                </div>
              </div>
            </GlassCard>
          )}

          {/* ── Overview ─────────────────────────────── */}
          {activeSection === "overview" && (
            <>
              <GlassCard className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                      Welcome back, {userProfile?.name?.split(" ")[0] || "Client"}!
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                      Here's a summary of your project status.
                    </p>
                  </div>
                  <Button
                    onClick={() => setActiveSection("messages")}
                    className="bg-indigo-500 hover:bg-indigo-600 text-white self-start sm:self-auto"
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Message Team
                  </Button>
                </div>
              </GlassCard>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: "Total Tasks", value: totalTasks, color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-900/20" },
                  { label: "Completed", value: completedTasks, color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-900/20" },
                  { label: "In Progress", value: tasks.filter((t: any) => !t.completedAt).length, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/20" },
                  { label: "Files Shared", value: files.length, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-900/20" },
                ].map(({ label, value, color, bg }) => (
                  <GlassCard key={label} className="p-4">
                    <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center mb-3", bg)}>
                      <span className={cn("text-xl font-bold", color)}>{value}</span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{label}</p>
                  </GlassCard>
                ))}
              </div>

              {featuredProject ? (
                <GlassCard className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Project Overview</h3>
                    <button
                      onClick={() => setActiveSection("project")}
                      className="text-sm text-indigo-500 hover:text-indigo-600 flex items-center gap-1"
                    >
                      View Tasks <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>

                  <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-200/30 mb-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold text-gray-800 dark:text-gray-200">{featuredProject.name}</h4>
                        {featuredProject.description && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{featuredProject.description}</p>
                        )}
                      </div>
                      <Badge className={cn(
                        "text-xs ml-2 shrink-0",
                        featuredProject.status === "ACTIVE" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                        featuredProject.status === "COMPLETED" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                        "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                      )}>
                        {featuredProject.status}
                      </Badge>
                    </div>
                    <div className="mt-4">
                      <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                        <span>Progress</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-700"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                    {featuredProject.dueDate && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Due {formatDate(featuredProject.dueDate)}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-3">Recent Tasks</p>
                    {tasks.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-4">No tasks yet</p>
                    ) : (
                      tasks.slice(0, 4).map((task: any) => (
                        <div key={task.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
                          {getStatusIcon(task)}
                          <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 truncate">{task.title}</span>
                          <Badge variant="outline" className={cn("text-xs shrink-0", getPriorityColor(task.priority))}>
                            {task.priority}
                          </Badge>
                        </div>
                      ))
                    )}
                  </div>
                </GlassCard>
              ) : (
                <GlassCard className="p-12 text-center">
                  <FolderKanban className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400">No project assigned yet.</p>
                  <p className="text-sm text-gray-400 mt-1">Your team will set up your project soon.</p>
                </GlassCard>
              )}
            </>
          )}

          {/* ── My Project (Tasks) ──────────────────── */}
          {activeSection === "project" && (
            <GlassCard className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">
                    {featuredProject?.name ?? "My Project"}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                    Read-only view of your project tasks
                  </p>
                </div>
                {featuredProject && (
                  <Badge className={cn(
                    "text-xs",
                    featuredProject.status === "ACTIVE"
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                      : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                  )}>
                    {featuredProject.status ?? "PLANNING"}
                  </Badge>
                )}
              </div>

              {tasks.length === 0 ? (
                <div className="text-center py-16">
                  <CheckCircle2 className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400">No tasks yet</p>
                  <p className="text-sm text-gray-400 mt-1">Tasks will appear here as your team works.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {tasks.map((task: any) => (
                    <div
                      key={task.id}
                      className="flex items-start gap-4 p-4 rounded-xl bg-white/10 hover:bg-white/20 transition-colors border border-white/10"
                    >
                      <div className="mt-0.5">{getStatusIcon(task)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className={cn(
                            "text-sm font-medium text-gray-800 dark:text-gray-200",
                            task.completedAt && "line-through text-gray-400 dark:text-gray-600"
                          )}>
                            {task.title}
                          </h4>
                          <Badge variant="outline" className={cn("text-xs shrink-0", getPriorityColor(task.priority))}>
                            {task.priority}
                          </Badge>
                        </div>
                        {task.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                            {task.description}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          {task.dueDate && (
                            <span className={cn(
                              "text-xs flex items-center gap-1",
                              !task.completedAt && new Date(task.dueDate) < new Date()
                                ? "text-red-500"
                                : "text-gray-400"
                            )}>
                              <Clock className="h-3 w-3" />
                              Due {formatDate(task.dueDate)}
                            </span>
                          )}
                          {task.completedAt && (
                            <span className="text-xs text-green-500 flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Done {formatDate(task.completedAt)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>
          )}

          {/* ── Files ───────────────────────────────── */}
          {activeSection === "files" && (
            <GlassCard className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">Files</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                    Files shared with you by the team
                  </p>
                </div>
                <Badge variant="outline" className="text-xs">
                  {files.length} file{files.length !== 1 ? "s" : ""}
                </Badge>
              </div>

              {files.length === 0 ? (
                <div className="text-center py-16">
                  <Folder className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400">No files shared yet</p>
                  <p className="text-sm text-gray-400 mt-1">
                    The team will share files here as the project progresses.
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {files.map((file: any) => (
                    <div
                      key={file.id}
                      className="flex items-center gap-3 p-4 rounded-xl bg-white/10 hover:bg-white/20 transition-colors border border-white/10"
                    >
                      <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
                        <File className="h-5 w-5 text-indigo-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                          {file.fileName}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {formatFileSize(file.fileSize)} · {formatDate(file.createdAt)}
                        </p>
                      </div>
                      <a
                        href={file.fileUrl}
                        download={file.fileName}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg hover:bg-white/20 text-gray-500 hover:text-indigo-500 transition-colors"
                      >
                        <Download className="h-4 w-4" />
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>
          )}

          {/* ── Messages ────────────────────────────── */}
          {activeSection === "messages" && (
            <GlassCard className="p-6 flex flex-col" style={{ minHeight: "calc(100vh - 180px)" }}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
                  <MessageCircle className="h-5 w-5 text-indigo-500" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">Messages</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Direct line to the team</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2" style={{ maxHeight: "calc(100vh - 380px)" }}>
                {messages.length === 0 ? (
                  <div className="text-center py-16">
                    <MessageCircle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 dark:text-gray-400">No messages yet</p>
                    <p className="text-sm text-gray-400 mt-1">Start a conversation with the team below.</p>
                  </div>
                ) : (
                  messages.map((msg: any) => {
                    const isOwn = msg.userId === userProfile?.id;
                    return (
                      <div key={msg.id} className={cn("flex gap-3", isOwn && "flex-row-reverse")}>
                        <Avatar className="w-8 h-8 shrink-0">
                          <AvatarImage src={msg.sender?.avatarUrl || ""} />
                          <AvatarFallback className={cn(
                            "text-white text-xs",
                            isOwn
                              ? "bg-gradient-to-r from-indigo-500 to-purple-600"
                              : "bg-gradient-to-r from-gray-400 to-gray-600"
                          )}>
                            {msg.sender?.name?.charAt(0) ?? <User className="h-3 w-3" />}
                          </AvatarFallback>
                        </Avatar>
                        <div className={cn("max-w-xs lg:max-w-md", isOwn && "items-end flex flex-col")}>
                          <div className={cn("flex items-center gap-2 mb-1", isOwn && "flex-row-reverse")}>
                            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                              {isOwn ? "You" : (msg.sender?.name ?? "Team")}
                            </span>
                            <span className="text-xs text-gray-400">
                              {msg.createdAt
                                ? new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                                : ""}
                            </span>
                          </div>
                          <div className={cn(
                            "px-4 py-2.5 rounded-2xl text-sm",
                            isOwn
                              ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-tr-sm"
                              : "bg-white/20 dark:bg-white/10 text-gray-800 dark:text-gray-200 rounded-tl-sm"
                          )}>
                            {msg.content}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="flex gap-3 pt-4 border-t border-white/10">
                <Input
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                  placeholder={clientChannel ? "Type a message..." : "Loading channel..."}
                  disabled={!clientChannel || sendMessage.isPending}
                  className="flex-1 bg-white/10 border-white/20 focus:bg-white/15"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim() || !clientChannel || sendMessage.isPending}
                  className="bg-indigo-500 hover:bg-indigo-600 text-white px-4"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </GlassCard>
          )}
        </main>
      </div>
    </div>
  );
}
