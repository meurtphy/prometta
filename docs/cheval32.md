📚 Feuille de route technique Brutux

🏛 Fondations du projet

Projet : Brutux – Outil d’audit UX/UI automatisé

Objectif : Générer, structurer et restituer automatiquement des audits UX basés sur ChatGPT, avec collecte intelligente de données, stockage, scoring, espace client, etc.

❌ cheval32 – Liste des 6 problèmes critiques + solutions

1. Dépendance excessive à ChatGPT sans cadre de qualité

Problème : Réponses génériques, peu professionnelles.

Solution : Prompt builder structurant, post-processing, contrôle du ton et du format.

2. Pas d'analyse réelle du site (détaillé ci-dessous ↓)

Problème : GPT hallucine faute de données.

Solution : Module de crawl automatisé (voir cheval31).

3. Pas de versioning ou historique clair des audits

Problème : Pas de suivi de l’évolution, pertes de données.

Solution : Stockage audit horodaté + versionné + comparaison.

4. Prompts non modulaires, rigides

Problème : Impossible de mettre à jour facilement.

Solution : Base de prompts dynamiques (type, catégorie, version, activé).

5. Pas de scoring ni synthèse UX

Problème : Rapport illisible, trop long.

Solution : GPT forcé de donner des scores, prioriser, synthétiser.

6. Système non scalable

Problème : GPT et crawl bloquants.

Solution : Job queue async, workers, orchestrateurs.

🚧 cheval31 – Contraintes et risques liés à l’usage d’un crawler (DOM, performance, accessibilité)

1. Temps de traitement long

✅ Solution : Asynchronisme + file d’attente.

2. Blocages par les sites

✅ Solution : User-agent custom, retry, proxy.

3. Quotas et dépendance aux API externes

✅ Solution : Caching + fallback local (Lighthouse CLI).

4. DOM incomplet / chargement dynamique

✅ Solution : Scroll automatique, waitFor, gestion JS async.

5. Ressources gourmandes

✅ Solution : Conteneurisation + scaling horizontal.

6. Gestion d’erreurs complexe

✅ Solution : Logging + monitoring + retry logique.

7. Maintenance technique

✅ Solution : CI + tests E2E sur le crawler.

8. Données UX non toujours fiables

✅ Solution : Mix IA + feedback humain + audit secondaire.

9. Respect du RGPD / robots.txt

✅ Solution : Lecture des robots.txt + clauses CGU clients.

10. Gestion des langues et redirections

✅ Solution : Forcer Accept-Language, geolocalisation simulée.

11. Pas d’interaction utilisateur

✅ Solution : Limiter le champ d’analyse aux aspects purement observables + checklist subjective ajoutée.

