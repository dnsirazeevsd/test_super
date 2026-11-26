import { chromium as playwright } from '@playwright/test';
import chromium from '@sparticuz/chromium';
import lighthouse from 'lighthouse';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { gzipSync, brotliDecompressSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

const base = process.env.MOTION_URL || 'http://localhost:4321';
const out = 'report/motion';
await mkdir(out, { recursive: true });
const executablePath = process.env.CHROME_PATH || await chromium.executablePath();
// The sandbox has no NSS packages; use the libraries shipped with the npm browser.
if (!process.env.CHROME_PATH && process.platform === 'linux') {
  const libs = path.join(tmpdir(), 'motion-chromium-libs');
  await mkdir(libs, { recursive: true });
  const archive = path.join(libs, 'al2023.tar');
  await writeFile(archive, brotliDecompressSync(await readFile('node_modules/@sparticuz/chromium/bin/al2023.tar.br')));
  execFileSync('tar', ['xf', archive, '-C', libs]);
  process.env.LD_LIBRARY_PATH = `${libs}/lib:${process.env.LD_LIBRARY_PATH || ''}`;
}
const browser = await playwright.launch({ executablePath, args: chromium.args, headless: true });
const results = { date: new Date().toISOString(), checks: [], errors: [], metrics: {} };
const check = (label, value) => { assert.ok(value, label); results.checks.push(label); };
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await context.addInitScript(() => {
  Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
  Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
  window.__shifts = [];
  new PerformanceObserver(list => list.getEntries().forEach(e => { if (!e.hadRecentInput) window.__shifts.push(e.value); })).observe({ type: 'layout-shift', buffered: true });
});
const page = await context.newPage();
page.on('pageerror', e => results.errors.push(e.message));
await page.goto(base);
await page.waitForTimeout(110);
await page.screenshot({ path: `${out}/hero-entrance.png` });
await page.waitForTimeout(1000);
await page.screenshot({ path: `${out}/hero-settled.png` });
const jsFiles = await page.evaluate(() => [...new Set(performance.getEntriesByType('resource').map(e => e.name).filter(url => new URL(url).pathname.endsWith('.js')))]);
let jsBytes = 0;
for (const url of jsFiles) jsBytes += gzipSync(await readFile(`dist${new URL(url).pathname}`)).length;
const inlineJS = await page.locator('script:not([src]):not([type="application/ld+json"])').allTextContents();
jsBytes += gzipSync(inlineJS.join('\n')).length;
results.metrics.homepageJS = { gzipBytesIncludingDeferredDesktopLenis: jsBytes, files: jsFiles.map(url => new URL(url).pathname) };
check('Homepage JS including deferred desktop Lenis is <=150KB gzip', jsBytes <= 150 * 1024);
check('Hero content is server rendered', (await (await page.request.get(base)).text()).includes('hero-headline'));
check('Desktop Lenis enabled', await page.locator('html').evaluate(el => el.classList.contains('lenis')));
check('Body copy is not a scroll reveal target', await page.locator('p.reveal-ready').count() === 0);
await page.keyboard.press('Tab');
check('Skip link receives keyboard focus', await page.evaluate(() => document.activeElement?.getAttribute('href') === '#main-content'));
await page.keyboard.press('Enter');
await page.locator('.product-tile').first().scrollIntoViewIfNeeded();
await page.waitForTimeout(650);
await page.locator('.product-tile').first().hover();
await page.waitForTimeout(300);
const tile = await page.locator('.product-tile').first().evaluate(el => ({ tile: getComputedStyle(el).transform, image: getComputedStyle(el.querySelector('img')).transform }));
check('Tile hover lifts exactly 4px', tile.tile.includes('-4'));
check('Tile image scales to 1.02', tile.image.startsWith('matrix(1.02'));
await page.screenshot({ path: `${out}/tile-hover.png` });
const revealed = page.locator('main h2').first();
check('Scrolled heading revealed', await revealed.evaluate(el => !el.classList.contains('reveal-pending')));
await page.evaluate(() => scrollTo(0, 0));
await page.waitForTimeout(150);
await revealed.scrollIntoViewIfNeeded();
check('Heading reveals only once', await revealed.evaluate(el => !el.classList.contains('reveal-pending')));
await page.locator('.nav-drop-trigger').focus();
check('Catalog menu opens for keyboard focus', await page.locator('.nav-drop-panel').evaluate(el => getComputedStyle(el).visibility === 'visible'));
await page.keyboard.press('Escape');
check('Catalog Escape keeps focus but dismisses panel', await page.locator('.nav-drop-panel').evaluate(el => getComputedStyle(el).visibility === 'hidden') && await page.locator('.nav-drop-trigger').evaluate(el => el === document.activeElement));
await page.locator('.product-tile').first().focus();
check('Header is solid after 24px', await page.locator('[data-header]').evaluate(el => el.classList.contains('is-scrolled') && getComputedStyle(el).backgroundColor === 'rgb(255, 255, 255)'));
await page.locator('.product-tile').first().click();
await page.waitForURL('**/catalog/iphone/iphone-18-pro/**');
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/configurator-before.png` });
const configGeometry = () => page.locator('.config-image, .config-price').evaluateAll(els => els.map(el => { const r = el.getBoundingClientRect(); return [r.x + scrollX, r.y + scrollY, r.height]; }));
const initialConfigGeometry = await configGeometry();
const storage = page.getByRole('group', { name: 'Объём памяти' }).locator('button[aria-pressed="false"]').first();
await storage.click();
await page.waitForTimeout(70);
check('Configurator snapshots are decorative', await page.locator('.config-snapshot').evaluateAll(els => els.length > 0 && els.every(el => el.getAttribute('aria-hidden') === 'true' && el.inert)));
check('Storage keeps keyboard focus', await page.getByRole('group', { name: 'Объём памяти' }).locator('button[aria-pressed="true"]').evaluate(el => el === document.activeElement));
await page.screenshot({ path: `${out}/configurator-storage-mid.png` });
await page.waitForTimeout(500);
check('Configurator snapshots clean up', await page.locator('.config-snapshot').count() === 0);
const color = page.getByRole('group', { name: 'Цвет', exact: true }).locator('button[aria-pressed="false"]').first();
await color.click();
await page.waitForTimeout(100);
await page.screenshot({ path: `${out}/configurator-color-mid.png` });
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/configurator-after.png` });
assert.deepEqual(await configGeometry(), initialConfigGeometry, 'Image and price geometry stable across storage/color changes');
results.checks.push('Image and price geometry stable across storage/color changes');
// Rapid input must leave the selected data, focus, and image in sync.
const options = page.getByRole('group', { name: 'Объём памяти' }).locator('button');
await options.nth(0).click(); await options.nth(1).click(); await options.nth(0).click();
await page.waitForTimeout(600);
check('Rapid changes leave no stale overlays', await page.locator('.config-snapshot').count() === 0);
await page.emulateMedia({ reducedMotion: 'reduce' });
await page.waitForTimeout(80);
check('Reduced motion removes Lenis', !await page.locator('html').evaluate(el => el.classList.contains('lenis')));
await options.nth(1).click();
check('Reduced motion skips configurator animations', await page.locator('.config-snapshot').count() === 0);
await page.goto(base);
await page.waitForTimeout(500);
check('Reduced motion hero is instantly visible', await page.locator('.hero-headline').evaluate(el => getComputedStyle(el).opacity === '1' && getComputedStyle(el).transform === 'none'));
check('Reduced motion leaves no hidden reveals', await page.locator('.reveal-pending').count() === 0);
await page.emulateMedia({ reducedMotion: 'no-preference' });
await page.getByRole('link', { name: 'Смотреть каталог', exact: true }).click();
await page.waitForTimeout(600);
await page.goBack();
await page.waitForTimeout(500);
check('Client navigation and back reinitialize motion', await page.locator('.hero-headline').count() === 1 && await page.locator('html').evaluate(el => el.classList.contains('lenis')));
results.metrics.desktopCLS = await page.evaluate(() => window.__shifts.reduce((a, b) => a + b, 0));
await context.close();

