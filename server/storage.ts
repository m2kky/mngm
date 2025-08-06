import { randomUUID } from "crypto";
import { 
  User, InsertUser, 
  Workspace, InsertWorkspace,
  Task, InsertTask,
  Attendance, InsertAttendance,
  DailyReport, InsertDailyReport,
  Timer, InsertTimer,
  Notification, InsertNotification,
  Page, InsertPage,
  File, InsertFile,
  Message, InsertMessage,
  Channel, InsertChannel,
  Project, InsertProject,
  Evaluation, InsertEvaluation,
  TaskStatus,
  AttendanceStatus,
  UserRoleType
} from "@shared/schema";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined>;
  getWorkspaceUsers(workspaceId: string): Promise<User[]>;

  // Workspace methods
  getWorkspace(id: string): Promise<Workspace | undefined>;
  createWorkspace(workspace: InsertWorkspace): Promise<Workspace>;
  updateWorkspace(id: string, updates: Partial<InsertWorkspace>): Promise<Workspace | undefined>;

  // Task methods
  getTasks(filters: { workspaceId?: string; assignedTo?: string; status?: string }): Promise<Task[]>;
  getTask(id: string): Promise<Task | undefined>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: string, updates: Partial<InsertTask>): Promise<Task | undefined>;
  deleteTask(id: string): Promise<boolean>;

  // Timer methods
  getTimers(filters: { userId?: string; isActive?: boolean }): Promise<Timer[]>;
  createTimer(timer: InsertTimer): Promise<Timer>;
  updateTimer(id: string, updates: Partial<InsertTimer>): Promise<Timer | undefined>;

  // Attendance methods
  getAttendance(filters: { userId?: string; workspaceId?: string; date?: Date }): Promise<Attendance[]>;
  createAttendance(attendance: InsertAttendance): Promise<Attendance>;
  updateAttendance(id: string, updates: Partial<InsertAttendance>): Promise<Attendance | undefined>;

  // Daily Reports methods
  getDailyReports(filters: { userId?: string; workspaceId?: string; date?: Date }): Promise<DailyReport[]>;
  createDailyReport(report: InsertDailyReport): Promise<DailyReport>;

  // Page methods
  getPages(filters: { workspaceId?: string; teamId?: string; createdBy?: string }): Promise<Page[]>;
  getPage(id: string): Promise<Page | undefined>;
  createPage(page: InsertPage): Promise<Page>;
  updatePage(id: string, updates: Partial<InsertPage>): Promise<Page | undefined>;
  deletePage(id: string): Promise<boolean>;

  // File methods
  getFiles(filters: { workspaceId?: string; uploadedBy?: string; fileType?: string }): Promise<File[]>;
  createFile(file: InsertFile): Promise<File>;

  // Message and Channel methods
  getChannels(filters: { workspaceId?: string; teamId?: string }): Promise<Channel[]>;
  createChannel(channel: InsertChannel): Promise<Channel>;
  getChannelMessages(channelId: string): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;

  // Project methods
  getProjects(filters: { workspaceId?: string; teamId?: string; clientId?: string }): Promise<Project[]>;
  createProject(project: InsertProject): Promise<Project>;

  // Evaluation methods
  getEvaluations(filters: { userId?: string; workspaceId?: string; period?: string }): Promise<Evaluation[]>;
  createEvaluation(evaluation: InsertEvaluation): Promise<Evaluation>;

  // Notification methods
  getNotifications(filters: { userId?: string; isRead?: boolean }): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  updateNotification(id: string, updates: Partial<InsertNotification>): Promise<Notification | undefined>;

  // Dashboard methods
  getDashboardStats(filters: { workspaceId: string; userId?: string }): Promise<any>;
  getRecentActivity(filters: { workspaceId: string; limit?: number }): Promise<any[]>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private workspaces: Map<string, Workspace> = new Map();
  private tasks: Map<string, Task> = new Map();
  private timers: Map<string, Timer> = new Map();
  private attendance: Map<string, Attendance> = new Map();
  private dailyReports: Map<string, DailyReport> = new Map();
  private pages: Map<string, Page> = new Map();
  private files: Map<string, File> = new Map();
  private messages: Map<string, Message> = new Map();
  private channels: Map<string, Channel> = new Map();
  private projects: Map<string, Project> = new Map();
  private evaluations: Map<string, Evaluation> = new Map();
  private notifications: Map<string, Notification> = new Map();

  constructor() {
    this.initializeSampleData();
  }

  private initializeSampleData() {
    // This method will be empty in production - no mock data
    // All data should come from real Firebase connections
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.email === email);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const now = new Date();
    const user: User = { 
      ...insertUser, 
      id, 
      createdAt: now, 
      updatedAt: now 
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser: User = { 
      ...user, 
      ...updates, 
      updatedAt: new Date() 
    };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async getWorkspaceUsers(workspaceId: string): Promise<User[]> {
    return Array.from(this.users.values()).filter(user => user.workspaceId === workspaceId);
  }

  // Workspace methods
  async getWorkspace(id: string): Promise<Workspace | undefined> {
    return this.workspaces.get(id);
  }

  async createWorkspace(insertWorkspace: InsertWorkspace): Promise<Workspace> {
    const id = randomUUID();
    const now = new Date();
    const workspace: Workspace = { 
      ...insertWorkspace, 
      id, 
      createdAt: now, 
      updatedAt: now 
    };
    this.workspaces.set(id, workspace);
    return workspace;
  }

  async updateWorkspace(id: string, updates: Partial<InsertWorkspace>): Promise<Workspace | undefined> {
    const workspace = this.workspaces.get(id);
    if (!workspace) return undefined;
    
    const updatedWorkspace: Workspace = { 
      ...workspace, 
      ...updates, 
      updatedAt: new Date() 
    };
    this.workspaces.set(id, updatedWorkspace);
    return updatedWorkspace;
  }

  // Task methods
  async getTasks(filters: { workspaceId?: string; assignedTo?: string; status?: string }): Promise<Task[]> {
    return Array.from(this.tasks.values()).filter(task => {
      if (filters.workspaceId && task.workspaceId !== filters.workspaceId) return false;
      if (filters.assignedTo && task.assignedTo !== filters.assignedTo) return false;
      if (filters.status && task.status !== filters.status) return false;
      return true;
    });
  }

  async getTask(id: string): Promise<Task | undefined> {
    return this.tasks.get(id);
  }

  async createTask(insertTask: InsertTask): Promise<Task> {
    const id = randomUUID();
    const now = new Date();
    const task: Task = { 
      ...insertTask, 
      id, 
      createdAt: now, 
      updatedAt: now 
    };
    this.tasks.set(id, task);
    return task;
  }

  async updateTask(id: string, updates: Partial<InsertTask>): Promise<Task | undefined> {
    const task = this.tasks.get(id);
    if (!task) return undefined;
    
    const updatedTask: Task = { 
      ...task, 
      ...updates, 
      updatedAt: new Date() 
    };
    this.tasks.set(id, updatedTask);
    return updatedTask;
  }

  async deleteTask(id: string): Promise<boolean> {
    return this.tasks.delete(id);
  }

  // Timer methods
  async getTimers(filters: { userId?: string; isActive?: boolean }): Promise<Timer[]> {
    return Array.from(this.timers.values()).filter(timer => {
      if (filters.userId && timer.userId !== filters.userId) return false;
      if (filters.isActive !== undefined && timer.isActive !== filters.isActive) return false;
      return true;
    });
  }

  async createTimer(insertTimer: InsertTimer): Promise<Timer> {
    const id = randomUUID();
    const timer: Timer = { 
      ...insertTimer, 
      id, 
      endTime: null,
      duration: 0,
      createdAt: new Date() 
    };
    this.timers.set(id, timer);
    return timer;
  }

  async updateTimer(id: string, updates: Partial<InsertTimer>): Promise<Timer | undefined> {
    const timer = this.timers.get(id);
    if (!timer) return undefined;
    
    const updatedTimer: Timer = { ...timer, ...updates };
    this.timers.set(id, updatedTimer);
    return updatedTimer;
  }

  // Attendance methods
  async getAttendance(filters: { userId?: string; workspaceId?: string; date?: Date }): Promise<Attendance[]> {
    return Array.from(this.attendance.values()).filter(attendance => {
      if (filters.userId && attendance.userId !== filters.userId) return false;
      if (filters.workspaceId && attendance.workspaceId !== filters.workspaceId) return false;
      if (filters.date && attendance.date.toDateString() !== filters.date.toDateString()) return false;
      return true;
    });
  }

  async createAttendance(insertAttendance: InsertAttendance): Promise<Attendance> {
    const id = randomUUID();
    const now = new Date();
    const attendance: Attendance = { 
      ...insertAttendance, 
      id, 
      createdAt: now, 
      updatedAt: now 
    };
    this.attendance.set(id, attendance);
    return attendance;
  }

  async updateAttendance(id: string, updates: Partial<InsertAttendance>): Promise<Attendance | undefined> {
    const attendance = this.attendance.get(id);
    if (!attendance) return undefined;
    
    const updatedAttendance: Attendance = { 
      ...attendance, 
      ...updates, 
      updatedAt: new Date() 
    };
    this.attendance.set(id, updatedAttendance);
    return updatedAttendance;
  }

  // Daily Reports methods
  async getDailyReports(filters: { userId?: string; workspaceId?: string; date?: Date }): Promise<DailyReport[]> {
    return Array.from(this.dailyReports.values()).filter(report => {
      if (filters.userId && report.userId !== filters.userId) return false;
      if (filters.workspaceId && report.workspaceId !== filters.workspaceId) return false;
      if (filters.date && report.date.toDateString() !== filters.date.toDateString()) return false;
      return true;
    });
  }

  async createDailyReport(insertReport: InsertDailyReport): Promise<DailyReport> {
    const id = randomUUID();
    const report: DailyReport = { 
      ...insertReport, 
      id, 
      createdAt: new Date() 
    };
    this.dailyReports.set(id, report);
    return report;
  }

  // Page methods
  async getPages(filters: { workspaceId?: string; teamId?: string; createdBy?: string }): Promise<Page[]> {
    return Array.from(this.pages.values()).filter(page => {
      if (filters.workspaceId && page.workspaceId !== filters.workspaceId) return false;
      if (filters.teamId && page.teamId !== filters.teamId) return false;
      if (filters.createdBy && page.createdBy !== filters.createdBy) return false;
      return true;
    });
  }

  async getPage(id: string): Promise<Page | undefined> {
    return this.pages.get(id);
  }

  async createPage(insertPage: InsertPage): Promise<Page> {
    const id = randomUUID();
    const now = new Date();
    const page: Page = { 
      ...insertPage, 
      id, 
      createdAt: now, 
      updatedAt: now 
    };
    this.pages.set(id, page);
    return page;
  }

  async updatePage(id: string, updates: Partial<InsertPage>): Promise<Page | undefined> {
    const page = this.pages.get(id);
    if (!page) return undefined;
    
    const updatedPage: Page = { 
      ...page, 
      ...updates, 
      updatedAt: new Date() 
    };
    this.pages.set(id, updatedPage);
    return updatedPage;
  }

  async deletePage(id: string): Promise<boolean> {
    return this.pages.delete(id);
  }

  // File methods
  async getFiles(filters: { workspaceId?: string; uploadedBy?: string; fileType?: string }): Promise<File[]> {
    return Array.from(this.files.values()).filter(file => {
      if (filters.workspaceId && file.workspaceId !== filters.workspaceId) return false;
      if (filters.uploadedBy && file.uploadedBy !== filters.uploadedBy) return false;
      if (filters.fileType && file.fileType !== filters.fileType) return false;
      return true;
    });
  }

  async createFile(insertFile: InsertFile): Promise<File> {
    const id = randomUUID();
    const file: File = { 
      ...insertFile, 
      id, 
      createdAt: new Date() 
    };
    this.files.set(id, file);
    return file;
  }

  // Message and Channel methods
  async getChannels(filters: { workspaceId?: string; teamId?: string }): Promise<Channel[]> {
    return Array.from(this.channels.values()).filter(channel => {
      if (filters.workspaceId && channel.workspaceId !== filters.workspaceId) return false;
      if (filters.teamId && channel.teamId !== filters.teamId) return false;
      return true;
    });
  }

  async createChannel(insertChannel: InsertChannel): Promise<Channel> {
    const id = randomUUID();
    const now = new Date();
    const channel: Channel = { 
      ...insertChannel, 
      id, 
      createdAt: now, 
      updatedAt: now 
    };
    this.channels.set(id, channel);
    return channel;
  }

  async getChannelMessages(channelId: string): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter(message => message.channelId === channelId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const id = randomUUID();
    const message: Message = { 
      ...insertMessage, 
      id, 
      createdAt: new Date() 
    };
    this.messages.set(id, message);
    return message;
  }

  // Project methods
  async getProjects(filters: { workspaceId?: string; teamId?: string; clientId?: string }): Promise<Project[]> {
    return Array.from(this.projects.values()).filter(project => {
      if (filters.workspaceId && project.workspaceId !== filters.workspaceId) return false;
      if (filters.teamId && project.teamId !== filters.teamId) return false;
      if (filters.clientId && project.clientId !== filters.clientId) return false;
      return true;
    });
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const id = randomUUID();
    const now = new Date();
    const project: Project = { 
      ...insertProject, 
      id, 
      createdAt: now, 
      updatedAt: now 
    };
    this.projects.set(id, project);
    return project;
  }

  // Evaluation methods
  async getEvaluations(filters: { userId?: string; workspaceId?: string; period?: string }): Promise<Evaluation[]> {
    return Array.from(this.evaluations.values()).filter(evaluation => {
      if (filters.userId && evaluation.userId !== filters.userId) return false;
      if (filters.workspaceId && evaluation.workspaceId !== filters.workspaceId) return false;
      if (filters.period && evaluation.period !== filters.period) return false;
      return true;
    });
  }

  async createEvaluation(insertEvaluation: InsertEvaluation): Promise<Evaluation> {
    const id = randomUUID();
    const evaluation: Evaluation = { 
      ...insertEvaluation, 
      id, 
      createdAt: new Date() 
    };
    this.evaluations.set(id, evaluation);
    return evaluation;
  }

  // Notification methods
  async getNotifications(filters: { userId?: string; isRead?: boolean }): Promise<Notification[]> {
    return Array.from(this.notifications.values())
      .filter(notification => {
        if (filters.userId && notification.userId !== filters.userId) return false;
        if (filters.isRead !== undefined && notification.isRead !== filters.isRead) return false;
        return true;
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async createNotification(insertNotification: InsertNotification): Promise<Notification> {
    const id = randomUUID();
    const notification: Notification = { 
      ...insertNotification, 
      id, 
      createdAt: new Date() 
    };
    this.notifications.set(id, notification);
    return notification;
  }

  async updateNotification(id: string, updates: Partial<InsertNotification>): Promise<Notification | undefined> {
    const notification = this.notifications.get(id);
    if (!notification) return undefined;
    
    const updatedNotification: Notification = { ...notification, ...updates };
    this.notifications.set(id, updatedNotification);
    return updatedNotification;
  }

  // Dashboard methods
  async getDashboardStats(filters: { workspaceId: string; userId?: string }): Promise<any> {
    const workspaceTasks = Array.from(this.tasks.values()).filter(task => task.workspaceId === filters.workspaceId);
    const workspaceUsers = Array.from(this.users.values()).filter(user => user.workspaceId === filters.workspaceId);
    const today = new Date();
    const todayAttendance = Array.from(this.attendance.values()).filter(
      attendance => attendance.workspaceId === filters.workspaceId && 
      attendance.date.toDateString() === today.toDateString()
    );

    const activeTasks = workspaceTasks.filter(task => task.status === "in_progress").length;
    const completedToday = workspaceTasks.filter(task => 
      task.status === "done" && 
      task.updatedAt.toDateString() === today.toDateString()
    ).length;
    const presentToday = todayAttendance.filter(attendance => attendance.status === "present").length;
    const totalUsers = workspaceUsers.length;

    return {
      activeTasks,
      teamPresent: `${presentToday}/${totalUsers}`,
      completedToday,
      timeTracked: "0h" // Calculate from timers in real implementation
    };
  }

  async getRecentActivity(filters: { workspaceId: string; limit?: number }): Promise<any[]> {
    const activities: any[] = [];
    const limit = filters.limit || 10;

    // Collect recent activities from different sources
    const recentTasks = Array.from(this.tasks.values())
      .filter(task => task.workspaceId === filters.workspaceId)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, limit)
      .map(task => ({
        id: task.id,
        type: 'task',
        action: `updated task "${task.title}"`,
        userId: task.assignedTo,
        timestamp: task.updatedAt
      }));

    activities.push(...recentTasks);

    // Sort by timestamp and limit
    return activities
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }
}

export const storage = new MemStorage();
