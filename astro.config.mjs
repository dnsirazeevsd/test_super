import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import tailwind from '@astrojs/tailwind';

// [OWNER_DOMAIN]: Replace 'https://superstore-rio.ru' with your production domain before final deploy
export default defineConfig({
  site: 'https://superstore-rio.ru',
  output: 'static',
  integrations: [
    preact({ compat: true }),
    tailwind({ applyBaseStyles: false }),
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
