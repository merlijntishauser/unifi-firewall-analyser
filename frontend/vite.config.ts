/// <reference types="vitest" />
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tidewave from "tidewave/vite-plugin";
import { defineConfig } from "vitest/config";
import type { Plugin } from "vite";

function startupBanner(): Plugin {
  return {
    name: "startup-banner",
    configureServer(server) {
      server.httpServer?.once("listening", () => {
        const apiTarget = process.env.API_PROXY_TARGET || "http://localhost:8000";
        const banner = `
    __  __      _ _______ _
   / / / /___  (_) ____(_) |
  / / / / __ \\/ / /_  / /| |
 / /_/ / / / / / __/ / / | |
 \\____/_/ /_/_/_/   /_/  |_|
  Firewall Analyser  [frontend]

  API proxy: ${apiTarget}
`;
        for (const line of banner.split("\n")) {
          if (line.trim()) console.log(line);
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), tidewave(), startupBanner()],
  server: {
    host: "0.0.0.0",
    proxy: {
      "/api": process.env.API_PROXY_TARGET || "http://localhost:8000",
    },
    warmup: {
      clientFiles: ["./src/main.tsx", "./src/App.tsx", "./src/components/*.tsx"],
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test-setup.ts",
    passWithNoTests: true,
    exclude: ["e2e/**", "e2e-prod/**", "node_modules/**"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/main.tsx", "src/vite-env.d.ts", "src/test-setup.ts", "src/api/types.ts"],
      thresholds: {
        statements: 95,
        branches: 95,
        functions: 95,
        lines: 95,
      },
    },
  },
});
