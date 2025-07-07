import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

// Pour exécuter les scripts enfants (crawl, prompts, audit)
import { execFile } from 'child_process';
import { promisify } from 'util';
const exec = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.dirname(__filename);
const prisma = new PrismaClient();

// Récupère les arguments CLI
const url = process.argv[2];
const auditId = process.argv[3];  // ← Changer de projectId vers auditId

if (!url || !auditId) {
  console.error('Usage: node audit_pipeline.js <url> <auditId>');
  process.exit(1);
}

console.log('Début pipeline audit pour', url, 'auditId:', auditId);

const steps = [
  { name: 'crawl', script: 'crawl_site.js' },
  { name: 'prompts', script: 'prompt_builder.js' },
  { name: 'audit', script: 'gpt_call.js' }
];

function getScoreFromResults(results) {
  if (!results) return 0;
  if (Array.isArray(results)) {
    const scores = results
      .map(r => {
        if (r.response) {
          // Cherche "Score : xx/100" OU "Note : xx/100" OU "Score : xx" 
          const match = r.response.match(/(?:Score|Note)\s*[:=]?\s*(\d{1,3})(?:\/100)?/i);
          if (match) return Number(match[1]);
        }
        return NaN;
      })
      .filter(n => !isNaN(n));
    return scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  }
  return 0;
}

async function runPipeline() {
  for (const { name, script } of steps) {
    const fullPath = path.join(ROOT, script);
    console.log(`▶️  Étape : ${name}`);
    try {
      await fs.access(fullPath);
    } catch {
      throw new Error(`Script introuvable : ${script}`);
    }
    const args = script === 'crawl_site.js' ? [fullPath, url] : [fullPath, '--force'];
    try {
      const { stdout, stderr } = await exec('node', args, { env: { ...process.env, TARGET_URL: url } });
      if (stderr) console.warn(stderr.trim());
      if (stdout) console.log(stdout.trim());
      console.log(`✅ ${name} terminé`);
    } catch (err) {
      console.error(`❌ Erreur lors de l'étape ${name} (${script}):`, err.stderr || err);
      throw err;
    }
  }

  // Lecture des résultats
  const auditResults = JSON.parse(await fs.readFile(path.join(ROOT, 'audit_results.json'), 'utf-8'));
  console.log('auditResults:', auditResults);
  const screenshot = await fs.readFile(path.join(ROOT, 'screenshot.png'), 'base64');
  const score = getScoreFromResults(auditResults);
  console.log('score calculé:', score);

  // Insertion en DB - METTRE À JOUR l'audit existant au lieu de créer
  console.log('Mise à jour audit en DB pour auditId:', auditId);
  try {
    await prisma.audit.update({
      where: { id: Number(auditId) },  // ← Utiliser auditId
      data: {
        screenshot,
        results: auditResults,
        score: score.toString()
      }
    });
    console.log('✅ Audit mis à jour en DB !');
  } catch (e) {
    console.error('❌ Erreur mise à jour DB:', e.message);
    console.error('Stack:', e.stack);
    throw e;
  }

  await prisma.$disconnect();
}

runPipeline().catch(e => {
  console.error('Erreur pipeline:', e);
  process.exit(1);
});