import { PhoneCall, CalendarClock, Wallet, Activity } from "lucide-react";

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
export const APPLICATIONS = [
  {
    id: "aureo",
    nom: "Auréo",
    description: "Centre d'appels : vos fiches, vos qualifications, vos résultats.",
    url: "/aureo/",
    icone: PhoneCall,
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
  },
];
