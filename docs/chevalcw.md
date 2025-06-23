🔢 Spécification Technique : Module Crawler Brutux

🔍 Objectif

Fournir un module backend capable d'analyser automatiquement une URL de site client pour en extraire :

Structure DOM logique (sections, composants)

Contenu textuel visible

Scores de performance (Lighthouse / PageSpeed)

Accessibilité

Captures écran

Ce module alimente ensuite le prompt d’audit GPT avec des données réelles.

🚀 Technologies

Langage : Node.js (Puppeteer) ou Python (Playwright)

Audit Performance : Lighthouse CLI ou Google PageSpeed API

Job Runner : Worker RabbitMQ / BullMQ / Celery

Output : JSON enrichi

📚 Fonctionnement

Entrée

{
  "url": "https://siteclient.com",
  "language": "fr-FR",
  "viewport": "desktop"
}

✅ Traitements

Chargement du site dans navigateur headless

User-agent human-like

Timeout + gestion d'erreurs HTTP

Scroll automatique + capture DOM dynamique

document.querySelectorAll(...)

Détection : header, nav, main, footer, button, form, etc.

Extraction de contenu texte visible

innerText + alt + aria-label

Nettoyage HTML / JS useless

Capture écran

Format : PNG, resolution 1920x1080

Stockée localement ou dans un bucket (S3, MinIO)

Audit technique

Lighthouse CLI ou PageSpeed API

Données : LCP, FID, CLS, score global, accessibilité

📋 Sortie JSON (exemple)

{
  "url": "https://siteclient.com",
  "title": "Exemple - Accueil",
  "structure": ["header", "nav", "hero", "product-list", "footer"],
  "texts": ["Bienvenue", "Panier", "Acheter maintenant"],
  "performance": {
    "LCP": 3.2,
    "CLS": 0.1,
    "score": 84
  },
  "accessibility": {
    "score": 90,
    "issues": ["faible contraste bouton", "champ sans label"]
  },
  "screenshot": "/static/screens/siteclient_home.png"
}

📊 Architecture interne (Node.js + BullMQ)

Composant

Fonction

crawlerWorker.js

Lancement tâche headless

domParser.js

Extraction structure + textes

metricsFetcher.js

Appel Lighthouse ou API Google

storage.js

Sauvegarde image + JSON

queue.js

Connexion Redis / BullMQ

⚠️ Erreurs gérables

Timeout > 30s

Page vide ou inaccessible

DOM vide (protection JS)

Anti-bot (Cloudflare, Captcha)

Fichiers trop lourds ou images bloquées

Fallback possible : injecter un message au prompt signalant l'échec de collecte + inviter le consultant à remplir manuellement.

Souhaites-tu maintenant que je crée le module GPT (prompt builder + générateur) ou le module Audit / DB ?