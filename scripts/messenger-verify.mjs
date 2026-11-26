/**
 * Functional QA for the messenger update (run against the preview server).
 * Checks: messenger links exist, tap targets >=44px, no horizontal overflow at
 * 375px, Telegram phone-only link has no ?text=, WhatsApp prefilled text decodes
 * correctly, and the Trade-In estimator links update on select changes.
 */
import { chromium as playwright } from '@playwright/test';
import chromium from '@sparticuz/chromium';
import { mkdir } from 'node:fs/promises';
import { brotliDecompressSync } from 'node:zlib';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';

const base = process.env.QA_URL || 'http://localhost:4321';
const executablePath = process.env.CHROME_PATH || await chromium.executablePath();
if (!process.env.CHROME_PATH && process.platform === 'linux') {
  const libs = path.join(tmpdir(), 'qa-chromium-libs');
  await mkdir(libs, { recursive: true });
  const archive = path.join(libs, 'al2023.tar');
  await writeFile(archive, brotliDecompressSync(await readFile('node_modules/@sparticuz/chromium/bin/al2023.tar.br')));
  execFileSync('tar', ['xf', archive, '-C', libs]);
  process.env.LD_LIBRARY_PATH = `${libs}/lib:${process.env.LD_LIBRARY_PATH || ''}`;
}
const browser = await playwright.launch({ executablePath, args: chromium.args, headless: true });
const fails = [];
const check = (label, ok) => { console.log(`${ok ? '✓' : '✗'} ${label}`); if (!ok) fails.push(label); };

// --- Product page contact row (1440 + 375) ---
for (const width of [1440, 375]) {
  const context = await browser.newContext({ viewport: { width, height: 1000 } });
  const page = await context.newPage();
  await page.goto(`${base}/catalog/iphone/iphone-18-pro/`, { waitUntil: 'networkidle' });
  const tg = page.locator('a[aria-label="Написать в Telegram"]').first();
  const wa = page.locator('a[aria-label="Написать в WhatsApp"]').first();
  await tg.waitFor({ state: 'visible', timeout: 15000 });
  await wa.waitFor({ state: 'visible', timeout: 15000 });

  const tgHref = await tg.getAttribute('href');
  const waHref = await wa.getAttribute('href');
  check(`[${width}] product Telegram link = ${tgHref} (no ?text= without username)`, tgHref === 'https://t.me/+79312020078');
  check(`[${width}] product WhatsApp link starts with https://wa.me/79312020078?text=`, waHref.startsWith('https://wa.me/79312020078?text='));
  const decoded = decodeURIComponent(waHref.split('text=')[1]);
  check(`[${width}] prefilled text decodes to: ${decoded}`, decoded.startsWith('Здравствуйте! Интересует iPhone 18 Pro,') && decoded.endsWith('Есть в наличии?'));
  for (const [name, loc] of [['telegram', tg], ['whatsapp', wa]]) {
    const box = await loc.boundingBox();
    check(`[${width}] ${name} tap target height >= 44px (${box.height?.toFixed(1)}px)`, box.height >= 44);
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(`[${width}] no horizontal overflow on product page (${overflow}px)`, overflow <= 0);
  await context.close();
}

// --- Contacts page ---
{
  const context = await browser.newContext({ viewport: { width: 375, height: 1000 } });
  const page = await context.newPage();
  await page.goto(`${base}/contacts/`, { waitUntil: 'networkidle' });
  const tg = page.locator('a[data-goal="click_telegram"]').first();
  const wa = page.locator('a[data-goal="click_whatsapp"]').first();
  await tg.waitFor({ state: 'visible' });
  await wa.waitFor({ state: 'visible' });
  check(`contacts: Telegram ${await tg.getAttribute('href')}`, (await tg.getAttribute('href')) === 'https://t.me/+79312020078');
  check(`contacts: WhatsApp ${await wa.getAttribute('href')}`, (await wa.getAttribute('href')) === 'https://wa.me/79312020078');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(`contacts @375: no horizontal overflow (${overflow}px)`, overflow <= 0);
  await context.close();
}

// --- Footer ---
{
  const context = await browser.newContext({ viewport: { width: 375, height: 1000 } });
  const page = await context.newPage();
  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  const footerWa = page.locator('footer a[aria-label="Написать в WhatsApp"]').first();
  await footerWa.waitFor({ state: 'visible' });
  check(`footer: WhatsApp ${await footerWa.getAttribute('href')}`, (await footerWa.getAttribute('href')) === 'https://wa.me/79312020078');
  const footerTg = page.locator('footer a[aria-label="Написать в Telegram"]').first();
  check(`footer: Telegram ${await footerTg.getAttribute('href')}`, (await footerTg.getAttribute('href')) === 'https://t.me/+79312020078');
  await context.close();
}

// --- Trade-In estimator: links update with selects ---
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  await page.goto(`${base}/services/`, { waitUntil: 'networkidle' });
  const tgLink = page.locator('[data-trade-in-estimator] [data-ti-link="telegram"]');
  const waLink = page.locator('[data-trade-in-estimator] [data-ti-link="whatsapp"]');
  await waLink.waitFor({ state: 'visible' });
  check(`estimator: initial Telegram href has no ?text= (${await tgLink.getAttribute('href')})`, !(await tgLink.getAttribute('href')).includes('text='));
  const initialWa = await waLink.getAttribute('href');
  check(`estimator: initial WhatsApp href prefilled`, initialWa.startsWith('https://wa.me/79312020078?text='));

  // Change selects and verify both links update
  await page.selectOption('[data-estimator-field="model"]', 'iPhone 15 Pro');
  await page.selectOption('[data-estimator-field="storage"]', '256 ГБ');
  await page.selectOption('[data-estimator-field="condition"]', 'Хорошее (мелкие царапины)');
  await page.waitForTimeout(200);
  const updatedTg = await tgLink.getAttribute('href');
  const updatedWa = decodeURIComponent((await waLink.getAttribute('href')).split('text=')[1]);
  check(`estimator: Telegram still plain after change (${updatedTg})`, updatedTg === 'https://t.me/+79312020078');
  check(`estimator: WhatsApp text after change: ${updatedWa}`, updatedWa === 'Здравствуйте! Интересует Trade-In: iPhone 15 Pro, 256 ГБ, Хорошее (мелкие царапины).');
  await context.close();
}

await browser.close();
console.log(fails.length ? `\n${fails.length} CHECK(S) FAILED` : '\nALL CHECKS PASSED');
process.exit(fails.length ? 1 : 0);
