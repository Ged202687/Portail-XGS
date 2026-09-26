import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";

// En developpement, le portail sert aussi les outils sous leur dossier, a
// partir de leur version construite (npm run build dans chaque depot). C'est
// ce qui permet de verifier en local que la session est bien partagee : les
// applications sont alors a la meme adresse, comme en production.
// Dossier construit de chaque outil : variable d'environnement, sinon le
// depot voisin.
const OUTILS = [
  { prefixe: "/aureo", dist: path.resolve(process.env.AUREO_DIST || "../aureo-app/dist"), depot: "aureo-app" },
  { prefixe: "/meridien", dist: path.resolve(process.env.MERIDIEN_DIST || "../Meridien-XGS/dist"), depot: "Meridien-XGS" },
  { prefixe: "/salaire", dist: path.resolve(process.env.SALAIRE_DIST || "../Salaire-agent-XGS/dist"), depot: "Salaire-agent-XGS" },
  { prefixe: "/horizon", dist: path.resolve(process.env.HORIZON_DIST || "../Horizon-XGS/dist"), depot: "Horizon-XGS" },
  { prefixe: "/zenith", dist: path.resolve(process.env.ZENITH_DIST || "../Zenith-XGS/dist"), depot: "Zenith-XGS" },
];

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png",
  ".svg": "image/svg+xml", ".ico": "image/x-icon", ".woff2": "font/woff2",
};

function servirOutilsEnLocal() {
  return {
    name: "servir-outils-en-local",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url, "http://local");
        const outil = OUTILS.find((o) => url.pathname === o.prefixe || url.pathname.startsWith(`${o.prefixe}/`));
        if (!outil) return next();
        if (url.pathname === outil.prefixe) { res.statusCode = 301; res.setHeader("Location", `${outil.prefixe}/`); res.end(); return; }
        const relatif = decodeURIComponent(url.pathname.slice(outil.prefixe.length + 1)) || "index.html";
        let fichier = path.join(outil.dist, relatif);
        if (!fichier.startsWith(outil.dist) || !fs.existsSync(fichier) || fs.statSync(fichier).isDirectory()) {
          fichier = path.join(outil.dist, "index.html");   // application d'une seule page
        }
        if (!fs.existsSync(fichier)) { res.statusCode = 404; res.end(`Outil non construit : lancez npm run build dans ${outil.depot}.`); return; }
        res.setHeader("Content-Type", TYPES[path.extname(fichier)] || "application/octet-stream");
        fs.createReadStream(fichier).pipe(res);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), servirOutilsEnLocal()],
  server: { port: 5180 },
});
