// node --test test/  — 실제 응답 샘플(2026-11 수집)로 파서와 수집 흐름을 검사한다.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const C = require('../collector.js');
const T = C._test;
const FX = p => fs.readFileSync(path.join(__dirname, 'fixtures', p), 'utf8');
const FXJ = p => JSON.parse(FX(p));

test('KBO 일정: 원정 vs 홈, 점수, 우천취소, 중계 채널', () => {
  const evs = T.parseKboSchedule(FXJ('kbo_schedule.json'), 2026);
  assert.ok(evs.length > 100);
  const g = evs[0];
  assert.deepStrictEqual([g.away.name, g.home.name, g.away_score, g.home_score, g.status], ['KIA', 'LG', 2, 7, 'final']);
  assert.strictEqual(g.start, '2026-04-01T09:30:00Z');
  assert.strictEqual(g.id, 'kbo:20260401HTLG0');
  assert.ok(g.broadcast.includes('KN-T') && g.broadcast.includes('TVING'), g.broadcast.join());
  const rain = evs.find(e => e.status_text === '우천취소');
  assert.ok(rain && rain.status === 'canceled' && rain.home_score === null);
  assert.strictEqual(new Set(evs.map(e => e.id)).size, evs.length);
});

test('KBO 순위', () => {
  const rows = T.parseKboRank(FX('kbo_rank.html'));
  assert.strictEqual(rows.length, 10);
  assert.deepStrictEqual([rows[0].name, rows[0].gp, rows[0].w, rows[0].l, rows[0].d, rows[0].pct, rows[0].team_id], ['삼성', 144, 83, 58, 3, 0.589, 'kbo:삼성']);
});

test('K리그1 일정·순위·중계', () => {
  const evs = T.parseKleagueSchedule(FXJ('kleague_schedule.json'));
  assert.strictEqual(evs.length, 22);
  const fut = evs.filter(e => e.status === 'scheduled'); const last = fut[fut.length - 1];
  assert.deepStrictEqual([last.home.id, last.away.name, last.start], ['kleague1:K18', '강원', '2026-11-29T07:30:00Z']);
  assert.ok(evs.some(e => e.broadcast.length));
  const rows = T.parseKleagueRank(FXJ('kleague_rank.json'));
  assert.deepStrictEqual([rows[0].team_id, rows[0].pts, rows[0].gd], ['kleague1:K09', 67, 30]);
});

test('KBL: D리그 제외, 순위 승률', () => {
  const raw = FXJ('kbl_schedule.json'); const evs = T.parseKblSchedule(raw);
  assert.ok(evs.length && evs.length < raw.length);
  const rows = T.parseKblRank(FXJ('kbl_rank.json'));
  assert.strictEqual(rows[0].team_id, 'kbl:50'); assert.strictEqual(rows[0].pct, 0.667);
});

test('WKBL: 시즌 목록, 날짜·대진만, 순위', () => {
  const page = FX('wkbl_schedule.html');
  assert.deepStrictEqual(T.wkblSeasons(page)[0], ['047', '2026-2027']);
  const evs = T.parseWkblSchedule(page, 2026, 12);
  assert.ok(evs.length > 5 && evs.every(e => e.ha_unknown && e.time_tbd));
  const rows = T.parseWkblRank(FX('wkbl_rank.html'));
  assert.deepStrictEqual(rows.slice(0, 3).map(r => r.name), ['삼성생명', '신한은행', '우리은행']);
  assert.deepStrictEqual([rows[0].w, rows[0].l, rows[0].pct], [4, 1, 0.8]);
});

test('V리그: 일정·중계·순위', () => {
  const evs = T.parseKovoSchedule(FXJ('kovo_schedule.json'), 'vleague_m');
  const g = evs[0];
  assert.deepStrictEqual([g.home.name, g.away.name, g.home_score, g.away_score, g.status, g.start], ['대한항공', '현대캐피탈', 3, 0, 'final', '2026-10-31T05:00:00Z']);
  assert.ok(g.broadcast.includes('SBS Sports'), g.broadcast.join());
  assert.strictEqual(evs[evs.length - 1].status, 'scheduled');
  const rows = T.parseKovoRank(FXJ('kovo_rank.json'), 'vleague_m');
  assert.deepStrictEqual([rows[0].team_id, rows[0].pts, rows[0].w], ['vleague_m:1005', 12, 4]);
});

