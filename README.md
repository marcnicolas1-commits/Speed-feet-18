SpeedFeet Analyzer v2.4.0

# ⛵ SpeedFeet Analyzer

SpeedFeet Analyzer est une Progressive Web App (PWA) conçue pour enregistrer et analyser les performances d’un voilier pendant les entraînements et les régates.

L’application fonctionne hors ligne et permet une saisie rapide des données directement à bord.

## Version actuelle

**Version 2.3.3**

## Fonctionnalités

### Navigation

- Préparation d’une navigation
- Enregistrement GPS
- Affichage de la trace sur une carte
- Calcul de la vitesse
- Calcul de la distance parcourue
- Chronométrage de la navigation
- Calcul de la VMG
- Ajout immédiat de marqueurs

### Conditions météo

- Capture météo
- Vent moyen
- Rafales
- Direction du vent
- État de la mer
- Notes météo

### Réglages du bateau

Enregistrement rapide de réglages prédéfinis :

- Chariot de grand-voile
- Chariot de foc
- Rotation du mât
- Cunningham
- Bordure
- Écoute de grand-voile

### Historique

- Sauvegarde locale des navigations
- Affichage des dernières sorties
- Consultation de l’historique
- Consultation des statistiques disponibles

### Paramètres

- Nom du bateau
- Configuration par défaut
- Import d’une polaire

## Fonctionnement hors ligne

Les fichiers principaux de l’application sont mis en cache par un Service Worker.

Les données de navigation sont enregistrées localement sur l’appareil. Une suppression des données du navigateur ou de l’application peut donc effacer l’historique.

Après une mise à jour, il peut être nécessaire de fermer puis de rouvrir l’application afin de charger la nouvelle version.

## Installation

L’application peut être installée depuis un navigateur compatible avec les Progressive Web Apps.

Sur iPhone ou iPad :

1. Ouvrir l’application dans Safari.
2. Utiliser le bouton de partage.
3. Choisir **Sur l’écran d’accueil**.

## Compatibilité

Compatibilité prévue avec :

- iPhone
- iPad
- Android
- Tablettes Android
- Windows
- macOS

L’accès au GPS et certaines fonctions PWA nécessitent généralement une connexion HTTPS ou un environnement local autorisé.

## Technologies

- HTML5
- CSS3
- JavaScript
- Progressive Web App
- API de géolocalisation du navigateur

## Évolutions envisagées

- Synchronisation et sauvegarde en ligne
- Partage de navigations
- Comparaison avec les polaires
- Analyse automatique des performances
- Conseils de réglages
- Détection des virements et empannages

## Projet

Projet personnel développé pour améliorer l’analyse des performances en navigation sportive.

## Licence

Projet privé.  
Tous droits réservés.

© 2026 SpeedFeet Analyzer


Mise à jour v2.4.0 : écran navigation simplifié, cap GPS, heure du téléphone, marqueurs de manœuvres, réglages numérotés 1 à 5, analyse après 2 minutes de stabilisation et carte satellite dans l’historique.
