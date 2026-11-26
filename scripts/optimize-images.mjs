import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const SOURCE_DIR = path.join(ROOT, 'assets', 'source');
const OUT_DIR = path.join(ROOT, 'public', 'images');
const MANIFEST_PATH = path.join(ROOT, 'src', 'data', 'image-manifest.json');

const GROUPS = [
  { sub: 'iphones', outSub: 'products/iphones', widths: [400, 800, 1200] },
  { sub: 'samsung', outSub: 'products/samsung', widths: [400, 800, 1200] },
  { sub: 'macbook', outSub: 'products/macbook', widths: [400, 800, 1200] },
  { sub: 'headphones', outSub: 'products/headphones', widths: [400, 800, 1200] },
  { sub: 'accessories', outSub: 'products/accessories', widths: [400, 800, 1200] },
  { sub: 'other-products', outSub: 'products/other', widths: [400, 800, 1200] },
  { sub: 'news', outSub: 'news', widths: [480, 800, 1080] },
  { sub: 'news-covers', outSub: 'news', widths: [480, 800] },
];

const EXT_PRIORITY = { '.png': 3, '.webp': 2, '.jpg': 1, '.jpeg': 1 };

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

/**
 * When legacy photos (.jpg) and clean studio renders (.png/.webp) share a basename
 * inside the same category folder, prefer the lossless/higher-priority source file
 * deterministically regardless of filesystem directory order.
 */
function selectPreferredSourceFiles(files) {
  const byBase = new Map();
  for (const file of files) {
    const parsed = path.parse(file);
    const base = parsed.name;
    const ext = parsed.ext.toLowerCase();
    const prio = EXT_PRIORITY[ext] ?? 0;
    const existing = byBase.get(base);
    if (!existing || prio > existing.prio) {
      byBase.set(base, { file, prio });
    }
  }
  return Array.from(byBase.values(), (v) => v.file);
}

