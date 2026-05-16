import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import react from '@astrojs/react';

export default defineConfig({
  site: 'https://mexus.dev',
  integrations: [tailwind({ applyBaseStyles: false }), react()],
  server: { host: true, port: 4321 },
  vite: {
    ssr: {
      noExternal: ['@mexus/ui'],
    },
  },
});
