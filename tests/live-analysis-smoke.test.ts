// @vitest-environment node

import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";
import { describe, expect, it } from "vitest";
import { loadEnv } from "vite";
import { AnalysisProviderError, ProviderAnalysisPlanSchema, validateProviderProposal, type AnalysisUsage } from "../lib/providers/analysis-provider";
import { PROOF_ENGINE_PROJECT_ID, proofEngineAnalysisInput } from "./fixtures/proof-engine-project";
import { executeLiveProof } from "../lib/providers/live-proof";
import { SafeValidationError } from "../lib/providers/safe-validation";
import {
  OpenAIAnalysisProvider,
  SYSTEM_INSTRUCTIONS,
  buildProviderRequest,
  providerOutputFormat,
  type ResponsesClient,
} from "../lib/providers/openai-analysis-provider";

const liveIt = process.env.ASSERT_LIVE_SMOKE === "1" ? it : it.skip;
const smokeOptions = {
  model: "gpt-5.6-terra",
  reasoningEffort: "low" as const,
  maxOutputTokens: 6_000,
  timeoutMs: 90_000,
};

const replayRelativePath = "work/live-debug/synthetic-school-acceptance-replay.json";

type CapturedResponse = {
  outputText: string;
  requestId: string | null;
  usage: AnalysisUsage;
  latencyMs: number;
};

function prepareSyntheticReplay(rawProposal: unknown) {
  const proposal = ProviderAnalysisPlanSchema.parse(structuredClone(rawProposal));
  proposal.graph.nodes = proposal.graph.nodes.map((node) => ({
    ...node,
    label: `[redacted:${node.id}]`,
    statement: `[redacted:${node.id}]`,
    calculation: node.calculation === null ? null : { ...node.calculation, displayFormula: "[redacted formula]" },
  }));
  proposal.graph.edges = proposal.graph.edges.map((edge) => ({ ...edge, label: null }));
  proposal.graph.corrections = proposal.graph.corrections.map((correction) => ({
    ...correction,
    title: `[redacted:${correction.id}]`,
    description: `[redacted:${correction.id}]`,
    replacementCalculation: { ...correction.replacementCalculation, displayFormula: "[redacted formula]" },
  }));
  return proposal;
}

