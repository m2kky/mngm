import { test as setup, expect } from "@playwright/test";
import { seedTestEnvironment } from "../../helpers/test-seeder";
import path from "path";
import fs from "fs";
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authDir = path.join(__dirname, "../../../playwright/.auth");
if (!fs.existsSync(authDir)) {
  fs.mkdirSync(authDir, { recursive: true });
}

const ownerFile = path.join(authDir, "owner.json");
const clientFile = path.join(authDir, "client.json");

/**
 * Playwright setup project that runs before E2E tests.
 * 
 * Flow:
 * 1. Seeds the Testcontainers isolated DB with initial test users/roles.
 * 2. Simulates login for the 'Owner' role and saves the browser storage state.
 * 3. Clears storage (cookies + localStorage) to prevent session overlap.
 * 4. Simulates login for the 'Client' role and saves its state.
 * 
 * Subsequent tests can use these saved states to skip the login UI.
 */
setup("authenticate and save states", async ({ page }) => {
  // 1. Seed database with E2E users
  await seedTestEnvironment();

  // 2. Login as Owner
  console.log("Logging in as Owner...");
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('response', response => console.log('RESPONSE:', response.url(), response.status()));

  await page.goto("/login");
  await page.fill('input[type="email"]', "owner@example.com");
  await page.fill('input[type="password"]', "password123");
  await page.click('button[type="submit"]');
  // Wait for redirect to dashboard
  await page.waitForURL("**/dashboard", { timeout: 10000 });
  // Save Owner session state to a file
  await page.context().storageState({ path: ownerFile });
  
  // Important: Clear browser storage (cookies, localStorage, sessionStorage) 
  // before the next login to ensure the app doesn't immediately redirect 
  // using the previous JWT token, preventing the Client login.
  await page.context().clearCookies();
  await page.evaluate(() => window.localStorage.clear());
  await page.evaluate(() => window.sessionStorage.clear());

  // 3. Login as Client
  console.log("Logging in as Client...");
  await page.goto("/login");
  await page.fill('input[type="email"]', "client@example.com");
  await page.fill('input[type="password"]', "password123");
  await page.click('button[type="submit"]');
  // Wait for redirect to client-portal
  await page.waitForURL("**/client-portal", { timeout: 10000 });
  await page.context().storageState({ path: clientFile });
});
