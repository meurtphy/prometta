#!/usr/bin/env ts-node
/**
 * gpt_call.ts
 * ------------
 * Exemple minimal : lit prompt.txt, interroge OpenAI et écrit audit_output.txt
 * Inclut logs d’usage et calcul du coût (prix par défaut gpt-4o).
 */

import fs from 'node:fs/promises';
import dotenv from 'dotenv';
import { performance } from 'node:perf_hooks';
import { OpenAI } from 'openai';

dotenv.config();

// ─────────── Config
const MODEL              = process.argv[2] ?? 'gpt-4o';
const TEMPERATURE        = 0.6;
const PRICE_TABLE: Record<string, { in: number; out: number }> = {
  'gpt-4o':        { in: 0.0005, out: 0.0015 },
  'gpt-4-turbo':   { in: 0.01,   out: 0.03   },
  'gpt-3.5-turbo': { in: 0.0005, out: 0.0015 }
};
const PRICE = PRICE_TABLE[MODEL] ?? PRICE_TABLE['gpt-4o'];

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) throw new Error('OPENAI_API_KEY manquant dans .env');

// ─────────── Lecture du prompt
const promptTxt = await fs.readFile('prompt.txt', 'utf8');

// ─────────── Appel API
const openai = new OpenAI({ apiKey });

const t0 = performance.now();
const res = await openai.chat.completions.create({
  model: MODEL,
  temperature: TEMPERATURE,
  max_tokens: 1024,
  messages: [{ role: 'user', content: promptTxt }]
});
const dt = performance.now() - t0;

// ─────────── Résultats
const answer           = res.choices[0].message.content ?? '';
const { prompt_tokens, completion_tokens } = res.usage!;
const cost             = (prompt_tokens / 1_000) * PRICE.in +
                         (completion_tokens / 1_000) * PRICE.out;

// ─────────── Sortie
await fs.writeFile('audit_output.txt', answer);
console.log(`\n✅  Réponse écrite dans audit_output.txt`);
console.log(`📊  prompt=${prompt_tokens}  completion=${completion_tokens}  coût≈$${cost.toFixed(4)}  (${Math.round(dt)} ms)\n`);
console.log(answer);
