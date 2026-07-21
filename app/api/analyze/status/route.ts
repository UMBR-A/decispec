import { NextResponse } from "next/server";
import { evaluateGraph } from "../../../../lib/domain/engine";
import { readLiveAnalysisConfiguration } from "../../../../lib/providers/openai-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function deterministicEngineReady(): boolean {
  return typeof evaluateGraph === "function";
}

export async function GET(): Promise<Response> {
  const configuration = readLiveAnalysisConfiguration();
  const engineReady = deterministicEngineReady();
  return NextResponse.json({
    routeAvailable: true,
    provider: configuration.provider,
    providerConfigured: configuration.configured,
    apiKeyDetected: configuration.apiKeyDetected,
    model: configuration.model,
    modelPresent: Boolean(configuration.model),
    engineReady,
    ready: configuration.configured && engineReady,
    code: configuration.code,
  }, { headers: { "Cache-Control": "no-store" } });
}
