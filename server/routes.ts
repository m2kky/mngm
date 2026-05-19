import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer } from "ws";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { storage } from "./storage";
import { db } from "./db";
import { eq, and, gte, lte, count, sql, desc, isNotNull } from "drizzle-orm";
import { reportCache, REPORT_TTL_MS } from "./cache";
import {
  type User,
  taskAssignees,
  users,
  tasks as tasksTable,
  projects,
  clients,
  timeEntries,
  attendanceRecords,
  insertUserSchema,
  insertAgencySchema,
  insertClientSchema,
  insertProjectSchema,
  insertProjectStageSchema,
  insertTaskSchema,
  insertTimeEntrySchema,
  insertTaskCommentSchema,
  insertFileAssetSchema,
  insertNotificationSchema,
  insertInvitationSchema,
  insertChatChannelSchema,
  insertChatMessageSchema,
  insertPageSchema,
} from "@shared/schema";

const isDev = process.env.NODE_ENV !== "production";
const JWT_SECRET = process.env.JWT_SECRET ?? (isDev ? "workit-os-dev-secret-do-not-use-in-production" : "");
if (!JWT_SECRET) {
  console.error("FATAL: JWT_SECRET environment variable must be set in production.");
  process.exit(1);
}
const JWT_EXPIRES_IN = "30d";

// Roles that can be assigned to team members (excludes OWNER which is auto-assigned)
const ASSIGNABLE_ROLES = ["ADMIN", "TEAM_LEADER", "SUPERVISOR", "EMPLOYEE", "HR", "PROJECT_MANAGER", "TEAM_MEMBER", "CLIENT"] as const;
const assignableRoleSchema = z.enum(ASSIGNABLE_ROLES);