test('ESPN 컵대회: 라운드 한국어, 축구 팀 id는 대회 공통', () => {
  const comp = C.BY_ID.fa_cup;
  const e = T.parseEspnEvent(comp, FXJ('eng.fa.json')[0]);
  assert.strictEqual(e.round, '1라운드');
  assert.ok(e.home.id.startsWith('soccer:'));
  const u = T.parseEspnEvent(C.BY_ID.ucl, FXJ('uefa.champions.json')[0]);
  assert.strictEqual(u.round, '리그 페이즈');
  assert.ok(u.home.color && u.home.color.startsWith('#'));
});

test('LoL: 경기 파싱과 LCK 순위 계산', () => {
  const s = FXJ('lol_lck_schedule.json');
  const evs = s.events.map(e => T.parseLolEvent(C.BY_ID.lck, e)).filter(Boolean);
  assert.ok(evs.length > 50);
  const fin = evs[evs.length - 1];
  assert.strictEqual(fin.round, '결승');
  assert.deepStrictEqual([fin.home.id, fin.home_score, fin.away_score, fin.bo], ['lol:GEN', 3, 1, 5]);
  const st = T.lolStandings(evs);
  assert.ok(st && st.groups[0].rows.length >= 8, 'LCK 순위 팀 수');
  const r = st.groups[0].rows[0]; assert.ok(r.w >= r.l);
});

test('네이버 보완: WKBL 시각·홈/원정 채우기', async () => {
  const evs = T.parseWkblSchedule(FX('wkbl_schedule.html'), 2026, 12);
  const g = evs.find(e => e.status === 'scheduled');
  const day = new Date(Date.parse(g.start) + 9 * 3600e3).toISOString().slice(0, 10);
  const naver = { result: { games: [{ categoryId: 'wkbl', gameId: 'X1', gameDate: day, gameDateTime: `${day}T19:00:00`, homeTeamName: g.away.name, awayTeamName: g.home.name, stadium: '청주체육관' }] } };
  const cli = { json: async () => naver };
  const out = await T.enrichFromNaver(cli, C.BY_ID.wkbl, evs, new Date(Date.UTC(2026, 11, 1)), new Date(Date.UTC(2026, 11, 31)));
  const h = out.find(e => e.id === g.id);
  assert.strictEqual(h.time_tbd, false); assert.strictEqual(h.ha_unknown, false);
  assert.strictEqual(h.home.name, g.away.name); // 네이버 기준으로 홈 교정
  assert.strictEqual(new Date(h.start).getUTCHours(), 10); // 19:00 KST
});

// ───── 전체 흐름: 가짜 http ─────
function fakeHttp(routes, log) {
  return async (req) => {
    log && log.push(req.url);
    for (const [re, fn] of routes) if (re.test(req.url)) { const r = await fn(req); return typeof r === 'string' ? { status: 200, text: r } : r; }
    return { status: 404, text: '' };
  };
}
const NOW = new Date('2026-11-20T03:00:00Z');
const espnEvent = (id, date, h, a, extra) => ({ id, date, season: { slug: 'regular-season' }, status: { type: { name: 'STATUS_SCHEDULED', state: 'pre' } },
  competitions: [{ venue: { fullName: 'X' }, competitors: [{ homeAway: 'home', team: { id: h, displayName: 'T' + h, abbreviation: 'T' + h, color: 'ff0000' } }, { homeAway: 'away', team: { id: a, displayName: 'T' + a, abbreviation: 'T' + a } }] }], ...extra });

