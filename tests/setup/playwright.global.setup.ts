import { FullConfig } from "@playwright/test";

async function globalSetup(config: FullConfig) {
  // Global setup for Playwright
  // E.g., start a specific test server or database container if not relying on webServer
  console.log("Playwright global setup started...");
  // Set up global test variables if necessary
}

export default globalSetup;
