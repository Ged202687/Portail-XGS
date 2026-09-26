// Worker du portail XGS.
//
// Le portail et les outils doivent etre a la MEME adresse pour partager une
// seule connexion : un navigateur isole les donnees de chaque adresse. Tant
// que chaque outil a son propre deploiement, le portail le relaie sous son
// dossier (/aureo/, /meridien/...). Par exemple pour Auréo :
//   portail/aureo/          -> Auréo /
//   portail/aureo/assets/x  -> Auréo /assets/x
// Les outils sont construits avec des chemins relatifs (base "./") : ils
// fonctionnent a l'identique a leur propre adresse et sous le portail.
//
// Sur le serveur XGS, ce relais sera remplace par la configuration du serveur
// web (un dossier par outil), sans rien changer aux applications.
//
// Comment le portail joint l'outil :
//   - par une liaison de service (services dans wrangler.jsonc) : l'appel va
//     directement d'un Worker a l'autre, dans le compte Cloudflare. C'est
//     indispensable entre Workers d'un meme compte : Cloudflare ne laisse pas
//     un Worker en appeler un autre par son adresse workers.dev (la reponse
//     est alors une page "There is nothing here yet") ;
//   - a defaut de liaison, par l'adresse de l'outil (vars ..._ORIGIN), pour
//     un outil heberge ailleurs.
// Dans les deux cas l'adresse sert a construire la requete : elle donne a
// l'outil le chemin demande, et permet de reconnaitre ses redirections.
//
// Outils reserves au plateau (surSite) : Auréo et Horizon ne s'ouvrent que
// depuis le reseau du plateau (IP_PLATEAU), sauf pour un administrateur ou un
// super administrateur connecte au portail, qui recoit pour cela un jeton
// signe (cookie xgs_hors_site). Meridien et Mon Salaire restent ouverts : les
// agents consultent leur planning et leur bulletin depuis chez eux.
// Tant que IP_PLATEAU est vide, la regle n'est pas appliquee.
//
// Ce n'est qu'une porte d'entree : les donnees restent joignables chez
// Supabase. Le verrou des donnees se pose dans la base (niveau 2).

const OUTILS_RELAYES = [
  { prefixe: "/aureo", service: "AUREO", origine: "AUREO_ORIGIN", surSite: true, nom: "Auréo" },
  { prefixe: "/meridien", service: "MERIDIEN", origine: "MERIDIEN_ORIGIN" },
  { prefixe: "/salaire", service: "SALAIRE", origine: "SALAIRE_ORIGIN" },
  { prefixe: "/horizon", service: "HORIZON", origine: "HORIZON_ORIGIN", surSite: true, nom: "Horizon" },
  // Zenith : pilotage reserve a la direction, qui passe la regle du plateau.
  { prefixe: "/zenith", service: "ZENITH", origine: "ZENITH_ORIGIN", surSite: true, nom: "Zénith" },
];

const COOKIE_HORS_SITE = "xgs_hors_site";
const DUREE_HORS_SITE_SECONDES = 12 * 3600;
const ROLES_HORS_SITE = ["admin", "super_admin"];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/acces/statut" && request.method === "POST") return statutAcces(request, env);
    if (url.pathname === "/acces/fin" && request.method === "POST") {
      return json({ fin: true }, { "Set-Cookie": cookieEfface() });
    }

    for (const outil of OUTILS_RELAYES) {
      if (url.pathname === outil.prefixe) {
        return Response.redirect(`${url.origin}${outil.prefixe}/${url.search}`, 301);
      }
      if (url.pathname.startsWith(`${outil.prefixe}/`)) {
        if (outil.surSite && !(await accesAutorise(request, env))) return pageRefus(outil, request);
        const cible = new URL(url.pathname.slice(outil.prefixe.length) + url.search, env[outil.origine]);
        const requete = new Request(cible, request);
        const service = env[outil.service];
        const reponse = service
          ? await service.fetch(requete, { redirect: "manual" })
          : await fetch(requete, { redirect: "manual" });
        // Une redirection de l'outil vers sa propre adresse ramenerait
        // l'agent hors du portail : on la ramene sous le prefixe.
        const location = reponse.headers.get("Location");
        if (location && reponse.status >= 300 && reponse.status < 400) {
          const l = new URL(location, cible);
          if (l.origin === cible.origin) {
            const entetes = new Headers(reponse.headers);
            entetes.set("Location", `${outil.prefixe}${l.pathname}${l.search}`);
            return new Response(reponse.body, { status: reponse.status, headers: entetes });
          }
        }
        if (!outil.surSite) return reponse;
        // La reponse depend de l'adresse de l'appelant : aucun cache partage.
        const entetes = new Headers(reponse.headers);
        entetes.set("Cache-Control", "private, no-store");
        return new Response(reponse.body, { status: reponse.status, headers: entetes });
      }
    }

    return env.ASSETS.fetch(request);
  },
};

