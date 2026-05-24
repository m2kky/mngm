import { Briefcase, Building2 } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import {
  CheckSquare, FileText, FolderOpen, User as UserIcon, Hash,
  Download, ExternalLink, Trash2, Send, Loader2, Calendar, Flag, Tag,
  MessageSquare, Activity, Paperclip, Info, CheckCircle2, Circle,
  PlayCircle, PauseCircle, StopCircle, ArrowRightLeft, PlusCircle, FileEdit
} from "lucide-react";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SmartTextarea } from "@/components/ui/smart-textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PropertyEditor } from "@/components/properties/PropertyEditor";

import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import type { Task, Page, User, TaskComment, ProjectStage, ActivityLog } from "@shared/schema";

// ─── Types ──────────────────────────────────────────────────────────────────

export type DetailKind = "task" | "page" | "file" | "member" | "channel" | "client" | "project";

const PARAM_FOR: Record<DetailKind, string> = {
  task: "task",
  page: "page",
  file: "file",
  member: "member",
  channel: "channel",
  client: "client",
  project: "project",
};

const ALL_KINDS: DetailKind[] = ["task", "page", "file", "member", "channel", "client", "project"];
const STACK_PARAM = "detail";

interface DetailEntry {
  kind: DetailKind;
  id: string;
}

interface DetailContextValue {
  open: (kind: DetailKind, id: string) => void;
  close: (entry?: DetailEntry) => void;
  closeAll: () => void;
  stack: DetailEntry[];
}

const DetailPanelContext = createContext<DetailContextValue | null>(null);

export function useDetailPanel() {
  const ctx = useContext(DetailPanelContext);
  if (!ctx) throw new Error("useDetailPanel must be used within DetailPanelProvider");
  return ctx;
}

// ─── Provider — URL is the source of truth ──────────────────────────────────
//
// Stack encoding: `?detail=task:abc,page:xyz,task:def` preserves push-order
// and allows multiple entries of the same kind. For shareable single-entity
// deep links we *also* accept shorthand: `?task=abc`, `?page=xyz`, etc.
// On any state change we normalise to the canonical `detail=` form.

function encodeStack(entries: DetailEntry[]): string {
  return entries.map((e) => `${e.kind}:${e.id}`).join(",");
}

function decodeStack(raw: string | null): DetailEntry[] {
  if (!raw) return [];
  const out: DetailEntry[] = [];
  for (const piece of raw.split(",")) {
    const ix = piece.indexOf(":");
    if (ix <= 0) continue;
    const kind = piece.slice(0, ix);
    const id = piece.slice(ix + 1);
    if (id && (ALL_KINDS as string[]).includes(kind)) {
      out.push({ kind: kind as DetailKind, id });
    }
  }
  return out;
}

export function DetailPanelProvider({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const search = useSearch();

  const stack = useMemo<DetailEntry[]>(() => {
    const params = new URLSearchParams(search);
    const fromStack = decodeStack(params.get(STACK_PARAM));
    if (fromStack.length > 0) return fromStack;
    // Fallback: shorthand single-entity deep links.
    const shorthand: DetailEntry[] = [];
    for (const kind of ALL_KINDS) {
      const id = params.get(PARAM_FOR[kind]);
      if (id) shorthand.push({ kind, id });
    }
    return shorthand;
  }, [search]);

  const writeStack = useCallback(
    (next: DetailEntry[]) => {
      const params = new URLSearchParams(search);
      // Drop any shorthand params — we always canonicalise to `detail=`.
      for (const k of ALL_KINDS) params.delete(PARAM_FOR[k]);
      params.delete(STACK_PARAM);
      if (next.length > 0) params.set(STACK_PARAM, encodeStack(next));
      const qs = params.toString();
      navigate(qs ? `${location}?${qs}` : location, { replace: false });
    },
    [search, navigate, location],
  );

  const open = useCallback(
    (kind: DetailKind, id: string) => {
      const top = stack[stack.length - 1];
      if (top && top.kind === kind && top.id === id) return; // no-op
      // Remove any earlier identical entry so we never loop the stack.
      const deduped = stack.filter((e) => !(e.kind === kind && e.id === id));
      writeStack([...deduped, { kind, id }]);
    },
    [stack, writeStack],
  );

  const close = useCallback(
    (entry?: DetailEntry) => {
      if (!entry) {
        // Pop the top.
        writeStack(stack.slice(0, -1));
        return;
      }
      writeStack(stack.filter((e) => !(e.kind === entry.kind && e.id === entry.id)));
    },
    [stack, writeStack],
  );

  const closeAll = useCallback(() => writeStack([]), [writeStack]);

  const value = useMemo(() => ({ open, close, closeAll, stack }), [open, close, closeAll, stack]);

  return (
    <DetailPanelContext.Provider value={value}>
      {children}
      <DetailPanelHost />
    </DetailPanelContext.Provider>
  );
}

// ─── Host — renders the appropriate panel for each entry in the stack ──────

function DetailPanelHost() {
  const { stack, close } = useDetailPanel();

  return (
    <>
      {stack.map((entry, i) => {
        const onOpenChange = (v: boolean) => { if (!v) close(entry); };
        const isTop = i === stack.length - 1;
        const panel =
          entry.kind === "task"    ? <TaskDetail    id={entry.id} /> :
          entry.kind === "page"    ? <PageDetail    id={entry.id} /> :
          entry.kind === "file"    ? <FileDetail    id={entry.id} /> :
          entry.kind === "member"  ? <MemberDetail  id={entry.id} /> :
          entry.kind === "channel" ? <ChannelDetail id={entry.id} /> :
          entry.kind === "client"  ? <ClientDetail  id={entry.id} /> :
          entry.kind === "project" ? <ProjectDetail id={entry.id} /> :
          null;
        // Stacked panels: each successive panel is slightly offset for context
        const offset = (stack.length - 1 - i) * 32;
        return (
          <Sheet key={`${entry.kind}:${entry.id}`} open onOpenChange={onOpenChange}>
            <SheetContent
              side="right"
              aria-describedby={undefined}
              className="w-full sm:max-w-xl p-0 flex flex-col"
              style={isTop ? undefined : { transform: `translateX(-${offset}px)`, opacity: 0.6 }}
            >
              {panel}
            </SheetContent>
          </Sheet>
        );
      })}
    </>
  );
}

// ─── Shared bits ────────────────────────────────────────────────────────────

function PanelShell({
  icon, title, subtitle, badges, footer, children,
}: {
  icon: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  badges?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col">
      <SheetHeader className="border-b px-6 py-4 space-y-2 text-left">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 text-muted-foreground">{icon}</div>
          <div className="min-w-0 flex-1 pr-8">
            <SheetTitle className="text-base leading-snug break-words">{title}</SheetTitle>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
            {badges && <div className="flex flex-wrap gap-1.5 mt-2">{badges}</div>}
          </div>
        </div>
      </SheetHeader>
      <div className="flex-1 overflow-hidden">{children}</div>
      {footer && <div className="border-t px-6 py-3 bg-muted/30">{footer}</div>}
    </div>
  );
}

function initials(name?: string | null, email?: string | null) {
  if (name) {
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase();
  }
  return (email ?? "?").slice(0, 2).toUpperCase();
}

function PanelLoading() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
}

