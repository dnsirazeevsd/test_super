import type { APIRoute } from 'astro';
import siteData from '../data/site.json';

export const GET: APIRoute = ({ site }) => {
  const origin = site ? site.origin : siteData.brand.domain;
  const body = `User-agent: *
Allow: /

Sitemap: ${origin}/sitemap.xml
`;
  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
};
