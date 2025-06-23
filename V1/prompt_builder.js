#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename  = fileURLToPath(import.meta.url);
const ROOT        = path.dirname(__filename);
const RESULT_FILE = path.join(ROOT, 'result.json');
const OUTPUT_FILE = path.join(ROOT, 'prompts.json');

const MAX_STRUCT  = 50;
const MAX_TEXTS   = 30;
const MAX_TEXT_LEN = 140;

let chalk;
try { chalk = (await import('chalk')).default; } catch { chalk = { green: x => x, red: x => x }; }

// ────────────────────────────────────────────────
// Chargement et validation du fichier result.json
async function loadCrawlResult () {
  let json;
  try {
    const raw = await fs.readFile(RESULT_FILE, 'utf8');
    json = JSON.parse(raw);
  } catch (e) {
    throw new Error(`Impossible de lire ${RESULT_FILE} – le crawl a-t-il réussi ?`);
  }

  const requiredFields = ['url', 'title', 'structure', 'texts'];
  for (const f of requiredFields) {
    if (!(f in json)) throw new Error(`Champ manquant dans result.json : ${f}`);
  }

  json.structure = [...new Set(json.structure)].slice(0, MAX_STRUCT);
  json.texts = [...new Set(json.texts)]
    .map(t => t.replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT_LEN))
    .filter(Boolean)
    .slice(0, MAX_TEXTS);

  return json;
}

// ────────────────────────────────────────────────
// Génération des prompts
function buildPrompts ({ url, title, structure, texts }) {
  const STRUCT = structure.join(', ');
  const TEXTS  = texts.join(' | ');

  const baseHeader = axis => `
Tu es un expert ${axis}.
Analyse le site suivant avec rigueur professionnelle.

URL : ${url}
Titre : ${title}
Structure détectée : ${STRUCT || '(vide)'}
Extraits de textes visibles : ${TEXTS || '(aucun)'}

==================================================`.trim();

  return [
    {
      id: 'UX_NAV',
      axis: 'UX (Navigation)',
      content: `${baseHeader('UX/navigation')}

Objectifs :
1. Évalue la clarté du menu, la logique du parcours et la hiérarchie visuelle.
2. Donne une note UX sur 100 et liste 3 points forts + 3 points faibles.
3. Propose 3 actions d’amélioration concrètes (une phrase chacune).`
    },
    {
      id: 'UX_FLOW',
      axis: 'UX (Flux de conversion)',
      content: `${baseHeader('UX/flux de conversion')}

Objectifs :
1. Déduis le parcours type d’un utilisateur vers un achat ou un objectif clé.
2. Identifie les frictions majeures à chaque étape.
3. Recommande 3 optimisations UX mesurables.`
    },
    {
      id: 'UI_AESTHETIC',
      axis: 'UI (Esthétique visuelle)',
      content: `${baseHeader('UI/esthétique')}

Analyse :
- Cohérence des couleurs, typographie, densité d’information.
- Contraste et lisibilité.
Donne un score sur 100 et 3 recommandations.`
    },
    {
      id: 'UI_CONSIST',
      axis: 'UI (Consistance composants)',
      content: `${baseHeader('UI/consistance')}

Analyse :
- Uniformité des boutons, formulaires, icônes.
- Usage d’un design system (ou non).
Donne un score sur 100, liste 3 incohérences majeures et 3 correctifs.`
    },
    {
      id: 'SEO_STRUCTURE',
      axis: 'SEO (Structure)',
      content: `${baseHeader('SEO/structure')}

Analyse :
- Pertinence des balises h1–h3 déduites des textes extraits.
- Présence supposée de balises alt et meta title/description.
Donne 3 points de risque SEO + 3 quick wins.`
    },
    {
      id: 'PERF_CORE',
      axis: 'Performance technique',
      content: `${baseHeader('performance technique')}

Même sans données Lighthouse, estime :
- Poids perçu des pages (structure longue ?).
- Risque de blocage JS (menu lourd, trop de scripts).
Donne une note de performance perçue (0–100) et 3 pistes d’optimisation.`
    },
    {
      id: 'A11Y',
      axis: 'Accessibilité',
      content: `${baseHeader('accessibilité')}

Vérification rapide :
- Contraste couleur présumé.
- Présence d’alternatives textuelles (images, icônes).
- Navigation clavier (éléments focusables).
Donne un score a11y (0–100) et 3 corrections prioritaires.`
    },
    {
      id: 'BENCH_NAV',
      axis: 'Comparaison concurrentielle (Navigation)',
      content: `${baseHeader('benchmark navigation')}

Consigne :
Compare la navigation primaire de ce site à deux concurrents majeurs (e.g. Apple, Samsung).
- Forces/faiblesses vs benchmarks.
- 2 idées différenciantes à implémenter.`
    },
    {
      id: 'BENCH_UI',
      axis: 'Comparaison concurrentielle (UI)',
      content: `${baseHeader('benchmark UI')}

Consigne :
Compare la présentation visuelle (hero section, fiches produit) à au moins deux sites e-commerce premium.
- Liste 2 forces, 2 faiblesses, 2 quick wins UI.`
    },
    {
      id: 'PROJECTION',
      axis: 'Projection de gains',
      content: `${baseHeader('projection UX')}

Hypothèse : toutes les recommandations UX/UI précédentes sont appliquées.
- Estime le gain potentiel en taux de conversion (%), temps moyen, satisfaction.
- Justifie en 3 points.`
    },
    {
      id: 'SUMMARY',
      axis: 'Synthèse finale',
      content: `${baseHeader('synthèse UX globale')}

Fusionne tous les axes d’analyse.
Donne :
- Une note UX globale /100.
- Top 5 priorités actionnables (claires, mesurables).
- Un tableau résumé (axe / score / priorité).`
    },
    {
      id: 'ACTION_PLAN',
      axis: 'Roadmap 30-60-90 jours',
      content: `${baseHeader('plan d’action UX/UI')}

Propose un plan :
- J+30 : quick wins (liste courte).
- J+60 : optimisations moyennes.
- J+90 : chantiers lourds.
Pour chaque item, 1 phrase + impact estimé (faible/moyen/haut).`
    }
  ];
}

// ────────────────────────────────────────────────
// Exécution principale
(async () => {
  try {
    const crawlData = await loadCrawlResult();
    const prompts = buildPrompts(crawlData);
    await fs.writeFile(OUTPUT_FILE, JSON.stringify(prompts, null, 2), 'utf8');
    console.log(chalk.green(`✅  ${prompts.length} prompts générés → ${OUTPUT_FILE}`));
  } catch (err) {
    console.error(chalk.red('❌ prompt_builder : échec –'), err.message || err);
    process.exit(1);
  }
})();
