import { defineConfig } from "vite";

export default defineConfig({
  root: "app",
  build: { outDir: "../dist", emptyOutDir: true },
  server: {
    // Tijdens lokaal ontwikkelen gaan API-verzoeken naar de worker (wrangler dev).
    proxy: { "/api": "http://127.0.0.1:8787" },
  },
});
