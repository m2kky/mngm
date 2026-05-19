import {
  pgTable, pgEnum, text, integer, boolean,
  timestamp, numeric, jsonb, index, uniqueIndex, primaryKey,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const roleEnum = pgEnum("role", ["OWNER", "ADMIN", "PROJECT_MANAGER", "TEAM_MEMBER", "CLIENT"]);
export const userStatusEnum = pgEnum("user_status", ["ACTIVE", "INVITED", "DEACTIVATED"]);
export const agencyPlanEnum = pgEnum("agency_plan", ["FREE", "PRO", "ENTERPRISE"]);
export const clientStatusEnum = pgEnum("client_status", ["ACTIVE", "PAUSED", "AT_RISK", "CHURNED", "INACTIVE", "ARCHIVED"]);
export const projectStatusEnum = pgEnum("project_status", ["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED", "ARCHIVED"]);
export const projectTypeEnum = pgEnum("project_type", ["ONGOING", "ONE_TIME", "RETAINER"]);
export const taskTypeEnum = pgEnum("task_type", ["DESIGN", "COPY", "DEVELOPMENT", "SOCIAL_POST", "MEETING", "REVIEW", "STRATEGY", "OTHER"]);
export const taskPriorityEnum = pgEnum("task_priority", ["LOW", "MEDIUM", "HIGH", "URGENT"]);
export const strategyStatusEnum = pgEnum("strategy_status", ["NOT_STARTED", "IN_PROGRESS", "COMPLETE"]);
export const taskReviewStatusEnum = pgEnum("task_review_status", ["NOT_REQUIRED", "PENDING", "APPROVED", "CHANGES_REQUESTED", "PM_OVERRIDE"]);
export const portalUserStatusEnum = pgEnum("portal_user_status", ["ACTIVE", "INVITED", "DEACTIVATED"]);
export const commentAuthorTypeEnum = pgEnum("comment_author_type", ["TEAM", "CLIENT", "SYSTEM"]);
export const reviewOutcomeEnum = pgEnum("review_outcome", ["APPROVED", "CHANGES_REQUESTED"]);
export const faultAttributionEnum = pgEnum("fault_attribution", ["AGENCY_ERROR", "CLIENT_CHANGED_MIND", "BRIEF_UNCLEAR", "TECHNICAL_ISSUE"]);
export const attachmentContextEnum = pgEnum("attachment_context", ["GENERAL", "CLIENT_FILE", "PROJECT_FILE", "TASK_FILE", "TASK_COMMENT", "BRAND_KIT", "STRATEGY", "CLIENT_REVIEW"]);
export const timeEntrySourceEnum = pgEnum("time_entry_source", ["TIMER", "MANUAL"]);
export const notificationChannelEnum = pgEnum("notification_channel", ["IN_APP", "EMAIL"]);
export const blockTypeEnum = pgEnum("block_type", ["PARAGRAPH", "HEADING1", "HEADING2", "TOGGLE", "CALLOUT", "CODE", "IMAGE", "DIVIDER", "BULLET_LIST", "NUMBERED_LIST"]);
export const propertyTypeEnum = pgEnum("property_type", ["TEXT", "NUMBER", "SELECT", "MULTI_SELECT", "DATE", "CHECKBOX", "URL", "RELATION", "ROLLUP"]);
export const viewTypeEnum = pgEnum("view_type", ["BOARD", "TABLE", "CALENDAR", "GALLERY", "TIMELINE", "LIST"]);
export const automationRunStatusEnum = pgEnum("automation_run_status", ["PENDING", "SUCCESS", "FAILED", "SKIPPED"]);
export const notificationTypeEnum = pgEnum("notification_type", [
  "TASK_ASSIGNED", "TASK_DUE_SOON", "TASK_COMPLETED", "COMMENT_ADDED", "COMMENT_MENTION",
  "CLIENT_REVIEW_REQUESTED", "CLIENT_APPROVED", "CLIENT_REJECTED", "INVITATION_RECEIVED",
  "PROJECT_UPDATED", "SYSTEM_ALERT",
]);
export const workspaceEventTypeEnum = pgEnum("workspace_event_type", [
  "TASK_CREATED", "TASK_UPDATED", "TASK_DELETED", "TASK_MOVED", "TASK_ASSIGNED", "TASK_COMPLETED",
  "COMMENT_ADDED", "COMMENT_DELETED", "FILE_UPLOADED", "FILE_DELETED",
  "CLIENT_CREATED", "CLIENT_UPDATED", "PROJECT_CREATED", "PROJECT_UPDATED",
  "REVIEW_SUBMITTED", "MEMBER_ADDED", "MEMBER_REMOVED",
]);
export const invitationStatusEnum = pgEnum("invitation_status", ["PENDING", "ACCEPTED", "EXPIRED", "REVOKED"]);

// ─── Tables ───────────────────────────────────────────────────────────────────

// Users and agencies are mutually referencing; both use () => lambdas for FK refs.

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  passwordHash: text("password_hash"),
  status: userStatusEnum("status").notNull().default("ACTIVE"),
  language: text("language").notNull().default("en"),
  theme: text("theme").notNull().default("system"),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  role: roleEnum("role").notNull().default("TEAM_MEMBER"),
  agencyId: text("agency_id").references((): AnyPgColumn => agencies.id, { onDelete: "set null" }),
}, (t) => [
  index("users_agency_id_idx").on(t.agencyId),
  index("users_status_idx").on(t.status),
]);

