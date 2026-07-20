# SpeedFeet Analyzer V2.1.1

Première version modulaire du projet.

## Structure

- `index.html` : structure de l’application
- `styles.css` : présentation et responsive
- `app.js` : logique de l’application
- `manifest.webmanifest` : installation PWA
- `sw.js` : fonctionnement hors ligne

## Fonctions incluses

- Une navigation = un bloc indépendant
- Checklist permanente avec cases remises à zéro
- Marqueurs Virement / Empannage / Commentaire
- Numérotation automatique des manœuvres
- Débriefing lié à la bonne navigation
- Carnet avec ouverture, renommage et suppression
- Import VCC lié à une navigation existante
- Export et import des données
- Fusion ou remplacement lors de l’import
- PWA et cache hors ligne

## Mise en ligne sur GitHub

Remplacer les anciens fichiers du dépôt par les fichiers de ce dossier :

- `index.html`
- `styles.css`
- `app.js`
- `manifest.webmanifest`
- `sw.js`

Puis valider le commit. Cloudflare Pages republiera le site automatiquement.

## Important après la mise à jour

Le service worker utilise un nouveau cache. Sur iPhone, Mac ou iPad, actualiser une fois la page après le déploiement.


## Correctifs V2.1.1

- Le Carnet redevient visible après avoir ouvert une fiche.
- Un clic sur une sortie de l’accueil ouvre directement sa fiche.
- Les points Virement/Empannage affichent heure, vitesse et cap au survol ou au clic.
