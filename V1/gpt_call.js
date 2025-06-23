#!/usr/bin/env node
/* ===========================================================================
   gpt_call.js – génère (ou complète) audit_results.<site>.json
   ---------------------------------------------------------------------------
   Usage :
     node gpt_call.js [--model=gpt-4o] [--temp=0.7] [--only=ID] [--force]
   ======================================================================== */

import fs               from 'node:fs/promises';
import path             from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance }   from 'node:perf_hooks';
import dotenv            from 'dotenv';
import { OpenAI }        from 'openai';

dotenv.config();

/* ─── CLI ARGS ────────────────────────────────────────────────────────── */
const argv = new Map(
  process.argv.slice(2).flatMap(str => {
    const [k, v = true] = str.startsWith('--') ? str.slice(2).split('=') : [];
    return k ? [[k, v]] : [];
  })
);

const MODEL       = argv.get('model') ?? 'gpt-4o';
const TEMPERATURE = Number(argv.get('temp') ?? 0.7);
const ONLY_ID     = argv.get('only');
const FORCE_MODE  = argv.has('force');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.error('❌  OPENAI_API_KEY manquant dans .env');
  process.exit(1);
}

/* ─── CHEMINS ─────────────────────────────────────────────────────────── */
const ROOT        = path.dirname(fileURLToPath(import.meta.url));
const PROMPTS_FP  = path.join(ROOT, 'prompts.json');
const CRAWL_FP    = path.join(ROOT, 'result.json');     // Sert à extraire l’URL
const SCREENSHOT  = path.join(ROOT, 'screenshot.png');

/* ─── Dérive un slug de domaine pour le fichier de sortie ─────────────── */
let SITE_SLUG = 'site';
try {
  const { url = '' } = JSON.parse(await fs.readFile(CRAWL_FP, 'utf8'));
  const h = new URL(url).hostname.replace(/^www\./, '');
  SITE_SLUG = h.replace(/[^\w.-]/g, '') || 'site';
} catch { /* ignore (crawl pas encore fait) */ }

const RESULTS_FP = path.join(ROOT, `audit_results.${SITE_SLUG}.json`);
const RESULTS_GENERIC_FP = path.join(ROOT, 'audit_results.json');

/* ─── OPENAI & TARIFS ─────────────────────────────────────────────────── */
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const PRICE = {
  'gpt-4o'               : { in: 0.0005, out: 0.0015 },
  'gpt-4-turbo'          : { in: 0.0100, out: 0.0300 },
  'gpt-3.5-turbo'        : { in: 0.0005, out: 0.0015 },
  'gpt-4-vision-preview' : { in: 0.0100, out: 0.0300 }
}[MODEL] ?? { in: 0.01, out: 0.03 };

const MAX_RETRIES = 2;
const CONCURRENCY = 2;

/* ─── HELPERS ─────────────────────────────────────────────────────────── */
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function safeJSON(fp, fallback = []) {
  try { return JSON.parse(await fs.readFile(fp, 'utf8')); }
  catch { return fallback; }
}

async function prepareVisionMessages(textPrompt) {
  const buffer = await fs.readFile(SCREENSHOT);
  const img64  = buffer.toString('base64');
  return [{
    role: 'user',
    content: [
      { type: 'image_url', image_url: { url: `data:image/png;base64,${img64}` } },
      { type: 'text',      text: textPrompt }
    ]
  }];
}

/* ─── RUN ONE PROMPT ──────────────────────────────────────────────────── */
async function runPrompt({ id, axis, content, image = false }) {
  let attempt = 0, usage, result, duration;

  const messages = image && MODEL.includes('vision')
    ? await prepareVisionMessages(content)
    : [
        { role: 'system', content: 'Tu es un assistant IA ultra-expert.' },
        { role: 'user',   content }
      ];

  while (attempt++ <= MAX_RETRIES) {
    const t0 = performance.now();
    try {
      const res = await openai.chat.completions.create({
        model: MODEL, temperature: TEMPERATURE, max_tokens: 1024, messages
      });
      duration = performance.now() - t0;
      usage    = res.usage;
      result   = res.choices[0].message.content.trim();
      break;                          // ✅ success
    } catch (err) {
      console.warn(`⚠️  ${id} tentative ${attempt}/${MAX_RETRIES} – ${err.message}`);
      if (attempt > MAX_RETRIES) throw err;
      await sleep(1_000 * attempt);
    }
  }

  const { prompt_tokens: inT, completion_tokens: outT, total_tokens: tot } = usage;
  const cost = (inT / 1_000) * PRICE.in + (outT / 1_000) * PRICE.out;

  console.log(`✅  ${id.padEnd(12)} ${String(tot).padStart(5)} tok → $${cost.toFixed(4)}`);

  return {
    id, axis, prompt: content, response: result,
    usage: { in: inT, out: outT, total: tot },
    cost : Number(cost.toFixed(6)),
    ms   : Math.round(duration),
    ts   : new Date().toISOString()
  };
}

/* ─── MAIN PIPELINE ───────────────────────────────────────────────────── */
(async () => {
  const prompts = await safeJSON(PROMPTS_FP);
  if (!prompts.length) throw new Error(`Fichier vide ou invalide : ${PROMPTS_FP}`);

  const previous = FORCE_MODE ? [] : await safeJSON(RESULTS_FP);
  const doneIds  = new Set(previous.map(r => r.id));

  const queue = prompts.filter(p =>
    (!ONLY_ID || p.id === ONLY_ID) &&
    (FORCE_MODE || !doneIds.has(p.id))
  );

  console.log(`▶️  Site     : ${SITE_SLUG}`);
  console.log(`▶️  Modèle   : ${MODEL}`);
  console.log(`▶️  Temp.    : ${TEMPERATURE}`);
  console.log(`▶️  Force    : ${FORCE_MODE}`);
  console.log('──────────────────────────────────────────');
  console.log(`ℹ️  À traiter : ${queue.length}/${prompts.length}`);

  let totTok = 0, totCost = 0;
  const results = FORCE_MODE ? [] : [...previous];

  for (let i = 0; i < queue.length; i += CONCURRENCY) {
    const batch = queue.slice(i, i + CONCURRENCY);
    const out   = await Promise.all(batch.map(runPrompt));
    out.forEach(o => { totTok += o.usage.total; totCost += o.cost; });
    results.push(...out);
    await fs.writeFile(RESULTS_FP,        JSON.stringify(results, null, 2));
    await fs.writeFile(RESULTS_GENERIC_FP, JSON.stringify(results, null, 2)); // miroir
  }

  console.log('──────────────────────────────────────────');
  console.log(`🎉  Terminé.  Tokens totaux : ${totTok}`);
  console.log(`💰  Coût estimé            : $${totCost.toFixed(4)}`);
})().catch(e => {
  console.error('💥  FATAL :', e.message || e);
  process.exit(1);
});
