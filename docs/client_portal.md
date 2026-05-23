# Client Portal & Data Security Boundaries

Workit.OS is a multi-tenant SaaS application that allows external clients direct access to their brand strategic assets, deliverables, and communication channels. Because clients and agency staff share the same codebase, strict security boundaries are enforced to prevent unauthorized data access.

---

## 1. Client Security Architecture

To prevent data leaks, Workit.OS implements a **defense-in-depth** security architecture. Client access is restricted at two distinct checkpoints: the Global Firewall Gate and Scoped API Endpoints.

```
[External Client Requests]
          │
          ▼
┌────────────────────────┐
│ Global Firewall Gate   │  --> Allows ONLY white-listed paths (e.g. /api/client-portal/)
└────────────────────────┘
          │
          ▼
┌────────────────────────┐
│ Scoped API Endpoints   │  --> Enforces database-level locks on the user's clientId
└────────────────────────┘
          │
          ▼
┌────────────────────────┐
│ PostgreSQL Data Layer  │  --> Scoped data is returned (e.g. client brand kits, tasks)
└────────────────────────┘
```

---

## 2. Checkpoint 1: Global Firewall Gate

The server registers an Express middleware that intercepts all requests starting with `/api/`. If the authenticated user has the `CLIENT` role, they are blocked immediately unless the request path matches an explicitly allowed whitelist:

*   **`/api/auth/`**: Standard registration, login, and profile operations.
*   **`/api/client-portal/`**: Scoped client endpoints designed exclusively for portal usage.
*   **`/api/invitations/by-token/`**: Public signup validations.
*   **`/api/chat/channels`**: Standard channels endpoint, which is heavily restricted to the user's portal channel.

If a `CLIENT` role user attempts to access any other endpoint (e.g., general tasks, internal timesheets, financial reports, or teammate settings), they receive a `403 Forbidden` response:

```typescript
// server/routes.ts
const CLIENT_ALLOWED_PREFIXES = [
  "/api/auth/",
  "/api/client-portal/",
  "/api/invitations/by-token/",
  "/api/chat/channels",
];

app.use(async (req: any, res: any, next: any) => {
  if (!req.path.startsWith("/api/")) return next();
  const isClientSafe = CLIENT_ALLOWED_PREFIXES.some((p) => req.path.startsWith(p));
  if (isClientSafe) return next();

  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return next();

  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as { userId: string };
    const user = await storage.getUser(payload.userId);
    if (user?.role === "CLIENT") {
      return res.status(403).json({ error: "Access denied. Please use the client portal." });
    }
  } catch {
    // Let requireAuth report token errors
  }
  next();
});
```

---

## 3. Checkpoint 2: Scoped Client API Middleware

Endpoints under the `/api/client-portal/` prefix are protected by the `requireClientRole` middleware:

1.  **Role Verification**: Ensures the user role is `CLIENT`.
2.  **Agency Scope**: Confirms the user has an associated `agencyId`.
3.  **Client Scope**: Confirms the user has a linked `clientId`.
4.  **Context Loading**: Binds the validated profile to `req.me` for downstream route access.

```typescript
const requireClientRole = async (req: any, res: any, next: any) => {
  const me = await storage.getUser(req.userId);
  if (!me) return res.status(401).json({ error: "Unauthorized" });
  if (me.role !== "CLIENT") return res.status(403).json({ error: "Client role required" });
  if (!me.agencyId) return res.status(403).json({ error: "No agency associated" });
  if (!me.clientId) return res.status(403).json({ error: "No client linked." });
  req.me = me;
  next();
};
```

---

## 4. Scoped Portal Endpoints

These endpoints process queries using `req.me.clientId` to ensure that data is scoped correctly:

*   **`/api/client-portal/projects`**: Returns ONLY projects linked to the client's `clientId`.
*   **`/api/client-portal/tasks?projectId=...`**: Fetches tasks for a project board *only* if the project belongs to the client.
*   **`/api/client-portal/files`**: Returns file assets tagged to the client's ID *only* if their context is marked as `CLIENT_FILE`.
*   **`/api/client-portal/channel`**: Fetches or creates a dedicated message channel (`client-portal-<clientId>`) for client-agency communications.

---

## 5. Deliverables Approval Workflow (Client Review)

Clients can participate in design and asset approvals directly from their portal:

1.  **Promoting to Review**: When an internal team member moves a task into a stage where `isClientReview = true`, the task's `reviewStatus` updates to `PENDING`.
2.  **Portal Highlight**: The task appears in the client's portal dashboard marked as "Pending Review".
3.  **Client Sign-off**: The client reviews the deliverable and either approves it or requests changes.
4.  **Review Outcomes**:
    -   **Approved**: The task is updated to `APPROVED` status, recorded in `client_reviews`, and moved to the `Done` column.
    -   **Changes Requested**: The task status updates to `CHANGES_REQUESTED` with a feedback log. The task is returned to the production column (e.g. `In Progress`) for revision.
5.  **Quality Metrics Logging**: Review outcomes are logged to the `quality_events` and `quality_snapshots` tables to audit delivery success rates.
