import { Factory } from "fishery";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { db } from "../../server/db";
import {
  agencies,
  users,
  clients,
  projects,
  projectStages,
  tasks,
  taskComments,
  timeEntries,
  notifications,
  clientPortalUsers
} from "@shared/schema";
import type { InferInsertModel } from "drizzle-orm";

type Agency = InferInsertModel<typeof agencies>;
export const agencyFactory = Factory.define<Agency>(({ sequence }) => ({
  id: randomUUID(),
  name: `Agency ${sequence}`,
  slug: `agency-${sequence}-${Date.now()}`,
  timezone: "Africa/Cairo",
  currency: "EGP",
  locale: "en-US",
  plan: "PRO",
})).onCreate(async (data) => {
  await db.insert(agencies).values(data);
  return data;
});

type User = InferInsertModel<typeof users>;
export const userFactory = Factory.define<User>(({ sequence }) => ({
  id: randomUUID(),
  name: `User ${sequence}`,
  email: `user-${sequence}-${Date.now()}@example.com`,
  role: "TEAM_MEMBER",
  status: "ACTIVE",
  emailVerified: true,
})).onCreate(async (data) => {
  if (!data.agencyId) {
    const agency = await agencyFactory.create();
    data.agencyId = agency.id;
  }
  if (!data.passwordHash) {
    data.passwordHash = await bcrypt.hash("password123", 10);
  }
  await db.insert(users).values(data);
  return data;
});

type Client = InferInsertModel<typeof clients>;
export const clientFactory = Factory.define<Client>(({ sequence }) => ({
  id: randomUUID(),
  name: `Client ${sequence}`,
  email: `client-${sequence}-${Date.now()}@example.com`,
  status: "ACTIVE",
})).onCreate(async (data) => {
  if (!data.agencyId) {
    const agency = await agencyFactory.create();
    data.agencyId = agency.id;
  }
  await db.insert(clients).values(data);
  return data;
});

type Project = InferInsertModel<typeof projects>;
export const projectFactory = Factory.define<Project>(({ sequence }) => ({
  id: randomUUID(),
  name: `Project ${sequence}`,
  status: "ACTIVE",
  type: "ONE_TIME",
  priority: "MEDIUM",
})).onCreate(async (data) => {
  if (!data.agencyId) {
    const agency = await agencyFactory.create();
    data.agencyId = agency.id;
  }
  if (!data.clientId) {
    const client = await clientFactory.create({ agencyId: data.agencyId });
    data.clientId = client.id;
  }
  await db.insert(projects).values(data);
  return data;
});

type ProjectStage = InferInsertModel<typeof projectStages>;
export const stageFactory = Factory.define<ProjectStage>(({ sequence }) => ({
  id: randomUUID(),
  name: `Stage ${sequence}`,
  order: sequence,
})).onCreate(async (data) => {
  if (!data.agencyId) {
    const agency = await agencyFactory.create();
    data.agencyId = agency.id;
  }
  await db.insert(projectStages).values(data);
  return data;
});

type Task = InferInsertModel<typeof tasks>;
export const taskFactory = Factory.define<Task>(({ sequence }) => ({
  id: randomUUID(),
  title: `Task ${sequence}`,
  type: "DESIGN",
  priority: "MEDIUM",
  reviewStatus: "NOT_REQUIRED",
  position: sequence,
})).onCreate(async (data) => {
  if (!data.agencyId) {
    const agency = await agencyFactory.create();
    data.agencyId = agency.id;
  }
  if (!data.projectId) {
    const project = await projectFactory.create({ agencyId: data.agencyId });
    data.projectId = project.id;
  }
  if (!data.stageId) {
    const stage = await stageFactory.create({ agencyId: data.agencyId });
    data.stageId = stage.id;
  }
  if (!data.createdById) {
    const user = await userFactory.create({ agencyId: data.agencyId });
    data.createdById = user.id;
  }
  await db.insert(tasks).values(data);
  return data;
});

type TaskComment = InferInsertModel<typeof taskComments>;
export const commentFactory = Factory.define<TaskComment>(({ sequence }) => ({
  id: randomUUID(),
  content: `Comment content ${sequence}`,
  authorType: "TEAM",
})).onCreate(async (data) => {
  if (!data.taskId) {
    const task = await taskFactory.create();
    data.taskId = task.id;
    data.agencyId = task.agencyId;
  }
  await db.insert(taskComments).values(data);
  return data;
});

type TimeEntry = InferInsertModel<typeof timeEntries>;
export const timeEntryFactory = Factory.define<TimeEntry>(({ sequence }) => ({
  id: randomUUID(),
  startTime: new Date(),
  durationMinutes: 60,
  billable: true,
  source: "MANUAL",
})).onCreate(async (data) => {
  if (!data.taskId) {
    const task = await taskFactory.create();
    data.taskId = task.id;
    data.projectId = task.projectId;
    data.agencyId = task.agencyId;
  }
  if (!data.userId) {
    const user = await userFactory.create({ agencyId: data.agencyId });
    data.userId = user.id;
  }
  await db.insert(timeEntries).values(data);
  return data;
});

type Notification = InferInsertModel<typeof notifications>;
export const notificationFactory = Factory.define<Notification>(({ sequence }) => ({
  id: randomUUID(),
  type: "TASK_ASSIGNED",
  title: `Notification ${sequence}`,
})).onCreate(async (data) => {
  if (!data.agencyId) {
    const agency = await agencyFactory.create();
    data.agencyId = agency.id;
  }
  if (!data.userId) {
    const user = await userFactory.create({ agencyId: data.agencyId });
    data.userId = user.id;
  }
  await db.insert(notifications).values(data);
  return data;
});
