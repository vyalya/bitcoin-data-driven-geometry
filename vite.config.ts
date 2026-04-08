import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api/sql": {
        target: "https://studio.strategy.com",
        changeOrigin: true,
        secure: true,
        rewrite: () => "/sql",
      },
    },
  },
});
