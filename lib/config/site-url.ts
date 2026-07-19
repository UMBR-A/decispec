type MetadataEnvironment = Readonly<Record<string, string | undefined>>;

const LOCAL_METADATA_BASE = "http://localhost:3000";

export function resolveMetadataBase(
  environment: MetadataEnvironment = process.env,
): URL {
  const vercelHost =
    environment.VERCEL_URL?.trim() ||
    environment.VERCEL_PROJECT_PRODUCTION_URL?.trim();

  if (!vercelHost) return new URL(LOCAL_METADATA_BASE);

  if (vercelHost.startsWith("http://")) {
    throw new Error("Vercel metadata URLs must use HTTPS.");
  }

  const candidate = vercelHost.startsWith("https://")
    ? vercelHost
    : `https://${vercelHost}`;
  const url = new URL(candidate);

  if (url.protocol !== "https:") {
    throw new Error("Vercel metadata URLs must use HTTPS.");
  }

  return url;
}
