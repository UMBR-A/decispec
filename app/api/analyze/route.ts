import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  AnalysisInputSchema,
  AnalysisProviderError,
  type AnalysisProvider,
} from "../../../lib/providers/analysis-provider";
import { OpenAIAnalysisProvider } from "../../../lib/providers/openai-analysis-provider";
import { evaluateGraph } from "../../../lib/domain/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const errorStatus: Record<AnalysisProviderError["code"], number> = {
  configuration: 503,
  transport: 502,
  authentication: 503,
  quota: 503,
  rate_limit: 429,
  model_access: 503,
  timeout: 504,
  refusal: 422,
  schema_rejection: 502,
  validation_rejection: 502,
  upstream: 502,
};

export async function handleAnalysisRequest(request: Request, provider?: AnalysisProvider): Promise<Response> {
  try {
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > 400_000) {
      return NextResponse.json({ error: "Analysis request is too large." }, { status: 413 });
    }
    const body = await request.json();
    const input = AnalysisInputSchema.parse(body);
    const activeProvider = provider ?? new OpenAIAnalysisProvider();
    const result = await activeProvider.analyze(input);
    let evaluation;
    try {
      evaluation = evaluateGraph(result.plan.graph, new Set(result.plan.sourceSpans.map((span) => span.id)));
    } catch {
      return NextResponse.json({
        stage: "graph",
        code: "PATH_ASSERTION_FAILED",
        path: "$.graph",
        requestId: result.requestId,
        latencyMs: result.latencyMs,
        usage: result.usage,
      }, { status: 502, headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({
      provider: result.provider,
      usage: result.usage,
      requestId: result.requestId,
      latencyMs: result.latencyMs,
      analysis: result.plan,
      evaluation,
    }, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof ZodError) {
      return NextResponse.json({ error: "Provide valid source documents and a draft memo." }, { status: 400 });
    }
    if (error instanceof AnalysisProviderError) {
      if (error.code === "validation_rejection" && error.diagnostic) {
        return NextResponse.json({
          ...error.diagnostic,
          requestId: error.requestId,
          latencyMs: error.latencyMs,
          usage: error.usage,
        }, { status: errorStatus[error.code], headers: { "Cache-Control": "no-store" } });
      }
      return NextResponse.json({ error: error.message, code: error.code }, { status: errorStatus[error.code] });
    }
    return NextResponse.json({ error: "Live analysis could not be completed." }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<Response> {
  return handleAnalysisRequest(request);
}
