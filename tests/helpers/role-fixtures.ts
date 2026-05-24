import { test as base } from "@playwright/test";

// You can use these fixtures to inject authenticated contexts
// For example: using predefined storage states generated in an auth.setup.ts
export const test = base.extend<{ 
  ownerPage: import("@playwright/test").Page; 
  clientPage: import("@playwright/test").Page; 
}>({
  ownerPage: async ({ browser }, use) => {
    const context = await browser.newContext({ storageState: "playwright/.auth/owner.json" });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
  clientPage: async ({ browser }, use) => {
    const context = await browser.newContext({ storageState: "playwright/.auth/client.json" });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});
