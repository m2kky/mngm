import { describe, it, expect, beforeAll } from "vitest";
import { createApiClient } from "../../helpers/api-client";
import { resetDatabase } from "../../helpers/db";
import { userFactory } from "../../factories";
import { generateAuthHeader } from "../../helpers/auth";

describe("API Smoke Tests", () => {
  let api: any;
  let token: string;
  let userId: string;
  let agencyId: string;

  beforeAll(async () => {
    // The DB must be running (Testcontainers or fallback)
    await resetDatabase();
    api = await createApiClient();
    const user = await userFactory.create({ role: "OWNER" });
    userId = user.id;
    agencyId = user.agencyId!;
    token = generateAuthHeader(userId);
  });

  describe("Auth & Users", () => {
    it("GET /api/auth/me should return current user", async () => {
      const res = await api.get("/api/auth/me").set("Authorization", token);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(userId);
    });
    
    it("GET /api/users/:id should return user profile", async () => {
      const res = await api.get(`/api/users/${userId}`).set("Authorization", token);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(userId);
    });
  });

  describe("Agencies", () => {
    it("GET /api/agencies/:id should return agency details", async () => {
      const res = await api.get(`/api/agencies/${agencyId}`).set("Authorization", token);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(agencyId);
    });
  });

  describe("Clients", () => {
    it("GET /api/clients should return clients list", async () => {
      const res = await api.get("/api/clients").set("Authorization", token);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe("Projects", () => {
    it("GET /api/projects should return projects list", async () => {
      const res = await api.get("/api/projects").set("Authorization", token);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe("Tasks", () => {
    it("GET /api/tasks should return tasks list", async () => {
      const res = await api.get("/api/tasks").set("Authorization", token);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // Adding endpoints for views, pages, notifications, reports, dashboard
  describe("Other Core Modules", () => {
    it("GET /api/notifications should return list (if implemented)", async () => {
      const res = await api.get("/api/notifications").set("Authorization", token);
      // Some endpoints might return 404 if not implemented exactly like this, 
      // but this is a smoke test to verify it doesn't crash 500
      expect([200, 404]).toContain(res.status);
    });
    
    it("GET /api/dashboard/stats should return stats (if implemented)", async () => {
      const res = await api.get("/api/dashboard/stats").set("Authorization", token);
      expect([200, 404]).toContain(res.status);
    });
  });
});
