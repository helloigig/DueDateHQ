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
    // Worktree + parent both have node_modules, so without dedupe Vite
    // can resolve react from both → "Invalid hook call". Force a single
    // copy from the worktree.
    dedupe: ["react", "react-dom"],
  },
  server: {
    port: portEnv,
    strictPort: portEnv !== undefined,
  },
});
