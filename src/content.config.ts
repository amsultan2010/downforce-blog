import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

export const CATEGORIES = ['race-report', 'sprint-report', 'editorial', 'guide', 'paddock', 'meta'] as const;

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      seoTitle: z.string().max(60).optional(),
      date: z.coerce.date(),
      excerpt: z.string().max(160),
      tldr: z.string().max(300),
      category: z.enum(CATEGORIES),
      tags: z.array(z.string()).default([]),
      race: z.string().optional(),
      thumbnail: image().optional(),
      thumbnailAlt: z.string().optional(),
      thumbnailCredit: z.string().optional(),
      thumbnailSource: z.string().url().optional(),
    }),
});

export const collections = { posts };
