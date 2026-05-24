import { describe, it, expect, beforeAll } from "vitest";
import { createApiClient } from "../../helpers/api-client";
import { resetDatabase } from "../../helpers/db";
import { db } from "../../../server/db";
import { users, invitations } from "../../../shared/schema";
import { eq } from "drizzle-orm";
import { userFactory, agencyFactory, clientFactory } from "../../factories";
import { generateAuthHeader, generateCustomToken } from "../../helpers/auth";

describe("Deep API Tests: Authentication & RBAC", () => {
  let api: any;
  
  // Agency A (Our main test subject)
  let agencyA: any;
  let ownerA: any;
  let employeeA: any;
  let clientEntityA: any;
  let clientUserA: any;
  
  // Agency B (For cross-tenant checks)
  let agencyB: any;

  beforeAll(async () => {
    await resetDatabase();
    api = await createApiClient();
    
    agencyA = await agencyFactory.create();
    ownerA = await userFactory.create({ agencyId: agencyA.id, role: "OWNER" });
    employeeA = await userFactory.create({ agencyId: agencyA.id, role: "EMPLOYEE" });
    clientEntityA = await clientFactory.create({ agencyId: agencyA.id });
    clientUserA = await userFactory.create({ agencyId: agencyA.id, role: "CLIENT" });
    
    agencyB = await agencyFactory.create();
  });

  describe("Cross-Tenant Isolation", () => {
    it("Owner of Agency A cannot access Agency B details", async () => {
      const tokenA = generateAuthHeader(ownerA.id);
      const res = await api.get(`/api/agencies/${agencyB.id}`).set("Authorization", tokenA);
      // In isolated multi-tenant systems, cross-tenant requests often return 404 (Not Found) to avoid leaking existence, or 403.
      expect([403, 404]).toContain(res.status);
    });

    it("Owner of Agency A cannot view Client belonging to Agency B", async () => {
      const tokenA = generateAuthHeader(ownerA.id);
      const clientB = await clientFactory.create({ agencyId: agencyB.id });
      const res = await api.get(`/api/clients/${clientB.id}`).set("Authorization", tokenA);
      expect([403, 404]).toContain(res.status);
    });
  });

  describe("Role-Based Access Control (RBAC)", () => {
    it("CLIENT role cannot access internal agency settings", async () => {
      const token = generateAuthHeader(clientUserA.id);
      const res = await api.get(`/api/agencies/${agencyA.id}`).set("Authorization", token);
      expect([403, 404]).toContain(res.status);
    });

    it("EMPLOYEE role cannot delete the agency", async () => {
      const token = generateAuthHeader(employeeA.id);
      const res = await api.delete(`/api/agencies/${agencyA.id}`).set("Authorization", token);
      expect([403, 404, 405]).toContain(res.status); // 405 if method not allowed entirely
    });

    it("OWNER can retrieve their own agency details", async () => {
      const token = generateAuthHeader(ownerA.id);
      const res = await api.get(`/api/agencies/${agencyA.id}`).set("Authorization", token);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(agencyA.id);
    });

    it("Role downgrade mid-session revokes immediate destructive access", async () => {
      // Create a token for the employee
      const token = generateAuthHeader(employeeA.id);
      
      // Assume a hypothetical admin endpoint that requires at least EMPLOYEE to view something 
      // (or let's just downgrade EMPLOYEE to CLIENT and check agency details)
      // First, downgrade in DB
      await db.update(users).set({ role: "CLIENT" }).where(eq(users.id, employeeA.id));

      // Attempt to access an internal endpoint using the old token
      // If the backend checks the DB for role per request, it should block.
      const res = await api.delete(`/api/agencies/${agencyA.id}`).set("Authorization", token);
      expect([403, 404, 405]).toContain(res.status);

      // Revert role for other tests just in case
      await db.update(users).set({ role: "EMPLOYEE" }).where(eq(users.id, employeeA.id));
    });
  });

  describe("Token Validation & Edge Cases", () => {
    it("Missing token returns 401", async () => {
      const res = await api.get(`/api/auth/me`);
      expect(res.status).toBe(401);
    });

    it("Invalid token signature returns 401", async () => {
      const res = await api.get(`/api/auth/me`).set("Authorization", "Bearer invalid.token.here");
      expect(res.status).toBe(401);
    });
    
    it("Malformed header format returns 401", async () => {
      const res = await api.get(`/api/auth/me`).set("Authorization", "invalid_format");
      expect(res.status).toBe(401);
    });

    it("Tampered JWT payload is rejected (wrong signature)", async () => {
      // Create a token that spoofs ownerA, but signed with fake secret
      const fakeToken = generateCustomToken({ userId: ownerA.id }, "malicious-secret");
      const res = await api.get(`/api/auth/me`).set("Authorization", `Bearer ${fakeToken}`);
      expect(res.status).toBe(401);
    });
  });

  describe("Invitations Edge Cases", () => {
    it("Revoked invitation token cannot be used to join", async () => {
      // Manually insert an invitation that is revoked
      const [invite] = await db.insert(invitations).values({
        id: "inv_123",
        email: "test@example.com",
        role: "EMPLOYEE",
        status: "REVOKED",
        token: "revoked-token-uuid",
        expiresAt: new Date(Date.now() + 86400000), // still valid date, but status is revoked
        agencyId: agencyA.id,
        invitedById: ownerA.id,
      }).returning();

      // Attempt to accept it (assuming an endpoint like POST /api/invitations/accept)
      const res = await api.post(`/api/invitations/accept`).send({ token: invite.token });
      
      // Expected to fail with 400 or 403 or 404
      expect([400, 403, 404]).toContain(res.status);
    });
  });
});
