import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://downforce-blog.vercel.app',
  output: 'static',
  integrations: [sitemap()],
});
