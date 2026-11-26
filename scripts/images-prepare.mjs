#!/usr/bin/env node
/**
 * images:prepare -- <input-file> <slug>
 * Local prep for an owner-dropped product photo: resizes the source to fit
 * 1600×2000 (4:5, contain, centered) on a uniform #F7F7F9 background — or keeps
 * transparency when the input has an alpha channel — and writes it as WebP
 * (quality ~82) to public/images/products/<slug>.webp.
 * Local resizing only: no retouching, no network access.
 *
 * Example:
 *   npm run images:prepare -- ./photos/iphone-17-air.jpg iphone-17-air-space-black-front
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const inputFile = process.argv[2];
const slug = process.argv[3];

if (!inputFile || !slug) {
  console.error('Использование: npm run images:prepare -- <входящий-файл> <slug>');
  console.error(
    'Пример: npm run images:prepare -- ./photos/iphone-17-air.jpg iphone-17-air-space-black-front'
  );
  process.exit(1);
}

const absIn = path.resolve(ROOT, inputFile);
if (!fs.existsSync(absIn)) {
  console.error(`Входной файл не найден: ${absIn}`);
  process.exit(1);
}

if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
  console.error(`Некорректный slug: «${slug}». Используйте латиницу и дефисы, например iphone-17-air-space-black-front.`);
  process.exit(1);
}

const meta = await sharp(absIn).metadata();
const hasAlpha = Boolean(meta.hasAlpha);

const outDir = path.join(ROOT, 'public', 'images', 'products');
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `${slug}.webp`);

await sharp(absIn)
  .resize({
    width: 1600,
    height: 2000,
    fit: 'contain',
    background: hasAlpha
      ? { r: 0, g: 0, b: 0, alpha: 0 }
      : { r: 247, g: 247, b: 249 },
  })
  .webp({ quality: 82 })
  .toFile(outFile);

console.log(
  `Готово: ${path.relative(ROOT, outFile)} (1600×2000, 4:5, WebP q82, ${
    hasAlpha ? 'прозрачность сохранена' : 'фон #F7F7F9'
  }). Запустите npm run images:check для проверки.`
);
