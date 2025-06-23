📊 Architecture Technique Globale – Projet Brutux

🌐 Objectif

Automatiser l'audit UX/UI de sites web via un système modulaire composé de :

Collecte intelligente (DOM, textes, performances)

IA (ChatGPT) structurée et enrichie

Stockage, scoring et suivi historisé

Restitution web + espace client

🧠 Vue d’ensemble (Modules Clés)

1. Front-end (React / Vue)

Interfaces admin + client

Formulaires de création d'audits

Vue récapitulative, comparateur d'audits

Connexion / Authentification JWT

2. API Gateway (FastAPI ou Express.js)

Point d'entrée unique (REST / GraphQL)

Authentification (JWT)

Routes :

/audit/create (POST)

/audit/{id} (GET)

/audit/{id}/generate (POST async)

/client/{id}/audits (GET)

3. Crawler Service (Node.js ou Python)

Playwright headless browser

Extraction DOM, structure, contenu texte

Screenshot (mobile + desktop)

Récupération des scores via Lighthouse ou PageSpeed API

Output : JSON préformaté + images

Communication via Job Queue

4. Audit Engine (GPT Interface)

Prompt builder dynamique

Context injection (structure + performances)

Appels à OpenAI GPT-4

Post-processing : scoring + format + synthèse

5. Job Queue (Redis + BullMQ / Celery)

Découplage des traitements GPT et crawling

Files : crawl_jobs, gpt_jobs, report_jobs

Workers scalables

6. Base de données (PostgreSQL + VectorDB)

PostgreSQL :

clients, audits, audit_sections, prompts, snapshots

Vector DB (Weaviate, Chroma) :

embeddings de contenu site

corpus de bonnes pratiques UX

7. Système de Fichiers (MinIO, S3, ou local)

Stockage de :

Captures écran

PDF générés

Données brutes auditables

🏋️ Flux de Données (Step-by-step)

✅ 1. Création Audit (client ou consultant)

Saisie : URL, concurrents, plateforme

Enregistrement audit en statut "pending"

Création tâche dans crawl_jobs

✅ 2. Exécution Crawler

Le worker Playwright analyse la page (DOM, text, perf, accessibilité)

Stockage dans snapshots

Création tâche dans gpt_jobs

✅ 3. Appel à GPT

Prompt builder injecte les données de snapshot

Envoi d’une série de prompts (UX, UI, SEO, etc.)

Réponses traitées, scorées, synthétisées

Stockage dans audit_sections

✅ 4. Rapport et Restitution

Rapport PDF ou interface web composée dynamiquement

Historisation + Comparaison avec audits précédents

📊 Points de Scalabilité

Tous les composants lourds sont async (crawling, GPT)

Utilisation de workers multi-instances pour parallélisme

API Gateway légère et stateless

Stockage des assets offloadé

🔒 Sécurité & RGPD

Authentification JWT + Rôles

Protection des audits par identifiants clients

Lecture des robots.txt avant crawling

Rétention des données limitée selon CGU Brutux

