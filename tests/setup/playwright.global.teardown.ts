import { FullConfig } from "@playwright/test";

async function globalTeardown(config: FullConfig) {
  // Global teardown for Playwright
  console.log("Playwright global teardown completed.");
}

export default globalTeardown;