test('collect(): 리그+컵 자동 포함, 컵은 고른 리그 팀만, KBO 비시즌은 순위만', async () => {
  const log = [];
  const http = fakeHttp([
    [/eng\.1\/scoreboard$/, () => JSON.stringify({ leagues: [{ season: { startDate: '2026-08-01T00:00Z', endDate: '2027-06-01T00:00Z', displayName: '2026-27' }, calendar: ['2026-11-22T00:00Z', '2027-05-30T00:00Z'] }] })],
    [/eng\.1\/scoreboard\?dates=/, req => JSON.stringify({ events: req.url.includes('dates=202611') ? [espnEvent('1', '2026-11-22T15:00Z', '359', '364')] : [] })],
    [/eng\.1\/standings/, () => JSON.stringify({ children: [{ name: 'PL', standings: { entries: [{ team: { id: '359', displayName: 'Arsenal' }, stats: [{ name: 'points', value: 29 }, { name: 'gamesPlayed', value: 12 }] }] } }] })],
    [/uefa\.champions\/scoreboard$/, () => JSON.stringify({ leagues: [{ season: { startDate: '2026-07-01T00:00Z', endDate: '2027-07-01T00:00Z' }, calendar: ['2026-11-25T00:00Z'] }] })],
    [/uefa\.champions\/scoreboard\?dates=/, () => JSON.stringify({ events: [espnEvent('u1', '2026-11-25T20:00Z', '359', '999'), espnEvent('u2', '2026-11-25T20:00Z', '888', '777')] })],
    [/uefa\.champions\/standings/, () => JSON.stringify({ children: [{ name: 'League Phase', standings: { entries: [{ team: { id: '359', displayName: 'Arsenal' }, stats: [{ name: 'points', value: 12 }] }] } }] })],
    [/scoreboard$/, () => JSON.stringify({ leagues: [{ season: { startDate: '2025-07-01T00:00Z', endDate: '2026-07-01T00:00Z' } }] })], // 나머지 컵: 시즌 종료
    [/standings/, () => ({ status: 404, text: '' })],
    [/koreabaseball\.com\/Record/, () => FX('kbo_rank.html')],
    [/getLeagues/, () => JSON.stringify({ data: { leagues: [{ slug: 'lck', id: '1' }, { slug: 'msi', id: '2' }] } })],
    [/getSchedule\?hl=ko-KR&leagueId=1/, () => JSON.stringify({ data: { schedule: { events: FXJ('lol_lck_schedule.json').events, pages: {} } } })],
    [/getSchedule\?hl=ko-KR&leagueId=2/, () => JSON.stringify({ data: { schedule: { events: [
      { startTime: '2026-06-01T10:00:00Z', state: 'completed', type: 'match', blockName: '결승', league: { name: 'MSI' }, match: { id: 'm1', teams: [{ name: 'Gen.G', code: 'GEN', result: { gameWins: 3 } }, { name: 'X', code: 'XX', result: { gameWins: 1 } }], strategy: { count: 5 } } },
      { startTime: '2026-06-01T10:00:00Z', state: 'completed', type: 'match', blockName: '결승', league: { name: 'MSI' }, match: { id: 'm2', teams: [{ name: 'A', code: 'AA' }, { name: 'B', code: 'BB' }] } }], pages: {} } } })],
  ], log);
  const out = await C.collect({ http, comps: ['epl', 'kbo', 'lck'], now: NOW, delayMs: 0 });
  assert.ok(out.comps.epl.ok && out.comps.epl.events.length === 1);
  assert.strictEqual(out.comps.epl.events[0].home.id, 'soccer:359');
  assert.ok(out.comps.ucl.ok);
  assert.deepStrictEqual(out.comps.ucl.events.map(e => e.id), ['ucl:u1']); // 아스널 경기만 남음
  assert.ok(out.comps.ucl.standings);
  assert.ok(out.comps.fa_cup.offseason);
  assert.ok(out.comps.kbo.offseason && !out.comps.kbo.events.length && out.comps.kbo.standings.groups[0].rows.length === 10);
  assert.ok(!log.some(u => u.includes('GetScheduleList')), 'KBO 비시즌엔 일정 요청 안 함');
  assert.ok(out.comps.lck.events.length > 50 && out.comps.lck.standings);
  assert.deepStrictEqual(out.comps.lol_msi.events.map(e => e.id), ['lol_msi:m1']); // LCK 팀 경기만
  assert.ok(out.state.comps.epl.lastFull);
  assert.deepStrictEqual(out.comps.epl.window.length, 2);
});

