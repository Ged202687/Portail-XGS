import { useState, useEffect, useCallback } from "react";
import { Loader2, Lock, AlertTriangle, LogOut, ExternalLink, ArrowRight } from "lucide-react";
import { supabase, emailDepuisIdentifiant } from "./supabase.js";
import { APPLICATIONS } from "./applications.js";

// Identite XGS, reprise du logo : un bleu nuit profond, le soleil jaune
// dessine a la main, du blanc, et une typographie geometrique ronde (Poppins,
// celle du nom "Xperience Global Services"). Le portail est la porte d'entree
// de XGS : il porte ses couleurs, les outils gardent les leurs.
const C = {
  nuit: "#000B53", nuitProfonde: "#00052E", nuitClaire: "#0B1766",
  soleil: "#FDCF4F", soleilVoile: "rgba(253,207,79,0.14)",
  blanc: "#FFFFFF", lavande: "#C7CBEB", lavandeDouce: "#8F94BC",
  trait: "rgba(255,255,255,0.10)", carte: "rgba(255,255,255,0.05)",
  champ: "#F2F4F8",
};
const FONTS = "https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700&family=Inter:wght@400;500;600&display=swap";

const STYLES = `
  @import url('${FONTS}');
  * { box-sizing: border-box; }
  body { margin: 0; font-family: 'Inter', sans-serif; background: ${C.nuitProfonde}; }
  .disp { font-family: 'Poppins', sans-serif; letter-spacing: -0.01em; }
  button, input { font-family: inherit; }
  button { cursor: pointer; transition: transform .15s ease-out, filter .15s ease-out, border-color .15s ease-out, background-color .15s ease-out; }
  button:not(:disabled):hover { filter: brightness(1.06); }
  button:not(:disabled):active { transform: scale(.98); }
  button:disabled { cursor: not-allowed; opacity: .55; }
  :where(button, a, input, [tabindex]):focus-visible { outline: 2px solid ${C.soleil} !important; outline-offset: 3px; }
  .bouton-fantome:not(:disabled):hover { border-color: ${C.soleil} !important; filter: none; }
  .tuile { transition: transform .18s ease-out, box-shadow .18s ease-out, border-color .18s ease-out, background-color .18s ease-out; }
  .tuile .ouvrir { transition: transform .18s ease-out; }
  a.tuile:hover { transform: translateY(-3px); background-color: rgba(255,255,255,0.09) !important; border-color: rgba(253,207,79,0.55) !important; box-shadow: 0 22px 44px -22px rgba(0,0,0,0.7); }
  a.tuile:hover .ouvrir { transform: translateX(3px); }
  a.tuile:active { transform: translateY(-1px); }
  @keyframes spin { to { transform: rotate(360deg); } }
  .animate-spin { animation: spin 1s linear infinite; }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { transition-duration: .01ms !important; }
    a.tuile:hover, a.tuile:hover .ouvrir { transform: none; }
    .animate-spin { animation: spin 1s linear infinite !important; }
  }
`;

// Le soleil du logo, en filigrane : rayons et cercle aux traits arrondis,
// comme dessines a la main.
function SoleilFiligrane({ taille = 520, style }) {
  const rayons = Array.from({ length: 12 }, (_, i) => i * 30);
  return (
    <svg aria-hidden width={taille} height={taille} viewBox="0 0 200 200" style={{ position: "absolute", pointerEvents: "none", ...style }}>
      <g fill="none" stroke={C.soleil} strokeLinecap="round">
        <circle cx="100" cy="100" r="38" strokeWidth="5" />
        {rayons.map((a) => (
          <line key={a} x1="100" y1={a % 60 === 0 ? 34 : 40} x2="100" y2={a % 60 === 0 ? 14 : 24} strokeWidth="6" transform={`rotate(${a} 100 100)`} />
        ))}
        <path d="M84 96 q5 -6 10 0" strokeWidth="4" />
        <path d="M106 94 q5 -6 10 0" strokeWidth="4" />
        <path d="M88 112 q12 10 24 0" strokeWidth="4" />
      </g>
    </svg>
  );
}

