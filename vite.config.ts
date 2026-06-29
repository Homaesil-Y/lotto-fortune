/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["pwa-icon.svg"],
      manifest: {
        name: "로또 포춘 (Lotto Fortune)",
        short_name: "로또 포춘",
        description: "방법론 기반 로또 통계 분석·시뮬레이터",
        lang: "ko",
        theme_color: "#ff375f",
        background_color: "#f2f2f7",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/pwa-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          { src: "/pwa-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
        ],
      },
    }),
  ],
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: { manualChunks: { recharts: ["recharts"] } },
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
