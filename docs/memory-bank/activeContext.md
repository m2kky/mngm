# Active Context: Workit.OS

## Current Work Context
Workit.OS is a mature, production-ready marketing agency operating system featuring drag-and-drop Kanban boards, full-featured Notion-style document editing, persistent timesheets, real-time message chat, security-hardened client portal views, and comprehensive aggregate reports. 

The codebase has been designed with excellent modularity:
- **Backend separation**: Router endpoints are separated from database interactions via a strict Storage adapter interface.
- **Frontend separation**: State is split neatly between local UI Contexts and server caches synced through TanStack Query.
- **Unified Schema definitions**: Standard types, insert validation objects, and schemas are defined in a central shared library.

---

## Codebase Orientation

```
mngm/
├── client/                 # React 18 frontend code
│   ├── src/
│   │   ├── components/     # UI, Editors, Layouts, detail drawers
│   │   ├── contexts/       # Auth, Theme, Sidebar providers
│   │   ├── hooks/          # Custom hooks (Auth, Toast, etc.)
│   │   ├── lib/            # Queries, keyboard shortcuts config
│   │   ├── pages/          # Primary application page modules
│   │   ├── App.tsx         # Root routes and providers layout
│   │   └── main.tsx        # React client entry point
├── server/                 # Express backend server code
│   ├── cache.ts            # Report cache implementation
│   ├── db-storage.ts       # Database CRUD queries (unused - backup)
│   ├── db.ts               # Drizzle connection setup
│   ├── index.ts            # Main application boot and listener
│   ├── routes.ts           # Unified API routers and WS brokers
│   ├── storage.ts          # Concrete repository DrizzleStorage
│   └── vite.ts             # Dev proxy asset server middleware
├── shared/                 # Shared validation types
│   └── schema.ts           # PostgreSQL Drizzle database tables
```

---

## Active Development Guidelines

### 1. Database Schema Synchronization
When adding fields or tables to `@shared/schema`:
- Modify table properties in `shared/schema.ts`.
- Ensure appropriate Zod validation schemas are exported via `createInsertSchema`.
- Run database pushes immediately using:
  ```bash
  npm run db:push
  ```
- Update concrete storage methods inside `server/storage.ts` to implement any new CRUD signatures required by changes.

### 2. Strict Scoping Constraints
When building new API endpoints in `server/routes.ts`:
- **Never trust user IDs sent directly in request bodies**. Always authorize requests with `requireAuth` and extract the validated user ID from `req.userId`.
- Always verify tenant boundaries (`agencyId` matching). Intercept invalid operations with a `403 Forbidden` rather than allowing cross-tenant modifications.
- Protect internal operational endpoints from `CLIENT` roles. Register new routes in logical segments of the routes file and ensure whitelists in the global client guard are maintained accurately.

### 3. Real-Time Broadcaster Registration
When introducing actions that other team members should witness live (e.g., updating a project, adding a checklist, moving an asset):
- Emit structured notifications via the WebSocket server in `routes.ts`:
  ```typescript
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(JSON.stringify({ type: "your_event_type", data }));
    }
  });
  ```
- Ensure clients listening for updates can capture the event types safely inside their custom React Query hook invalidations.
