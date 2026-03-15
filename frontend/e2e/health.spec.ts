import { test, expect } from "@playwright/test";
import { mockApi } from "./fixtures";

test.describe("health module", () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
    await page.goto("/health");
  });

  test("shows summary cards with data from all modules", async ({ page }) => {
    // Verify all three cards render with titles
    await expect(page.getByRole("button", { name: "Firewall" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Topology" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Metrics" })).toBeVisible();
    // Verify some actual data renders (zone pair count from firewall)
    await expect(page.getByText("4")).toBeVisible();
  });

  test("summary card click navigates to firewall module", async ({ page }) => {
    await page.getByRole("button", { name: "Firewall" }).click();
    await expect(page).toHaveURL(/\/firewall/);
  });

  test("summary card click navigates to topology module", async ({ page }) => {
    await page.getByRole("button", { name: "Topology" }).click();
    await expect(page).toHaveURL(/\/topology/);
  });

  test("summary card click navigates to metrics module", async ({ page }) => {
    await page.getByRole("button", { name: "Metrics" }).click();
    await expect(page).toHaveURL(/\/metrics/);
  });

  test("shows AI setup message when AI not configured", async ({ page }) => {
    await expect(page.getByText("Configure an AI provider")).toBeVisible();
  });

  test("shows analyze button when AI is configured", async ({ page }) => {
    // Re-mock with AI configured
    await page.route("**/api/settings/ai", (route) =>
      route.fulfill({ json: { base_url: "http://test.com", model: "gpt-4o", provider_type: "openai", has_key: true, key_source: "db", source: "db" } }),
    );
    await page.goto("/health");
    await expect(page.getByRole("button", { name: "Analyze Site Health" })).toBeVisible();
  });

  test("analyze button triggers analysis and shows findings", async ({ page }) => {
    // Mock AI as configured
    await page.route("**/api/settings/ai", (route) =>
      route.fulfill({ json: { base_url: "http://test.com", model: "gpt-4o", provider_type: "openai", has_key: true, key_source: "db", source: "db" } }),
    );
    await page.goto("/health");

    await page.getByRole("button", { name: "Analyze Site Health" }).click();

    // Should show findings
    await expect(page.getByText("IoT zone broad egress with no monitoring")).toBeVisible();
    await expect(page.getByText("Guest network isolation gap")).toBeVisible();
    // Should show severity grouping
    await expect(page.getByText("high (1)")).toBeVisible();
    await expect(page.getByText("medium (1)")).toBeVisible();
    // Should show Re-analyze button
    await expect(page.getByRole("button", { name: "Re-analyze" })).toBeVisible();
  });

  test("finding click navigates to affected module", async ({ page }) => {
    // Setup AI analysis
    await page.route("**/api/settings/ai", (route) =>
      route.fulfill({ json: { base_url: "http://test.com", model: "gpt-4o", provider_type: "openai", has_key: true, key_source: "db", source: "db" } }),
    );
    await page.goto("/health");
    await page.getByRole("button", { name: "Analyze Site Health" }).click();
    await expect(page.getByText("IoT zone broad egress")).toBeVisible();

    // Click the finding -- should deep-link to the firewall graph view
    await page.getByText("IoT zone broad egress").click();
    await expect(page).toHaveURL(/\/firewall/);
    // Deep-link param is consumed and URL cleaned, but graph view should open
    await expect(page.getByRole("button", { name: "Back to matrix" })).toBeVisible();
  });

  test("auto-refresh label is shown", async ({ page }) => {
    await expect(page.getByText("Auto-refreshes every 60s")).toBeVisible();
  });
});