export const agencies = pgTable("agencies", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").unique(),
  logo: text("logo"),
  timezone: text("timezone").notNull().default("Africa/Cairo"),
  currency: text("currency").notNull().default("EGP"),
  locale: text("locale").notNull().default("ar-EG"),
  plan: agencyPlanEnum("plan").notNull().default("FREE"),
  onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
  workingDays: integer("working_days").array().notNull().default([0, 1, 2, 3, 4]),
  workingHoursStart: text("working_hours_start").notNull().default("09:00"),
  workingHoursEnd: text("working_hours_end").notNull().default("17:00"),
  ownerId: text("owner_id").references((): AnyPgColumn => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("agencies_owner_id_idx").on(t.ownerId),
]);

export const sessions = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
}, (t) => [
  index("sessions_user_id_idx").on(t.userId),
]);

export const accounts = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
}, (t) => [
  index("accounts_user_id_idx").on(t.userId),
]);

export const verifications = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
}, (t) => [
  index("verifications_identifier_idx").on(t.identifier),
]);

export const invitations = pgTable("invitations", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  role: roleEnum("role").notNull().default("TEAM_MEMBER"),
  status: invitationStatusEnum("status").notNull().default("PENDING"),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  agencyId: text("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
  invitedById: text("invited_by_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("invitations_agency_status_idx").on(t.agencyId, t.status),
  index("invitations_email_idx").on(t.email),
  index("invitations_expires_at_idx").on(t.expiresAt),
]);

export const clients = pgTable("clients", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug"),
  status: clientStatusEnum("status").notNull().default("ACTIVE"),
  industry: text("industry"),
  website: text("website"),
  logo: text("logo"),
  coverImage: text("cover_image"),
  iconEmoji: text("icon_emoji"),
  iconColor: text("icon_color"),
  notes: text("notes"),
  healthScore: integer("health_score").notNull().default(0),
  portalEnabled: boolean("portal_enabled").notNull().default(false),
  contractType: text("contract_type"),
  monthlyBudget: numeric("monthly_budget", { precision: 12, scale: 2 }),
  hourlyRate: numeric("hourly_rate", { precision: 8, scale: 2 }),
  agencyId: text("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
  createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("clients_agency_slug_idx").on(t.agencyId, t.slug),
  index("clients_agency_id_idx").on(t.agencyId),
  index("clients_agency_status_idx").on(t.agencyId, t.status),
  index("clients_created_by_id_idx").on(t.createdById),
]);

export const clientContacts = pgTable("client_contacts", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  position: text("position"),
  roleType: text("role_type"),
  isPrimary: boolean("is_primary").notNull().default(false),
  clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("client_contacts_client_id_idx").on(t.clientId),
  index("client_contacts_email_idx").on(t.email),
]);

