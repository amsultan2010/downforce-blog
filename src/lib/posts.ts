import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'posts'>;
export type Category = Post['data']['category'];

export const CATEGORY_LABEL: Record<Category, string> = {
  'race-report': 'race report',
  'sprint-report': 'sprint report',
  editorial: 'editorial',
  guide: 'guide',
  paddock: 'paddock',
  meta: 'site news',
};

export const CATEGORY_PLURAL: Record<Category, string> = {
  'race-report': 'race reports',
  'sprint-report': 'sprint reports',
  editorial: 'editorials',
  guide: 'guides',
  paddock: 'paddock',
  meta: 'site news',
};

export async function getPosts(): Promise<Post[]> {
  const posts = await getCollection('posts');
  return posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf() || a.id.localeCompare(b.id));
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** "19 oct 2025" */
export function formatDate(date: Date): string {
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Whole minutes at 220 words per minute, never below 1. */
export function readingTime(body: string | undefined): number {
  const words = (body ?? '').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

export function postUrl(post: Post): string {
  return `/posts/${post.id}/`;
}
