# Technical Context: Workit.OS

## Tech Stack Overview
Workit.OS runs on a modern, robust JavaScript/TypeScript stack designed for rapid development, strict type safety, and efficient deployment.

| Layer | Technology | Key Purpose |
| :--- | :--- | :--- |
| **Frontend Framework** | React 18 (TypeScript) | Reactive UI, hooks, and component structures. |
| **Frontend Routing** | Wouter | Lightweight, high-performance client-side router. |
| **State & Fetching** | TanStack Query v5 | Server state management, auto-caching, mutation states. |
| **Styling** | Tailwind CSS | Utility-first CSS styling, custom glassmorphic properties. |
| **Component Primitives**| Radix UI | Accessible headless widgets (Dialogs, Dropdowns, Tabs). |
| **Backend Server** | Express.js | Core web server, REST API routing, session management. |
| **Database** | PostgreSQL | Relational database schema with robust constraints and JSONB support. |
| **ORM** | Drizzle ORM | High-performance, type-safe database mapping and query engine. |
| **WebSocket** | WebSocket (ws library) | Dual-channel real-time notifications and messaging. |

---

## Technical Specifications & Configuration

### Key Environment Variables
To run Workit.OS securely, the following environment variables are required in the server runtime:

| Variable | Description | Default / Example Value |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string | `postgres://user:pass@host:port/dbname` |
| `JWT_SECRET` | Secret key to sign authorization tokens | *(Must be a long random string in production)* |
| `NODE_ENV` | Running mode context | `development` \| `production` |
| `PORT` | Listening port for the application | `5000` |

---

## Development & Build Toolchain

### Package Scripts
The following command scripts are configured in `package.json`:

*   **`npm run dev`**: Launches the local development environment using `tsx` (TypeScript Execute) to hot-reload the Express server, while Vite acts as the dev-middleware proxying requests.
*   **`npm run build`**: Compiles the React production bundle (`vite build`) and bundles the server-side TypeScript code using `esbuild` into high-performance ESM bundles inside the `dist/` directory.
*   **`npm run start`**: Runs the compiled server-side entry-point (`dist/index.js`) in a production environment context.
*   **`npm run check`**: Executes the TypeScript compiler (`tsc`) to verify type safety across client and server files without emitting build files.
*   **`npm run db:push`**: Uses `drizzle-kit push` to synchronize local schema definitions in `shared/schema.ts` directly with the PostgreSQL database.

---

## Database Configuration & Schemas

### Drizzle Configuration (`drizzle.config.ts`)
The project utilizes `drizzle-kit` for schema introspection and pushing changes. The config file targets the schema file in the shared directory and maps output changes.

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

### Relational Schema Blueprint
- **Primary Auth & Workspace**: `users` (linked to `agencies` and `clients`), `agencies` (linked to `users` as owners).
- **Core Operations**: `clients`, `client_contacts`, `client_portal_users`, `projects`, `project_members`, `project_stages`, `tasks`, `task_assignees`, `subtasks`, `task_dependencies`.
- **Content & Notation**: `pages` (Notion docs), `blocks` (Rich-text elements linked to pages, tasks, or projects), `tags`, `task_tags`, `file_assets` (uploads).
- **Tracking & Productivity**: `time_entries` (timesheets), `attendance_records` (clock-ins).
- **Communication & Notifications**: `chat_channels`, `chat_messages`, `notifications`, `notification_preferences`, `activity_logs`.
- **Quality & Metrics**: `client_reviews` (PM sign-offs), `quality_events` (audited errors), `quality_snapshots` (aggregate scores).
- **Automation & Integrations**: `automation_rules` (triggers), `automation_runs` (logs).

---

## Third-Party & External Integrations
The application is pre-configured to interact with the following corporate APIs (mapped in dependencies):
1. **Notion Client (`@notionhq/client`)**: Integrates and imports structural task/page lists from external Notion workspaces.
2. **PostgreSQL Provider (Neon Serverless)**: Uses `@neondatabase/serverless` for optimized connection pools in serverless backend runs.