/* ---------------------------------- regle du plateau ---------------------------------- */

function plagesPlateau(env) {
  return String(env.IP_PLATEAU || "").split(/[\s,;]+/).map((p) => p.trim()).filter(Boolean);
}

function surLePlateau(request, env) {
  const plages = plagesPlateau(env);
  if (plages.length === 0) return true; // regle pas encore configuree
  const ip = request.headers.get("CF-Connecting-IP") || "";
  return plages.some((plage) => ipDansPlage(ip, plage));
}

async function accesAutorise(request, env) {
  if (surLePlateau(request, env)) return true;
  return (await lireJetonHorsSite(request, env)) !== null;
}

// "41.202.10.5" ou "41.202.10.0/24", en IPv4 comme en IPv6.
function ipDansPlage(ip, plage) {
  const [base, longueurTexte] = plage.split("/");
  const a = versEntier(ip), b = versEntier(base);
  if (!a || !b || a.bits !== b.bits) return false;
  const longueur = longueurTexte === undefined ? a.bits : Number(longueurTexte);
  if (!Number.isInteger(longueur) || longueur < 0 || longueur > a.bits) return false;
  const decalage = BigInt(a.bits - longueur);
  return (a.valeur >> decalage) === (b.valeur >> decalage);
}

function versEntier(ip) {
  ip = String(ip || "").trim();
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
    const parts = ip.split(".").map(Number);
    if (parts.some((n) => n > 255)) return null;
    return { bits: 32, valeur: parts.reduce((v, n) => (v << 8n) + BigInt(n), 0n) };
  }
  if (ip.includes(":")) {
    const [tete, queue] = ip.split("::");
    if (ip.split("::").length > 2) return null;
    const groupes = (t) => (t ? t.split(":") : []);
    const g1 = groupes(tete), g2 = queue === undefined ? [] : groupes(queue);
    const manquants = 8 - g1.length - g2.length;
    if (queue === undefined ? manquants !== 0 : manquants < 0) return null;
    const tous = [...g1, ...Array(queue === undefined ? 0 : manquants).fill("0"), ...g2];
    if (tous.length !== 8 || tous.some((g) => !/^[0-9a-f]{1,4}$/i.test(g))) return null;
    return { bits: 128, valeur: tous.reduce((v, g) => (v << 16n) + BigInt(parseInt(g, 16)), 0n) };
  }
  return null;
}

/* ---------------------------------- exception administrateurs ---------------------------------- */

// Appele par la page d'accueil du portail, avec le jeton de session Supabase.
// Donne l'etat de l'acces aux outils du plateau, et pose (ou retire) le jeton
// hors site selon le role de la personne connectee.
async function statutAcces(request, env) {
  const restreint = plagesPlateau(env).length > 0;
  const surSite = surLePlateau(request, env);
  const jeton = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  let horsSite = false;
  let setCookie = null;

  if (jeton) {
    const personne = await personneConnectee(jeton, env);
    if (personne && ROLES_HORS_SITE.includes(personne.role) && personne.actif !== false && env.ACCES_SECRET) {
      horsSite = true;
      setCookie = await cookieHorsSite(personne.id, env);
    } else {
      // Toute autre personne connectee sur ce navigateur perd le jeton qu'un
      // administrateur y aurait laisse.
      setCookie = cookieEfface();
    }
  } else {
    horsSite = (await lireJetonHorsSite(request, env)) !== null;
  }

  return json({ restreint, surSite, horsSite }, setCookie ? { "Set-Cookie": setCookie } : {});
}

