# SpeedFeet V3.3.0

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
