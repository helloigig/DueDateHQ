import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const portEnv = process.env.PORT ? Number(process.env.PORT) : undefined;

export default defineConfig({
  plugins: [react()],
  server: {
    port: portEnv,
    strictPort: portEnv !== undefined,
  },
});
