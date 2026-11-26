import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import tailwind from '@astrojs/tailwind';

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