const ROLES = {
  agent: "Agent", coach: "Coach", superviseur: "Superviseur",
  admin: "Administrateur", super_admin: "Super administrateur",
};

// Retour vers l'outil qui a envoye l'agent se connecter (?retour=/aureo/).
// Seulement un chemin de cette adresse : jamais une adresse exterieure, sinon
// n'importe quel lien pourrait renvoyer l'agent, connecte, vers un autre site.
function adresseDeRetour() {
  const r = new URLSearchParams(window.location.search).get("retour");
  return r && r.startsWith("/") && !r.startsWith("//") && !r.startsWith("/\\") ? r : null;
}

async function lireProfil(userId) {
  const { data, error } = await supabase.from("profils").select("id,nom,role,actif,doit_changer_mdp").eq("id", userId).maybeSingle();
  if (error) throw new Error("Impossible de lire votre profil. Réessayez dans un instant.");
  if (!data) throw new Error("Aucun profil n'est associé à ce compte. Contactez un administrateur.");
  if (data.actif === false) throw new Error("Ce compte a été désactivé. Contactez un administrateur.");
  return data;
}

export default function App() {
  const [etat, setEtat] = useState("chargement"); // chargement | connexion | mot_de_passe | accueil
  const [profil, setProfil] = useState(null);
  const [erreur, setErreur] = useState(null);

  // Une fois connecte (et le mot de passe a jour), on retourne a l'outil qui
  // a demande la connexion, dans le meme onglet ; sinon, page d'accueil.
  const entrer = useCallback((p) => {
    setProfil(p);
    if (p.doit_changer_mdp) { setEtat("mot_de_passe"); return; }
    const retour = adresseDeRetour();
    if (retour) { window.location.replace(retour); return; }
    setEtat("accueil");
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setEtat("connexion"); return; }
      try { entrer(await lireProfil(session.user.id)); }
      catch (e) { await supabase.auth.signOut({ scope: "local" }); setErreur(e.message); setEtat("connexion"); }
    })();
    // Deconnexion depuis un outil ouvert dans un autre onglet : on revient a
    // l'ecran de connexion.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((evenement) => {
      if (evenement === "SIGNED_OUT") { setProfil(null); setEtat("connexion"); }
    });
    return () => subscription.unsubscribe();
  }, [entrer]);

  async function seConnecter(identifiant, motDePasse) {
    setErreur(null);
    const email = await emailDepuisIdentifiant(identifiant.trim());
    if (!email) throw new Error("Identifiant inconnu.");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: motDePasse });
    if (error) throw new Error(error.message === "Invalid login credentials" ? "Identifiant ou mot de passe incorrect." : error.message);
    try { entrer(await lireProfil(data.user.id)); }
    catch (e) { await supabase.auth.signOut({ scope: "local" }); throw e; }
  }

  // Deconnexion de tous les outils a la fois. Pour Auréo, l'agent est aussi
  // passe "deconnecte" et sa pause en cours est close : sans cela, un agent
  // parti depuis le portail resterait "en production" pour la supervision.
  async function seDeconnecter() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      try { await supabase.from("pause_details").update({ fin: new Date().toISOString() }).eq("agent_id", session.user.id).is("fin", null); } catch {}
      try { await supabase.rpc("set_my_status", { p_statut: "deconnecte" }); } catch {}
    }
    try { localStorage.removeItem("aureo_ouverture"); } catch {}
    await finAccesHorsSite();
    await supabase.auth.signOut();
    setProfil(null);
    setEtat("connexion");
  }

  return (
    <>
      <style>{STYLES}</style>
      {etat === "chargement" && <Chargement />}
      {etat === "connexion" && <Connexion onConnexion={seConnecter} erreurInitiale={erreur} retour={adresseDeRetour()} />}
      {etat === "mot_de_passe" && <NouveauMotDePasse onFait={() => entrer({ ...profil, doit_changer_mdp: false })} onDeconnexion={seDeconnecter} />}
      {etat === "accueil" && profil && <Accueil profil={profil} onDeconnexion={seDeconnecter} />}
    </>
  );
}

