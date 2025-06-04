// crawl_site.js (ESM)
import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const url = process.argv[2];
if (!url) {
  console.error('❌  Utilisation : node crawl_site.js <URL>');
  process.exit(1);
}

// 1. Configuration centralisée
const TIMEOUT    = 90_000;      // 90 s max par page
const MAX_TEXTS  = 20;          // textes à extraire
const SCREENSHOT = 'screenshot.png';
const RESULT     = 'result.json';

(async () => {
  // 2. Lancement du navigateur (–--single-process = + léger)
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
    // 3. Navigation (DOM loaded → on force un scroll complet)
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    await page.waitForLoadState('networkidle', { timeout: TIMEOUT }).catch(() => {});
    await autoScroll(page);

    // 4. Extraction structure + textes
    const { structure, texts, title } = await page.evaluate(
      ({ maxTexts }) => {
        const pick = (sel, mapper) =>
          Array.from(document.querySelectorAll(sel))
            .map(mapper)
            .filter(Boolean);

        const structure = pick('header,nav,main,footer,section', el =>
          el.tagName.toLowerCase()
        );

        const texts = pick('h1,h2,h3,button,a', el =>
          el.textContent.trim()
        ).slice(0, maxTexts);

        return { structure, texts, title: document.title };
      },
      { maxTexts: MAX_TEXTS }
    );

    // 5. Screenshot
    await page.screenshot({ path: SCREENSHOT, fullPage: true });
    console.log(`✅  Screenshot : ${SCREENSHOT}`);

    // 6. Sauvegarde JSON
    const result = { url, title, structure, texts, timestamp: new Date().toISOString() };
    await fs.writeFile(RESULT, JSON.stringify(result, null, 2));
    console.log(`✅  Résultat : ${RESULT}`);
  } catch (err) {
    console.error('❌  Échec du crawl :', err.message || err);
  } finally {
    await browser.close();
  }
})();

/* -------------------------------------------------------------- */
/* Helpers                                                        */
/* -------------------------------------------------------------- */
async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise(resolve => {
      let totalHeight = 0;
      const distance = 800;
      const timer = setInterval(() => {
        const { scrollHeight } = document.body;
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= scrollHeight - window.innerHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 150);
    });
  });
}
