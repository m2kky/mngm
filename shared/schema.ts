import { z } from "zod";

// User role enum
export const UserRole = z.enum([
  "admin", 
  "team_leader", 
  "supervisor", 
  "employee", 
  "hr", 
  "client", 
  "workspace_admin"
]);

// Task status enum
export const TaskStatus = z.enum(["todo", "in_progress", "done", "blocked"]);

// Task priority enum
export const TaskPriority = z.enum(["low", "medium", "high", "urgent"]);

// Attendance status enum
export const AttendanceStatus = z.enum(["present", "late", "absent", "excused"]);

// Page visibility enum
export const PageVisibility = z.enum(["private", "team", "workspace", "public"]);

// Block type enum
export const BlockType = z.enum([
  "text", "heading", "todo", "file", "image", "embed", 
  "table", "kanban", "calendar", "chart", "ai_summary", 
  "timer", "comment", "subpage"
]);

// File type enum
export const FileType = z.enum(["image", "pdf", "video", "audio", "document", "other"]);

// Message type enum
export const MessageType = z.enum(["text", "image", "file", "system"]);

// User schema
export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  role: UserRole,
  teamId: z.string().nullable(),
  workspaceId: z.string(),
  language: z.enum(["en", "ar"]).default("en"),
  isActive: z.boolean().default(true),
  profilePicture: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date()
});

export const insertUserSchema = userSchema.omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

// Workspace schema
export const workspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  logoURL: z.string().nullable(),
  createdBy: z.string(),
  settings: z.object({
    theme: z.enum(["light", "dark", "auto"]).default("light"),
    language: z.enum(["en", "ar"]).default("en"),
    workingHours: z.object({
      start: z.string(),
      end: z.string()
    })
  }),
  createdAt: z.date(),
  updatedAt: z.date()
});

export const insertWorkspaceSchema = workspaceSchema.omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

// Team schema
export const teamSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  createdBy: z.string(),
  workspaceId: z.string(),
  memberIds: z.array(z.string()),
  createdAt: z.date(),
  updatedAt: z.date()
});

export const insertTeamSchema = teamSchema.omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

// Task schema
export const taskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  assignedTo: z.string(),
  assignedBy: z.string(),
  projectId: z.string().nullable(),
  status: TaskStatus,
  priority: TaskPriority,
  dueDate: z.date().nullable(),
  durationMinutes: z.number().nullable(),
  startTime: z.date().nullable(),
  endTime: z.date().nullable(),
  reminderBreakEvery: z.number().nullable(),
  tags: z.array(z.string()),
  workspaceId: z.string(),
  createdAt: z.date(),
  updatedAt: z.date()
});

export const insertTaskSchema = taskSchema.omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

// Attendance schema
export const attendanceSchema = z.object({
  id: z.string(),
  userId: z.string(),
  date: z.date(),
  checkIn: z.date().nullable(),
  checkOut: z.date().nullable(),
  status: AttendanceStatus,
  notes: z.string().nullable(),
  workspaceId: z.string(),
  createdAt: z.date(),
  updatedAt: z.date()
});

export const insertAttendanceSchema = attendanceSchema.omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

// Daily Report schema
export const dailyReportSchema = z.object({
  id: z.string(),
  userId: z.string(),
  date: z.date(),
  content: z.string(),
  mood: z.enum(["excellent", "good", "neutral", "bad", "terrible"]).nullable(),
  summary: z.string().nullable(), // AI-generated
  workspaceId: z.string(),
  createdAt: z.date()
});

export const insertDailyReportSchema = dailyReportSchema.omit({ 
  id: true, 
  createdAt: true 
});

// Evaluation schema
export const evaluationSchema = z.object({
  id: z.string(),
  userId: z.string(),
  evaluatedBy: z.string(),
  period: z.string(), // e.g., "2024-12"
  score: z.number().min(0).max(100),
  generatedByAi: z.boolean().default(false),
  notes: z.string().nullable(),
  metrics: z.object({
    taskCompletion: z.number(),
    timeEfficiency: z.number(),
    teamCollaboration: z.number(),
    qualityOfWork: z.number()
  }),
  workspaceId: z.string(),
  createdAt: z.date()
});

export const insertEvaluationSchema = evaluationSchema.omit({ 
  id: true, 
  createdAt: true 
});

// Page schema
export const pageSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(), // JSON string of blocks
  workspaceId: z.string(),
  teamId: z.string().nullable(),
  createdBy: z.string(),
  visibility: PageVisibility,
  editors: z.array(z.string()),
  parentPageId: z.string().nullable(),
  order: z.number().default(0),
  createdAt: z.date(),
  updatedAt: z.date()
});

export const insertPageSchema = pageSchema.omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

