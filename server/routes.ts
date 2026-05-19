import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer } from "ws";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { storage } from "./storage";
import { db } from "./db";
import { eq, and } from "drizzle-orm";
import {
  type User,
  taskAssignees,
  users,
  tasks as tasksTable,
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

  // ─── Auth ────────────────────────────────────────────────────────────────────

  app.post("/api/auth/register", async (req, res) => {
    try {
      const { name, password } = req.body;
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
      const passwordHash = await bcrypt.hash(password, 12);
      const user = await storage.createUser({
        name: name || null,
        email,
        passwordHash,
        emailVerified: false,
        role: "TEAM_MEMBER",
        status: "ACTIVE",
        language: "en",
        theme: "system",
      });
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

  app.get("/api/agencies/:agencyId/users", requireAuth, async (req, res) => {
    try {
      const users = await storage.getAgencyUsers(req.params.agencyId);
      res.json(users.map((u) => toSafeUser(u)));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── Agencies ───────────────────────────────────────────────────────────────

  app.get("/api/agencies/:id", requireAuth, async (req, res) => {
    try {
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

  app.put("/api/agencies/:id", requireAuth, async (req, res) => {
    try {
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

  app.get("/api/agencies/:agencyId/invitations", requireAuth, async (req, res) => {
    try {
      const invitations = await storage.getInvitations(req.params.agencyId);
      res.json(invitations);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/invitations", requireAuth, async (req, res) => {
    try {
      const data = insertInvitationSchema.parse(req.body);
      const invitation = await storage.createInvitation(data);
      res.status(201).json(invitation);
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
      const [allTasks, allProjects, allClients, allUsers, allTimeEntries, attendance] = await Promise.all([
        storage.getTasks({ agencyId: me.agencyId, projectId: projectId as string }),
        storage.getProjects({ agencyId: me.agencyId }),
        storage.getClients({ agencyId: me.agencyId }),
        storage.getAgencyUsers(me.agencyId),
        storage.getTimeEntries({ agencyId: me.agencyId }),
        storage.getAttendanceRecords({ agencyId: me.agencyId }),
      ]);
      const now = new Date();
      const start = startDate ? new Date(startDate as string) : null;
      const end = endDate ? new Date(endDate as string) : null;
      const filteredTasks = allTasks.filter(t => {
        if (!start && !end) return true;
        const ref = t.createdAt ? new Date(t.createdAt) : null;
        if (!ref) return true;
        if (start && ref < start) return false;
        if (end && ref > end) return false;
        return true;
      });
      const totalMinutes = allTimeEntries.reduce((sum, e) => sum + (e.durationMinutes ?? 0), 0);
      const tasksByStatus: Record<string, number> = { TODO: 0, IN_PROGRESS: 0, IN_REVIEW: 0, DONE: 0, OVERDUE: 0 };
      filteredTasks.forEach(t => {
        if (t.completedAt) {
          tasksByStatus["DONE"]++;
        } else if (t.dueDate && new Date(t.dueDate) < now) {
          tasksByStatus["OVERDUE"]++;
        } else if (t.reviewStatus === "PENDING") {
          tasksByStatus["IN_REVIEW"]++;
        } else {
          tasksByStatus["IN_PROGRESS"]++;
        }
      });
      const today = new Date().toISOString().slice(0, 10);
      const presentToday = attendance.filter(r => r.date === today && r.checkInAt).length;
      res.json({
        totalTasks: filteredTasks.length,
        completedTasks: filteredTasks.filter(t => t.completedAt).length,
        overdueTasks: filteredTasks.filter(t => t.dueDate && !t.completedAt && new Date(t.dueDate) < now).length,
        activeProjects: allProjects.filter((p: any) => p.status === "ACTIVE").length,
        totalProjects: allProjects.length,
        totalClients: allClients.length,
        teamSize: allUsers.length,
        totalHoursLogged: Math.round(totalMinutes / 60),
        presentToday,
        tasksByStatus,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/reports/tasks-over-time", requireAuth, async (req: any, res) => {
    try {
      const me = await storage.getUser(req.userId);
      if (!me?.agencyId) return res.status(403).json({ error: "No agency" });
      const { startDate, endDate, projectId } = req.query;
      const tasks = await storage.getTasks({ agencyId: me.agencyId, projectId: projectId as string });
      const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate as string) : new Date();
      // Build daily buckets
      const buckets: Record<string, { created: number; completed: number }> = {};
      const cursor = new Date(start);
      while (cursor <= end) {
        buckets[cursor.toISOString().slice(0, 10)] = { created: 0, completed: 0 };
        cursor.setDate(cursor.getDate() + 1);
      }
      tasks.forEach(t => {
        if (t.createdAt) {
          const d = new Date(t.createdAt).toISOString().slice(0, 10);
          if (buckets[d]) buckets[d].created++;
        }
        if (t.completedAt) {
          const d = new Date(t.completedAt).toISOString().slice(0, 10);
          if (buckets[d]) buckets[d].completed++;
        }
      });
      res.json(Object.entries(buckets).map(([date, v]) => ({ date, ...v })));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/reports/tasks-by-project", requireAuth, async (req: any, res) => {
    try {
      const me = await storage.getUser(req.userId);
      if (!me?.agencyId) return res.status(403).json({ error: "No agency" });
      const { startDate, endDate } = req.query;
      const [tasks, projects] = await Promise.all([
        storage.getTasks({ agencyId: me.agencyId }),
        storage.getProjects({ agencyId: me.agencyId }),
      ]);
      const start = startDate ? new Date(startDate as string) : null;
      const end = endDate ? new Date(endDate as string) : null;
      const filtered = tasks.filter(t => {
        if (!start && !end) return true;
        const ref = t.createdAt ? new Date(t.createdAt) : null;
        if (!ref) return true;
        if (start && ref < start) return false;
        if (end && ref > end) return false;
        return true;
      });
      const projectMap: Record<string, { name: string; total: number; completed: number }> = {};
      projects.forEach(p => { projectMap[p.id] = { name: p.name, total: 0, completed: 0 }; });
      filtered.forEach(t => {
        if (!projectMap[t.projectId]) return;
        projectMap[t.projectId].total++;
        if (t.completedAt) projectMap[t.projectId].completed++;
      });
      res.json(
        Object.entries(projectMap)
          .map(([id, v]) => ({ projectId: id, ...v }))
          .filter(p => p.total > 0)
          .sort((a, b) => b.total - a.total)
          .slice(0, 10),
      );
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/reports/time-by-member", requireAuth, async (req: any, res) => {
    try {
      const me = await storage.getUser(req.userId);
      if (!me?.agencyId) return res.status(403).json({ error: "No agency" });
      const { startDate, endDate } = req.query;
      const [entries, agencyUsers] = await Promise.all([
        storage.getTimeEntries({ agencyId: me.agencyId }),
        storage.getAgencyUsers(me.agencyId),
      ]);
      const start = startDate ? new Date(startDate as string) : null;
      const end = endDate ? new Date(endDate as string) : null;
      const filtered = entries.filter(e => {
        if (!start && !end) return true;
        const ref = e.startedAt ? new Date(e.startedAt) : null;
        if (!ref) return true;
        if (start && ref < start) return false;
        if (end && ref > end) return false;
        return true;
      });
      const userMap: Record<string, { name: string; minutes: number }> = {};
      agencyUsers.forEach(u => { userMap[u.id] = { name: u.name ?? u.email, minutes: 0 }; });
      filtered.forEach(e => {
        if (e.userId && userMap[e.userId]) {
          userMap[e.userId].minutes += e.durationMinutes ?? 0;
        }
      });
      res.json(
        Object.entries(userMap)
          .map(([userId, v]) => ({ userId, name: v.name, hours: Math.round(v.minutes / 60 * 10) / 10 }))
          .filter(u => u.hours > 0)
          .sort((a, b) => b.hours - a.hours),
      );
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
      // Auto-create a General channel if none exist
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
      const data = insertPageSchema.pick({ title: true, content: true }).partial().parse(req.body);
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
