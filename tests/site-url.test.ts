import { describe, expect, it } from "vitest";
import { metadata } from "../app/layout";
import { resolveMetadataBase } from "../lib/config/site-url";

describe("production metadata base", () => {
  it("declares the landing page canonical URL", () => {
    expect(metadata.alternates).toMatchObject({ canonical: "/" });
  });

  it("prefers the public production host over the current deployment host", () => {
    expect(resolveMetadataBase({
      VERCEL_URL: "decispec-preview.vercel.app",
      VERCEL_PROJECT_PRODUCTION_URL: "decispec.vercel.app",
    }).href).toBe("https://decispec.vercel.app/");
  });

  it("adds HTTPS to a production hostname without a protocol", () => {
    expect(resolveMetadataBase({
      VERCEL_PROJECT_PRODUCTION_URL: "decispec.vercel.app",
    }).href).toBe("https://decispec.vercel.app/");
  });

  it("uses the current deployment host when the production host is unavailable", () => {
    expect(resolveMetadataBase({
      VERCEL_URL: "decispec-preview.vercel.app",
    }).href).toBe("https://decispec-preview.vercel.app/");
  });

  it("uses localhost only outside Vercel", () => {
    expect(resolveMetadataBase({}).href).toBe("http://localhost:3000/");
  });

  it("resolves canonical and social metadata against the public host", () => {
    const metadataBase = resolveMetadataBase({
      VERCEL_URL: "decispec-protected.vercel.app",
      VERCEL_PROJECT_PRODUCTION_URL: "decispec.vercel.app/",
    });

    expect(new URL("/", metadataBase).href).toBe("https://decispec.vercel.app/");
    expect(new URL("/og.png", metadataBase).href).toBe("https://decispec.vercel.app/og.png");
    expect(metadataBase.href).not.toContain("localhost");
    expect(metadataBase.href).not.toContain("decispec-protected");
  });

  it.each([
    ["http://metadata.test", "http://metadata.test/"],
    ["https://metadata.test", "https://metadata.test/"],
    ["HTTPS://metadata.test", "https://metadata.test/"],
  ])("preserves a valid URL protocol for %s", (value, expected) => {
    expect(resolveMetadataBase({ VERCEL_URL: value }).href).toBe(expected);
  });
});
