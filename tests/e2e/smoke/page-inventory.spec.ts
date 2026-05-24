import { expect } from "@playwright/test";
import { test } from "../../helpers/role-fixtures";
import { APP_ROUTES } from "../../helpers/route-inventory";

test.describe("Page Smoke Tests - Unauthenticated", () => {
  for (const route of APP_ROUTES.public) {
    test(`Route ${route} should load successfully`, async ({ page }) => {
      await page.goto(route);
      // Wait for React to render something
      await page.waitForSelector("#root > div", { state: "attached", timeout: 15000 });
      // Ensure no generic 404 or crash text
      const textContent = await page.textContent("body");
      expect(textContent).not.toMatch(/Application error/i);
    });
  }
});

test.describe("Page Smoke Tests - Authenticated (Owner)", () => {
  for (const route of APP_ROUTES.protected) {
    test(`Route ${route} should load successfully for Owner`, async ({ ownerPage }) => {
      await ownerPage.goto(route);
      await ownerPage.waitForSelector("#root > div", { state: "attached", timeout: 15000 });
      
      const url = ownerPage.url();
      // Ensure we didn't get redirected to login (auth worked)
      expect(url).toContain(route);
      
      const textContent = await ownerPage.textContent("body");
      expect(textContent).not.toMatch(/Application error/i);
    });
  }
});

test.describe("Page Smoke Tests - Client Portal", () => {
  for (const route of APP_ROUTES.clientPortal) {
    test(`Route ${route} should load successfully for Client`, async ({ clientPage }) => {
      await clientPage.goto(route);
      await clientPage.waitForSelector("#root > div", { state: "attached", timeout: 15000 });
      
      const url = clientPage.url();
      expect(url).toContain(route);
      
      const textContent = await clientPage.textContent("body");
      expect(textContent).not.toMatch(/Application error/i);
    });
  }
});
