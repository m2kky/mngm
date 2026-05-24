import express, { Express } from "express";
import request from "supertest";
import { vi } from "vitest";
import { registerRoutes } from "./routes";
import type { IStorage } from "./storage";
import { randomUUID } from "crypto";

// 1. Mock Storage Generator (Repository Mocking)
// Bypasses PostgreSQL by mocking the IStorage interface methods using Vitest
export const createMockStorage = (): vi.Mocked<IStorage> => {
  return {
    // User methods
    getUser: vi.fn(),
    getUserByEmail: vi.fn(),
    createUser: vi.fn(),
    updateUser: vi.fn(),
    getAgencyUsers: vi.fn(),

    // Agency methods
    getAgency: vi.fn(),
    createAgency: vi.fn(),
    updateAgency: vi.fn(),

    // Client methods
    getClients: vi.fn(),
    getClient: vi.fn(),
    createClient: vi.fn(),
    updateClient: vi.fn(),
    deleteClient: vi.fn(),

    // Project methods
    getProjects: vi.fn(),
    getProject: vi.fn(),
    createProject: vi.fn(),
    updateProject: vi.fn(),

    // Project Stage methods
    getProjectStages: vi.fn(),
    createProjectStage: vi.fn(),

    // Task methods
    getTasks: vi.fn(),
    getTask: vi.fn(),
    createTask: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),

    // Task Comment methods
    getTaskComments: vi.fn(),
    createTaskComment: vi.fn(),

    // Time Entry methods
    getTimeEntries: vi.fn(),
    createTimeEntry: vi.fn(),
    updateTimeEntry: vi.fn(),

    // File Asset methods
    getFileAssets: vi.fn(),
    createFileAsset: vi.fn(),

    // Notification methods
    getNotifications: vi.fn(),
    createNotification: vi.fn(),
    markNotificationRead: vi.fn(),
    getUnreadNotificationCount: vi.fn(),
    markAllNotificationsRead: vi.fn(),

    // Invitation methods
    getInvitations: vi.fn(),
    createInvitation: vi.fn(),
    getInvitationByToken: vi.fn(),
    updateInvitation: vi.fn(),

    // Dashboard methods
    getDashboardStats: vi.fn(),

    // Attendance methods
    getAttendanceRecords: vi.fn(),
    getAttendanceRecord: vi.fn(),
    upsertAttendanceRecord: vi.fn(),

    // Chat methods
    getChatChannels: vi.fn(),
    getChatChannel: vi.fn(),
    createChatChannel: vi.fn(),
    getChatMessages: vi.fn(),
    createChatMessage: vi.fn(),

    // Pages methods
    getPages: vi.fn(),
    getPage: vi.fn(),
    createPage: vi.fn(),
    updatePage: vi.fn(),
    deletePage: vi.fn(),

    // Verification methods
    createVerification: vi.fn(),
    getVerification: vi.fn(),
    deleteVerification: vi.fn(),

    // Activity methods
    createActivityLog: vi.fn(),
    getTaskActivities: vi.fn(),

    // Client Portal Users methods
    getClientPortalUserByEmail: vi.fn(),
    getClientPortalUserByUserId: vi.fn(),
    createClientPortalUser: vi.fn(),
    updateClientPortalUser: vi.fn(),
  } as unknown as vi.Mocked<IStorage>;
};

// 2. Test App Setup
// Configures an Express app with Supertest for API endpoint testing
export const setupTestApp = async () => {
  const app = express();
  app.use(express.json());

  // Note: In your actual test files, you should mock the storage module before importing this:
  // vi.mock("./storage", () => ({ storage: mockStorage }));

  const server = await registerRoutes(app);

  return {
    app,
    server,
    client: request(app),
  };
};

// 3. Data Factories
// Helps resolve foreign-key dependencies when creating mock entities
export const Factories = {
  createAgency: (overrides = {}) => ({
    id: randomUUID(),
    name: "Test Agency",
    slug: `test-agency-${randomUUID().slice(0, 8)}`,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  createUser: (agencyId: string, overrides = {}) => ({
    id: randomUUID(),
    email: `test-${randomUUID().slice(0, 8)}@example.com`,
    password: "hashed_password",
    name: "Test User",
    agencyId,
    role: "ADMIN",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  createProject: (agencyId: string, overrides = {}) => ({
    id: randomUUID(),
    name: "Test Project",
    agencyId,
    status: "ACTIVE",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  createProjectStage: (agencyId: string, overrides = {}) => ({
    id: randomUUID(),
    agencyId,
    name: "To Do",
    order: 0,
    isDefault: true,
    isDone: false,
    isClientReview: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  createTask: (agencyId: string, projectId: string, stageId: string, createdById: string, overrides = {}) => ({
    id: randomUUID(),
    agencyId,
    projectId,
    stageId,
    title: "Test Task",
    createdById,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),
};