test('collect(): 공식 출처 실패 → 네이버로 대체', async () => {
  const day = '2026-11-22';
  const http = fakeHttp([
    [/api\.kbl\.or\.kr/, () => ({ status: 500, text: '' })],
    [/api-gw\.sports\.naver\.com/, req => JSON.stringify({ result: { games: req.url.includes('fromDate=2026-11') ? [{ categoryId: 'kbl', gameId: 'G1', gameDate: day, gameDateTime: `${day}T14:00:00`, homeTeamName: '서울 삼성', awayTeamName: '창원 LG', homeTeamCode: '35', awayTeamCode: '50', statusCode: 'BEFORE' }] : [] } })],
  ]);
  const out = await C.collect({ http, comps: ['kbl'], now: NOW, delayMs: 0, knownTeams: { 'kbl:35': { comp: 'kbl', name: '서울 삼성' } } });
  assert.ok(out.comps.kbl.ok, out.comps.kbl.error);
  assert.strictEqual(out.comps.kbl.source, 'naver');
  assert.strictEqual(out.comps.kbl.events[0].home.id, 'kbl:35'); // 이름으로 기존 팀 id에 연결
  assert.strictEqual(out.comps.kbl.events[0].start, '2026-11-22T05:00:00Z');
});

test('collect(): 한 대회 실패해도 나머지는 계속', async () => {
  const http = fakeHttp([[/koreabaseball/, () => ({ status: 500, text: '' })], [/api-gw\.sports\.naver/, () => ({ status: 500, text: '' })]]);
  const out = await C.collect({ http, comps: ['kbo', 'mlb'], now: NOW, delayMs: 0 });
  assert.strictEqual(out.comps.kbo.ok, false);
  assert.ok('mlb' in out.comps);
});

test('roster(): ESPN 팀 목록 + 순위표로 좁히기, 국내는 순위표에서', async () => {
  const http = fakeHttp([
    [/eng\.1\/teams/, () => JSON.stringify({ sports: [{ leagues: [{ teams: [{ team: { id: '359', displayName: 'Arsenal', abbreviation: 'ARS', color: 'e20520', alternateColor: 'ffffff' } }, { team: { id: '1', displayName: 'Old FC' } }] }] }] })],
    [/eng\.1\/standings/, () => JSON.stringify({ children: [{ standings: { entries: ['359', '2', '3', '4'].map(id => ({ team: { id, displayName: 'T' + id }, stats: [] })) } }] })],
    [/koreabaseball\.com\/Record/, () => FX('kbo_rank.html')],
  ]);
  const r = await C.roster({ http, comps: ['epl', 'kbo'], now: NOW });
  assert.deepStrictEqual(r.epl.teams.map(t => [t.id, t.color, t.color2]), [['soccer:359', '#EF0107', '#FFFFFF']]);
  assert.strictEqual(r.kbo.teams.length, 10);
});

test('구단 대표색: 공식 색, 비슷한 이름 구분', () => {
  assert.deepStrictEqual(C.brand('epl', 'Manchester United'), ['#DA291C', '#FBE122']);
  assert.deepStrictEqual(C.brand('epl', 'Manchester City'), ['#6CABDD', '#1C2C5B']);
  assert.deepStrictEqual(C.brand('ligue1', 'Paris FC'), ['#1A2A5A', '#FFFFFF']);
  assert.strictEqual(C.brand('ucl', 'Paris Saint-Germain')[0], '#004170');
  assert.strictEqual(C.brand('bundesliga', '1. FC Köln')[0], '#ED1C24');
  assert.strictEqual(C.brand('mlb', 'San Francisco Giants')[0], '#FD5A1E');
  assert.strictEqual(C.brand('nfl', 'New York Giants')[0], '#0B2265');
  assert.strictEqual(C.brand('nba', 'Detroit Pistons')[0], '#C8102E');
  assert.strictEqual(C.brand('mls', 'Sporting Kansas City')[0], '#91B0D5');
  assert.strictEqual(C.brand('kbo', 'LG'), null);
  const e = T.parseEspnEvent(C.BY_ID.ucl, FXJ('uefa.champions.json')[0]);
  assert.ok(e.home.brand || !C.brand('ucl', e.home.name));
});

