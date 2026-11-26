#!/usr/bin/env node
/**
 * images:check — report which expected product photos are present and which are
 * still missing. Reads src/data/images.json → products and checks each expected
 * file in public/images/products/. Always exits 0: it is a warning, not a failure.
 * Wired to run automatically at the end of `npm run build`.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'data', 'images.json'), 'utf8'));
const products = Array.isArray(registry.products) ? registry.products : [];

if (products.length === 0) {
  console.log('\n=== Проверка фото товаров (images:check) ===');
  console.log('Реестр ожидаемых фото пуст — ничего проверять.');
  process.exit(0);
}

const lines = [];
let missing = 0;
for (const p of products) {
  const abs = path.join(ROOT, 'public', p.expectedFile);
  const ok = fs.existsSync(abs);
  if (!ok) missing += 1;
  lines.push(`${ok ? '✓' : '✗'} ${p.expectedFile}${ok ? ' — найдено' : ' — не найдено, плейсхолдер остаётся'}`);
}

console.log('\n=== Проверка фото товаров (images:check) ===');
console.log(lines.join('\n'));

if (missing > 0) {
  console.log(
    `\n⚠ Фото не найдены: ${missing}/${products.length}. Плейсхолдеры «Фото уточняется у менеджера» остаются в силе — добавьте файлы по указанным путям или запустите npm run images:prepare -- <файл> <slug>.`
  );
} else {
  console.log(`\n✓ Все ${products.length} ожидаемых фото товаров найдены.`);
}

process.exit(0);
