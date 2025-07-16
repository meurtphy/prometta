#!/usr/bin/env node
import express from 'express';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const exec = promisify(execFile);
const PORT = 4000;
const __filename = fileURLToPath(import.meta.url);
const ROOT = path.dirname(__filename);
const prisma = new PrismaClient();

console.log('run_audit.js lancé avec :', process.argv);
// ─── App Express ─────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use(express.static(ROOT)); // Sert index.html + styles.css

// ─── Étapes automatisées ─────────────────────────────────────
const steps = [
  { name: 'crawl',   script: 'crawl_site.js',     out: 'result.json' },
  { name: 'prompts', script: 'prompt_builder.js', out: 'prompts.json' },
  { name: 'audit',   script: 'gpt_call.js',       out: 'audit_results.json' },
];

// ─── Helpers de console (couleurs ANSI) ──────────────────────
const color = {
  blue:  txt => `\x1b[34m${txt}\x1b[0m`,
  green: txt => `\x1b[32m${txt}\x1b[0m`,
  red:   txt => `\x1b[31m${txt}\x1b[0m`,
  gray:  txt => `\x1b[90m${txt}\x1b[0m`,
  yellow:txt => `\x1b[33m${txt}\x1b[0m`,
  cyan:  txt => `\x1b[36m${txt}\x1b[0m`,
};

// ─── Audit launcher ──────────────────────────────────────────
app.post('/run-audit', async (req, res) => {
  const { url } = req.body || {};
  if (!url || !/^https?:\/\//i.test(url)) {
    return res.status(400).send('❌ URL invalide (doit commencer par http/https)');
  }

  const env = { ...process.env, TARGET_URL: url };

  try {
    for (const { name, script } of steps) {
      const fullPath = path.join(ROOT, script);

      // Vérifie que le script existe
      try {
        await fs.access(fullPath);
      } catch {
        throw new Error(`Script introuvable : ${script}`);
      }

      console.log(color.blue(`▶️  Étape : ${name}`));
      const args = script === 'crawl_site.js' ? [fullPath, url] : [fullPath];

      const t0 = Date.now();
      const { stdout, stderr } = await exec('node', args, { env, cwd: ROOT });
      const duration = ((Date.now() - t0) / 1000).toFixed(2);

      if (stderr) console.warn(color.yellow(`⚠️ ${script} STDERR:\n${stderr.trim()}`));
      if (stdout) console.log(color.gray(stdout.trim()));
      console.log(color.green(`✅ ${name} terminé en ${duration}s\n`));
    }

    console.log('Insertion en DB pour projectId:', projectId, 'url:', url);
    // === AJOUT : insertion en DB ===
    const projectId = req.body.projectId; // récupère l'ID du projet envoyé par le front
    const auditResults = JSON.parse(await fs.readFile(path.join(ROOT, 'audit_results.json'), 'utf-8'));
    const screenshot = await fs.readFile(path.join(ROOT, 'screenshot.png'), 'base64');

    if (!projectId) throw new Error('projectId manquant pour l’insertion en DB');

    await prisma.audit.create({
      data: {
        project: { connect: { id: Number(projectId) } },
        siteUrl: req.body.url,
        screenshot,
        report: auditResults
      }
    });

    await prisma.$disconnect();
    console.log(color.green('✅ Audit inséré en DB !'));

    res.json({ ok: true, results: 'audit_results.json' });
  } catch (err) {
    console.error(color.red('❌ Erreur dans le processus :'), err);
    res.status(500).send(err.message || 'Erreur inconnue');
  }
});

// ─── Lancement du serveur ────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀  Serveur prêt sur ${color.cyan(`http://localhost:${PORT}`)}`);
});