test('F1: 세션 일정, 팀별 결과, 순위', () => {
  const now = new Date('2026-11-20T03:00:00Z');
  const res = new Map(); const r1 = FXJ('f1_res_p1.json').MRData.RaceTable.Races; for (const r of r1) res.set(r.round, r.Results);
  const evs = T.parseF1Schedule(FXJ('f1_2026.json'), ['f1:ferrari', 'f1:mercedes'], res, new Map(), now);
  const lv = evs.filter(e => e.title === '라스베이거스 GP');
  assert.deepStrictEqual(lv.map(e => e.session), ['예선', '결승']);
  assert.strictEqual(lv[1].start, '2026-11-22T04:00:00Z'); assert.strictEqual(lv[1].status, 'scheduled');
  assert.ok(lv[1].participants.includes('f1:ferrari'));
  const au = evs.find(e => e.id === 'f1:2026-1-r');
  assert.strictEqual(au.status, 'final'); assert.strictEqual(au.results.mercedes[0], 1);
  assert.ok(evs.some(e => e.session === '스프린트'));
  const st = T.parseF1Standings(FXJ('f1_cs.json'), FXJ('f1_ds.json'));
  assert.deepStrictEqual(st.groups.map(g => g.name), ['컨스트럭터', '드라이버']);
  assert.deepStrictEqual([st.groups[0].rows[0].team_id, st.groups[0].rows[0].name, st.groups[0].rows[0].pts], ['f1:mercedes', '메르세데스', 652]);
  assert.strictEqual(st.groups[1].rows[0].color_team, 'f1:mercedes');
  assert.strictEqual(T.gpKo('Bahrain Grand Prix in Malaysia'), '바레인 GP (말레이시아 개최)');
});

test('collect(): F1 시즌 중 일정·결과 페이지 넘김', async () => {
  const http = fakeHttp([
    [/f1\/2026\.json/, () => FX('f1_2026.json')],
    [/2026\/constructorstandings/, () => FX('f1_cs.json')], [/2026\/driverstandings/, () => FX('f1_ds.json')],
    [/2026\/constructors\.json/, () => FX('f1_con.json')],
    [/2026\/results\.json/, req => /offset=0/.test(req.url) ? FX('f1_res_p1.json') : JSON.stringify({ MRData: { total: '440', RaceTable: { Races: [] } } })],
    [/2026\/sprint\.json/, () => FX('f1_spr_p1.json')],
  ]);
  const out = await C.collect({ http, comps: ['f1'], now: NOW, delayMs: 0 });
  const r = out.comps.f1;
  assert.ok(r.ok, r.error); assert.ok(!r.offseason);
  assert.ok(r.events.length > 50); assert.ok(r.standings.groups.length === 2);
  const ro = await C.roster({ http, comps: ['f1'], now: NOW });
  assert.strictEqual(ro.f1.teams.length, 11);
  assert.ok(ro.f1.teams.find(t => t.id === 'f1:ferrari').color === '#E8002D');
});

