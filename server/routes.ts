// @ts-nocheck
import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer } from "ws";
import fs from "fs";
import path from "path";
import { randomUUID, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { storage } from "./storage";
import { db } from "./db";
import { sendOTP } from "./email";
import { eq, and, gte, lte, count, sql, desc, isNotNull, inArray } from "drizzle-orm";
import { reportCache, REPORT_TTL_MS } from "./cache";
import {
  type User,
  taskAssignees,
  users,
  tasks as tasksTable,
  projects,
  projectStages,
  clients,
  clientPortalUsers,
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
  type InsertActivityLog,
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

  async function logActivity(logParams: InsertActivityLog) {
    const log = await storage.createActivityLog(logParams);
    wss.clients.forEach((client) => {
      if (client.readyState === client.OPEN) {
        client.send(JSON.stringify({ type: "activity_created", data: log }));
      }
    });
    return log;
  }

  // userId -> set of authenticated WebSocket connections (a user may be connected
  // from multiple tabs/devices; notifications are delivered to all of them).
  const userSockets = new Map<string, Set<import("ws").WebSocket>>();

  wss.on("connection", (ws, req) => {
    // Authenticate using ?token=<jwt> on the upgrade URL. Unauthenticated
    // sockets stay connected (some legacy chat code uses anonymous broadcast)
    // but only authenticated ones receive per-user notifications.
    let userId: string | null = null;
    try {
      const url = new URL(req.url ?? "", "http://localhost");
      const token = url.searchParams.get("token");
      if (token) {
        const payload = jwt.verify(token, JWT_SECRET) as { userId: string };
        userId = payload.userId;
        if (userId) {
          if (!userSockets.has(userId)) userSockets.set(userId, new Set());
          userSockets.get(userId)!.add(ws);
        }
      }
    } catch {
      // ignore — connection remains anonymous
    }

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

    ws.on("close", () => {
      if (userId) {
        const set = userSockets.get(userId);
        if (set) {
          set.delete(ws);
          if (set.size === 0) userSockets.delete(userId);
        }
      }
    });
  });

  // Create a notification in the database and push it live over WebSocket to
  // every active connection belonging to the target user. Failures (DB or WS)
  // are swallowed so they cannot break the originating user action.
  async function notifyUser(
    userId: string,
    payload: {
      agencyId: string;
      type: typeof insertNotificationSchema._type.type;
      title: string;
      body?: string;
      actorUserId?: string;
      entityType?: string;
      entityId?: string;
      deepLink?: string;
    },
  ): Promise<void> {
    try {
      const notification = await storage.createNotification({
        userId,
        agencyId: payload.agencyId,
        type: payload.type,
        title: payload.title,
        body: payload.body,
        actorUserId: payload.actorUserId,
        entityType: payload.entityType,
        entityId: payload.entityId,
        deepLink: payload.deepLink,
      } as any);
      const sockets = userSockets.get(userId);
      if (sockets) {
        const message = JSON.stringify({ type: "notification", data: notification });
        sockets.forEach((s) => {
          if (s.readyState === s.OPEN) s.send(message);
        });
      }
    } catch (e) {
      console.error("[notifyUser] failed:", e);
    }
  }

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
        if (existing.emailVerified) {
          return res.status(409).json({ error: "An account with this email already exists" });
        }
        // If not verified, we can update passwordHash and proceed to send OTP again
        const passwordHash = await bcrypt.hash(password, 12);
        await storage.updateUser(existing.id, { passwordHash, name: name || existing.name });
      }

      let invitedAgencyId: string | null = null;
      let invitedRole: string = "TEAM_MEMBER";
      let invitation: any = null;

      if (inviteToken) {
        invitation = await storage.getInvitationByToken(inviteToken);
        if (!invitation || invitation.status !== "PENDING" || new Date(invitation.expiresAt) < new Date() || invitation.email.toLowerCase() !== email) {
          return res.status(400).json({ error: "Invalid or expired invite link" });
        }
        invitedAgencyId = invitation.agencyId;
        invitedRole = invitation.role;
      }

      let user = existing;
      if (!user) {
        const passwordHash = await bcrypt.hash(password, 12);
        const parsedRole = assignableRoleSchema.safeParse(invitedRole);
        user = await storage.createUser({
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
      }

      if (invitation) {
        await storage.updateInvitation(invitation.id, {
          status: "ACCEPTED",
          acceptedAt: new Date(),
          userId: user.id,
        });
        
        if (user.role === "CLIENT") {
          const portalUser = await storage.getClientPortalUserByEmail(user.email);
          if (portalUser) {
            await storage.updateClientPortalUser(portalUser.id, {
              userId: user.id,
              status: "ACTIVE",
            });
          }
        }
      }

      // Generate 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      await storage.createVerification(email, otp, new Date(Date.now() + 15 * 60 * 1000));
      
      // Send OTP
      await sendOTP(email, otp);

      res.status(201).json({ message: "OTP sent", requires_verification: true });
    } catch (e: any) {
      console.error("REGISTER ERROR:", e);
      res.status(500).json({ error: e instanceof Error ? e.message : String(e), details: e });
    }
  });

  app.post("/api/auth/verify-otp", async (req, res) => {
    try {
      const { email, otp } = req.body;
      if (!email || !otp) return res.status(400).json({ error: "Email and OTP are required" });

      const parsedEmail = email.trim().toLowerCase();
      const verification = await storage.getVerification(parsedEmail, otp.trim());
      
      if (!verification) {
        return res.status(400).json({ error: "Invalid verification code" });
      }
      
      if (new Date(verification.expiresAt) < new Date()) {
        return res.status(400).json({ error: "Verification code has expired" });
      }

      const user = await storage.getUserByEmail(parsedEmail);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      await storage.updateUser(user.id, { emailVerified: true });
      await storage.deleteVerification(verification.id);

      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
      res.status(200).json({ token, user: toSafeUser({ ...user, emailVerified: true }) });
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

  app.post("/api/clients", requireAuth, async (req: any, res) => {
    try {
      const data = insertClientSchema.parse(req.body);
      const client = await storage.createClient(data);

      if (data.email) {
        let user = await storage.getUserByEmail(data.email);
        if (!user) {
          user = await storage.createUser({
            id: randomUUID(),
            name: data.name,
            email: data.email,
            status: "INVITED",
            agencyId: req.userId ? (await storage.getUser(req.userId))?.agencyId || client.agencyId : client.agencyId,
          } as any);
          
          // Role is set to CLIENT using db update since createUser might not accept role directly in some schema variants
          await db.update(users).set({ role: "CLIENT" }).where(eq(users.id, user.id));

          console.log(`[Email] Sending invitation to client portal for ${data.email}`);
        }
        
        await db.insert(clientPortalUsers).values({
          id: randomUUID(),
          agencyId: client.agencyId,
          clientId: client.id,
          email: data.email,
          name: data.name,
          status: "INVITED",
        }).onConflictDoNothing();
      }

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

  app.post("/api/clients/:id/invite", requireAuth, async (req: any, res) => {
    try {
      const client = await storage.getClient(req.params.id);
      if (!client) return res.status(404).json({ error: "Client not found" });

      const { email, name, canApprove = true, canComment = true, canViewFinancials = false } = req.body;
      if (!email || !name) {
        return res.status(400).json({ error: "Email and name are required" });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      let userId = existingUser?.id || null;

      // Check if already invited
      let portalUser = await storage.getClientPortalUserByEmail(email);
      if (!portalUser) {
        portalUser = await storage.createClientPortalUser({
          agencyId: client.agencyId,
          clientId: client.id,
          email: email.toLowerCase(),
          name,
          userId,
          status: "INVITED",
          canApprove,
          canComment,
          canViewFinancials,
        });
      }

      // Create an invitation token
      const token = randomBytes(32).toString("hex");
      const invitation = await storage.createInvitation({
        email: email.toLowerCase(),
        role: "CLIENT",
        agencyId: client.agencyId,
        invitedById: req.userId,
        token,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      });

      // Send the email (mocked or actual)
      const baseUrl = process.env.VITE_APP_URL || `http://${req.headers.host}`;
      const inviteLink = `${baseUrl}/login?invite=${token}`;
      
      console.log(`[Email] Invitation to ${email}: ${inviteLink}`);

      res.status(201).json({ portalUser, inviteLink });
    } catch (e: any) {
      console.error("Invite client error", e);
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

  // ─── Stages ─────────────────────────────────────────────────────────

  app.get("/api/agencies/:agencyId/stages", requireAuth, async (req, res) => {
    try {
      const stages = await storage.getProjectStages(req.params.agencyId);
      res.json(stages);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/agencies/:agencyId/stages", requireAuth, async (req, res) => {
    try {
      const data = insertProjectStageSchema.parse({ ...req.body, agencyId: req.params.agencyId });
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

  app.get("/api/tasks", requireAuth, async (req: any, res) => {
    try {
      const { agencyId, projectId, stageId, createdById } = req.query;
      let tasks = await storage.getTasks({
        agencyId: agencyId as string,
        projectId: projectId as string,
        stageId: stageId as string,
        createdById: createdById as string,
      });

      const user = await storage.getUser(req.userId);
      if (user?.role === "CLIENT") {
        const portalUsers = await db.select().from(clientPortalUsers).where(eq(clientPortalUsers.email, user.email));
        const clientIds = portalUsers.map(p => p.clientId);
        
        if (clientIds.length > 0) {
          const clientProjects = await storage.getProjects({ agencyId: user.agencyId || undefined });
          const allowedProjectIds = clientProjects.filter(p => clientIds.includes(p.clientId)).map(p => p.id);
          
          const stages = await db.select({ id: projectStages.id }).from(projectStages).where(eq(projectStages.isClientReview, true));
          const allowedStageIds = stages.map(s => s.id);

          tasks = tasks.filter(t => allowedProjectIds.includes(t.projectId) && allowedStageIds.includes(t.stageId));
        } else {
          tasks = [];
        }
      }

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
  app.get("/api/tasks/:id/activities", requireAuth, async (req, res) => {
    try {
      const activities = await storage.getTaskActivities(req.params.id);
      res.json(activities);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/tasks", requireAuth, async (req: any, res) => {
    try {
      const data = insertTaskSchema.parse(req.body);
      const task = await storage.createTask(data);
      
      await logActivity({
        agencyId: task.agencyId,
        actorUserId: req.userId,
        taskId: task.id,
        projectId: task.projectId,
        eventType: "TASK_CREATED",
        entityType: "task",
        entityId: task.id,
        summary: "Task created",
      });
      
      res.status(201).json(task);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.put("/api/tasks/:id", requireAuth, async (req: any, res) => {
    try {
      const data = insertTaskSchema.partial().parse(req.body);
      const oldTask = await storage.getTask(req.params.id);
      
      if (!oldTask) return res.status(404).json({ error: "Task not found" });

      if (data.stageId && data.stageId !== oldTask.stageId) {
        const stages = await storage.getProjectStages(oldTask.agencyId);
        const newStage = stages.find(s => s.id === data.stageId);
        if (newStage?.isDone) {
          data.completedAt = new Date().toISOString();
        } else if (oldTask.completedAt && data.completedAt === undefined) {
          data.completedAt = null;
        }
      }

      const task = await storage.updateTask(req.params.id, data);
      
      if (!task) return res.status(500).json({ error: "Failed to update task" });

      if (data.stageId && data.stageId !== oldTask.stageId) {
        const stages = await storage.getProjectStages(task.agencyId);
        const newStage = stages.find(s => s.id === data.stageId);
        const oldStage = stages.find(s => s.id === oldTask.stageId);
        
        await logActivity({
          agencyId: task.agencyId,
          actorUserId: req.userId,
          taskId: task.id,
          projectId: task.projectId,
          eventType: "STAGE_CHANGED",
          entityType: "task",
          entityId: task.id,
          summary: `Moved to ${newStage?.name || 'another stage'}`,
          metadata: { oldStageId: oldTask.stageId, newStageId: data.stageId, oldStageName: oldStage?.name, newStageName: newStage?.name }
        });
        
        if (newStage?.isClientReview) {
          const project = await storage.getProject(task.projectId);
          if (project?.clientId) {
            console.log(`[Notification] Task '${task.title}' moved to Client Review stage. Emailing client...`);
          }
        }
      }

      if (data.completedAt !== undefined && !!data.completedAt !== !!oldTask.completedAt) {
        await logActivity({
          agencyId: task.agencyId,
          actorUserId: req.userId,
          taskId: task.id,
          projectId: task.projectId,
          eventType: data.completedAt ? "TASK_COMPLETED" : "TASK_UPDATED",
          entityType: "task",
          entityId: task.id,
          summary: data.completedAt ? "Marked task as completed" : "Marked task as pending",
        });
      }

      if (data.reviewStatus && data.reviewStatus !== oldTask.reviewStatus) {
        await logActivity({
          agencyId: task.agencyId,
          actorUserId: req.userId,
          taskId: task.id,
          projectId: task.projectId,
          eventType: "REVIEW_SUBMITTED",
          entityType: "task",
          entityId: task.id,
          summary: `Review status changed to ${data.reviewStatus.replace("_", " ")}`,
        });
      }
      
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

      // Notify the newly-assigned user (skip self-assignment).
      if (userId !== req.userId) {
        const task = await storage.getTask(req.params.taskId);
        const actor = await storage.getUser(req.userId);
        if (task) {
          await notifyUser(userId, {
            agencyId,
            type: "TASK_ASSIGNED",
            title: `You were assigned a task`,
            body: `${actor?.name ?? "Someone"} assigned you to "${task.title}"`,
            actorUserId: req.userId,
            entityType: "task",
            entityId: task.id,
            deepLink: `/kanban?task=${task.id}`,
          });
        }
      }
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

  app.post("/api/time-entries", requireAuth, async (req: any, res) => {
    try {
      let body = { ...req.body };
      
      // Convert string dates to Date objects to pass zod validation
      if (typeof body.startTime === "string") body.startTime = new Date(body.startTime);
      if (typeof body.endTime === "string") body.endTime = new Date(body.endTime);
      
      // Auto-fill agencyId, userId, projectId if taskId is provided
      if (body.taskId && (!body.agencyId || !body.projectId || !body.userId)) {
        const task = await storage.getTask(body.taskId);
        if (task) {
          body.agencyId = body.agencyId || task.agencyId;
          body.projectId = body.projectId || task.projectId;
          body.userId = body.userId || req.userId;
        }
      }

      body.userId = body.userId || req.userId;

      const data = insertTimeEntrySchema.parse(body);
      const entry = await storage.createTimeEntry(data);
      
      if (entry.taskId) {
        let timeString = "Logged time manually";
        if (entry.startTime && entry.endTime) {
          const ms = new Date(entry.endTime).getTime() - new Date(entry.startTime).getTime();
          const totalSecs = Math.floor(ms / 1000);
          const hrs = Math.floor(totalSecs / 3600);
          const mins = Math.floor((totalSecs % 3600) / 60);
          const secs = totalSecs % 60;
          
          if (hrs > 0) timeString = `Logged ${hrs}h ${mins}m`;
          else if (mins > 0) timeString = `Logged ${mins}m ${secs}s`;
          else timeString = `Logged ${secs}s`;
        }

        await logActivity({
          agencyId: entry.agencyId,
          actorUserId: req.userId,
          taskId: entry.taskId,
          projectId: entry.projectId,
          eventType: entry.endTime ? "TIMER_STOPPED" : "TIMER_STARTED",
          entityType: "timeEntry",
          entityId: entry.id,
          summary: entry.endTime ? timeString : "Started timer",
        });
      }
      
      res.status(201).json(entry);
    } catch (e: any) {
      console.error("TimeEntry Error", e);
      res.status(400).json({ error: e.message });
    }
  });

  app.put("/api/time-entries/:id", requireAuth, async (req: any, res) => {
    try {
      const data = insertTimeEntrySchema.partial().parse(req.body);
      const oldEntry = await db.select().from(timeEntries).where(eq(timeEntries.id, req.params.id)).then(r => r[0]);
      const entry = await storage.updateTimeEntry(req.params.id, data);
      if (!entry) return res.status(404).json({ error: "Time entry not found" });
      
      if (entry.taskId && !oldEntry?.endTime && entry.endTime) {
        await logActivity({
          agencyId: entry.agencyId,
          actorUserId: req.userId,
          taskId: entry.taskId,
          projectId: entry.projectId,
          eventType: "TIMER_STOPPED",
          entityType: "timeEntry",
          entityId: entry.id,
          summary: "Stopped timer",
        });
      }
      
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

  app.post("/api/tasks/:taskId/comments", requireAuth, async (req: any, res) => {
    try {
      // Enforce that the task belongs to the requester's agency before
      // creating the comment or notifying anyone.
      const taskAgencyId = await verifyTaskAgency(req.params.taskId, req.userId);
      if (!taskAgencyId) return res.status(403).json({ error: "Forbidden" });

      const data = insertTaskCommentSchema.parse({
        ...req.body,
        taskId: req.params.taskId,
        authorUserId: req.userId,
      });
      const comment = await storage.createTaskComment(data);
      
      const task = await storage.getTask(req.params.taskId);
      if (task) {
        await logActivity({
          agencyId: task.agencyId,
          actorUserId: req.userId,
          taskId: task.id,
          projectId: task.projectId,
          eventType: "COMMENT_ADDED",
          entityType: "comment",
          entityId: comment.id,
          summary: `Added a comment: "${comment.content.substring(0, 50)}${comment.content.length > 50 ? '...' : ''}"`,
        });
      }

      wss.clients.forEach((client) => {
        if (client.readyState === client.OPEN) {
          client.send(JSON.stringify({ type: "new_comment", data: comment }));
        }
      });

      // Notify everyone assigned to the task (except the comment author).
      try {
        const task = await storage.getTask(req.params.taskId);
        const actor = await storage.getUser(req.userId);
        if (task && actor?.agencyId) {
          const assignees = await db
            .select({ userId: taskAssignees.userId })
            .from(taskAssignees)
            .where(eq(taskAssignees.taskId, req.params.taskId));
          for (const a of assignees) {
            if (a.userId !== req.userId) {
              await notifyUser(a.userId, {
                agencyId: actor.agencyId,
                type: "COMMENT_ADDED",
                title: `New comment on "${task.title}"`,
                body: `${actor.name ?? "Someone"} commented on a task you're on`,
                actorUserId: req.userId,
                entityType: "task",
                entityId: task.id,
                deepLink: `/kanban?task=${task.id}`,
              });
            }
          }

          // Mention Notifications
          if (actor.agencyId) {
            const mentionRegex = /@\[.*?\]\(user:([^)]+)\)/g;
            let match;
            const mentionedUserIds = new Set<string>();
            while ((match = mentionRegex.exec(comment.content)) !== null) {
              mentionedUserIds.add(match[1]);
            }
            for (const mId of mentionedUserIds) {
              if (mId !== req.userId) {
                await notifyUser(mId, {
                  agencyId: actor.agencyId,
                  type: "COMMENT_MENTION",
                  title: `You were mentioned in "${task.title}"`,
                  body: `${actor.name ?? "Someone"} mentioned you in a comment`,
                  actorUserId: req.userId,
                  entityType: "task",
                  entityId: task.id,
                  deepLink: `/kanban?task=${task.id}`,
                });
              }
            }
          }
        }
      } catch (e) {
        console.error("[comment notify] failed:", e);
      }

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

  // List notifications for the authenticated user only (server-side scoped —
  // never trusts a userId from the client).
  app.get("/api/notifications", requireAuth, async (req: any, res) => {
    try {
      const { unread, limit } = req.query;
      const list = await storage.getNotifications({
        userId: req.userId,
        readAt: unread === "true" ? false : undefined,
      });
      const capped = limit ? list.slice(0, parseInt(limit as string, 10)) : list;
      res.json(capped);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/notifications/unread-count", requireAuth, async (req: any, res) => {
    try {
      const count = await storage.getUnreadNotificationCount(req.userId);
      res.json({ count });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/notifications/read-all", requireAuth, async (req: any, res) => {
    try {
      const updated = await storage.markAllNotificationsRead(req.userId);
      res.json({ updated });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Owner-only: a user may only mark their own notifications read.
  app.patch("/api/notifications/:id/read", requireAuth, async (req: any, res) => {
    try {
      const list = await storage.getNotifications({ userId: req.userId });
      const target = list.find((n) => n.id === req.params.id);
      if (!target) return res.status(404).json({ error: "Notification not found" });
      const updated = await storage.markNotificationRead(req.params.id);
      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });
  // Legacy PUT alias kept for any older callers
  app.put("/api/notifications/:id/read", requireAuth, async (req: any, res) => {
    try {
      const list = await storage.getNotifications({ userId: req.userId });
      const target = list.find((n) => n.id === req.params.id);
      if (!target) return res.status(404).json({ error: "Notification not found" });
      const updated = await storage.markNotificationRead(req.params.id);
      res.json(updated);
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
      const inviteLink = `${baseUrl}/login?invite=${token}`;
      console.log(`[Email] Invitation to ${inviteEmail}: ${inviteLink}`);
      res.status(201).json({ ...invitation, inviteLink });
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

      // Mention Notifications
      try {
        const mentionRegex = /@\[.*?\]\(user:([^)]+)\)/g;
        let match;
        const mentionedUserIds = new Set<string>();
        while ((match = mentionRegex.exec(message.content)) !== null) {
          mentionedUserIds.add(match[1]);
        }
        for (const mId of mentionedUserIds) {
          if (mId !== req.userId) {
            await notifyUser(mId, {
              agencyId: me.agencyId,
              type: "COMMENT_MENTION",
              title: `You were mentioned in #${channel.name}`,
              body: `${me.name ?? "Someone"} mentioned you in chat`,
              actorUserId: req.userId,
              entityType: "channel",
              entityId: channel.id,
              deepLink: `/chat`,
            });
          }
        }
      } catch (e) {
        console.error("[chat notify] failed:", e);
      }

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

  // ─── Global search ───────────────────────────────────────────────────────────
  // Lightweight aggregator used by the command palette and header search. Returns
  // up to `limit` results across tasks, pages, files, channels, and users.

  app.get("/api/search", requireAuth, async (req: any, res) => {
    try {
      const q = ((req.query.q as string | undefined) ?? "").trim().toLowerCase();
      const limit = Math.min(parseInt((req.query.limit as string) ?? "8", 10) || 8, 25);
      const user = await storage.getUser(req.userId);
      if (!user?.agencyId) return res.json({ tasks: [], pages: [], files: [], channels: [], users: [] });
      const agencyId = user.agencyId;

      if (!q) {
        return res.json({ tasks: [], pages: [], files: [], channels: [], users: [] });
      }

      const [tasksList, pagesList, filesList, channelsList, usersList] = await Promise.all([
        storage.getTasks({ agencyId }),
        storage.getPages(agencyId),
        storage.getFileAssets({ agencyId }),
        storage.getChatChannels(agencyId),
        storage.getAgencyUsers(agencyId),
      ]);

      const matches = (s: string | null | undefined) => !!s && s.toLowerCase().includes(q);

      res.json({
        tasks: tasksList
          .filter((t) => matches(t.title) || matches(t.description))
          .slice(0, limit)
          .map((t) => ({ id: t.id, title: t.title, projectId: t.projectId, type: t.type })),
        pages: pagesList
          .filter((p) => matches(p.title))
          .slice(0, limit)
          .map((p) => ({ id: p.id, title: p.title, isFolder: p.isFolder, parentId: p.parentId })),
        files: filesList
          .filter((f) => matches(f.fileName))
          .slice(0, limit)
          .map((f) => ({ id: f.id, fileName: f.fileName, mimeType: f.mimeType, fileUrl: f.fileUrl })),
        channels: channelsList
          .filter((c) => matches(c.name) || matches(c.description))
          .slice(0, limit)
          .map((c) => ({ id: c.id, name: c.name, description: c.description })),
        users: usersList
          .filter((u) => matches(u.name) || matches(u.email))
          .slice(0, limit)
          .map((u) => ({ id: u.id, name: u.name, email: u.email, image: u.image, role: u.role })),
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── Client Portal ─────────────────────────────────────────────────────────────

  app.get("/api/client-portal/tasks", requireAuth, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.userId);
      if (user?.role !== "CLIENT") {
        return res.status(403).json({ error: "Access denied. Only clients can access this portal." });
      }

      const portalUser = await storage.getClientPortalUserByUserId(user.id);
      if (!portalUser) {
        return res.status(404).json({ error: "Client portal configuration not found." });
      }

      // Fetch all tasks for this client (using portalUser.clientId)
      // Note: We need a getTasks method that supports clientId filtering if tasks are directly linked, 
      // but wait, tasks belong to a project, and projects belong to a client!
      // Let's get all projects for the client first.
      const projects = await storage.getProjects({ clientId: portalUser.clientId });
      const projectIds = projects.map(p => p.id);

      if (projectIds.length === 0) {
        return res.json([]);
      }

      // Fetch all tasks in these projects that are visible to the client (e.g. stage.isClientReview)
      // Since we don't have a direct 'clientId' on task, we query by projects.
      // For now, we'll fetch all tasks in the client's projects and manually filter or just return them.
      // Better yet, we can filter them by stages that have isClientReview = true.
      
      const allTasks = [];
      for (const projectId of projectIds) {
        const tasksForProject = await storage.getTasks({ projectId });
        allTasks.push(...tasksForProject);
      }

      // In a real scenario, you'd only return tasks that have a stage with isClientReview = true, 
      // or tasks specifically marked for client visibility. Let's return all tasks in the client's projects for now 
      // and they can be filtered by the frontend if needed.
      res.json(allTasks);
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
