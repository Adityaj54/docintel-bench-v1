import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { "/api": "http://api:8000" },
  },
  preview: {
    proxy: { "/api": "http://api:8000" },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    coverage: {
      provider: "v8",
      reportsDirectory: "./coverage",
      // The reports directory is a bind mount under `make test`; removing it would fail.
      clean: false,
      reporter: ["text-summary", "lcovonly", "cobertura"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/main.tsx", "src/test/**", "src/types/**", "src/**/*.test.{ts,tsx}"],
    },
  },
});
