import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer } from "ws";
import { storage } from "./storage";
import { 
  insertUserSchema, 
  insertWorkspaceSchema, 
  insertTaskSchema, 
  insertAttendanceSchema,
  insertDailyReportSchema,
  insertTimerSchema,
  insertNotificationSchema,
  insertPageSchema,
  insertFileSchema,
  insertMessageSchema,
  insertChannelSchema,
  insertProjectSchema,
  insertEvaluationSchema
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // WebSocket server for real-time features
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  wss.on('connection', (ws) => {
    console.log('WebSocket client connected');
    
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        // Handle real-time messages (chat, notifications, timer updates)
        console.log('Received WebSocket message:', data);
        
        // Broadcast to other clients if needed
        wss.clients.forEach((client) => {
          if (client !== ws && client.readyState === ws.OPEN) {
            client.send(JSON.stringify(data));
          }
        });
      } catch (error) {
        console.error('WebSocket message parse error:', error);
      }
    });
    
    ws.on('close', () => {
      console.log('WebSocket client disconnected');
    });
  });

  // Authentication middleware
  const requireAuth = (req: any, res: any, next: any) => {
    // In a real Firebase setup, verify the Firebase token here
    // For now, we'll simulate authentication
    if (!req.headers.authorization) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    next();
  };

  // User routes
  app.get("/api/user/:id", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/users", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const user = await storage.createUser(userData);
      res.status(201).json(user);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.put("/api/user/:id", requireAuth, async (req, res) => {
    try {
      const userData = insertUserSchema.partial().parse(req.body);
      const user = await storage.updateUser(req.params.id, userData);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Workspace routes
  app.get("/api/workspaces/:id", requireAuth, async (req, res) => {
    try {
      const workspace = await storage.getWorkspace(req.params.id);
      if (!workspace) {
        return res.status(404).json({ error: "Workspace not found" });
      }
      res.json(workspace);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/workspaces", requireAuth, async (req, res) => {
    try {
      const workspaceData = insertWorkspaceSchema.parse(req.body);
      const workspace = await storage.createWorkspace(workspaceData);
      res.status(201).json(workspace);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/workspaces/:id/users", requireAuth, async (req, res) => {
    try {
      const users = await storage.getWorkspaceUsers(req.params.id);
      res.json(users);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Task routes
  app.get("/api/tasks", requireAuth, async (req, res) => {
    try {
      const { workspaceId, assignedTo, status } = req.query;
      const tasks = await storage.getTasks({
        workspaceId: workspaceId as string,
        assignedTo: assignedTo as string,
        status: status as string
      });
      res.json(tasks);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/tasks", requireAuth, async (req, res) => {
    try {
      const taskData = insertTaskSchema.parse(req.body);
      const task = await storage.createTask(taskData);
      res.status(201).json(task);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.put("/api/tasks/:id", requireAuth, async (req, res) => {
    try {
      const taskData = insertTaskSchema.partial().parse(req.body);
      const task = await storage.updateTask(req.params.id, taskData);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      res.json(task);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/tasks/:id", requireAuth, async (req, res) => {
    try {
      const success = await storage.deleteTask(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Task not found" });
      }
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Timer routes
  app.get("/api/timers", requireAuth, async (req, res) => {
    try {
      const { userId, isActive } = req.query;
      const timers = await storage.getTimers({
        userId: userId as string,
        isActive: isActive === 'true'
      });
      res.json(timers);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/timers", requireAuth, async (req, res) => {
    try {
      const timerData = insertTimerSchema.parse(req.body);
      const timer = await storage.createTimer(timerData);
      res.status(201).json(timer);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.put("/api/timers/:id", requireAuth, async (req, res) => {
    try {
      const timerData = insertTimerSchema.partial().parse(req.body);
      const timer = await storage.updateTimer(req.params.id, timerData);
      if (!timer) {
        return res.status(404).json({ error: "Timer not found" });
      }
      res.json(timer);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Attendance routes
  app.get("/api/attendance", requireAuth, async (req, res) => {
    try {
      const { userId, workspaceId, date } = req.query;
      const attendance = await storage.getAttendance({
        userId: userId as string,
        workspaceId: workspaceId as string,
        date: date ? new Date(date as string) : undefined
      });
      res.json(attendance);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/attendance", requireAuth, async (req, res) => {
    try {
      const attendanceData = insertAttendanceSchema.parse(req.body);
      const attendance = await storage.createAttendance(attendanceData);
      res.status(201).json(attendance);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.put("/api/attendance/:id", requireAuth, async (req, res) => {
    try {
      const attendanceData = insertAttendanceSchema.partial().parse(req.body);
      const attendance = await storage.updateAttendance(req.params.id, attendanceData);
      if (!attendance) {
        return res.status(404).json({ error: "Attendance record not found" });
      }
      res.json(attendance);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Daily Reports routes
  app.get("/api/reports", requireAuth, async (req, res) => {
    try {
      const { userId, workspaceId, date } = req.query;
      const reports = await storage.getDailyReports({
        userId: userId as string,
        workspaceId: workspaceId as string,
        date: date ? new Date(date as string) : undefined
      });
      res.json(reports);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/reports", requireAuth, async (req, res) => {
    try {
      const reportData = insertDailyReportSchema.parse(req.body);
      const report = await storage.createDailyReport(reportData);
      res.status(201).json(report);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Pages routes
  app.get("/api/pages", requireAuth, async (req, res) => {
    try {
      const { workspaceId, teamId, createdBy } = req.query;
      const pages = await storage.getPages({
        workspaceId: workspaceId as string,
        teamId: teamId as string,
        createdBy: createdBy as string
      });
      res.json(pages);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/pages", requireAuth, async (req, res) => {
    try {
      const pageData = insertPageSchema.parse(req.body);
      const page = await storage.createPage(pageData);
      res.status(201).json(page);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.put("/api/pages/:id", requireAuth, async (req, res) => {
    try {
      const pageData = insertPageSchema.partial().parse(req.body);
      const page = await storage.updatePage(req.params.id, pageData);
      if (!page) {
        return res.status(404).json({ error: "Page not found" });
      }
      res.json(page);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/pages/:id", requireAuth, async (req, res) => {
    try {
      const success = await storage.deletePage(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Page not found" });
      }
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Files routes
  app.get("/api/files", requireAuth, async (req, res) => {
    try {
      const { workspaceId, uploadedBy, fileType } = req.query;
      const files = await storage.getFiles({
        workspaceId: workspaceId as string,
        uploadedBy: uploadedBy as string,
        fileType: fileType as string
      });
      res.json(files);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/files", requireAuth, async (req, res) => {
    try {
      const fileData = insertFileSchema.parse(req.body);
      const file = await storage.createFile(fileData);
      res.status(201).json(file);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Messages and Chat routes
  app.get("/api/channels/:channelId/messages", requireAuth, async (req, res) => {
    try {
      const messages = await storage.getChannelMessages(req.params.channelId);
      res.json(messages);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/messages", requireAuth, async (req, res) => {
    try {
      const messageData = insertMessageSchema.parse(req.body);
      const message = await storage.createMessage(messageData);
      
      // Broadcast message via WebSocket
      wss.clients.forEach((client) => {
        if (client.readyState === client.OPEN) {
          client.send(JSON.stringify({
            type: 'new_message',
            data: message
          }));
        }
      });
      
      res.status(201).json(message);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/channels", requireAuth, async (req, res) => {
    try {
      const { workspaceId, teamId } = req.query;
      const channels = await storage.getChannels({
        workspaceId: workspaceId as string,
        teamId: teamId as string
      });
      res.json(channels);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/channels", requireAuth, async (req, res) => {
    try {
      const channelData = insertChannelSchema.parse(req.body);
      const channel = await storage.createChannel(channelData);
      res.status(201).json(channel);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Projects routes
  app.get("/api/projects", requireAuth, async (req, res) => {
    try {
      const { workspaceId, teamId, clientId } = req.query;
      const projects = await storage.getProjects({
        workspaceId: workspaceId as string,
        teamId: teamId as string,
        clientId: clientId as string
      });
      res.json(projects);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/projects", requireAuth, async (req, res) => {
    try {
      const projectData = insertProjectSchema.parse(req.body);
      const project = await storage.createProject(projectData);
      res.status(201).json(project);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Evaluations routes
  app.get("/api/evaluations", requireAuth, async (req, res) => {
    try {
      const { userId, workspaceId, period } = req.query;
      const evaluations = await storage.getEvaluations({
        userId: userId as string,
        workspaceId: workspaceId as string,
        period: period as string
      });
      res.json(evaluations);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/evaluations", requireAuth, async (req, res) => {
    try {
      const evaluationData = insertEvaluationSchema.parse(req.body);
      const evaluation = await storage.createEvaluation(evaluationData);
      res.status(201).json(evaluation);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Notifications routes
  app.get("/api/notifications", requireAuth, async (req, res) => {
    try {
      const { userId, isRead } = req.query;
      const notifications = await storage.getNotifications({
        userId: userId as string,
        isRead: isRead === 'true'
      });
      res.json(notifications);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/notifications", requireAuth, async (req, res) => {
    try {
      const notificationData = insertNotificationSchema.parse(req.body);
      const notification = await storage.createNotification(notificationData);
      
      // Send real-time notification via WebSocket
      wss.clients.forEach((client) => {
        if (client.readyState === client.OPEN) {
          client.send(JSON.stringify({
            type: 'notification',
            data: notification
          }));
        }
      });
      
      res.status(201).json(notification);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.put("/api/notifications/:id", requireAuth, async (req, res) => {
    try {
      const notificationData = insertNotificationSchema.partial().parse(req.body);
      const notification = await storage.updateNotification(req.params.id, notificationData);
      if (!notification) {
        return res.status(404).json({ error: "Notification not found" });
      }
      res.json(notification);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Dashboard analytics routes
  app.get("/api/dashboard/stats", requireAuth, async (req, res) => {
    try {
      const { workspaceId, userId } = req.query;
      const stats = await storage.getDashboardStats({
        workspaceId: workspaceId as string,
        userId: userId as string
      });
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/dashboard/activity", requireAuth, async (req, res) => {
    try {
      const { workspaceId, limit = 10 } = req.query;
      const activities = await storage.getRecentActivity({
        workspaceId: workspaceId as string,
        limit: parseInt(limit as string)
      });
      res.json(activities);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      timestamp: new Date().toISOString(),
      version: "1.0.0"
    });
  });

  return httpServer;
}
