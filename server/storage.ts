import { randomUUID } from "crypto";
import { eq, and, isNull, isNotNull, asc, desc } from "drizzle-orm";
import { db } from "./db";
import {
  users, agencies, clients, projects, projectStages, tasks,
  timeEntries, taskComments, fileAssets, notifications, invitations,
  chatChannels, chatMessages, attendanceRecords,
} from "@shared/schema";
import {
  User, InsertUser,
  Agency, InsertAgency,
  Client, InsertClient,
  ClientStatus,
  Project, InsertProject,
  ProjectStatus,
  Task, InsertTask,
  TimeEntry, InsertTimeEntry,
  Notification, InsertNotification,
  TaskComment, InsertTaskComment,
  FileAsset, InsertFileAsset,
  Invitation, InsertInvitation,
  ProjectStage, InsertProjectStage,
  ChatChannel, InsertChatChannel,
  ChatMessage, InsertChatMessage,
  AttendanceRecord, InsertAttendanceRecord,
} from "@shared/schema";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined>;
  getAgencyUsers(agencyId: string): Promise<User[]>;

  // Agency methods
  getAgency(id: string): Promise<Agency | undefined>;
  createAgency(agency: InsertAgency): Promise<Agency>;
  updateAgency(id: string, updates: Partial<InsertAgency>): Promise<Agency | undefined>;

  // Client methods
  getClients(filters: { agencyId?: string; status?: string }): Promise<Client[]>;
  getClient(id: string): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: string, updates: Partial<InsertClient>): Promise<Client | undefined>;
  deleteClient(id: string): Promise<boolean>;

  // Project methods
  getProjects(filters: { agencyId?: string; clientId?: string; status?: string }): Promise<Project[]>;
  getProject(id: string): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, updates: Partial<InsertProject>): Promise<Project | undefined>;

  // Project Stage methods
  getProjectStages(projectId: string): Promise<ProjectStage[]>;
  createProjectStage(stage: InsertProjectStage): Promise<ProjectStage>;

  // Task methods
  getTasks(filters: { agencyId?: string; projectId?: string; stageId?: string; createdById?: string }): Promise<Task[]>;
  getTask(id: string): Promise<Task | undefined>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: string, updates: Partial<InsertTask>): Promise<Task | undefined>;
  deleteTask(id: string): Promise<boolean>;

  // Time Entry methods
  getTimeEntries(filters: { agencyId?: string; userId?: string; projectId?: string; taskId?: string }): Promise<TimeEntry[]>;
  createTimeEntry(entry: InsertTimeEntry): Promise<TimeEntry>;
  updateTimeEntry(id: string, updates: Partial<InsertTimeEntry>): Promise<TimeEntry | undefined>;

  // Task Comment methods
  getTaskComments(taskId: string): Promise<TaskComment[]>;
  createTaskComment(comment: InsertTaskComment): Promise<TaskComment>;

  // File Asset methods
  getFileAssets(filters: { agencyId?: string; projectId?: string; taskId?: string; clientId?: string }): Promise<FileAsset[]>;
  createFileAsset(file: InsertFileAsset): Promise<FileAsset>;

  // Notification methods
  getNotifications(filters: { userId?: string; agencyId?: string; readAt?: boolean }): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationRead(id: string): Promise<Notification | undefined>;

  // Invitation methods
  getInvitations(agencyId: string): Promise<Invitation[]>;
  createInvitation(invitation: InsertInvitation): Promise<Invitation>;

  // Dashboard methods
  getDashboardStats(filters: { agencyId: string; userId?: string }): Promise<any>;

  // Attendance methods
  getAttendanceRecords(filters: { agencyId?: string; userId?: string; startDate?: string; endDate?: string }): Promise<AttendanceRecord[]>;
  getAttendanceRecord(userId: string, date: string): Promise<AttendanceRecord | undefined>;
  upsertAttendanceRecord(record: InsertAttendanceRecord & { id?: string }): Promise<AttendanceRecord>;

  // Chat methods
  getChatChannels(agencyId: string): Promise<ChatChannel[]>;
  getChatChannel(id: string): Promise<ChatChannel | undefined>;
  createChatChannel(channel: InsertChatChannel): Promise<ChatChannel>;
  getChatMessages(channelId: string, limit?: number): Promise<ChatMessage[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
}


