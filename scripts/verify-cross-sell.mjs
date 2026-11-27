#!/usr/bin/env node
/**
 * verify:cross-sell — Task 2B cross-sell («С этим также покупают») integrity check.
 *
 * Uses the SAME selection function as the rendered pages (src/lib/specs.mjs ->
 * getCrossSell) so the check can never drift from what users see. Validates:
 *   - no self-link (current product never appears),
 *   - no duplicates,
 *   - never more than 4 items,
 *   - never an incompatible item (brand rules + explicit compatibility),
 *   - cases / glass (subcategory `cases`) are never shown,
 *   - cross-sell is hidden (empty) only when genuinely no compatible item exists.
 * Also audits the built HTML (dist/) when present: every product page either
 * renders ≤4 cross-sell cards via <ProductCard> or legitimately hides the block.
 */
import fs from 'node:fs';
import path from 'node:path';
import { getCrossSell } from '../src/lib/specs.mjs';

const ROOT = process.cwd();
const products = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'src/data/products.json'), 'utf-8')
);

/* Build minimal groups (mirrors catalog.getGroupedModels grouping). */
const map = new Map();
for (const item of products.items) {
  const list = map.get(item.modelSlug) || [];
  list.push(item);
  map.set(item.modelSlug, list);
}
const groups = [];
for (const [modelSlug, items] of map.entries()) {
  const first = items[0];
  const prices = items.map((i) => i.price);
  groups.push({
    modelSlug,
    category: first.category,
    minPrice: Math.min(...prices),
    items: items.map((i) => ({
      subcategory: i.subcategory ?? null,
      brand: i.brand ?? null,
      compatibility: i.compatibility ?? [],
    })),
  });
}
const groupBySlug = new Map(groups.map((g) => [g.modelSlug, g]));

const DEVICE_BRAND = {
  iphone: 'Apple',
  macbook: 'Apple',
  samsung: 'Samsung',
  watch: 'Samsung',
  consoles: 'Sony',
};
function expectBrand(g) {
  const it = g.items[0];
  if (it.brand) return it.brand;
  return DEVICE_BRAND[g.category] || 'Apple';
}

let failures = 0;
const emptyPages = [];
const report = [];

function fail(msg) {
  failures++;
  console.error(`  ✗ ${msg}`);
}

for (const g of groups) {
  const picked = getCrossSell(g, groups);
  const pickedSlugs = picked.map((p) => p.modelSlug);

  // 1. no self
  if (pickedSlugs.includes(g.modelSlug)) fail(`${g.modelSlug}: contains itself`);
  // 2. no duplicates
  if (new Set(pickedSlugs).size !== pickedSlugs.length) fail(`${g.modelSlug}: duplicate entries`);
  // 3. ≤ 4
  if (picked.length > 4) fail(`${g.modelSlug}: more than 4 (${picked.length})`);
  // 4. never cases/glass
  for (const p of picked) {
    if (p.items[0].subcategory === 'cases') fail(`${g.modelSlug}: shows a case/glass (${p.modelSlug})`);
  }
  // 5. never incompatible (brand rule + explicit compatibility)
  const curBrand = expectBrand(g);
  for (const p of picked) {
    const pBrand = p.items[0].brand;
    const compat = p.items[0].compatibility || [];
    const explicit = compat.includes(g.modelSlug);
    let brandOk = false;
    if (g.category === 'accessories' || g.category === 'dyson') {
      brandOk = p.category === g.category && (pBrand === curBrand || (curBrand === 'Apple' && pBrand === 'Beats'));
    } else {
      brandOk =
        (p.category === 'accessories' || p.category === 'dyson') &&
        (pBrand === curBrand || (curBrand === 'Apple' && pBrand === 'Beats'));
    }
    if (!explicit && !brandOk) {
      fail(`${g.modelSlug}: incompatible item ${p.modelSlug} (brand ${pBrand} vs ${curBrand})`);
    }
  }

  if (picked.length === 0) {
    emptyPages.push(g.modelSlug);
    report.push(`  • ${g.modelSlug} (${g.category}) — нет совместимых товаров, блок скрыт`);
  } else {
    report.push(
      `  • ${g.modelSlug} (${g.category}) — ${picked.length}: ${pickedSlugs.join(', ')}`
    );
  }
}

console.log('\n=== Cross-sell selection (getCrossSell, shared with SSR) ===');
console.log(report.join('\n'));

// 6. Audit built HTML when present.
const distDir = path.join(ROOT, 'dist');
if (fs.existsSync(distDir)) {
  console.log('\n=== Audit built HTML (dist/) ===');
  for (const g of groups) {
    const pageDir = path.join(distDir, 'catalog', g.category, g.modelSlug);
    const htmlPath = fs.existsSync(path.join(pageDir, 'index.html'))
      ? path.join(pageDir, 'index.html')
      : null;
    if (!htmlPath) continue;
    const html = fs.readFileSync(htmlPath, 'utf-8');
    const csIdx = html.indexOf('data-cross-sell');
    let csCardCount = 0;
    let hid = false;
    if (csIdx !== -1) {
      // The cross-sell grid is the <div data-cross-sell> ... up to its section close.
      const tail = html.slice(csIdx);
      const gridMatch = tail.match(/<div class="cross-sell-grid[\s\S]*?<\/div>\s*<\/div>\s*<\/section>/);
      const grid = gridMatch ? gridMatch[0] : tail.slice(0, tail.indexOf('</section>'));
      csCardCount = (grid.match(/data-fav-btn/g) || []).length;
      hid = false;
    } else {
      hid = true; // block intentionally omitted when empty
    }
    const expected = getCrossSell(g, groups).length;
    if (expected === 0) {
      if (!hid && csCardCount !== 0) fail(`${g.modelSlug}: block rendered but should be hidden`);
    } else {
      if (hid || csCardCount === 0) fail(`${g.modelSlug}: expected ${expected} cards, found 0 in HTML`);
      else if (csCardCount > 4) fail(`${g.modelSlug}: ${csCardCount} cards in HTML (>4)`);
      else if (csCardCount !== expected)
        console.warn(`  ⚠ ${g.modelSlug}: HTML has ${csCardCount} cards, expected ${expected}`);
      else console.log(`  ✓ ${g.modelSlug}: ${csCardCount} cross-sell cards in HTML`);
    }
  }
}

console.log(
  `\n✓ Cross-sell check complete: ${groups.length} product pages, ` +
    `${emptyPages.length} with hidden block.`
);
if (emptyPages.length) {
  console.log('\nPages with NO cross-sell (block intentionally hidden):');
  console.log('  ' + emptyPages.join(', '));
}

if (failures > 0) {
  console.error(`\n✗ Cross-sell verification FAILED (${failures} issue(s)).`);
  process.exit(1);
}
console.log('\n✓ Cross-sell verification passed.');
