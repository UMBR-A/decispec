import { afterEach, describe, expect, it, vi } from "vitest";
import { GET as getAnalysisStatus } from "../app/api/analyze/status/route";
import { readLiveAnalysisConfiguration } from "../lib/providers/openai-config";

afterEach(() => vi.unstubAllEnvs());

describe("live analysis configuration", () => {
  it("distinguishes missing key, unsupported provider, invalid model, and ready state", () => {
    expect(readLiveAnalysisConfiguration({})).toMatchObject({ configured: false, apiKeyDetected: false, provider: "openai", model: "gpt-5.6", code: "missing_api_key" });
    expect(readLiveAnalysisConfiguration({ OPENAI_API_KEY: "configured", OPENAI_PROVIDER: "other" })).toMatchObject({ configured: false, code: "unsupported_provider" });
    expect(readLiveAnalysisConfiguration({ OPENAI_API_KEY: "configured", OPENAI_MODEL: "bad model name" })).toMatchObject({ configured: false, code: "invalid_model" });
    expect(readLiveAnalysisConfiguration({ OPENAI_API_KEY: "configured", OPENAI_PROVIDER: "openai", OPENAI_MODEL: "gpt-5.6" })).toMatchObject({ configured: true, apiKeyDetected: true, code: "ready" });
  });

  it("returns only safe readiness booleans and model/provider names", async () => {
    vi.stubEnv("OPENAI_API_KEY", "PRIVATE_SERVER_KEY");
    vi.stubEnv("OPENAI_PROVIDER", "openai");
    vi.stubEnv("OPENAI_MODEL", "gpt-5.6");
    const response = await getAnalysisStatus();
    const body = await response.json();
    expect(body).toEqual({ routeAvailable: true, provider: "openai", providerConfigured: true, apiKeyDetected: true, model: "gpt-5.6", modelPresent: true, engineReady: true, ready: true, code: "ready" });
    expect(JSON.stringify(body)).not.toContain("PRIVATE_SERVER_KEY");
  });
});
