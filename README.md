# SpeedFeet Analyzer V2.0.0

Première version testable de la V2.

## Inclus
- Interface responsive iPhone / iPad / Mac.
- Base locale IndexedDB persistante entre mises à jour du site.
- Écran « Avant de partir » avec check-list, réparations et essais.
- Mode navigation avec gros bouton de marqueur, heure, GPS et dictée vocale.
- Import Velocitek VCC, carte, replay, virements et empannages.
- Palette de vitesse fixe 0 à 12 nœuds par pas interne de 0,5 nœud.
- Carnet, débriefing et rappels pour la sortie suivante.
- Sauvegarde locale `.sfbackup` et restauration.
- PWA avec service worker.

## Installation Cloudflare Pages / GitHub
Remplacer les fichiers du dépôt par `index.html`, `manifest.webmanifest` et `sw.js`, puis valider le commit. Cloudflare Pages republiera automatiquement le site.

## Limites connues de cette première V2
- Chaque appareil conserve sa propre base locale. Pour passer de l’iPhone au Mac ou à l’iPad, utiliser Sauvegarder / Restaurer.
- La reconnaissance vocale dépend de Safari/iOS. Si elle n’est pas disponible, une saisie texte rapide est proposée.
- Le mode hors ligne couvre le cœur de l’application après une première visite. Le fond de carte Leaflet nécessite encore le réseau sauf tuiles déjà mises en cache.
- Le rapprochement automatique entre marqueurs iPhone et trace VCC sera ajouté après le premier test réel.
