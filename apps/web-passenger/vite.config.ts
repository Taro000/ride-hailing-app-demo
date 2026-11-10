import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// 乗客の SPA（ELM-01）。手元ではサーバー（:8080）へ /api を中継し、同じ入口に見せる（DEC-23）。
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { "/api": { target: "http://localhost:8080" } } },
  build: { outDir: "dist", emptyOutDir: true },
});
