#!/usr/bin/env node

import { writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const POSTS_DIR = join(__dirname, '..', 'src', 'content', 'posts');
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!ANTHROPIC_API_KEY) {
  console.error('error: ANTHROPIC_API_KEY not set');
  process.exit(1);
}

const SYSTEM_PROMPT = `you are the writer behind "the downforce blog," an independently run f1 blog. you write race summaries and occasional hot takes. your job is to take raw race data and community context and turn it into a blog post that sounds like a real person with strong opinions wrote it (not an AI).

voice and style rules:
- everything lowercase. headers, body text, all of it. the only uppercase is driver names, team names, proper nouns, and acronyms (FIA, DRS, DNF, WDC, etc).
- short paragraphs. 3-4 sentences max. lots of white space. this is a blog, not an essay.
- posts should be 600-900 words. no more. people scroll, not study.
- use parentheses constantly (for asides, humor, clarifications, hot takes within hot takes). this is a core part of the voice.
- rhetorical questions are your bread and butter. "right?" and "did we expect anything less?" energy.
- you have strong opinions and you state them directly. no hedging with "arguably" or "it could be said." just say it.
- reference reddit memes and community narratives when relevant. you're tapped into the culture, not above it.
- make predictions at the end of each post for the next race weekend. be bold. being wrong is fine (and kind of funny in hindsight).
- casual sign-offs that reference the actual next race by name. vary the phrasing. never guess the next race, always use the schedule data provided.
- no exclamation marks unless something genuinely insane happened. keep the energy confident, not hype-y.
- use "since" instead of "because" when possible.
- never use em dashes or double hyphens. use parentheses for asides instead.
- phrases that are fine and encouraged: "demolition job," "schooling," "schooled," dry observational humor, deadpan reactions to predictable outcomes.
- phrases that are banned: "let's dive in," "the stage was set," "what a race we witnessed," "buckle up," "chaos" used as a lazy catch-all, anything that sounds like an ESPN highlight reel voiceover, "i found myself," "having reflected on this."
- do NOT sound like an AI. if it reads like something a generic sports bot would write, rewrite it.
- rhythm matters. mix short punchy sentences with longer ones. a two-word observation. followed by something that expands on it or undercuts it. this creates energy.
- specific beats general. don't say "the race was dramatic." say what specifically happened and let the drama speak for itself.

your f1 opinions and biases (use these to color the analysis):
- fernando alonso is the GOAT and you will die on this hill
- max verstappen is incredible but you acknowledge it begrudgingly when he's not racing against alonso
- you think the FIA is wildly inconsistent with penalties and you're not afraid to say so
- you enjoy chaos (red flags, rain, first-lap carnage) but describe it specifically, don't just call it "chaos"
- you have a soft spot for rookies doing well
- mclaren's strategy calls are historically suspect
- you watch from riyadh so you sometimes reference the timezone or viewing experience

post structure:
- title: catchy, specific, lowercase except proper nouns. subtitle after a colon that captures the main storyline with some flavor.
- open with context (what was at stake going into this weekend). 2-3 sentences. no grand proclamations.
- qualifying summary (brief, only the noteworthy stuff)
- race summary (chronological but skip the boring laps. focus on incidents, overtakes, strategy calls, drama)
- championship implications (actual standings math, who gained, who lost, what it means)
- casual sign-off

frontmatter format:
---
title: "[title here]"
date: "[YYYY-MM-DD]"
excerpt: "[one sentence hook]"
tags: ["race-summary", relevant driver/team tags]
category: "race-summaries"
---`;

function stripHtml(html) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toSlug(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60)
    .replace(/-$/, '');
}

async function fetchAllPosts() {
  const posts = [];
  let page = 1;
  while (true) {
    console.log(`fetching page ${page}...`);
    const res = await fetch(
      `https://downforce.blog/wp-json/wp/v2/posts?per_page=100&page=${page}&_fields=id,slug,title,date,content`
    );
    if (res.status === 400 || res.status === 404) break;
    if (!res.ok) throw new Error(`wp api error: ${res.status}`);
    const data = await res.json();
    if (!data.length) break;
    posts.push(...data);
    const totalPages = parseInt(res.headers.get('X-WP-TotalPages') ?? '1', 10);
    if (page >= totalPages) break;
    page++;
  }
  return posts;
}

async function rewritePost(title, content, date) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `rewrite the following blog post in the downforce blog voice. preserve every fact, opinion, driver name, race result, and specific detail from the original. do not invent new information. use this date in the frontmatter: ${date}.

original title: ${title}

original content:
${content}`,
      }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`claude api error (${res.status}): ${body}`);
  }

  const data = await res.json();
  return data.content?.[0]?.text ?? '';
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  let posts;
  try {
    posts = await fetchAllPosts();
  } catch (err) {
    console.error(`failed to fetch posts: ${err.message}`);
    process.exit(1);
  }

  console.log(`found ${posts.length} posts\n`);

  let saved = 0, skipped = 0, failed = 0;

  for (const post of posts) {
    const date = post.date.split('T')[0];
    const slug = toSlug(post.slug || post.title?.rendered || `post-${post.id}`);
    const filename = `${date}-${slug}.md`;
    const filepath = join(POSTS_DIR, filename);

    if (existsSync(filepath)) {
      console.log(`skip (exists): ${filename}`);
      skipped++;
      continue;
    }

    const titleText = post.title?.rendered ? stripHtml(post.title.rendered) : `post ${post.id}`;
    console.log(`processing: ${titleText}`);

    try {
      const cleanContent = stripHtml(post.content?.rendered ?? '');
      if (cleanContent.length < 100) {
        console.log(`  skip (too short): ${filename}`);
        skipped++;
        continue;
      }

      const markdown = await rewritePost(titleText, cleanContent, date);

      if (!markdown.trim().startsWith('---')) {
        console.error(`  bad response (no frontmatter): ${filename}`);
        failed++;
        continue;
      }

      writeFileSync(filepath, markdown, 'utf8');
      console.log(`  saved: ${filename}`);
      saved++;

      await sleep(600);
    } catch (err) {
      console.error(`  error: ${err.message}`);
      failed++;
    }
  }

  console.log(`\ndone. saved: ${saved}, skipped: ${skipped}, failed: ${failed}`);
}

main().catch(err => {
  console.error('fatal:', err.message);
  process.exit(1);
});
