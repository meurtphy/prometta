// prompt_builder.ts
import fs from 'node:fs/promises';
import path from 'node:path';

interface CrawlResult {
  url: string;
  title: string;
  structure: string[];
  texts: string[];
  timestamp?: string;
}

interface Prompt {
  id: string;
  axis: string;
  content: string;
}

const RESULT_FILE   = path.resolve('result.json');
const OUTPUT_FILE   = path.resolve('prompts.json');
const LANG          = 'fr-FR';
const MAX_STRUCT    = 50;
const MAX_TEXTS     = 30;

// ---------- RUN ----------
(async () => {
  const crawlData = await loadCrawlResult();
  const prompts   = buildPrompts(crawlData);
  await fs.writeFile(OUTPUT_FILE, JSON.stringify(prompts, null, 2), 'utf8');
  console.log(`✅  ${prompts.length} prompts générés → ${OUTPUT_FILE}`);
})().catch(err => {
  console.error('❌  prompt_builder : échec –', err.message || err);
  process.exit(1);
});

// ---------- FUNCTIONS ----------
async function loadCrawlResult(): Promise<CrawlResult> {
  try {
    const raw = await fs.readFile(RESULT_FILE, 'utf8');
    const json: CrawlResult = JSON.parse(raw);

    const required = ['url', 'title', 'structure', 'texts'];
    for (const field of required) {
      if (!(field in json)) {
        throw new Error(`Champ manquant dans result.json : ${field}`);
      }
    }

    // Nettoyage & limites
    json.structure = [...new Set(json.structure)].slice(0, MAX_STRUCT);
    json.texts     = [...new Set(json.texts)]
                      .map(t => t.slice(0, 120))
                      .slice(0, MAX_TEXTS);

    return json;
  } catch (e) {
    throw new Error(
      `Impossible de lire ${RESULT_FILE}. Vérifie que le crawl a réussi.`
    );
  }
}

function buildPrompts(crawl: CrawlResult): Prompt[] {
  const { url, title, structure, texts } = crawl;
  const STRUCT = structure.join(', ');
  const TEXTS  = texts.join(' | ');

  const baseHeader = (axis: string) => `
Tu es un expert ${axis}.
Analyse le site suivant avec rigueur professionnelle.

URL : ${url}
Titre : ${title}
Structure détectée : ${STRUCT || '(vide)'}
Extraits de textes visibles : ${TEXTS || '(aucun)'}

==================================================
`.trim();

  const prompts: Prompt[] = [];

  /* 1-2. UX (Navigation / Parcours) */
  prompts.push({
    id: 'UX_NAV',
    axis: 'UX (Navigation)',
    content: `${baseHeader('UX/navigation')}

Objectifs :
1. Évalue la clarté du menu, la logique du parcours et la hiérarchie visuelle.
2. Note sur 100 et liste 3 points forts + 3 points faibles.
3. Propose 3 actions d’amélioration concrètes (une phrase chacune).`
  });

  prompts.push({
    id: 'UX_FLOW',
    axis: 'UX (Flux de conversion)',
    content: `${baseHeader('UX/flux de conversion')}

Objectifs :
1. Déduis le parcours type d’un utilisateur vers un achat ou un objectif clé.
2. Identifie les frictions majeures à chaque étape.
3. Recommande 3 optimisations UX mesurables.`
  });

  /* 3-4. UI (Aesthétique / Consistency) */
  prompts.push({
    id: 'UI_AESTHETIC',
    axis: 'UI (Esthétique visuelle)',
    content: `${baseHeader('UI/esthétique')}

Analyse :
- Cohérence des couleurs, typographie, densité d’information.
- Contraste et lisibilité.
Fournis un score sur 100 et 3 recommandations.`
  });

  prompts.push({
    id: 'UI_CONSIST',
    axis: 'UI (Consistence composants)',
    content: `${baseHeader('UI/consistance')}

Analyse :
- Uniformité des boutons, formulaires, icônes.
- Utilisation d’un design system (ou non).
Donne un score sur 100, 3 incohérences majeures, 3 correctifs.`
  });

  /* 5. SEO Technique & Sémantique */
  prompts.push({
    id: 'SEO_STRUCTURE',
    axis: 'SEO (Structure)',
    content: `${baseHeader('SEO/structure')}

Analyse rapide :
- Pertinence des balises h1–h3 déduites des textes.
- Présence probable de balises alt, meta title/description.
- 3 risques SEO + 3 quick wins.`
  });

  /* 6. Performance Technique (sans Lighthouse pour l’instant) */
  prompts.push({
    id: 'PERF_CORE',
    axis: 'Performance technique',
    content: `${baseHeader('performance technique')}

Même sans données Lighthouse, estime :
- Poids perçu des pages (structure longue ?)
- Risque de blocage JS (menu lourd, tracking, cookies).
Donne une note de performance perçue (0–100) et 3 pistes d’optimisation.`
  });

  /* 7. Accessibilité */
  prompts.push({
    id: 'A11Y',
    axis: 'Accessibilité',
    content: `${baseHeader('accessibilité')}

Contrôle rapide :
- Contraste couleur présumé
- Alternatives textuelles (images / icônes)
- Navigation clavier
Donne un score a11y (0–100) + 3 corrections prioritaires.`
  });

  /* 8-9. Comparaison concurrentielle (2 prompts) */
  prompts.push({
    id: 'BENCH_NAV',
    axis: 'Comparaison concurrentielle (Navigation)',
    content: `${baseHeader('benchmark navigation')}

Consigne : Compare la navigation primaire de ce site à deux concurrents majeurs du secteur (déduis « Apple » et « Samsung » par défaut si aucun nom fourni).
- Force/faiblesse vs benchmarks
- 2 idées différenciantes à implémenter.`
  });

  prompts.push({
    id: 'BENCH_UI',
    axis: 'Comparaison concurrentielle (UI)',
    content: `${baseHeader('benchmark UI')}

Compare la présentation visuelle (hero section, fiches produit) à au moins deux sites e-commerce premium.
- 2 forces, 2 faiblesses, 2 quick-wins UI.`
  });

  /* 10. Projection de gains */
  prompts.push({
    id: 'PROJECTION',
    axis: 'Projection de gains',
    content: `${baseHeader('projection UX')}

Hypothèse : toutes les recommandations UX/UI précédentes sont appliquées.
- Estime le gain potentiel en taux de conversion (en %), temps moyen, satisfaction.
- Justifie en 3 bullet points.`
  });

  /* 11-12. Synthèse & Plan d’action */
  prompts.push({
    id: 'SUMMARY',
    axis: 'Synthèse finale',
    content: `${baseHeader('synthèse UX globale')}

Fusionne tous les axes d’analyse.
Donne :
- Note UX globale /100
- Top 5 priorités actionnables (claires et mesurables)
- Tableau résumé (axe / score / priorité).`
  });

  prompts.push({
    id: 'ACTION_PLAN',
    axis: 'Roadmap 30-60-90 jours',
    content: `${baseHeader('plan d’action UX/UI')}

Dresse un plan :
- J+30 : quick wins (liste courte)
- J+60 : optimisations moyennes
- J+90 : chantiers lourds
Chaque item : 1 phrase, impact estimé (faible / moyen / haut).`
  });

  return prompts;
}
