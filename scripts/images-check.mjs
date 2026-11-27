#!/usr/bin/env node
/**
 * images:check — verify source category folders in assets/source/, manifest &
 * catalog image integrity (src/data/image-manifest.json, src/data/products.json,
 * src/content/news/*.md), and report which expected owner-supplied product photos
 * (src/data/images.json → products) are present in public/images/products/.
 *
 * Exits 1 on broken manifest/catalog/source-structure references; missing owner
 * photos in src/data/images.json remain non-fatal warnings (exits 0).
 * Wired to run automatically at the end of `npm run build`.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SOURCE_DIR = path.join(ROOT, 'assets', 'source');

const EXPECTED_SOURCE_DIRS = [
  'iphones',
  'samsung',
  'macbook',
  'headphones',
  'accessories',
  'other-products',
  'news',
  'news-covers',
];
const VALID_MANIFEST_PREFIXES = new Set(EXPECTED_SOURCE_DIRS);

const errors = [];

// 1. Verify assets/source/ category directory structure
for (const dir of EXPECTED_SOURCE_DIRS) {
  const full = path.join(SOURCE_DIR, dir);
  if (!fs.existsSync(full) || !fs.statSync(full).isDirectory()) {
    errors.push(`Отсутствует папка исходников: assets/source/${dir}/`);
  }
}
if (fs.existsSync(path.join(SOURCE_DIR, 'renders'))) {
  errors.push('Устаревшая папка assets/source/renders/ должна быть удалена');
}
const iphoneSources = fs.existsSync(path.join(SOURCE_DIR, 'iphones'))
  ? fs.readdirSync(path.join(SOURCE_DIR, 'iphones')).filter((f) => !f.startsWith('.'))
  : [];
for (const file of iphoneSources) {
  if (!/^iphone[-_]/i.test(file)) {
    errors.push(`Файл не из категории iPhone в assets/source/iphones/: ${file}`);
  }
}

// 2. Verify src/data/image-manifest.json originals and generated public derivatives
const manifestPath = path.join(ROOT, 'src', 'data', 'image-manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

for (const [key, entry] of Object.entries(manifest)) {
  const prefix = key.split('/')[0];
  if (!VALID_MANIFEST_PREFIXES.has(prefix)) {
    errors.push(`Некорректный префикс ключа манифеста «${key}» (ожидалась папка из assets/source/)`);
  }
  if (!entry.original || !fs.existsSync(path.join(ROOT, entry.original.replace(/^\//, '')))) {
    errors.push(`Исходный файл манифеста не найден для «${key}»: ${entry.original}`);
  }
  if (!entry.src || !fs.existsSync(path.join(ROOT, 'public', entry.src))) {
    errors.push(`Сгенерированный файл src не найден для «${key}»: public${entry.src}`);
  }
  for (const srcset of [entry.avifSrcset, entry.webpSrcset]) {
    if (!srcset) continue;
    for (const part of srcset.split(',')) {
      const url = part.trim().split(/\s+/)[0];
      if (url && !fs.existsSync(path.join(ROOT, 'public', url))) {
        errors.push(`Файл из srcset не найден для «${key}»: public${url}`);
      }
    }
  }
}

// 3. Verify expected owner-supplied photos registry (src/data/images.json)
const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'data', 'images.json'), 'utf8'));
const expectedProducts = Array.isArray(registry.products) ? registry.products : [];
const resolvedOwnerKeys = new Set();

const ownerLines = [];
let missingOwnerPhotos = 0;
for (const p of expectedProducts) {
  const abs = path.join(ROOT, 'public', p.expectedFile);
  const ok = fs.existsSync(abs);
  if (ok) {
    resolvedOwnerKeys.add(p.imageKey);
  } else {
    missingOwnerPhotos += 1;
  }
  ownerLines.push(
    `${ok ? '✓' : '✗'} ${p.expectedFile}${ok ? ' — найдено' : ' — не найдено, плейсхолдер остаётся'}`
  );
}

// 4. Verify all catalog & news imageKey references resolve cleanly
const productsData = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'data', 'products.json'), 'utf8'));
const hasKey = (k) => Boolean(manifest[k] || resolvedOwnerKeys.has(k));

for (const cat of productsData.categories || []) {
  if (cat.heroImageKey && !hasKey(cat.heroImageKey)) {
    errors.push(`Битый heroImageKey у категории «${cat.slug}»: ${cat.heroImageKey}`);
  }
}
for (const item of productsData.items || []) {
  if (item.imageKey && !hasKey(item.imageKey)) {
    errors.push(`Битый imageKey у товара «${item.id}»: ${item.imageKey}`);
  }
  for (const v of item.colorVariants || []) {
    if (v && v.imageKey && !hasKey(v.imageKey)) {
      errors.push(`Битый imageKey в colorVariants у товара «${item.id}»: ${v.imageKey}`);
    }
  }
  for (const extraKey of item.images || []) {
    if (extraKey && !hasKey(extraKey)) {
      errors.push(`Битый ключ в images[] у товара «${item.id}»: ${extraKey}`);
    }
  }
}

const newsDir = path.join(ROOT, 'src', 'content', 'news');
if (fs.existsSync(newsDir)) {
  for (const file of fs.readdirSync(newsDir)) {
    if (!file.endsWith('.md') || file.startsWith('_')) continue;
    const raw = fs.readFileSync(path.join(newsDir, file), 'utf8');
    const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!fmMatch) continue;
    const fm = fmMatch[1];
    const coverMatch = fm.match(/^cover:\s*["']?([^"'\r\n]+)["']?/m);
    if (coverMatch && !manifest[coverMatch[1].trim()]) {
      errors.push(`Битый cover в новости ${file}: ${coverMatch[1].trim()}`);
    }
    const imgBlock = fm.match(/^images:\s*\r?\n((?:\s*-\s*.+\r?\n?)*)/m);
    if (imgBlock) {
      for (const line of imgBlock[1].split(/\r?\n/)) {
        const m = line.match(/^\s*-\s*["']?([^"'\r\n]+)["']?/);
        if (m && !manifest[m[1].trim()]) {
          errors.push(`Битое фото в новости ${file}: ${m[1].trim()}`);
        }
      }
    }
  }
}

console.log('\n=== Проверка структуры assets/source/ и манифеста (images:check) ===');
console.log(
  `✓ Папки исходников проверены (${EXPECTED_SOURCE_DIRS.join(', ')}); записей в манифесте: ${Object.keys(manifest).length}`
);

if (expectedProducts.length === 0) {
  console.log('Реестр ожидаемых фото пуст — ничего проверять.');
} else {
  console.log(ownerLines.join('\n'));
  if (missingOwnerPhotos > 0) {
    console.log(
      `\n⚠ Фото не найдены: ${missingOwnerPhotos}/${expectedProducts.length}. Плейсхолдеры «Фото уточняется у менеджера» остаются в силе — добавьте файлы по указанным путям или запустите npm run images:prepare -- <файл> <slug>.`
    );
  } else {
    console.log(`\n✓ Все ${expectedProducts.length} ожидаемых фото товаров найдены.`);
  }
}

if (errors.length > 0) {
  console.error('\n✗ Обнаружены ошибки путей изображений:');
  for (const err of errors) {
    console.error(`  - ${err}`);
  }
  process.exit(1);
}

process.exit(0);