// Block schema
export const blockSchema = z.object({
  id: z.string(),
  pageId: z.string(),
  type: BlockType,
  content: z.string(), // JSON string
  position: z.number(),
  createdBy: z.string(),
  createdAt: z.date(),
  updatedAt: z.date()
});

export const insertBlockSchema = blockSchema.omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

// File schema
export const fileSchema = z.object({
  id: z.string(),
  filename: z.string(),
  fileUrl: z.string(),
  fileType: FileType,
  size: z.number(),
  uploadedBy: z.string(),
  linkedTo: z.string().nullable(), // taskId, reportId, pageId, etc.
  visibility: PageVisibility,
  workspaceId: z.string(),
  createdAt: z.date()
});

export const insertFileSchema = fileSchema.omit({ 
  id: true, 
  createdAt: true 
});

// Message schema
export const messageSchema = z.object({
  id: z.string(),
  senderId: z.string(),
  channelId: z.string(),
  content: z.string(),
  type: MessageType,
  fileUrl: z.string().nullable(),
  workspaceId: z.string(),
  createdAt: z.date()
});

export const insertMessageSchema = messageSchema.omit({ 
  id: true, 
  createdAt: true 
});

// Channel schema
export const channelSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  workspaceId: z.string(),
  teamId: z.string().nullable(),
  projectId: z.string().nullable(),
  memberIds: z.array(z.string()),
  createdBy: z.string(),
  createdAt: z.date(),
  updatedAt: z.date()
});

export const insertChannelSchema = channelSchema.omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

// Project schema
export const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  clientId: z.string().nullable(),
  teamId: z.string(),
  status: z.enum(["planning", "active", "completed", "on_hold"]),
  startDate: z.date().nullable(),
  endDate: z.date().nullable(),
  workspaceId: z.string(),
  createdAt: z.date(),
  updatedAt: z.date()
});

export const insertProjectSchema = projectSchema.omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

// Client schema
export const clientSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  company: z.string().nullable(),
  linkedProjects: z.array(z.string()),
  canViewPages: z.boolean().default(true),
  canComment: z.boolean().default(true),
  workspaceId: z.string(),
  createdAt: z.date()
});

export const insertClientSchema = clientSchema.omit({ 
  id: true, 
  createdAt: true 
});

// Timer schema
export const timerSchema = z.object({
  id: z.string(),
  userId: z.string(),
  taskId: z.string().nullable(),
  startTime: z.date(),
  endTime: z.date().nullable(),
  duration: z.number().default(0), // in seconds
  isActive: z.boolean().default(true),
  workspaceId: z.string(),
  createdAt: z.date()
});

export const insertTimerSchema = timerSchema.omit({ 
  id: true, 
  createdAt: true 
});

// Notification schema
export const notificationSchema = z.object({
  id: z.string(),
  userId: z.string(),
  title: z.string(),
  content: z.string(),
  type: z.enum(["info", "success", "warning", "error"]),
  isRead: z.boolean().default(false),
  actionUrl: z.string().nullable(),
  workspaceId: z.string(),
  createdAt: z.date()
});

export const insertNotificationSchema = notificationSchema.omit({ 
  id: true, 
  createdAt: true 
});

// Type exports
export type User = z.infer<typeof userSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Workspace = z.infer<typeof workspaceSchema>;
export type InsertWorkspace = z.infer<typeof insertWorkspaceSchema>;
export type Team = z.infer<typeof teamSchema>;
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type Task = z.infer<typeof taskSchema>;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Attendance = z.infer<typeof attendanceSchema>;
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type DailyReport = z.infer<typeof dailyReportSchema>;
export type InsertDailyReport = z.infer<typeof insertDailyReportSchema>;
export type Evaluation = z.infer<typeof evaluationSchema>;
export type InsertEvaluation = z.infer<typeof insertEvaluationSchema>;
export type Page = z.infer<typeof pageSchema>;
export type InsertPage = z.infer<typeof insertPageSchema>;
export type Block = z.infer<typeof blockSchema>;
export type InsertBlock = z.infer<typeof insertBlockSchema>;
export type File = z.infer<typeof fileSchema>;
export type InsertFile = z.infer<typeof insertFileSchema>;
export type Message = z.infer<typeof messageSchema>;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Channel = z.infer<typeof channelSchema>;
export type InsertChannel = z.infer<typeof insertChannelSchema>;
export type Project = z.infer<typeof projectSchema>;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Client = z.infer<typeof clientSchema>;
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Timer = z.infer<typeof timerSchema>;
export type InsertTimer = z.infer<typeof insertTimerSchema>;
export type Notification = z.infer<typeof notificationSchema>;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

export type UserRoleType = z.infer<typeof UserRole>;
