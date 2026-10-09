import { defineConfig } from 'astro/config';

// Canonical origin: the production host. The bare domain redirects to www, so canonicals,
// the sitemap and share images all name www directly. Override with SITE_URL if needed.
const site = process.env.SITE_URL || 'https://www.downforceblog.com';

export default defineConfig({
  site,
  output: 'static',
  trailingSlash: 'always',
  vite: { build: { sourcemap: false } },
});
