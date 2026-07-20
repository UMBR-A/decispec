export const DEFAULT_OPENAI_MODEL = "gpt-5.6";
export const DEFAULT_OPENAI_PROVIDER = "openai";
export const DEFAULT_OPENAI_REASONING_EFFORT = "low" as const;
export const DEFAULT_OPENAI_TIMEOUT_MS = 90_000;

export type LiveAnalysisConfigurationCode =
  | "ready"
  | "missing_api_key"
  | "unsupported_provider"
  | "invalid_model";

export type LiveAnalysisConfiguration = {
  provider: string;
  model: string;
  apiKeyDetected: boolean;
  configured: boolean;
  code: LiveAnalysisConfigurationCode;
};

const MODEL_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;

export function readLiveAnalysisConfiguration(
  environment: { [key: string]: string | undefined } = process.env,
): LiveAnalysisConfiguration {
  const provider = environment.OPENAI_PROVIDER?.trim().toLowerCase() || DEFAULT_OPENAI_PROVIDER;
  const model = environment.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
  const apiKeyDetected = Boolean(environment.OPENAI_API_KEY?.trim());

  if (provider !== DEFAULT_OPENAI_PROVIDER) {
    return { provider, model, apiKeyDetected, configured: false, code: "unsupported_provider" };
  }
  if (!MODEL_NAME.test(model)) {
    return { provider, model, apiKeyDetected, configured: false, code: "invalid_model" };
  }
  if (!apiKeyDetected) {
    return { provider, model, apiKeyDetected, configured: false, code: "missing_api_key" };
  }
  return { provider, model, apiKeyDetected, configured: true, code: "ready" };
}

export function configurationMessage(code: Exclude<LiveAnalysisConfigurationCode, "ready">): string {
  if (code === "missing_api_key") return "Live analysis needs a server-side OpenAI API key.";
  if (code === "unsupported_provider") return "The configured live analysis provider is not supported.";
  return "The configured live analysis model name is invalid.";
}
