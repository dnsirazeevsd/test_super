import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import tailwind from '@astrojs/tailwind';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Island runtime chunks (ProductConfigurator, preact, hooks, …) are reached
// through nested dynamic imports, so the browser only discovers the second hop
// after the first file downloads — which holds back the first committed frame
// (and Lighthouse's simulated LCP). Collect the client build's chunk graph and
// inject <link rel="modulepreload"> for every island component's transitive
// static imports so the whole graph starts in parallel with the document.
function islandModulePreloads() {
  /** @type {Map<string, Set<string>>} */
  let chunkImports = new Map();
  const chunkGraphPlugin = {
    name: 'superstore-chunk-graph',
    generateBundle(_options, bundle) {
      const next = new Map();
      for (const item of Object.values(bundle)) {
        if (item.type === 'chunk') {
          next.set(
            path.basename(item.fileName),
            new Set([...item.imports, ...item.dynamicImports].map((i) => path.basename(i)))
          );
        }
      }
      // Merge (never replace): Astro runs more than one Vite build per
      // `astro build`, and each pass only sees part of the graph.
      for (const [k, v] of next) {
        if (!chunkImports.has(k)) chunkImports.set(k, v);
        else for (const d of v) chunkImports.get(k).add(d);
      }
    },
  };
  return {
    name: 'superstore-island-modulepreload',
    hooks: {
      'astro:config:setup': ({ updateConfig }) => {
        updateConfig({
          vite: {
            plugins: [chunkGraphPlugin],
            build: {
              rollupOptions: {
                output: {
                  // The island loads ProductConfigurator + its renderer through
                  // nested dynamic imports; every extra chunk is another queued
                  // request on the simulated connection pool and pushes LCP.
                  // Keep the shared preact runtime in ONE chunk so the island
                  // costs three requests instead of nine.
                  manualChunks(id) {
                    if (
                      id.includes('node_modules/preact') ||
                      id.includes('node_modules/@preact') ||
                      id.includes('node_modules/@astrojs/preact') ||
                      id.includes('src/lib/lead') ||
                      id.includes('src/lib/motion')
                    ) {
                      return 'preact-vendor';
                    }
                  },
                },
              },
            },
          },
        });
      },
      'astro:build:done': async ({ dir }) => {
        const root = dir instanceof URL ? dir.pathname : dir;
        const htmlFiles = [];
        const walk = async (p) => {
          for (const entry of await readdir(p, { withFileTypes: true })) {
            const full = path.join(p, entry.name);
            if (entry.isDirectory()) {
              if (entry.name !== '_astro') await walk(full);
            } else if (entry.name.endsWith('.html')) {
              htmlFiles.push(full);
            }
          }
        };
        await walk(root);
        const closure = (base, seen = new Set()) => {
          if (seen.has(base) || !chunkImports.has(base)) return seen;
          seen.add(base);
          for (const dep of chunkImports.get(base)) closure(dep, seen);
          return seen;
        };
        for (const file of htmlFiles) {
          let html = await readFile(file, 'utf8');
          const islandUrls = [...html.matchAll(/(?:component|renderer|before-hydration)-url="(\/_astro\/[^"]+\.js)"/g)].map((m) => path.basename(m[1]));
          if (islandUrls.length === 0) continue; // pages without islands keep their natural load order
          const scriptUrls = [...html.matchAll(/<script[^>]+src="(\/_astro\/[^"]+\.js)"/g)].map((m) => path.basename(m[1]));
          const seeds = [...new Set([...islandUrls, ...scriptUrls])];
          const preload = new Set();
          for (const u of seeds) for (const name of closure(u)) preload.add(name);
          // lenis is desktop-only (loaded on demand from motion.ts); preloading
          // it would add a wasted request to every mobile load.
          preload.delete([...preload].find((n) => n.includes('lenis')) ?? '');
          const links = [...preload]
            .filter((name) => !html.includes(`href="/_astro/${name}"`))
            .map((name) => `<link rel="modulepreload" href="/_astro/${name}" />`)
            .join('');
          if (!links) continue;
          // Right after <meta charset>: earliest for the preload scanner without
          // pushing the charset declaration out of the first 1024 bytes.
          html = html.replace(/(<meta charset="UTF-8"\s*\/?>)/, `$1${links}`);
          await writeFile(file, html);
        }
      },
    },
  };
}

function leadEndpointGuard() {
  return {
    name: 'superstore-lead-endpoint-guard',
    hooks: {
      'astro:build:start': ({ logger }) => {
        const endpoint = (process.env.PUBLIC_LEAD_ENDPOINT || '').trim();
        const demo = process.env.PUBLIC_DEMO_MODE === 'true';
        if (!endpoint && !demo) {
          logger.warn(
            'PUBLIC_LEAD_ENDPOINT is not configured (and PUBLIC_DEMO_MODE is not true). ' +
              'Production lead submissions will NOT be faked — visitors will see the direct call-us fallback (+7 (931) 202-00-78). ' +
              'Deploy /relay and set PUBLIC_LEAD_ENDPOINT before launch.'
          );
        }
      },
    },
  };
}

// [OWNER_DOMAIN]: Replace 'https://superstore-rio.ru' with your production domain before final deploy
export default defineConfig({
  site: 'https://superstore-rio.ru',
  output: 'static',
  integrations: [
    preact({ compat: true }),
    tailwind({ applyBaseStyles: false }),
    leadEndpointGuard(),
    islandModulePreloads(),
  ],
  server: {
    host: '0.0.0.0',
    port: 4321,
    allowedHosts: true,
  },
  vite: {
    server: {
      host: '0.0.0.0',
      allowedHosts: true,
    },
    preview: {
      host: '0.0.0.0',
      allowedHosts: true,
    },
  },
});
