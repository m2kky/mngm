import { useState, useMemo } from "react";
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
  Loader2, Kanban, Filter, X, AlertCircle,
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import type { Task, ProjectStage, Project } from "@shared/schema";
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
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

// ─── Constants ───────────────────────────────────────────────────────────────

const PRIORITY_CONFIG = {
  LOW:    { label: "Low",    color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
  MEDIUM: { label: "Medium", color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  HIGH:   { label: "High",   color: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" },
  URGENT: { label: "Urgent", color: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" },
} as const;

const TYPE_CONFIG = {
  DESIGN:      { label: "Design",      color: "bg-purple-100 text-purple-700" },
  COPY:        { label: "Copy",        color: "bg-yellow-100 text-yellow-700" },
  DEVELOPMENT: { label: "Dev",         color: "bg-cyan-100 text-cyan-700" },
  SOCIAL_POST: { label: "Social",      color: "bg-pink-100 text-pink-700" },
  MEETING:     { label: "Meeting",     color: "bg-indigo-100 text-indigo-700" },
  REVIEW:      { label: "Review",      color: "bg-orange-100 text-orange-700" },
  STRATEGY:    { label: "Strategy",    color: "bg-teal-100 text-teal-700" },
  OTHER:       { label: "Other",       color: "bg-gray-100 text-gray-700" },
} as const;

const TASK_TYPES = ["DESIGN", "COPY", "DEVELOPMENT", "SOCIAL_POST", "MEETING", "REVIEW", "STRATEGY", "OTHER"] as const;
const PRIORITIES  = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

// ─── Create-task form schema ─────────────────────────────────────────────────

const createTaskSchema = z.object({
  title:       z.string().min(1, "Title is required"),
  description: z.string().optional(),
  type:        z.enum(TASK_TYPES),
  priority:    z.enum(PRIORITIES),
  dueDate:     z.string().optional(),
});

type CreateTaskValues = z.infer<typeof createTaskSchema>;

// ─── TaskCard ────────────────────────────────────────────────────────────────

function TaskCard({ task, isDragging }: { task: Task; isDragging?: boolean }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: task.id });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  const priority = PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG];
  const type     = TYPE_CONFIG[task.type as keyof typeof TYPE_CONFIG];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-3 shadow-sm cursor-grab active:cursor-grabbing transition-all ${isDragging ? "opacity-30" : "hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600"}`}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start gap-2">
        <GripVertical className="w-4 h-4 text-slate-300 dark:text-slate-600 mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100 leading-snug line-clamp-2">
            {task.title}
          </p>

          <div className="flex flex-wrap gap-1 mt-2">
            {type && (
              <span className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-md ${type.color}`}>
                <Tag className="w-2.5 h-2.5 mr-1" />
                {type.label}
              </span>
            )}
            {priority && (
              <span className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-md ${priority.color}`}>
                <Flag className="w-2.5 h-2.5 mr-1" />
                {priority.label}
              </span>
            )}
          </div>

          {task.dueDate && (
            <div className="flex items-center gap-1 mt-2 text-[11px] text-slate-500 dark:text-slate-400">
              <Calendar className="w-3 h-3" />
              <span>{format(new Date(task.dueDate), "MMM d")}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── KanbanColumn ────────────────────────────────────────────────────────────

function KanbanColumn({
  stage,
  tasks,
  activeId,
  onAddTask,
}: {
  stage: ProjectStage;
  tasks: Task[];
  activeId: string | null;
  onAddTask: (stageId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  const columnColor = stage.color ?? "#6366f1";

  return (
    <div className="flex flex-col w-72 shrink-0">
      {/* Column header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: columnColor }} />
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            {stage.name}
          </span>
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

      {/* Drop area */}
      <div
        ref={setNodeRef}
        className={`flex-1 min-h-[200px] flex flex-col gap-2 rounded-xl p-2 transition-colors ${
          isOver
            ? "bg-indigo-50 dark:bg-indigo-950/30 ring-2 ring-indigo-300 dark:ring-indigo-700"
            : "bg-slate-50 dark:bg-slate-900/50"
        }`}
      >
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} isDragging={activeId === task.id} />
        ))}

        {tasks.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-xs text-slate-400 dark:text-slate-600 text-center px-4">
              Drop tasks here
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── CreateTaskModal ─────────────────────────────────────────────────────────

function CreateTaskModal({
  open,
  onClose,
  projectId,
  stageId,
  agencyId,
  stages,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  stageId: string;
  agencyId: string;
  stages: ProjectStage[];
}) {
  const { toast } = useToast();

  const form = useForm<CreateTaskValues>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      title:       "",
      description: "",
      type:        "DESIGN",
      priority:    "MEDIUM",
      dueDate:     "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: CreateTaskValues) => {
      const body: Record<string, unknown> = {
        title:     values.title,
        type:      values.type,
        priority:  values.priority,
        projectId,
        stageId,
        agencyId,
      };
      if (values.description) body.description = values.description;
      if (values.dueDate)     body.dueDate     = new Date(values.dueDate).toISOString();

      const res = await apiRequest("POST", "/api/tasks", body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tasks?projectId=${projectId}`] });
      toast({ title: "Task created", description: "The task has been added to the board." });
      form.reset();
      onClose();
    },
    onError: (e: Error) => {
      toast({ title: "Failed to create task", description: e.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => createMutation.mutate(v))} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Task title…" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description <span className="text-slate-400 font-normal">(optional)</span></FormLabel>
                  <FormControl>
                    <Textarea placeholder="Add more context…" rows={3} {...field} />
                  </FormControl>
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
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TASK_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {TYPE_CONFIG[t].label}
                          </SelectItem>
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
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PRIORITIES.map((p) => (
                          <SelectItem key={p} value={p}>
                            {PRIORITY_CONFIG[p].label}
                          </SelectItem>
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
                name="dueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due date <span className="text-slate-400 font-normal">(optional)</span></FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormItem>
                <FormLabel>Stage</FormLabel>
                <Select disabled value={stageId}>
                  <SelectTrigger>
                    <SelectValue>
                      {stages.find((s) => s.id === stageId)?.name ?? ""}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create task
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Kanban page ─────────────────────────────────────────────────────────

export default function Tasks() {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const agencyId = currentUser?.agencyId ?? "";

  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [filterPriority, setFilterPriority]       = useState<string>("ALL");
  const [filterType,     setFilterType]           = useState<string>("ALL");
  const [activeId,       setActiveId]             = useState<string | null>(null);
  const [modalOpen,      setModalOpen]            = useState(false);
  const [modalStageId,   setModalStageId]         = useState<string>("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  // Fetch projects
  const { data: projects = [], isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: [`/api/projects?agencyId=${agencyId}`],
    enabled: !!agencyId,
  });

  // Auto-select first project
  const effectiveProjectId = selectedProjectId || projects[0]?.id || "";

  // Fetch stages for selected project
  const { data: stages = [], isLoading: stagesLoading } = useQuery<ProjectStage[]>({
    queryKey: [`/api/projects/${effectiveProjectId}/stages`],
    enabled: !!effectiveProjectId,
  });

  // Fetch tasks for selected project
  const { data: allTasks = [], isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: [`/api/tasks?projectId=${effectiveProjectId}`],
    enabled: !!effectiveProjectId,
  });

  // Apply filters
  const filteredTasks = useMemo(() => {
    return allTasks.filter((t) => {
      if (filterPriority !== "ALL" && t.priority !== filterPriority) return false;
      if (filterType !== "ALL" && t.type !== filterType) return false;
      return true;
    });
  }, [allTasks, filterPriority, filterType]);

  // Group tasks by stage
  const tasksByStage = useMemo(() => {
    const map: Record<string, Task[]> = {};
    stages.forEach((s) => { map[s.id] = []; });
    filteredTasks.forEach((t) => {
      if (t.stageId && map[t.stageId]) {
        map[t.stageId].push(t);
      }
    });
    return map;
  }, [stages, filteredTasks]);

  // The dragged task (for DragOverlay)
  const activeTask = useMemo(
    () => allTasks.find((t) => t.id === activeId) ?? null,
    [allTasks, activeId],
  );

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

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const taskId   = active.id as string;
    const stageId  = over.id as string;
    const task     = allTasks.find((t) => t.id === taskId);
    if (!task || task.stageId === stageId) return;

    // Optimistic update
    queryClient.setQueryData<Task[]>(
      [`/api/tasks?projectId=${effectiveProjectId}`],
      (prev = []) => prev.map((t) => t.id === taskId ? { ...t, stageId } : t),
    );

    moveTaskMutation.mutate({ taskId, stageId });
  }

  function openCreateModal(stageId: string) {
    setModalStageId(stageId);
    setModalOpen(true);
  }

  const isLoading   = projectsLoading || stagesLoading || tasksLoading;
  const hasProjects = projects.length > 0;
  const hasStages   = stages.length > 0;
  const anyFilter   = filterPriority !== "ALL" || filterType !== "ALL";

  return (
    <div className="flex flex-col h-full">
      {/* ── Top bar ── */}
      <div className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-6 py-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Kanban className="w-5 h-5 text-indigo-500" />
            <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">Tasks</h1>

            {/* Project selector */}
            {hasProjects && (
              <Select
                value={effectiveProjectId}
                onValueChange={setSelectedProjectId}
              >
                <SelectTrigger className="w-52 h-8 text-sm bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Filters + New Task */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />

            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="h-8 w-32 text-xs">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All priorities</SelectItem>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>{PRIORITY_CONFIG[p].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="h-8 w-32 text-xs">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All types</SelectItem>
                {TASK_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{TYPE_CONFIG[t].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {anyFilter && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs text-slate-500"
                onClick={() => { setFilterPriority("ALL"); setFilterType("ALL"); }}
              >
                <X className="w-3 h-3 mr-1" /> Clear
              </Button>
            )}

            {hasStages && (
              <Button
                size="sm"
                className="h-8 text-xs"
                onClick={() => openCreateModal(stages[0]?.id ?? "")}
              >
                <Plus className="w-4 h-4 mr-1" /> New task
              </Button>
            )}
          </div>
        </div>

        {/* Active filter summary */}
        {anyFilter && (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-slate-400">Filtered:</span>
            {filterPriority !== "ALL" && (
              <Badge variant="secondary" className="text-xs">
                {PRIORITY_CONFIG[filterPriority as keyof typeof PRIORITY_CONFIG]?.label}
              </Badge>
            )}
            {filterType !== "ALL" && (
              <Badge variant="secondary" className="text-xs">
                {TYPE_CONFIG[filterType as keyof typeof TYPE_CONFIG]?.label}
              </Badge>
            )}
            <span className="text-xs text-slate-400">
              — {filteredTasks.length} of {allTasks.length} tasks
            </span>
          </div>
        )}
      </div>

      {/* ── Board area ── */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
          </div>
        ) : !hasProjects ? (
          <EmptyState
            icon={<Kanban className="w-10 h-10 text-slate-300" />}
            title="No projects yet"
            description="Create a project first, then add stages and tasks here."
          />
        ) : !hasStages ? (
          <EmptyState
            icon={<AlertCircle className="w-10 h-10 text-slate-300" />}
            title="No stages found"
            description="This project has no Kanban stages yet. Add stages to start organising tasks."
          />
        ) : (
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-5 items-start">
              {stages.map((stage) => (
                <KanbanColumn
                  key={stage.id}
                  stage={stage}
                  tasks={tasksByStage[stage.id] ?? []}
                  activeId={activeId}
                  onAddTask={openCreateModal}
                />
              ))}
            </div>

            <DragOverlay>
              {activeTask && (
                <div className="rotate-2 opacity-95">
                  <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-3 shadow-xl w-72">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100 line-clamp-2">
                      {activeTask.title}
                    </p>
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

      {/* ── Create task modal ── */}
      {modalOpen && effectiveProjectId && (
        <CreateTaskModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          projectId={effectiveProjectId}
          stageId={modalStageId}
          agencyId={agencyId}
          stages={stages}
        />
      )}
    </div>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <div className="mb-4">{icon}</div>
      <h3 className="text-base font-semibold text-slate-600 dark:text-slate-300 mb-1">{title}</h3>
      <p className="text-sm text-slate-400 dark:text-slate-500 max-w-xs">{description}</p>
    </div>
  );
}
