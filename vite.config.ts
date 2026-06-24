import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 600, // recharts 단독 청크는 의도된 분리
    rollupOptions: {
      output: {
        // 무거운 차트 라이브러리를 별도 청크로 분리해 초기 로딩을 가볍게.
        manualChunks: { recharts: ["recharts"] },
      },
    },
  },
});
