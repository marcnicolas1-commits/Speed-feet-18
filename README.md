# SpeedFeet V3.3.2

Évolutions :
- Retour fiable au cadran après enregistrement des paramètres pendant une navigation.
- Le suivi GPS n’est pas redémarré inutilement lors du retour des paramètres.
- Bouton « Retour à la navigation » sur l’accueil lorsqu’une navigation est active.
- Protection avant de préparer une nouvelle navigation : reprendre, abandonner ou annuler.
- Navigation active conservée dans le stockage local jusqu’à sa fin ou son abandon explicite.
- Version et cache PWA mis à jour en 3.2.0.


## V3.2.0
- Bilan automatique ouvert après chaque navigation.
- Analyse synthétique enrichie avec vitesse moyenne, manœuvres et score.
- 80 succès environ, réalistes, sûrs et réalisables en deux saisons régulières.
- Succès obtenus affichés sous forme de collection, sans points, niveaux ni filtres.


## V3.2.1
- Suppression complète des points et niveaux.
- Les succès non débloqués sont désormais totalement invisibles.
- La page affiche uniquement la collection des succès obtenus.
- Ajout d’un compteur X / 82 et d’une barre de progression.
- Notifications de déblocage conservées, sans attribution de points.


## V3.2.2
- Suppression du bloc « Prêt à naviguer » afin de remonter le bouton Nouvelle navigation.
- Ajout de la tuile « À faire sur le bateau » entre Nouvelle navigation et les cadrans.
- Affichage sur l’accueil des trois dernières tâches ajoutées.
- Seul le titre de la tuile ouvre la page complète afin de préserver le défilement.
- Cases à cocher disponibles sur l’accueil et dans la liste complète, sans suppression automatique.
- Ajout et suppression manuelle des tâches avec confirmation.
- Les remarques « À penser pour la prochaine navigation » sont ajoutées automatiquement à la liste après une navigation.
- Les tâches sont incluses dans les sauvegardes SpeedFeet.


## V3.2.3
- Analyse des réglages au près par tranches de vent de 5 nds.
- Conservation stricte des valeurs existantes inscrites sur le bateau.
- Recommandation visible sous chaque réglage pendant la navigation.
- Seuil de 3 observations pour une tendance et 5 pour une valeur validée.
- Explication détaillée dans l’analyse après navigation.
- Aucune recommandation affichée lorsque les données ou l’allure ne sont pas adaptées.


## V3.2.4
- Ajout dans l’onglet Apprentissage d’un tableau « Réglages appris au près ».
- Colonnes fixes par force de vent : 0–5, 5–10, 10–15, 15–20 et 20+ nds.
- Lignes correspondant à tous les réglages enregistrés du bateau.
- Chaque case affiche la valeur conseillée et son niveau de confiance.
- Même moteur de calcul que les recommandations visibles pendant la navigation.
- Tableau utilisable avant la sortie comme base de préparation du bateau.

## V3.3.0
- Vitesse GPS calculée sur environ 3 secondes avec lissage léger et conservation de la valeur brute iOS.
- Cap calculé sur environ 5 secondes avec lissage angulaire.
- Confirmation temporaire « GPS actualisé » après une actualisation manuelle.
- Export d’une navigation individuelle depuis son débriefing.
- Traces du débriefing et de la relecture colorées selon le pourcentage de polaire.
- Analyse des virements et empannages basée sur la détection de la nouvelle route stabilisée.
- Faux zéros et points GPS de mauvaise précision moins pénalisants dans les notes.


## V3.3.1
- Barre lumineuse au-dessus des commandes de navigation après chaque changement de réglage.
- Orange pendant les 2 minutes de stabilisation, puis verte pendant les 2 minutes de mesure.
- Progression fondée sur l'heure réelle, y compris après verrouillage ou reprise de l'application.
- Toucher la barre affiche la phase et le temps restant.
- Nouveau réglage : cycle remis à zéro et confirmation temporaire.
- Fin du cycle : message « Réglage enregistré ».

## V3.3.2 — Sauvegarde robuste (4 octobre 2026)
- Journal IndexedDB : seuls les nouveaux points GPS sont écrits, avec les métadonnées dans la même transaction, toutes les 5 secondes et tous les 5 points.
- Reprise automatique de la navigation sauvegardée après fermeture ; nouvelle sauvegarde au passage en arrière-plan.
- Fin de navigation atomique : historique enregistré et journal supprimé dans une seule transaction. En cas d’échec, navigation conservée, message visible et possibilité de réessayer/exporter.
- Succès conservés séparément dès leur détection, y compris pendant la navigation, et inclus dans les exports/imports.
- Migration automatique de l’ancien historique et de la navigation active. Les anciennes données ne sont retirées qu’après confirmation de l’écriture.
- Demande de stockage persistant au navigateur ; démarrage bloqué si le stockage est indisponible.
- Cache PWA mis à jour ; conserver la même adresse de l’application pour retrouver ses données.

Validation automatisée : 10 800 points (3 h à 1 Hz), fermeture sans terminer, reprise, transaction finale avortée, réessai sans doublon, migration, checkpoint avorté et réessayé, abandon et stockage indisponible. Exécution dans Chromium ; essai réel iPhone/PWA et en mer restant à faire. La fermeture brutale peut perdre les derniers points depuis la dernière transaction. Les restrictions iOS en arrière-plan peuvent interrompre le GPS et les temporisateurs.

Tests : `npm install --no-save playwright`, `npx playwright install chromium`, puis `node tests/persistence.cjs`. Le test lance son propre serveur local. `CHROMIUM_EXECUTABLE` permet de fournir un navigateur déjà installé.