async function writeIgnoredReplay(redacted: unknown, metadata: Omit<CapturedResponse, "outputText">): Promise<string> {
  const absolutePath = path.resolve(replayRelativePath);
  execFileSync("git", ["check-ignore", "--quiet", "--", replayRelativePath], { stdio: "ignore" });
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${JSON.stringify({ fixtureId: PROOF_ENGINE_PROJECT_ID, safeMetadata: metadata, structuredOutput: redacted }, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  return replayRelativePath;
}

function countSchemaProperties(value: unknown): number {
  if (!value || typeof value !== "object") return 0;
  const record = value as Record<string, unknown>;
  let count = record.type === "object" && record.properties && typeof record.properties === "object"
    ? Object.keys(record.properties).length
    : 0;
  for (const child of Object.values(record)) {
    if (Array.isArray(child)) count += child.reduce((total, item) => total + countSchemaProperties(item), 0);
    else count += countSchemaProperties(child);
  }
  return count;
}

describe("GPT-5.6 Terra bundled evidence smoke test", () => {
  it("reports safe aggregate request metadata", () => {
    const input = proofEngineAnalysisInput();
    const request = buildProviderRequest(input, smokeOptions);
    const requestTextCharacters = request.input[0].content[0].text.length;
    const safeMetadata = {
      normalizedDocumentCharacters: input.documents.reduce((total, document) => total + document.content.length, 0),
      draftMemoCharacters: input.draftMemo.length,
      approximateInputTokens: Math.ceil((requestTextCharacters + SYSTEM_INSTRUCTIONS.length) / 4),
      schemaProperties: countSchemaProperties((providerOutputFormat() as unknown as { schema: unknown }).schema),
      requestedMaximumOutputTokens: request.max_output_tokens,
      model: request.model,
      reasoningEffort: request.reasoning.effort,
      store: request.store,
      toolsPresent: Object.hasOwn(request, "tools"),
      previousResponsePresent: Object.hasOwn(request, "previous_response_id"),
    };
    expect(safeMetadata).toMatchObject({
      model: "gpt-5.6-terra",
      reasoningEffort: "low",
      requestedMaximumOutputTokens: 6_000,
      store: false,
      toolsPresent: false,
      previousResponsePresent: false,
    });
    console.info(`ASSERT_LIVE_SMOKE_METADATA ${JSON.stringify(safeMetadata)}`);
  });

  liveIt("makes exactly one request and validates the result deterministically", async () => {
    const env = loadEnv("development", process.cwd(), "");
    if (!env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is unavailable for the live smoke test.");
    process.env.OPENAI_API_KEY = env.OPENAI_API_KEY;
    const input = proofEngineAnalysisInput();
    if (input.fixtureId !== PROOF_ENGINE_PROJECT_ID) throw new Error("Live acceptance capture is restricted to the bundled synthetic fixture.");
    const captureEnabled = process.env.ASSERT_CAPTURE_SYNTHETIC_REPLAY === "1";
    let capturedResponse: CapturedResponse | null = null;

    const startedAt = performance.now();
    const sdk = new OpenAI({ apiKey: env.OPENAI_API_KEY, maxRetries: 0 });
    const capturingClient: ResponsesClient = {
      responses: {
        create: async (body, options) => {
          const response = await sdk.responses.create(body as never, { signal: options?.signal });
          capturedResponse = {
            outputText: response.output_text,
            requestId: response._request_id ?? null,
            usage: {
              inputTokens: response.usage?.input_tokens ?? null,
              outputTokens: response.usage?.output_tokens ?? null,
              totalTokens: response.usage?.total_tokens ?? null,
            },
            latencyMs: Math.round(performance.now() - startedAt),
          };
          return response as unknown as Awaited<ReturnType<ResponsesClient["responses"]["create"]>>;
        },
      },
    };
    try {
      const result = await new OpenAIAnalysisProvider({ ...smokeOptions, client: capturingClient }).analyze(input);
      const proof = executeLiveProof(result, input.fixtureId);
      let replayArtifactCaptured = false;
      if (captureEnabled && capturedResponse !== null) {
        const response = capturedResponse as CapturedResponse;
        const rawProposal = JSON.parse(response.outputText) as unknown;
        const replayable = prepareSyntheticReplay(rawProposal);
        await writeIgnoredReplay(replayable, { requestId: response.requestId, usage: response.usage, latencyMs: response.latencyMs });
        replayArtifactCaptured = true;
      }
      console.info(`ASSERT_LIVE_SMOKE_RESULT ${JSON.stringify({
        provider: result.provider,
        ...proof.summary,
        requestId: result.requestId,
        latencyMs: result.latencyMs,
        usage: result.usage,
        sourceSpanCount: result.plan.sourceSpans.length,
        nodeCount: result.plan.graph.nodes.length,
        replayArtifactCaptured,
      })}`);
    } catch (error) {
      const observedLatencyMs = Math.round(performance.now() - startedAt);
      let replayArtifactCaptured = false;
      let offlineReplayConfirmed = false;
      if (captureEnabled && capturedResponse !== null) {
        try {
          const response = capturedResponse as CapturedResponse;
          const rawProposal = JSON.parse(response.outputText) as unknown;
          const replayable = prepareSyntheticReplay(rawProposal);
          try {
            const replayPlan = validateProviderProposal(replayable, input);
            executeLiveProof({
              plan: replayPlan,
              provider: { name: "OpenAI replay", mode: "live-openai", model: smokeOptions.model },
              requestId: response.requestId,
              latencyMs: response.latencyMs,
              usage: response.usage,
            }, input.fixtureId);
          } catch (replayError) {
            if (error instanceof AnalysisProviderError && replayError instanceof SafeValidationError) {
              offlineReplayConfirmed = error.diagnostic?.stage === replayError.diagnostic.stage && error.diagnostic?.code === replayError.diagnostic.code;
            } else if (error instanceof AnalysisProviderError && replayError instanceof AnalysisProviderError) {
              offlineReplayConfirmed = error.diagnostic?.stage === replayError.diagnostic?.stage && error.diagnostic?.code === replayError.diagnostic?.code;
            }
          }
          await writeIgnoredReplay(replayable, { requestId: response.requestId, usage: response.usage, latencyMs: response.latencyMs });
          replayArtifactCaptured = true;
        } catch {
          replayArtifactCaptured = false;
        }
      }
      const safeFailure = error instanceof AnalysisProviderError
        ? {
            category: error.code,
            stage: error.diagnostic?.stage,
            code: error.diagnostic?.code,
            path: error.diagnostic?.path,
            id: error.diagnostic?.id,
            counts: error.diagnostic?.counts,
            state: error.diagnostic?.state,
            latencyMs: error.latencyMs ?? observedLatencyMs,
            requestId: error.requestId,
            usage: error.usage,
            responseReceived: error.responseReceived,
            replayArtifactCaptured,
            offlineReplayConfirmed,
          }
        : { category: "transport", latencyMs: observedLatencyMs, requestId: null, usage: null, responseReceived: false, replayArtifactCaptured, offlineReplayConfirmed };
      console.info(`ASSERT_LIVE_SMOKE_FAILURE ${JSON.stringify(safeFailure)}`);
      throw new Error(`Live smoke test failed safely: ${safeFailure.category}.`);
    }
  }, 100_000);
});
