import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import {
  Plus, GripVertical, Calendar, Flag, Tag,
  Loader2, Kanban, Filter, X, AlertCircle, UserCircle, Pencil,
  FolderPlus, Layers, LayoutList, Table2, ChevronUp, ChevronDown,
} from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import type { Task, ProjectStage, Project, User, Client } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageShell } from "@/components/layout/PageShell";
import { useDetailPanel } from "@/components/detail/DetailPanel";

// ─── Constants ───────────────────────────────────────────────────────────────

const PRIORITY_CONFIG = {
  LOW:    { label: "Low",    color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
  MEDIUM: { label: "Medium", color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  HIGH:   { label: "High",   color: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" },
  URGENT: { label: "Urgent", color: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" },
} as const;

const TYPE_CONFIG = {
  DESIGN:      { label: "Design",   color: "bg-purple-100 text-purple-700" },
  COPY:        { label: "Copy",     color: "bg-yellow-100 text-yellow-700" },
  DEVELOPMENT: { label: "Dev",      color: "bg-cyan-100 text-cyan-700" },
  SOCIAL_POST: { label: "Social",   color: "bg-pink-100 text-pink-700" },
  MEETING:     { label: "Meeting",  color: "bg-indigo-100 text-indigo-700" },
  REVIEW:      { label: "Review",   color: "bg-orange-100 text-orange-700" },
  STRATEGY:    { label: "Strategy", color: "bg-teal-100 text-teal-700" },
  OTHER:       { label: "Other",    color: "bg-gray-100 text-gray-700" },
} as const;

const TASK_TYPES = ["DESIGN", "COPY", "DEVELOPMENT", "SOCIAL_POST", "MEETING", "REVIEW", "STRATEGY", "OTHER"] as const;
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

// ─── Types ───────────────────────────────────────────────────────────────────

type TaskAssigneeEntry = {
  taskId: string;
  userId: string;
  userName: string | null;
  userEmail: string;
  userImage: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string | null | undefined, email: string): string {
  if (name) {
    const parts = name.trim().split(" ");
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

function AvatarBubble({ user }: { user: Pick<User, "name" | "email" | "image"> }) {
  if (user.image) {
    return (
      <img
        src={user.image}
        alt={user.name ?? user.email}
        className="w-5 h-5 rounded-full border border-white dark:border-slate-700 object-cover"
      />
    );
  }
  return (
    <div className="w-5 h-5 rounded-full bg-indigo-500 text-white flex items-center justify-center text-[9px] font-bold border border-white dark:border-slate-700">
      {initials(user.name, user.email)}
    </div>
  );
}

// ─── Task form schema ─────────────────────────────────────────────────────────

const taskFormSchema = z.object({
  title:       z.string().min(1, "Title is required"),
  description: z.string().optional(),
  type:        z.enum(TASK_TYPES),
  priority:    z.enum(PRIORITIES),
  dueDate:     z.string().optional(),
  assigneeId:  z.string().optional(),
});
type TaskFormValues = z.infer<typeof taskFormSchema>;

// ─── Task form (shared by create & edit) ─────────────────────────────────────

function TaskForm({
  defaultValues,
  stageId,
  stages,
  agencyMembers,
  onSubmit,
  isPending,
  onClose,
}: {
  defaultValues: TaskFormValues;
  stageId: string;
  stages: ProjectStage[];
  agencyMembers: Pick<User, "id" | "name" | "email">[];
  onSubmit: (values: TaskFormValues) => void;
  isPending: boolean;
  onClose: () => void;
}) {
  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues,
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl><Input placeholder="Task title…" {...field} /></FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description <span className="text-slate-400 font-normal">(optional)</span></FormLabel>
              <FormControl><Textarea placeholder="Add more context…" rows={3} {...field} /></FormControl>
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    {TASK_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{TYPE_CONFIG[t].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="priority"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Priority</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>{PRIORITY_CONFIG[p].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="assigneeId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Assign to <span className="text-slate-400 font-normal">(optional)</span></FormLabel>
                <Select value={field.value ?? "NONE"} onValueChange={(v) => field.onChange(v === "NONE" ? "" : v)}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="NONE">Unassigned</SelectItem>
                    {agencyMembers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name ?? u.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="dueDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Due date <span className="text-slate-400 font-normal">(optional)</span></FormLabel>
                <FormControl><Input type="date" {...field} /></FormControl>
              </FormItem>
            )}
          />
        </div>

        <FormItem>
          <FormLabel>Stage</FormLabel>
          <Select disabled value={stageId}>
            <SelectTrigger>
              <SelectValue>{stages.find((s) => s.id === stageId)?.name ?? ""}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {stages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </FormItem>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save
          </Button>
        </div>
      </form>
    </Form>
  );
}

// ─── Create task modal ────────────────────────────────────────────────────────

function CreateTaskModal({
  open, onClose, projectId, stageId, agencyId, userId, stages, agencyMembers,
}: {
  open: boolean; onClose: () => void;
  projectId: string; stageId: string; agencyId: string; userId: string;
  stages: ProjectStage[];
  agencyMembers: Pick<User, "id" | "name" | "email">[];
}) {
  const { toast } = useToast();

  const createMutation = useMutation({
    mutationFn: async (values: TaskFormValues) => {
      const body: Record<string, unknown> = {
        title:       values.title,
        type:        values.type,
        priority:    values.priority,
        projectId,
        stageId,
        agencyId,
        createdById: userId,
      };
      if (values.description) body.description = values.description;
      if (values.dueDate)     body.dueDate     = new Date(values.dueDate).toISOString();

      const res  = await apiRequest("POST", "/api/tasks", body);
      const task = await res.json() as Task;

      if (values.assigneeId) {
        await apiRequest("POST", `/api/tasks/${task.id}/assignees`, { userId: values.assigneeId });
      }
      return task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tasks?projectId=${projectId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/task-assignees`] });
      toast({ title: "Task created" });
      onClose();
    },
    onError: (e: Error) => {
      toast({ title: "Failed to create task", description: e.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>New task</DialogTitle></DialogHeader>
        <TaskForm
          defaultValues={{ title: "", description: "", type: "DESIGN", priority: "MEDIUM", dueDate: "", assigneeId: "" }}
          stageId={stageId}
          stages={stages}
          agencyMembers={agencyMembers}
          onSubmit={(v) => createMutation.mutate(v)}
          isPending={createMutation.isPending}
          onClose={onClose}
        />
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit task modal — retired ──────────────────────────────────────────────
// Task editing now happens inline in the TaskDetailPanel slide-over
// (see `client/src/components/detail/DetailPanel.tsx`).

// ─── TaskCard ────────────────────────────────────────────────────────────────

function TaskCard({
  task, isDragging, onEdit, assigneeEntries,
}: {
  task: Task; isDragging?: boolean;
  onEdit: (task: Task) => void;
  assigneeEntries: TaskAssigneeEntry[];
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: task.id });

  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;

  const priority = PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG];
  const type     = TYPE_CONFIG[task.type as keyof typeof TYPE_CONFIG];

  const firstAssignee = assigneeEntries[0] ?? null;
  const displayAssignee = firstAssignee
    ? { name: firstAssignee.userName, email: firstAssignee.userEmail, image: firstAssignee.userImage }
    : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-3 shadow-sm transition-all ${isDragging ? "opacity-30" : "hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600"}`}
    >
      {/* Drag handle + edit button */}
      <div className="flex items-start gap-2">
        <div
          {...attributes}
          {...listeners}
          className="mt-0.5 shrink-0 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <GripVertical className="w-4 h-4 text-slate-300 dark:text-slate-600" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100 leading-snug line-clamp-2 pr-5">
            {task.title}
          </p>

          <div className="flex flex-wrap gap-1 mt-2">
            {type && (
              <span className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-md ${type.color}`}>
                <Tag className="w-2.5 h-2.5 mr-1" />{type.label}
              </span>
            )}
            {priority && (
              <span className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-md ${priority.color}`}>
                <Flag className="w-2.5 h-2.5 mr-1" />{priority.label}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between mt-2">
            {task.dueDate ? (
              <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                <Calendar className="w-3 h-3" />
                <span>{format(new Date(task.dueDate), "MMM d")}</span>
              </div>
            ) : <div />}

            {displayAssignee ? (
              <AvatarBubble user={displayAssignee} />
            ) : (
              <UserCircle className="w-4 h-4 text-slate-300 dark:text-slate-600" />
            )}
          </div>
        </div>
      </div>

      {/* Edit button */}
      <button
        onClick={(e) => { e.stopPropagation(); onEdit(task); }}
        className="absolute top-2 right-2 w-5 h-5 rounded flex items-center justify-center text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
        title="Edit task"
      >
        <Pencil className="w-3 h-3" />
      </button>
    </div>
  );
}

// ─── KanbanColumn ────────────────────────────────────────────────────────────

function KanbanColumn({
  stage, tasks, activeId, onAddTask, onEdit, taskAssigneeMap,
}: {
  stage: ProjectStage; tasks: Task[]; activeId: string | null;
  onAddTask: (stageId: string) => void;
  onEdit: (task: Task) => void;
  taskAssigneeMap: Record<string, TaskAssigneeEntry[]>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const columnColor = stage.color ?? "#6366f1";

  return (
    <div className="flex flex-col w-72 shrink-0">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: columnColor }} />
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{stage.name}</span>
          <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 dark:text-slate-500 px-1.5 py-0.5 rounded-full font-medium">
            {tasks.length}
          </span>
        </div>
        <button
          onClick={() => onAddTask(stage.id)}
          className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          title="Add task"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div
        ref={setNodeRef}
        className={`flex-1 min-h-[200px] flex flex-col gap-2 rounded-xl p-2 transition-colors ${
          isOver
            ? "bg-indigo-50 dark:bg-indigo-950/30 ring-2 ring-indigo-300 dark:ring-indigo-700"
            : "bg-slate-50 dark:bg-slate-900/50"
        }`}
      >
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            isDragging={activeId === task.id}
            assigneeEntries={taskAssigneeMap[task.id] ?? []}
            onEdit={onEdit}
          />
        ))}

        {tasks.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-xs text-slate-400 dark:text-slate-600 text-center px-4">Drop tasks here</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── CreateProjectModal ───────────────────────────────────────────────────────

const DEFAULT_STAGES = [
  { name: "To Do",      color: "#6366f1", order: 1 },
  { name: "In Progress",color: "#f59e0b", order: 2 },
  { name: "Review",     color: "#8b5cf6", order: 3 },
  { name: "Done",       color: "#10b981", order: 4 },
];

const projectFormSchema = z.object({
  name:          z.string().min(1, "Project name is required"),
  description:   z.string().optional(),
  clientMode:    z.enum(["existing", "new"]),
  clientId:      z.string().optional(),
  newClientName: z.string().optional(),
}).superRefine((v, ctx) => {
  if (v.clientMode === "existing" && !v.clientId) {
    ctx.addIssue({ code: "custom", path: ["clientId"], message: "Select a client" });
  }
  if (v.clientMode === "new" && !v.newClientName?.trim()) {
    ctx.addIssue({ code: "custom", path: ["newClientName"], message: "Client name is required" });
  }
});
type ProjectFormValues = z.infer<typeof projectFormSchema>;

function CreateProjectModal({
  open, onClose, agencyId, userId,
}: { open: boolean; onClose: (newProjectId?: string) => void; agencyId: string; userId: string }) {
  const { toast } = useToast();

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: [`/api/clients?agencyId=${agencyId}`],
    enabled: open && !!agencyId,
  });

  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: { name: "", description: "", clientMode: clients.length ? "existing" : "new", clientId: "", newClientName: "" },
  });

  // Switch default clientMode once clients load
  useEffect(() => {
    if (clients.length && form.getValues("clientMode") === "new" && !form.getValues("newClientName")) {
      form.setValue("clientMode", "existing");
    }
  }, [clients.length]);

  const clientMode = form.watch("clientMode");

  const createMutation = useMutation({
    mutationFn: async (values: ProjectFormValues) => {
      // 1. Resolve clientId — create new client if needed
      let clientId = values.clientId ?? "";
      if (values.clientMode === "new") {
        const res = await apiRequest("POST", "/api/clients", {
          name: values.newClientName!.trim(),
          agencyId,
          createdById: userId,
        });
        const newClient = await res.json() as Client;
        clientId = newClient.id;
      }

      // 2. Create project
      const projRes = await apiRequest("POST", "/api/projects", {
        name: values.name.trim(),
        description: values.description?.trim() || null,
        agencyId,
        clientId,
        createdById: userId,
      });
      const project = await projRes.json() as Project;

      // 3. Create default stages
      await Promise.all(
        DEFAULT_STAGES.map((s) =>
          apiRequest("POST", `/api/projects/${project.id}/stages`, {
            name: s.name,
            color: s.color,
            order: s.order,
            projectId: project.id,
          }),
        ),
      );

      return project;
    },
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects?agencyId=${agencyId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/clients?agencyId=${agencyId}`] });
      toast({ title: "Project created", description: `"${project.name}" is ready with default stages.` });
      form.reset();
      onClose(project.id);
    },
    onError: (e: Error) => {
      toast({ title: "Failed to create project", description: e.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderPlus className="w-4 h-4 text-indigo-500" /> New Project
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => createMutation.mutate(v))} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Project name</FormLabel>
                <FormControl><Input placeholder="e.g. Website Redesign" {...field} /></FormControl>
              </FormItem>
            )} />

            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Description <span className="text-slate-400 font-normal">(optional)</span></FormLabel>
                <FormControl><Textarea placeholder="What is this project about?" rows={2} {...field} /></FormControl>
              </FormItem>
            )} />

            {/* Client selector */}
            {clients.length > 0 && (
              <FormField control={form.control} name="clientMode" render={({ field }) => (
                <FormItem>
                  <FormLabel>Client</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="existing">Select existing client</SelectItem>
                      <SelectItem value="new">+ Create new client</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
            )}

            {clientMode === "existing" && clients.length > 0 ? (
              <FormField control={form.control} name="clientId" render={({ field }) => (
                <FormItem>
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Pick a client…" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
            ) : (
              <FormField control={form.control} name="newClientName" render={({ field }) => (
                <FormItem>
                  <FormLabel>{clients.length > 0 ? "New client name" : "Client name"}</FormLabel>
                  <FormControl><Input placeholder="e.g. Acme Corp" {...field} /></FormControl>
                </FormItem>
              )} />
            )}

            <p className="text-xs text-slate-400">
              4 default stages will be created automatically: To Do, In Progress, Review, Done.
            </p>

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="ghost" onClick={() => onClose()}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create project
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── CreateStageModal ─────────────────────────────────────────────────────────

const STAGE_COLORS = ["#6366f1","#f59e0b","#8b5cf6","#10b981","#ef4444","#3b82f6","#ec4899","#14b8a6"];

const stageFormSchema = z.object({
  name:  z.string().min(1, "Stage name is required"),
  color: z.string().min(1),
});
type StageFormValues = z.infer<typeof stageFormSchema>;

function CreateStageModal({
  open, onClose, projectId, nextOrder,
}: { open: boolean; onClose: () => void; projectId: string; nextOrder: number }) {
  const { toast } = useToast();

  const form = useForm<StageFormValues>({
    resolver: zodResolver(stageFormSchema),
    defaultValues: { name: "", color: "#6366f1" },
  });

  const createMutation = useMutation({
    mutationFn: async (values: StageFormValues) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/stages`, {
        name: values.name.trim(),
        color: values.color,
        order: nextOrder,
        projectId,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/stages`] });
      toast({ title: "Stage added" });
      form.reset({ name: "", color: "#6366f1" });
      onClose();
    },
    onError: (e: Error) => {
      toast({ title: "Failed to add stage", description: e.message, variant: "destructive" });
    },
  });

  const selectedColor = form.watch("color");

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-500" /> Add Stage
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => createMutation.mutate(v))} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Stage name</FormLabel>
                <FormControl><Input placeholder="e.g. QA, Blocked, Published…" {...field} /></FormControl>
              </FormItem>
            )} />

            <FormItem>
              <FormLabel>Color</FormLabel>
              <div className="flex gap-2 flex-wrap">
                {STAGE_COLORS.map((c) => (
                  <button
                    key={c} type="button"
                    onClick={() => form.setValue("color", c)}
                    className={`w-6 h-6 rounded-full border-2 transition-all ${selectedColor === c ? "border-slate-700 dark:border-white scale-110" : "border-transparent"}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </FormItem>

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Add stage
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────

function EmptyState({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <div className="mb-4">{icon}</div>
      <h3 className="text-base font-semibold text-slate-600 dark:text-slate-300 mb-1">{title}</h3>
      <p className="text-sm text-slate-400 dark:text-slate-500 max-w-xs">{description}</p>
    </div>
  );
}

// ─── List View ────────────────────────────────────────────────────────────────

function TaskListView({
  stages,
  filteredTasks,
  taskAssigneeMap,
  onEdit,
}: {
  stages: ProjectStage[];
  filteredTasks: Task[];
  taskAssigneeMap: Record<string, TaskAssigneeEntry[]>;
  onEdit: (t: Task) => void;
}) {
  const stageMap = Object.fromEntries(stages.map((s) => [s.id, s]));
  const grouped: Record<string, Task[]> = {};
  stages.forEach((s) => { grouped[s.id] = []; });
  filteredTasks.forEach((t) => {
    if (t.stageId && grouped[t.stageId]) grouped[t.stageId].push(t);
  });

  return (
    <div className="space-y-4">
      {stages.map((stage) => {
        const tasks = grouped[stage.id] ?? [];
        return (
          <div key={stage.id}>
            <div className="flex items-center gap-2 mb-1.5 px-1">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: stage.color || "#94a3b8" }} />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {stage.name}
              </span>
              <span className="text-xs text-muted-foreground">({tasks.length})</span>
            </div>
            <div className="rounded-lg border border-border/50 divide-y divide-border/40 overflow-hidden">
              {tasks.length === 0 ? (
                <div className="px-4 py-3 text-xs text-muted-foreground italic">No tasks</div>
              ) : tasks.map((task) => {
                const assignees = taskAssigneeMap[task.id] ?? [];
                return (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/40 cursor-pointer transition-colors"
                    onClick={() => onEdit(task)}
                    data-testid={`task-list-row-${task.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{task.title}</p>
                    </div>
                    {task.priority && (
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md shrink-0 hidden sm:block ${PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG]?.color}`}>
                        {PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG]?.label}
                      </span>
                    )}
                    {task.type && (
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md shrink-0 hidden md:block ${TYPE_CONFIG[task.type as keyof typeof TYPE_CONFIG]?.color}`}>
                        {TYPE_CONFIG[task.type as keyof typeof TYPE_CONFIG]?.label}
                      </span>
                    )}
                    {task.dueDate && (
                      <span className="text-xs text-muted-foreground shrink-0 hidden lg:block flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(task.dueDate), "MMM d")}
                      </span>
                    )}
                    <div className="flex -space-x-1 shrink-0">
                      {assignees.slice(0, 3).map((a) => (
                        <AvatarBubble key={a.userId} user={{ name: a.userName, email: a.userEmail, image: a.userImage }} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Table View ───────────────────────────────────────────────────────────────

type SortKey = "title" | "stage" | "priority" | "type" | "dueDate";

function TaskTableView({
  stages,
  filteredTasks,
  taskAssigneeMap,
  onEdit,
}: {
  stages: ProjectStage[];
  filteredTasks: Task[];
  taskAssigneeMap: Record<string, TaskAssigneeEntry[]>;
  onEdit: (t: Task) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("stage");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const stageOrder = Object.fromEntries(stages.map((s, i) => [s.id, i]));
  const stageMap = Object.fromEntries(stages.map((s) => [s.id, s]));

  const PRIORITY_ORDER: Record<string, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, URGENT: 3 };

  const sorted = [...filteredTasks].sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case "title":   cmp = (a.title ?? "").localeCompare(b.title ?? ""); break;
      case "stage":   cmp = (stageOrder[a.stageId ?? ""] ?? 99) - (stageOrder[b.stageId ?? ""] ?? 99); break;
      case "priority": cmp = (PRIORITY_ORDER[b.priority ?? ""] ?? 0) - (PRIORITY_ORDER[a.priority ?? ""] ?? 0); break;
      case "type":    cmp = (a.type ?? "").localeCompare(b.type ?? ""); break;
      case "dueDate": {
        const da = a.dueDate ? new Date(a.dueDate).getTime() : 9999999999999;
        const db = b.dueDate ? new Date(b.dueDate).getTime() : 9999999999999;
        cmp = da - db;
        break;
      }
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronUp className="w-3 h-3 opacity-30" />;
    return sortDir === "asc"
      ? <ChevronUp className="w-3 h-3" />
      : <ChevronDown className="w-3 h-3" />;
  }

  function TH({ col, label }: { col: SortKey; label: string }) {
    return (
      <TableHead
        className="cursor-pointer select-none"
        onClick={() => toggleSort(col)}
      >
        <div className="flex items-center gap-1">
          {label} <SortIcon col={col} />
        </div>
      </TableHead>
    );
  }

  return (
    <div className="rounded-lg border border-border/50 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TH col="title"    label="Title" />
            <TH col="stage"    label="Stage" />
            <TH col="priority" label="Priority" />
            <TH col="type"     label="Type" />
            <TH col="dueDate"  label="Due" />
            <TableHead>Assignees</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-12 text-muted-foreground text-sm">
                No tasks match the current filters.
              </TableCell>
            </TableRow>
          ) : sorted.map((task) => {
            const stage = stageMap[task.stageId ?? ""];
            const assignees = taskAssigneeMap[task.id] ?? [];
            return (
              <TableRow
                key={task.id}
                className="cursor-pointer"
                onClick={() => onEdit(task)}
                data-testid={`task-table-row-${task.id}`}
              >
                <TableCell className="font-medium max-w-[260px]">
                  <p className="truncate">{task.title}</p>
                </TableCell>
                <TableCell>
                  {stage && (
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: stage.color || "#94a3b8" }} />
                      <span className="text-sm text-muted-foreground">{stage.name}</span>
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  {task.priority && (
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG]?.color}`}>
                      {PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG]?.label}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {task.type && (
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${TYPE_CONFIG[task.type as keyof typeof TYPE_CONFIG]?.color}`}>
                      {TYPE_CONFIG[task.type as keyof typeof TYPE_CONFIG]?.label}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {task.dueDate ? format(new Date(task.dueDate), "MMM d, yyyy") : "—"}
                </TableCell>
                <TableCell>
                  <div className="flex -space-x-1">
                    {assignees.slice(0, 4).map((a) => (
                      <AvatarBubble key={a.userId} user={{ name: a.userName, email: a.userEmail, image: a.userImage }} />
                    ))}
                    {assignees.length > 4 && (
                      <div className="w-5 h-5 rounded-full bg-muted text-muted-foreground text-[9px] font-bold border border-white dark:border-slate-700 flex items-center justify-center">
                        +{assignees.length - 4}
                      </div>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Main Kanban page ─────────────────────────────────────────────────────────

export default function Tasks() {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const agencyId = currentUser?.agencyId ?? "";
  const userId   = currentUser?.id ?? "";

  const [selectedProjectId,  setSelectedProjectId]  = useState<string>("");
  const [filterPriority,     setFilterPriority]     = useState<string>("ALL");
  const [filterType,         setFilterType]         = useState<string>("ALL");
  const [filterAssignee,     setFilterAssignee]     = useState<string>("ALL");
  const [activeId,           setActiveId]           = useState<string | null>(null);
  const [createModal,        setCreateModal]        = useState<{ open: boolean; stageId: string }>({ open: false, stageId: "" });
  const [createProjectOpen,  setCreateProjectOpen]  = useState(false);
  const { open: openDetail } = useDetailPanel();
  const [createStageOpen,    setCreateStageOpen]    = useState(false);
  const [taskView, setTaskView] = useState<"board" | "list" | "table">("board");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  // Fetch projects
  const { data: projects = [], isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: [`/api/projects?agencyId=${agencyId}`],
    enabled: !!agencyId,
  });

  const effectiveProjectId = selectedProjectId || projects[0]?.id || "";

  // Fetch stages
  const { data: stages = [], isLoading: stagesLoading } = useQuery<ProjectStage[]>({
    queryKey: [`/api/projects/${effectiveProjectId}/stages`],
    enabled: !!effectiveProjectId,
  });

  // Open the create dialog automatically when navigated with #new (e.g. from
  // the global command palette / QuickCreate). Clears the hash afterward.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash !== "#new") return;
    if (stages.length === 0) return;
    setCreateModal({ open: true, stageId: stages[0].id });
    history.replaceState(null, "", window.location.pathname + window.location.search);
  }, [stages]);

  // Fetch tasks
  const { data: allTasks = [], isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: [`/api/tasks?projectId=${effectiveProjectId}`],
    enabled: !!effectiveProjectId,
  });

  // Fetch agency members (for assignee selector + filter)
  const { data: agencyMembers = [] } = useQuery<Pick<User, "id" | "name" | "email" | "image">[]>({
    queryKey: [`/api/agencies/${agencyId}/users`],
    enabled: !!agencyId,
  });

  // Fetch all task-assignee mappings for the project in one call
  const { data: projectTaskAssignees = [] } = useQuery<TaskAssigneeEntry[]>({
    queryKey: [`/api/projects/${effectiveProjectId}/task-assignees`],
    enabled: !!effectiveProjectId,
  });

  // Build a map: taskId → TaskAssigneeEntry[]
  const taskAssigneeMap = useMemo(() => {
    const map: Record<string, TaskAssigneeEntry[]> = {};
    projectTaskAssignees.forEach((entry) => {
      if (!map[entry.taskId]) map[entry.taskId] = [];
      map[entry.taskId].push(entry);
    });
    return map;
  }, [projectTaskAssignees]);

  // Apply filters — assignee filter uses real task-assignee data
  const filteredTasks = useMemo(() => {
    return allTasks.filter((t) => {
      if (filterPriority !== "ALL" && t.priority !== filterPriority) return false;
      if (filterType     !== "ALL" && t.type     !== filterType)     return false;
      if (filterAssignee !== "ALL") {
        const assignees = taskAssigneeMap[t.id] ?? [];
        if (!assignees.some((a) => a.userId === filterAssignee)) return false;
      }
      return true;
    });
  }, [allTasks, filterPriority, filterType, filterAssignee, taskAssigneeMap]);

  // Group tasks by stage
  const tasksByStage = useMemo(() => {
    const map: Record<string, Task[]> = {};
    stages.forEach((s) => { map[s.id] = []; });
    filteredTasks.forEach((t) => {
      if (t.stageId && map[t.stageId]) map[t.stageId].push(t);
    });
    return map;
  }, [stages, filteredTasks]);

  const activeTask = useMemo(() => allTasks.find((t) => t.id === activeId) ?? null, [allTasks, activeId]);

  const moveTaskMutation = useMutation({
    mutationFn: async ({ taskId, stageId }: { taskId: string; stageId: string }) => {
      const res = await apiRequest("PUT", `/api/tasks/${taskId}`, { stageId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tasks?projectId=${effectiveProjectId}`] });
    },
    onError: (e: Error) => {
      toast({ title: "Failed to move task", description: e.message, variant: "destructive" });
      queryClient.invalidateQueries({ queryKey: [`/api/tasks?projectId=${effectiveProjectId}`] });
    },
  });

  function handleDragStart(event: DragStartEvent) { setActiveId(event.active.id as string); }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const taskId  = active.id as string;
    const stageId = over.id  as string;
    const task    = allTasks.find((t) => t.id === taskId);
    if (!task || task.stageId === stageId) return;

    // Optimistic update
    queryClient.setQueryData<Task[]>(
      [`/api/tasks?projectId=${effectiveProjectId}`],
      (prev = []) => prev.map((t) => t.id === taskId ? { ...t, stageId } : t),
    );
    moveTaskMutation.mutate({ taskId, stageId });
  }

  const isLoading   = projectsLoading || stagesLoading || tasksLoading;
  const hasProjects = projects.length > 0;
  const hasStages   = stages.length > 0;
  const anyFilter   = filterPriority !== "ALL" || filterType !== "ALL" || filterAssignee !== "ALL";

  const activeProject = projects.find((p) => p.id === effectiveProjectId);

  const taskCrumbs = [
    { label: "Work" },
    { label: "Tasks", href: "/tasks" },
    ...(activeProject ? [{ label: activeProject.name }] : []),
  ];

  const taskSecondaryActions = (
    <>
      {hasProjects && (
        <Select value={effectiveProjectId} onValueChange={setSelectedProjectId}>
          <SelectTrigger className="w-52 h-9 text-sm" data-testid="select-tasks-project">
            <SelectValue placeholder="Select project" />
          </SelectTrigger>
          <SelectContent>
            {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
      <Button
        size="sm" variant="outline"
        className="h-9 gap-1"
        onClick={() => setCreateProjectOpen(true)}
        data-testid="button-new-project"
      >
        <FolderPlus className="w-3.5 h-3.5" /> New project
      </Button>
    </>
  );

  const taskPrimaryAction = hasStages ? (
    <Button
      size="sm"
      className="h-9"
      onClick={() => setCreateModal({ open: true, stageId: stages[0]?.id ?? "" })}
      data-testid="button-new-task"
    >
      <Plus className="w-4 h-4 mr-1" /> New task
    </Button>
  ) : null;

  const viewSwitcher = (
    <div className="flex items-center rounded-md border border-border/60 overflow-hidden h-8 shrink-0">
      {(["board", "list", "table"] as const).map((v) => {
        const icons = { board: <Kanban className="w-3.5 h-3.5" />, list: <LayoutList className="w-3.5 h-3.5" />, table: <Table2 className="w-3.5 h-3.5" /> };
        return (
          <button
            key={v}
            onClick={() => setTaskView(v)}
            title={v.charAt(0).toUpperCase() + v.slice(1)}
            className={`px-2.5 h-full flex items-center transition-colors ${taskView === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}
            data-testid={`button-view-${v}`}
          >
            {icons[v]}
          </button>
        );
      })}
    </div>
  );

  const taskFilterTabs = (
    <div className="flex flex-wrap items-center gap-2">
      <Filter className="w-4 h-4 text-muted-foreground" />
      <Select value={filterAssignee} onValueChange={setFilterAssignee}>
        <SelectTrigger className="h-8 w-36 text-xs" data-testid="select-filter-assignee">
          <SelectValue placeholder="Assignee" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All members</SelectItem>
          {agencyMembers.map((u) => (
            <SelectItem key={u.id} value={u.id}>{u.name ?? u.email}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={filterPriority} onValueChange={setFilterPriority}>
        <SelectTrigger className="h-8 w-32 text-xs" data-testid="select-filter-priority">
          <SelectValue placeholder="Priority" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All priorities</SelectItem>
          {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{PRIORITY_CONFIG[p].label}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={filterType} onValueChange={setFilterType}>
        <SelectTrigger className="h-8 w-28 text-xs" data-testid="select-filter-type">
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All types</SelectItem>
          {TASK_TYPES.map((t) => <SelectItem key={t} value={t}>{TYPE_CONFIG[t].label}</SelectItem>)}
        </SelectContent>
      </Select>
      {anyFilter && (
        <>
          <Button
            variant="ghost" size="sm"
            className="h-8 px-2 text-xs text-muted-foreground"
            onClick={() => { setFilterPriority("ALL"); setFilterType("ALL"); setFilterAssignee("ALL"); }}
          >
            <X className="w-3 h-3 mr-1" /> Clear
          </Button>
          <span className="text-xs text-muted-foreground">
            {filteredTasks.length} of {allTasks.length} tasks
          </span>
        </>
      )}
      <div className="ml-auto">{viewSwitcher}</div>
    </div>
  );

  return (
    <PageShell
      fullBleed
      breadcrumbs={taskCrumbs}
      title={activeProject?.name ?? "Tasks"}
      description={activeProject ? "Kanban board" : "Plan and track work across projects"}
      secondaryActions={taskSecondaryActions}
      primaryAction={taskPrimaryAction}
      tabs={taskFilterTabs}
    >
    <div className="flex flex-col h-full">
      {/* ── Board area ── */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
          </div>
        ) : !hasProjects ? (
          <div className="flex flex-col items-center justify-center h-64 text-center gap-4">
            <Kanban className="w-10 h-10 text-slate-300" />
            <div>
              <h3 className="text-base font-semibold text-slate-600 dark:text-slate-300 mb-1">No projects yet</h3>
              <p className="text-sm text-slate-400 dark:text-slate-500 max-w-xs mb-4">Create your first project to start organising tasks.</p>
              <Button onClick={() => setCreateProjectOpen(true)} className="gap-2">
                <FolderPlus className="w-4 h-4" /> Create first project
              </Button>
            </div>
          </div>
        ) : !hasStages ? (
          <div className="flex flex-col items-center justify-center h-64 text-center gap-4">
            <AlertCircle className="w-10 h-10 text-slate-300" />
            <div>
              <h3 className="text-base font-semibold text-slate-600 dark:text-slate-300 mb-1">No stages yet</h3>
              <p className="text-sm text-slate-400 dark:text-slate-500 max-w-xs mb-4">Add stages to your project to start organising tasks on the board.</p>
              <Button onClick={() => setCreateStageOpen(true)} className="gap-2">
                <Layers className="w-4 h-4" /> Add first stage
              </Button>
            </div>
          </div>
        ) : taskView === "list" ? (
          <TaskListView
            stages={stages}
            filteredTasks={filteredTasks}
            taskAssigneeMap={taskAssigneeMap}
            onEdit={(t) => openDetail("task", t.id)}
          />
        ) : taskView === "table" ? (
          <TaskTableView
            stages={stages}
            filteredTasks={filteredTasks}
            taskAssigneeMap={taskAssigneeMap}
            onEdit={(t) => openDetail("task", t.id)}
          />
        ) : (
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="flex gap-5 items-start">
              {stages.map((stage) => (
                <KanbanColumn
                  key={stage.id}
                  stage={stage}
                  tasks={tasksByStage[stage.id] ?? []}
                  activeId={activeId}
                  onAddTask={(stageId) => setCreateModal({ open: true, stageId })}
                  taskAssigneeMap={taskAssigneeMap}
                  onEdit={(t) => openDetail("task", t.id)}
                />
              ))}
            </div>

            <DragOverlay>
              {activeTask && (
                <div className="rotate-2 opacity-95">
                  <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-3 shadow-xl w-72">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100 line-clamp-2">{activeTask.title}</p>
                    <div className="flex gap-1 mt-2">
                      {activeTask.type && (
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${TYPE_CONFIG[activeTask.type as keyof typeof TYPE_CONFIG]?.color}`}>
                          {TYPE_CONFIG[activeTask.type as keyof typeof TYPE_CONFIG]?.label}
                        </span>
                      )}
                      {activeTask.priority && (
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${PRIORITY_CONFIG[activeTask.priority as keyof typeof PRIORITY_CONFIG]?.color}`}>
                          {PRIORITY_CONFIG[activeTask.priority as keyof typeof PRIORITY_CONFIG]?.label}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {/* ── Create project modal ── */}
      <CreateProjectModal
        open={createProjectOpen}
        onClose={(newId) => {
          setCreateProjectOpen(false);
          if (newId) setSelectedProjectId(newId);
        }}
        agencyId={agencyId}
        userId={userId}
      />

      {/* ── Create stage modal ── */}
      {effectiveProjectId && (
        <CreateStageModal
          open={createStageOpen}
          onClose={() => setCreateStageOpen(false)}
          projectId={effectiveProjectId}
          nextOrder={stages.length + 1}
        />
      )}

      {/* ── Create task modal ── */}
      {createModal.open && effectiveProjectId && (
        <CreateTaskModal
          open={createModal.open}
          onClose={() => setCreateModal({ open: false, stageId: "" })}
          projectId={effectiveProjectId}
          stageId={createModal.stageId}
          agencyId={agencyId}
          userId={userId}
          stages={stages}
          agencyMembers={agencyMembers}
        />
      )}

    </div>
    </PageShell>
  );
}
