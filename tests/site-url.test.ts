import { describe, expect, it } from "vitest";
import { resolveMetadataBase } from "../lib/config/site-url";

describe("production metadata base", () => {
  it("uses the current Vercel deployment host", () => {
    expect(resolveMetadataBase({
      VERCEL_URL: "decispec-preview.vercel.app",
      VERCEL_PROJECT_PRODUCTION_URL: "decispec.vercel.app",
    }).href).toBe("https://decispec-preview.vercel.app/");
  });

  it("uses the production host when a deployment host is unavailable", () => {
    expect(resolveMetadataBase({
      VERCEL_PROJECT_PRODUCTION_URL: "decispec.vercel.app",
    }).href).toBe("https://decispec.vercel.app/");
  });

  it("uses localhost only outside Vercel", () => {
    expect(resolveMetadataBase({}).href).toBe("http://localhost:3000/");
  });

  it("rejects an insecure deployed metadata host", () => {
    expect(() => resolveMetadataBase({
      VERCEL_URL: "http://decispec-preview.vercel.app",
    })).toThrow("Vercel metadata URLs must use HTTPS.");
  });
});
