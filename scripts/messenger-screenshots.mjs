/**
 * Messenger update screenshots: product page contact row, /contacts/, footer and
 * /services/ at 1440px and 375px → report/screenshots/.
 * Uses the bundled @sparticuz/chromium binary (no system Chrome required).
 */
import { chromium as playwright } from '@playwright/test';
import chromium from '@sparticuz/chromium';
import { mkdir } from 'node:fs/promises';
import { brotliDecompressSync } from 'node:zlib';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';

const base = process.env.SHOT_URL || 'http://localhost:4321';
const out = path.join(process.cwd(), 'report', 'screenshots');
await mkdir(out, { recursive: true });

const executablePath = process.env.CHROME_PATH || await chromium.executablePath();
// The sandbox has no NSS packages; use the libraries shipped with the npm browser.
if (!process.env.CHROME_PATH && process.platform === 'linux') {
  const libs = path.join(tmpdir(), 'shot-chromium-libs');
  await mkdir(libs, { recursive: true });
  const archive = path.join(libs, 'al2023.tar');
  await writeFile(archive, brotliDecompressSync(await readFile('node_modules/@sparticuz/chromium/bin/al2023.tar.br')));
  execFileSync('tar', ['xf', archive, '-C', libs]);
  process.env.LD_LIBRARY_PATH = `${libs}/lib:${process.env.LD_LIBRARY_PATH || ''}`;
}

const browser = await playwright.launch({ executablePath, args: chromium.args, headless: true });

async function shot(page, name, fn, target) {
  await fn();
  const path_ = path.join(out, name);
  if (target) {
    await target.screenshot({ path: path_ });
  } else {
    await page.screenshot({ path: path_, fullPage: true });
  }
  console.log(`✓ ${name}`);
}

for (const width of [1440, 375]) {
  const context = await browser.newContext({ viewport: { width, height: 1000 }, deviceScaleFactor: 1 });
  const page = await context.newPage();

  // 1. Product page contact row (phone + Telegram + WhatsApp)
  await page.goto(`${base}/catalog/iphone/iphone-18-pro/`, { waitUntil: 'networkidle' });
  const waLink = page.locator('a[aria-label="Написать в WhatsApp"]').first();
  await waLink.waitFor({ state: 'visible', timeout: 15000 });
  await shot(page, `messenger-product-contact-row-${width}.png`, async () => {
    const row = waLink.locator('xpath=..');
    await row.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
  }, waLink.locator('xpath=..'));

  // 2. /contacts/
  await page.goto(`${base}/contacts/`, { waitUntil: 'networkidle' });
  await page.locator('a[aria-label="Написать в WhatsApp"]').first().waitFor({ state: 'visible', timeout: 15000 });
  await shot(page, `messenger-contacts-${width}.png`, async () => {});

  // 3. Footer
  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  await page.locator('footer a[aria-label="Написать в WhatsApp"]').first().waitFor({ state: 'visible', timeout: 15000 });
  await shot(page, `messenger-footer-${width}.png`, async () => {
    const footer = page.locator('footer');
    await footer.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
  }, page.locator('footer'));

  // 4. /services/ (Trade-In estimator with both secondary links)
  await page.goto(`${base}/services/`, { waitUntil: 'networkidle' });
  await page.locator('[data-trade-in-estimator] a[data-ti-link="whatsapp"]').waitFor({ state: 'visible', timeout: 15000 });
  await shot(page, `messenger-services-${width}.png`, async () => {
    const estimator = page.locator('[data-trade-in-estimator]');
    await estimator.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
  });

  await context.close();
}

// Extra: estimator block element shot at 1440 for close-up of the two links
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  await page.goto(`${base}/services/`, { waitUntil: 'networkidle' });
  await page.locator('[data-trade-in-estimator] a[data-ti-link="whatsapp"]').waitFor({ state: 'visible', timeout: 15000 });
  await page.locator('[data-trade-in-estimator]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.locator('[data-trade-in-estimator]').screenshot({ path: path.join(out, 'messenger-services-estimator-1440.png') });
  console.log('✓ messenger-services-estimator-1440.png');
  await context.close();
}

await browser.close();
console.log('Done — screenshots in report/screenshots/');
