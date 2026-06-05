import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://thedownforceblog.vercel.app',
  output: 'static',
  integrations: [sitemap()],
});
