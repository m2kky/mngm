import { randomUUID } from "crypto";
import {
  User, InsertUser,
  Agency, InsertAgency,
  Client, InsertClient,
  Project, InsertProject,
  Task, InsertTask,
  TimeEntry, InsertTimeEntry,
  Notification, InsertNotification,
  TaskComment, InsertTaskComment,
  FileAsset, InsertFileAsset,
  Invitation, InsertInvitation,
  ProjectStage, InsertProjectStage,
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
}

export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private agencies: Map<string, Agency> = new Map();
  private clients: Map<string, Client> = new Map();
  private projects: Map<string, Project> = new Map();
  private projectStages: Map<string, ProjectStage> = new Map();
  private tasks: Map<string, Task> = new Map();
  private timeEntries: Map<string, TimeEntry> = new Map();
  private taskComments: Map<string, TaskComment> = new Map();
  private fileAssets: Map<string, FileAsset> = new Map();
  private notifications: Map<string, Notification> = new Map();
  private invitations: Map<string, Invitation> = new Map();

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.email === email);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const now = new Date();
    const user: User = {
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
    };
    this.users.set(user.id, user);
    return user;
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    const updated: User = { ...user, ...updates, updatedAt: new Date() };
    this.users.set(id, updated);
    return updated;
  }

  async getAgencyUsers(agencyId: string): Promise<User[]> {
    return Array.from(this.users.values()).filter(u => u.agencyId === agencyId);
  }

  // Agency methods
  async getAgency(id: string): Promise<Agency | undefined> {
    return this.agencies.get(id);
  }

  async createAgency(insertAgency: InsertAgency): Promise<Agency> {
    const now = new Date();
    const agency: Agency = {
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
    };
    this.agencies.set(agency.id, agency);
    return agency;
  }

  async updateAgency(id: string, updates: Partial<InsertAgency>): Promise<Agency | undefined> {
    const agency = this.agencies.get(id);
    if (!agency) return undefined;
    const updated: Agency = { ...agency, ...updates, updatedAt: new Date() };
    this.agencies.set(id, updated);
    return updated;
  }

  // Client methods
  async getClients(filters: { agencyId?: string; status?: string }): Promise<Client[]> {
    return Array.from(this.clients.values()).filter(c => {
      if (filters.agencyId && c.agencyId !== filters.agencyId) return false;
      if (filters.status && c.status !== filters.status) return false;
      return true;
    });
  }

  async getClient(id: string): Promise<Client | undefined> {
    return this.clients.get(id);
  }

  async createClient(insertClient: InsertClient): Promise<Client> {
    const now = new Date();
    const client: Client = {
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
    };
    this.clients.set(client.id, client);
    return client;
  }

  async updateClient(id: string, updates: Partial<InsertClient>): Promise<Client | undefined> {
    const client = this.clients.get(id);
    if (!client) return undefined;
    const updated: Client = { ...client, ...updates, updatedAt: new Date() };
    this.clients.set(id, updated);
    return updated;
  }

  async deleteClient(id: string): Promise<boolean> {
    return this.clients.delete(id);
  }

  // Project methods
  async getProjects(filters: { agencyId?: string; clientId?: string; status?: string }): Promise<Project[]> {
    return Array.from(this.projects.values()).filter(p => {
      if (filters.agencyId && p.agencyId !== filters.agencyId) return false;
      if (filters.clientId && p.clientId !== filters.clientId) return false;
      if (filters.status && p.status !== filters.status) return false;
      return true;
    });
  }

  async getProject(id: string): Promise<Project | undefined> {
    return this.projects.get(id);
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const now = new Date();
    const project: Project = {
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
    };
    this.projects.set(project.id, project);
    return project;
  }

  async updateProject(id: string, updates: Partial<InsertProject>): Promise<Project | undefined> {
    const project = this.projects.get(id);
    if (!project) return undefined;
    const updated: Project = { ...project, ...updates, updatedAt: new Date() };
    this.projects.set(id, updated);
    return updated;
  }

  // Project Stage methods
  async getProjectStages(projectId: string): Promise<ProjectStage[]> {
    return Array.from(this.projectStages.values())
      .filter(s => s.projectId === projectId)
      .sort((a, b) => a.order - b.order);
  }

  async createProjectStage(insertStage: InsertProjectStage): Promise<ProjectStage> {
    const now = new Date();
    const stage: ProjectStage = {
      id: randomUUID(),
      color: null,
      wipLimit: null,
      ...insertStage,
      isDefault: insertStage.isDefault ?? false,
      isDone: insertStage.isDone ?? false,
      isClientReview: insertStage.isClientReview ?? false,
      createdAt: now,
      updatedAt: now,
    };
    this.projectStages.set(stage.id, stage);
    return stage;
  }

  // Task methods
  async getTasks(filters: { agencyId?: string; projectId?: string; stageId?: string; createdById?: string }): Promise<Task[]> {
    return Array.from(this.tasks.values()).filter(t => {
      if (filters.agencyId && t.agencyId !== filters.agencyId) return false;
      if (filters.projectId && t.projectId !== filters.projectId) return false;
      if (filters.stageId && t.stageId !== filters.stageId) return false;
      if (filters.createdById && t.createdById !== filters.createdById) return false;
      return true;
    });
  }

  async getTask(id: string): Promise<Task | undefined> {
    return this.tasks.get(id);
  }

  async createTask(insertTask: InsertTask): Promise<Task> {
    const now = new Date();
    const task: Task = {
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
    };
    this.tasks.set(task.id, task);
    return task;
  }

  async updateTask(id: string, updates: Partial<InsertTask>): Promise<Task | undefined> {
    const task = this.tasks.get(id);
    if (!task) return undefined;
    const updated: Task = { ...task, ...updates, updatedAt: new Date() };
    this.tasks.set(id, updated);
    return updated;
  }

  async deleteTask(id: string): Promise<boolean> {
    return this.tasks.delete(id);
  }

  // Time Entry methods
  async getTimeEntries(filters: { agencyId?: string; userId?: string; projectId?: string; taskId?: string }): Promise<TimeEntry[]> {
    return Array.from(this.timeEntries.values()).filter(e => {
      if (filters.agencyId && e.agencyId !== filters.agencyId) return false;
      if (filters.userId && e.userId !== filters.userId) return false;
      if (filters.projectId && e.projectId !== filters.projectId) return false;
      if (filters.taskId && e.taskId !== filters.taskId) return false;
      return true;
    });
  }

  async createTimeEntry(insertEntry: InsertTimeEntry): Promise<TimeEntry> {
    const now = new Date();
    const entry: TimeEntry = {
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
    };
    this.timeEntries.set(entry.id, entry);
    return entry;
  }

  async updateTimeEntry(id: string, updates: Partial<InsertTimeEntry>): Promise<TimeEntry | undefined> {
    const entry = this.timeEntries.get(id);
    if (!entry) return undefined;
    const updated: TimeEntry = { ...entry, ...updates, updatedAt: new Date() };
    this.timeEntries.set(id, updated);
    return updated;
  }

  // Task Comment methods
  async getTaskComments(taskId: string): Promise<TaskComment[]> {
    return Array.from(this.taskComments.values())
      .filter(c => c.taskId === taskId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async createTaskComment(insertComment: InsertTaskComment): Promise<TaskComment> {
    const now = new Date();
    const comment: TaskComment = {
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
    };
    this.taskComments.set(comment.id, comment);
    return comment;
  }

  // File Asset methods
  async getFileAssets(filters: { agencyId?: string; projectId?: string; taskId?: string; clientId?: string }): Promise<FileAsset[]> {
    return Array.from(this.fileAssets.values()).filter(f => {
      if (filters.agencyId && f.agencyId !== filters.agencyId) return false;
      if (filters.projectId && f.projectId !== filters.projectId) return false;
      if (filters.taskId && f.taskId !== filters.taskId) return false;
      if (filters.clientId && f.clientId !== filters.clientId) return false;
      return true;
    });
  }

  async createFileAsset(insertFile: InsertFileAsset): Promise<FileAsset> {
    const now = new Date();
    const file: FileAsset = {
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
    };
    this.fileAssets.set(file.id, file);
    return file;
  }

  // Notification methods
  async getNotifications(filters: { userId?: string; agencyId?: string; readAt?: boolean }): Promise<Notification[]> {
    return Array.from(this.notifications.values())
      .filter(n => {
        if (filters.userId && n.userId !== filters.userId) return false;
        if (filters.agencyId && n.agencyId !== filters.agencyId) return false;
        if (filters.readAt !== undefined) {
          if (filters.readAt && !n.readAt) return false;
          if (!filters.readAt && n.readAt) return false;
        }
        return true;
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async createNotification(insertNotif: InsertNotification): Promise<Notification> {
    const notification: Notification = {
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
    };
    this.notifications.set(notification.id, notification);
    return notification;
  }

  async markNotificationRead(id: string): Promise<Notification | undefined> {
    const n = this.notifications.get(id);
    if (!n) return undefined;
    const updated: Notification = { ...n, readAt: new Date() };
    this.notifications.set(id, updated);
    return updated;
  }

  // Invitation methods
  async getInvitations(agencyId: string): Promise<Invitation[]> {
    return Array.from(this.invitations.values()).filter(i => i.agencyId === agencyId);
  }

  async createInvitation(insertInv: InsertInvitation): Promise<Invitation> {
    const now = new Date();
    const invitation: Invitation = {
      id: randomUUID(),
      userId: null,
      acceptedAt: null,
      revokedAt: null,
      ...insertInv,
      status: insertInv.status ?? "PENDING",
      role: insertInv.role ?? "TEAM_MEMBER",
      createdAt: now,
      updatedAt: now,
    };
    this.invitations.set(invitation.id, invitation);
    return invitation;
  }

  // Dashboard methods
  async getDashboardStats(filters: { agencyId: string; userId?: string }): Promise<any> {
    const agencyTasks = Array.from(this.tasks.values()).filter(t => t.agencyId === filters.agencyId);
    const agencyProjects = Array.from(this.projects.values()).filter(p => p.agencyId === filters.agencyId);
    const agencyClients = Array.from(this.clients.values()).filter(c => c.agencyId === filters.agencyId);

    return {
      totalTasks: agencyTasks.length,
      completedTasks: agencyTasks.filter(t => t.completedAt !== null).length,
      activeProjects: agencyProjects.filter(p => p.status === "ACTIVE").length,
      totalClients: agencyClients.length,
      activeClients: agencyClients.filter(c => c.status === "ACTIVE").length,
    };
  }
}

import { DatabaseStorage } from "./db-storage";

export const storage: IStorage = process.env.DATABASE_URL
  ? new DatabaseStorage()
  : new MemStorage();
