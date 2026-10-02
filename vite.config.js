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
    headers: {
      "Content-Security-Policy":
        "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: https: http: ws: wss:; connect-src 'self' https: http: ws: wss:; img-src 'self' data: blob: https: http:; font-src 'self' data: https: http:; style-src 'self' 'unsafe-inline' https: http:;",
    },
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
        rewrite: (path) => path.replace(/^\/supabase/, ""),
        configure: (proxy) => {
          proxy.on("proxyRes", (proxyRes) => {
            delete proxyRes.headers["set-cookie"];
            delete proxyRes.headers["Set-Cookie"];
            delete proxyRes.headers["content-security-policy"];
            delete proxyRes.headers["Content-Security-Policy"];
            delete proxyRes.headers["content-security-policy-report-only"];
            delete proxyRes.headers["x-content-security-policy"];
          });
        },
      },
    },
  },
});



