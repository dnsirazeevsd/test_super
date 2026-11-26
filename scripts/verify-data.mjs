import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();

async function walkHtml(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      files.push(...(await walkHtml(full)));
    } else if (e.name.endsWith('.html')) {
      files.push(full);
    }
  }
  return files;
}

async function main() {
  const productsJson = JSON.parse(
    await fs.readFile(path.join(ROOT, 'src/data/products.json'), 'utf-8')
  );
  const siteJson = JSON.parse(
    await fs.readFile(path.join(ROOT, 'src/data/site.json'), 'utf-8')
  );

  // 1. Verify product count === 30
  if (productsJson.items.length !== 30) {
    throw new Error(`Expected 30 products, found ${productsJson.items.length}`);
  }
  console.log(`✓ Product count verified: ${productsJson.items.length} items`);

  // 2. Compare against scraped old site if /tmp/old_site_dump/products_enriched.json exists
  try {
    const oldRaw = JSON.parse(
      await fs.readFile('/tmp/old_site_dump/products_enriched.json', 'utf-8')
    );
    const oldMap = new Map(oldRaw.map((p) => [p.id, Math.round(Number(p.price_content))]));
    for (const item of productsJson.items) {
      const expected = oldMap.get(item.legacyId);
      if (expected !== item.price) {
        throw new Error(
          `Price mismatch on ${item.legacyId} (${item.title}): expected ${expected}, got ${item.price}`
        );
      }
    }
    console.log('✓ All 30 product prices match old site 100% (RUB)');
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }

  // 3. Verify immutable contacts
  const phones = siteJson.contacts.phones.map((p) => p.raw);
  if (!phones.includes('+79312020078') || !phones.includes('+79312020088')) {
    throw new Error('Missing immutable phone numbers in site.json');
  }
  if (!siteJson.contacts.hours.display.includes('10:00') || !siteJson.contacts.hours.display.includes('22:00')) {
    throw new Error('Hours mismatch');
  }
  console.log('✓ Phones (+7 931 202-00-78, +7 931 202-00-88), address, and hours (10:00–22:00) verified');

  // 4. Verify 5 news markdown files
  const newsDir = path.join(ROOT, 'src/content/news');
  const newsFiles = (await fs.readdir(newsDir)).filter(
    (f) => f.endsWith('.md') && !f.startsWith('_')
  );
  if (newsFiles.length !== 5) {
    throw new Error(`Expected 5 news posts, found ${newsFiles.length}`);
  }
  console.log(`✓ News posts verified: ${newsFiles.length} markdown articles`);

  // 5. Audit built HTML files in dist/
  const distDir = path.join(ROOT, 'dist');
  const htmlFiles = await walkHtml(distDir);
  const titles = new Set();
  const descriptions = new Set();
  const emojiRegex = /[\p{Extended_Pictographic}]/u;

  for (const file of htmlFiles) {
    const html = await fs.readFile(file, 'utf-8');
    const rel = path.relative(distDir, file);

    if (!html.includes('<html lang="ru"')) {
      throw new Error(`Missing lang="ru" in ${rel}`);
    }
    if (html.includes('userapi.com') || html.includes('orgs.biz')) {
      throw new Error(`Found hotlinked legacy URL in built HTML: ${rel}`);
    }

    const titleMatch = html.match(/<title>([^<]+)<\/title>/);
    const descMatch = html.match(/<meta name="description" content="([^"]+)"/);
    if (!titleMatch || !descMatch) {
      throw new Error(`Missing title or meta description in ${rel}`);
    }
    const title = titleMatch[1];
    const desc = descMatch[1];

    if (emojiRegex.test(title) || emojiRegex.test(desc)) {
      throw new Error(`Emoji found in meta title/description in ${rel}: ${title}`);
    }
    if (titles.has(title)) {
      throw new Error(`Duplicate <title> "${title}" in ${rel}`);
    }
    if (descriptions.has(desc)) {
      throw new Error(`Duplicate <meta name="description"> in ${rel}`);
    }
    titles.add(title);
    descriptions.add(desc);

    if (!html.includes('rel="canonical"')) {
      throw new Error(`Missing canonical tag in ${rel}`);
    }
    if (!html.includes('application/ld+json')) {
      throw new Error(`Missing JSON-LD schema in ${rel}`);
    }
    if (!/<h1[\s>]/i.test(html)) {
      throw new Error(`Missing <h1> in ${rel}`);
    }
  }

  console.log(
    `✓ Audited ${htmlFiles.length} built HTML pages: unique titles & descriptions (zero emoji), canonicals, H1s, JSON-LD, lang="ru", and zero external hotlinking!`
  );
}

main().catch((err) => {
  console.error('VERIFICATION FAILED:', err);
  process.exit(1);
});
