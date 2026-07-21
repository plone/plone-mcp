import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node", // Keeping 'node' as per Jest config
    setupFiles: ["./__tests__/setup.ts"], // Vitest's equivalent of setupFilesAfterEnv
    include: ["__tests__/**/*.{test,spec}.{ts,js}"], // Limit discovery to repo tests
    exclude: ["node_modules", "dist", ".idea", ".git", ".cache"], // Default excludes
    pool: "threads", // Forked workers were crashing in CI, stick to threads
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.d.ts",
        "src/index.ts", // Exclude main entry point if it's just bootstrapping
        "src/plone-mcp-server.ts", // Exclude specific server file
      ],
    },
    testTimeout: 10000, // 10 seconds, matching Jest's testTimeout
    alias: {
      "xmcp/headers": path.resolve(
        __dirname,
        "./__tests__/mocks/xmcp-headers.ts",
      ),
      "plone-mcp/__tests__": path.resolve(__dirname, "./__tests__"),
      "plone-mcp": path.resolve(__dirname, "./src"),
    },
  },
});