// Le jeton de session est verifie par Supabase lui-meme, puis le role est lu
// avec ce jeton : la regle d'acces de la table profils s'applique.
async function personneConnectee(jeton, env) {
  try {
    const entetes = { apikey: env.SUPABASE_KEY, Authorization: `Bearer ${jeton}` };
    const r = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers: entetes });
    if (!r.ok) return null;
    const user = await r.json();
    if (!user?.id) return null;
    const p = await fetch(`${env.SUPABASE_URL}/rest/v1/profils?select=id,role,actif&id=eq.${encodeURIComponent(user.id)}`, { headers: entetes });
    if (!p.ok) return null;
    const [profil] = await p.json();
    return profil || null;
  } catch {
    return null;
  }
}

async function cleHmac(env) {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(env.ACCES_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

function base64url(octets) {
  return btoa(String.fromCharCode(...new Uint8Array(octets))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function cookieHorsSite(id, env) {
  const expire = Math.floor(Date.now() / 1000) + DUREE_HORS_SITE_SECONDES;
  const charge = `${id}.${expire}`;
  const signature = base64url(await crypto.subtle.sign("HMAC", await cleHmac(env), new TextEncoder().encode(charge)));
  return `${COOKIE_HORS_SITE}=${charge}.${signature}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${DUREE_HORS_SITE_SECONDES}`;
}

function cookieEfface() {
  return `${COOKIE_HORS_SITE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

async function lireJetonHorsSite(request, env) {
  if (!env.ACCES_SECRET) return null;
  const valeur = (request.headers.get("Cookie") || "").split(/;\s*/)
    .find((c) => c.startsWith(`${COOKIE_HORS_SITE}=`))?.slice(COOKIE_HORS_SITE.length + 1);
  if (!valeur) return null;
  const [id, expire, signature] = valeur.split(".");
  if (!id || !expire || !signature || Number(expire) < Date.now() / 1000) return null;
  const attendue = base64url(await crypto.subtle.sign("HMAC", await cleHmac(env), new TextEncoder().encode(`${id}.${expire}`)));
  return attendue === signature ? id : null;
}

/* ---------------------------------- reponses ---------------------------------- */

function json(corps, entetes = {}) {
  return new Response(JSON.stringify(corps), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...entetes },
  });
}

function pageRefus(outil, request) {
  const accepte = request.headers.get("Accept") || "";
  const entetes = { "Cache-Control": "no-store" };
  if (!accepte.includes("text/html")) {
    return new Response("Accessible uniquement depuis le plateau XGS.", { status: 403, headers: { ...entetes, "Content-Type": "text/plain; charset=utf-8" } });
  }
  const page = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${outil.nom} — sur le plateau uniquement</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Poppins:wght@600&family=Inter:wght@400;600&display=swap" rel="stylesheet">
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box;
    background:radial-gradient(circle at 85% 0%,#1A2A8C 0%,#000B53 38%,#00052E 100%);color:#fff;font-family:Inter,system-ui,sans-serif}
  .carte{max-width:420px;text-align:center;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:18px;padding:32px 28px}
  h1{font-family:Poppins,sans-serif;font-weight:600;font-size:22px;margin:16px 0 8px} h1 span{color:#FDCF4F}
  p{color:#C7CBEB;font-size:14px;line-height:1.55;margin:0 0 22px}
  a{display:inline-block;background:#FDCF4F;color:#000B53;text-decoration:none;font-weight:600;font-size:14px;padding:11px 20px;border-radius:12px}
  a:focus-visible{outline:2px solid #FDCF4F;outline-offset:3px}
</style></head>
<body><div class="carte">
  <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#FDCF4F" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
  <h1>${outil.nom} s'utilise sur le plateau<span>.</span></h1>
  <p>Cet outil n'est accessible que depuis le réseau du plateau XGS. Méridien et Mon salaire restent disponibles depuis chez vous. Administrateurs : connectez-vous au portail pour y accéder.</p>
  <a href="/">Aller au portail</a>
</div></body></html>`;
  return new Response(page, { status: 403, headers: { ...entetes, "Content-Type": "text/html; charset=utf-8" } });
}