/* ---------------------------------- ecrans d'entree ---------------------------------- */

function FondNuit({ children }) {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      background: `radial-gradient(circle at 18% 20%, #1A2A8C 0%, ${C.nuit} 45%, ${C.nuitProfonde} 100%)`,
      position: "relative", overflow: "hidden",
    }}>
      <div aria-hidden style={{ position: "absolute", width: 520, height: 520, borderRadius: "50%", background: C.soleil, opacity: 0.10, filter: "blur(90px)", top: -160, right: -140 }} />
      <div aria-hidden style={{ position: "absolute", width: 420, height: 420, borderRadius: "50%", background: "#3B4FA8", opacity: 0.22, filter: "blur(100px)", bottom: -160, left: -120 }} />
      <SoleilFiligrane taille={460} style={{ top: -120, right: -120, opacity: 0.12 }} />
      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 24, width: "100%", maxWidth: 360 }}>
        {children}
      </div>
    </div>
  );
}

function Chargement() {
  return (
    <FondNuit>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#A6ADBA", fontSize: 13 }}>
        <Loader2 size={16} className="animate-spin" /> Connexion en cours…
      </div>
    </FondNuit>
  );
}

const styleChamp = {
  width: "100%", background: C.champ, border: "1.5px solid transparent", borderRadius: 10,
  padding: "12px 14px", fontSize: 13.5, marginTop: 6, color: C.nuit,
};
const styleLibelle = { fontSize: 11, fontWeight: 600, color: C.lavandeDouce, letterSpacing: "0.04em", textTransform: "uppercase" };
const styleCarte = { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(20px)", borderRadius: 18, padding: 28, width: "100%", boxShadow: "0 30px 60px -20px rgba(0,0,0,0.5)" };
const styleBoutonPrincipal = { width: "100%", background: C.soleil, color: "#00051F", border: "none", borderRadius: 10, padding: "12px 0", fontSize: 13.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 };

function Erreur({ message }) {
  return (
    <div role="alert" style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(198,73,63,0.15)", color: "#E8938C", borderRadius: 9, padding: "9px 11px", fontSize: 12, marginBottom: 16 }}>
      <AlertTriangle size={13} style={{ flexShrink: 0 }} /> {message}
    </div>
  );
}

function Connexion({ onConnexion, erreurInitiale, retour }) {
  const [identifiant, setIdentifiant] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState(erreurInitiale);
  const [occupe, setOccupe] = useState(false);

  async function envoyer(e) {
    e.preventDefault();
    setOccupe(true); setErreur(null);
    try { await onConnexion(identifiant, motDePasse); }
    catch (err) { setErreur(err.message); setOccupe(false); }
  }

  const outil = retour && APPLICATIONS.find((a) => a.url && retour.startsWith(a.url));

  return (
    <FondNuit>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <img src="/logo-xgs.png" alt="Xperience Global Services" style={{ width: 230, height: "auto", borderRadius: 12 }} />
        <div style={{ textAlign: "center" }}>
          <div className="disp" style={{ fontSize: 14, fontWeight: 600, color: C.soleil, letterSpacing: "0.12em", textTransform: "uppercase" }}>Portail XGS</div>
          <p style={{ fontSize: 13, color: C.lavande, marginTop: 6, marginBottom: 0 }}>
            {outil ? `Connectez-vous pour ouvrir ${outil.nom}` : "Une seule connexion pour tous vos outils"}
          </p>
        </div>
      </div>

      <form onSubmit={envoyer} style={styleCarte}>
        <div style={{ marginBottom: 16 }}>
          <label htmlFor="identifiant" style={styleLibelle}>Identifiant</label>
          <input id="identifiant" type="text" autoComplete="username" autoCapitalize="none" autoCorrect="off" required
            value={identifiant} onChange={(e) => setIdentifiant(e.target.value)} style={styleChamp} />
        </div>
        <div style={{ marginBottom: 24 }}>
          <label htmlFor="mot-de-passe" style={styleLibelle}>Mot de passe</label>
          <input id="mot-de-passe" type="password" autoComplete="current-password" required
            value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} style={styleChamp} />
        </div>
        {erreur && <Erreur message={erreur} />}
        <button type="submit" disabled={occupe} style={styleBoutonPrincipal}>
          {occupe ? <Loader2 size={15} className="animate-spin" /> : <Lock size={14} />} Se connecter
        </button>
      </form>

      <p style={{ fontSize: 11.5, color: C.lavandeDouce, lineHeight: 1.5, textAlign: "center", margin: 0 }}>
        Votre identifiant est le même que dans Auréo. Les comptes sont créés par un administrateur.
      </p>
    </FondNuit>
  );
}

