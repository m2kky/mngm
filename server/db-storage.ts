import { randomUUID } from "crypto";

import { eq, and, isNull, isNotNull, desc } from "drizzle-orm";
import { db } from "./db";
import {
  users, agencies, clients, projects, projectStages, tasks,
  timeEntries, taskComments, fileAssets, notifications, invitations,
  chatChannels, chatMessages, attendanceRecords, pages,
} from "@shared/schema";
import type {
  User, InsertUser,
  Agency, InsertAgency,
  Client, InsertClient,
  Project, InsertProject,
  ProjectStage, InsertProjectStage,
  Task, InsertTask,
  TimeEntry, InsertTimeEntry,
  TaskComment, InsertTaskComment,
  FileAsset, InsertFileAsset,
  Notification, InsertNotification,
  Invitation, InsertInvitation,
  ChatChannel, InsertChatChannel,
  ChatMessage, InsertChatMessage,
  AttendanceRecord, InsertAttendanceRecord,
  Page, InsertPage,
} from "@shared/schema";
import type { IStorage } from "./storage";

export class DatabaseStorage implements IStorage {
  // ─── User methods ────────────────────────────────────────────────────────────

  async getUser(id: string): Promise<User | undefined> {
    const [row] = await db.select().from(users).where(eq(users.id, id));
    return row;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [row] = await db.select().from(users).where(eq(users.email, email));
    return row;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const now = new Date();
    const [row] = await db
      .insert(users)
      .values({
        id: randomUUID(),
        name: null,
        image: null,
        lastLoginAt: null,
        agencyId: null,
        ...insertUser,
        passwordHash: insertUser.passwordHash ?? null,
        emailVerified: insertUser.emailVerified ?? false,
        status: insertUser.status ?? "ACTIVE",
        language: insertUser.language ?? "en",
        theme: insertUser.theme ?? "system",
        role: insertUser.role ?? "TEAM_MEMBER",
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return row;
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined> {
    const [row] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return row;
  }

  async getAgencyUsers(agencyId: string): Promise<User[]> {
    return db.select().from(users).where(eq(users.agencyId, agencyId));
  }

  // ─── Agency methods ──────────────────────────────────────────────────────────

  async getAgency(id: string): Promise<Agency | undefined> {
    const [row] = await db.select().from(agencies).where(eq(agencies.id, id));
    return row;
  }

  async createAgency(insertAgency: InsertAgency): Promise<Agency> {
    const now = new Date();
    const [row] = await db
      .insert(agencies)
      .values({
        id: randomUUID(),
        slug: null,
        logo: null,
        ownerId: null,
        ...insertAgency,
        plan: insertAgency.plan ?? "FREE",
        onboardingCompleted: insertAgency.onboardingCompleted ?? false,
        workingDays: insertAgency.workingDays ?? [0, 1, 2, 3, 4],
        workingHoursStart: insertAgency.workingHoursStart ?? "09:00",
        workingHoursEnd: insertAgency.workingHoursEnd ?? "17:00",
        timezone: insertAgency.timezone ?? "Africa/Cairo",
        currency: insertAgency.currency ?? "EGP",
        locale: insertAgency.locale ?? "ar-EG",
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return row;
  }

  async updateAgency(id: string, updates: Partial<InsertAgency>): Promise<Agency | undefined> {
    const [row] = await db
      .update(agencies)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(agencies.id, id))
      .returning();
    return row;
  }

  // ─── Client methods ──────────────────────────────────────────────────────────

  async getClients(filters: { agencyId?: string; status?: string }): Promise<Client[]> {
    const conditions = [];
    if (filters.agencyId) conditions.push(eq(clients.agencyId, filters.agencyId));
    if (filters.status) conditions.push(eq(clients.status, filters.status as Client["status"]));
    return conditions.length
      ? db.select().from(clients).where(and(...conditions))
      : db.select().from(clients);
  }

  async getClient(id: string): Promise<Client | undefined> {
    const [row] = await db.select().from(clients).where(eq(clients.id, id));
    return row;
  }

  async createClient(insertClient: InsertClient): Promise<Client> {
    const now = new Date();
    const [row] = await db
      .insert(clients)
      .values({
        id: randomUUID(),
        slug: null,
        industry: null,
        website: null,
        logo: null,
        coverImage: null,
        iconEmoji: null,
        iconColor: null,
        notes: null,
        contractType: null,
        monthlyBudget: null,
        hourlyRate: null,
        createdById: null,
        archivedAt: null,
        deletedAt: null,
        ...insertClient,
        status: insertClient.status ?? "ACTIVE",
        healthScore: insertClient.healthScore ?? 0,
        portalEnabled: insertClient.portalEnabled ?? false,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return row;
  }

  async updateClient(id: string, updates: Partial<InsertClient>): Promise<Client | undefined> {
    const [row] = await db
      .update(clients)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(clients.id, id))
      .returning();
    return row;
  }

  async deleteClient(id: string): Promise<boolean> {
    const result = await db.delete(clients).where(eq(clients.id, id)).returning();
    return result.length > 0;
  }

  // ─── Project methods ─────────────────────────────────────────────────────────

  async getProjects(filters: { agencyId?: string; clientId?: string; status?: string }): Promise<Project[]> {
    const conditions = [];
    if (filters.agencyId) conditions.push(eq(projects.agencyId, filters.agencyId));
    if (filters.clientId) conditions.push(eq(projects.clientId, filters.clientId));
    if (filters.status) conditions.push(eq(projects.status, filters.status as Project["status"]));
    return conditions.length
      ? db.select().from(projects).where(and(...conditions))
      : db.select().from(projects);
  }

  async getProject(id: string): Promise<Project | undefined> {
    const [row] = await db.select().from(projects).where(eq(projects.id, id));
    return row;
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const now = new Date();
    const [row] = await db
      .insert(projects)
      .values({
        id: randomUUID(),
        description: null,
        startDate: null,
        dueDate: null,
        completedAt: null,
        budgetHours: null,
        budgetAmount: null,
        coverImage: null,
        iconEmoji: null,
        iconColor: null,
        createdById: null,
        archivedAt: null,
        deletedAt: null,
        ...insertProject,
        type: insertProject.type ?? "ONE_TIME",
        status: insertProject.status ?? "PLANNING",
        priority: insertProject.priority ?? "MEDIUM",
        progress: insertProject.progress ?? 0,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return row;
  }

  async updateProject(id: string, updates: Partial<InsertProject>): Promise<Project | undefined> {
    const [row] = await db
      .update(projects)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();
    return row;
  }

  // ─── Project Stage methods ───────────────────────────────────────────────────

  async getProjectStages(projectId: string): Promise<ProjectStage[]> {
    return db
      .select()
      .from(projectStages)
      .where(eq(projectStages.projectId, projectId))
      .orderBy(projectStages.order);
  }

  async createProjectStage(insertStage: InsertProjectStage): Promise<ProjectStage> {
    const now = new Date();
    const [row] = await db
      .insert(projectStages)
      .values({
        id: randomUUID(),
        color: null,
        wipLimit: null,
        ...insertStage,
        isDefault: insertStage.isDefault ?? false,
        isDone: insertStage.isDone ?? false,
        isClientReview: insertStage.isClientReview ?? false,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return row;
  }

  // ─── Task methods ────────────────────────────────────────────────────────────

  async getTasks(filters: { agencyId?: string; projectId?: string; stageId?: string; createdById?: string }): Promise<Task[]> {
    const conditions = [];
    if (filters.agencyId) conditions.push(eq(tasks.agencyId, filters.agencyId));
    if (filters.projectId) conditions.push(eq(tasks.projectId, filters.projectId));
    if (filters.stageId) conditions.push(eq(tasks.stageId, filters.stageId));
    if (filters.createdById) conditions.push(eq(tasks.createdById, filters.createdById));
    return conditions.length
      ? db.select().from(tasks).where(and(...conditions))
      : db.select().from(tasks);
  }

  async getTask(id: string): Promise<Task | undefined> {
    const [row] = await db.select().from(tasks).where(eq(tasks.id, id));
    return row;
  }

  async createTask(insertTask: InsertTask): Promise<Task> {
    const now = new Date();
    const [row] = await db
      .insert(tasks)
      .values({
        id: randomUUID(),
        description: null,
        startDate: null,
        dueDate: null,
        completedAt: null,
        approvedAt: null,
        rejectedAt: null,
        estimatedMinutes: null,
        coverImage: null,
        iconEmoji: null,
        iconColor: null,
        reviewerId: null,
        archivedAt: null,
        deletedAt: null,
        ...insertTask,
        type: insertTask.type ?? "DESIGN",
        priority: insertTask.priority ?? "MEDIUM",
        reviewStatus: insertTask.reviewStatus ?? "NOT_REQUIRED",
        actualMinutes: insertTask.actualMinutes ?? 0,
        position: insertTask.position ?? 0,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return row;
  }

  async updateTask(id: string, updates: Partial<InsertTask>): Promise<Task | undefined> {
    const [row] = await db
      .update(tasks)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(tasks.id, id))
      .returning();
    return row;
  }

  async deleteTask(id: string): Promise<boolean> {
    const result = await db.delete(tasks).where(eq(tasks.id, id)).returning();
    return result.length > 0;
  }

  // ─── Time Entry methods ──────────────────────────────────────────────────────

  async getTimeEntries(filters: { agencyId?: string; userId?: string; projectId?: string; taskId?: string }): Promise<TimeEntry[]> {
    const conditions = [];
    if (filters.agencyId) conditions.push(eq(timeEntries.agencyId, filters.agencyId));
    if (filters.userId) conditions.push(eq(timeEntries.userId, filters.userId));
    if (filters.projectId) conditions.push(eq(timeEntries.projectId, filters.projectId));
    if (filters.taskId) conditions.push(eq(timeEntries.taskId, filters.taskId));
    return conditions.length
      ? db.select().from(timeEntries).where(and(...conditions))
      : db.select().from(timeEntries);
  }

  async createTimeEntry(insertEntry: InsertTimeEntry): Promise<TimeEntry> {
    const now = new Date();
    const [row] = await db
      .insert(timeEntries)
      .values({
        id: randomUUID(),
        clientId: null,
        taskId: null,
        endTime: null,
        durationMinutes: null,
        note: null,
        editedAt: null,
        deletedAt: null,
        ...insertEntry,
        billable: insertEntry.billable ?? true,
        source: insertEntry.source ?? "MANUAL",
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return row;
  }

  async updateTimeEntry(id: string, updates: Partial<InsertTimeEntry>): Promise<TimeEntry | undefined> {
    const [row] = await db
      .update(timeEntries)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(timeEntries.id, id))
      .returning();
    return row;
  }

  // ─── Task Comment methods ────────────────────────────────────────────────────

  async getTaskComments(taskId: string): Promise<TaskComment[]> {
    return db
      .select()
      .from(taskComments)
      .where(eq(taskComments.taskId, taskId))
      .orderBy(taskComments.createdAt);
  }

  async createTaskComment(insertComment: InsertTaskComment): Promise<TaskComment> {
    const now = new Date();
    const [row] = await db
      .insert(taskComments)
      .values({
        id: randomUUID(),
        authorUserId: null,
        authorClientPortalUserId: null,
        parentCommentId: null,
        editedAt: null,
        deletedAt: null,
        ...insertComment,
        authorType: insertComment.authorType ?? "TEAM",
        mentions: insertComment.mentions ?? [],
        isClientFeedback: insertComment.isClientFeedback ?? false,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return row;
  }

  // ─── File Asset methods ──────────────────────────────────────────────────────

  async getFileAssets(filters: { agencyId?: string; projectId?: string; taskId?: string; clientId?: string }): Promise<FileAsset[]> {
    const conditions = [];
    if (filters.agencyId) conditions.push(eq(fileAssets.agencyId, filters.agencyId));
    if (filters.projectId) conditions.push(eq(fileAssets.projectId, filters.projectId));
    if (filters.taskId) conditions.push(eq(fileAssets.taskId, filters.taskId));
    if (filters.clientId) conditions.push(eq(fileAssets.clientId, filters.clientId));
    return conditions.length
      ? db.select().from(fileAssets).where(and(...conditions))
      : db.select().from(fileAssets);
  }

  async createFileAsset(insertFile: InsertFileAsset): Promise<FileAsset> {
    const now = new Date();
    const [row] = await db
      .insert(fileAssets)
      .values({
        id: randomUUID(),
        clientId: null,
        projectId: null,
        taskId: null,
        commentId: null,
        brandKitId: null,
        strategyId: null,
        uploadedById: null,
        uploadedByClientPortalUserId: null,
        thumbnailUrl: null,
        checksum: null,
        folder: null,
        metadata: null,
        deletedAt: null,
        ...insertFile,
        context: insertFile.context ?? "GENERAL",
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return row;
  }

  // ─── Notification methods ────────────────────────────────────────────────────

  async getNotifications(filters: { userId?: string; agencyId?: string; readAt?: boolean }): Promise<Notification[]> {
    const conditions = [];
    if (filters.userId) conditions.push(eq(notifications.userId, filters.userId));
    if (filters.agencyId) conditions.push(eq(notifications.agencyId, filters.agencyId));
    if (filters.readAt === true) conditions.push(isNotNull(notifications.readAt));
    if (filters.readAt === false) conditions.push(isNull(notifications.readAt));
    const rows = await (conditions.length
      ? db.select().from(notifications).where(and(...conditions))
      : db.select().from(notifications));
    return rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async createNotification(insertNotif: InsertNotification): Promise<Notification> {
    const [row] = await db
      .insert(notifications)
      .values({
        id: randomUUID(),
        userId: null,
        clientPortalUserId: null,
        body: null,
        actorUserId: null,
        actorClientPortalUserId: null,
        entityType: null,
        entityId: null,
        deepLink: null,
        readAt: null,
        archivedAt: null,
        ...insertNotif,
        channel: insertNotif.channel ?? "IN_APP",
        createdAt: new Date(),
      })
      .returning();
    return row;
  }

  async markNotificationRead(id: string): Promise<Notification | undefined> {
    const [row] = await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(eq(notifications.id, id))
      .returning();
    return row;
  }

  // ─── Invitation methods ──────────────────────────────────────────────────────

  async getInvitations(agencyId: string): Promise<Invitation[]> {
    return db.select().from(invitations).where(eq(invitations.agencyId, agencyId));
  }

  async createInvitation(insertInv: InsertInvitation): Promise<Invitation> {
    const now = new Date();
    const [row] = await db
      .insert(invitations)
      .values({
        id: randomUUID(),
        userId: null,
        acceptedAt: null,
        revokedAt: null,
        ...insertInv,
        status: insertInv.status ?? "PENDING",
        role: insertInv.role ?? "TEAM_MEMBER",
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return row;
  }

  async getInvitationByToken(token: string): Promise<Invitation | undefined> {
    const [row] = await db.select().from(invitations).where(eq(invitations.token, token));
    return row;
  }

  async updateInvitation(id: string, updates: Partial<Invitation>): Promise<Invitation | undefined> {
    const [row] = await db
      .update(invitations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(invitations.id, id))
      .returning();
    return row;
  }

  // ─── Chat methods ────────────────────────────────────────────────────────────

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
      .orderBy(chatMessages.createdAt)
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

  // ─── Attendance methods ───────────────────────────────────────────────────────

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

  // ─── Pages methods ───────────────────────────────────────────────────────────

  async getPages(agencyId: string): Promise<Page[]> {
    return db.select().from(pages).where(eq(pages.agencyId, agencyId)).orderBy(desc(pages.updatedAt));
  }

  async getPage(id: string): Promise<Page | undefined> {
    const [row] = await db.select().from(pages).where(eq(pages.id, id));
    return row;
  }

  async createPage(page: InsertPage): Promise<Page> {
    const [row] = await db
      .insert(pages)
      .values({ ...page, id: randomUUID(), createdAt: new Date(), updatedAt: new Date() })
      .returning();
    return row;
  }

  async updatePage(id: string, updates: Partial<InsertPage>): Promise<Page | undefined> {
    const [row] = await db
      .update(pages)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(pages.id, id))
      .returning();
    return row;
  }

  async deletePage(id: string): Promise<boolean> {
    const result = await db.delete(pages).where(eq(pages.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // ─── Dashboard methods ───────────────────────────────────────────────────────

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
}