export class DrizzleStorage implements IStorage {
  // User methods
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email));
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values({ ...insertUser, id: randomUUID() }).returning();
    return result[0];
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined> {
    const result = await db.update(users).set({ ...updates, updatedAt: new Date() }).where(eq(users.id, id)).returning();
    return result[0];
  }

  async getAgencyUsers(agencyId: string): Promise<User[]> {
    return db.select().from(users).where(eq(users.agencyId, agencyId));
  }

  // Agency methods
  async getAgency(id: string): Promise<Agency | undefined> {
    const result = await db.select().from(agencies).where(eq(agencies.id, id));
    return result[0];
  }

  async createAgency(insertAgency: InsertAgency): Promise<Agency> {
    const result = await db.insert(agencies).values({ ...insertAgency, id: randomUUID() }).returning();
    return result[0];
  }

  async updateAgency(id: string, updates: Partial<InsertAgency>): Promise<Agency | undefined> {
    const result = await db.update(agencies).set({ ...updates, updatedAt: new Date() }).where(eq(agencies.id, id)).returning();
    return result[0];
  }

  // Client methods
  async getClients(filters: { agencyId?: string; status?: string }): Promise<Client[]> {
    const conditions = [];
    if (filters.agencyId) conditions.push(eq(clients.agencyId, filters.agencyId));
    if (filters.status) conditions.push(eq(clients.status, filters.status as ClientStatus));
    return db.select().from(clients).where(conditions.length > 0 ? and(...conditions) : undefined);
  }

  async getClient(id: string): Promise<Client | undefined> {
    const result = await db.select().from(clients).where(eq(clients.id, id));
    return result[0];
  }

  async createClient(insertClient: InsertClient): Promise<Client> {
    const result = await db.insert(clients).values({ ...insertClient, id: randomUUID() }).returning();
    return result[0];
  }

  async updateClient(id: string, updates: Partial<InsertClient>): Promise<Client | undefined> {
    const result = await db.update(clients).set({ ...updates, updatedAt: new Date() }).where(eq(clients.id, id)).returning();
    return result[0];
  }

  async deleteClient(id: string): Promise<boolean> {
    const result = await db.delete(clients).where(eq(clients.id, id)).returning();
    return result.length > 0;
  }

  // Project methods
  async getProjects(filters: { agencyId?: string; clientId?: string; status?: string }): Promise<Project[]> {
    const conditions = [];
    if (filters.agencyId) conditions.push(eq(projects.agencyId, filters.agencyId));
    if (filters.clientId) conditions.push(eq(projects.clientId, filters.clientId));
    if (filters.status) conditions.push(eq(projects.status, filters.status as ProjectStatus));
    return db.select().from(projects).where(conditions.length > 0 ? and(...conditions) : undefined);
  }

  async getProject(id: string): Promise<Project | undefined> {
    const result = await db.select().from(projects).where(eq(projects.id, id));
    return result[0];
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const result = await db.insert(projects).values({ ...insertProject, id: randomUUID() }).returning();
    return result[0];
  }

  async updateProject(id: string, updates: Partial<InsertProject>): Promise<Project | undefined> {
    const result = await db.update(projects).set({ ...updates, updatedAt: new Date() }).where(eq(projects.id, id)).returning();
    return result[0];
  }

  // Project Stage methods
  async getProjectStages(projectId: string): Promise<ProjectStage[]> {
    return db.select().from(projectStages).where(eq(projectStages.projectId, projectId)).orderBy(asc(projectStages.order));
  }

  async createProjectStage(insertStage: InsertProjectStage): Promise<ProjectStage> {
    const result = await db.insert(projectStages).values({ ...insertStage, id: randomUUID() }).returning();
    return result[0];
  }

  // Task methods
  async getTasks(filters: { agencyId?: string; projectId?: string; stageId?: string; createdById?: string }): Promise<Task[]> {
    const conditions = [];
    if (filters.agencyId) conditions.push(eq(tasks.agencyId, filters.agencyId));
    if (filters.projectId) conditions.push(eq(tasks.projectId, filters.projectId));
    if (filters.stageId) conditions.push(eq(tasks.stageId, filters.stageId));
    if (filters.createdById) conditions.push(eq(tasks.createdById, filters.createdById));
    return db.select().from(tasks).where(conditions.length > 0 ? and(...conditions) : undefined);
  }

  async getTask(id: string): Promise<Task | undefined> {
    const result = await db.select().from(tasks).where(eq(tasks.id, id));
    return result[0];
  }

  async createTask(insertTask: InsertTask): Promise<Task> {
    const result = await db.insert(tasks).values({ ...insertTask, id: randomUUID() }).returning();
    return result[0];
  }

  async updateTask(id: string, updates: Partial<InsertTask>): Promise<Task | undefined> {
    const result = await db.update(tasks).set({ ...updates, updatedAt: new Date() }).where(eq(tasks.id, id)).returning();
    return result[0];
  }

  async deleteTask(id: string): Promise<boolean> {
    const result = await db.delete(tasks).where(eq(tasks.id, id)).returning();
    return result.length > 0;
  }

  // Time Entry methods
  async getTimeEntries(filters: { agencyId?: string; userId?: string; projectId?: string; taskId?: string }): Promise<TimeEntry[]> {
    const conditions = [];
    if (filters.agencyId) conditions.push(eq(timeEntries.agencyId, filters.agencyId));
    if (filters.userId) conditions.push(eq(timeEntries.userId, filters.userId));
    if (filters.projectId) conditions.push(eq(timeEntries.projectId, filters.projectId));
    if (filters.taskId) conditions.push(eq(timeEntries.taskId, filters.taskId));
    return db.select().from(timeEntries).where(conditions.length > 0 ? and(...conditions) : undefined);
  }

  async createTimeEntry(insertEntry: InsertTimeEntry): Promise<TimeEntry> {
    const result = await db.insert(timeEntries).values({ ...insertEntry, id: randomUUID() }).returning();
    return result[0];
  }

  async updateTimeEntry(id: string, updates: Partial<InsertTimeEntry>): Promise<TimeEntry | undefined> {
    const result = await db.update(timeEntries).set({ ...updates, updatedAt: new Date() }).where(eq(timeEntries.id, id)).returning();
    return result[0];
  }

  // Task Comment methods
  async getTaskComments(taskId: string): Promise<TaskComment[]> {
    return db.select().from(taskComments).where(eq(taskComments.taskId, taskId)).orderBy(asc(taskComments.createdAt));
  }

  async createTaskComment(insertComment: InsertTaskComment): Promise<TaskComment> {
    const result = await db.insert(taskComments).values({ ...insertComment, id: randomUUID() }).returning();
    return result[0];
  }

  // File Asset methods
  async getFileAssets(filters: { agencyId?: string; projectId?: string; taskId?: string; clientId?: string }): Promise<FileAsset[]> {
    const conditions = [];
    if (filters.agencyId) conditions.push(eq(fileAssets.agencyId, filters.agencyId));
    if (filters.projectId) conditions.push(eq(fileAssets.projectId, filters.projectId));
    if (filters.taskId) conditions.push(eq(fileAssets.taskId, filters.taskId));
    if (filters.clientId) conditions.push(eq(fileAssets.clientId, filters.clientId));
    return db.select().from(fileAssets).where(conditions.length > 0 ? and(...conditions) : undefined);
  }

  async createFileAsset(insertFile: InsertFileAsset): Promise<FileAsset> {
    const result = await db.insert(fileAssets).values({ ...insertFile, id: randomUUID() }).returning();
    return result[0];
  }

  // Notification methods
  async getNotifications(filters: { userId?: string; agencyId?: string; readAt?: boolean }): Promise<Notification[]> {
    const conditions = [];
    if (filters.userId) conditions.push(eq(notifications.userId, filters.userId));
    if (filters.agencyId) conditions.push(eq(notifications.agencyId, filters.agencyId));
    if (filters.readAt === true) conditions.push(isNotNull(notifications.readAt));
    if (filters.readAt === false) conditions.push(isNull(notifications.readAt));
    return db.select().from(notifications).where(conditions.length > 0 ? and(...conditions) : undefined).orderBy(desc(notifications.createdAt));
  }

  async createNotification(insertNotif: InsertNotification): Promise<Notification> {
    const result = await db.insert(notifications).values({ ...insertNotif, id: randomUUID() }).returning();
    return result[0];
  }

  async markNotificationRead(id: string): Promise<Notification | undefined> {
    const result = await db.update(notifications).set({ readAt: new Date() }).where(eq(notifications.id, id)).returning();
    return result[0];
  }

  // Invitation methods
  async getInvitations(agencyId: string): Promise<Invitation[]> {
    return db.select().from(invitations).where(eq(invitations.agencyId, agencyId));
  }

  async createInvitation(insertInv: InsertInvitation): Promise<Invitation> {
    const result = await db.insert(invitations).values({ ...insertInv, id: randomUUID() }).returning();
    return result[0];
  }

  // Dashboard methods
  async getDashboardStats(filters: { agencyId: string; userId?: string }): Promise<any> {
    const [agencyTasks, agencyProjects, agencyClients] = await Promise.all([
      db.select().from(tasks).where(eq(tasks.agencyId, filters.agencyId)),
      db.select().from(projects).where(eq(projects.agencyId, filters.agencyId)),
      db.select().from(clients).where(eq(clients.agencyId, filters.agencyId)),
    ]);

    return {
      totalTasks: agencyTasks.length,
      completedTasks: agencyTasks.filter(t => t.completedAt !== null).length,
      activeProjects: agencyProjects.filter(p => p.status === "ACTIVE").length,
      totalClients: agencyClients.length,
      activeClients: agencyClients.filter(c => c.status === "ACTIVE").length,
    };
  }

  // Attendance methods
  async getAttendanceRecords(filters: { agencyId?: string; userId?: string; startDate?: string; endDate?: string }): Promise<AttendanceRecord[]> {
    const conditions = [];
    if (filters.agencyId) conditions.push(eq(attendanceRecords.agencyId, filters.agencyId));
    if (filters.userId) conditions.push(eq(attendanceRecords.userId, filters.userId));
    if (filters.startDate) conditions.push(eq(attendanceRecords.date, filters.startDate));
    return db.select().from(attendanceRecords)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(attendanceRecords.date));
  }

  async getAttendanceRecord(userId: string, date: string): Promise<AttendanceRecord | undefined> {
    const [row] = await db.select().from(attendanceRecords)
      .where(and(eq(attendanceRecords.userId, userId), eq(attendanceRecords.date, date)));
    return row;
  }

  async upsertAttendanceRecord(record: InsertAttendanceRecord & { id?: string }): Promise<AttendanceRecord> {
    const existing = await this.getAttendanceRecord(record.userId, record.date);
    if (existing) {
      const [row] = await db.update(attendanceRecords)
        .set({ ...record, updatedAt: new Date() })
        .where(eq(attendanceRecords.id, existing.id))
        .returning();
      return row;
    }
    const [row] = await db.insert(attendanceRecords)
      .values({ ...record, id: record.id ?? randomUUID(), createdAt: new Date(), updatedAt: new Date() })
      .returning();
    return row;
  }

  // Chat methods
  async getChatChannels(agencyId: string): Promise<ChatChannel[]> {
    return db.select().from(chatChannels).where(eq(chatChannels.agencyId, agencyId));
  }

  async getChatChannel(id: string): Promise<ChatChannel | undefined> {
    const [row] = await db.select().from(chatChannels).where(eq(chatChannels.id, id));
    return row;
  }

  async createChatChannel(channel: InsertChatChannel): Promise<ChatChannel> {
    const [row] = await db
      .insert(chatChannels)
      .values({ ...channel, id: randomUUID(), createdAt: new Date() })
      .returning();
    return row;
  }

  async getChatMessages(channelId: string, limit = 100): Promise<ChatMessage[]> {
    const rows = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.channelId, channelId))
      .orderBy(asc(chatMessages.createdAt))
      .limit(limit);
    return rows;
  }

  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const [row] = await db
      .insert(chatMessages)
      .values({ ...message, id: randomUUID(), createdAt: new Date() })
      .returning();
    return row;
  }
}

export const storage = new DrizzleStorage();