function NouveauMotDePasse({ onFait, onDeconnexion }) {
  const [mdp, setMdp] = useState("");
  const [mdp2, setMdp2] = useState("");
  const [erreur, setErreur] = useState(null);
  const [occupe, setOccupe] = useState(false);

  async function envoyer(e) {
    e.preventDefault();
    setErreur(null);
    if (mdp.length < 8) { setErreur("Le mot de passe doit contenir au moins 8 caractères."); return; }
    if (mdp !== mdp2) { setErreur("Les deux mots de passe ne correspondent pas."); return; }
    setOccupe(true);
    const { error } = await supabase.auth.updateUser({ password: mdp });
    if (error) { setErreur(error.message); setOccupe(false); return; }
    try { await supabase.rpc("mark_password_changed"); } catch {}
    onFait();
  }

  return (
    <FondNuit>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, textAlign: "center" }}>
        <img src="/logo-xgs-carre.png" alt="" style={{ width: 44, height: 44, borderRadius: 10 }} />
        <div className="disp" style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>Nouveau mot de passe requis</div>
        <p style={{ fontSize: 12.5, color: "#8B93A3", margin: 0, maxWidth: 320, lineHeight: 1.5 }}>
          Pour la sécurité de votre compte, choisissez un mot de passe personnel avant de continuer. Il servira pour tous vos outils.
        </p>
      </div>
      <form onSubmit={envoyer} style={styleCarte}>
        <div style={{ marginBottom: 16 }}>
          <label htmlFor="mdp" style={styleLibelle}>Nouveau mot de passe</label>
          <input id="mdp" type="password" autoComplete="new-password" required value={mdp} onChange={(e) => setMdp(e.target.value)} style={styleChamp} />
        </div>
        <div style={{ marginBottom: 24 }}>
          <label htmlFor="mdp2" style={styleLibelle}>Confirmer le mot de passe</label>
          <input id="mdp2" type="password" autoComplete="new-password" required value={mdp2} onChange={(e) => setMdp2(e.target.value)} style={styleChamp} />
        </div>
        {erreur && <Erreur message={erreur} />}
        <button type="submit" disabled={occupe} style={styleBoutonPrincipal}>
          {occupe && <Loader2 size={14} className="animate-spin" />} Valider et continuer
        </button>
      </form>
      <button onClick={onDeconnexion} style={{ background: "none", border: "none", color: "#8B93A3", fontSize: 12 }}>Se déconnecter</button>
    </FondNuit>
  );
}

/* ---------------------------------- acces aux outils du plateau ---------------------------------- */

