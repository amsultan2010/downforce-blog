import type { APIContext } from 'astro';
import { getPosts, isoDate, postUrl } from '../lib/posts';

// Static routes come straight from the pages folder, so a new page is listed without
// anyone remembering to add it. Dynamic routes, endpoints and the 404 are left out.
const pages = Object.keys(import.meta.glob('./**/*.astro'))
  .filter((file) => !file.includes('[') && !file.endsWith('/404.astro'))
  .map((file) => file.replace(/^\./, '').replace(/index\.astro$/, '').replace(/\.astro$/, '/'));

export async function GET({ site }: APIContext) {
  const posts = await getPosts();
  const newest = posts[0] ? isoDate(posts[0].data.date) : undefined;

  const urls = [
    ...pages.sort().map((path) => ({ path, lastmod: newest })),
    ...posts.map((post) => ({ path: postUrl(post), lastmod: isoDate(post.data.date) })),
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(({ path, lastmod }) => `  <url><loc>${new URL(path, site).href}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`)
  .join('\n')}
</urlset>
`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
