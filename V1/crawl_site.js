#!/usr/bin/env node
// crawl_site.js (ESM) – Audit DOM basique avec screenshot + extraction

import fs from 'node:fs/promises';
import { chromium } from 'playwright';

// ─── Paramètres ─────────────────────────────────────
const url = process.argv[2];
if (!url || !/^https?:\/\//.test(url)) {
  console.error('❌  Utilisation : node crawl_site.js <URL>');
  process.exit(1);
}

// ─── Constantes globales ────────────────────────────
const TIMEOUT    = 90_000;            // Timeout global
const MAX_TEXTS  = 20;                // Nombre de textes max à extraire
const SCREENSHOT = 'screenshot.png';  // Nom du screenshot
const RESULT     = 'result.json';     // Fichier de sortie JSON

// ─── Main ───────────────────────────────────────────
(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--single-process']
  });

  const context = await browser.newContext({
    locale: 'fr-FR',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();

  try {
    // ── Étape 1 : Navigation et scroll
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    await page.waitForLoadState('networkidle', { timeout: TIMEOUT }).catch(() => {});
    await autoScroll(page);

    // ── Étape 2 : Extraction DOM
    const { structure, texts, title } = await page.evaluate(({ maxTexts }) => {
      const clean = str =>
        str.replace(/\s+/g, ' ').trim().replace(/[\n\r\t]+/g, '');

      const pick = (selector) =>
        Array.from(document.querySelectorAll(selector))
          .map(el => clean(el.textContent || ''))
          .filter(txt => txt.length >= 8 && txt.length <= 140); // Exclure trop courts/vides

      const structure = Array.from(
        new Set(
          Array.from(document.querySelectorAll('header,nav,main,footer,section'))
            .map(el => el.tagName.toLowerCase())
        )
      );

      const texts = pick('h1,h2,h3,button,a').slice(0, maxTexts);

      return {
        title: document.title || '',
        structure,
        texts
      };
    }, { maxTexts: MAX_TEXTS });

    // ── Étape 3 : Screenshot
    await page.screenshot({ path: SCREENSHOT, fullPage: true });
    console.log(`✅  Screenshot : ${SCREENSHOT}`);

    // ── Étape 4 : Enregistrement du JSON
    const output = {
      url,
      title,
      structure,
      texts,
      timestamp: new Date().toISOString()
    };

    await fs.writeFile(RESULT, JSON.stringify(output, null, 2), 'utf8');
    console.log(`✅  Résultat : ${RESULT}`);
  } catch (err) {
    console.error('❌  Échec du crawl :', err.message || err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();

// ─── Scrolling dynamique de la page ─────────────────
async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise(resolve => {
      let totalHeight = 0;
      const distance = 600;
      const delay = 100;

      const timer = setInterval(() => {
        const { scrollHeight } = document.body;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight - window.innerHeight) {
          clearInterval(timer);
          resolve();
        }
      }, delay);
    });
  });
}
