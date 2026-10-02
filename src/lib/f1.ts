// Standings and calendar data from the public Jolpica F1 API (the Ergast successor).
// This module runs in two places: at build time to bake a snapshot into the HTML, and in
// the browser to refresh that snapshot when the page loads.

const API = 'https://api.jolpi.ca/ergast/f1';

export interface DriverRow {
  pos: number;
  code: string;
  first: string;
  last: string;
  team: string;
  teamId: string;
  points: number;
  wins: number;
}

export interface TeamRow {
  pos: number;
  id: string;
  name: string;
  points: number;
  wins: number;
}

export interface RaceInfo {
  round: number;
  name: string;
  /** ISO timestamp of the race start, or of midnight UTC on race day if no time is listed */
  start: string;
  place: string;
}

export interface F1Data {
  season: string;
  round: number;
  totalRounds: number;
  drivers: DriverRow[];
  teams: TeamRow[];
  lastRace: RaceInfo | null;
  nextRace: RaceInfo | null;
  fetchedAt: string;
}

const TEAM_COLOR: Record<string, string> = {
  mclaren: '#FF8000',
  red_bull: '#1E41CB',
  ferrari: '#E8002D',
  mercedes: '#27F4D2',
  aston_martin: '#229971',
  alpine: '#FF87BC',
  williams: '#64C4FF',
  rb: '#6692FF',
  sauber: '#52E252',
  audi: '#8B0000',
  haas: '#E8E8E8',
  cadillac: '#888888',
};

const TEAM_NAME: Record<string, string> = {
  rb: 'racing bulls',
  red_bull: 'red bull',
  aston_martin: 'aston martin',
};

export function teamColor(teamId: string): string {
  return TEAM_COLOR[teamId] ?? '#888888';
}

export function teamName(teamId: string, apiName: string): string {
  return TEAM_NAME[teamId] ?? apiName.replace(/\s+F1 Team$/i, '').toLowerCase();
}

async function get(path: string, signal?: AbortSignal): Promise<any> {
  const res = await fetch(`${API}/${path}`, { signal });
  if (!res.ok) throw new Error(`jolpica ${path}: ${res.status}`);
  return (await res.json()).MRData;
}

function raceInfo(r: any): RaceInfo {
  return {
    round: Number(r.round),
    name: String(r.raceName).toLowerCase(),
    start: r.time ? `${r.date}T${r.time}` : `${r.date}T00:00:00Z`,
    place: String(r.Circuit?.Location?.locality ?? '').toLowerCase(),
  };
}

export async function fetchF1(signal?: AbortSignal): Promise<F1Data> {
  const [d, c, s] = await Promise.all([
    get('current/driverStandings/?limit=40', signal),
    get('current/constructorStandings/?limit=40', signal),
    get('current/races/?limit=40', signal),
  ]);
  const dl = d.StandingsTable.StandingsLists[0];
  const cl = c.StandingsTable.StandingsLists[0];
  if (!dl || !cl) throw new Error('jolpica: empty standings');

  const races: any[] = s.RaceTable.Races;
  const round = Number(dl.round);

  const drivers: DriverRow[] = dl.DriverStandings.map((x: any, i: number) => {
    const team = x.Constructors?.[x.Constructors.length - 1];
    return {
      pos: Number(x.position ?? i + 1),
      code: x.Driver.code ?? x.Driver.familyName.slice(0, 3).toUpperCase(),
      first: String(x.Driver.givenName).toLowerCase(),
      last: String(x.Driver.familyName).toLowerCase(),
      team: team ? teamName(team.constructorId, team.name) : '',
      teamId: team?.constructorId ?? '',
      points: Number(x.points),
      wins: Number(x.wins),
    };
  });

  const teams: TeamRow[] = cl.ConstructorStandings.map((x: any, i: number) => ({
    pos: Number(x.position ?? i + 1),
    id: x.Constructor.constructorId,
    name: teamName(x.Constructor.constructorId, x.Constructor.name),
    points: Number(x.points),
    wins: Number(x.wins),
  }));

  const last = races.find((r) => Number(r.round) === round);
  const next = races.find((r) => Number(r.round) === round + 1);

  return {
    season: String(dl.season),
    round,
    totalRounds: races.length,
    drivers,
    teams,
    lastRace: last ? raceInfo(last) : null,
    nextRace: next ? raceInfo(next) : null,
    fetchedAt: new Date().toISOString(),
  };
}
