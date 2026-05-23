# REST API Endpoint Index & Developer Reference

This document covers all REST API endpoints configured inside `server/routes.ts`. Unless marked as **Public**, routes require a valid JSON Web Token (`JWT`) provided in the request headers as `Authorization: Bearer <token>`.

---

## 1. Authentication Endpoints

### Register Account
*   **Method**: `POST`
*   **Path**: `/api/auth/register`
*   **Public**: Yes
*   **Request Body**:
    ```json
    {
      "email": "user@example.com",
      "password": "securepassword123",
      "name": "Alex Mercer",
      "inviteToken": "optional-uuid-token"
    }
    ```
*   **Response (201 Created)**: Returns the generated JWT and a safe user object (excluding the hashed password).

### Login
*   **Method**: `POST`
*   **Path**: `/api/auth/login`
*   **Public**: Yes
*   **Request Body**:
    ```json
    {
      "email": "user@example.com",
      "password": "securepassword123"
    }
    ```
*   **Response (200 OK)**: Returns the generated JWT and a safe user profile.

### Get Current User Profile
*   **Method**: `GET`
*   **Path**: `/api/auth/me`
*   **Response (200 OK)**: Safe profile representation of the current user.

---

## 2. Agency & Team Management

### Get Agency Settings
*   **Method**: `GET`
*   **Path**: `/api/agencies/:id`
*   **Response (200 OK)**: Detailed agency configuration. The requesting user's `agencyId` must match the parameter.

### Update Agency
*   **Method**: `PUT`
*   **Path**: `/api/agencies/:id`
*   **Requirements**: Requesting user must hold the `OWNER` or `ADMIN` role.
*   **Response (200 OK)**: Updated agency profile.

### Invite New Team Member
*   **Method**: `POST`
*   **Path**: `/api/agencies/:agencyId/members/invite`
*   **Requirements**: Requesting user must be an agency admin.
*   **Request Body**:
    ```json
    {
      "email": "newhire@agency.com",
      "role": "TEAM_MEMBER"
    }
    ```
*   **Response (201 Created)**:
    ```json
    {
      "id": "uuid-invitation-id",
      "email": "newhire@agency.com",
      "role": "TEAM_MEMBER",
      "status": "PENDING",
      "token": "generated-secret-token",
      "expiresAt": "2026-05-30T10:00:00.000Z",
      "inviteLink": "http://localhost:5000/login?invite=generated-secret-token"
    }
    ```

### Update Teammate Role
*   **Method**: `PATCH`
*   **Path**: `/api/agencies/:agencyId/members/:userId/role`
*   **Requirements**: Requesting user must be an agency admin. Cannot change owner role.
*   **Request Body**:
    ```json
    {
      "role": "CLIENT",
      "clientId": "optional-client-link-id"
    }
    ```

---

## 3. Client & Brand Kit Management

### List Clients
*   **Method**: `GET`
*   **Path**: `/api/clients`
*   **Query Parameters**:
    -   `agencyId` (Required): Tenant scoped filter.
    -   `status` (Optional): Filter by `ACTIVE`, `PAUSED`, etc.
*   **Response (200 OK)**: Array of client accounts.

### Create Client
*   **Method**: `POST`
*   **Path**: `/api/clients`
*   **Request Body**:
    ```json
    {
      "name": "Acme Corp",
      "slug": "acme",
      "agencyId": "uuid-agency-id"
    }
    ```
*   **Response (201 Created)**: New client profile object.

---

## 4. Project Boards & Columns (Stages)

### List Agency Projects
*   **Method**: `GET`
*   **Path**: `/api/projects`
*   **Query Parameters**:
    -   `agencyId` (Required)
    -   `clientId` / `status` (Optional)

### Create Project Board
*   **Method**: `POST`
*   **Path**: `/api/projects`
*   **Request Body**:
    ```json
    {
      "name": "Acme Website Redesign",
      "description": "Custom site templates and copywriting",
      "agencyId": "uuid-agency-id",
      "clientId": "uuid-client-id"
    }
    ```

