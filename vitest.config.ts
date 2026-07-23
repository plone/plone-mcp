import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./__tests__/setup.ts"],
    include: ["__tests__/**/*.{test,spec}.{ts,js}"], // Limit discovery to repo tests
    exclude: ["node_modules", "dist", ".idea", ".git", ".cache"], // Default excludes
    pool: "threads", // Forked workers were crashing in CI, stick to threads
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.d.ts",
        // Transport bootstrap files; exercised by the CI smoke test instead
        "src/stdio-server.ts",
        "src/http-server.ts",
      ],
    },
    testTimeout: 10000,
    alias: {
      "plone-mcp/__tests__": path.resolve(__dirname, "./__tests__"),
      "plone-mcp": path.resolve(__dirname, "./src"),
    },
  },
});