export const clientPortalUsers = pgTable("client_portal_users", {
  id: text("id").primaryKey(),
  agencyId: text("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
  clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  contactId: text("contact_id").unique().references(() => clientContacts.id, { onDelete: "set null" }),
  email: text("email").notNull(),
  name: text("name").notNull(),
  image: text("image"),
  status: portalUserStatusEnum("status").notNull().default("INVITED"),
  canApprove: boolean("can_approve").notNull().default(true),
  canComment: boolean("can_comment").notNull().default(true),
  canViewFinancials: boolean("can_view_financials").notNull().default(false),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("client_portal_users_client_email_idx").on(t.clientId, t.email),
  index("client_portal_users_agency_id_idx").on(t.agencyId),
  index("client_portal_users_email_idx").on(t.email),
]);

export const brandKits = pgTable("brand_kits", {
  id: text("id").primaryKey(),
  primaryColor: text("primary_color"),
  secondaryColor: text("secondary_color"),
  accentColor: text("accent_color"),
  additionalColors: jsonb("additional_colors"),
  primaryFont: text("primary_font"),
  secondaryFont: text("secondary_font"),
  toneOfVoice: text("tone_of_voice"),
  targetAudience: text("target_audience"),
  dos: jsonb("dos"),
  donts: jsonb("donts"),
  logoFileUrl: text("logo_file_url"),
  guidelinesFileUrl: text("guidelines_file_url"),
  assetLibrary: jsonb("asset_library"),
  completionPercent: integer("completion_percent").notNull().default(0),
  clientId: text("client_id").notNull().unique().references(() => clients.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const clientStrategies = pgTable("client_strategies", {
  id: text("id").primaryKey(),
  status: strategyStatusEnum("status").notNull().default("NOT_STARTED"),
  currentStep: integer("current_step").notNull().default(1),
  situation: jsonb("situation"),
  objectives: jsonb("objectives"),
  strategy: jsonb("strategy"),
  tactics: jsonb("tactics"),
  action: jsonb("action"),
  control: jsonb("control"),
  kpis: jsonb("kpis"),
  completionPercent: integer("completion_percent").notNull().default(0),
  clientId: text("client_id").notNull().unique().references(() => clients.id, { onDelete: "cascade" }),
  createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("client_strategies_created_by_id_idx").on(t.createdById),
]);

export const projects = pgTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  type: projectTypeEnum("type").notNull().default("ONE_TIME"),
  status: projectStatusEnum("status").notNull().default("PLANNING"),
  priority: taskPriorityEnum("priority").notNull().default("MEDIUM"),
  progress: integer("progress").notNull().default(0),
  startDate: timestamp("start_date", { withTimezone: true }),
  dueDate: timestamp("due_date", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  budgetHours: numeric("budget_hours", { precision: 8, scale: 2 }),
  budgetAmount: numeric("budget_amount", { precision: 12, scale: 2 }),
  coverImage: text("cover_image"),
  iconEmoji: text("icon_emoji"),
  iconColor: text("icon_color"),
  agencyId: text("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
  clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("projects_agency_id_idx").on(t.agencyId),
  index("projects_agency_status_idx").on(t.agencyId, t.status),
  index("projects_client_id_idx").on(t.clientId),
  index("projects_created_by_id_idx").on(t.createdById),
]);

export const projectMembers = pgTable("project_members", {
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: roleEnum("role").notNull().default("TEAM_MEMBER"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.projectId, t.userId] }),
  index("project_members_user_id_idx").on(t.userId),
]);

export const projectStages = pgTable("project_stages", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color"),
  order: integer("order").notNull(),
  wipLimit: integer("wip_limit"),
  isDefault: boolean("is_default").notNull().default(false),
  isDone: boolean("is_done").notNull().default(false),
  isClientReview: boolean("is_client_review").notNull().default(false),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("project_stages_project_name_idx").on(t.projectId, t.name),
  uniqueIndex("project_stages_project_order_idx").on(t.projectId, t.order),
  index("project_stages_project_id_idx").on(t.projectId),
]);

export const tasks = pgTable("tasks", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  type: taskTypeEnum("type").notNull().default("DESIGN"),
  priority: taskPriorityEnum("priority").notNull().default("MEDIUM"),
  reviewStatus: taskReviewStatusEnum("review_status").notNull().default("NOT_REQUIRED"),
  startDate: timestamp("start_date", { withTimezone: true }),
  dueDate: timestamp("due_date", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  rejectedAt: timestamp("rejected_at", { withTimezone: true }),
  estimatedMinutes: integer("estimated_minutes"),
  actualMinutes: integer("actual_minutes").notNull().default(0),
  coverImage: text("cover_image"),
  iconEmoji: text("icon_emoji"),
  iconColor: text("icon_color"),
  position: integer("position").notNull().default(0),
  agencyId: text("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  stageId: text("stage_id").notNull().references(() => projectStages.id, { onDelete: "restrict" }),
  createdById: text("created_by_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  reviewerId: text("reviewer_id").references(() => users.id, { onDelete: "set null" }),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("tasks_agency_id_idx").on(t.agencyId),
  index("tasks_agency_review_status_idx").on(t.agencyId, t.reviewStatus),
  index("tasks_project_id_idx").on(t.projectId),
  index("tasks_stage_id_idx").on(t.stageId),
  index("tasks_created_by_id_idx").on(t.createdById),
  index("tasks_reviewer_id_idx").on(t.reviewerId),
  index("tasks_due_date_idx").on(t.dueDate),
]);

export const taskAssignees = pgTable("task_assignees", {
  taskId: text("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.taskId, t.userId] }),
  index("task_assignees_user_id_idx").on(t.userId),
]);

export const subtasks = pgTable("subtasks", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  isDone: boolean("is_done").notNull().default(false),
  dueDate: timestamp("due_date", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  position: integer("position").notNull().default(0),
  taskId: text("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  assigneeId: text("assignee_id").references(() => users.id, { onDelete: "set null" }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("subtasks_task_id_idx").on(t.taskId),
  index("subtasks_assignee_id_idx").on(t.assigneeId),
]);

export const taskDependencies = pgTable("task_dependencies", {
  taskId: text("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  dependsOnTaskId: text("depends_on_task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.taskId, t.dependsOnTaskId] }),
  index("task_dependencies_depends_on_idx").on(t.dependsOnTaskId),
]);

export const tags = pgTable("tags", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#64748b"),
  agencyId: text("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("tags_agency_name_idx").on(t.agencyId, t.name),
  index("tags_agency_id_idx").on(t.agencyId),
]);

export const taskTags = pgTable("task_tags", {
  taskId: text("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  tagId: text("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.taskId, t.tagId] }),
  index("task_tags_tag_id_idx").on(t.tagId),
]);

export const fileAssets = pgTable("file_assets", {
  id: text("id").primaryKey(),
  agencyId: text("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
  clientId: text("client_id").references(() => clients.id, { onDelete: "set null" }),
  projectId: text("project_id").references(() => projects.id, { onDelete: "set null" }),
  taskId: text("task_id").references(() => tasks.id, { onDelete: "set null" }),
  commentId: text("comment_id").references(() => taskComments.id, { onDelete: "set null" }),
  brandKitId: text("brand_kit_id").references(() => brandKits.id, { onDelete: "set null" }),
  strategyId: text("strategy_id").references(() => clientStrategies.id, { onDelete: "set null" }),
  uploadedById: text("uploaded_by_id").references(() => users.id, { onDelete: "set null" }),
  uploadedByClientPortalUserId: text("uploaded_by_client_portal_user_id").references(() => clientPortalUsers.id, { onDelete: "set null" }),
  fileName: text("file_name").notNull(),
  fileKey: text("file_key").notNull(),
  fileUrl: text("file_url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  mimeType: text("mime_type").notNull(),
  fileSize: integer("file_size").notNull(),
  checksum: text("checksum"),
  context: attachmentContextEnum("context").notNull().default("GENERAL"),
  folder: text("folder"),
  metadata: jsonb("metadata"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("file_assets_agency_key_idx").on(t.agencyId, t.fileKey),
  index("file_assets_agency_id_idx").on(t.agencyId),
  index("file_assets_client_id_idx").on(t.clientId),
  index("file_assets_project_id_idx").on(t.projectId),
  index("file_assets_task_id_idx").on(t.taskId),
  index("file_assets_comment_id_idx").on(t.commentId),
  index("file_assets_brand_kit_id_idx").on(t.brandKitId),
  index("file_assets_strategy_id_idx").on(t.strategyId),
  index("file_assets_uploaded_by_id_idx").on(t.uploadedById),
  index("file_assets_uploaded_by_client_portal_user_id_idx").on(t.uploadedByClientPortalUserId),
]);

export const taskComments = pgTable("task_comments", {
  id: text("id").primaryKey(),
  agencyId: text("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
  taskId: text("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  authorType: commentAuthorTypeEnum("author_type").notNull().default("TEAM"),
  authorUserId: text("author_user_id").references(() => users.id, { onDelete: "set null" }),
  authorClientPortalUserId: text("author_client_portal_user_id").references(() => clientPortalUsers.id, { onDelete: "set null" }),
  content: text("content").notNull(),
  mentions: text("mentions").array().notNull().default([]),
  isClientFeedback: boolean("is_client_feedback").notNull().default(false),
  parentCommentId: text("parent_comment_id").references((): AnyPgColumn => taskComments.id, { onDelete: "set null" }),
  editedAt: timestamp("edited_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("task_comments_agency_id_idx").on(t.agencyId),
  index("task_comments_task_created_idx").on(t.taskId, t.createdAt),
  index("task_comments_author_user_id_idx").on(t.authorUserId),
  index("task_comments_parent_id_idx").on(t.parentCommentId),
]);

export const commentReactions = pgTable("comment_reactions", {
  id: text("id").primaryKey(),
  commentId: text("comment_id").notNull().references(() => taskComments.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  clientPortalUserId: text("client_portal_user_id").references(() => clientPortalUsers.id, { onDelete: "set null" }),
  emoji: text("emoji").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("comment_reactions_comment_id_idx").on(t.commentId),
  index("comment_reactions_user_id_idx").on(t.userId),
]);

export const timeEntries = pgTable("time_entries", {
  id: text("id").primaryKey(),
  agencyId: text("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  clientId: text("client_id").references(() => clients.id, { onDelete: "set null" }),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  taskId: text("task_id").references(() => tasks.id, { onDelete: "set null" }),
  startTime: timestamp("start_time", { withTimezone: true }).notNull(),
  endTime: timestamp("end_time", { withTimezone: true }),
  durationMinutes: integer("duration_minutes"),
  note: text("note"),
  billable: boolean("billable").notNull().default(true),
  source: timeEntrySourceEnum("source").notNull().default("MANUAL"),
  editedAt: timestamp("edited_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("time_entries_agency_user_time_idx").on(t.agencyId, t.userId, t.startTime),
  index("time_entries_client_id_idx").on(t.clientId),
  index("time_entries_project_id_idx").on(t.projectId),
  index("time_entries_task_id_idx").on(t.taskId),
]);

export const clientReviews = pgTable("client_reviews", {
  id: text("id").primaryKey(),
  agencyId: text("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
  clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  projectId: text("project_id").references(() => projects.id, { onDelete: "set null" }),
  taskId: text("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  reviewerId: text("reviewer_id").references(() => clientPortalUsers.id, { onDelete: "set null" }),
  outcome: reviewOutcomeEnum("outcome").notNull(),
  reason: text("reason"),
  faultAttribution: faultAttributionEnum("fault_attribution"),
  commentId: text("comment_id").unique().references(() => taskComments.id, { onDelete: "set null" }),
  metadata: jsonb("metadata"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("client_reviews_agency_reviewed_idx").on(t.agencyId, t.reviewedAt),
  index("client_reviews_client_id_idx").on(t.clientId),
  index("client_reviews_task_id_idx").on(t.taskId),
  index("client_reviews_outcome_idx").on(t.outcome),
]);

export const qualityEvents = pgTable("quality_events", {
  id: text("id").primaryKey(),
  agencyId: text("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
  clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  projectId: text("project_id").references(() => projects.id, { onDelete: "set null" }),
  taskId: text("task_id").references(() => tasks.id, { onDelete: "set null" }),
  memberId: text("member_id").references(() => users.id, { onDelete: "set null" }),
  reviewId: text("review_id").references(() => clientReviews.id, { onDelete: "set null" }),
  eventType: text("event_type").notNull(),
  approved: boolean("approved"),
  faultAttribution: faultAttributionEnum("fault_attribution"),
  scoreImpact: integer("score_impact"),
  reason: text("reason"),
  metadata: jsonb("metadata"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("quality_events_agency_occurred_idx").on(t.agencyId, t.occurredAt),
  index("quality_events_client_id_idx").on(t.clientId),
  index("quality_events_task_id_idx").on(t.taskId),
  index("quality_events_member_id_idx").on(t.memberId),
  index("quality_events_review_id_idx").on(t.reviewId),
]);

export const qualitySnapshots = pgTable("quality_snapshots", {
  id: text("id").primaryKey(),
  agencyId: text("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
  clientId: text("client_id").references(() => clients.id, { onDelete: "set null" }),
  scopeType: text("scope_type").notNull(),
  projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }),
  memberId: text("member_id").references(() => users.id, { onDelete: "cascade" }),
  periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
  periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
  approvalRate: numeric("approval_rate", { precision: 5, scale: 2 }),
  totalReviewed: integer("total_reviewed").notNull().default(0),
  totalRejected: integer("total_rejected").notNull().default(0),
  averageScore: numeric("average_score", { precision: 5, scale: 2 }),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("quality_snapshots_agency_scope_idx").on(t.agencyId, t.scopeType, t.projectId, t.memberId),
  index("quality_snapshots_client_id_idx").on(t.clientId),
  index("quality_snapshots_period_idx").on(t.periodStart, t.periodEnd),
]);

export const notifications = pgTable("notifications", {
  id: text("id").primaryKey(),
  agencyId: text("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  clientPortalUserId: text("client_portal_user_id").references(() => clientPortalUsers.id, { onDelete: "cascade" }),
  type: notificationTypeEnum("type").notNull(),
  channel: notificationChannelEnum("channel").notNull().default("IN_APP"),
  title: text("title").notNull(),
  body: text("body"),
  actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  actorClientPortalUserId: text("actor_client_portal_user_id").references(() => clientPortalUsers.id, { onDelete: "set null" }),
  entityType: text("entity_type"),
  entityId: text("entity_id"),
  deepLink: text("deep_link"),
  readAt: timestamp("read_at", { withTimezone: true }),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("notifications_agency_id_idx").on(t.agencyId),
  index("notifications_user_read_idx").on(t.userId, t.readAt, t.createdAt),
  index("notifications_type_idx").on(t.type),
]);

export const notificationPreferences = pgTable("notification_preferences", {
  id: text("id").primaryKey(),
  agencyId: text("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  clientPortalUserId: text("client_portal_user_id").references(() => clientPortalUsers.id, { onDelete: "cascade" }),
  type: notificationTypeEnum("type").notNull(),
  inAppEnabled: boolean("in_app_enabled").notNull().default(true),
  emailEnabled: boolean("email_enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("notif_prefs_agency_id_idx").on(t.agencyId),
  index("notif_prefs_user_id_idx").on(t.userId),
  index("notif_prefs_type_idx").on(t.type),
]);

export const activityLogs = pgTable("activity_logs", {
  id: text("id").primaryKey(),
  agencyId: text("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
  actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  actorClientPortalUserId: text("actor_client_portal_user_id").references(() => clientPortalUsers.id, { onDelete: "set null" }),
  contactId: text("contact_id").references(() => clientContacts.id, { onDelete: "set null" }),
  clientId: text("client_id").references(() => clients.id, { onDelete: "set null" }),
  projectId: text("project_id").references(() => projects.id, { onDelete: "set null" }),
  taskId: text("task_id").references(() => tasks.id, { onDelete: "set null" }),
  eventType: workspaceEventTypeEnum("event_type").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  summary: text("summary"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("activity_logs_agency_created_idx").on(t.agencyId, t.createdAt),
  index("activity_logs_actor_user_id_idx").on(t.actorUserId),
  index("activity_logs_client_id_idx").on(t.clientId),
  index("activity_logs_project_id_idx").on(t.projectId),
  index("activity_logs_task_id_idx").on(t.taskId),
]);

export const automationRules = pgTable("automation_rules", {
  id: text("id").primaryKey(),
  agencyId: text("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
  projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }),
  triggerType: text("trigger_type").notNull(),
  conditions: jsonb("conditions"),
  actionType: text("action_type").notNull(),
  actions: jsonb("actions"),
  name: text("name").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
  lastTriggeredAt: timestamp("last_triggered_at", { withTimezone: true }),
  executionCount: integer("execution_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("automation_rules_agency_enabled_idx").on(t.agencyId, t.enabled),
  index("automation_rules_project_id_idx").on(t.projectId),
  index("automation_rules_trigger_type_idx").on(t.triggerType),
]);

export const automationRuns = pgTable("automation_runs", {
  id: text("id").primaryKey(),
  agencyId: text("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
  ruleId: text("rule_id").references(() => automationRules.id, { onDelete: "set null" }),
  status: automationRunStatusEnum("status").notNull().default("PENDING"),
  triggerEvent: text("trigger_event").notNull(),
  entityType: text("entity_type"),
  entityId: text("entity_id"),
  actions: jsonb("actions"),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
}, (t) => [
  index("automation_runs_agency_started_idx").on(t.agencyId, t.startedAt),
  index("automation_runs_rule_id_idx").on(t.ruleId),
  index("automation_runs_status_idx").on(t.status),
  index("automation_runs_entity_type_entity_id_idx").on(t.entityType, t.entityId),
]);

export const projectTemplates = pgTable("project_templates", {
  id: text("id").primaryKey(),
  agencyId: text("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  type: projectTypeEnum("type"),
  createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("project_templates_agency_id_idx").on(t.agencyId),
  index("project_templates_created_by_id_idx").on(t.createdById),
]);

export const taskTemplates = pgTable("task_templates", {
  id: text("id").primaryKey(),
  agencyId: text("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: taskTypeEnum("type").notNull(),
  defaultPriority: taskPriorityEnum("default_priority").notNull().default("MEDIUM"),
  defaultAssigneeRole: roleEnum("default_assignee_role"),
  estimatedMinutes: integer("estimated_minutes"),
  defaultTags: text("default_tags").array().notNull().default([]),
  createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("task_templates_agency_id_idx").on(t.agencyId),
  index("task_templates_type_idx").on(t.type),
]);

export const workspaceEvents = pgTable("workspace_events", {
  id: text("id").primaryKey(),
  agencyId: text("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
  actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  actorClientPortalUserId: text("actor_client_portal_user_id").references(() => clientPortalUsers.id, { onDelete: "set null" }),
  clientId: text("client_id").references(() => clients.id, { onDelete: "set null" }),
  projectId: text("project_id").references(() => projects.id, { onDelete: "set null" }),
  taskId: text("task_id").references(() => tasks.id, { onDelete: "set null" }),
  eventType: workspaceEventTypeEnum("event_type").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  payload: jsonb("payload").notNull(),
  processedForAi: boolean("processed_for_ai").notNull().default(false),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("workspace_events_agency_occurred_idx").on(t.agencyId, t.occurredAt),
  index("workspace_events_actor_user_id_idx").on(t.actorUserId),
  index("workspace_events_client_id_idx").on(t.clientId),
  index("workspace_events_project_id_idx").on(t.projectId),
  index("workspace_events_task_id_idx").on(t.taskId),
  index("workspace_events_event_type_idx").on(t.eventType),
  index("workspace_events_processed_for_ai_idx").on(t.processedForAi),
]);

export const vectorEmbeddings = pgTable("vector_embeddings", {
  id: text("id").primaryKey(),
  agencyId: text("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
  sourceType: text("source_type").notNull(),
  sourceId: text("source_id").notNull(),
  content: text("content").notNull(),
  embedding: text("embedding"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("vector_embeddings_agency_source_idx").on(t.agencyId, t.sourceType),
]);

export const blocks = pgTable("blocks", {
  id: text("id").primaryKey(),
  type: blockTypeEnum("type").notNull(),
  content: jsonb("content"),
  position: integer("position").notNull(),
  parentId: text("parent_id").references((): AnyPgColumn => blocks.id, { onDelete: "cascade" }),
  taskId: text("task_id").references(() => tasks.id, { onDelete: "cascade" }),
  projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }),
  clientId: text("client_id").references(() => clients.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("blocks_task_id_idx").on(t.taskId),
  index("blocks_project_id_idx").on(t.projectId),
  index("blocks_client_id_idx").on(t.clientId),
  index("blocks_parent_id_idx").on(t.parentId),
]);

export const templateBlocks = pgTable("template_blocks", {
  id: text("id").primaryKey(),
  type: blockTypeEnum("type").notNull(),
  content: jsonb("content"),
  position: integer("position").notNull(),
  parentId: text("parent_id").references((): AnyPgColumn => templateBlocks.id, { onDelete: "cascade" }),
  taskTemplateId: text("task_template_id").references(() => taskTemplates.id, { onDelete: "cascade" }),
  projectTemplateId: text("project_template_id").references(() => projectTemplates.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("template_blocks_task_template_id_idx").on(t.taskTemplateId),
  index("template_blocks_project_template_id_idx").on(t.projectTemplateId),
  index("template_blocks_parent_id_idx").on(t.parentId),
]);

export const taskProperties = pgTable("task_properties", {
  id: text("id").primaryKey(),
  agencyId: text("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: propertyTypeEnum("type").notNull(),
  options: jsonb("options"),
  position: integer("position").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("task_properties_agency_name_idx").on(t.agencyId, t.name),
  index("task_properties_agency_id_idx").on(t.agencyId),
]);

export const taskPropertyValues = pgTable("task_property_values", {
  taskId: text("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  propertyId: text("property_id").notNull().references(() => taskProperties.id, { onDelete: "cascade" }),
  value: jsonb("value").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.taskId, t.propertyId] }),
  index("task_property_values_task_id_idx").on(t.taskId),
  index("task_property_values_property_id_idx").on(t.propertyId),
]);

export const propertyRelations = pgTable("property_relations", {
  id: text("id").primaryKey(),
  propertyId: text("property_id").notNull().unique().references(() => taskProperties.id, { onDelete: "cascade" }),
  targetModel: text("target_model").notNull(),
  displayField: text("display_field").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const projectViews = pgTable("project_views", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: viewTypeEnum("type").notNull(),
  filterBy: jsonb("filter_by"),
  sortBy: jsonb("sort_by"),
  groupBy: text("group_by"),
  isDefault: boolean("is_default").notNull().default(false),
  position: integer("position").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("project_views_project_id_idx").on(t.projectId),
]);

export const projectTemplateStages = pgTable("project_template_stages", {
  id: text("id").primaryKey(),
  templateId: text("template_id").notNull().references(() => projectTemplates.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  order: integer("order").notNull(),
  isDone: boolean("is_done").notNull().default(false),
  isClientReview: boolean("is_client_review").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("project_template_stages_template_name_idx").on(t.templateId, t.name),
  uniqueIndex("project_template_stages_template_order_idx").on(t.templateId, t.order),
  index("project_template_stages_template_id_idx").on(t.templateId),
]);

export const taskTemplateProperties = pgTable("task_template_properties", {
  id: text("id").primaryKey(),
  templateId: text("template_id").notNull().references(() => taskTemplates.id, { onDelete: "cascade" }),
  propertyId: text("property_id").notNull().references(() => taskProperties.id, { onDelete: "cascade" }),
  defaultValue: jsonb("default_value"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("task_template_properties_template_property_idx").on(t.templateId, t.propertyId),
  index("task_template_properties_template_id_idx").on(t.templateId),
  index("task_template_properties_property_id_idx").on(t.propertyId),
]);

// ─── Insert Schemas (drizzle-zod) ─────────────────────────────────────────────
// id is always omitted — storage layers generate IDs server-side.

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAgencySchema = createInsertSchema(agencies).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSessionSchema = createInsertSchema(sessions).omit({ id: true });
export const insertAccountSchema = createInsertSchema(accounts).omit({ id: true });
export const insertVerificationSchema = createInsertSchema(verifications).omit({ id: true });
export const insertInvitationSchema = createInsertSchema(invitations).omit({ id: true, createdAt: true, updatedAt: true });
export const insertClientSchema = createInsertSchema(clients).omit({ id: true, createdAt: true, updatedAt: true });
export const insertClientContactSchema = createInsertSchema(clientContacts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertClientPortalUserSchema = createInsertSchema(clientPortalUsers).omit({ id: true, createdAt: true, updatedAt: true });
export const insertBrandKitSchema = createInsertSchema(brandKits).omit({ id: true, createdAt: true, updatedAt: true });
export const insertClientStrategySchema = createInsertSchema(clientStrategies).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProjectSchema = createInsertSchema(projects).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProjectMemberSchema = createInsertSchema(projectMembers).omit({ createdAt: true });
export const insertProjectStageSchema = createInsertSchema(projectStages).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTaskSchema = createInsertSchema(tasks).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTaskAssigneeSchema = createInsertSchema(taskAssignees).omit({ createdAt: true });
export const insertSubtaskSchema = createInsertSchema(subtasks).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTaskDependencySchema = createInsertSchema(taskDependencies).omit({ createdAt: true });
export const insertTagSchema = createInsertSchema(tags).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTaskTagSchema = createInsertSchema(taskTags).omit({ createdAt: true });
export const insertFileAssetSchema = createInsertSchema(fileAssets).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTaskCommentSchema = createInsertSchema(taskComments).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCommentReactionSchema = createInsertSchema(commentReactions).omit({ id: true, createdAt: true });
export const insertTimeEntrySchema = createInsertSchema(timeEntries).omit({ id: true, createdAt: true, updatedAt: true });
export const insertClientReviewSchema = createInsertSchema(clientReviews).omit({ id: true, createdAt: true, updatedAt: true });
export const insertQualityEventSchema = createInsertSchema(qualityEvents).omit({ id: true, createdAt: true, occurredAt: true });
export const insertQualitySnapshotSchema = createInsertSchema(qualitySnapshots).omit({ id: true, createdAt: true, updatedAt: true });
export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true });
export const insertNotificationPreferenceSchema = createInsertSchema(notificationPreferences).omit({ id: true, createdAt: true, updatedAt: true });
export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({ id: true, createdAt: true });
export const insertAutomationRuleSchema = createInsertSchema(automationRules).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAutomationRunSchema = createInsertSchema(automationRuns).omit({ id: true, startedAt: true });
export const insertProjectTemplateSchema = createInsertSchema(projectTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTaskTemplateSchema = createInsertSchema(taskTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export const insertWorkspaceEventSchema = createInsertSchema(workspaceEvents).omit({ id: true, occurredAt: true });
export const insertVectorEmbeddingSchema = createInsertSchema(vectorEmbeddings).omit({ id: true, createdAt: true });
export const insertBlockSchema = createInsertSchema(blocks).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTemplateBlockSchema = createInsertSchema(templateBlocks).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTaskPropertySchema = createInsertSchema(taskProperties).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTaskPropertyValueSchema = createInsertSchema(taskPropertyValues).omit({ createdAt: true, updatedAt: true });
export const insertPropertyRelationSchema = createInsertSchema(propertyRelations).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProjectViewSchema = createInsertSchema(projectViews).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProjectTemplateStageSchema = createInsertSchema(projectTemplateStages).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTaskTemplatePropertySchema = createInsertSchema(taskTemplateProperties).omit({ id: true, createdAt: true, updatedAt: true });

// ─── TypeScript Select Types ──────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type Agency = typeof agencies.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Verification = typeof verifications.$inferSelect;
export type Invitation = typeof invitations.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type ClientContact = typeof clientContacts.$inferSelect;
export type ClientPortalUser = typeof clientPortalUsers.$inferSelect;
export type BrandKit = typeof brandKits.$inferSelect;
export type ClientStrategy = typeof clientStrategies.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type ProjectMember = typeof projectMembers.$inferSelect;
export type ProjectStage = typeof projectStages.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type TaskAssignee = typeof taskAssignees.$inferSelect;
export type Subtask = typeof subtasks.$inferSelect;
export type TaskDependency = typeof taskDependencies.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type TaskTag = typeof taskTags.$inferSelect;
export type FileAsset = typeof fileAssets.$inferSelect;
export type TaskComment = typeof taskComments.$inferSelect;
export type CommentReaction = typeof commentReactions.$inferSelect;
export type TimeEntry = typeof timeEntries.$inferSelect;
export type ClientReview = typeof clientReviews.$inferSelect;
export type QualityEvent = typeof qualityEvents.$inferSelect;
export type QualitySnapshot = typeof qualitySnapshots.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type NotificationPreference = typeof notificationPreferences.$inferSelect;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type AutomationRule = typeof automationRules.$inferSelect;
export type AutomationRun = typeof automationRuns.$inferSelect;
export type ProjectTemplate = typeof projectTemplates.$inferSelect;
export type TaskTemplate = typeof taskTemplates.$inferSelect;
export type WorkspaceEvent = typeof workspaceEvents.$inferSelect;
export type VectorEmbedding = typeof vectorEmbeddings.$inferSelect;
export type Block = typeof blocks.$inferSelect;
export type TemplateBlock = typeof templateBlocks.$inferSelect;
export type TaskProperty = typeof taskProperties.$inferSelect;
export type TaskPropertyValue = typeof taskPropertyValues.$inferSelect;
export type PropertyRelation = typeof propertyRelations.$inferSelect;
export type ProjectView = typeof projectViews.$inferSelect;
export type ProjectStageTemplate = typeof projectTemplateStages.$inferSelect;
export type TaskTemplateProperty = typeof taskTemplateProperties.$inferSelect;

// ─── TypeScript Insert Types ──────────────────────────────────────────────────

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertAgency = z.infer<typeof insertAgencySchema>;
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type InsertAccount = z.infer<typeof insertAccountSchema>;
export type InsertVerification = z.infer<typeof insertVerificationSchema>;
export type InsertInvitation = z.infer<typeof insertInvitationSchema>;
export type InsertClient = z.infer<typeof insertClientSchema>;
export type InsertClientContact = z.infer<typeof insertClientContactSchema>;
export type InsertClientPortalUser = z.infer<typeof insertClientPortalUserSchema>;
export type InsertBrandKit = z.infer<typeof insertBrandKitSchema>;
export type InsertClientStrategy = z.infer<typeof insertClientStrategySchema>;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type InsertProjectMember = z.infer<typeof insertProjectMemberSchema>;
export type InsertProjectStage = z.infer<typeof insertProjectStageSchema>;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type InsertTaskAssignee = z.infer<typeof insertTaskAssigneeSchema>;
export type InsertSubtask = z.infer<typeof insertSubtaskSchema>;
export type InsertTaskDependency = z.infer<typeof insertTaskDependencySchema>;
export type InsertTag = z.infer<typeof insertTagSchema>;
export type InsertTaskTag = z.infer<typeof insertTaskTagSchema>;
export type InsertFileAsset = z.infer<typeof insertFileAssetSchema>;
export type InsertTaskComment = z.infer<typeof insertTaskCommentSchema>;
export type InsertCommentReaction = z.infer<typeof insertCommentReactionSchema>;
export type InsertTimeEntry = z.infer<typeof insertTimeEntrySchema>;
export type InsertClientReview = z.infer<typeof insertClientReviewSchema>;
export type InsertQualityEvent = z.infer<typeof insertQualityEventSchema>;
export type InsertQualitySnapshot = z.infer<typeof insertQualitySnapshotSchema>;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type InsertNotificationPreference = z.infer<typeof insertNotificationPreferenceSchema>;
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type InsertAutomationRule = z.infer<typeof insertAutomationRuleSchema>;
export type InsertAutomationRun = z.infer<typeof insertAutomationRunSchema>;
export type InsertProjectTemplate = z.infer<typeof insertProjectTemplateSchema>;
export type InsertTaskTemplate = z.infer<typeof insertTaskTemplateSchema>;
export type InsertWorkspaceEvent = z.infer<typeof insertWorkspaceEventSchema>;
export type InsertVectorEmbedding = z.infer<typeof insertVectorEmbeddingSchema>;
export type InsertBlock = z.infer<typeof insertBlockSchema>;
export type InsertTemplateBlock = z.infer<typeof insertTemplateBlockSchema>;
export type InsertTaskProperty = z.infer<typeof insertTaskPropertySchema>;
export type InsertTaskPropertyValue = z.infer<typeof insertTaskPropertyValueSchema>;
export type InsertPropertyRelation = z.infer<typeof insertPropertyRelationSchema>;
export type InsertProjectView = z.infer<typeof insertProjectViewSchema>;
export type InsertProjectStageTemplate = z.infer<typeof insertProjectTemplateStageSchema>;
export type InsertTaskTemplateProperty = z.infer<typeof insertTaskTemplatePropertySchema>;

// ─── Enum value types ─────────────────────────────────────────────────────────

export type Role = typeof roleEnum.enumValues[number];
export type UserStatus = typeof userStatusEnum.enumValues[number];
export type AgencyPlan = typeof agencyPlanEnum.enumValues[number];
export type ClientStatus = typeof clientStatusEnum.enumValues[number];
export type ProjectStatus = typeof projectStatusEnum.enumValues[number];
export type ProjectType = typeof projectTypeEnum.enumValues[number];
export type TaskType = typeof taskTypeEnum.enumValues[number];
export type TaskPriority = typeof taskPriorityEnum.enumValues[number];
export type StrategyStatus = typeof strategyStatusEnum.enumValues[number];
export type TaskReviewStatus = typeof taskReviewStatusEnum.enumValues[number];
export type PortalUserStatus = typeof portalUserStatusEnum.enumValues[number];
export type CommentAuthorType = typeof commentAuthorTypeEnum.enumValues[number];
export type ReviewOutcome = typeof reviewOutcomeEnum.enumValues[number];
export type FaultAttribution = typeof faultAttributionEnum.enumValues[number];
export type AttachmentContext = typeof attachmentContextEnum.enumValues[number];
export type TimeEntrySource = typeof timeEntrySourceEnum.enumValues[number];
export type NotificationChannel = typeof notificationChannelEnum.enumValues[number];
export type BlockType = typeof blockTypeEnum.enumValues[number];
export type PropertyType = typeof propertyTypeEnum.enumValues[number];
export type ViewType = typeof viewTypeEnum.enumValues[number];
export type AutomationRunStatus = typeof automationRunStatusEnum.enumValues[number];
export type NotificationType = typeof notificationTypeEnum.enumValues[number];
export type WorkspaceEventType = typeof workspaceEventTypeEnum.enumValues[number];
export type InvitationStatus = typeof invitationStatusEnum.enumValues[number];
