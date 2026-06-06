#!/usr/bin/env node
// Generates a weekly Friday editorial post via Claude + Jolpica standings.
// Exits cleanly if a post already exists for today.

import { execSync } from 'child_process';
import { writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const POSTS_DIR = join(__dirname, '..', 'src', 'content', 'posts');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!ANTHROPIC_API_KEY) {
  console.error('Error: ANTHROPIC_API_KEY is not set.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

async function fetchJson(url, extraHeaders = {}) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'downforce-blog/1.0', ...extraHeaders },
  });
  if (!res.ok) throw new Error(`Fetch failed ${url} — HTTP ${res.status}`);
  return res.json();
}

async function fetchDriverStandings() {
  console.log('Fetching driver standings...');
  const data = await fetchJson('https://api.jolpi.ca/ergast/f1/current/driverStandings/');
  return data?.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings ?? [];
}

async function fetchConstructorStandings() {
  console.log('Fetching constructor standings...');
  const data = await fetchJson('https://api.jolpi.ca/ergast/f1/current/constructorStandings/');
  return data?.MRData?.StandingsTable?.StandingsLists?.[0]?.ConstructorStandings ?? [];
}

async function fetchSchedule() {
  console.log('Fetching season schedule...');
  const data = await fetchJson('https://api.jolpi.ca/ergast/f1/current.json');
  return data?.MRData?.RaceTable?.Races ?? [];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function findUpcomingRace(schedule) {
  const now = new Date();
  return schedule.find(r => new Date(r.date) > now) ?? null;
}

// ---------------------------------------------------------------------------
// Claude API
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `you write for the downforce blog. it's a friday and there's no race this weekend (or the race is days away). write a non-race editorial post between 500-700 words. pick one of these formats based on what feels most timely given the current f1 standings and season context provided:

- driver focus: deep dive on one driver's season so far. stats, narrative, what's working, what isn't.
- hot take: one strong opinion about something happening in f1 right now. defend it.
- race preview: if a race is coming up next weekend, preview it. circuit characteristics, who historically does well there, what to watch for.
- season storyline: zoom out and analyze the biggest narrative of the season so far.

pick whichever format is most interesting given the current context. don't announce which format you're using, just write it.

voice and style rules:
- everything lowercase. headers, body text, all of it. the only uppercase is driver names, team names, proper nouns, and acronyms (FIA, DRS, DNF, WDC, etc).
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
- ALL body text must be lowercase. no sentence-starting capitals. no random capitalization.
- the ONLY uppercase allowed: driver names (e.g. Max Verstappen), team names (e.g. Ferrari, Red Bull, McLaren), and acronyms (FIA, DRS, DNF, WDC, WCC, VSC, etc).
- frontmatter title and excerpt must also be lowercase except for proper nouns and acronyms as above.
- tags must be all lowercase.
- no grammar mistakes. no missing punctuation. questions must end with "?". sentences must end with "." or other correct punctuation.

frontmatter format (output this exactly):
---
title: "[title]"
date: "[YYYY-MM-DD]"
excerpt: "[one sentence hook]"
tags: ["editorial", relevant driver/team/topic tags]
category: "editorial"
---`;

async function callClaude(userMessage) {
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
      messages: [{ role: 'user', content: userMessage }],
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
  const today = todayDate();
  const filename = `editorial-${today}.md`;
  const filepath = join(POSTS_DIR, filename);

  if (existsSync(filepath)) {
    console.log(`Editorial already exists for ${today}. Skipping.`);
    process.exit(0);
  }

  const [driverStandings, constructorStandings, schedule] = await Promise.all([
    fetchDriverStandings(),
    fetchConstructorStandings(),
    fetchSchedule(),
  ]);

  const nextRace = findUpcomingRace(schedule);
  const nextRaceInfo = nextRace
    ? `${nextRace.raceName} — Round ${nextRace.round} (${nextRace.date}, ${nextRace.Circuit?.Location?.locality}, ${nextRace.Circuit?.Location?.country})`
    : 'end of season — no upcoming races';

  const userMessage = `Today is ${today} (Friday). Write this week's editorial post.

## Current Driver Championship Standings (Top 10):
${driverStandings.slice(0, 10).map(d =>
  `${d.position}. ${d.Driver?.givenName} ${d.Driver?.familyName} (${d.Constructor?.name}) — ${d.points} pts`
).join('\n')}

## Current Constructor Standings:
${constructorStandings.map(c =>
  `${c.position}. ${c.Constructor?.name} — ${c.points} pts`
).join('\n')}

## Next Race:
${nextRaceInfo}

Pick the most interesting editorial angle given this context and write the post.`;

  let markdown = await callClaude(userMessage);

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
  execSync(`git commit -m "feat: weekly editorial — ${today}"`, { stdio: 'inherit' });
  execSync('git push', { stdio: 'inherit' });

  console.log('Done.');
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