function PanelEmpty({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center text-sm text-muted-foreground">
      <Info className="h-5 w-5 mb-2 opacity-50" />
      {message}
    </div>
  );
}

// ─── Task Detail ────────────────────────────────────────────────────────────

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
const TASK_TYPES = ["DESIGN", "COPY", "DEVELOPMENT", "SOCIAL_POST", "MEETING", "REVIEW", "STRATEGY", "OTHER"] as const;

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  MEDIUM: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  HIGH: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  URGENT: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

const taskEditSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
});
type TaskEditValues = z.infer<typeof taskEditSchema>;

function TaskDetail({ id }: { id: string }) {
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const agencyId = currentUser?.agencyId ?? "";

  const { data: task, isLoading, isError, error } = useQuery<Task>({
    queryKey: [`/api/tasks/${id}`],
    retry: false,
  });

  const { data: assignees = [] } = useQuery<Array<Pick<User, "id" | "name" | "email" | "image">>>({
    queryKey: [`/api/tasks/${id}/assignees`],
  });

  const { data: agencyMembers = [] } = useQuery<Array<Pick<User, "id" | "name" | "email" | "image">>>({
    queryKey: [`/api/agencies/${agencyId}/users`],
    enabled: !!agencyId,
  });

  const { data: stages = [] } = useQuery<ProjectStage[]>({
    queryKey: [`/api/agencies/${agencyId}/project-stages`],
    enabled: !!agencyId,
  });

  const { data: customProperties = [] } = useQuery<any[]>({
    queryKey: ["/api/custom-properties", { entityType: "TASK" }],
  });

  const invalidateTask = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [`/api/tasks/${id}`] });
    if (task?.projectId) {
      queryClient.invalidateQueries({ queryKey: [`/api/tasks?projectId=${task.projectId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${task.projectId}/task-assignees`] });
    }
  }, [id, task?.projectId]);

  const updateTask = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiRequest("PUT", `/api/tasks/${id}`, body).then((r) => r.json()),
    onSuccess: () => invalidateTask(),
    onError: (e: Error) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  const addAssignee = useMutation({
    mutationFn: (userId: string) => apiRequest("POST", `/api/tasks/${id}/assignees`, { userId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tasks/${id}/assignees`] });
      invalidateTask();
    },
  });
  const removeAssignee = useMutation({
    mutationFn: (userId: string) => apiRequest("DELETE", `/api/tasks/${id}/assignees/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tasks/${id}/assignees`] });
      invalidateTask();
    },
  });

  const form = useForm<TaskEditValues>({
    resolver: zodResolver(taskEditSchema),
    defaultValues: { title: "", description: "" },
  });

  // Sync form to fetched task
  useEffect(() => {
    if (task) {
      form.reset({ title: task.title, description: task.description ?? "" });
    }
  }, [task?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveText = useCallback(
    (field: "title" | "description", value: string) => {
      if (!task) return;
      const current = (task[field] ?? "") as string;
      if (current === value) return;
      updateTask.mutate({ [field]: value || null });
    },
    [task, updateTask],
  );

  if (isLoading) {
    return (
      <PanelShell icon={<CheckSquare className="h-5 w-5" />} title="Loading…">
        <PanelLoading />
      </PanelShell>
    );
  }
  if (isError || !task) {
    return (
      <PanelShell icon={<CheckSquare className="h-5 w-5" />} title="Task not found">
        <PanelEmpty
          message={
            error instanceof Error
              ? `We couldn't load this task: ${error.message}`
              : "This task no longer exists or you don't have access to it."
          }
        />
      </PanelShell>
    );
  }

  const currentAssigneeId = assignees[0]?.id ?? "";

  return (
    <PanelShell
      icon={<CheckSquare className="h-5 w-5 text-indigo-500" />}
      title={
        <Form {...form}>
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <Input
                {...field}
                onBlur={() => saveText("title", field.value)}
                className="border-0 px-0 h-auto py-0 text-base font-semibold shadow-none focus-visible:ring-0"
                data-testid="input-task-title"
              />
            )}
          />
        </Form>
      }
      badges={
        <>
          <Badge variant="secondary" className={PRIORITY_COLORS[task.priority] ?? ""}>
            <Flag className="w-3 h-3 mr-1" /> {task.priority}
          </Badge>
          <Badge variant="outline"><Tag className="w-3 h-3 mr-1" /> {task.type}</Badge>
          {task.dueDate && (
            <Badge variant="outline">
              <Calendar className="w-3 h-3 mr-1" /> {format(new Date(task.dueDate), "MMM d, yyyy")}
            </Badge>
          )}
        </>
      }
    >
      <Tabs defaultValue="details" className="h-full flex flex-col">
        <TabsList className="mx-6 mt-3 grid grid-cols-4 w-auto">
          <TabsTrigger value="details"><Info className="h-3.5 w-3.5 mr-1" />Details</TabsTrigger>
          <TabsTrigger value="activity"><Activity className="h-3.5 w-3.5 mr-1" />Activity</TabsTrigger>
          <TabsTrigger value="comments"><MessageSquare className="h-3.5 w-3.5 mr-1" />Comments</TabsTrigger>
          <TabsTrigger value="files"><Paperclip className="h-3.5 w-3.5 mr-1" />Files</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="flex-1 overflow-auto px-6 py-4 mt-0 space-y-5">
          <Form {...form}>
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground">Description</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={5}
                      placeholder="Add more context…"
                      onBlur={() => saveText("description", field.value ?? "")}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </Form>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Stage / Status</label>
              <Select value={task.stageId ?? ""} onValueChange={(v) => updateTask.mutate({ stageId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Stage" />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color || "#94a3b8" }} />
                        {s.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Priority</label>
              <Select value={task.priority} onValueChange={(v) => updateTask.mutate({ priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Type</label>
              <Select value={task.type} onValueChange={(v) => updateTask.mutate({ type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TASK_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Due date</label>
              <Input
                type="date"
                defaultValue={task.dueDate ? format(new Date(task.dueDate), "yyyy-MM-dd") : ""}
                onChange={(e) => {
                  const v = e.target.value;
                  updateTask.mutate({ dueDate: v ? new Date(v).toISOString() : null });
                }}
              />
            </div>

            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Assignee</label>
              <Select
                value={currentAssigneeId || "NONE"}
                onValueChange={(v) => {
                  const newId = v === "NONE" ? "" : v;
                  if (currentAssigneeId && currentAssigneeId !== newId) {
                    removeAssignee.mutate(currentAssigneeId);
                  }
                  if (newId && newId !== currentAssigneeId) {
                    addAssignee.mutate(newId);
                  }
                }}
              >
                <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Unassigned</SelectItem>
                  {agencyMembers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name ?? m.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {customProperties.length > 0 && (
            <div className="mt-6">
              <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-3 font-semibold">Custom Properties</h4>
              <div className="grid grid-cols-2 gap-4">
                {customProperties.map((prop: any) => (
                  <div key={prop.id}>
                    <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">
                      {prop.name}
                    </label>
                    <PropertyEditor
                      property={prop}
                      value={task.properties?.[prop.id] || ""}
                      onChange={(val) => {
                        updateTask.mutate({ properties: { ...task.properties, [prop.id]: val } });
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="activity" className="flex-1 overflow-auto px-6 py-4 mt-0">
          <PanelEmpty message="Activity feed coming soon." />
        </TabsContent>

        <TabsContent value="comments" className="flex-1 overflow-hidden mt-0 flex flex-col">
          <TaskComments taskId={id} agencyId={agencyId} />
        </TabsContent>

        <TabsContent value="files" className="flex-1 overflow-auto px-6 py-4 mt-0">
          <TaskFiles taskId={id} />
        </TabsContent>
      </Tabs>
    </PanelShell>
  );
}

// ─── Task: Comments tab ─────────────────────────────────────────────────────

function TaskComments({ taskId, agencyId }: { taskId: string; agencyId: string }) {
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const [draft, setDraft] = useState("");

  const { data: comments = [], isLoading } = useQuery<TaskComment[]>({
    queryKey: [`/api/tasks/${taskId}/comments`],
  });

  const { data: agencyMembers = [] } = useQuery<Array<Pick<User, "id" | "name" | "email" | "image">>>({
    queryKey: [`/api/agencies/${agencyId}/users`],
    enabled: !!agencyId,
  });

  const memberById = useMemo(() => {
    const map: Record<string, Pick<User, "id" | "name" | "email" | "image">> = {};
    for (const m of agencyMembers) map[m.id] = m;
    return map;
  }, [agencyMembers]);

  const post = useMutation({
    mutationFn: (content: string) =>
      apiRequest("POST", `/api/tasks/${taskId}/comments`, { content, agencyId }),
    onSuccess: () => {
      setDraft("");
      queryClient.invalidateQueries({ queryKey: [`/api/tasks/${taskId}/comments`] });
    },
    onError: (e: Error) => toast({ title: "Failed to post comment", description: e.message, variant: "destructive" }),
  });

  return (
    <>
      <ScrollArea className="flex-1 px-6 py-4">
        {isLoading ? (
          <PanelLoading />
        ) : comments.length === 0 ? (
          <PanelEmpty message="No comments yet. Start the conversation below." />
        ) : (
          <div className="space-y-4">
            {comments.map((c) => {
              const author = c.authorUserId ? memberById[c.authorUserId] : null;
              return (
                <div key={c.id} className="flex gap-3">
                  <Avatar className="h-8 w-8">
                    {author?.image && <AvatarImage src={author.image} />}
                    <AvatarFallback className="text-xs">{initials(author?.name, author?.email)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-semibold">{author?.name ?? author?.email ?? "Unknown"}</span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(c.createdAt), "MMM d, h:mm a")}
                      </span>
                    </div>
                    <p className="text-sm mt-0.5 whitespace-pre-wrap break-words">{c.content}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
      <div className="border-t px-6 py-3 bg-muted/30">
        <div className="flex items-end gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a comment…"
            rows={2}
            className="resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                if (draft.trim() && currentUser) post.mutate(draft.trim());
              }
            }}
          />
          <Button
            size="sm"
            onClick={() => draft.trim() && currentUser && post.mutate(draft.trim())}
            disabled={!draft.trim() || post.isPending}
          >
            {post.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">⌘/Ctrl + Enter to send</p>
      </div>
    </>
  );
}

// ─── Task: Files tab ────────────────────────────────────────────────────────

interface FileAsset {
  id: string;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
}

function TaskFiles({ taskId }: { taskId: string }) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const { data: files = [], isLoading } = useQuery<FileAsset[]>({
    queryKey: [`/api/files?taskId=${taskId}`],
  });

  async function uploadFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    try {
      const file = fileList[0];
      const reader = new FileReader();
      reader.onload = async (e) => {
        const content = e.target?.result as string;
        try {
          await apiRequest("POST", "/api/files/upload", {
            fileName: file.name,
            mimeType: file.type || "application/octet-stream",
            fileSize: file.size,
            taskId,
            content,
          });
          queryClient.invalidateQueries({ queryKey: [`/api/files?taskId=${taskId}`] });
          toast({ title: "File uploaded successfully" });
        } catch {
          toast({ title: "Failed to upload file", variant: "destructive" });
        } finally {
          setUploading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch {
      setUploading(false);
    }
  }

  if (isLoading) return <PanelLoading />;
  if (files.length === 0) return <PanelEmpty message="No files attached to this task." />;

  return (
    <div className="space-y-2">
      {files.map((f) => (
        <a
          key={f.id}
          href={f.fileUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-3 rounded-md border p-3 hover:bg-muted/50 transition-colors"
        >
          <Paperclip className="h-4 w-4 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{f.fileName}</p>
            <p className="text-xs text-muted-foreground">{(f.fileSize / 1024).toFixed(1)} KB</p>
          </div>
          <Download className="h-4 w-4 text-muted-foreground" />
        </a>
      ))}
    </div>
  );
}

// ─── Page Detail ────────────────────────────────────────────────────────────

function PageDetail({ id }: { id: string }) {
  const [, navigate] = useLocation();
  const { close } = useDetailPanel();
  const { data: page, isLoading, isError } = useQuery<Page>({
    queryKey: [`/api/pages/${id}`],
    retry: false,
  });

  if (isLoading) {
    return (
      <PanelShell icon={<FileText className="h-5 w-5" />} title="Loading…">
        <PanelLoading />
      </PanelShell>
    );
  }
  if (isError || !page) {
    return (
      <PanelShell icon={<FileText className="h-5 w-5" />} title="Page not found">
        <PanelEmpty message="This page no longer exists or you don't have access to it." />
      </PanelShell>
    );
  }

  const blocks = Array.isArray(page.content) ? (page.content as Array<{ type: string; content: string }>) : [];

  return (
    <PanelShell
      icon={<FileText className="h-5 w-5 text-purple-500" />}
      title={page.title ?? "Untitled"}
      subtitle={`Updated ${format(new Date(page.updatedAt), "MMM d, yyyy 'at' h:mm a")}`}
      footer={
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { close({ kind: "page", id }); navigate("/pages"); }}>
            <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Open in editor
          </Button>
        </div>
      }
    >
      <ScrollArea className="h-full px-6 py-4">
        {blocks.length === 0 ? (
          <PanelEmpty message="This page is empty." />
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none space-y-3">
            {blocks.map((b, i) => (
              <p key={i} className="text-sm whitespace-pre-wrap">{b.content || <span className="text-muted-foreground italic">(empty {b.type} block)</span>}</p>
            ))}
          </div>
        )}
      </ScrollArea>
    </PanelShell>
  );
}

// ─── File Detail ────────────────────────────────────────────────────────────

function FileDetail({ id }: { id: string }) {
  const { toast } = useToast();
  const { close } = useDetailPanel();

  const { data: files = [], isLoading } = useQuery<FileAsset[]>({
    queryKey: ["/api/files"],
  });

  const file = files.find((f) => f.id === id);

  const del = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/files/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      toast({ title: "File deleted" });
      close({ kind: "file", id });
    },
    onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
  });

  if (isLoading) {
    return <PanelShell icon={<Paperclip className="h-5 w-5" />} title="Loading…"><PanelLoading /></PanelShell>;
  }
  if (!file) {
    return <PanelShell icon={<Paperclip className="h-5 w-5" />} title="File not found"><PanelEmpty message="This file no longer exists." /></PanelShell>;
  }

  const isImage = file.mimeType.startsWith("image/");

  return (
    <PanelShell
      icon={<Paperclip className="h-5 w-5 text-blue-500" />}
      title={file.fileName}
      subtitle={`${(file.fileSize / 1024).toFixed(1)} KB · ${file.mimeType}`}
      footer={
        <div className="flex justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={() => del.mutate()} disabled={del.isPending}>
            <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete
          </Button>
          <Button asChild size="sm">
            <a href={file.fileUrl} download={file.fileName} target="_blank" rel="noreferrer">
              <Download className="h-3.5 w-3.5 mr-1.5" /> Download
            </a>
          </Button>
        </div>
      }
    >
      <ScrollArea className="h-full px-6 py-4">
        {isImage ? (
          <img src={file.fileUrl} alt={file.fileName} className="w-full rounded-lg border" />
        ) : (
          <div className="rounded-lg border p-6 text-center bg-muted/30">
            <Paperclip className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-sm font-medium">{file.fileName}</p>
            <p className="text-xs text-muted-foreground mt-1">Preview unavailable. Download to view.</p>
          </div>
        )}
        <dl className="mt-6 text-sm space-y-2">
          <div className="flex justify-between"><dt className="text-muted-foreground">Type</dt><dd>{file.mimeType}</dd></div>
          <div className="flex justify-between"><dt className="text-muted-foreground">Size</dt><dd>{(file.fileSize / 1024).toFixed(1)} KB</dd></div>
          <div className="flex justify-between"><dt className="text-muted-foreground">Uploaded</dt><dd>{format(new Date(file.createdAt), "MMM d, yyyy")}</dd></div>
        </dl>
      </ScrollArea>
    </PanelShell>
  );
}

// ─── Member Detail ──────────────────────────────────────────────────────────

interface MemberRow {
  id: string;
  name: string | null;
  email: string;
  role: string;
  status: string;
  image: string | null;
  createdAt: string;
}

function MemberDetail({ id }: { id: string }) {
  const { currentUser } = useAuth();
  const agencyId = currentUser?.agencyId ?? "";

  const { data: members = [], isLoading } = useQuery<MemberRow[]>({
    queryKey: [`/api/agencies/${agencyId}/members`],
    enabled: !!agencyId,
    queryFn: async () => {
      const res = await fetch(`/api/agencies/${agencyId}/members`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("wk_token")}` },
      });
      if (!res.ok) throw new Error("Failed to load members");
      return res.json();
    },
  });

  const member = members.find((m) => m.id === id);

  if (isLoading) return <PanelShell icon={<UserIcon className="h-5 w-5" />} title="Loading…"><PanelLoading /></PanelShell>;
  if (!member) return <PanelShell icon={<UserIcon className="h-5 w-5" />} title="Member not found"><PanelEmpty message="This member is not in your agency." /></PanelShell>;

  return (
    <PanelShell
      icon={<UserIcon className="h-5 w-5 text-emerald-500" />}
      title={member.name ?? member.email}
      subtitle={member.email}
      badges={
        <>
          <Badge variant="secondary">{member.role}</Badge>
          <Badge variant={member.status === "ACTIVE" ? "outline" : "destructive"}>{member.status}</Badge>
        </>
      }
    >
      <div className="px-6 py-6">
        <div className="flex items-center gap-4 mb-6">
          <Avatar className="h-16 w-16">
            {member.image && <AvatarImage src={member.image} />}
            <AvatarFallback className="text-lg">{initials(member.name, member.email)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold">{member.name ?? "—"}</p>
            <p className="text-sm text-muted-foreground">{member.email}</p>
          </div>
        </div>
        <dl className="text-sm space-y-3">
          <div className="flex justify-between"><dt className="text-muted-foreground">Role</dt><dd>{member.role}</dd></div>
          <div className="flex justify-between"><dt className="text-muted-foreground">Status</dt><dd>{member.status}</dd></div>
          <div className="flex justify-between"><dt className="text-muted-foreground">Joined</dt><dd>{format(new Date(member.createdAt), "MMM d, yyyy")}</dd></div>
        </dl>
      </div>
    </PanelShell>
  );
}

// ─── Channel Detail ─────────────────────────────────────────────────────────

interface ChannelRow {
  id: string;
  name: string;
  description?: string | null;
  type: string;
  createdAt: string;
}

function ChannelDetail({ id }: { id: string }) {
  const [, navigate] = useLocation();
  const { close } = useDetailPanel();

  const { data: channels = [], isLoading } = useQuery<ChannelRow[]>({
    queryKey: ["/api/chat/channels"],
  });

  const channel = channels.find((c) => c.id === id);

  if (isLoading) return <PanelShell icon={<Hash className="h-5 w-5" />} title="Loading…"><PanelLoading /></PanelShell>;
  if (!channel) return <PanelShell icon={<Hash className="h-5 w-5" />} title="Channel not found"><PanelEmpty message="This channel no longer exists." /></PanelShell>;

  return (
    <PanelShell
      icon={<Hash className="h-5 w-5 text-pink-500" />}
      title={`#${channel.name}`}
      subtitle={channel.description ?? "No description"}
      footer={
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { close({ kind: "channel", id }); navigate("/chat"); }}>
            <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Open chat
          </Button>
        </div>
      }
    >
      <div className="px-6 py-6">
        <dl className="text-sm space-y-3">
          <div className="flex justify-between"><dt className="text-muted-foreground">Type</dt><dd className="capitalize">{channel.type}</dd></div>
          <div className="flex justify-between"><dt className="text-muted-foreground">Created</dt><dd>{format(new Date(channel.createdAt), "MMM d, yyyy")}</dd></div>
        </dl>
      </div>
    </PanelShell>
  );
}


function ClientDetail({ id }: { id: string }) {
  const { open } = useDetailPanel();
  const { data: client, isLoading } = useQuery({
    queryKey: ["/api/clients", id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/clients/${id}`);
      if (!res.ok) throw new Error("Failed to fetch client");
      return res.json();
    }
  });

  const toggleTask = useMutation({
    mutationFn: (task: any) =>
      apiRequest("PUT", `/api/tasks/${task.id}`, {
        completedAt: task.completedAt ? null : new Date().toISOString(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
  });

  const { data: projects = [] } = useQuery<any[]>({ queryKey: ["/api/projects"] });
  const { data: tasks = [] } = useQuery<any[]>({ queryKey: ["/api/tasks"] });

  if (isLoading || !client) {
    return (
      <PanelShell icon={<Building2 className="h-5 w-5" />} title="Loading…">
        <PanelLoading />
      </PanelShell>
    );
  }

  const clientProjects = projects?.filter((p: any) => p.clientId === id) || [];
  const clientTasks = tasks?.filter((t: any) => clientProjects.some((p: any) => p.id === t.projectId)) || [];
  const completedTasks = clientTasks.filter((t: any) => !!t.completedAt).length;

  return (
    <PanelShell
      icon={<Building2 className="h-5 w-5 text-blue-500" />}
      title={client.name}
      badges={
        <Badge variant="outline" style={{ borderColor: client.iconColor, color: client.iconColor }}>
          Client
        </Badge>
      }
    >
      <Tabs defaultValue="overview" className="flex-1 flex flex-col h-full">
        <div className="px-6 border-b">
          <TabsList className="w-full justify-start h-auto rounded-none border-b bg-transparent p-0">
            <TabsTrigger value="overview" className="rounded-none border-b-2 border-transparent px-4 py-2 data-[state=active]:border-primary data-[state=active]:shadow-none data-[state=active]:bg-transparent">Overview</TabsTrigger>
            <TabsTrigger value="projects" className="rounded-none border-b-2 border-transparent px-4 py-2 data-[state=active]:border-primary data-[state=active]:shadow-none data-[state=active]:bg-transparent">Projects</TabsTrigger>
            <TabsTrigger value="tasks" className="rounded-none border-b-2 border-transparent px-4 py-2 data-[state=active]:border-primary data-[state=active]:shadow-none data-[state=active]:bg-transparent">Tasks</TabsTrigger>
          </TabsList>
        </div>
        <ScrollArea className="flex-1">
          <TabsContent value="overview" className="p-6 m-0 outline-none space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <Card className="bg-muted/30 border-none shadow-none">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{clientProjects.length}</p>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Projects</p>
                </CardContent>
              </Card>
              <Card className="bg-muted/30 border-none shadow-none">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{clientTasks.length}</p>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Total Tasks</p>
                </CardContent>
              </Card>
              <Card className="bg-muted/30 border-none shadow-none">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">{completedTasks}</p>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Completed</p>
                </CardContent>
              </Card>
            </div>
            {/* Quick Actions Placeholder */}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="w-full">Edit Client</Button>
            </div>
          </TabsContent>

          <TabsContent value="projects" className="p-6 m-0 outline-none space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Client Projects</h3>
              <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs">
                <FolderOpen className="h-3.5 w-3.5" /> New Project
              </Button>
            </div>
            {clientProjects.length > 0 ? (
              <div className="space-y-2">
                {clientProjects.map((p: any) => (
                  <div
                    key={p.id}
                    onClick={() => open({ kind: "project", id: p.id })}
                    className="p-3 bg-card border rounded-lg flex justify-between items-center cursor-pointer hover:border-primary transition-colors"
                  >
                    <span className="font-medium text-sm">{p.name}</span>
                    <Badge variant="secondary">{tasks?.filter((t: any) => t.projectId === p.id).length || 0} Tasks</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <PanelEmpty message="No projects assigned." />
            )}
          </TabsContent>

          <TabsContent value="tasks" className="p-6 m-0 outline-none space-y-4">
             <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Client Tasks</h3>
            </div>
            {clientTasks.length > 0 ? (
              <div className="space-y-2">
                {clientTasks.map((t: any) => (
                  <div 
                    key={t.id} 
                    onClick={() => open({ kind: "task", id: t.id })}
                    className="p-3 bg-card border rounded-lg flex justify-between items-center cursor-pointer hover:border-primary transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <div 
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTask.mutate(t);
                        }}
                        className="cursor-pointer flex items-center justify-center shrink-0"
                      >
                        {!!t.completedAt ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Circle className="w-4 h-4 text-muted-foreground hover:text-green-500" />}
                      </div>
                      <span className="font-medium text-sm line-clamp-1">{t.title}</span>
                    </div>
                    <Badge variant="secondary" className="text-[10px] whitespace-nowrap shrink-0">{t.stageId ? "Active" : "Draft"}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <PanelEmpty message="No tasks assigned." />
            )}
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </PanelShell>
  );
}

function ProjectDetail({ id }: { id: string }) {
  const { open } = useDetailPanel();
  const { data: project, isLoading } = useQuery({
    queryKey: ["/api/projects", id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/projects/${id}`);
      if (!res.ok) throw new Error("Failed to fetch project");
      return res.json();
    }
  });

  const toggleTask = useMutation({
    mutationFn: (task: any) =>
      apiRequest("PUT", `/api/tasks/${task.id}`, {
        completedAt: task.completedAt ? null : new Date().toISOString(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
  });

  const { data: tasks } = useQuery({ queryKey: ["/api/tasks"] });
  const { data: clients } = useQuery({ queryKey: ["/api/clients"] });

  if (isLoading || !project) {
    return (
      <PanelShell icon={<Briefcase className="h-5 w-5" />} title="Loading…">
        <PanelLoading />
      </PanelShell>
    );
  }

  const projectTasks = tasks?.filter((t: any) => t.projectId === id) || [];
  const completedTasks = projectTasks.filter((t: any) => !!t.completedAt).length;
  const progress = projectTasks.length > 0 ? Math.round((completedTasks / projectTasks.length) * 100) : 0;
  const client = clients?.find((c: any) => c.id === project.clientId);

  return (
    <PanelShell
      icon={<Briefcase className="h-5 w-5 text-indigo-500" />}
      title={project.name}
      badges={
        <Badge variant="outline" style={{ borderColor: project.iconColor, color: project.iconColor }}>
          Project
        </Badge>
      }
    >
      <Tabs defaultValue="overview" className="flex-1 flex flex-col h-full">
        <div className="px-6 border-b">
          <TabsList className="w-full justify-start h-auto rounded-none border-b bg-transparent p-0">
            <TabsTrigger value="overview" className="rounded-none border-b-2 border-transparent px-4 py-2 data-[state=active]:border-primary data-[state=active]:shadow-none data-[state=active]:bg-transparent">Overview</TabsTrigger>
            <TabsTrigger value="tasks" className="rounded-none border-b-2 border-transparent px-4 py-2 data-[state=active]:border-primary data-[state=active]:shadow-none data-[state=active]:bg-transparent">Tasks</TabsTrigger>
          </TabsList>
        </div>
        <ScrollArea className="flex-1">
          <TabsContent value="overview" className="p-6 m-0 outline-none space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <Card className="bg-muted/30 border-none shadow-none">
                <CardContent className="p-4 text-center flex flex-col items-center">
                  <div className="w-16 h-16 rounded-full border-4 border-indigo-100 dark:border-indigo-950 flex items-center justify-center relative overflow-hidden">
                    <div className="absolute bottom-0 left-0 right-0 bg-indigo-500 transition-all duration-500" style={{ height: `${progress}%` }} />
                    <span className={`relative z-10 font-bold text-sm ${progress > 50 ? 'text-white' : ''}`}>{progress}%</span>
                  </div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mt-2">Progress</p>
                </CardContent>
              </Card>
              <Card className="bg-muted/30 border-none shadow-none flex flex-col justify-center">
                <CardContent className="p-4 text-center">
                  <p className="text-3xl font-bold mt-2 text-indigo-600 dark:text-indigo-400">{projectTasks.length}</p>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mt-2">Total Tasks</p>
                </CardContent>
              </Card>
            </div>

            {client && (
              <div>
                <h3 className="text-sm font-semibold mb-2">Client</h3>
                <div 
                  onClick={() => open({ kind: "client", id: client.id })}
                  className="p-3 bg-card border rounded-lg flex items-center gap-3 cursor-pointer hover:border-primary transition-colors"
                >
                  <Building2 className="w-5 h-5 text-muted-foreground" />
                  <span className="font-medium text-sm">{client.name}</span>
                </div>
              </div>
            )}

            {/* Dynamic Custom Properties */}
            {customProperties.map((prop: any) => (
              <div key={prop.id}>
                <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">
                  {prop.name}
                </label>
                <PropertyEditor
                  property={prop}
                  value={project.properties?.[prop.id] || ""}
                  onChange={(val) => {
                    // Assuming an update function exists or logic to update properties
                  }}
                />
              </div>
            ))}

            <div className="pt-4 border-t">
              <Button variant="outline" size="sm" className="w-full">Edit Project</Button>
            </div>
          </TabsContent>

          <TabsContent value="tasks" className="p-6 m-0 outline-none space-y-4">
             <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Project Tasks</h3>
              <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs">
                <CheckSquare className="h-3.5 w-3.5" /> New Task
              </Button>
            </div>
            {projectTasks.length > 0 ? (
              <div className="space-y-2">
                {projectTasks.map((t: any) => (
                  <div 
                    key={t.id} 
                    onClick={() => open({ kind: "task", id: t.id })}
                    className="p-3 bg-card border rounded-lg flex justify-between items-center cursor-pointer hover:border-primary transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <div 
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTask.mutate(t);
                        }}
                        className="cursor-pointer flex items-center justify-center shrink-0"
                      >
                        {!!t.completedAt ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Circle className="w-4 h-4 text-muted-foreground hover:text-green-500" />}
                      </div>
                      <span className="font-medium text-sm line-clamp-1">{t.title}</span>
                    </div>
                    <Badge variant="secondary" className="text-[10px] shrink-0">{t.stageId ? "Active" : "Draft"}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <PanelEmpty message="No tasks in this project." />
            )}
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </PanelShell>
  );
}

// ─── Task: Activity Feed tab ──────────────────────────────────────────────────

function TaskActivityFeed({ taskId }: { taskId: string }) {
  const { data: activities, isLoading } = useQuery<ActivityLog[]>({ queryKey: ["/api/tasks", taskId, "activities"], queryFn: async () => { const res = await apiRequest("GET", `/api/tasks/${taskId}/activities`); if (!res.ok) throw new Error("Failed to fetch activities"); return res.json(); } });
  
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === "activity_created" && payload.data?.taskId === taskId) {
          queryClient.invalidateQueries({ queryKey: ["/api/tasks", taskId, "activities"] });
        }
      } catch {}
    };
    return () => ws.close();
  }, [taskId]);
  
  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!activities || activities.length === 0) return <PanelEmpty message="No activity recorded yet." />;
  return <ScrollArea className="flex-1 px-6 py-4"><div className="space-y-6">{activities.map((log) => {
    let Icon = Activity; let iconColor = "text-muted-foreground"; let bgColor = "bg-muted";
    switch (log.eventType) {
      case "TIMER_STARTED": case "TIMER_RESUMED": Icon = PlayCircle; iconColor = "text-green-500"; bgColor = "bg-green-500/10"; break;
      case "TIMER_PAUSED": Icon = PauseCircle; iconColor = "text-amber-500"; bgColor = "bg-amber-500/10"; break;
      case "TIMER_STOPPED": Icon = StopCircle; iconColor = "text-red-500"; bgColor = "bg-red-500/10"; break;
      case "STAGE_CHANGED": Icon = ArrowRightLeft; iconColor = "text-blue-500"; bgColor = "bg-blue-500/10"; break;
      case "TASK_CREATED": Icon = PlusCircle; iconColor = "text-emerald-500"; bgColor = "bg-emerald-500/10"; break;
      case "TASK_COMPLETED": Icon = CheckCircle2; iconColor = "text-purple-500"; bgColor = "bg-purple-500/10"; break;
      case "TASK_UPDATED": Icon = FileEdit; iconColor = "text-indigo-500"; bgColor = "bg-indigo-500/10"; break;
      case "COMMENT_ADDED": Icon = MessageSquare; iconColor = "text-cyan-500"; bgColor = "bg-cyan-500/10"; break;
      case "REVIEW_SUBMITTED": Icon = Info; iconColor = "text-orange-500"; bgColor = "bg-orange-500/10"; break;
    }
    return (
      <div key={log.id} className="relative pl-6">
        <div className="absolute left-[11px] top-6 bottom-[-24px] w-px bg-border last:hidden" />
        <div className="flex gap-4 items-start">
          <div className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${bgColor}`}>
            <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <Avatar className="h-5 w-5">
                {log.actor?.image && <AvatarImage src={log.actor.image} />}
                <AvatarFallback className="text-[10px]">{log.actor?.name?.charAt(0) || "U"}</AvatarFallback>
              </Avatar>
              <p className="text-sm text-foreground/90 leading-tight">
                <span className="font-medium mr-1">{log.actor?.name || "Unknown"}</span>
                {log.summary}
              </p>
            </div>
            <p className="text-xs text-muted-foreground ml-7">
              {format(new Date(log.createdAt), "MMM d, h:mm:ss a")}
            </p>
          </div>
        </div>
      </div>
    );
  })}</div></ScrollArea>;
}
