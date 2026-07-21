import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { evaluateGraph, resetGraph } from "../lib/domain/engine";
import { vendorGraph, vendorSourceSpanIds, vendorSourceSpans } from "../tests/fixtures/vendor-example";

const sourceDocuments = readFileSync(resolve(process.cwd(), "tests/fixtures/source_documents.txt"));
const recommendationMemo = readFileSync(resolve(process.cwd(), "tests/fixtures/ai_recommendation.txt"));

test("explicit live mode uploads the supplied files and completes correction and reporting without fallback", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  const graph = resetGraph(vendorGraph);
  await page.route("**/api/analyze", async (route) => {
    const posted = route.request().postDataJSON() as { documents: Array<{ content: string }>; draftMemo: string };
    expect(posted.documents.some((document) => document.content.includes("Vendor A support cost: $2,334 per month"))).toBe(true);
    expect(posted.draftMemo).toContain("$2,,334 per month");
    expect(JSON.stringify(posted)).not.toMatch(/OPENAI_API_KEY|sk-proj/i);
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      provider: { name: "OpenAI", mode: "live-openai", model: "gpt-5.6-terra" },
      usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 }, requestId: "req_mock", latencyMs: 1000,
      analysis: { sourceSpans: vendorSourceSpans, graph }, evaluation: evaluateGraph(graph, vendorSourceSpanIds),
    }) });
  });
  await page.goto("/workspace/live");
  await expect(page.locator("html")).toHaveAttribute("data-assert-live-hydrated", "true");
  await expect(page.getByText("GPT semantic analysis + local proof engine")).toBeVisible();
  await page.getByTestId("memo-upload").setInputFiles({ name: "ai_recommendation.txt", mimeType: "text/plain", buffer: recommendationMemo });
  await page.getByTestId("evidence-upload").setInputFiles({ name: "source_documents.txt", mimeType: "text/plain", buffer: sourceDocuments });
  await expect(page.getByText("source_documents.txt")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByPlaceholder(/recommendation you want to test/i)).toHaveValue(/The recommendation selects Vendor A[\s\S]*\$2,,334 per month/);
  await page.getByTestId("test-live-decision").click();
  await expect(page.getByRole("heading", { name: "Decision broken" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Decision Test Suite" })).toBeVisible();
  await expect(page.getByTestId("proof-graph")).toHaveAttribute("data-graph-view", "focused");
  await expect(page.getByTestId("live-correction-preview")).toBeVisible();
  await page.getByTestId("apply-live-correction").click();
  await expect(page.getByRole("heading", { name: "Decision verified" })).toBeVisible();
  await page.getByTestId("view-live-report").click();
  await expect(page.getByTestId("live-proof-report")).toContainText("PROOF PASSED");
  await expect(page.getByTestId("live-proof-report")).toContainText("Vendor B");
  await expect(page.getByTestId("live-proof-report")).toContainText("$84,024");
  await expect(page.getByTestId("live-proof-report")).toContainText("$264,024");
  await expect(page.getByTestId("live-proof-report")).toContainText("$255,000");
  await expect(page.getByTestId("live-proof-report")).toContainText("$9,024");
  expect(consoleErrors).toEqual([]);
});

test("controlled live vendor acceptance uses the real server provider exactly once", async ({ page }) => {
  test.skip(process.env.DECISPEC_LIVE_ACCEPTANCE !== "1", "Paid live acceptance is explicitly gated.");
  test.setTimeout(120_000);
  await page.goto("/workspace/live");
  await expect(page.getByText("Live analysis ready")).toBeVisible();
  await page.getByTestId("memo-upload").setInputFiles({ name: "ai_recommendation.txt", mimeType: "text/plain", buffer: recommendationMemo });
  await page.getByTestId("evidence-upload").setInputFiles({ name: "source_documents.txt", mimeType: "text/plain", buffer: sourceDocuments });
  await expect(page.getByText("source_documents.txt")).toBeVisible();
  await page.getByTestId("test-live-decision").click();
  await expect(page.getByRole("heading", { name: "Decision broken" })).toBeVisible({ timeout: 90_000 });
  await expect(page.getByTestId("proof-graph")).toHaveAttribute("data-graph-view", "focused");
  await expect(page.getByTestId("live-correction-preview")).toBeVisible();
  await page.getByTestId("apply-live-correction").click();
  await expect(page.getByRole("heading", { name: "Decision verified" })).toBeVisible();
  await page.getByTestId("view-live-report").click();
  const report = page.getByTestId("live-proof-report");
  await expect(report).toContainText("$84,024");
  await expect(report).toContainText("$264,024");
  await expect(report).toContainText("$45,000");
  await expect(report).toContainText("$255,000");
  await expect(report).toContainText("$9,024");
  await expect(report).toContainText("3.54%");
  await expect(report).toContainText("Vendor B");
});

test("mobile landing and live input have no horizontal page overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ["/", "/workspace/live"]) {
    await page.goto(path);
    if (path === "/workspace/live") {
      await expect(page.locator("html")).toHaveAttribute("data-assert-live-hydrated", "true");
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  }
});

test("keyboard navigation and reduced motion remain usable", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.keyboard.press("Tab");
  const skipFocused = await page.evaluate(() => ({ tag: document.activeElement?.tagName, text: document.activeElement?.textContent?.trim() }));
  expect(skipFocused.tag).toBe("A");
  expect(skipFocused.text).toContain("Skip to main content");
  await page.keyboard.press("Tab");
  const primaryActionFocused = await page.evaluate(() => ({ tag: document.activeElement?.tagName, text: document.activeElement?.textContent?.trim() }));
  expect(primaryActionFocused.tag).toBe("A");
  expect(primaryActionFocused.text).toContain("Analyze my decision");
  const duration = await page.getByRole("link", { name: "Analyze my decision" }).evaluate((element) => getComputedStyle(element).transitionDuration);
  expect(Number.parseFloat(duration)).toBeLessThanOrEqual(0.01);
});