// Actual touch viewport + CDP CPU/network throttling, recorded as a Chrome Performance trace.
const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
await mobile.addInitScript(() => {
  Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
  Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
  window.__shifts = [];
  new PerformanceObserver(list => list.getEntries().forEach(e => { if (!e.hadRecentInput) window.__shifts.push(e.value); })).observe({ type: 'layout-shift', buffered: true });
});
const m = await mobile.newPage();
const cdp = await mobile.newCDPSession(m);
await cdp.send('Network.enable');
await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 });
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
await browser.startTracing(m, { screenshots: true, categories: ['devtools.timeline', 'v8', 'blink.user_timing', 'disabled-by-default-devtools.timeline', 'disabled-by-default-devtools.screenshot'] });
await m.goto(base);
await m.waitForTimeout(1800);
check('Touch stays on native scrolling', !await m.locator('html').evaluate(el => el.classList.contains('lenis')));
await m.screenshot({ path: `${out}/hero-mobile.png` });
await m.getByRole('button', { name: 'Открыть меню' }).click();
check('Mobile dialog traps focus', await m.evaluate(() => document.querySelector('#mobile-menu').contains(document.activeElement)));
await m.keyboard.press('Escape');
check('Dialog restores keyboard focus', await m.getByRole('button', { name: 'Открыть меню' }).evaluate(el => el === document.activeElement));
await m.evaluate(() => {
  performance.mark('motion-scroll-start');
  window.__frames = []; window.__framePrev = performance.now(); window.__recordFrames = true;
  const frame = time => { if (!window.__recordFrames) return; window.__frames.push(time - window.__framePrev); window.__framePrev = time; requestAnimationFrame(frame); };
  requestAnimationFrame(frame);
});
for (let y = 0; y <= 2700; y += 90) { await m.evaluate(y => scrollTo(0, y), y); await m.waitForTimeout(32); }
await m.waitForTimeout(650);
results.metrics.scrollFrames = await m.evaluate(() => {
  window.__recordFrames = false; performance.mark('motion-scroll-end');
  const frames = window.__frames.slice(1).sort((a, b) => a - b);
  return { count: frames.length, medianMs: frames[Math.floor(frames.length / 2)], p95Ms: frames[Math.floor(frames.length * 0.95)], maxMs: Math.max(...frames), over50Ms: frames.filter(t => t > 50).length };
});
const touchTile = m.locator('.product-tile').first();
await touchTile.scrollIntoViewIfNeeded(); await m.waitForTimeout(600);
const touchBox = await touchTile.boundingBox();
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: touchBox.x + touchBox.width / 2, y: touchBox.y + 50 }] });
await m.waitForTimeout(220);
check('Touch tile has short press feedback', await touchTile.evaluate(el => getComputedStyle(el).transform.startsWith('matrix(0.99')));
await m.screenshot({ path: `${out}/tile-touch-press.png` });
await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
await m.waitForTimeout(240);
check('Touch feedback does not stick', await touchTile.evaluate(el => getComputedStyle(el).transform === 'none'));
results.metrics.mobileCLS = await m.evaluate(() => window.__shifts.reduce((a, b) => a + b, 0));
const trace = await browser.stopTracing();
await writeFile(`${out}/mobile-performance-trace.json.gz`, gzipSync(trace));
const events = JSON.parse(trace.toString()).traceEvents;
const tasks = events.filter(e => e.name === 'RunTask' && e.ph === 'X');
const longTasks = tasks.filter(e => e.dur > 50000);
const scrollStart = events.find(e => e.name === 'motion-scroll-start')?.ts || Infinity;
const scrollEnd = events.find(e => e.name === 'motion-scroll-end')?.ts || 0;
const scrollLongTasks = longTasks.filter(e => e.ts >= scrollStart && e.ts <= scrollEnd);
results.metrics.trace = { profile: '390x844 touch; 4× CPU; 1.6Mbps down / 750Kbps up; 150ms RTT', taskCount: tasks.length, longTasks: longTasks.length, scrollLongTasks: scrollLongTasks.length, longestTaskMs: Math.max(0, ...tasks.map(e => e.dur / 1000)) };
await mobile.close();

