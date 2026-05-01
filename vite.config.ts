import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

const portEnv = process.env.PORT ? Number(process.env.PORT) : undefined;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: portEnv,
    strictPort: portEnv !== undefined,
  },
});