// Auréo et Horizon ne s'ouvrent que depuis le plateau, sauf pour un
// administrateur. Le worker du portail applique la regle ; il donne ici l'etat
// (sur le plateau ou non) et pose le jeton hors site d'un administrateur.
// Sans reponse (developpement local, coupure), les tuiles restent ouvertes :
// c'est le worker qui decide de toute facon a l'ouverture de l'outil.
async function statutAccesPlateau() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const r = await fetch("/acces/statut", {
      method: "POST",
      headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
      credentials: "same-origin",
    });
    if (!r.ok || !(r.headers.get("Content-Type") || "").includes("application/json")) return null;
    return await r.json();
  } catch {
    return null;
  }
}

async function finAccesHorsSite() {
  try { await fetch("/acces/fin", { method: "POST", credentials: "same-origin" }); } catch {}
}

/* ---------------------------------- accueil ---------------------------------- */

function Accueil({ profil, onDeconnexion }) {
  const [occupe, setOccupe] = useState(false);
  const [acces, setAcces] = useState(null);
  useEffect(() => { statutAccesPlateau().then(setAcces); }, []);
  const horsPlateau = Boolean(acces?.restreint && !acces.surSite);
  // Les noms sont saisis "NOM Prénoms" : le prénom est le premier mot qui
  // n'est pas en majuscules ("GOLE Lou Bouzié" -> Lou). A defaut, le nom entier.
  const mots = (profil.nom || "").trim().split(/\s+/);
  const prenom = mots.find((m) => /[a-zà-ÿ]/.test(m)) || profil.nom || "";
  const maintenant = new Date();
  const salut = maintenant.getHours() < 18 ? "Bonjour" : "Bonsoir";
  const jour = maintenant.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div style={{
      minHeight: "100vh", color: C.blanc, position: "relative", overflow: "hidden",
      background: `radial-gradient(circle at 85% 0%, #1A2A8C 0%, ${C.nuit} 38%, ${C.nuitProfonde} 100%)`,
      display: "flex", flexDirection: "column",
    }}>
      <div aria-hidden style={{ position: "absolute", width: 620, height: 620, borderRadius: "50%", background: C.soleil, opacity: 0.045, filter: "blur(120px)", top: -300, right: -220 }} />
      <SoleilFiligrane taille={560} style={{ top: -150, right: -150, opacity: 0.13 }} />

      <header style={{ position: "relative", zIndex: 1 }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <img src="/logo-xgs-carre.png" alt="" style={{ width: 40, height: 40, borderRadius: 10, boxShadow: "0 0 0 1px rgba(255,255,255,0.12)" }} />
            <div style={{ minWidth: 0 }}>
              <div className="disp" style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.1 }}>Portail XGS</div>
              <div style={{ fontSize: 11, color: C.lavandeDouce }}>Xperience Global Services</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, minWidth: 0 }}>
            <div style={{ textAlign: "right", minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{profil.nom}</div>
              <div style={{ fontSize: 11, color: C.lavandeDouce }}>{ROLES[profil.role] || profil.role}</div>
            </div>
            <button className="bouton-fantome" onClick={async () => { setOccupe(true); await onDeconnexion(); }} disabled={occupe}
              title="Vous déconnecte aussi de tous les outils ouverts"
              style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", color: C.blanc, border: `1px solid ${C.trait}`, borderRadius: 999, padding: "8px 14px", fontSize: 12.5, fontWeight: 600, flexShrink: 0 }}>
              {occupe ? <Loader2 size={13} className="animate-spin" /> : <LogOut size={13} />} Se déconnecter
            </button>
          </div>
        </div>
      </header>

      <main style={{ position: "relative", zIndex: 1, flex: 1, width: "100%", maxWidth: 1080, margin: "0 auto", padding: "48px 24px 32px" }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.soleil, letterSpacing: "0.12em", textTransform: "uppercase" }}>{jour}</div>
        <h1 className="disp" style={{ fontSize: 40, fontWeight: 700, margin: "8px 0 0", lineHeight: 1.1 }}>
          {salut}{prenom ? ` ${prenom}` : ""}<span style={{ color: C.soleil }}>.</span>
        </h1>
        <p style={{ fontSize: 15, color: C.lavande, marginTop: 12, marginBottom: horsPlateau ? 16 : 40, maxWidth: 520, lineHeight: 1.55 }}>
          Choisissez un outil : il s'ouvre dans un nouvel onglet, et vous y êtes déjà connecté.
        </p>
        {horsPlateau && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, maxWidth: 620, marginBottom: 32, background: C.soleilVoile, border: "1px solid rgba(253,207,79,0.3)", borderRadius: 12, padding: "10px 14px", fontSize: 13, color: C.blanc, lineHeight: 1.5 }}>
            <Lock size={15} color={C.soleil} style={{ flexShrink: 0 }} />
            {acces.horsSite
              ? "Vous êtes hors du plateau : Auréo et Horizon restent ouverts pour vous, en tant qu'administrateur."
              : "Vous êtes hors du plateau : Auréo et Horizon ne s'ouvrent que depuis le réseau XGS. Méridien et Mon salaire restent disponibles."}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
          {APPLICATIONS.map((a) => (
            <Tuile key={a.id} app={a}
              bloque={a.surSite && horsPlateau && !acces.horsSite}
              horsSite={a.surSite && horsPlateau && acces.horsSite} />
          ))}
        </div>
      </main>

      <footer style={{ position: "relative", zIndex: 1, textAlign: "center", padding: "24px", fontSize: 11.5, color: C.lavandeDouce }}>
        Xperience Global Services · Abidjan
      </footer>
    </div>
  );
}