test('detail(): 종목별 라인업·타임라인·기록, F1 그리드·피트스톱·서킷', async () => {
  const zlib = require('zlib');
  const L = f => zlib.gunzipSync(fs.readFileSync(path.join(__dirname, 'fixtures/detail', f + '.json.gz'))).toString();
  const map = { 'soccer/eng.1': 'soccer_eng.1', 'basketball/nba': 'basketball_nba', 'baseball/mlb': 'baseball_mlb', 'football/nfl': 'football_nfl', 'hockey/nhl': 'hockey_nhl' };
  const http = async ({ url }) => {
    for (const [k, v] of Object.entries(map)) if (url.includes(k + '/summary')) return { status: 200, text: L(v) };
    const m = /2026\/20\/(\w+)\.json/.exec(url); if (m) return { status: 200, text: fs.readFileSync(path.join(__dirname, 'fixtures/detail', `r20_${m[1]}.json`), 'utf8') };
    return { status: 404, text: '' };
  };
  const s = await C.detail({ http, comp: 'epl', event: { id: 'epl:401879244' } });
  assert.strictEqual(s.lineup.home.formation, '4-2-3-1'); assert.strictEqual(s.lineup.home.starters.length, 11);
  assert.ok(s.timeline.some(e => e.kind === 'goal' && e.side === 'home'));
  assert.ok(s.lineup.home.starters.find(p => p.subOut));
  assert.ok(s.stats.find(x => x.label === '점유율'));
  const b = await C.detail({ http, comp: 'nba', event: { id: 'nba:1' } });
  assert.strictEqual(b.lineup.home.starters.length, 5); assert.deepStrictEqual(b.periods.labels, ['1Q', '2Q', '3Q', '4Q']);
  const m = await C.detail({ http, comp: 'mlb', event: { id: 'mlb:1' } });
  assert.strictEqual(m.lineup.home.starters.length, 9); assert.ok(m.lineup.away.pitcher); assert.strictEqual(m.periods.extra.labels[0], 'R');
  const f = await C.detail({ http, comp: 'nfl', event: { id: 'nfl:1' } });
  assert.strictEqual(f.lineup, null); assert.ok(f.timeline.length > 3 && f.leaders.length >= 4);
  const h = await C.detail({ http, comp: 'nhl', event: { id: 'nhl:1' } });
  assert.ok(h.groups.home.find(g => g.label === '골리')); assert.ok(h.timeline.some(e => e.kind === 'goal'));
  const r = await C.detail({ http, comp: 'f1', event: { id: 'f1:2026-20-r' } });
  assert.ok(r.track && r.track.d.startsWith('M')); assert.strictEqual(r.grid[0].pos, 1); assert.ok(r.timeline.some(e => e.kind === 'pit'));
  assert.strictEqual(await C.detail({ http, comp: 'kbo', event: { id: 'kbo:1' } }), null);
});

test('ESPN 순위: 승점·경기수·득실 등 기록이 남는다 (이름 겹침 회귀 방지)', () => {
  const d = { children: [{ standings: { season: 2026, entries: [
    { team: { id: '359', displayName: 'Arsenal' }, stats: [{ name: 'points', value: 29 }, { name: 'gamesPlayed', value: 12 }, { name: 'wins', value: 9 }, { name: 'ties', value: 2 }, { name: 'losses', value: 1 }, { name: 'pointsFor', value: 25 }, { name: 'pointsAgainst', value: 8 }, { name: 'rank', value: 1 }] },
  ] } }] };
  const r = C._test.parseEspnStandings(C.BY_ID.epl, d).groups[0].rows[0];
  assert.deepStrictEqual([r.rank, r.gp, r.w, r.d, r.l, r.pts, r.gf, r.ga, r.gd], [1, 12, 9, 2, 1, 29, 25, 8, 17]);
});

test('collector.js 안에 같은 이름의 함수가 두 번 있지 않다', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'collector.js'), 'utf8');
  const seen = {};
  for (const m of src.matchAll(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gm)) seen[m[1]] = (seen[m[1]] || 0) + 1;
  assert.deepStrictEqual(Object.entries(seen).filter(([, n]) => n > 1), []);
});

test('WKBL 모바일 일정: 앞으로 할 경기는 시각·경기장, 먼저 나온 팀이 홈', () => {
  const page = fs.readFileSync(path.join(__dirname, 'fixtures', 'wkbl', 'mobile_schedule_202611.html'), 'utf8');
  const ev = C._test.parseWkblMobile(page, 2026, 11);
  assert.strictEqual(ev.length, 2); // 다른 달(12.01) 칸은 건너뜀
  const [done, next] = ev;
  assert.strictEqual(done.status, 'final'); assert.strictEqual(done.home.name, '신한은행');
  assert.strictEqual(next.status, 'scheduled'); assert.strictEqual(next.home.name, '우리은행'); assert.strictEqual(next.venue, '아산');
  assert.strictEqual(next.start || next.date, '2026-11-25T10:00:00Z'); // 19:00 KST
  assert.ok(!next.ha_unknown);
});
