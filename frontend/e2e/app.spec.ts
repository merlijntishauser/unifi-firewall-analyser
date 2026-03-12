import { test, expect } from "@playwright/test";
import { mockApi } from "./fixtures";

/** Wait for the matrix to be visible by checking for a row header. */
async function waitForMatrix(page: import("@playwright/test").Page) {
  await expect(page.getByTestId("row-header-zone-external")).toBeVisible();
}

/** Click a matrix cell that has rules (non-empty). */
async function clickCell(page: import("@playwright/test").Page) {
  // Find first cell that has rules (contains a number, not a dash)
  const cells = page.getByTestId("matrix-cell");
  const count = await cells.count();
  for (let i = 0; i < count; i++) {
    const text = await cells.nth(i).innerText();
    if (/\d/.test(text)) {
      await cells.nth(i).click();
      return;
    }
  }
  throw new Error("No matrix cell with rules found");
}

test.describe("login", () => {
  test("shows login screen when not authenticated", async ({ page }) => {
    await mockApi(page, { authenticated: false });
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Connect to UniFi Controller" })).toBeVisible();
    await expect(page.getByLabel("Controller URL")).toBeVisible();
    await expect(page.getByLabel("Username")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Connect" })).toBeVisible();
  });

  test("login flow navigates to matrix", async ({ page }) => {
    await mockApi(page, { authenticated: false });
    await page.goto("/");

    await page.getByLabel("Controller URL").fill("https://192.168.1.1");
    await page.getByLabel("Username").fill("admin");
    await page.getByLabel("Password").fill("password");
    await page.getByRole("button", { name: "Connect" }).click();

    // After login, matrix should appear with zone row headers
    await waitForMatrix(page);
    await expect(page.getByTestId("row-header-zone-internal")).toBeVisible();
    await expect(page.getByTestId("row-header-zone-guest")).toBeVisible();
  });
});

test.describe("matrix view", () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
    await page.goto("/");
    await waitForMatrix(page);
  });

  test("shows zone matrix with headers", async ({ page }) => {
    await expect(page.getByTestId("row-header-zone-internal")).toBeVisible();
    await expect(page.getByTestId("row-header-zone-guest")).toBeVisible();
    await expect(page.getByTestId("row-header-zone-iot")).toBeVisible();
    await expect(page.getByTestId("col-header-zone-external")).toBeVisible();
  });

  test("click cell opens graph view with rule panel", async ({ page }) => {
    await clickCell(page);

    // Should navigate to graph view
    await expect(page.getByRole("button", { name: "Back to matrix" })).toBeVisible();
    // Rule panel should open with rules section
    await expect(page.getByText("Rules (")).toBeVisible();
  });
});

test.describe("rule panel", () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
    await page.goto("/");
    await waitForMatrix(page);
    await clickCell(page);
    await expect(page.getByText("Rules (")).toBeVisible();
  });

  test("shows rules with action badges", async ({ page }) => {
    await expect(page.getByText("ALLOW").first()).toBeVisible();
  });

  test("expand rule shows detail sections", async ({ page }) => {
    // Click the first rule to expand
    const ruleCard = page.getByRole("button", { name: /1\./ }).first();
    await ruleCard.click();

    await expect(page.getByText("Match Criteria")).toBeVisible();
    await expect(page.getByText("Metadata")).toBeVisible();
    await expect(page.getByText("Protocol")).toBeVisible();
  });

  test("collapse rule hides details", async ({ page }) => {
    const ruleCard = page.getByRole("button", { name: /1\./ }).first();
    await ruleCard.click();
    await expect(page.getByText("Match Criteria")).toBeVisible();

    await ruleCard.click();
    await expect(page.getByText("Match Criteria")).not.toBeVisible();
  });

  test("close panel", async ({ page }) => {
    await page.getByLabel("Close panel").click();
    await expect(page.getByText("Rules (")).not.toBeVisible();
  });
});

test.describe("traffic simulation", () => {
  test("shows simulation verdict", async ({ page }) => {
    await mockApi(page);
    await page.goto("/");
    await waitForMatrix(page);
    await clickCell(page);
    await expect(page.getByText("Rules (")).toBeVisible();

    await page.getByPlaceholder("Source IP").fill("10.0.100.5");
    await page.getByPlaceholder("Destination IP").fill("8.8.8.8");
    await page.getByPlaceholder("Port").fill("443");
    await page.getByRole("button", { name: "Simulate" }).click();

    await expect(page.getByText("Evaluation Chain")).toBeVisible();
  });
});

/** Click a matrix cell that has multiple rules (3+). */
async function clickMultiRuleCell(page: import("@playwright/test").Page) {
  const cells = page.getByTestId("matrix-cell");
  const count = await cells.count();
  for (let i = 0; i < count; i++) {
    const text = await cells.nth(i).innerText();
    const match = text.match(/(\d+)/);
    if (match && Number(match[1]) >= 3) {
      await cells.nth(i).click();
      return;
    }
  }
  throw new Error("No matrix cell with 3+ rules found");
}

test.describe("rule toggle", () => {
  test("toggle shows confirm dialog and completes", async ({ page }) => {
    await mockApi(page);
    await page.goto("/");
    await waitForMatrix(page);
    await clickCell(page);
    await expect(page.getByText("Rules (")).toBeVisible();

    // Find and click a toggle switch (aria-label contains "Disable" or "Enable")
    const toggle = page.getByLabel(/Disable|Enable/).first();
    await toggle.click();

    // Confirm dialog should appear
    await expect(page.getByText(/This change applies immediately/)).toBeVisible();

    // Click confirm inside the dialog
    await page.getByTestId("confirm-backdrop").getByRole("button", { name: /Disable|Enable/ }).click();

    // Dialog should close
    await expect(page.getByText(/This change applies immediately/)).not.toBeVisible();
  });
});

test.describe("rule reorder", () => {
  test("move down shows confirm dialog and completes", async ({ page }) => {
    await mockApi(page);
    await page.goto("/");
    await waitForMatrix(page);
    await clickMultiRuleCell(page);
    await expect(page.getByText("Rules (")).toBeVisible();

    // Find a "move down" button
    const moveDown = page.getByLabel(/Move .+ down/).first();
    await moveDown.click();

    // Confirm dialog
    await expect(page.getByText(/changes rule evaluation order/)).toBeVisible();

    // Confirm
    await page.getByRole("button", { name: /Move down/ }).click();
    await expect(page.getByText(/changes rule evaluation order/)).not.toBeVisible();
  });
});

test.describe("navigation", () => {
  test("back button returns to matrix from graph", async ({ page }) => {
    await mockApi(page);
    await page.goto("/");
    await waitForMatrix(page);

    await clickCell(page);
    await expect(page.getByRole("button", { name: "Back to matrix" })).toBeVisible();

    await page.getByRole("button", { name: "Back to matrix" }).click();

    // Should be back at matrix
    await expect(page.getByRole("button", { name: "Back to matrix" })).not.toBeVisible();
    await waitForMatrix(page);
  });
});
