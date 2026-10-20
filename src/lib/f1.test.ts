import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { fetchF1, type F1Data } from './f1.ts';
import { f1Text } from './f1-render.ts';

const usgp = { round: 20, name: 'united states grand prix', start: '2026-10-25T20:00:00Z', place: 'austin' };
const data: F1Data = {
  season: '2026', round: 19, totalRounds: 24, drivers: [], teams: [], lastRace: null, nextRace: usgp, fetchedAt: '',
};

test('countdown counts riyadh calendar days', () => {
  // 23:30 saturday riyadh, race at 23:00 sunday riyadh
  assert.equal(f1Text(data, Date.parse('2026-10-24T20:30:00Z'))['next-countdown'], 'in 1 day');
  assert.equal(f1Text(data, Date.parse('2026-10-25T08:00:00Z'))['next-countdown'], 'today');
});

test('off-season falls back to last season and the new opener', async (t) => {
  const driver = { position: '1', points: '400', wins: '10', Driver: { code: 'ANT', givenName: 'Andrea Kimi', familyName: 'Antonelli' }, Constructors: [{ constructorId: 'mercedes', name: 'Mercedes' }] };
  const team = { position: '1', points: '700', wins: '14', Constructor: { constructorId: 'mercedes', name: 'Mercedes' } };
  const lists = (season: string, key: string, rows: unknown[]) =>
    season === '2026' ? [{ season, round: '24', [key]: rows }] : [];
  const body = (url: string) => {
    const season = url.includes('/2026/') ? '2026' : '2027';
    if (url.includes('driverStandings')) return { StandingsTable: { StandingsLists: lists(season, 'DriverStandings', [driver]) } };
    if (url.includes('constructorStandings')) return { StandingsTable: { StandingsLists: lists(season, 'ConstructorStandings', [team]) } };
    return {
      RaceTable: {
        season: '2027',
        Races: [
          { round: '1', raceName: 'Australian Grand Prix', date: '2027-03-07', time: '04:00:00Z', Circuit: { Location: { locality: 'Melbourne' } } },
          { round: '2', raceName: 'Chinese Grand Prix', date: '2027-03-14', time: '07:00:00Z', Circuit: { Location: { locality: 'Shanghai' } } },
        ],
      },
    };
  };
  t.mock.method(globalThis, 'fetch', async (url: string) => new Response(JSON.stringify({ MRData: body(url) })));
  mock.timers.enable({ apis: ['Date'], now: Date.parse('2027-01-15T00:00:00Z') });
  t.after(() => mock.timers.reset());

  const f1 = await fetchF1();
  assert.equal(f1.season, '2026');
  assert.equal(f1.round, 24);
  assert.equal(f1.totalRounds, 24);
  assert.equal(f1.lastRace, null);
  assert.equal(f1.nextRace?.round, 1);
  assert.equal(f1.drivers[0].code, 'ANT');
  const text = f1Text(f1);
  assert.equal(text.season, '2026 season, round 24 of 24');
  assert.equal(text.after, 'after round 24');
  assert.equal(text['next-name'], 'australian grand prix');
});
