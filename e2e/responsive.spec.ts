import { expect, test } from "@playwright/test";

const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "laptop", width: 1280, height: 800 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
] as const;

test("landing and workspace stay within desktop, laptop, tablet, and mobile viewports", async ({ page }) => {
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Turn AI recommendations into tests." })).toBeVisible();
    await expect(page.locator(".hero-inputs").getByText("Source evidence")).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

    await page.goto("/workspace/demo");
    await expect(page.locator("html")).toHaveAttribute("data-assert-hydrated", "true");
    await expect(page.getByRole("heading", { name: "Decision Test Suite" })).toBeVisible();
    await expect(page.getByTestId("verify-decision")).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  }
});

test("mobile failure, correction, graph, and report remain usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/workspace/demo");
  await expect(page.locator("html")).toHaveAttribute("data-assert-hydrated", "true");
  await page.getByTestId("verify-decision").click();
  await expect(page.getByTestId("break-decision")).toBeVisible({ timeout: 10_000 });
  await page.getByTestId("break-decision").click();
  await expect(page.getByTestId("proof-graph")).toHaveAttribute("data-graph-view", "focused");
  await expect(page.getByTestId("proof-graph").locator(".react-flow__node")).toHaveCount(4);
  await expect(page.getByTestId("apply-correction")).toBeVisible();
  await page.getByTestId("apply-correction").click();
  await expect(page.getByTestId("vendor-a-total")).toContainText("$268,677");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

  await page.getByTestId("view-report").click();
  await expect(page.getByText("PROOF PASSED")).toBeVisible();
  await expect(page.getByRole("region", { name: "Scrollable before and after comparison" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
