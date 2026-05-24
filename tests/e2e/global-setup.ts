import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { DefaultLogger, LogWriter } from "drizzle-orm/logger";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { resolve } from "path";
import fs from "fs";
import { execSync, spawn } from "child_process";

/**
 * Global setup for Playwright E2E tests.
 * This script bootstraps an isolated PostgreSQL database using Testcontainers,
 * pushes the Drizzle schema, and launches the Vite development server connected
 * to the isolated database. This ensures tests run in a clean, reproducible environment.
 */
export default async function globalSetup() {
  // 1. Start an isolated PostgreSQL container for E2E tests
  console.log("Starting PostgreSQL Testcontainer for Playwright...");
  const container = await new PostgreSqlContainer("postgres:15-alpine")
    .withDatabase("mngm_test")
    .withUsername("test")
    .withPassword("test")
    .start();

  const uri = container.getConnectionUri();
  console.log(`Testcontainer started at ${uri}`);

  process.env.DATABASE_URL = uri;
  process.env.NODE_ENV = "test";

  // 2. Synchronize the database schema using Drizzle Kit
  console.log("Pushing database schema for E2E...");
  try {
    execSync("npx drizzle-kit push", { env: { ...process.env, DATABASE_URL: uri }, stdio: "inherit" });
    console.log("Schema pushed successfully");
  } catch (err) {
    console.error("Failed to push schema:", err);
    throw err;
  }

  // 3. Start the application backend and Vite server
  console.log("Starting web server for E2E tests...");
  const serverProcess = spawn("npm", ["run", "dev"], {
    env: { ...process.env, DATABASE_URL: uri },
    stdio: "pipe",
    shell: true,
  });

  serverProcess.stdout.on("data", (data) => {
    // console.log(data.toString());
  });
  
  // 4. Wait for the server to be ready and listening on port 5000
  console.log("Waiting for server to be ready on port 5000...");
  await new Promise<void>((resolve, reject) => {
    let output = "";
    serverProcess.stdout.on("data", (data) => {
      output += data.toString();
      if (output.includes("serving on port 5000") || output.includes("http://localhost:5000")) {
        resolve();
      }
    });
    serverProcess.stderr.on("data", (data) => {
      // console.error(data.toString());
    });
    // Timeout after 30 seconds
    setTimeout(() => {
      reject(new Error("Timeout waiting for server to start"));
    }, 30000);
  });

  console.log("Web server is ready!");

  // 5. Return a teardown function that Playwright will execute after all tests finish
  return async () => {
    console.log("Stopping web server and PostgreSQL Testcontainer...");
    serverProcess.kill();
    await container.stop();
  };
}
