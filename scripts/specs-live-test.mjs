import { chromium as pw } from '@playwright/test';
import chromium from '@sparticuz/chromium';
import lighthouse from 'lighthouse';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { brotliDecompressSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Same browser setup as scripts/verify-motion.mjs / verify-favorites.mjs
// (sandbox has no NSS packages; unpack the npm-shipped libraries).
const executablePath = await chromium.executablePath();
if (process.platform === 'linux') {
  const libs = path.join(tmpdir(), 'motion-chromium-libs');
  await mkdir(libs, { recursive: true });
  const archive = path.join(libs, 'al2023.tar');
  await writeFile(archive, brotliDecompressSync(await readFile('node_modules/@sparticuz/chromium/bin/al2023.tar.br')));
  execFileSync('tar', ['-xf', archive, '-C', libs]);
  process.env.LD_LIBRARY_PATH = `${libs}/lib:${process.env.LD_LIBRARY_PATH || ''}`;
}

const browser = await pw.launch({ executablePath, args: chromium.args, headless: true });

const BASE = 'http://localhost:4321';
const results = [];
const check = (name, cond, extra = '') => {
  results.push(`${cond ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`);
  if (!cond) process.exitCode = 1;
};

const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

// ---------- 1. Variant sync on iPhone 17 Pro ----------
await page.goto(`${BASE}/catalog/iphone/iphone-17-pro/`, { waitUntil: 'load' });
await page.evaluate(() => { window.__noReloadMarker = 42; });

const sec = page.locator('section[aria-labelledby="specs-heading"]');
const val = (label) =>
  sec.locator(`div:has(> dt:text-is("${label}")) > dd`).first().textContent().then(t => t.trim());

const mem0 = await val('Память');
const col0 = await val('Цвет');
const sim0 = await val('SIM-карта');
check('summary renders Память/Цвет/SIM-карта', Boolean(mem0 && col0 && sim0), `${mem0} / ${col0} / ${sim0}`);

// change memory
const memBtns = page.locator('[aria-label="Объём памяти"] button');
const memOpts = await memBtns.allTextContents();
const otherMem = memOpts.find(t => t.trim() !== mem0);
await memBtns.filter({ hasText: otherMem }).first().click();
await page.waitForTimeout(150);
const mem1 = await val('Память');
check('memory variant sync (no reload)', mem1 === otherMem && mem1 !== mem0, `${mem0} → ${mem1} (options: ${memOpts.join(', ')})`);

// change color
const colBtns = page.locator('[role="group"][aria-label="Цвет"] button');
const colNames = await colBtns.evaluateAll(btns => btns.map(b => b.getAttribute('aria-label')));
const otherCol = colNames.find(n => !col0.startsWith(n));
if (otherCol) {
  await colBtns.nth(colNames.indexOf(otherCol)).click();
  await page.waitForTimeout(150);
  const col1 = await val('Цвет');
  check('color variant sync (no reload)', col1.startsWith(otherCol) && col1 !== col0, `${col0} → ${col1}`);
} else {
  check('color variant sync (no reload)', true, 'only one color available');
}

// change SIM
const simBtns = page.locator('[role="group"][aria-label="Версия SIM"] button');
if (await simBtns.count() > 1) {
  const simOpts = await simBtns.allTextContents();
  const otherSim = simOpts.find(t => t.trim() !== sim0);
  await simBtns.filter({ hasText: otherSim }).first().click();
  await page.waitForTimeout(150);
  const sim1 = await val('SIM-карта');
  check('SIM variant sync (no reload)', sim1 === otherSim && sim1 !== sim0, `${sim0} → ${sim1} (options: ${simOpts.join(', ')})`);
} else {
  check('SIM variant sync (no reload)', true, 'only one SIM option');
}

const marker = await page.evaluate(() => window.__noReloadMarker);
check('no page reload during variant changes', marker === 42);

// ---------- 2. Expand / collapse ----------
const toggle = page.locator('button.specs-toggle');
const details = page.locator('#specs-details');

const label0 = (await toggle.textContent()).trim();
const exp0 = await toggle.getAttribute('aria-expanded');
const vis0 = await details.isVisible();
check('collapsed by default', exp0 === 'false' && !vis0 && label0 === 'Показать все характеристики', `label="${label0}" aria-expanded=${exp0}`);

await toggle.click();
const label1 = (await toggle.textContent()).trim();
const exp1 = await toggle.getAttribute('aria-expanded');
const vis1 = await details.isVisible();
const groupCount = await page.locator('#specs-details .specs-group').count();
const rowCount = await page.locator('#specs-details .specs-group dl > div').count();
check('expands inline, label swaps', exp1 === 'true' && vis1 && label1 === 'Свернуть характеристики', `label="${label1}", ${groupCount} groups, ${rowCount} rows`);

const urlAfterExpand = page.url();
check('no reload on expand', (await page.evaluate(() => window.__noReloadMarker)) === 42 && urlAfterExpand.includes('iphone-17-pro'));

await toggle.click();
const label2 = (await toggle.textContent()).trim();
const exp2 = await toggle.getAttribute('aria-expanded');
const vis2 = await details.isVisible();
const stillInDom = await page.locator('#specs-details .specs-group').count();
check('collapses back to compact preview', exp2 === 'false' && !vis2 && label2 === 'Показать все характеристики', `label="${label2}"`);
check('collapsed content stays in DOM (not removed)', stillInDom === groupCount, `${stillInDom} groups still present`);

// ---------- 3. Category adaptation spot-checks ----------
// PS5: no SIM anywhere in summary; MacBook: Серия/Память/Процессор/Экран
await page.goto(`${BASE}/catalog/consoles/sony-playstation-5-slim/`, { waitUntil: 'load' });
const psSec = page.locator('section[aria-labelledby="specs-heading"]');
const psLabels = await psSec.locator('dt').allTextContents();
check('PS5 summary has no SIM-карта', !psLabels.includes('SIM-карта'), `labels: ${psLabels.slice(0, 4).join(', ')}`);

await page.goto(`${BASE}/catalog/macbook/macbook-air-13-m5/`, { waitUntil: 'load' });
const mbSec = page.locator('section[aria-labelledby="specs-heading"]');
const mbLabels = (await mbSec.locator('dl').first().locator('dt').allTextContents());
check('MacBook summary = Серия/Память/Процессор/Экран', JSON.stringify(mbLabels) === JSON.stringify(['Серия', 'Память', 'Процессор', 'Экран']), mbLabels.join(', '));

// ---------- 4. Mobile layout: no horizontal overflow ----------
await page.setViewportSize({ width: 375, height: 800 });
await page.goto(`${BASE}/catalog/iphone/iphone-17-pro/`, { waitUntil: 'load' });
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
check('mobile 375px: no horizontal overflow', overflow <= 0, `overflow=${overflow}px`);
await page.locator('button.specs-toggle').click();
const overflowOpen = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
check('mobile expanded: no horizontal overflow', overflowOpen <= 0, `overflow=${overflowOpen}px`);
const ddAligned = await page.locator('section[aria-labelledby="specs-heading"] dd').first().evaluate(el => getComputedStyle(el).textAlign);
check('mobile values readable', ddAligned === 'right' || ddAligned === 'start', `dd text-align=${ddAligned}`);

await browser.close();
console.log('\n===== LIVE SPECS TEST RESULTS =====');
console.log(results.join('\n'));

// ---------- 5. Lighthouse audit of a product page (specs block included) ----------
const auditBrowser = await pw.launch({ executablePath, args: [...chromium.args, '--remote-debugging-port=9224'], headless: true });
const audit = await lighthouse(`${BASE}/catalog/iphone/iphone-17-pro/`, {
  port: 9224,
  onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
  logLevel: 'error',
});
await auditBrowser.close();
const cats = Object.fromEntries(Object.entries(audit.lhr.categories).map(([k, v]) => [k, v.score * 100]));
const cls = audit.lhr.audits['cumulative-layout-shift'].numericValue;
console.log('\n===== LIGHTHOUSE (product page /catalog/iphone/iphone-17-pro/) =====');
console.log(JSON.stringify({ ...cats, CLS: cls }));
check('Lighthouse product page ≥ 95 in all categories', Object.values(cats).every(s => s >= 95), JSON.stringify(cats));
check('Lighthouse CLS ≈ 0', cls < 0.01, `CLS=${cls}`);

console.log(process.exitCode ? '\nSOME CHECKS FAILED' : '\nALL LIVE CHECKS PASSED');
