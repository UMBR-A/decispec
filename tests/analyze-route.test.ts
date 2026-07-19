import { afterEach, describe, expect, it, vi } from "vitest";
import { handleAnalysisRequest } from "../app/api/analyze/route";
import { demoProject } from "../lib/demo/fixture";
import { AnalysisProviderError, type AnalysisInput, type AnalysisProvider, type AnalysisResult } from "../lib/providers/analysis-provider";

const input: AnalysisInput = { documents: [{ id: "source", title: "Source", content: "Exact evidence." }], draftMemo: "Select the supported option." };

const result: AnalysisResult = {
  plan: { sourceSpans: structuredClone(demoProject.sourceSpans), graph: structuredClone(demoProject.graph) },
  provider: { name: "Test provider", mode: "live-openai", model: "gpt-5.6" },
  usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
  requestId: null,
  latencyMs: null,
};

function request(body: unknown): Request {
  return new Request("http://localhost/api/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

describe("POST /api/analyze", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("fails safely without a server API key and never starts provider analysis", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const response = await handleAnalysisRequest(request(input));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Live analysis is not configured.",
      code: "configuration",
    });
  });

  it("returns sanitized proposal plus local evaluation with no-store caching", async () => {
    const provider: AnalysisProvider = { name: "Test provider", mode: "live-openai", async analyze() { return { ...result, rawResponse: "must-not-leak" } as AnalysisResult; } };
    const response = await handleAnalysisRequest(request(input), provider);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
    expect(body).toMatchObject({ provider: { mode: "live-openai" }, evaluation: { nodes: expect.any(Array) } });
    expect(JSON.stringify(body)).not.toContain("must-not-leak");
    expect(JSON.stringify(body)).not.toContain("OPENAI_API_KEY");
  });

  it("preserves safe provider metadata when deterministic execution rejects", async () => {
    const brokenResult = structuredClone(result);
    brokenResult.requestId = "req_engine_safe";
    brokenResult.latencyMs = 456;
    brokenResult.plan.graph.edges.push({ id: "cycle-route", from: "recommendation", to: "students", kind: "semantic" });
    const provider: AnalysisProvider = { name: "Test provider", mode: "live-openai", async analyze() { return brokenResult; } };
    const response = await handleAnalysisRequest(request(input), provider);
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({ stage: "graph", code: "PATH_ASSERTION_FAILED", path: "$.graph", requestId: "req_engine_safe", latencyMs: 456, usage: { totalTokens: 30 } });
  });

  it("rejects malformed request bodies", async () => {
    const provider = { name: "Unused", mode: "live-openai" as const, analyze: async () => { throw new Error("should not run"); } };
    const response = await handleAnalysisRequest(request({ documents: [] }), provider);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Provide valid source documents and a draft memo." });
  });

  it("rejects duplicate document IDs before calling the provider", async () => {
    const provider: AnalysisProvider = { name: "Unused", mode: "live-openai", analyze: async () => { throw new Error("should not run"); } };
    const response = await handleAnalysisRequest(request({ ...input, documents: [input.documents[0], { ...input.documents[0], title: "Duplicate" }] }), provider);
    expect(response.status).toBe(400);
  });

  it("returns only content-free validation diagnostics and preserved metadata", async () => {
    const provider: AnalysisProvider = {
      name: "Test provider",
      mode: "live-openai",
      async analyze() {
        throw new AnalysisProviderError("validation_rejection", "Analysis validation failed.", {
          cause: new Error("PRIVATE_QUOTATION raw provider output sk-proj-secret"),
          requestId: "req_safe_route",
          responseReceived: true,
          latencyMs: 321,
          usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
          diagnostic: {
            stage: "quotation",
            code: "QUOTE_NOT_FOUND",
            path: "$.sourceSpans[0].quote",
            id: "span-1",
            counts: { canonicalMatches: 0 },
            state: { exactMatch: false },
          },
          internalReason: "INVALID_OPERAND",
        });
      },
    };
    const response = await handleAnalysisRequest(request(input), provider);
    expect(response.status).toBe(502);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
    expect(body).toEqual({
      stage: "quotation",
      code: "QUOTE_NOT_FOUND",
      path: "$.sourceSpans[0].quote",
      id: "span-1",
      counts: { canonicalMatches: 0 },
      state: { exactMatch: false },
      requestId: "req_safe_route",
      latencyMs: 321,
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    });
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("PRIVATE_QUOTATION");
    expect(serialized).not.toContain("raw provider output");
    expect(serialized).not.toContain("sk-proj-secret");
    expect(serialized).not.toContain("INVALID_OPERAND");
  });

  it.each([["timeout", 504], ["schema_rejection", 502], ["validation_rejection", 502], ["rate_limit", 429], ["refusal", 422], ["configuration", 503]] as const)("maps %s errors to a safe status", async (code, status) => {
    const provider: AnalysisProvider = { name: "Test provider", mode: "live-openai", async analyze() { throw new AnalysisProviderError(code, `Safe ${code} message.`); } };
    const response = await handleAnalysisRequest(request(input), provider);
    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual({ error: `Safe ${code} message.`, code });
  });
});
