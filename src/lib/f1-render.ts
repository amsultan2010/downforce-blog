// Markup and copy for the standings, shared by the build (static HTML) and the browser
// (live refresh), so both always produce the same rows.
import { teamColor, type DriverRow, type F1Data, type RaceInfo, type TeamRow } from './f1';
import { SITE } from './site';

const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);

const gap = (points: number, lead: number) => (points === lead ? 'leader' : `-${lead - points}`);
const share = (points: number, lead: number) => (lead > 0 ? Math.max(points / lead, 0.004).toFixed(4) : '0');

export function driverRow(d: DriverRow, lead: number): string {
  const goat = d.code === 'ALO';
  return `<li class="trow${goat ? ' trow--goat' : ''}" data-flip-id="d-${esc(d.code)}" style="--team:${teamColor(d.teamId)};--share:${share(d.points, lead)}">
  <span class="trow__bar" aria-hidden="true"></span>
  <span class="trow__pos">${d.pos}</span>
  <span class="trow__chip" aria-hidden="true"></span>
  <span class="trow__code">${esc(d.code)}</span>
  <span class="trow__name"><span class="trow__first">${esc(d.first)} </span>${esc(d.last)}${goat ? ' <span class="trow__goat">GOAT</span>' : ''}<span class="trow__team">${esc(d.team)}</span></span>
  <span class="trow__gap">${gap(d.points, lead)}</span>
  <span class="trow__pts" data-pts="${d.points}">${d.points}</span>
</li>`;
}

export function teamRow(t: TeamRow, lead: number): string {
  return `<li class="trow trow--team" data-flip-id="t-${esc(t.id)}" style="--team:${teamColor(t.id)};--share:${share(t.points, lead)}">
  <span class="trow__bar" aria-hidden="true"></span>
  <span class="trow__pos">${t.pos}</span>
  <span class="trow__chip" aria-hidden="true"></span>
  <span class="trow__name">${esc(t.name)}<span class="trow__team">${t.wins} ${t.wins === 1 ? 'win' : 'wins'}</span></span>
  <span class="trow__gap">${gap(t.points, lead)}</span>
  <span class="trow__pts" data-pts="${t.points}">${t.points}</span>
</li>`;
}

/** Top `limit` drivers, with Alonso always on the board. */
export function driverRows(data: F1Data, limit: number): string {
  const lead = data.drivers[0]?.points ?? 0;
  const shown = data.drivers.slice(0, limit);
  const alonso = data.drivers.find((d) => d.code === 'ALO');
  if (alonso && !shown.includes(alonso)) shown.push(alonso);
  return shown.map((d) => driverRow(d, lead)).join('\n');
}

export function teamRows(data: F1Data, limit: number): string {
  const lead = data.teams[0]?.points ?? 0;
  return data.teams
    .slice(0, limit)
    .map((t) => teamRow(t, lead))
    .join('\n');
}

const dayFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: SITE.timeZone });
const timeFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: SITE.timeZone });

const gp = (name: string) => name.replace('grand prix', 'GP');
const day = (r: RaceInfo) => dayFmt.format(new Date(r.start)).toLowerCase().replace(',', '');

function countdown(r: RaceInfo, now: number): string {
  const ms = new Date(r.start).getTime() - now;
  const days = Math.floor(ms / 86_400_000);
  if (ms < -3 * 3_600_000) return 'done';
  if (ms < 0) return 'under way';
  if (days === 0) return 'today';
  return days === 1 ? 'in 1 day' : `in ${days} days`;
}

/**
 * The small pieces of live copy around the site, keyed by the data-f1 attribute.
 * `now` is only passed in the browser: countdowns would go stale in static HTML.
 */
export function f1Text(data: F1Data, now?: number): Record<string, string> {
  const leader = data.drivers[0];
  const next = data.nextRace;
  const last = data.lastRace;
  return {
    season: `${data.season} season, round ${data.round} of ${data.totalRounds}`,
    leader: leader ? `leader: ${leader.code}, ${leader.points} pts` : '',
    after: last ? `after round ${last.round}, the ${last.name}` : `after round ${data.round}`,
    'next-short': next
      ? now !== undefined
        ? `${gp(next.name)} ${countdown(next, now)}`
        : `next: ${gp(next.name)}, ${day(next)}`
      : 'season complete',
    'next-name': next ? next.name : 'season complete',
    'next-when': next
      ? `round ${next.round}, ${next.place}. ${day(next)}, ${timeFmt.format(new Date(next.start))} riyadh time`
      : '',
    'next-countdown': next && now !== undefined ? countdown(next, now) : '',
  };
}
