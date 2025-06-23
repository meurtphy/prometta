1. Architecture minimale (MVP) du Crawler
pgsql
Copier le code
brutux/
│
├─ crawler-service/            ← micro-service indépendant
│   ├─ src/
│   │   ├─ index.ts            ← worker BullMQ
│   │   ├─ crawler.ts          ← Playwright + Lighthouse
│   │   ├─ domParser.ts        ← extraction structure + texte
│   │   ├─ metrics.ts          ← appel PageSpeed ou Lighthouse JSON
│   │   └─ storage.ts          ← upload PNG + JSON vers S3/MinIO
│   ├─ Dockerfile
│   ├─ package.json
│   └─ tsconfig.json
│
├─ docker-compose.yml          ← Postgres, Redis, MinIO, crawler-service
└─ README.md
Tech-stack décidée : TypeScript + Playwright + BullMQ + Redis.

2. Dépendances clés
js
Copier le code
// crawler-service/package.json
{
  "name": "crawler-service",
  "version": "0.1.0",
  "main": "dist/index.js",
  "type": "module",
  "scripts": {
    "start": "ts-node src/index.ts",
    "build": "tsc"
  },
  "dependencies": {
    "bullmq": "^4.16.0",
    "playwright": "^1.44.0",
    "lighthouse": "^11.10.0",
    "dotenv": "^16.5.0",
    "aws-sdk": "^2.1430.0"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "@types/node": "^20.11.17",
    "ts-node": "^10.9.2"
  }
}
3. Variables d’environnement (.env)
ini
Copier le code
REDIS_URL=redis://redis:6379
S3_ENDPOINT=http://minio:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=brutux-screens
PLAYWRIGHT_CHROMIUM_HEADLESS=true
LIGHTHOUSE_CHROMIUM_PATH=/usr/bin/chromium-browser
4. Worker BullMQ (src/index.ts)
ts
Copier le code
import { Queue, Worker } from 'bullmq';
import { crawlSite } from './crawler.js';
import * as dotenv from 'dotenv';
dotenv.config();

const connection = { url: process.env.REDIS_URL! };
export const crawlQueue = new Queue('crawl', { connection });

new Worker(
  'crawl',
  async job => {
    const { url } = job.data as { url: string };
    return await crawlSite(url);      // retourne JSON complet
  },
  { connection, concurrency: 2 }
);

console.log('Crawler worker up · waiting for jobs…');
5. Fonction cœur (src/crawler.ts – extrait)
ts
Copier le code
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { captureMetrics } from './metrics.js';
import { parseDom } from './domParser.js';
import { uploadFile } from './storage.js';

export async function crawlSite(url: string) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ locale: 'fr-FR' });

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    const { structure, texts } = await parseDom(page);
    const title = await page.title();

    const screenshotPath = `/tmp/${Date.now()}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });
    const s3Url = await uploadFile(screenshotPath);

    const performance = await captureMetrics(url);

    return {
      url,
      title,
      structure,
      texts,
      performance,
      screenshot: s3Url
    };
  } finally {
    await browser.close();
  }
}
6. Extraction DOM très simple (src/domParser.ts)
ts
Copier le code
import { Page } from 'playwright';

export async function parseDom(page: Page) {
  const structure = await page.evaluate(() => {
    const tags = ['header','nav','main','footer','section','article','aside'];
    const found = new Set<string>();
    tags.forEach(t => { if (document.querySelector(t)) found.add(t); });
    return Array.from(found);
  });

  const texts = await page.evaluate(() =>
    Array.from(document.querySelectorAll('h1,h2,button,a'))
         .slice(0, 20)
         .map(el => (el as HTMLElement).innerText.trim())
         .filter(Boolean)
  );

  return { structure, texts };
}
7. Mesures Lighthouse (src/metrics.ts)
ts
Copier le code
import { launch } from 'lighthouse/chrome-launcher';
import lighthouse from 'lighthouse';

export async function captureMetrics(url: string) {
  const chrome = await launch({ chromeFlags: ['--headless'] });
  const { lhr } = await lighthouse(url, { port: chrome.port, output: 'json' });
  await chrome.kill();
  return {
    LCP: lhr.audits['largest-contentful-paint'].numericValue / 1000,
    CLS: lhr.audits['cumulative-layout-shift'].numericValue,
    score: Math.round(lhr.categories.performance.score * 100)
  };
}
8. Mise en production rapide
docker-compose up -d
(Postgres, Redis, MinIO, crawler-service)

POST un job de test dans Redis :

bash
Copier le code
redis-cli
> LPUSH crawl {"url":"https://www.backmarket.fr"}
La worker sortira un JSON complet, prêt pour le module GPT.

9. Table SQL crawl_results (historique + coûts)
sql
Copier le code
CREATE TABLE crawl_results (
  id            UUID PRIMARY KEY,
  url           TEXT,
  json_payload  JSONB,
  total_time_ms INT,
  created_at    TIMESTAMP DEFAULT NOW()
);
10. Prochaines briques après validation
Prompt Builder : injecter json_payload dans les 12 prompts.

Audit Sections : stocker les réponses GPT + scoring.

API Gateway : exposer /audit/create → pousse un job dans la queue.

🎬 Comment tester en vrai ?
Clone ce squelette et exécute le worker.

Lance un premier crawl sur un site simple.

Vérifie que le JSON contient : structure, texts, performance, screenshot.

Si OK ➡️ connecte le résultat au module GPT pour générer la première section d’audit.

