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

const OUTILS_RELAYES = [
  { prefixe: "/aureo", origine: (env) => env.AUREO_ORIGIN },
  { prefixe: "/meridien", origine: (env) => env.MERIDIEN_ORIGIN },
  { prefixe: "/salaire", origine: (env) => env.SALAIRE_ORIGIN },
  { prefixe: "/horizon", origine: (env) => env.HORIZON_ORIGIN },
];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    for (const outil of OUTILS_RELAYES) {
      if (url.pathname === outil.prefixe) {
        return Response.redirect(`${url.origin}${outil.prefixe}/${url.search}`, 301);
      }
      if (url.pathname.startsWith(`${outil.prefixe}/`)) {
        const cible = new URL(url.pathname.slice(outil.prefixe.length) + url.search, outil.origine(env));
        const reponse = await fetch(new Request(cible, request), { redirect: "manual" });
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
        return reponse;
      }
    }

    return env.ASSETS.fetch(request);
  },
};
