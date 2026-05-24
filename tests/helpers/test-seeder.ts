import { db } from "../../server/db";
import { agencies, users, clients, clientPortalUsers } from "@shared/schema";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { resetDatabase } from "./db";

/**
 * Seeds a minimal testing environment tailored for E2E tests and auth generation.
 * This should be invoked by `playwright.global.setup.ts`.
 */
export async function seedTestEnvironment() {
  console.log("Seeding test database...");
  await resetDatabase();
  
  const agencyId = randomUUID();
  const ownerId = randomUUID();
  const clientId = randomUUID();
  const clientUserId = randomUUID();

  // Fast hash for tests
  const passwordHash = await bcrypt.hash("password123", 10);

  // 1. Create Agency
  await db.insert(agencies).values({
    id: agencyId,
    name: "E2E Test Agency",
    slug: "e2e-test-agency",
  });

  // 2. Create Owner User
  await db.insert(users).values({
    id: ownerId,
    agencyId,
    email: "owner@example.com",
    name: "E2E Owner",
    role: "OWNER",
    passwordHash,
    status: "ACTIVE",
    emailVerified: true,
  });

  // Update agency owner
  await db.update(agencies).set({ ownerId }).where({ id: agencyId } as any);

  // 3. Create Client Entity
  await db.insert(clients).values({
    id: clientId,
    agencyId,
    name: "E2E Test Client",
    email: "client@example.com",
    status: "ACTIVE",
    portalEnabled: true,
  });

  // 4. Create Client User Profile (for auth)
  await db.insert(users).values({
    id: clientUserId,
    agencyId,
    email: "client@example.com",
    name: "E2E Client",
    role: "CLIENT",
    passwordHash,
    status: "ACTIVE",
    emailVerified: true,
  });

  // 5. Link Client Portal User
  await db.insert(clientPortalUsers).values({
    id: randomUUID(),
    agencyId,
    clientId,
    userId: clientUserId,
    email: "client@example.com",
    name: "E2E Client",
    status: "ACTIVE",
  });

  console.log("Test database seeded successfully!");
  
  return { agencyId, ownerId, clientId, clientUserId };
}
