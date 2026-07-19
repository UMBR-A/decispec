import { expect, test } from "@playwright/test";
import { demoProject, demoSourceSpanIds } from "../lib/demo/fixture";
import { evaluateGraph, resetGraph } from "../lib/domain/engine";

function simplePdf(text: string): Buffer {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", `<< /Length ${text.length + 33} >>\nstream\nBT /F1 12 Tf 72 720 Td (${text}) Tj ET\nendstream`,
  ];
  let pdf = "%PDF-1.4\n"; const offsets = [0];
  objects.forEach((object, index) => { offsets.push(pdf.length); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
}

test("explicit live mode accepts TXT/PDF and renders a mocked provider result without fallback", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  const graph = resetGraph(demoProject.graph);
  await page.route("**/api/analyze", async (route) => {
    const posted = route.request().postDataJSON() as { documents: Array<{ content: string }>; draftMemo: string };
    expect(posted.documents.some((document) => document.content.includes("Uploaded exact evidence"))).toBe(true);
    expect(posted.documents.some((document) => document.content.includes("PDF page evidence"))).toBe(true);
    expect(posted.draftMemo).toContain("Vendor A");
    expect(JSON.stringify(posted)).not.toMatch(/OPENAI_API_KEY|sk-proj/i);
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      provider: { name: "OpenAI", mode: "live-openai", model: "gpt-5.6-terra" },
      usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 }, requestId: "req_mock", latencyMs: 1000,
      analysis: { sourceSpans: demoProject.sourceSpans, graph }, evaluation: evaluateGraph(graph, demoSourceSpanIds),
    }) });
  });
  await page.goto("/workspace/live");
  await expect(page.locator("html")).toHaveAttribute("data-assert-live-hydrated", "true");
  await expect(page.getByText("GPT semantic analysis + local proof engine")).toBeVisible();
  await page.getByPlaceholder(/recommendation you want to test/i).fill("The draft recommends Vendor A.");
  await page.locator('input[type="file"]').setInputFiles([
    { name: "evidence.txt", mimeType: "text/plain", buffer: Buffer.from("Uploaded exact evidence") },
    { name: "quote.pdf", mimeType: "application/pdf", buffer: simplePdf("PDF page evidence") },
  ]);
  await expect(page.getByText("evidence.txt")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("quote.pdf")).toBeVisible({ timeout: 20_000 });
  await page.getByTestId("test-live-decision").click();
  await expect(page.getByRole("heading", { name: "Decision broken" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Decision Test Suite" })).toBeVisible();
  await expect(page.getByTestId("proof-graph")).toBeVisible();
  expect(consoleErrors).toEqual([]);
});

test("mobile landing and live input have no horizontal page overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ["/", "/workspace/live"]) {
    await page.goto(path);
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
  expect(primaryActionFocused.text).toContain("Instant demonstration");
  const duration = await page.getByRole("link", { name: "Instant demonstration" }).evaluate((element) => getComputedStyle(element).transitionDuration);
  expect(Number.parseFloat(duration)).toBeLessThanOrEqual(0.01);
});
