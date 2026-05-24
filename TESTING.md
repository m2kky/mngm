# Testing Architecture & Guidelines

This document outlines the testing strategy for the platform. We employ a multi-layered testing architecture to ensure high quality, maintainability, and confidence in the system.

## 🏗️ Testing Layers

1. **Unit & Integration Tests (Vitest)**
   - **Environment:** Node for API/Backend, jsdom for Frontend components.
   - **Framework:** Vitest
   - **Mocking:** MSW (Mock Service Worker) for API interception.

2. **End-to-End (E2E) & Smoke Tests (Playwright)**
   - **Framework:** Playwright
   - **Goal:** Verify full user journeys and critical paths.
   - **Roles:** `Owner`, `Client`, etc. (using Playwright storage states).
   - **A11y:** Integrated with `@axe-core/playwright`.

3. **Database Integration (Testcontainers)**
   - **Tool:** `@testcontainers/postgresql`
   - **Goal:** Spin up a real, isolated PostgreSQL database for test suites to prevent data pollution.

4. **Visual & UI Components (Storybook + Chromatic)**
   - **Framework:** Storybook
   - **Goal:** Component driven development and visual regression.

5. **Performance & Load Testing (k6 + Lighthouse)**
   - **Framework:** k6 for API load, Lighthouse for frontend performance.
   - **Goal:** Ensure system remains responsive under heavy load.

6. **Mutation Testing (Stryker)**
   - **Framework:** Stryker
   - **Goal:** Verify the quality of the tests by injecting mutants into the codebase.

## 🚀 Running Tests

### Available Commands

| Command | Description |
|---|---|
| `npm run test` | Run Vitest in default mode. |
| `npm run test:unit` | Run unit tests using Vitest. |
| `npm run test:integration` | Run integration tests using Vitest. |
| `npm run test:e2e` | Run Playwright E2E tests headless. |
| `npm run test:e2e:ui` | Run Playwright E2E tests in UI mode. |
| `npm run test:a11y` | Run Playwright Accessibility smoke tests. |
| `npm run storybook` | Start Storybook server locally (Port 6006). |
| `npm run test:chromatic` | Deploy UI to Chromatic for Visual Regression (Requires token). |
| `npm run test:load` | Run k6 load tests. |
| `npm run test:lighthouse` | Run Lighthouse performance audits. |
| `npm run test:mutation` | Run Stryker mutation tests. |
| `npm run test:all` | Run all local tests. |
| `npm run test:ci` | Run all CI-required tests and coverage. |

## 📦 Database & Environments

### Testcontainers vs Local Database
The precedence for the database connection during integration tests is as follows:
1. **`USE_TESTCONTAINERS=true`**: This is the **default for CI** and recommended for robust local integration suites. It spawns an isolated PostgreSQL container via Testcontainers.
2. **`DATABASE_URL` (Fallback)**: If Testcontainers is disabled, the system falls back to the local `DATABASE_URL` provided in `.env.test`.

### Reset Strategy
Database resets are crucial for test isolation but can heavily impact performance. Our strategy is:
- **Smoke/Integration Suites**: We reset the database **once per suite** (e.g., using `beforeAll`). We rely on `TRUNCATE CASCADE` via the `resetDatabase()` helper.
- **Stateful/Complex Tests**: If a specific test aggressively mutates shared state, invoke `resetDatabase()` in `beforeEach` or `afterEach` strictly for that test block to avoid slowing down the entire suite.

### Factories (Fishery)
We use **Fishery** for generating domain entities (`tests/factories/index.ts`). Factories support rich outputs from minimal inputs and can resolve missing dependencies automatically when required.

```typescript
import { taskFactory } from "../../factories";

// 1. Build an object in memory (No DB inserts)
const taskData = taskFactory.build();

// 2. Create and persist to DB (Automatically resolves missing Agency, Project, User, Stage)
const task = await taskFactory.create(); 

// 3. Create with explicit overrides (Reuses existing entities instead of generating new ones)
const taskWithOverrides = await taskFactory.create({ 
  projectId: existingProject.id,
  agencyId: existingAgency.id 
});
```

## 🔐 E2E Authentication

Playwright uses a global setup script (`tests/e2e/auth/auth.setup.ts`) to manage authentication cleanly and reduce flakiness:
1. **Seed**: The setup script seeds the DB with baseline test users.
2. **UI Login**: It navigates to the `/login` endpoint and performs a real UI login flow.
3. **Storage State**: The resulting cookies/tokens are captured into a `storageState` JSON file.

Tests can then leverage these pre-authenticated pages instantly using our custom `role-fixtures`:
```typescript
import { test } from "../../helpers/role-fixtures";

test("Owner sees dashboard", async ({ ownerPage }) => {
  await ownerPage.goto("/dashboard");
  // ...
});
```

## 🧭 Route Inventory
For Smoke tests, we maintain `tests/helpers/route-inventory.ts` which categorizes routes to ensure proper access controls and prevent unexpected crashes (500s or 404s). The inventory categorizes routes into:
- **Public Routes**: (e.g., `/login`)
- **Protected Routes (Admin/Owner)**: (e.g., `/dashboard`, `/settings`)
- **Client-Only Routes**: (e.g., `/client-portal`)

## 🎨 Visual Regression & QA Policies

### Visual Snapshots (Chromatic)
When pushing to Chromatic, ensure components follow a clear naming convention in Storybook (e.g., `UI/Button`, `Features/Tasks/TaskCard`) to prevent chaotic snapshot libraries.
*Note: The `test:chromatic` command currently acts as a placeholder setup. To activate it in CI, obtain the `CHROMATIC_PROJECT_TOKEN` and add it to your CI environment variables.*

### Playwright Artifacts Policy
In CI environments, Playwright is configured to retain screenshots and traces **only on failure** to optimize storage and debugging efficiency.

### Accessibility (A11y) Severity Policy
Our automated `axe-core` tests enforce a strict policy on **critical** and **serious** violations, which will fail the build. Moderate warnings are reported but permitted temporarily.

### Upcoming QA Scope
- **API Contract Scope**: For stable endpoints, schema/contract checks will be integrated.
- **WebSocket Smoke**: Minimal realtime smoke tests will be introduced to verify ws connections and payload broadcasting.
