import { expect } from "@playwright/test";
import { test } from "../../helpers/role-fixtures";
import AxeBuilder from "@axe-core/playwright";

test.describe("Accessibility Smoke Tests", () => {
  // We use AxeBuilder to run WCAG checks.
  // We only fail on critical or serious impact issues to avoid too much noise initially.

  test("Login page should not have critical a11y violations", async ({ page }) => {
    await page.goto("/login");
    await page.waitForSelector("form");

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    const criticalIssues = accessibilityScanResults.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );

    expect(criticalIssues).toEqual([]);
  });

  test("Dashboard page should not have critical a11y violations", async ({ ownerPage }) => {
    await ownerPage.goto("/dashboard");
    await ownerPage.waitForSelector("#root > div", { state: "attached" });

    const accessibilityScanResults = await new AxeBuilder({ page: ownerPage })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    const criticalIssues = accessibilityScanResults.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );

    expect(criticalIssues).toEqual([]);
  });

  test("Client portal should not have critical a11y violations", async ({ clientPage }) => {
    await clientPage.goto("/client-portal");
    await clientPage.waitForSelector("#root > div", { state: "attached" });

    const accessibilityScanResults = await new AxeBuilder({ page: clientPage })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    const criticalIssues = accessibilityScanResults.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );

    expect(criticalIssues).toEqual([]);
  });
});
