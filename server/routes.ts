import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer } from "ws";
import { storage } from "./storage";
import {
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
} from "@shared/schema";

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
    if (!req.headers.authorization) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    next();
  };

  // ─── Users ──────────────────────────────────────────────────────────────────

  app.get("/api/users/:id", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) return res.status(404).json({ error: "User not found" });
      res.json(user);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/users", async (req, res) => {
    try {
      const data = insertUserSchema.parse(req.body);
      const user = await storage.createUser(data);
      res.status(201).json(user);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.put("/api/users/:id", requireAuth, async (req, res) => {
    try {
      const data = insertUserSchema.partial().parse(req.body);
      const user = await storage.updateUser(req.params.id, data);
      if (!user) return res.status(404).json({ error: "User not found" });
      res.json(user);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get("/api/agencies/:agencyId/users", requireAuth, async (req, res) => {
    try {
      const users = await storage.getAgencyUsers(req.params.agencyId);
      res.json(users);
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
