Tutoriel “prise en main + mode CLI”
(complète la version précédente – inclut tous les points manquants : exécution directe des scripts, installation Playwright, génération manuelle, export PDF, etc.)

0. Rappel des répertoires et fichiers importants
bash
Copier
Modifier
audit-ux/
│  .env
│  package.json                 # contient "type":"module"
│
├─ run_audit.js                 # ⇢ pipeline FULL (→ API POST /run-audit)
├─ crawl_site.js                # ⇢ étape 1 : crawl + screenshot + result.json
├─ prompt_builder.js            # ⇢ étape 2 : prompts.json
├─ gpt_call.js                  # ⇢ étape 3 : audit GPT   (CLI ou pipeline)
│
├─ public/                      # front statique
│   ├─ index.html               # formulaire “Lancer audit”
│   ├─ report.html              # rendu lisible d’un JSON
│   ├─ app.js / report.js       # logique front
│   └─ styles.css               # (optionnel : tailwind CDN si pas compilé)
└─ audit_results.<domaine>.json # résultats générés (un par site)
1. Installation complète
bash
Copier
Modifier
git clone https://github.com/BrutX-Studio/audit-ux.git
cd audit-ux
npm install                # installe Express, OpenAI, Playwright …

# Playwright : télécharge Chromium headless la 1ère fois
npx playwright install chromium
.env

dotenv
Copier
Modifier
OPENAI_API_KEY="sk-..."
2. Deux manières de lancer un audit
Méthode	Pour quoi ?	Commande
Pipeline API (serveur)	flux complet + Swagger + front	node run_audit.js puis POST /run-audit ou formulaire index.html
Mode CLI (script seul)	déboguer ou relancer une étape manuelle	voir tableau ci-dessous

2-A. Pipeline API (la méthode “tout en un”)
bash
Copier
Modifier
node run_audit.js
# → http://localhost:4000
#   - index.html  : formulaire
#   - api-docs    : Swagger
POST manuel :

bash
Copier
Modifier
curl -X POST http://localhost:4000/run-audit \
     -H "Content-Type: application/json" \
     -d '{"url":"https://brutux.studio"}'
Swagger : http://localhost:4000/api-docs → Try it out.

2-B. Mode CLI “briques” (utile en local ou CI)
Étape	Script	Exemple
1. Crawl	node crawl_site.js https://brutux.studio	produit result.json + screenshot.png
2. Prompts	node prompt_builder.js	produit prompts.json
3. Appel GPT	node gpt_call.js	produit audit_results.brutux.studio.json

Important : gpt_call.js lit result.json et le nom du domaine pour créer un fichier de sortie dédié (audit_results.<host>.json).

3. Options avancées de gpt_call.js
bash
Copier
Modifier
node gpt_call.js           # flux normal : ne relance pas les prompts déjà faits
node gpt_call.js --force   # ignore le cache et régénère tout
node gpt_call.js --only=SEO_STRUCTURE         # 1 seul prompt
node gpt_call.js --model=gpt-4-turbo --temp=0.3
--force : utile si tu veux réécrire un JSON corrompu.

Le fichier généré suit le domaine :

pgsql
Copier
Modifier
audit_results.backmarket.fr.json
audit_results.brutux.studio.json
4. Voir les rapports
4-A. Front “report.html”
bash
Copier
Modifier
http://localhost:4000/report.html?file=audit_results.brutux.studio.json
La page charge le JSON, convertit les sections Markdown → HTML (marked.js) et génère :

Table des matières sticky

Bouton “Télécharger PDF” (html2pdf.js)

En-têtes colorés par axe (UX / UI / SEO …)

4-B. Swagger download
Dans GET /files/{name} (exposé automatiquement), clique Download.

5. Démos rapides pour le collègue
bash
Copier
Modifier
# 1) Audit live d’un site
curl -s -X POST localhost:4000/run-audit -H 'Content-Type: application/json' \
     -d '{"url":"https://holbylon.com"}' | jq

# 2) Ouvrir le rapport
open 'http://localhost:4000/report.html?file=audit_results.holbylon.com.json'

# 3) Regénérer seulement “UI_AESTHETIC”
node gpt_call.js --only=UI_AESTHETIC --force
6. Erreurs courantes & solutions
Log / Erreur	Cause probable	Correctif
⏳ À traiter : 0/12	Les 12 prompts existent déjà	--force ou supprime le fichier résultat
ReferenceError: require is not defined	ancien script CommonJS dans projet ESM	renommer .js → .cjs ou passer import ...
PlaywrightTimeoutError	site trop lent / bloqueur	TIMEOUT dans crawl_site.js (120 000 ms)
OPENAI_API_KEY missing	variable mal nommée / oubli .env	réparer .env

7. Structure front ↔ back
mermaid
Copier
Modifier
sequenceDiagram
    participant User
    participant Browser
    participant Express
    participant Playwright
    participant OpenAI

    User->>Browser: submit URL (index.html)
    Browser->>Express: POST /run-audit {url}
    Express->>Playwright: node crawl_site.js <url>
    Playwright-->>Express: result.json + screenshot.png
    Express->>Node: node prompt_builder.js
    Express->>OpenAI: gpt_call.js (12 prompts)
    OpenAI-->>Express: audit_results.<host>.json
    Express-->>Browser: { ok:true, file:"audit_results.<host>.json" }
    Browser->>Browser: redirect → report.html?file=...
8. Check-list “première mise en prod”
Playwright headless ok sur votre CI (flag --single-process).

OPENAI_API_KEY : config secret dans CI + sur serveur.

CORS : si front déporté, app.use(cors()).

Limiter la taille screenshot : page.setViewportSize({1280,800}).

Cron : node run_audit.js --headless dans pm2 / docker.

9. FAQ rapide
Q : comment changer le nombre de prompts ?
A : édite prompt_builder.js (array prompts[]).

Q : peut-on brancher une base SQL pour stocker les audits ?
A : Oui – après results.push(...out) ajoute un INSERT Sequelize.

Q : comment bypasser reCAPTCHA lors du crawl ?
A : pas prévu (politique Google). Utilise une URL sans challenge.

TL;DR (une ligne)
bash
Copier
Modifier
node run_audit.js && open http://localhost:4000/index.html   # >>> lance, audite, consulte
Voilà ! Ton/ta collègue a tout ce qu’il faut pour :

installer

lancer en mode API ou CLI

tester via Swagger / Postman

analyser les JSON & rapports

dépanner les erreurs fréquentes.

Bonne prise en main !