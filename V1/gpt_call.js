#!/usr/bin/env node
/**
 * gpt_call.js
 * ------------
 * Exécute une liste de prompts (prompts.json) contre l’API OpenAI,
 * journalise l’usage de tokens, calcule le coût et sauvegarde les réponses.
 *
 * ‼️  Nécessite :
 *      - Node ≥ 18
 *      - un fichier .env contenant OPENAI_API_KEY
 *
 * Options CLI (facultatives) :
 *   --model  gpt-4o | gpt-4-turbo | gpt-3.5-turbo      (défaut : gpt-4o)
 *   --temp   0-2                                       (défaut : 0.7)
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

import dotenv from 'dotenv';
import { OpenAI } from 'openai';

// ───────────────────────────── 1. ENV / CLI
dotenv.config();

const argv = new Map(
  process.argv.slice(2).flatMap(str => {
    const [k, v = true] = str.startsWith('--') ? str.slice(2).split('=') : [];
    return k ? [[k, v]] : [];
  })
);

const MODEL           = argv.get('model') ?? 'gpt-4o';       // ❇️ modèle par défaut
const TEMPERATURE     = Number(argv.get('temp') ?? 0.7);
const OPENAI_API_KEY  = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error('❌  Variable OPENAI_API_KEY manquante dans .env');
  process.exit(1);
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// ───────────────────────────── 2. Constantes
const ROOT          = path.dirname(fileURLToPath(import.meta.url));
const PROMPTS_FILE  = path.join(ROOT, 'prompts.json');
const RESULTS_FILE  = path.join(ROOT, 'audit_results.json');
const MAX_RETRIES   = 2;
const CONCURRENCY   = 2;      // ↗︎ paral­lélisme léger
const PRICE = {
  'gpt-3.5-turbo'       : { in: 0.0005, out: 0.0015 },
  'gpt-3.5-turbo'  : { in: 0.01,   out: 0.03   },
  'gpt-3.5-turbo': { in: 0.0005, out: 0.0015 }
}[MODEL] ?? { in: 0.01, out: 0.03 };

// ───────────────────────────── 3. Helpers
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function safeJSON(pathLike, fallback = []) {
  try {
    return JSON.parse(await fs.readFile(pathLike, 'utf8'));
  } catch { return fallback; }
}

// ───────────────────────────── 4. Log bannière
console.log(`▶️  Script : ${fileURLToPath(import.meta.url)}`);
console.log(`▶️  Modèle  : ${MODEL}`);
console.log(`▶️  Temp.   : ${TEMPERATURE}`);
console.log('──────────────────────────────────────────');

// ───────────────────────────── 5. Fonction prompt → réponse
async function runPrompt({ id, axis, content }) {
  let attempt = 0;
  let result, usage, duration;

  while (attempt++ <= MAX_RETRIES) {
    const t0 = performance.now();
    try {
      const res = await openai.chat.completions.create({
        model: MODEL,
        temperature: TEMPERATURE,
        max_tokens: 1_024,
        messages: [
          { role: 'system', content: 'Tu es un assistant IA ultra-expert.' },
          { role: 'user',   content }
        ]
      });

      duration = performance.now() - t0;
      usage    = res.usage;
      result   = res.choices[0].message.content.trim();
      break;                                                // ✅ succès
    } catch (err) {
      console.warn(`⚠️  ${id} tentative ${attempt}/${MAX_RETRIES} – ${err.message}`);
      if (attempt > MAX_RETRIES) throw new Error(`Échec définitif pour ${id}`);
      await sleep(1_000 * attempt);                        // back-off expo
    }
  }

  const { prompt_tokens: inT, completion_tokens: outT, total_tokens: tot } = usage;
  const cost = (inT / 1_000) * PRICE.in + (outT / 1_000) * PRICE.out;

  console.log(`✅  ${id.padEnd(12)} ${tot.toString().padStart(5)} tok  →  $${cost.toFixed(4)}`);

  return {
    id, axis, prompt: content, response: result,
    usage: { in: inT, out: outT, total: tot },
    cost: Number(cost.toFixed(6)),
    ms: Math.round(duration),
    ts: new Date().toISOString()
  };
}

// ───────────────────────────── 6. Pipeline principal
(async () => {
  const prompts      = await safeJSON(PROMPTS_FILE);
  if (!prompts.length) throw new Error(`Fichier vide : ${PROMPTS_FILE}`);

  const previous     = await safeJSON(RESULTS_FILE);
  const doneIds      = new Set(previous.map(o => o.id));
  const queue        = prompts.filter(p => !doneIds.has(p.id));

  console.log(`ℹ️  À traiter : ${queue.length}/${prompts.length}`);

  let totalTokens = 0, totalCost = 0;
  const results = [...previous];

  for (let i = 0; i < queue.length; i += CONCURRENCY) {
    const batch = queue.slice(i, i + CONCURRENCY);
    const out   = await Promise.all(batch.map(runPrompt));
    out.forEach(o => { totalTokens += o.usage.total; totalCost += o.cost; });
    results.push(...out);
    await fs.writeFile(RESULTS_FILE, JSON.stringify(results, null, 2), 'utf8');
  }

  console.log('──────────────────────────────────────────');
  console.log(`🎉  Terminé.  Tokens totaux : ${totalTokens}`);
  console.log(`💰  Coût estimé        : $${totalCost.toFixed(4)}`);
})().catch(err => {
  console.error('💥  FATAL :', err);
  process.exit(1);
});
