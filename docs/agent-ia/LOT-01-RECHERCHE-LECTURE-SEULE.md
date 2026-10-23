# Mon Toit — SUTA agent locatif, lot 01

Statut : conception technique, sans activation en production.

## Décision
Conserver SUTA et les parcours métier existants. Premier outil agentique : recherche de biens **en lecture seule**, à partir des annonces effectivement publiées et actives. Aucune réservation, candidature, paiement, signature ou écriture n'est autorisée dans ce lot.

## État constaté dans le dépôt
- `src/components/suta-chatbot.tsx` appelle `/api/suta`.
- `src/app/api/suta/route.ts` appelle Azure OpenAI sans outil métier ; l'historique est une Map en mémoire, indexée par un identifiant de session client.
- `src/app/api/properties/route.ts` expose des filtres (commune, type, prix, chambres, meublé) et une sélection publique de biens actifs.
- `src/lib/auth/request-user.ts` comporte un repli `getSession()` à examiner avant toute capacité agentique avec données privées.

## Contrat fonctionnel du premier outil
Entrée structurée : `commune?`, `type?`, `prix_max_fcfa?`, `chambres_min?`, `meuble?`, `limit` (1–5). Valider et borner chaque champ côté serveur ; ne jamais injecter directement des chaînes générées par le modèle dans des filtres SQL/PostgREST.

Sortie : liste limitée de biens actifs avec identifiant, titre, commune, prix, caractéristiques et lien interne de consultation. Une liste vide est présentée comme telle, sans inventer de biens. Aucun champ personnel, brouillon, annonce en attente ou donnée administrative.

## Garde-fous préalables à l'activation
1. Vérifier le comportement et les politiques de visibilité de `/api/properties` et le filtrage des mandats.
2. Isoler les conversations par utilisateur authentifié ; supprimer la possibilité de supprimer l'historique d'autrui via un simple `sessionId`.
3. Corriger le prompt SUTA : dénomination de l'ANSUT et promesses de certification/validation non démontrées.
4. Revoir `resolveRequestUser` : ne pas considérer une session client non vérifiée comme preuve d'identité.
5. Ajouter journalisation minimale, quotas, timeout et gestion des erreurs sans exposer de données sensibles.
6. Tests : filtres et bornes, aucune annonce non active, séparation des utilisateurs, injection dans les filtres, absence d'écriture, résultat vide, panne du modèle, régression du chatbot existant.

## Critères de GO
Tests exécutés sur une base de recette représentative ; revue sécurité validée ; cinq scénarios conversationnels montrant des résultats identiques aux données métier ; aucun changement aux parcours existants ; validation explicite avant déploiement.

## Hors périmètre
Paiements, signatures, candidatures automatiques, décisions de vérification, actions sur les baux, modification de base, changement de fournisseur IA, refonte UI.
