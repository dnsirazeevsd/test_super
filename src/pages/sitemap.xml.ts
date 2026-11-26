import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import siteData from '../data/site.json';
import { CATEGORIES, getGroupedModels } from '../lib/catalog';

export const GET: APIRoute = async ({ site }) => {
  const origin = site ? site.origin : siteData.brand.domain;
  const news = await getCollection('news');
  const models = getGroupedModels();
  const hasAbout = Boolean((siteData.about || '').trim());
  const hasWarranty = Boolean((siteData.warranty || '').trim());

  const staticPaths = [
    '/',
    '/catalog/',
    ...CATEGORIES.map((c) => `/catalog/${c.slug}/`),
    ...models.map((m) => m.url),
    '/services/',
    ...siteData.services.map((s) => `/services/${s.slug}/`),
    '/delivery/',
    '/payment/',
    ...(hasAbout ? ['/about/'] : []),
    ...(hasWarranty ? ['/warranty/'] : []),
    '/news/',
    ...news.map((n) => `/news/${n.id}/`),
    '/contacts/',
    '/privacy/',
    '/terms/',
  ];

  const today = '2026-11-26';
  const urlsXml = staticPaths
    .map(
      (p) => `  <url>
    <loc>${new URL(p, origin).toString()}</loc>
    <lastmod>${today}</lastmod>
  </url>`
    )
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlsXml}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
};
