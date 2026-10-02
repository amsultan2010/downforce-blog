import { defineConfig } from 'astro/config';

// Canonical origin. On Vercel this follows the project's production domain, so it stays
// right before and after a custom domain is attached. Override with SITE_URL if needed.
const site =
  process.env.SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'https://downforce.blog');

export default defineConfig({
  site,
  output: 'static',
  trailingSlash: 'always',
  vite: { build: { sourcemap: false } },
});
