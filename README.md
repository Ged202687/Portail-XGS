# Portail XGS

Une seule connexion pour tous les outils XGS (Auréo, Méridien, Mon salaire,
Horizon). L'agent se connecte une fois sur le portail, arrive sur une page
d'accueil qui liste les outils, et chaque outil s'ouvre dans un nouvel
onglet, déjà connecté.

## Comment la connexion est partagée

Les quatre outils utilisent le même projet Supabase : un agent n'a qu'un
compte. Mais un navigateur isole les données de chaque adresse : un outil ne
voit la connexion faite sur un autre que s'ils sont **à la même adresse**.

Le portail sert donc les outils sous des dossiers de sa propre adresse :

| Adresse | Contenu |
|---|---|
| `/` | le portail : connexion, puis page d'accueil |
| `/aureo/` | Auréo |
| `/meridien/`, `/salaire/`, `/horizon/` | à venir, un outil à la fois |

La session est gardée par le client officiel Supabase, sous sa clé standard
(`sb-<projet>-auth-token`). Tout outil servi sous le portail et qui utilise ce
client la retrouve. Le client renouvelle aussi le jeton lui-même, en se
coordonnant entre onglets : c'est indispensable, car deux outils qui
renouvelleraient chacun la même session seraient pris par Supabase pour un
vol de jeton, et l'agent serait déconnecté partout.

La déconnexion depuis le portail ferme la session de tous les outils. Pour
Auréo, l'agent passe aussi « déconnecté » et sa pause en cours est close.

## Développement

```bash
# 1. Construire Auréo : le portail le sert en local sous /aureo/
cd ../aureo-app && npm run build

# 2. Lancer le portail
cd ../Portail-XGS && npm install && npm run dev
# -> http://localhost:5180 ; Auréo sous http://localhost:5180/aureo/
```

Autre emplacement d'Auréo construit : variable `AUREO_DIST`.

## Déploiement (Cloudflare)

Le portail est un Worker avec ses fichiers statiques (`wrangler.jsonc`).
Le Worker (`src/worker.js`) relaie `/aureo/*` vers le déploiement actuel
d'Auréo : **renseigner `AUREO_ORIGIN`** dans `wrangler.jsonc` avec l'adresse
réelle d'Auréo (Cloudflare, Workers & Pages, aureo-app).

Auréo reste accessible à son ancienne adresse, avec sa propre page de
connexion, tant que les agents n'ont pas pris l'habitude du portail.

## Ajouter un outil

1. Dans l'outil : utiliser le client officiel Supabase pour la connexion
   (clé de session standard), construire avec des chemins relatifs
   (`base: "./"` dans Vite), et renvoyer vers `/?retour=<son chemin>` quand
   il n'y a pas de session.
2. Dans le portail : l'ajouter à `OUTILS_RELAYES` (`src/worker.js`), à
   `run_worker_first` (`wrangler.jsonc`), et renseigner son `url` dans
   `src/applications.js`.

## Sur le serveur XGS

Le relais du Worker sera remplacé par la configuration du serveur web, avec un
dossier par outil. Par exemple avec nginx :

```nginx
location /        { root /srv/portail;  try_files $uri /index.html; }
location /aureo/  { alias /srv/aureo/;  try_files $uri /aureo/index.html; }
```

Les applications, elles, n'ont rien à changer.