for (const mode of ['save-data', 'low-end']) {
  const c = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await c.addInitScript(mode => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => mode === 'low-end' ? 2 : 8 });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
    if (mode === 'save-data') Object.defineProperty(navigator, 'connection', { get: () => ({ saveData: true }) });
  }, mode);
  const p = await c.newPage(); await p.goto(base); await p.waitForTimeout(400);
  check(`${mode} uses instant native states`, await p.locator('html').evaluate(el => el.classList.contains('motion-simple') && !el.classList.contains('lenis')) && await p.locator('.reveal-pending').count() === 0);
  await c.close();
}
// Compare geometry and visible text to the original commit (optional local baseline server).
if (process.env.BASELINE_URL) {
  results.metrics.layoutComparison = [];
  for (const width of [390, 1440]) {
    for (const route of ['/', '/catalog/iphone/iphone-18-pro/']) {
      const geometries = [];
      for (const origin of [process.env.BASELINE_URL, base]) {
        const c = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
        const p = await c.newPage(); await p.goto(`${origin}${route}`); await p.waitForTimeout(500);
        geometries.push(await p.evaluate(() => ({
          text: document.querySelector('main').innerText,
          boxes: [...document.querySelectorAll('main h1, main h2, main p, main img, main .btn')].map(el => {
            const r = el.getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map(v => Math.round(v * 100) / 100);
          }),
        })));
        await c.close();
      }
      assert.deepEqual(geometries[0], geometries[1], `Unchanged text and layout: ${width}px ${route}`);
      results.metrics.layoutComparison.push({ width, route, identical: true });
    }
  }
  results.checks.push('Baseline text and geometry unchanged on home/product at mobile/desktop widths');
}
const fallback = await browser.newContext();
await fallback.addInitScript(() => { document.startViewTransition = undefined; });
const f = await fallback.newPage(); await f.goto(base);
await f.getByRole('link', { name: 'Смотреть каталог', exact: true }).click();
await f.waitForURL('**/catalog/');
check('Unsupported View Transitions still navigate without a page animation', await f.locator('#main-content').count() === 1 && await f.evaluate(() => document.getAnimations().every(a => !a.effect?.pseudoElement?.includes('view-transition'))));
await fallback.close();
check('No browser errors', results.errors.length === 0);
await browser.close();

// Lighthouse uses its standard simulated mobile profile, not the custom trace profile.
const auditBrowser = await playwright.launch({ executablePath, args: [...chromium.args, '--remote-debugging-port=9222'], headless: true });
const audit = await lighthouse(base, { port: 9222, output: ['html', 'json'], onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'], logLevel: 'error' });
await writeFile(`${out}/lighthouse-mobile.html`, audit.report[0]);
await writeFile(`${out}/lighthouse-mobile.json`, audit.report[1]);
results.metrics.lighthouse = Object.fromEntries(Object.entries(audit.lhr.categories).map(([key, value]) => [key, value.score * 100]));
results.metrics.lighthouseCLS = audit.lhr.audits['cumulative-layout-shift'].numericValue;
results.metrics.lighthouseLCP = audit.lhr.audits['largest-contentful-paint'].numericValue;
results.metrics.lighthouseTBT = audit.lhr.audits['total-blocking-time'].numericValue;
await auditBrowser.close();
await writeFile(`${out}/verification.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
assert.ok(results.metrics.lighthouse.performance >= 95, 'Lighthouse performance >=95');
assert.ok(results.metrics.mobileCLS < 0.01, 'Mobile CLS approximately zero');