async function processGroup({ sub, outSub, widths }, generatedByOutSub) {
  const srcFolder = path.join(SOURCE_DIR, sub);
  const destFolder = path.join(OUT_DIR, outSub);

  let files = [];
  try {
    files = (await fs.readdir(srcFolder)).sort();
  } catch {
    return {};
  }

  const imageFiles = selectPreferredSourceFiles(
    files.filter((file) => /\.(png|jpe?g|webp)$/i.test(file))
  );
  if (imageFiles.length === 0) {
    return {};
  }

  await ensureDir(destFolder);
  const keptSet = generatedByOutSub.get(outSub) ?? new Set();
  generatedByOutSub.set(outSub, keptSet);

  const entries = {};
  for (const file of imageFiles) {
    const base = path.parse(file).name;
    const fullPath = path.join(srcFolder, file);
    const meta = await sharp(fullPath).metadata();
    const origW = meta.width || 800;
    const origH = meta.height || 1000;

    const validWidths = [...new Set(widths.filter((w) => w <= origW))];
    if (validWidths.length === 0) validWidths.push(origW);

    const avifParts = [];
    const webpParts = [];
    let defaultWebp = '';
    let finalW = origW;
    let finalH = origH;

    for (const w of validWidths) {
      const h = Math.round((origH * w) / origW);
      const avifName = `${base}-${w}w.avif`;
      const webpName = `${base}-${w}w.webp`;

      await sharp(fullPath)
        .resize({ width: w, withoutEnlargement: true })
        .avif({ quality: 62, effort: 4 })
        .toFile(path.join(destFolder, avifName));

      await sharp(fullPath)
        .resize({ width: w, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(path.join(destFolder, webpName));

      keptSet.add(avifName);
      keptSet.add(webpName);

      const urlPrefix = `/images/${outSub}`;
      avifParts.push(`${urlPrefix}/${avifName} ${w}w`);
      webpParts.push(`${urlPrefix}/${webpName} ${w}w`);
      defaultWebp = `${urlPrefix}/${webpName}`;
      finalW = w;
      finalH = h;
    }

    entries[`${sub}/${base}`] = {
      key: `${sub}/${base}`,
      original: `/assets/source/${sub}/${file}`,
      width: finalW,
      height: finalH,
      aspectRatio: Number((origW / origH).toFixed(4)),
      avifSrcset: avifParts.join(', '),
      webpSrcset: webpParts.join(', '),
      src: defaultWebp,
    };
    console.log(`Optimized ${sub}/${file} -> ${validWidths.join(', ')}w (AVIF + WebP)`);
  }

  return entries;
}

async function pruneStaleOutputs(generatedByOutSub) {
  const uniqueOutSubs = [...new Set(GROUPS.map((g) => g.outSub))];
  for (const outSub of uniqueOutSubs) {
    const destFolder = path.join(OUT_DIR, outSub);
    let dirEntries = [];
    try {
      dirEntries = await fs.readdir(destFolder, { withFileTypes: true });
    } catch {
      continue;
    }

    const kept = generatedByOutSub.get(outSub) ?? new Set();
    for (const entry of dirEntries) {
      if (!entry.isFile()) continue;
      if (!kept.has(entry.name)) {
        await fs.unlink(path.join(destFolder, entry.name));
        console.log(`Removed stale derivative public/images/${outSub}/${entry.name}`);
      }
    }

    const remaining = await fs.readdir(destFolder);
    if (remaining.length === 0) {
      await fs.rmdir(destFolder);
    }
  }
}

async function generateFaviconAndOg() {
  const publicDir = path.join(ROOT, 'public');
  await ensureDir(publicDir);

  try {
    // Flat 1200x630 Open Graph banner: brand violet square with the white S monogram,
    // white wordmark and muted facts — no gradients, consistent with the site identity.
    // (Favicons are pre-rendered static files: public/favicon.svg, favicon-32.png,
    //  favicon.ico, icon-192.png, icon-512.png, apple-touch-icon.png.)
    const bgSvg = Buffer.from(`
      <svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
        <rect width="1200" height="630" fill="#FFFFFF"/>
        <g transform="translate(120, 215)">
          <rect width="200" height="200" rx="50" fill="#6D28D9"/>
          <path d="M142.5 55H77.5C65.0736 55 55 65.0736 55 77.5C55 89.9264 65.0736 100 77.5 100H122.5C134.926 100 145 110.074 145 122.5C145 134.926 134.926 145 122.5 145H57.5" stroke="#FFFFFF" stroke-width="22.5" stroke-linecap="round" fill="none"/>
        </g>
        <text x="370" y="280" fill="#111111" font-family="sans-serif" font-size="64" font-weight="700" letter-spacing="2">SUPER STORE</text>
        <text x="372" y="340" fill="#6B6B76" font-family="sans-serif" font-size="32" font-weight="600">Магазин техники в ТРЦ «РИО» · Санкт-Петербург</text>
        <text x="372" y="404" fill="#6B6B76" font-family="sans-serif" font-size="26">Оригинальная техника Apple, Samsung, Sony с гарантией</text>
        <text x="120" y="540" fill="#6B6B76" font-family="sans-serif" font-size="24">ул. Фучика, д. 2 · Ежедневно 10:00–22:00 · +7 (931) 202-00-78</text>
      </svg>
    `);

    await sharp(bgSvg).jpeg({ quality: 88 }).toFile(path.join(publicDir, 'og-default.jpg'));

    console.log('Generated og-default.jpg (favicons are static files in public/)');
  } catch (err) {
    console.warn('Could not generate og banner:', err.message);
  }
}

async function main() {
  await ensureDir(path.dirname(MANIFEST_PATH));
  const manifest = {};
  const generatedByOutSub = new Map();
  for (const group of GROUPS) {
    const res = await processGroup(group, generatedByOutSub);
    Object.assign(manifest, res);
  }
  await pruneStaleOutputs(generatedByOutSub);
  await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
  await generateFaviconAndOg();
  console.log(`Saved manifest with ${Object.keys(manifest).length} assets to src/data/image-manifest.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