### Get Project Kanban Columns
*   **Method**: `GET`
*   **Path**: `/api/projects/:projectId/stages`
*   **Response (200 OK)**: Array of columns ordered by order values.

### Create Kanban Column
*   **Method**: `POST`
*   **Path**: `/api/projects/:projectId/stages`
*   **Request Body**:
    ```json
    {
      "name": "Blocked",
      "color": "#ef4444",
      "order": 5
    }
    ```

---

## 5. Tasks, Assignees & Timesheets

### List Tasks
*   **Method**: `GET`
*   **Path**: `/api/tasks`
*   **Query Parameters**: `agencyId`, `projectId`, `stageId`, `createdById`.

### Create Task
*   **Method**: `POST`
*   **Path**: `/api/tasks`
*   **Request Body**:
    ```json
    {
      "title": "Design Figma Mockups",
      "description": "Include mobile variants",
      "type": "DESIGN",
      "priority": "HIGH",
      "projectId": "uuid-project-id",
      "stageId": "uuid-stage-id",
      "agencyId": "uuid-agency-id",
      "createdById": "uuid-user-id"
    }
    ```

### Update Task (Drag-and-Drop & Inline Editing)
*   **Method**: `PUT`
*   **Path**: `/api/tasks/:id`
*   **Request Body**: Partial object of editable task properties (e.g., `stageId` when drag-and-dropping across columns).

### Assign Teammate to Task
*   **Method**: `POST`
*   **Path**: `/api/tasks/:taskId/assignees`
*   **Request Body**: `{"userId": "uuid-user-id"}`
*   **Response (201 Created)**: Returns assignment details. Automatically emits a WebSocket notification if the assignee is not the active author.

---

## 6. Time & Attendance

### Log Time Entry
*   **Method**: `POST`
*   **Path**: `/api/time-entries`
*   **Request Body**:
    ```json
    {
      "agencyId": "uuid-agency-id",
      "userId": "uuid-user-id",
      "projectId": "uuid-project-id",
      "taskId": "uuid-task-id",
      "startTime": "2026-05-23T08:00:00.000Z",
      "endTime": "2026-05-23T10:00:00.000Z",
      "durationMinutes": 120,
      "note": "Initial brainstorming and sketch layouts",
      "billable": true,
      "source": "TIMER"
    }
    ```

### Clock In (Attendance)
*   **Method**: `POST`
*   **Path**: `/api/attendance/check-in`
*   **Request Body**: `{"notes": "WFH - remote sync"}`
*   **Response (201 Created)**: Creates an attendance record stamped with the current time.

### Clock Out (Attendance)
*   **Method**: `POST`
*   **Path**: `/api/attendance/check-out`
*   **Response (200 OK)**: Staps clock out time, calculates total work minutes, and updates the daily status (e.g., set to `half_day` if total time < 4 hours, else `present`).

---

## 7. Notion Documents (Pages)

### List Pages
*   **Method**: `GET`
*   **Path**: `/api/pages`
*   **Response (200 OK)**: Hierarchy lists representing folders and documents.

### Create Page
*   **Method**: `POST`
*   **Path**: `/api/pages`
*   **Request Body**:
    ```json
    {
      "title": "Style Guide Draft",
      "isFolder": false,
      "parentId": "optional-folder-parent-id"
    }
    ```

### Update Page (Title / Nested Blocks Content)
*   **Method**: `PUT`
*   **Path**: `/api/pages/:id`
*   **Validation**: Enforces cycle prevention when updating `parentId` (walks parent keys to prevent loops).
*   **Request Body**:
    ```json
    {
      "title": "Style Guide Draft (v2)",
      "content": [
        { "id": "block-1", "type": "heading1", "content": "Style Directives" },
        { "id": "block-2", "type": "text", "content": "Acme brand parameters are documented below:" }
      ]
    }
    ```
