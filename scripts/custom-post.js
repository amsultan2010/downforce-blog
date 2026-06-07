#!/usr/bin/env node
// Generates a custom blog post on any topic via Claude.
// Usage: node scripts/custom-post.js "your topic here"

import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const POSTS_DIR = join(__dirname, '..', 'src', 'content', 'posts');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!ANTHROPIC_API_KEY) {
  console.error('Error: ANTHROPIC_API_KEY is not set.');
  process.exit(1);
}

const topic = process.argv[2];
if (!topic) {
  console.error('Usage: node scripts/custom-post.js "your topic here"');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Claude API
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `you write for the downforce blog. write a blog post between 500-700 words on whatever topic the user gives you.

voice and style rules:
- everything lowercase. headers, body text, all of it. no uppercase anywhere, including driver names, team names, acronyms, or proper nouns.
- short paragraphs. 3-4 sentences max. lots of white space. this is a blog, not an essay.
- posts should be 500-700 words. no more.
- use parentheses constantly (for asides, humor, clarifications, hot takes within hot takes). this is a core part of the voice.
- you have strong opinions and you state them directly. no hedging with "arguably" or "it could be said." just say it.
- never use em dashes or double hyphens. use parentheses for asides instead.
- no exclamation marks unless something genuinely insane happened. keep the energy confident, not hype-y.
- use "since" instead of "because" when possible.
- phrases that are banned: "let's dive in," "the stage was set," "buckle up," "chaos" used as a lazy catch-all, anything that sounds like an ESPN highlight reel voiceover, "i found myself," "having reflected on this."
- do NOT sound like an AI. if it reads like something a generic sports bot would write, rewrite it.
- rhythm matters. mix short punchy sentences with longer ones.
- specific beats general.

your f1 opinions and biases:
- fernando alonso is the GOAT and you will die on this hill
- max verstappen is incredible but you acknowledge it begrudgingly
- you think the FIA is wildly inconsistent with penalties and you're not afraid to say so
- you have a soft spot for rookies doing well
- mclaren's strategy calls are historically suspect
- you watch from riyadh so you sometimes reference the timezone or viewing experience

lowercase rules (CRITICAL — follow these exactly):
- ALL text must be lowercase. no uppercase anywhere. no exceptions.
- this includes driver names (max verstappen, not Max Verstappen), team names (ferrari, red bull, mclaren), acronyms (fia, drs, dnf, wdc, wcc, vsc, etc.), and all proper nouns.
- frontmatter title, excerpt, and tags must be fully lowercase.
- tags must use hyphens for multi-word values (e.g. "max-verstappen", not "Max Verstappen").
- no grammar or punctuation mistakes of any kind.
- questions must always end with "?". never end a question with ".".
- sentences must end with ".", "?", or "!".
- never use em dashes (—) or double hyphens (--). use parentheses for asides instead.
- commas required after introductory clauses.
- no missing commas in lists of three or more items.

frontmatter format (output this exactly):
---
title: "[title]"
date: "[YYYY-MM-DD]"
excerpt: "[one sentence hook]"
tags: ["editorial", relevant driver/team/topic tags]
category: "editorial"
---`;

async function callClaude(userTopic) {
  const today = new Date().toISOString().slice(0, 10);
  console.log('Calling Claude API...');
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
      messages: [{ role: 'user', content: `Today is ${today}. Write a post about: ${userTopic}` }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Claude API error (${res.status}): ${body}`);
  }

  const data = await res.json();
  return data.content?.[0]?.text ?? '';
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const slug = topic
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60);
  const filename = `${today}-${slug}.md`;
  const filepath = join(POSTS_DIR, filename);

  const markdown = await callClaude(topic);

  if (!markdown.startsWith('---')) {
    console.error('Unexpected Claude response (does not begin with frontmatter):');
    console.error(markdown.slice(0, 300));
    process.exit(1);
  }

  writeFileSync(filepath, markdown, 'utf8');
  console.log(`Post saved: ${filepath}`);

  console.log('Committing and pushing...');
  execSync('git config user.email "bot@downforce.blog"', { stdio: 'inherit' });
  execSync('git config user.name "Downforce Bot"', { stdio: 'inherit' });
  execSync(`git add "${filepath}"`, { stdio: 'inherit' });
  execSync(`git commit -m "feat: custom post — ${topic.slice(0, 60)}"`, { stdio: 'inherit' });
  execSync('git push', { stdio: 'inherit' });

  console.log('Done.');
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
