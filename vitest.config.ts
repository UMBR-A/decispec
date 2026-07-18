import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    exclude: ["e2e/**", "node_modules/**", "dist/**"],
    coverage: { reporter: ["text", "html"] },
  },
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
});
