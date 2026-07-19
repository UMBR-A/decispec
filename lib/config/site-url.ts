type MetadataEnvironment = Readonly<Record<string, string | undefined>>;

const LOCAL_METADATA_BASE = "http://localhost:3000";

export function resolveMetadataBase(
  environment: MetadataEnvironment = process.env,
): URL {
  const vercelHost =
    environment.VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
    environment.VERCEL_URL?.trim();

  if (!vercelHost) return new URL(LOCAL_METADATA_BASE);

  const candidate = /^https?:\/\//i.test(vercelHost)
    ? vercelHost
    : `https://${vercelHost}`;
  const url = new URL(candidate);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Metadata URLs must use HTTP or HTTPS.");
  }

  return new URL(url.origin);
}
