// crawl_site.ts
import { chromium } from 'playwright';
import fs from 'fs';

const url = process.argv[2]; // exemple: `ts-node crawl_site.ts https://backmarket.fr`

if (!url) {
  console.error('❌ Fournis une URL en argument.');
  process.exit(1);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ locale: 'fr-FR' });

  try {
    await page.goto(url, { waitUntil: 'networkidle' });

    // Scroll
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // Structure
    const structure = await page.evaluate(() =>
      Array.from(document.querySelectorAll('header, nav, main, footer, section')).map(el => el.tagName.toLowerCase())
    );

    // Textes
    const texts = await page.evaluate(() =>
      Array.from(document.querySelectorAll('h1,h2,h3,button,a'))
        .slice(0, 20)
        .map(el => (el as HTMLElement).innerText.trim())
        .filter(Boolean)
    );

    // Screenshot
    const file = 'screenshot.png';
    await page.screenshot({ path: file, fullPage: true });
    console.log(`✅ Screenshot saved as ${file}`);

    // Résultat
    const result = {
      url,
      title: await page.title(),
      structure,
      texts
    };

    fs.writeFileSync('result.json', JSON.stringify(result, null, 2));
    console.log('✅ Crawl terminé. Résultat dans result.json');
  } catch (err) {
    console.error('❌ Erreur de crawl', err);
  } finally {
    await browser.close();
  }
})();