import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";

// En developpement, le portail sert aussi Auréo sous /aureo/, a partir de sa
// version construite (npm run build dans aureo-app). C'est ce qui permet de
// verifier en local que la session est bien partagee : les deux applications
// sont alors a la meme adresse, comme en production.
// Dossier d'Auréo construit : AUREO_DIST, sinon ../aureo-app/dist.
const AUREO_DIST = path.resolve(process.env.AUREO_DIST || "../aureo-app/dist");

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png",
  ".svg": "image/svg+xml", ".ico": "image/x-icon", ".woff2": "font/woff2",
};

function servirAureoEnLocal() {
  return {
    name: "servir-aureo-en-local",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url, "http://local");
        if (url.pathname === "/aureo") { res.statusCode = 301; res.setHeader("Location", "/aureo/"); res.end(); return; }
        if (!url.pathname.startsWith("/aureo/")) return next();
        const relatif = decodeURIComponent(url.pathname.slice("/aureo/".length)) || "index.html";
        let fichier = path.join(AUREO_DIST, relatif);
        if (!fichier.startsWith(AUREO_DIST) || !fs.existsSync(fichier) || fs.statSync(fichier).isDirectory()) {
          fichier = path.join(AUREO_DIST, "index.html");   // application d'une seule page
        }
        if (!fs.existsSync(fichier)) { res.statusCode = 404; res.end("Auréo n'est pas construit : lancez npm run build dans aureo-app."); return; }
        res.setHeader("Content-Type", TYPES[path.extname(fichier)] || "application/octet-stream");
        fs.createReadStream(fichier).pipe(res);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), servirAureoEnLocal()],
  server: { port: 5180 },
});
