# Decision Log: Workit.OS

## Historic Architectural Decisions

### 1. Token-Based Local Auth (JWT) instead of Firebase
*   **Context**: The initial product summary (`replit.md`) mentions Firebase Authentication as the active session manager. However, the concrete codebase utilizes local database-backed JWT tokens stored inside the browser's `localStorage` as `wk_token`.
*   **Decision**: Opted for a native, self-hosted Express auth engine with `bcryptjs` for password hashing and `jsonwebtoken` for signing Bearer tokens.
*   **Consequences**: 
    - Eliminates external dependencies on Firebase Auth servers, reducing configuration overhead.
    - Fully keeps credential matching and onboarding flows inside the PostgreSQL instance.
    - Simplifies authenticated WebSocket handshakes, as the client can append `?token=<JWT>` to upgrade connections immediately.

### 2. Drizzle ORM over heavy alternatives (e.g., Prisma)
*   **Context**: Building a high-performance web app with frequent aggregate queries (reports, dashboard stats).
*   **Decision**: Chose **Drizzle ORM** for database interaction.
*   **Consequences**:
    - Provides lightweight, high-performance database execution with zero-overhead query compilation.
    - Keeps full SQL capabilities intact, allowing complex custom aggregations (e.g., in reports `/api/reports/overview` using `sql` functions for conditional counting) rather than executing multiple heavy row-fetching passes.
    - Retains full TypeScript type inference out of the box, facilitating rapid schema-to-frontend synchronization.

### 3. Repository Pattern Storage Abstraction (`IStorage`)
*   **Context**: Needed to clean route handlers and prevent inline database query sprawl in the HTTP endpoints file.
*   **Decision**: Abstracted all CRUD and query actions behind a concrete storage adapter interface `IStorage`.
*   **Consequences**:
    - Centralized all database reads and writes in `server/storage.ts`.
    - Isolates route handlers (`server/routes.ts`) to focusing strictly on request validation, authentication checks, real-time broadcasts, and HTTP response assembly.
    - Simplifies mocking database state during unit testing.

### 4. Custom JSONB Representation for Notion Blocks
*   **Context**: Designing the Notion-style document editor.
*   **Decision**: Decided to store document contents inside a single `JSONB` array of blocks on the `pages` (and `blocks` tables) rather than maintaining complex parent-child foreign key mappings for every paragraph and checkbox in separate rows.
*   **Consequences**:
    - Speeds up page reads dramatically: loading a document requires a single row fetch instead of a recursive nested join query across hundreds of block rows.
    - Simplifies document auto-saving: the editor simply serializes the current block array state and executes a single PUT request.
    - Handles diverse block structures (code segments, check lists, callouts with specific borders) elegantly using structured JSON interfaces.

### 5. Whitelist-Based Global Client Gatekeeper
*   **Context**: The requirement of providing client access to deliverables, chat, and files without risking leaks of internal metrics, financial reports, or other client accounts.
*   **Decision**: Implemented a hard, global whitelisting gatekeeper middleware intercepting all `/api/` traffic for client roles, blocking any endpoints not explicitly allowed.
*   **Consequences**:
    - Restricts client interaction exclusively to secure, client-scoped APIs.

### 6. Local PostgreSQL Driver (`postgres.js`) over Serverless (`neondatabase/serverless`)
*   **Context**: The project was originally bootstrapped with `@neondatabase/serverless`. However, local development environments using Dockerized PostgreSQL experienced WebSocket-related TCP socket connection failures (`ECONNREFUSED`).
*   **Decision**: Switched to the standard `postgres.js` and `drizzle-orm/postgres-js` drivers which provide raw, high-performance direct database connections using native TCP sockets.
*   **Consequences**:
    - Removed connection errors entirely on local setups.
    - Improved query execution speed slightly due to the lack of WebSocket wrapper overhead.

### 7. Email-based OTP Verification for New Accounts
*   **Context**: Ensuring the security and ownership of agency accounts.
*   **Decision**: Integrated `resend` to deliver 6-digit OTP codes required during the registration sequence.
*   **Consequences**:
    - Users cannot access the workspace immediately upon sign-up; they must enter the emailed verification code.
    - Validated user identities reduce spam and fake accounts.
