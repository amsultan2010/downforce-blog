import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { SITE } from '../lib/site';
import { getPosts, postUrl } from '../lib/posts';

export async function GET(context: APIContext) {
  const posts = await getPosts();
  return rss({
    title: SITE.name,
    description: SITE.description,
    site: context.site!,
    items: posts.map((post) => ({
      title: post.data.title,
      pubDate: post.data.date,
      description: post.data.excerpt,
      categories: post.data.tags,
      link: postUrl(post),
    })),
    customData: '<language>en</language>',
  });
}
