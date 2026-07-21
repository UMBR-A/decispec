import { expect, test } from "@playwright/test";

const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "laptop", width: 1280, height: 800 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
] as const;

test("landing and live workspace stay within desktop, laptop, tablet, and mobile viewports", async ({ page }) => {
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Turn AI recommendations into tests." })).toBeVisible();
    await expect(page.locator(".hero-inputs").getByText("Source evidence")).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

    await page.goto("/workspace/live");
    await expect(page.locator("html")).toHaveAttribute("data-assert-live-hydrated", "true");
    await expect(page.getByRole("heading", { name: "Test an AI-written recommendation against its evidence." })).toBeVisible();
    await expect(page.getByTestId("test-live-decision")).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  }
});
