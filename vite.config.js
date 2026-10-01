import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Le dépôt se déploie sur GitHub Pages à https://<user>.github.io/geshellas/
// — le base path doit donc correspondre au nom du dépôt en production, mais
// rester "/" en développement local. GITHUB_PAGES est positionné par le
// workflow .github/workflows/deploy.yml.
const isGithubPages = process.env.GITHUB_PAGES === "true";

export default defineConfig({
  base: isGithubPages ? "/geshellas/" : "/",
  plugins: [react()],
  server: {
    host: "localhost",
    port: 5173,
    hmr: {
      protocol: "ws",
      host: "localhost",
      port: 5173,
    },
    proxy: {
      "/supabase": {
        target: "https://yfstlcgdxxjoazyyourz.supabase.co",
        changeOrigin: true,
        secure: false,
        ws: true,
        rewrite: (path) => path.replace(/^\/supabase/, ""),
      },
    },
  },
});