function toSafeUser(user: User): Omit<User, "passwordHash"> {
  const { passwordHash: _h, ...safe } = user;
  return safe;
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (ws) => {
    ws.on("message", (message) => {
      try {
        const data = JSON.parse(message.toString());
        wss.clients.forEach((client) => {
          if (client !== ws && client.readyState === ws.OPEN) {
            client.send(JSON.stringify(data));
          }
        });
      } catch {
        // ignore parse errors
      }
    });
  });

  const requireAuth = (req: any, res: any, next: any) => {
    const header = req.headers.authorization as string | undefined;
    if (!header?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    try {
      const payload = jwt.verify(header.slice(7), JWT_SECRET) as { userId: string };
      req.userId = payload.userId;
      next();
    } catch {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
  };

  // ─── Global CLIENT role guard ─────────────────────────────────────────────────
  // CLIENT role users may only access /api/auth/*, /api/client-portal/*, and the
  // public invitation lookup. All other API routes return 403.
  const CLIENT_ALLOWED_PREFIXES = [
    "/api/auth/",
    "/api/client-portal/",
    "/api/invitations/by-token/",
    "/api/chat/channels", // allowed — hardened per-endpoint to restrict to portal channel
  ];

  app.use(async (req: any, res: any, next: any) => {
    if (!req.path.startsWith("/api/")) return next();
    // Check if this path is allowed for CLIENT role
    const isClientSafe = CLIENT_ALLOWED_PREFIXES.some((p) => req.path.startsWith(p));
    if (isClientSafe) return next();

    // Extract token if present
    const header = req.headers.authorization as string | undefined;
    if (!header?.startsWith("Bearer ")) return next();

    try {
      const payload = jwt.verify(header.slice(7), JWT_SECRET) as { userId: string };
      const user = await storage.getUser(payload.userId);
      if (user?.role === "CLIENT") {
        return res.status(403).json({ error: "Access denied. Please use the client portal." });
      }
    } catch {
      // Bad token — let individual requireAuth handlers report the error
    }
    next();
  });

  // ─── Auth ────────────────────────────────────────────────────────────────────

  app.post("/api/auth/register", async (req, res) => {
    try {
      const { name, password, inviteToken } = req.body;
      const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }
      if (password.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters" });
      }
      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(409).json({ error: "An account with this email already exists" });
      }

      let invitedAgencyId: string | null = null;
      let invitedRole: string = "TEAM_MEMBER";
      let invitation: any = null;

      if (inviteToken) {
        invitation = await storage.getInvitationByToken(inviteToken);
        if (!invitation) {
          return res.status(400).json({ error: "Invalid invite link" });
        }
        if (invitation.status !== "PENDING") {
          return res.status(400).json({ error: "This invite has already been used or revoked" });
        }
        if (new Date(invitation.expiresAt) < new Date()) {
          return res.status(400).json({ error: "This invite link has expired" });
        }
        if (invitation.email.toLowerCase() !== email) {
          return res.status(400).json({ error: "This invite was sent to a different email address" });
        }
        invitedAgencyId = invitation.agencyId;
        invitedRole = invitation.role;
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const parsedRole = assignableRoleSchema.safeParse(invitedRole);
      const user = await storage.createUser({
        name: name || null,
        email,
        passwordHash,
        emailVerified: false,
        role: parsedRole.success ? parsedRole.data : "TEAM_MEMBER",
        status: "ACTIVE",
        language: "en",
        theme: "system",
        agencyId: invitedAgencyId,
      });

      if (invitation) {
        await storage.updateInvitation(invitation.id, {
          status: "ACCEPTED",
          acceptedAt: new Date(),
          userId: user.id,
        });
      }

      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
      res.status(201).json({ token, user: toSafeUser(user) });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { password } = req.body;
      const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }
      const user = await storage.getUserByEmail(email);
      if (!user || !user.passwordHash) {
        return res.status(401).json({ error: "Invalid email or password" });
      }
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ error: "Invalid email or password" });
      }
      if (user.status === "DEACTIVATED") {
        return res.status(403).json({ error: "Your account has been deactivated. Please contact your workspace admin." });
      }
      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
      res.json({ token, user: toSafeUser(user) });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/auth/me", requireAuth, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.userId);
      if (!user) return res.status(404).json({ error: "User not found" });
      res.json(toSafeUser(user));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── Users ──────────────────────────────────────────────────────────────────

  app.get("/api/users/:id", requireAuth, async (req: any, res) => {
    try {
      // Only allow users to fetch their own profile
      if (req.params.id !== req.userId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const user = await storage.getUser(req.params.id);
      if (!user) return res.status(404).json({ error: "User not found" });
      res.json(toSafeUser(user));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.put("/api/users/:id", requireAuth, async (req: any, res) => {
    try {
      // Only allow users to update their own profile
      if (req.params.id !== req.userId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const data = insertUserSchema.partial().omit({ passwordHash: true }).parse(req.body);
      const user = await storage.updateUser(req.params.id, data);
      if (!user) return res.status(404).json({ error: "User not found" });
      res.json(toSafeUser(user));
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get("/api/agencies/:agencyId/users", requireAuth, async (req: any, res) => {
    try {
      const requester = await storage.getUser(req.userId);
      if (!requester || requester.agencyId !== req.params.agencyId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const users = await storage.getAgencyUsers(req.params.agencyId);
      res.json(users.map((u) => toSafeUser(u)));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── Agencies ───────────────────────────────────────────────────────────────

  app.get("/api/agencies/:id", requireAuth, async (req: any, res) => {
    try {
      const requester = await storage.getUser(req.userId);
      if (!requester || requester.agencyId !== req.params.id) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const agency = await storage.getAgency(req.params.id);
      if (!agency) return res.status(404).json({ error: "Agency not found" });
      res.json(agency);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/agencies", requireAuth, async (req, res) => {
    try {
      const data = insertAgencySchema.parse(req.body);
      const agency = await storage.createAgency(data);
      res.status(201).json(agency);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.put("/api/agencies/:id", requireAuth, async (req: any, res) => {
    try {
      const requester = await storage.getUser(req.userId);
      if (!requester || requester.agencyId !== req.params.id) {
        return res.status(403).json({ error: "Forbidden" });
      }
      if (requester.role !== "OWNER" && requester.role !== "ADMIN") {
        return res.status(403).json({ error: "Only agency owners and admins can update workspace settings." });
      }
      const data = insertAgencySchema.partial().parse(req.body);
      const agency = await storage.updateAgency(req.params.id, data);
      if (!agency) return res.status(404).json({ error: "Agency not found" });
      res.json(agency);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // ─── Clients ────────────────────────────────────────────────────────────────

  app.get("/api/clients", requireAuth, async (req, res) => {
    try {
      const { agencyId, status } = req.query;
      const clients = await storage.getClients({ agencyId: agencyId as string, status: status as string });
      res.json(clients);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/clients/:id", requireAuth, async (req, res) => {
    try {
      const client = await storage.getClient(req.params.id);
      if (!client) return res.status(404).json({ error: "Client not found" });
      res.json(client);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/clients", requireAuth, async (req, res) => {
    try {
      const data = insertClientSchema.parse(req.body);
      const client = await storage.createClient(data);
      res.status(201).json(client);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.put("/api/clients/:id", requireAuth, async (req, res) => {
    try {
      const data = insertClientSchema.partial().parse(req.body);
      const client = await storage.updateClient(req.params.id, data);
      if (!client) return res.status(404).json({ error: "Client not found" });
      res.json(client);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/clients/:id", requireAuth, async (req, res) => {
    try {
      const success = await storage.deleteClient(req.params.id);
      if (!success) return res.status(404).json({ error: "Client not found" });
      res.status(204).send();
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── Projects ───────────────────────────────────────────────────────────────

  app.get("/api/projects", requireAuth, async (req, res) => {
    try {
      const { agencyId, clientId, status } = req.query;
      const projects = await storage.getProjects({ agencyId: agencyId as string, clientId: clientId as string, status: status as string });
      res.json(projects);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/projects/:id", requireAuth, async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) return res.status(404).json({ error: "Project not found" });
      res.json(project);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/projects", requireAuth, async (req, res) => {
    try {
      const data = insertProjectSchema.parse(req.body);
      const project = await storage.createProject(data);
      res.status(201).json(project);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.put("/api/projects/:id", requireAuth, async (req, res) => {
    try {
      const data = insertProjectSchema.partial().parse(req.body);
      const project = await storage.updateProject(req.params.id, data);
      if (!project) return res.status(404).json({ error: "Project not found" });
      res.json(project);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // ─── Project Stages ─────────────────────────────────────────────────────────

  app.get("/api/projects/:projectId/stages", requireAuth, async (req, res) => {
    try {
      const stages = await storage.getProjectStages(req.params.projectId);
      res.json(stages);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/projects/:projectId/stages", requireAuth, async (req, res) => {
    try {
      const data = insertProjectStageSchema.parse({ ...req.body, projectId: req.params.projectId });
      const stage = await storage.createProjectStage(data);
      res.status(201).json(stage);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Returns all task-assignee records for every task in a project in one query
  app.get("/api/projects/:projectId/task-assignees", requireAuth, async (req: any, res) => {
    try {
      const [project, requester] = await Promise.all([
        storage.getProject(req.params.projectId),
        storage.getUser(req.userId),
      ]);
      if (!project || !requester || project.agencyId !== requester.agencyId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const rows = await db
        .select({
          taskId:    taskAssignees.taskId,
          userId:    taskAssignees.userId,
          userName:  users.name,
          userEmail: users.email,
          userImage: users.image,
        })
        .from(taskAssignees)
        .innerJoin(users,       eq(taskAssignees.userId, users.id))
        .innerJoin(tasksTable,  eq(taskAssignees.taskId, tasksTable.id))
        .where(eq(tasksTable.projectId, req.params.projectId));
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── Tasks ──────────────────────────────────────────────────────────────────

  app.get("/api/tasks", requireAuth, async (req, res) => {
    try {
      const { agencyId, projectId, stageId, createdById } = req.query;
      const tasks = await storage.getTasks({
        agencyId: agencyId as string,
        projectId: projectId as string,
        stageId: stageId as string,
        createdById: createdById as string,
      });
      res.json(tasks);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/tasks/:id", requireAuth, async (req, res) => {
    try {
      const task = await storage.getTask(req.params.id);
      if (!task) return res.status(404).json({ error: "Task not found" });
      res.json(task);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/tasks", requireAuth, async (req, res) => {
    try {
      const data = insertTaskSchema.parse(req.body);
      const task = await storage.createTask(data);
      res.status(201).json(task);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.put("/api/tasks/:id", requireAuth, async (req, res) => {
    try {
      const data = insertTaskSchema.partial().parse(req.body);
      const task = await storage.updateTask(req.params.id, data);
      if (!task) return res.status(404).json({ error: "Task not found" });
      res.json(task);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/tasks/:id", requireAuth, async (req, res) => {
    try {
      const success = await storage.deleteTask(req.params.id);
      if (!success) return res.status(404).json({ error: "Task not found" });
      res.status(204).send();
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── Task Assignees ──────────────────────────────────────────────────────────

  // Helper: verify the task belongs to the requesting user's agency.
  // Returns the shared agencyId on success, null on failure.
  async function verifyTaskAgency(taskId: string, requestUserId: string): Promise<string | null> {
    const [task, user] = await Promise.all([
      storage.getTask(taskId),
      storage.getUser(requestUserId),
    ]);
    if (!task || !user || task.agencyId !== user.agencyId) return null;
    return task.agencyId ?? null;
  }

  app.get("/api/tasks/:taskId/assignees", requireAuth, async (req: any, res) => {
    try {
      if (!await verifyTaskAgency(req.params.taskId, req.userId)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const rows = await db
        .select({ id: users.id, name: users.name, email: users.email, image: users.image })
        .from(taskAssignees)
        .innerJoin(users, eq(taskAssignees.userId, users.id))
        .where(eq(taskAssignees.taskId, req.params.taskId));
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/tasks/:taskId/assignees", requireAuth, async (req: any, res) => {
    try {
      const agencyId = await verifyTaskAgency(req.params.taskId, req.userId);
      if (!agencyId) return res.status(403).json({ error: "Forbidden" });

      const { userId } = req.body;
      if (!userId) return res.status(400).json({ error: "userId is required" });

      // Ensure the target user belongs to the same agency (prevents cross-tenant assignment)
      const targetUser = await storage.getUser(userId);
      if (!targetUser || targetUser.agencyId !== agencyId) {
        return res.status(403).json({ error: "Cannot assign a user from another agency" });
      }

      await db
        .insert(taskAssignees)
        .values({ taskId: req.params.taskId, userId })
        .onConflictDoNothing();
      res.status(201).json({ taskId: req.params.taskId, userId });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/tasks/:taskId/assignees/:userId", requireAuth, async (req: any, res) => {
    try {
      if (!await verifyTaskAgency(req.params.taskId, req.userId)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      await db
        .delete(taskAssignees)
        .where(
          and(
            eq(taskAssignees.taskId, req.params.taskId),
            eq(taskAssignees.userId, req.params.userId),
          ),
        );
      res.status(204).send();
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── Time Entries ────────────────────────────────────────────────────────────

  app.get("/api/time-entries", requireAuth, async (req, res) => {
    try {
      const { agencyId, userId, projectId, taskId } = req.query;
      const entries = await storage.getTimeEntries({
        agencyId: agencyId as string,
        userId: userId as string,
        projectId: projectId as string,
        taskId: taskId as string,
      });
      res.json(entries);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/time-entries", requireAuth, async (req, res) => {
    try {
      const data = insertTimeEntrySchema.parse(req.body);
      const entry = await storage.createTimeEntry(data);
      res.status(201).json(entry);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.put("/api/time-entries/:id", requireAuth, async (req, res) => {
    try {
      const data = insertTimeEntrySchema.partial().parse(req.body);
      const entry = await storage.updateTimeEntry(req.params.id, data);
      if (!entry) return res.status(404).json({ error: "Time entry not found" });
      res.json(entry);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // ─── Task Comments ───────────────────────────────────────────────────────────

  app.get("/api/tasks/:taskId/comments", requireAuth, async (req, res) => {
    try {
      const comments = await storage.getTaskComments(req.params.taskId);
      res.json(comments);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/tasks/:taskId/comments", requireAuth, async (req, res) => {
    try {
      const data = insertTaskCommentSchema.parse({ ...req.body, taskId: req.params.taskId });
      const comment = await storage.createTaskComment(data);

      wss.clients.forEach((client) => {
        if (client.readyState === client.OPEN) {
          client.send(JSON.stringify({ type: "new_comment", data: comment }));
        }
      });

      res.status(201).json(comment);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // ─── File Assets ─────────────────────────────────────────────────────────────

  app.get("/api/files", requireAuth, async (req, res) => {
    try {
      const { agencyId, projectId, taskId, clientId } = req.query;
      const files = await storage.getFileAssets({
        agencyId: agencyId as string,
        projectId: projectId as string,
        taskId: taskId as string,
        clientId: clientId as string,
      });
      res.json(files);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/files", requireAuth, async (req, res) => {
    try {
      const data = insertFileAssetSchema.parse(req.body);
      const file = await storage.createFileAsset(data);
      res.status(201).json(file);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // ─── Notifications ───────────────────────────────────────────────────────────

  app.get("/api/notifications", requireAuth, async (req, res) => {
    try {
      const { userId, agencyId, unread } = req.query;
      const notifications = await storage.getNotifications({
        userId: userId as string,
        agencyId: agencyId as string,
        readAt: unread === "true" ? false : undefined,
      });
      res.json(notifications);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/notifications", requireAuth, async (req, res) => {
    try {
      const data = insertNotificationSchema.parse(req.body);
      const notification = await storage.createNotification(data);

      wss.clients.forEach((client) => {
        if (client.readyState === client.OPEN) {
          client.send(JSON.stringify({ type: "notification", data: notification }));
        }
      });

      res.status(201).json(notification);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.put("/api/notifications/:id/read", requireAuth, async (req, res) => {
    try {
      const notification = await storage.markNotificationRead(req.params.id);
      if (!notification) return res.status(404).json({ error: "Notification not found" });
      res.json(notification);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── Invitations ─────────────────────────────────────────────────────────────

  app.get("/api/agencies/:agencyId/invitations", requireAuth, async (req: any, res) => {
    try {
      if (!await requireAgencyAdmin(req, res, req.params.agencyId)) return;
      const invitations = await storage.getInvitations(req.params.agencyId);
      res.json(invitations);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Legacy invitation endpoint — kept for backward compatibility but now requires admin access
  // and enforces agency scoping to the requester's own agency.
  app.post("/api/invitations", requireAuth, async (req: any, res) => {
    try {
      const me = await storage.getUser(req.userId);
      if (!me?.agencyId) return res.status(403).json({ error: "No agency" });
      if (me.role !== "OWNER" && me.role !== "ADMIN") {
        return res.status(403).json({ error: "Admin access required" });
      }
      // Force agencyId and invitedById to the requester's context
      const data = insertInvitationSchema.parse({
        ...req.body,
        agencyId: me.agencyId,
        invitedById: me.id,
      });
      const invitation = await storage.createInvitation(data);
      res.status(201).json(invitation);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // ─── Team Member Management ──────────────────────────────────────────────────

  // Helper: check if requesting user is an admin (OWNER or ADMIN) of an agency
  async function requireAgencyAdmin(req: any, res: any, agencyId: string): Promise<boolean> {
    const me = await storage.getUser(req.userId);
    if (!me || me.agencyId !== agencyId || (me.role !== "OWNER" && me.role !== "ADMIN")) {
      res.status(403).json({ error: "Admin access required" });
      return false;
    }
    return true;
  }

  // Create an invitation (admin only, auto-generates token and expiry)
  app.post("/api/agencies/:agencyId/members/invite", requireAuth, async (req: any, res) => {
    try {
      if (!await requireAgencyAdmin(req, res, req.params.agencyId)) return;
      const { email, role } = req.body;
      if (!email) return res.status(400).json({ error: "Email is required" });
      const inviteEmail = email.trim().toLowerCase();
      const token = randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      const parsedInviteRole = assignableRoleSchema.safeParse(role ?? "TEAM_MEMBER");
      if (!parsedInviteRole.success) {
        return res.status(400).json({ error: `Invalid role. Must be one of: ${ASSIGNABLE_ROLES.join(", ")}` });
      }
      const invitation = await storage.createInvitation({
        email: inviteEmail,
        role: parsedInviteRole.data,
        status: "PENDING",
        token,
        expiresAt,
        agencyId: req.params.agencyId,
        invitedById: req.userId,
      });
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      res.status(201).json({ ...invitation, inviteLink: `${baseUrl}/login?invite=${token}` });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Get invitation by token (public — used during registration)
  app.get("/api/invitations/by-token/:token", async (req, res) => {
    try {
      const invitation = await storage.getInvitationByToken(req.params.token);
      if (!invitation) return res.status(404).json({ error: "Invitation not found" });
      res.json({ email: invitation.email, role: invitation.role, status: invitation.status, expiresAt: invitation.expiresAt });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Update a member's role (admin only); optionally assign clientId when role=CLIENT
  app.patch("/api/agencies/:agencyId/members/:userId/role", requireAuth, async (req: any, res) => {
    try {
      if (!await requireAgencyAdmin(req, res, req.params.agencyId)) return;
      const { role, clientId } = req.body;
      const parsedRole = assignableRoleSchema.safeParse(role);
      if (!parsedRole.success) {
        return res.status(400).json({ error: `Invalid role. Must be one of: ${ASSIGNABLE_ROLES.join(", ")}` });
      }
      const target = await storage.getUser(req.params.userId);
      if (!target || target.agencyId !== req.params.agencyId) {
        return res.status(404).json({ error: "Member not found" });
      }
      // Cannot change the OWNER's role
      if (target.role === "OWNER") {
        return res.status(403).json({ error: "Cannot change the workspace owner's role" });
      }
      const updateData: any = { role: parsedRole.data };
      // When assigning CLIENT role, allow linking to a specific client entity
      if (parsedRole.data === "CLIENT" && clientId) {
        const client = await storage.getClient(clientId);
        if (!client || client.agencyId !== req.params.agencyId) {
          return res.status(400).json({ error: "Client not found in this agency" });
        }
        updateData.clientId = clientId;
      } else if (parsedRole.data !== "CLIENT") {
        // Remove client link when switching away from CLIENT role
        updateData.clientId = null;
      }
      const updated = await storage.updateUser(req.params.userId, updateData);
      res.json(toSafeUser(updated!));
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Set or update a CLIENT user's linked client entity (admin only)
  app.patch("/api/agencies/:agencyId/members/:userId/client-link", requireAuth, async (req: any, res) => {
    try {
      if (!await requireAgencyAdmin(req, res, req.params.agencyId)) return;
      const { clientId } = req.body;
      const target = await storage.getUser(req.params.userId);
      if (!target || target.agencyId !== req.params.agencyId) {
        return res.status(404).json({ error: "Member not found" });
      }
      if (target.role !== "CLIENT") {
        return res.status(400).json({ error: "User must have CLIENT role to be linked to a client" });
      }
      if (clientId) {
        const client = await storage.getClient(clientId);
        if (!client || client.agencyId !== req.params.agencyId) {
          return res.status(400).json({ error: "Client not found in this agency" });
        }
      }
      const updated = await storage.updateUser(req.params.userId, { clientId: clientId ?? null });
      res.json(toSafeUser(updated!));
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Deactivate a member (admin only)
  app.patch("/api/agencies/:agencyId/members/:userId/deactivate", requireAuth, async (req: any, res) => {
    try {
      if (!await requireAgencyAdmin(req, res, req.params.agencyId)) return;
      const target = await storage.getUser(req.params.userId);
      if (!target || target.agencyId !== req.params.agencyId) {
        return res.status(404).json({ error: "Member not found" });
      }
      if (target.role === "OWNER") {
        return res.status(403).json({ error: "Cannot deactivate the workspace owner" });
      }
      if (req.params.userId === req.userId) {
        return res.status(403).json({ error: "Cannot deactivate your own account" });
      }
      const updated = await storage.updateUser(req.params.userId, { status: "DEACTIVATED" });
      res.json(toSafeUser(updated!));
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Reactivate a member (admin only)
  app.patch("/api/agencies/:agencyId/members/:userId/reactivate", requireAuth, async (req: any, res) => {
    try {
      if (!await requireAgencyAdmin(req, res, req.params.agencyId)) return;
      const target = await storage.getUser(req.params.userId);
      if (!target || target.agencyId !== req.params.agencyId) {
        return res.status(404).json({ error: "Member not found" });
      }
      const updated = await storage.updateUser(req.params.userId, { status: "ACTIVE" });
      res.json(toSafeUser(updated!));
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Revoke an invitation (admin only)
  app.patch("/api/agencies/:agencyId/invitations/:invitationId/revoke", requireAuth, async (req: any, res) => {
    try {
      if (!await requireAgencyAdmin(req, res, req.params.agencyId)) return;
      // Fetch the invitation and verify it belongs to this agency (prevents IDOR)
      const allInvitations = await storage.getInvitations(req.params.agencyId);
      const invitation = allInvitations.find((inv) => inv.id === req.params.invitationId);
      if (!invitation) return res.status(404).json({ error: "Invitation not found" });
      const updated = await storage.updateInvitation(req.params.invitationId, {
        status: "REVOKED",
        revokedAt: new Date(),
      });
      res.json(updated);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // ─── Attendance ──────────────────────────────────────────────────────────────

  app.get("/api/attendance", requireAuth, async (req: any, res) => {
    try {
      const me = await storage.getUser(req.userId);
      if (!me?.agencyId) return res.status(403).json({ error: "No agency" });
      const { userId, startDate, endDate } = req.query;
      const records = await storage.getAttendanceRecords({
        agencyId: me.agencyId,
        userId: userId as string | undefined,
        startDate: startDate as string | undefined,
      });
      res.json(records);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/attendance/check-in", requireAuth, async (req: any, res) => {
    try {
      const me = await storage.getUser(req.userId);
      if (!me?.agencyId) return res.status(403).json({ error: "No agency" });
      const today = new Date().toISOString().slice(0, 10);
      const existing = await storage.getAttendanceRecord(me.id, today);
      if (existing?.checkInAt) return res.status(400).json({ error: "Already checked in today" });
      const record = await storage.upsertAttendanceRecord({
        userId: me.id,
        agencyId: me.agencyId,
        date: today,
        checkInAt: new Date(),
        checkOutAt: null,
        totalMinutes: null,
        status: "present",
        notes: req.body.notes ?? null,
      });
      res.status(201).json(record);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post("/api/attendance/check-out", requireAuth, async (req: any, res) => {
    try {
      const me = await storage.getUser(req.userId);
      if (!me?.agencyId) return res.status(403).json({ error: "No agency" });
      const today = new Date().toISOString().slice(0, 10);
      const existing = await storage.getAttendanceRecord(me.id, today);
      if (!existing?.checkInAt) return res.status(400).json({ error: "Not checked in today" });
      if (existing.checkOutAt) return res.status(400).json({ error: "Already checked out" });
      const now = new Date();
      const totalMinutes = Math.round((now.getTime() - existing.checkInAt.getTime()) / 60000);
      const record = await storage.upsertAttendanceRecord({
        userId: me.id,
        agencyId: me.agencyId,
        date: today,
        checkInAt: existing.checkInAt,
        checkOutAt: now,
        totalMinutes,
        status: totalMinutes < 240 ? "half_day" : "present",
        notes: existing.notes,
      });
      res.json(record);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // ─── File Upload ──────────────────────────────────────────────────────────────

  app.post("/api/files/upload", requireAuth, async (req: any, res) => {
    try {
      const me = await storage.getUser(req.userId);
      if (!me?.agencyId) return res.status(403).json({ error: "No agency" });
      const { fileName, mimeType, fileSize, content, projectId, taskId, clientId, folder } = req.body;
      if (!content || !fileName) return res.status(400).json({ error: "fileName and content are required" });
      const fileKey = `${randomUUID()}-${fileName.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
      const uploadsDir = path.join(process.cwd(), "uploads");
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
      const base64Data = content.replace(/^data:[^;]+;base64,/, "");
      fs.writeFileSync(path.join(uploadsDir, fileKey), Buffer.from(base64Data, "base64"));
      const fileUrl = `/uploads/${fileKey}`;
      const file = await storage.createFileAsset({
        agencyId: me.agencyId,
        uploadedById: me.id,
        fileName,
        fileKey,
        fileUrl,
        mimeType: mimeType ?? "application/octet-stream",
        fileSize: fileSize ?? Buffer.byteLength(base64Data, "base64"),
        context: "GENERAL",
        projectId: projectId ?? null,
        taskId: taskId ?? null,
        clientId: clientId ?? null,
        folder: folder ?? null,
      });
      res.status(201).json(file);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/files/:id", requireAuth, async (req: any, res) => {
    try {
      const me = await storage.getUser(req.userId);
      if (!me?.agencyId) return res.status(403).json({ error: "No agency" });
      const files = await storage.getFileAssets({ agencyId: me.agencyId });
      const file = files.find(f => f.id === req.params.id);
      if (!file) return res.status(404).json({ error: "File not found" });
      const filePath = path.join(process.cwd(), "uploads", file.fileKey);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── Reports ──────────────────────────────────────────────────────────────────

  app.get("/api/reports/overview", requireAuth, async (req: any, res) => {
    try {
      const me = await storage.getUser(req.userId);
      if (!me?.agencyId) return res.status(403).json({ error: "No agency" });
      const { startDate, endDate, projectId } = req.query;
      const cacheKey = `reports:overview:${me.agencyId}:${startDate ?? ""}:${endDate ?? ""}:${projectId ?? ""}`;
      const cached = reportCache.get(cacheKey);
      if (cached) return res.json(cached);

      const start = startDate ? new Date(startDate as string) : null;
      const end = endDate ? new Date(endDate as string) : null;
      const now = new Date();
      const today = now.toISOString().slice(0, 10);

      // All aggregation done in the DB — no row fetching into Node
      const [taskAgg, projectCounts, clientCount, teamCount, hoursRow, attendanceRow] = await Promise.all([
        // Single query: conditional COUNT for every status bucket
        db.select({
          total:      count(),
          completed:  sql<number>`COUNT(${tasksTable.completedAt})`,
          overdue:    sql<number>`COUNT(CASE WHEN ${tasksTable.completedAt} IS NULL AND ${tasksTable.dueDate} IS NOT NULL AND ${tasksTable.dueDate} < NOW() THEN 1 END)`,
          inReview:   sql<number>`COUNT(CASE WHEN ${tasksTable.completedAt} IS NULL AND ${tasksTable.reviewStatus} = 'PENDING' AND (${tasksTable.dueDate} IS NULL OR ${tasksTable.dueDate} >= NOW()) THEN 1 END)`,
          inProgress: sql<number>`COUNT(CASE WHEN ${tasksTable.completedAt} IS NULL AND ${tasksTable.reviewStatus} != 'PENDING' AND (${tasksTable.dueDate} IS NULL OR ${tasksTable.dueDate} >= NOW()) THEN 1 END)`,
        }).from(tasksTable).where(and(
          eq(tasksTable.agencyId, me.agencyId),
          projectId ? eq(tasksTable.projectId, projectId as string) : undefined,
          start ? gte(tasksTable.createdAt, start) : undefined,
          end   ? lte(tasksTable.createdAt, end)   : undefined,
        )),

        // Project counts via GROUP BY status
        db.select({ status: projects.status, cnt: count() })
          .from(projects)
          .where(eq(projects.agencyId, me.agencyId))
          .groupBy(projects.status),

        // Client count
        db.select({ cnt: count() })
          .from(clients)
          .where(eq(clients.agencyId, me.agencyId))
          .then(r => Number(r[0]?.cnt ?? 0)),

        // Team size
        db.select({ cnt: count() })
          .from(users)
          .where(eq(users.agencyId, me.agencyId))
          .then(r => Number(r[0]?.cnt ?? 0)),

        // Total hours — SUM in SQL
        db.select({ total: sql<number>`COALESCE(SUM(${timeEntries.durationMinutes}), 0)` })
          .from(timeEntries)
          .where(eq(timeEntries.agencyId, me.agencyId))
          .then(r => Number(r[0]?.total ?? 0)),

        // Present today
        db.select({ cnt: count() })
          .from(attendanceRecords)
          .where(and(
            eq(attendanceRecords.agencyId, me.agencyId),
            eq(attendanceRecords.date, today),
            isNotNull(attendanceRecords.checkInAt),
          ))
          .then(r => Number(r[0]?.cnt ?? 0)),
      ]);

      const agg = taskAgg[0] ?? { total: 0, completed: 0, overdue: 0, inReview: 0, inProgress: 0 };
      const totalProjects = projectCounts.reduce((s, r) => s + Number(r.cnt), 0);
      const activeProjects = projectCounts.filter(r => r.status === "ACTIVE").reduce((s, r) => s + Number(r.cnt), 0);

      const payload = {
        totalTasks:      Number(agg.total),
        completedTasks:  Number(agg.completed),
        overdueTasks:    Number(agg.overdue),
        activeProjects,
        totalProjects,
        totalClients:    clientCount,
        teamSize:        teamCount,
        totalHoursLogged: Math.round(hoursRow / 60),
        presentToday:    attendanceRow,
        tasksByStatus: {
          DONE:        Number(agg.completed),
          OVERDUE:     Number(agg.overdue),
          IN_REVIEW:   Number(agg.inReview),
          IN_PROGRESS: Number(agg.inProgress),
          TODO:        0,
        },
      };
      reportCache.set(cacheKey, payload, REPORT_TTL_MS);
      res.json(payload);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/reports/tasks-over-time", requireAuth, async (req: any, res) => {
    try {
      const me = await storage.getUser(req.userId);
      if (!me?.agencyId) return res.status(403).json({ error: "No agency" });
      const { startDate, endDate, projectId } = req.query;
      const cacheKey = `reports:tasks-over-time:${me.agencyId}:${startDate ?? ""}:${endDate ?? ""}:${projectId ?? ""}`;
      const cached = reportCache.get(cacheKey);
      if (cached) return res.json(cached);

      const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate as string) : new Date();

      const baseWhere = [
        eq(tasksTable.agencyId, me.agencyId),
        ...(projectId ? [eq(tasksTable.projectId, projectId as string)] : []),
      ];

      // Two DB-level GROUP BY date_trunc queries — no full row fetch
      const [createdRows, completedRows] = await Promise.all([
        db.select({
          day: sql<string>`(date_trunc('day', ${tasksTable.createdAt}) AT TIME ZONE 'UTC')::date::text`,
          cnt: count(),
        })
          .from(tasksTable)
          .where(and(...baseWhere, gte(tasksTable.createdAt, start), lte(tasksTable.createdAt, end)))
          .groupBy(sql`date_trunc('day', ${tasksTable.createdAt})`),

        db.select({
          day: sql<string>`(date_trunc('day', ${tasksTable.completedAt}) AT TIME ZONE 'UTC')::date::text`,
          cnt: count(),
        })
          .from(tasksTable)
          .where(and(...baseWhere, isNotNull(tasksTable.completedAt), gte(tasksTable.completedAt, start), lte(tasksTable.completedAt, end)))
          .groupBy(sql`date_trunc('day', ${tasksTable.completedAt})`),
      ]);

      // Seed every day in range then fill from DB results
      const buckets: Record<string, { created: number; completed: number }> = {};
      const cursor = new Date(start);
      while (cursor <= end) {
        buckets[cursor.toISOString().slice(0, 10)] = { created: 0, completed: 0 };
        cursor.setDate(cursor.getDate() + 1);
      }
      createdRows.forEach(r => { if (r.day && buckets[r.day]) buckets[r.day].created = Number(r.cnt); });
      completedRows.forEach(r => { if (r.day && buckets[r.day]) buckets[r.day].completed = Number(r.cnt); });

      const payload = Object.entries(buckets).map(([date, v]) => ({ date, ...v }));
      reportCache.set(cacheKey, payload, REPORT_TTL_MS);
      res.json(payload);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/reports/tasks-by-project", requireAuth, async (req: any, res) => {
    try {
      const me = await storage.getUser(req.userId);
      if (!me?.agencyId) return res.status(403).json({ error: "No agency" });
      const { startDate, endDate } = req.query;
      const cacheKey = `reports:tasks-by-project:${me.agencyId}:${startDate ?? ""}:${endDate ?? ""}`;
      const cached = reportCache.get(cacheKey);
      if (cached) return res.json(cached);

      const start = startDate ? new Date(startDate as string) : null;
      const end = endDate ? new Date(endDate as string) : null;

      // DB-level GROUP BY: join projects → tasks, count total & completed in SQL
      // agencyId is included in the join condition to preserve strict tenant scoping
      const rows = await db
        .select({
          projectId: projects.id,
          name: projects.name,
          total: count(tasksTable.id),
          completed: sql<number>`COUNT(${tasksTable.completedAt})`,
        })
        .from(projects)
        .leftJoin(tasksTable, and(
          eq(tasksTable.projectId, projects.id),
          eq(tasksTable.agencyId, me.agencyId),
          start ? gte(tasksTable.createdAt, start) : undefined,
          end   ? lte(tasksTable.createdAt, end)   : undefined,
        ))
        .where(eq(projects.agencyId, me.agencyId))
        .groupBy(projects.id, projects.name)
        .orderBy(desc(count(tasksTable.id)))
        .limit(10);

      const payload = rows
        .map(r => ({ projectId: r.projectId, name: r.name, total: Number(r.total), completed: Number(r.completed) }))
        .filter(r => r.total > 0);
      reportCache.set(cacheKey, payload, REPORT_TTL_MS);
      res.json(payload);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/reports/time-by-member", requireAuth, async (req: any, res) => {
    try {
      const me = await storage.getUser(req.userId);
      if (!me?.agencyId) return res.status(403).json({ error: "No agency" });
      const { startDate, endDate } = req.query;
      const cacheKey = `reports:time-by-member:${me.agencyId}:${startDate ?? ""}:${endDate ?? ""}`;
      const cached = reportCache.get(cacheKey);
      if (cached) return res.json(cached);

      const start = startDate ? new Date(startDate as string) : null;
      const end = endDate ? new Date(endDate as string) : null;

      // Build WHERE conditions for each query
      const timeWhere = [
        eq(timeEntries.agencyId, me.agencyId),
        ...(start ? [gte(timeEntries.startTime, start)] : []),
        ...(end ? [lte(timeEntries.startTime, end)] : []),
      ];
      const taskWhere = [
        eq(tasksTable.agencyId, me.agencyId),
        ...(start ? [gte(tasksTable.createdAt, start)] : []),
        ...(end ? [lte(tasksTable.createdAt, end)] : []),
      ];

      // All three queries use SQL-level GROUP BY / SUM / COUNT — no per-row iteration in Node
      const [agencyUsers, timeGrouped, taskGrouped] = await Promise.all([
        storage.getAgencyUsers(me.agencyId),

        // SUM(duration_minutes) per user in SQL
        db.select({
          userId: timeEntries.userId,
          totalMinutes: sql<number>`COALESCE(SUM(${timeEntries.durationMinutes}), 0)`,
        })
          .from(timeEntries)
          .where(and(...timeWhere))
          .groupBy(timeEntries.userId),

        // COUNT(*) and COUNT(completed_at) per user in SQL
        db.select({
          userId: taskAssignees.userId,
          assigned:  count(),
          completed: sql<number>`COUNT(${tasksTable.completedAt})`,
        })
          .from(taskAssignees)
          .innerJoin(tasksTable, and(eq(taskAssignees.taskId, tasksTable.id), ...taskWhere))
          .groupBy(taskAssignees.userId),
      ]);

      // Merge DB results — O(users) only, no per-row scan
      const minutesByUser = Object.fromEntries(timeGrouped.map(r => [r.userId, Number(r.totalMinutes)]));
      const tasksByUser   = Object.fromEntries(taskGrouped.map(r => [r.userId, { assigned: Number(r.assigned), completed: Number(r.completed) }]));

      const payload = agencyUsers
        .map(u => {
          const minutes    = minutesByUser[u.id] ?? 0;
          const assigned   = tasksByUser[u.id]?.assigned ?? 0;
          const completed  = tasksByUser[u.id]?.completed ?? 0;
          const hours      = Math.round(minutes / 60 * 10) / 10;
          const tasksPerHour = minutes > 0 ? Math.round((completed / (minutes / 60)) * 10) / 10 : 0;
          return { userId: u.id, name: u.name ?? u.email, hours, tasksAssigned: assigned, tasksCompleted: completed, tasksPerHour };
        })
        .filter(u => u.hours > 0 || u.tasksAssigned > 0)
        .sort((a, b) => b.tasksCompleted - a.tasksCompleted || b.hours - a.hours);

      reportCache.set(cacheKey, payload, REPORT_TTL_MS);
      res.json(payload);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── Client Portal ───────────────────────────────────────────────────────────

  // Middleware: only users with role=CLIENT that are linked to a client entity
  const requireClientRole = async (req: any, res: any, next: any) => {
    const me = await storage.getUser(req.userId);
    if (!me) return res.status(401).json({ error: "Unauthorized" });
    if (me.role !== "CLIENT") return res.status(403).json({ error: "Client role required" });
    if (!me.agencyId) return res.status(403).json({ error: "No agency associated" });
    if (!me.clientId) return res.status(403).json({ error: "No client linked. Ask your agency to assign you to a client." });
    req.me = me;
    next();
  };

  // Returns projects scoped to the authenticated client's clientId
  app.get("/api/client-portal/projects", requireAuth, requireClientRole, async (req: any, res) => {
    try {
      const projects = await storage.getProjects({ clientId: req.me.clientId });
      res.json(projects);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Returns tasks for a project, only if that project belongs to this client
  app.get("/api/client-portal/tasks", requireAuth, requireClientRole, async (req: any, res) => {
    try {
      const { projectId } = req.query;
      if (!projectId) return res.status(400).json({ error: "projectId is required" });
      // Verify the project belongs to THIS client (not just any agency project)
      const project = await storage.getProject(projectId as string);
      if (!project || project.clientId !== req.me.clientId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const tasks = await storage.getTasks({ projectId: projectId as string, agencyId: req.me.agencyId });
      res.json(tasks);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Returns only CLIENT_FILE assets tagged to this specific client
  app.get("/api/client-portal/files", requireAuth, requireClientRole, async (req: any, res) => {
    try {
      const allFiles = await storage.getFileAssets({ clientId: req.me.clientId });
      // Only expose files explicitly shared with the client (context=CLIENT_FILE)
      const clientFiles = allFiles.filter((f: any) => f.context === "CLIENT_FILE");
      res.json(clientFiles);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Returns (or auto-creates) a per-client message channel keyed by clientId
  app.get("/api/client-portal/channel", requireAuth, requireClientRole, async (req: any, res) => {
    try {
      const channelName = `client-portal-${req.me.clientId}`;
      let channels = await storage.getChatChannels(req.me.agencyId);
      let clientChannel = channels.find((c: any) => c.name === channelName);
      if (!clientChannel) {
        clientChannel = await storage.createChatChannel({
          name: channelName,
          description: "Direct messaging between client and the agency team",
          type: "channel",
          agencyId: req.me.agencyId,
          createdById: req.me.id,
        });
      }
      res.json(clientChannel);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── Chat ────────────────────────────────────────────────────────────────────

  app.get("/api/chat/channels", requireAuth, async (req: any, res) => {
    try {
      const me = await storage.getUser(req.userId);
      if (!me?.agencyId) return res.status(403).json({ error: "No agency" });
      let channels = await storage.getChatChannels(me.agencyId);
      // CLIENT role: can only see their own dedicated portal channel
      if (me.role === "CLIENT") {
        const portalChannelName = `client-portal-${me.clientId}`;
        const portalChannel = channels.filter((c: any) => c.name === portalChannelName);
        return res.json(portalChannel);
      }
      // Auto-create a General channel if none exist for internal team
      if (channels.length === 0) {
        const general = await storage.createChatChannel({
          name: "general",
          description: "Company-wide announcements and discussion",
          type: "channel",
          agencyId: me.agencyId,
          createdById: me.id,
        });
        channels = [general];
      }
      res.json(channels);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/chat/channels", requireAuth, async (req: any, res) => {
    try {
      const me = await storage.getUser(req.userId);
      if (!me?.agencyId) return res.status(403).json({ error: "No agency" });
      // CLIENT role cannot create channels
      if (me.role === "CLIENT") return res.status(403).json({ error: "Forbidden" });
      const data = insertChatChannelSchema.parse({ ...req.body, agencyId: me.agencyId, createdById: me.id });
      const channel = await storage.createChatChannel(data);
      res.status(201).json(channel);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get("/api/chat/channels/:channelId/messages", requireAuth, async (req: any, res) => {
    try {
      const me = await storage.getUser(req.userId);
      if (!me?.agencyId) return res.status(403).json({ error: "No agency" });
      const channel = await storage.getChatChannel(req.params.channelId);
      if (!channel || channel.agencyId !== me.agencyId) return res.status(404).json({ error: "Channel not found" });
      // CLIENT role: can only access their own portal channel
      if (me.role === "CLIENT") {
        const portalChannelName = `client-portal-${me.clientId}`;
        if (channel.name !== portalChannelName) {
          return res.status(403).json({ error: "Forbidden" });
        }
      }
      const messages = await storage.getChatMessages(req.params.channelId, 200);
      // Attach sender info
      const userIds = Array.from(new Set(messages.map((m: any) => m.userId)));
      const senderMap: Record<string, User> = {};
      await Promise.all(userIds.map(async (uid: any) => {
        const u = await storage.getUser(uid);
        if (u) senderMap[uid] = u;
      }));
      const enriched = messages.map((m: any) => ({
        ...m,
        sender: senderMap[m.userId] ? {
          id: senderMap[m.userId].id,
          name: senderMap[m.userId].name,
          avatarUrl: (senderMap[m.userId] as any).image ?? null,
        } : null,
      }));
      res.json(enriched);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/chat/channels/:channelId/messages", requireAuth, async (req: any, res) => {
    try {
      const me = await storage.getUser(req.userId);
      if (!me?.agencyId) return res.status(403).json({ error: "No agency" });
      const channel = await storage.getChatChannel(req.params.channelId);
      if (!channel || channel.agencyId !== me.agencyId) return res.status(404).json({ error: "Channel not found" });
      // CLIENT role: can only post to their own portal channel
      if (me.role === "CLIENT") {
        const portalChannelName = `client-portal-${me.clientId}`;
        if (channel.name !== portalChannelName) {
          return res.status(403).json({ error: "Forbidden" });
        }
      }
      const data = insertChatMessageSchema.parse({ content: req.body.content, channelId: req.params.channelId, userId: me.id });
      const message = await storage.createChatMessage(data);
      const enriched = {
        ...message,
        sender: { id: me.id, name: me.name, avatarUrl: (me as any).image ?? null },
      };
      // Broadcast via WebSocket
      wss.clients.forEach((client) => {
        if (client.readyState === 1) {
          client.send(JSON.stringify({ type: "chat_message", channelId: channel.id, message: enriched }));
        }
      });
      res.status(201).json(enriched);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // ─── Pages ───────────────────────────────────────────────────────────────────

  app.get("/api/pages", requireAuth, async (req: any, res) => {
    try {
      const me = await storage.getUser(req.userId);
      if (!me?.agencyId) return res.status(403).json({ error: "No agency" });
      const pageList = await storage.getPages(me.agencyId);
      res.json(pageList);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/pages/:id", requireAuth, async (req: any, res) => {
    try {
      const me = await storage.getUser(req.userId);
      if (!me?.agencyId) return res.status(403).json({ error: "No agency" });
      const page = await storage.getPage(req.params.id);
      if (!page) return res.status(404).json({ error: "Page not found" });
      if (page.agencyId !== me.agencyId) return res.status(403).json({ error: "Forbidden" });
      res.json(page);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/pages", requireAuth, async (req: any, res) => {
    try {
      const me = await storage.getUser(req.userId);
      if (!me?.agencyId) return res.status(403).json({ error: "No agency" });
      const data = insertPageSchema.parse({ ...req.body, agencyId: me.agencyId, createdById: me.id });
      // Validate parentId belongs to the same agency
      if (data.parentId) {
        const parent = await storage.getPage(data.parentId);
        if (!parent) return res.status(400).json({ error: "Parent page not found" });
        if (parent.agencyId !== me.agencyId) return res.status(403).json({ error: "Parent page belongs to a different workspace" });
      }
      const page = await storage.createPage(data);
      res.status(201).json(page);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.put("/api/pages/:id", requireAuth, async (req: any, res) => {
    try {
      const me = await storage.getUser(req.userId);
      if (!me?.agencyId) return res.status(403).json({ error: "No agency" });
      const existing = await storage.getPage(req.params.id);
      if (!existing) return res.status(404).json({ error: "Page not found" });
      if (existing.agencyId !== me.agencyId) return res.status(403).json({ error: "Forbidden" });
      const data = insertPageSchema.pick({ title: true, content: true, parentId: true, isFolder: true }).partial().parse(req.body);

      // Validate parentId: must belong to same agency, not self, no ancestry cycle
      if (data.parentId !== undefined && data.parentId !== null) {
        if (data.parentId === req.params.id) {
          return res.status(400).json({ error: "A page cannot be its own parent" });
        }
        const parent = await storage.getPage(data.parentId);
        if (!parent) return res.status(400).json({ error: "Parent page not found" });
        if (parent.agencyId !== me.agencyId) return res.status(403).json({ error: "Parent page belongs to a different workspace" });
        // Ancestry cycle check: walk up the parent's chain; if we hit req.params.id it's a cycle
        let ancestor = parent;
        while (ancestor.parentId) {
          if (ancestor.parentId === req.params.id) {
            return res.status(400).json({ error: "Moving this page here would create a circular hierarchy" });
          }
          const next = await storage.getPage(ancestor.parentId);
          if (!next) break;
          ancestor = next;
        }
      }

      const page = await storage.updatePage(req.params.id, data);
      res.json(page);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/pages/:id", requireAuth, async (req: any, res) => {
    try {
      const me = await storage.getUser(req.userId);
      if (!me?.agencyId) return res.status(403).json({ error: "No agency" });
      const existing = await storage.getPage(req.params.id);
      if (!existing) return res.status(404).json({ error: "Page not found" });
      if (existing.agencyId !== me.agencyId) return res.status(403).json({ error: "Forbidden" });
      await storage.deletePage(req.params.id);
      res.status(204).send();
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── Dashboard ───────────────────────────────────────────────────────────────

  app.get("/api/dashboard/stats", requireAuth, async (req, res) => {
    try {
      const { agencyId, userId } = req.query;
      if (!agencyId) return res.status(400).json({ error: "agencyId is required" });
      const stats = await storage.getDashboardStats({ agencyId: agencyId as string, userId: userId as string });
      res.json(stats);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  return httpServer;
}
