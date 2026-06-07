#!/usr/bin/env node
// Fetches latest F1 race data + Reddit context and generates a blog post via Claude.
// Exits cleanly (code 0) if no race happened this weekend or a post already exists.

import { execSync } from 'child_process';
import { writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const POSTS_DIR = join(__dirname, '..', 'src', 'content', 'posts');
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!ANTHROPIC_API_KEY) {
  console.error('Error: ANTHROPIC_API_KEY environment variable is not set.');
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

async function fetchRaceResults() {
  console.log('Fetching last race results...');
  const data = await fetchJson('https://api.jolpi.ca/ergast/f1/current/last/results/');
  return data?.MRData?.RaceTable?.Races?.[0] ?? null;
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
  console.log('Fetching full season schedule...');
  const data = await fetchJson('https://api.jolpi.ca/ergast/f1/current.json');
  return data?.MRData?.RaceTable?.Races ?? [];
}

async function fetchRedditPosts(subreddit) {
  console.log(`Fetching r/${subreddit} hot posts...`);
  try {
    const data = await fetchJson(
      `https://old.reddit.com/r/${subreddit}/hot.json?limit=15`,
      { 'User-Agent': 'downforce-blog:v1.0 (by /u/yourusername)' }
    );
    return (data?.data?.children ?? []).map(p => ({
      title: p.data.title,
      score: p.data.score,
      comments: p.data.num_comments,
    }));
  } catch (err) {
    console.warn(`Warning: could not fetch r/${subreddit} (${err.message}). Skipping Reddit context.`);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findNextRace(schedule, currentRound) {
  const next = schedule.find(r => parseInt(r.round) === parseInt(currentRound) + 1);
  if (next) return next;
  // fallback: first race with a future date
  const today = new Date();
  return schedule.find(r => new Date(r.date) > today) ?? null;
}

function isRaceFromThisWeekend(race) {
  if (!race?.date) return false;
  const raceDate = new Date(race.date);
  const now = new Date();
  const daysDiff = (now - raceDate) / (1000 * 60 * 60 * 24);
  return daysDiff >= 0 && daysDiff <= 14;
}

// Returns true once 4 hours have passed since the race ended (~2h race duration + 4h buffer).
// This ensures posts and standings are consistent regardless of race timezone.
function isRaceSettled(race) {
  if (!race?.date) return false;
  const raceStart = new Date(`${race.date}T${race.time ?? '14:00:00Z'}`).getTime();
  const RACE_DURATION_MS  = 2 * 60 * 60 * 1000;
  const POST_RACE_BUFFER_MS = 4 * 60 * 60 * 1000;
  return Date.now() >= raceStart + RACE_DURATION_MS + POST_RACE_BUFFER_MS;
}

function toKebabCase(str) {
  return str
    .toLowerCase()
    .replace(/grand prix/gi, 'gp')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

function buildFilename(race) {
  return `${toKebabCase(race.raceName)}-${race.date}.md`;
}

function formatResults(race) {
  const results = race.Results ?? [];
  const allFinishers = results.map(r => {
    const hasFastestLap = r.FastestLap?.rank === '1';
    return `${r.position}. ${r.Driver?.givenName} ${r.Driver?.familyName} (${r.Constructor?.name}) — ${r.status}${hasFastestLap ? ' [FASTEST LAP]' : ''}`;
  }).join('\n');

  const dnfs = results
    .filter(r => r.status !== 'Finished' && !r.status.startsWith('+'))
    .map(r => `  ${r.Driver?.givenName} ${r.Driver?.familyName} (${r.Constructor?.name}) — ${r.status}`)
    .join('\n');

  return { allFinishers, dnfs: dnfs || '  None' };
}


// ---------------------------------------------------------------------------
// Claude API
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `you are the writer behind "the downforce blog," an independently run f1 blog. you write race summaries and occasional hot takes. your job is to take raw race data and community context and turn it into a blog post that sounds like a real person with strong opinions wrote it (not an AI).

CRITICAL: only use the facts provided in the user message. do not invent race results, driver positions, lap times, incidents, or standings not listed in the data. every factual claim must come directly from the data provided. if you are unsure of a detail, leave it out.

voice and style rules:
- everything lowercase. headers, body text, all of it. no uppercase anywhere, including driver names, team names, acronyms, or proper nouns.
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
- title: catchy, specific, fully lowercase. subtitle after a colon that captures the main storyline with some flavor. examples of the right vibe: "the stewards' room circus", "slip 'n' slides, lico, & lawson being lawson", "verstappen's masterclass, ferrari tragedy, & the norris era"
- open with context (what was at stake going into this weekend). 2-3 sentences. no grand proclamations. a specific detail or observation works better than "what a weekend it was."
- qualifying summary (brief, only the noteworthy stuff)
- race summary (chronological but skip the boring laps. focus on incidents, overtakes, strategy calls, drama)
- championship implications (actual standings math, who gained, who lost, what it means)
- prediction/preview for the next race (use the actual schedule data to name the correct next race)
- casual sign-off that mentions the correct next race by name

lowercase rules (CRITICAL — follow these exactly):
- ALL text must be lowercase. no uppercase anywhere. no exceptions.
- this includes driver names (max verstappen, not Max Verstappen), team names (ferrari, red bull, mclaren), acronyms (fia, drs, dnf, wdc, wcc, vsc, etc.), and all proper nouns.
- frontmatter title, excerpt, and tags must be fully lowercase.
- tags must use hyphens for multi-word values (e.g. "max-verstappen", not "Max Verstappen").
- no grammar or punctuation mistakes of any kind.
- questions must always end with "?". never end a question with ".".
- sentences must end with ".", "?", or "!".
- never use em dashes (—) or double hyphens (--). use parentheses for asides instead.
- commas required after introductory clauses (e.g. "from riyadh at 3am, watching...").
- no missing commas in lists of three or more items.

frontmatter format:
---
title: "[title here]"
date: "[YYYY-MM-DDTHH:MM:SSZ]"
excerpt: "[one sentence hook]"
tags: ["race-summary", relevant driver/team tags]
category: "race-summaries"
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
  const [race, driverStandings, constructorStandings, f1Posts, dankPosts, schedule] = await Promise.all([
    fetchRaceResults(),
    fetchDriverStandings(),
    fetchConstructorStandings(),
    fetchRedditPosts('formula1'),
    fetchRedditPosts('formuladank'),
    fetchSchedule(),
  ]);

  if (!race) {
    console.log('No race data available. Exiting without creating a post.');
    process.exit(0);
  }

  if (!isRaceFromThisWeekend(race)) {
    console.log(`Last race (${race.raceName}) was on ${race.date}, more than 14 days ago. No post needed.`);
    process.exit(0);
  }

  if (!isRaceSettled(race)) {
    console.log(`${race.raceName} hasn't been settled for 4 hours yet. Waiting for penalties. Exiting.`);
    process.exit(0);
  }

  const filename = buildFilename(race);
  const filepath = join(POSTS_DIR, filename);

  if (existsSync(filepath)) {
    console.log(`Post already exists at ${filename}. Skipping.`);
    process.exit(0);
  }

  const { allFinishers, dnfs } = formatResults(race);
  const nextRace = findNextRace(schedule, race.round);
  const nextRaceInfo = nextRace
    ? `${nextRace.raceName} — Round ${nextRace.round} (${nextRace.date}, ${nextRace.Circuit?.Location?.locality}, ${nextRace.Circuit?.Location?.country})`
    : 'unknown (end of season)';

  const userMessage = `Here is the data for this weekend's race. Write the blog post.

## Race: ${race.raceName} — Round ${race.round} (${race.date})
Circuit: ${race.Circuit?.circuitName}, ${race.Circuit?.Location?.locality}, ${race.Circuit?.Location?.country}

### Full Race Results (use ONLY these driver-team pairings — do not use any other source):
${allFinishers}

### Notable Retirements:
${dnfs}

## Driver Championship Standings (Top 10):
${driverStandings.slice(0, 10).map(d =>
  `${d.position}. ${d.Driver?.givenName} ${d.Driver?.familyName} — ${d.points} pts`
).join('\n')}

## Constructor Standings:
${constructorStandings.slice(0, 10).map(c =>
  `${c.position}. ${c.Constructor?.name} — ${c.points} pts`
).join('\n')}

## Next Race:
${nextRaceInfo}

${f1Posts.length > 0 ? `## Community Pulse — r/formula1 hot posts:\n${f1Posts.map(p => `- "${p.title}" (${p.score} upvotes, ${p.comments} comments)`).join('\n')}` : ''}${dankPosts.length > 0 ? `\n\n## Community Pulse — r/formuladank hot posts:\n${dankPosts.map(p => `- "${p.title}" (${p.score} upvotes, ${p.comments} comments)`).join('\n')}` : ''}`;

  let markdown = await callClaude(userMessage);

  if (!markdown.startsWith('---')) {
    console.error('Unexpected Claude response (does not begin with frontmatter):');
    console.error(markdown.slice(0, 300));
    process.exit(1);
  }

  // Replace the date Claude wrote with an accurate ISO timestamp so posts
  // published on the same calendar day sort correctly by time.
  const publishedAt = new Date().toISOString();
  markdown = markdown.replace(/^(date:\s*")[^"]*(")/m, `$1${publishedAt}$2`);

  // Strip any em-dashes Claude snuck in — replace with comma+space or just space.
  markdown = markdown.replace(/\s*—\s*/g, ' ');

  writeFileSync(filepath, markdown, 'utf8');
  console.log(`Post saved: ${filepath}`);

  // Record the publish time so the widget can wait 2h before showing new standings
  // (gives time for post-race penalties to be reflected in the API).
  const standingsStatePath = join(__dirname, '..', 'public', 'standings-state.json');
  writeFileSync(standingsStatePath, JSON.stringify({ unlockedRound: race.round, season: race.season, publishedAt }) + '\n', 'utf8');
  console.log(`Standings state updated for round ${race.round} (${race.season}), published at ${publishedAt}.`);

  console.log('Committing and pushing to GitHub...');
  execSync('git config user.email "bot@downforce.blog"', { stdio: 'inherit' });
  execSync('git config user.name "Downforce Bot"', { stdio: 'inherit' });
  execSync(`git add "${filepath}" "${standingsStatePath}"`, { stdio: 'inherit' });
  execSync(
    `git commit -m "feat: auto-generate post — ${race.raceName} ${race.date}"`,
    { stdio: 'inherit' }
  );
  execSync('git push', { stdio: 'inherit' });

  console.log('Done.');
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