function Tuile({ app, bloque, horsSite }) {
  const Icone = app.icone;
  const disponible = Boolean(app.url) && !bloque;
  const externe = disponible && /^https?:\/\//.test(app.url);
  const contenu = (
    <>
      <div style={{ width: 48, height: 48, borderRadius: 14, background: disponible ? C.soleil : C.trait, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20, boxShadow: disponible ? "0 10px 24px -10px rgba(253,207,79,0.55)" : "none" }}>
        <Icone size={22} color={disponible ? C.nuit : C.lavandeDouce} strokeWidth={2.2} />
      </div>
      <div className="disp" style={{ fontSize: 19, fontWeight: 600, color: disponible ? C.blanc : C.lavande }}>{app.nom}</div>
      <div style={{ fontSize: 13.5, color: C.lavande, marginTop: 6, lineHeight: 1.5, flex: 1 }}>{app.description}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 20, fontSize: 12.5, fontWeight: 600, color: disponible ? C.soleil : C.lavandeDouce }}>
        {bloque ? (
          <><Lock size={13} /> Sur le plateau uniquement</>
        ) : !disponible ? "Bientôt accessible depuis le portail" : (
          <>
            {externe ? "Ouvrir (connexion séparée)" : horsSite ? "Ouvrir (hors plateau)" : "Ouvrir"}
            <span className="ouvrir" style={{ display: "inline-flex" }}>{externe ? <ExternalLink size={14} /> : <ArrowRight size={14} />}</span>
          </>
        )}
      </div>
    </>
  );
  const style = {
    display: "flex", flexDirection: "column", minHeight: 220, background: C.carte, border: `1px solid ${C.trait}`,
    borderRadius: 18, padding: 24, textDecoration: "none", color: "inherit", backdropFilter: "blur(12px)",
  };

  // Un lien, et non un bouton : il s'ouvre dans un nouvel onglet, et se laisse
  // aussi ouvrir au clic molette ou au clavier comme n'importe quel lien.
  return disponible ? (
    <a className="tuile" href={app.url} target="_blank" rel="noopener noreferrer" style={style} aria-label={`Ouvrir ${app.nom} dans un nouvel onglet`}>
      {contenu}
    </a>
  ) : (
    <div className="tuile" style={{ ...style, background: "transparent", borderStyle: "dashed" }} aria-disabled="true">
      {contenu}
    </div>
  );
}
