import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { execSync } from "child_process";

export async function setup() {
  if (process.env.USE_TESTCONTAINERS === "true") {
    console.log("Starting PostgreSQL Testcontainer for Vitest...");
    const container = await new PostgreSqlContainer("postgres:15-alpine").start();
    
    // Inject the URI for drizzle and supertest
    process.env.DATABASE_URL = container.getConnectionUri();
    
    console.log(`Testcontainer started at ${process.env.DATABASE_URL}`);
    console.log("Pushing database schema...");
    execSync("npm run db:push", { env: process.env, stdio: "inherit" });
    
    // Store globally so teardown can stop it
    (globalThis as any).__TESTCONTAINER__ = container;
  }
}

export async function teardown() {
  const container = (globalThis as any).__TESTCONTAINER__;
  if (container) {
    console.log("Stopping PostgreSQL Testcontainer...");
    await container.stop();
  }
}
