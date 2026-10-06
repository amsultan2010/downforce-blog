// One 1200x630 share card per post, plus a default card for every other page.
// Drawn with satori at build time and rasterised with sharp, so there is nothing to
// design by hand when a new post is added.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { APIContext } from 'astro';
import satori from 'satori';
import sharp from 'sharp';
import { SITE } from '../../lib/site';
import { CATEGORY_LABEL, formatDate, getPosts, type Post } from '../../lib/posts';

const font = (pkg: string, file: string) => readFileSync(join(process.cwd(), 'node_modules/@fontsource', pkg, 'files', file));
const fonts = [
  { name: 'Archivo', data: font('archivo', 'archivo-latin-900-normal.woff'), weight: 900 as const, style: 'normal' as const },
  { name: 'JetBrains Mono', data: font('jetbrains-mono', 'jetbrains-mono-latin-500-normal.woff'), weight: 500 as const, style: 'normal' as const },
];

const TEAL = '#0a3940';
const PAPER = '#f2ecdf';
const LIME = '#c6e33a';
const INK = '#071f23';

export async function getStaticPaths() {
  const posts = await getPosts();
  return [
    { params: { slug: 'default' }, props: {} },
    ...posts.map((post) => ({ params: { slug: post.id }, props: { post } })),
  ];
}

const h = (type: string, style: Record<string, unknown>, children?: unknown) => ({ type, props: { style, children } });

function mark() {
  return {
    type: 'svg',
    props: {
      width: 84,
      height: 84,
      viewBox: '0 0 64 64',
      children: [
        { type: 'rect', props: { width: 64, height: 64, fill: LIME } },
        { type: 'path', props: { fill: INK, d: 'M8 12h48v26h-9V22H17v16H8z' } },
        { type: 'path', props: { fill: INK, d: 'M21 31l11 11 11-11v11L32 53 21 42z' } },
      ],
    },
  };
}

function card(post?: Post) {
  const title = post ? post.data.title : SITE.name;
  const size = title.length > 70 ? 54 : title.length > 44 ? 66 : title.length > 24 ? 82 : 118;
  const meta = post ? `${CATEGORY_LABEL[post.data.category]}  /  ${formatDate(post.data.date)}` : SITE.tagline;

  return h(
    'div',
    {
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: 64,
      backgroundColor: TEAL,
      color: PAPER,
      borderBottom: `22px solid ${LIME}`,
    },
    [
      h('div', { display: 'flex', alignItems: 'center', justifyContent: 'space-between' }, [
        h('div', { display: 'flex', alignItems: 'center', gap: 24 }, [
          mark(),
          h('div', { fontFamily: 'Archivo', fontSize: 40, letterSpacing: -2 }, 'downforce'),
        ]),
        h('div', { fontFamily: 'JetBrains Mono', fontSize: 24, color: '#9fc4c8' }, post ? 'the downforce blog' : ''),
      ]),
      h('div', { display: 'flex', flexDirection: 'column', gap: 28 }, [
        h('div', { fontFamily: 'JetBrains Mono', fontSize: 26, color: '#d6f060' }, meta),
        h('div', { fontFamily: 'Archivo', fontSize: size, lineHeight: 0.98, letterSpacing: -size * 0.04 }, title),
      ]),
    ],
  );
}

export async function GET({ props }: APIContext) {
  const svg = await satori(card((props as { post?: Post }).post) as any, { width: 1200, height: 630, fonts });
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
}
