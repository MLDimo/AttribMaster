import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    testTimeout: 20000,
    setupFiles: ["./tests/setup.ts"],
    server: {
      deps: {
        // next-auth importe next/server via des conditions d'"exports" que le
        // resolver ESM natif de Node ne suit pas correctement quand le paquet
        // est traité comme externe par Vitest — on force son passage par le
        // pipeline de transformation Vite pour que la résolution fonctionne.
        inline: ["next-auth", "@auth/neon-adapter"],
      },
    },
  },
});
