import { PhoneCall, CalendarClock, Wallet, Activity, Telescope } from "lucide-react";

// Les outils XGS affiches sur la page d'accueil.
//
// url : adresse de l'outil. Un chemin (/aureo/) est servi par le portail, a
// la meme adresse : l'agent y est deja connecte. Une adresse complete
// (https://...) ouvre l'outil a son ancienne adresse, ou il faudra se
// reconnecter tant qu'il n'est pas passe sous le portail. Vide : l'outil est
// affiche mais pas encore accessible depuis le portail.
//
// Tous les outils sont visibles par tous pour commencer : chaque outil
// applique deja ses propres droits une fois ouvert.
//
// surSite : l'outil ne s'ouvre que depuis le reseau du plateau (sauf pour un
// administrateur) ; la regle est appliquee par le worker du portail.
//
// roles : la tuile n'est affichee qu'a ces roles (Zenith : administration et
// direction generale).
// L'outil verifie lui-meme le role a l'ouverture.
export const APPLICATIONS = [
  {
    id: "aureo",
    nom: "Auréo",
    description: "Centre d'appels : vos fiches, vos qualifications, vos résultats.",
    url: "/aureo/",
    icone: PhoneCall,
    surSite: true,
  },
  {
    id: "meridien",
    nom: "Méridien",
    description: "Planning des shifts.",
    url: "/meridien/",
    icone: CalendarClock,
  },
  {
    id: "salaire",
    nom: "Mon salaire",
    description: "Votre bulletin du mois, son détail et son évolution.",
    url: "/salaire/",
    icone: Wallet,
  },
  {
    id: "horizon",
    nom: "Horizon",
    description: "Suivi d'assiduité, à partir du passage en production dans Auréo.",
    url: "/horizon/",
    icone: Activity,
    surSite: true,
  },
  {
    id: "zenith",
    nom: "Zénith",
    description: "Pilotage des équipes : performances, présence et turnover.",
    url: "/zenith/",
    icone: Telescope,
    surSite: true,
    roles: ["admin", "super_admin", "direction"],
  },
];
