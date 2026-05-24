import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client/src"),
      "@shared": path.resolve(__dirname, "./shared"),
      "@server": path.resolve(__dirname, "./server"),
    },
  },
  test: {
    globals: true,
    fileParallelism: false,
    poolOptions: {
      threads: {
        singleThread: true
      },
      forks: {
        singleFork: true
      }
    },
    coverage: {
      provider: "istanbul",
      reporter: ["text", "json", "html"],
      exclude: ["node_modules/", "tests/"],
    },
    // We can use a workspace-like setup or dynamic environments based on file paths.
    // Here we define the default environment and setup files for the test suite.
    // For a mixed codebase, we can define custom environments per-file via docblocks
    // like `// @vitest-environment jsdom` in UI tests, or use a workspace file.
    // Let's use a unified config, and UI tests will specify their environment.
    environment: "node",
    globalSetup: ["./tests/setup/global.setup.ts"],
    setupFiles: ["./tests/setup/test-env.ts"],
    include: ["tests/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["tests/e2e/**", "node_modules/**"],
  },
});
