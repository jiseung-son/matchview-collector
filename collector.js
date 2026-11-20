/* matchview-collector — 매치뷰 앱이 폰 안에서 실행하는 수집 코드.
 * 앱은 시작할 때 이 파일의 최신 버전을 받아 쓰고, 실패하면 앱에 들어 있는 사본을 쓴다.
 * 네트워크 요청은 앱이 넘겨주는 http() 로만 한다(CORS를 피하려고 앱의 네이티브 기능을 씀).
 *
 *   const out = await MVCollector.collect({ http, comps: ['epl','kbo','lck'], state, now });
 *
 * 결과: { version, comps: {id: {ok, events, standings, error, offseason, season, source}}, state }
 */
(function (root) {
'use strict';
const VERSION = '2.0.0';

/* ───────── 대회 설정 ───────── */
// kind: league(사용자가 고르는 리그) | cup(부모 리그 팀이 나오는 대회, 자동 포함)
const C = (id, name, extra) => Object.assign({ id, name }, extra);
const SOCCER5 = ['epl', 'laliga', 'seriea', 'bundesliga', 'ligue1'];
const COMPETITIONS = [
  C('epl', '프리미어리그', { kind: 'league', sport: 'soccer', group: '유럽 축구', country: '잉글랜드', src: 'espn', path: 'soccer/eng.1', color: '#3D195B' }),
  C('laliga', '라리가', { kind: 'league', sport: 'soccer', group: '유럽 축구', country: '스페인', src: 'espn', path: 'soccer/esp.1', color: '#EE8707' }),
  C('seriea', '세리에 A', { kind: 'league', sport: 'soccer', group: '유럽 축구', country: '이탈리아', src: 'espn', path: 'soccer/ita.1', color: '#008FD7' }),
  C('bundesliga', '분데스리가', { kind: 'league', sport: 'soccer', group: '유럽 축구', country: '독일', src: 'espn', path: 'soccer/ger.1', color: '#D20515' }),
  C('ligue1', '리그 1', { kind: 'league', sport: 'soccer', group: '유럽 축구', country: '프랑스', src: 'espn', path: 'soccer/fra.1', color: '#4F6BD8' }),
  C('nfl', 'NFL', { kind: 'league', sport: 'football', group: '미국 프로스포츠', country: '미국', src: 'espn', path: 'football/nfl', color: '#013369' }),
  C('nba', 'NBA', { kind: 'league', sport: 'basketball', group: '미국 프로스포츠', country: '미국', src: 'espn', path: 'basketball/nba', color: '#C9082A' }),
  C('mlb', 'MLB', { kind: 'league', sport: 'baseball', group: '미국 프로스포츠', country: '미국', src: 'espn', path: 'baseball/mlb', color: '#041E42' }),
  C('nhl', 'NHL', { kind: 'league', sport: 'hockey', group: '미국 프로스포츠', country: '미국', src: 'espn', path: 'hockey/nhl', color: '#5A6A7A' }),
  C('mls', 'MLS', { kind: 'league', sport: 'soccer', group: '미국 프로스포츠', country: '미국', src: 'espn', path: 'soccer/usa.1', color: '#0B2240' }),
  C('kbo', 'KBO 리그', { kind: 'league', sport: 'baseball', group: '국내 프로스포츠', country: '대한민국', src: 'kbo', color: '#0D2C6C' }),
  C('kleague1', 'K리그1', { kind: 'league', sport: 'soccer', group: '국내 프로스포츠', country: '대한민국', src: 'kleague', color: '#00377A' }),
  C('kbl', 'KBL', { kind: 'league', sport: 'basketball', group: '국내 프로스포츠', country: '대한민국', src: 'kbl', color: '#E5352B' }),
  C('wkbl', 'WKBL', { kind: 'league', sport: 'basketball', group: '국내 프로스포츠', country: '대한민국', src: 'wkbl', color: '#E4007F' }),
  C('vleague_m', 'V리그 남자부', { kind: 'league', sport: 'volleyball', group: '국내 프로스포츠', country: '대한민국', src: 'kovo', gender: '1', color: '#1B4F9C' }),
  C('vleague_w', 'V리그 여자부', { kind: 'league', sport: 'volleyball', group: '국내 프로스포츠', country: '대한민국', src: 'kovo', gender: '2', color: '#D6336C' }),
  C('lck', 'LCK', { kind: 'league', sport: 'esports', group: 'e스포츠', country: '대한민국', src: 'lol', slug: 'lck', color: '#C89B3C' }),
  // 컵·국제대회 (부모 리그를 고르면 자동 포함, 고른 팀 경기만 표시)
  C('ucl', '챔피언스리그', { kind: 'cup', sport: 'soccer', src: 'espn', path: 'soccer/uefa.champions', parents: SOCCER5, standings: true }),
  C('uel', '유로파리그', { kind: 'cup', sport: 'soccer', src: 'espn', path: 'soccer/uefa.europa', parents: SOCCER5, standings: true }),
  C('uecl', '컨퍼런스리그', { kind: 'cup', sport: 'soccer', src: 'espn', path: 'soccer/uefa.europa.conf', parents: SOCCER5, standings: true }),
  C('uefa_super', 'UEFA 슈퍼컵', { kind: 'cup', sport: 'soccer', src: 'espn', path: 'soccer/uefa.super_cup', parents: SOCCER5 }),
  C('fa_cup', 'FA컵', { kind: 'cup', sport: 'soccer', src: 'espn', path: 'soccer/eng.fa', parents: ['epl'] }),
  C('efl_cup', '카라바오컵', { kind: 'cup', sport: 'soccer', src: 'espn', path: 'soccer/eng.league_cup', parents: ['epl'] }),
  C('community_shield', '커뮤니티 실드', { kind: 'cup', sport: 'soccer', src: 'espn', path: 'soccer/eng.charity', parents: ['epl'] }),
  C('copa_del_rey', '코파 델 레이', { kind: 'cup', sport: 'soccer', src: 'espn', path: 'soccer/esp.copa_del_rey', parents: ['laliga'] }),
  C('supercopa', '수페르코파 (스페인)', { kind: 'cup', sport: 'soccer', src: 'espn', path: 'soccer/esp.super_cup', parents: ['laliga'] }),
  C('coppa_italia', '코파 이탈리아', { kind: 'cup', sport: 'soccer', src: 'espn', path: 'soccer/ita.coppa_italia', parents: ['seriea'] }),
  C('supercoppa', '수페르코파 (이탈리아)', { kind: 'cup', sport: 'soccer', src: 'espn', path: 'soccer/ita.super_cup', parents: ['seriea'] }),
  C('dfb_pokal', 'DFB 포칼', { kind: 'cup', sport: 'soccer', src: 'espn', path: 'soccer/ger.dfb_pokal', parents: ['bundesliga'] }),
  C('dfl_supercup', 'DFL 슈퍼컵', { kind: 'cup', sport: 'soccer', src: 'espn', path: 'soccer/ger.super_cup', parents: ['bundesliga'] }),
  C('coupe_de_france', '쿠프 드 프랑스', { kind: 'cup', sport: 'soccer', src: 'espn', path: 'soccer/fra.coupe_de_france', parents: ['ligue1'] }),
  C('trophee', '트로페 데 샹피옹', { kind: 'cup', sport: 'soccer', src: 'espn', path: 'soccer/fra.super_cup', parents: ['ligue1'] }),
  C('lol_fst', 'First Stand', { kind: 'cup', sport: 'esports', src: 'lol', slug: 'first_stand', parents: ['lck'] }),
  C('lol_msi', 'MSI', { kind: 'cup', sport: 'esports', src: 'lol', slug: 'msi', parents: ['lck'] }),
  C('lol_worlds', '월드 챔피언십', { kind: 'cup', sport: 'esports', src: 'lol', slug: 'worlds', parents: ['lck'] }),
  C('lol_ewc', 'e스포츠 월드컵', { kind: 'cup', sport: 'esports', src: 'lol', slug: 'ewc_lol', parents: ['lck'] }),
  C('lol_kespa', 'KeSPA컵', { kind: 'cup', sport: 'esports', src: 'lol', slug: 'kespa_cup', parents: ['lck'] }),
  C('lol_asiad', '아시안게임', { kind: 'cup', sport: 'esports', src: 'lol', slug: 'asian_games', parents: ['lck'] }),
];
const BY_ID = Object.fromEntries(COMPETITIONS.map(c => [c.id, c]));

const ROUND_KO = {
  'league-phase': '리그 페이즈', 'knockout-round-playoffs': '플레이오프', 'knockout-playoffs': '플레이오프',
  'round-of-64': '64강', 'round-of-32': '32강', 'round-of-16': '16강', 'quarterfinals': '8강', 'quarter-finals': '8강',
  'semifinals': '4강', 'semi-finals': '4강', 'final': '결승', 'finals': '결승',
  'first-round': '1라운드', 'second-round': '2라운드', 'third-round': '3라운드', 'fourth-round': '4라운드',
  'fifth-round': '5라운드', 'sixth-round': '6라운드', 'seventh-round': '7라운드', 'eighth-round': '8라운드',
  'group-stage': '조별리그', 'play-off-round': '플레이오프 라운드', 'playoff-round': '플레이오프 라운드',
  'qualifying-rounds': '예선', 'first-qualifying-round': '1차 예선', 'second-qualifying-round': '2차 예선', 'third-qualifying-round': '3차 예선',
};

/* ───────── 공통 유틸 ───────── */
const KST_OFFSET = 9 * 3600e3;
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
const isoDay = d => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const addDays = (d, n) => new Date(d.getTime() + n * 86400e3);
const utcIso = ms => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
const toInt = v => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : null; };
const toNum = v => { if (v === null || v === undefined || v === '' || v === '-') return null; const n = Number(String(v).replace(/,/g, '')); return Number.isFinite(n) ? n : null; };
const stripTags = s => decodeEntities(String(s || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
function decodeEntities(s) { return s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)); }
// KST 날짜 + "HH:MM" → UTC ISO. 시각이 없으면 자정 + time_tbd
function kstIso(y, m, d, hhmm) {
  const mm = /^\s*(\d{1,2}):?(\d{2})\s*$/.exec(hhmm || '');
  const ms = Date.UTC(y, m - 1, d, mm ? +mm[1] : 0, mm ? +mm[2] : 0) - KST_OFFSET;
  return [utcIso(ms), !mm];
}
function monthsBetween(a, b) { // a,b: Date(UTC) → [[y,m],...]
  const out = []; let y = a.getUTCFullYear(), m = a.getUTCMonth() + 1;
  while (y < b.getUTCFullYear() || (y === b.getUTCFullYear() && m <= b.getUTCMonth() + 1)) { out.push([y, m]); m === 12 ? (y++, m = 1) : m++; }
  return out;
}
const kstNow = now => new Date(now.getTime() + KST_OFFSET); // getUTC* 로 KST 날짜를 읽는 용도
const JUNK = /all[- ]?stars?|^tbd\b|^team |^(afc|nfc|world|rising stars)$|^usa$/i;

class SourceError extends Error {}

function makeClient(http, delayMs) {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  async function req(url, opt = {}) {
    let last;
    for (let i = 0; i < 2; i++) {
      try {
        const r = await http({ url, method: opt.method || 'GET', headers: opt.headers || {}, body: opt.body || null, timeout: 30000 });
        if (delayMs) await sleep(delayMs);
        if (r.status === 200) return r.text;
        last = new SourceError(`HTTP ${r.status}`);
        if ([400, 401, 403, 404].includes(r.status)) break;
      } catch (e) { last = new SourceError(String(e && e.message || e)); }
      await sleep(1000 * (i + 1));
    }
    throw last;
  }
  return {
    text: req,
    json: async (url, opt) => { const t = await req(url, opt); try { return JSON.parse(t); } catch { throw new SourceError('JSON 형식 오류'); } },
  };
}

const ev = (comp, id, start, tbd, home, away, hs, as, status, extra) => {
  const scored = ['final', 'live', 'suspended'].includes(status);
  return Object.assign({ id: `${comp}:${id}`, comp, start, time_tbd: !!tbd, home, away,
    home_score: scored ? hs : null, away_score: scored ? as : null, venue: '', status, status_text: '' }, extra || {});
};
const team = (id, name, extra) => Object.assign({ id, name: name || '?', short: name || '' }, extra || {});
function standingsOf(rows, season, groupName) {
  rows.sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
  rows.forEach((r, i) => { r.pos = i + 1; });
  return { season: String(season || ''), groups: [{ name: groupName || '전체', rows }] };
}
const row = (team_id, name, rank, f) => {
  const r = Object.assign({ team_id, name, rank, gp: null, w: null, d: null, l: null, otl: null, pct: null, pts: null, gf: null, ga: null, gd: null, gb: null, streak: null }, f || {});
  if (r.gp === null && r.w !== null && r.l !== null) r.gp = r.w + r.l + (r.d || 0);
  return r;
};

/* ───────── ESPN ───────── */
const ESPN = 'https://site.api.espn.com/apis/site/v2/sports';
const ESPN_ST = 'https://site.api.espn.com/apis/v2/sports';

function espnStatus(e) {
  const t = (e.status || {}).type || {}; const name = String(t.name || '').toUpperCase(); const state = String(t.state || '').toLowerCase();
  const text = t.shortDetail || t.description || '';
  if (name.includes('POSTPONED')) return ['postponed', '연기'];
  if (/CANCEL|ABANDON|FORFEIT/.test(name)) return ['canceled', '취소'];
  if (/SUSPENDED|DELAYED/.test(name)) return ['suspended', '중단'];
  if (state === 'post' || t.completed) return ['final', text];
  if (state === 'in') return ['live', text];
  return ['scheduled', ''];
}
function espnTeamId(comp, t) {
  const sport = comp.sport === 'soccer' ? 'soccer' : comp.id; // 축구는 대회가 달라도 같은 팀 id
  return `${sport}:${t.id || t.abbreviation}`;
}
function parseEspnEvent(comp, e) {
  const c = (e.competitions || [])[0]; if (!c) return null;
  const H = (c.competitors || []).find(x => x.homeAway === 'home'), A = (c.competitors || []).find(x => x.homeAway === 'away');
  if (!H || !A) return null;
  const tn = x => (x.team || {});
  if (JUNK.test(tn(H).displayName || '') || JUNK.test(tn(A).displayName || '')) return null;
  const start = Date.parse(e.date || c.date); if (!Number.isFinite(start)) return null;
  const [status, statusText] = espnStatus(e);
  const T = x => { const t = tn(x); const o = team(espnTeamId(comp, t), t.displayName || t.name, { short: t.abbreviation || t.shortDisplayName || '' });
    if (t.color) o.color = '#' + String(t.color).replace('#', '').slice(0, 6);
    if (t.alternateColor) o.color2 = '#' + String(t.alternateColor).replace('#', '').slice(0, 6);
    return o; };
  const slug = (e.season || {}).slug;
  const round = comp.kind === 'cup' && slug ? (ROUND_KO[slug] || slug.replace(/-/g, ' ')) : '';
  return ev(comp.id, e.id, utcIso(start), c.timeValid === false, T(H), T(A), toInt(H.score), toInt(A.score), status,
    { venue: (c.venue || e.venue || {}).fullName || '', status_text: statusText, round });
}
async function espnSeason(cli, comp) {
  const j = await cli.json(`${ESPN}/${comp.path}/scoreboard`);
  const lg = (j.leagues || [])[0] || {}; const s = lg.season || {};
  const cal = Array.isArray(lg.calendar) && typeof lg.calendar[0] === 'string' ? lg.calendar.map(x => Date.parse(x)).filter(Number.isFinite) : null;
  return { start: Date.parse(s.startDate), end: Date.parse(s.endDate), label: s.displayName || String(s.year || ''), calendar: cal };
}
async function espnRange(cli, comp, from, to) {
  const raw = [];
  for (const [y, m] of monthsBetween(from, to)) {
    const j = await cli.json(`${ESPN}/${comp.path}/scoreboard?dates=${y}${pad(m)}&limit=1000`);
    const evs = j.events || []; raw.push(...evs);
    if (evs.length >= 100) { // 경기가 많은 달은 응답이 잘린다 → 마지막 날짜부터 하루씩 보충
      const last = evs.map(e => Date.parse(e.date)).filter(Number.isFinite).sort((a, b) => b - a)[0];
      const monthEnd = new Date(Date.UTC(y, m, 0));
      for (let d = new Date(Date.UTC(new Date(last).getUTCFullYear(), new Date(last).getUTCMonth(), new Date(last).getUTCDate())); d <= monthEnd && d <= to; d = addDays(d, 1)) {
        if (d < from) continue;
        const jd = await cli.json(`${ESPN}/${comp.path}/scoreboard?dates=${ymd(d)}&limit=1000`);
        raw.push(...(jd.events || []));
      }
    }
  }
  const out = new Map();
  for (const e of raw) { const p = parseEspnEvent(comp, e); if (p && Date.parse(p.start) >= from.getTime() - 86400e3 && Date.parse(p.start) <= to.getTime() + 86400e3) out.set(p.id, p); }
  return [...out.values()];
}
function espnStats(entry) {
  const o = {};
  for (const s of entry.stats || []) { const n = s.name || s.type; if (!n) continue; o[n] = s.value ?? s.displayValue; if (n === 'streak' && s.displayValue) o[n] = s.displayValue; }
  return o;
}
function parseEspnStandings(comp, data) {
  const found = [];
  (function walk(node, label) {
    const name = node.name || node.abbreviation || label; const st = node.standings || {};
    if ((st.entries || []).length) found.push([name, st.entries, st.season || st.seasonDisplayName]);
    for (const ch of node.children || []) walk(ch, name);
  })(data, '');
  const groups = []; let season = '';
  for (const [name, entries, ssn] of found) {
    const rows = [];
    for (const en of entries) {
      const t = en.team || {}; if (!t.id && !t.abbreviation) continue;
      const s = espnStats(en);
      const pf = toNum(s.pointsFor), pa = toNum(s.pointsAgainst);
      let gd = toNum(s.pointDifferential); if (gd === null) gd = toNum(s.differential); if (gd === null && pf !== null && pa !== null) gd = pf - pa;
      rows.push(row(espnTeamId(comp, t), t.displayName || t.name, toNum(s.rank) ?? toNum(s.playoffSeed), {
        gp: toNum(s.gamesPlayed), w: toNum(s.wins), d: toNum(s.ties), l: toNum(s.losses),
        otl: toNum(s.otLosses ?? s.overtimeLosses), pct: toNum(s.winPercent),
        pts: ['soccer', 'hockey'].includes(comp.sport) ? toNum(s.points) : null,
        gf: pf, ga: pa, gd, gb: toNum(s.gamesBehind), streak: typeof s.streak === 'string' ? s.streak : null,
      }));
    }
    const pts = comp.sport === 'soccer' || comp.sport === 'hockey';
    rows.sort((a, b) => pts && a.pts !== null ? (b.pts - a.pts) || ((b.gd || 0) - (a.gd || 0)) : a.pct !== null ? (b.pct - a.pct) || ((b.w || 0) - (a.w || 0)) : (a.rank ?? 999) - (b.rank ?? 999));
    rows.forEach((r, i) => { r.pos = i + 1; });
    if (rows.length) groups.push({ name, rows });
    season = season || ssn || '';
  }
  if (!groups.length) throw new SourceError('순위 데이터 없음');
  if (groups.length === 1) groups[0].name = '전체';
  return { season: String(season), groups };
}
async function fetchEspn(cli, comp, ctx) {
  const now = ctx.now;
  const s = await espnSeason(cli, comp);
  const prev = ctx.prevState || {};
  const seasonEnded = Number.isFinite(s.end) && s.end < now.getTime();
  const nextDates = (s.calendar || []).filter(t => t >= now.getTime() - 86400e3);
  // 시즌이 끝났고 다음 시즌 일정이 아직 없으면: 일정은 받지 않고 순위만(최종 결과)
  const offseason = seasonEnded || (s.calendar && s.calendar.length > 0 && !nextDates.length);
  let events = [];
  let full = false;
  if (!offseason) {
    const seasonStart = Number.isFinite(s.start) ? new Date(s.start) : addDays(now, -30);
    const seasonEnd = Number.isFinite(s.end) ? new Date(s.end) : addDays(now, 180);
    full = !prev.lastFull || now.getTime() - prev.lastFull > 20 * 3600e3 || prev.season !== s.label;
    // 처음이거나 하루가 지났으면 시즌 전체(지난 경기 포함), 아니면 가까운 기간만
    const from = full ? (prev.lastFull ? addDays(now, -21) : new Date(Math.max(seasonStart.getTime(), addDays(now, -200).getTime()))) : addDays(now, -3);
    const to = full ? new Date(Math.min(seasonEnd.getTime(), addDays(now, 200).getTime())) : addDays(now, 21);
    if (from <= to) events = await espnRange(cli, comp, from, to);
    ctx.window = [isoDay(from), isoDay(to)];
  }
  let standings = null;
  if (comp.kind === 'league' || comp.standings) {
    try { standings = parseEspnStandings(comp, await cli.json(`${ESPN_ST}/${comp.path}/standings`)); } catch (e) { if (comp.kind === 'league') ctx.standingsError = String(e.message || e); }
  }
  return { events, standings, offseason, season: s.label, full, window: ctx.window || null, seasonStart: s.start, seasonEnd: s.end };
}

/* ───────── KBO (koreabaseball.com) ───────── */
function parseKboSchedule(data, year) {
  const out = []; let cur = null;
  for (const r of data.rows || []) {
    const cells = r.row || []; const by = {};
    for (const c of cells) if (c.Class) by[c.Class] = c.Text || '';
    if (by.day) { const m = /(\d{2})\.(\d{2})/.exec(stripTags(by.day)); if (m) cur = [year, +m[1], +m[2]]; }
    const play = by.play; if (!play || !cur) continue;
    const em = /<em>([\s\S]*?)<\/em>/.exec(play);
    const nums = em ? [...em[1].matchAll(/<span[^>]*>([\s\S]*?)<\/span>/g)].map(x => stripTags(x[1])).filter(x => /^\d+$/.test(x)).map(Number) : [];
    const teams = play.replace(/<em>[\s\S]*?<\/em>/, '|').split('|').map(stripTags).filter(Boolean);
    if (teams.length !== 2) continue;
    const [awayN, homeN] = teams; // KBO 표기: 원정 vs 홈
    const tail = cells.slice(-2).map(c => stripTags(c.Text));
    const venue = tail[0] || ''; let note = tail[1] || ''; if (note === '-') note = '';
    const tv = cells.filter(c => !c.Class).map(c => stripTags(c.Text)).filter(t => /^[A-Z0-9+-]+(,[A-Z0-9+-]+)*$/.test(t) && /T$|TVING/.test(t));
    const gid = (/gameId=(\w+)/.exec(cells.map(c => c.Text || '').join(' ')) || [])[1] || `${cur.join('')}${awayN}${homeN}`;
    let status = 'scheduled';
    if (/취소|연기/.test(note)) status = note.includes('취소') ? 'canceled' : 'postponed';
    else if (nums.length === 2) status = 'final';
    const [start, tbd] = kstIso(cur[0], cur[1], cur[2], stripTags(by.time));
    out.push(ev('kbo', gid, start, tbd, team(`kbo:${homeN}`, homeN), team(`kbo:${awayN}`, awayN), nums[1] ?? null, nums[0] ?? null, status,
      { venue, status_text: note, broadcast: tv.join(',').split(',').filter(Boolean).concat(['TVING']) }));
  }
  return out;
}
function parseKboRank(page) {
  const m = /<table[^>]*class="tData"[^>]*>([\s\S]*?)<\/table>/.exec(page); if (!m) throw new SourceError('KBO 순위표 없음');
  const rows = [];
  for (const tr of m[1].match(/<tr>[\s\S]*?<\/tr>/g) || []) {
    const td = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(x => stripTags(x[1])); if (td.length < 8) continue;
    rows.push(row(`kbo:${td[1]}`, td[1], toInt(td[0]), { gp: toInt(td[2]), w: toInt(td[3]), l: toInt(td[4]), d: toInt(td[5]), pct: toNum(td[6]), gb: toNum(td[7]), streak: td[9] || null }));
  }
  return rows;
}
async function fetchKbo(cli, comp, ctx) {
  const now = kstNow(ctx.now); const y = now.getUTCFullYear(); const mo = now.getUTCMonth() + 1;
  const offseason = mo >= 11 || mo <= 2; // 정규시즌 3~10월(포스트시즌 ~11월 초)
  let events = [];
  const months = offseason || ctx.rosterOnly ? [] : [mo - 1, mo, mo + 1].filter(m => m >= 3 && m <= 11);
  if (!ctx.prevState?.lastFull && !offseason && !ctx.rosterOnly) for (let m = 3; m < mo - 1; m++) months.unshift(m);
  for (const m of [...new Set(months)].sort((a, b) => a - b)) {
    const t = await cli.json('https://www.koreabaseball.com/ws/Schedule.asmx/GetScheduleList', { method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', Referer: 'https://www.koreabaseball.com/Schedule/Schedule.aspx', 'X-Requested-With': 'XMLHttpRequest' },
      body: `leId=1&srIdList=0%2C3%2C4%2C5%2C7%2C9%2C6&seasonId=${y}&gameMonth=${pad(m)}&teamId=` });
    events.push(...parseKboSchedule(t, y));
  }
  const page = await cli.text('https://www.koreabaseball.com/Record/TeamRank/TeamRankDaily.aspx');
  return { events, standings: standingsOf(parseKboRank(page), y), offseason, season: String(y), full: true };
}

/* ───────── K리그1 (kleague.com) ───────── */
function parseKleagueSchedule(data) {
  const out = [];
  for (const g of ((data.data || {}).scheduleList) || []) {
    const p = String(g.gameDate || '').split('.').map(Number); if (p.length !== 3) continue;
    const code = String(g.gameStatus || '').toUpperCase();
    const status = code === 'PP' ? 'postponed' : code === 'CAN' ? 'canceled' : (g.endYn === 'Y' || code === 'FE') ? 'final' : ['LIVE', 'IN', 'HT'].includes(code) ? 'live' : 'scheduled';
    const [start, tbd] = kstIso(p[0], p[1], p[2], g.gameTime);
    out.push(ev('kleague1', `${g.year}-${g.gameId}`, start, tbd, team(`kleague1:${g.homeTeam}`, g.homeTeamName), team(`kleague1:${g.awayTeam}`, g.awayTeamName),
      toInt(g.homeGoal), toInt(g.awayGoal), status, { venue: g.fieldNameFull || g.fieldName || '', round: g.roundId ? `${g.roundId}라운드` : '',
        broadcast: String(g.broadcastName || '').split('/').map(s => s.trim()).filter(Boolean) }));
  }
  return out;
}
function parseKleagueRank(data) {
  const seen = new Set(), rows = [];
  for (const t of ((data.data || {}).teamRank) || []) {
    if (seen.has(t.teamId)) continue; seen.add(t.teamId);
    rows.push(row(`kleague1:${t.teamId}`, t.teamName, toInt(t.rank), { gp: toInt(t.gameCount), w: toInt(t.winCnt), d: toInt(t.tieCnt), l: toInt(t.lossCnt),
      pts: toInt(t.gainPoint), gf: toInt(t.gainGoal), ga: toInt(t.lossGoal), gd: toInt(t.gapCnt) }));
  }
  return rows;
}
async function fetchKleague(cli, comp, ctx) {
  const now = kstNow(ctx.now); const y = now.getUTCFullYear(); const mo = now.getUTCMonth() + 1;
  const offseason = mo === 1 || (mo === 12 && now.getUTCDate() > 10);
  const months = [];
  if (!offseason && !ctx.rosterOnly) { for (let m = ctx.prevState?.lastFull ? Math.max(2, mo - 1) : 2; m <= Math.min(12, mo + 2); m++) months.push(m); }
  let events = [];
  for (const m of months) {
    const j = await cli.json('https://www.kleague.com/getScheduleList.do', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ year: String(y), month: pad(m), leagueId: 1 }) });
    events.push(...parseKleagueSchedule(j));
  }
  let rows = [], season = y;
  for (const yy of [y, y - 1]) {
    const j = await cli.json(`https://www.kleague.com/record/teamRank.do?leagueId=1&year=${yy}&stadium=all&recordType=rank`, { method: 'POST' });
    rows = parseKleagueRank(j); season = yy; if (rows.some(r => (r.gp || 0) > 0)) break;
  }
  return { events, standings: standingsOf(rows, season), offseason, season: String(season), full: true };
}

/* ───────── KBL (api.kbl.or.kr) ───────── */
const KBL_H = { channel: 'WEB', teamcode: 'XX', lang: 'ko', 'X-Requested-With': 'XMLHttpRequest', Accept: 'application/json, text/plain, */*' };
function parseKblSchedule(items) {
  const out = [];
  for (const g of items || []) {
    if (![1, '1', undefined, null].includes(g.seasonGrade)) continue; // D리그 제외
    const d = String(g.gameDate || ''); if (!/^\d{8}$/.test(d)) continue;
    const status = g.isEnded ? 'final' : g.isStarted ? 'live' : 'scheduled';
    const [start, tbd] = kstIso(+d.slice(0, 4), +d.slice(4, 6), +d.slice(6, 8), g.gameStart);
    out.push(ev('kbl', g.gmkey || `${d}${g.tcodeH}`, start, tbd, team(`kbl:${g.tcodeH}`, g.tnameH), team(`kbl:${g.tcodeA}`, g.tnameA),
      toInt(g.scoreH), toInt(g.scoreA), status, { venue: g.stadiumnameF || g.stadiumname || '', round: g.seasonCategoryName && g.seasonCategoryName !== '정규시즌' ? g.seasonCategoryName : '',
        broadcast: [g.tv, 'TVING'].filter(Boolean) }));
  }
  return out;
}
function parseKblRank(items) {
  return (items || []).map(t => { const w = toInt(t.win), l = toInt(t.loss);
    return row(`kbl:${t.tcode}`, t.tname, toInt(t.rank), { w, l, pct: w !== null && l !== null && w + l ? Math.round(w / (w + l) * 1000) / 1000 : null,
      gb: toNum(t.winDiff), streak: t.contiWin ? `${t.contiWin}연승` : t.contiLoss ? `${t.contiLoss}연패` : null }); });
}
async function fetchKbl(cli, comp, ctx) {
  const now = ctx.now; const mo = kstNow(now).getUTCMonth() + 1;
  const offseason = mo >= 5 && mo <= 9;
  let events = [];
  if (!offseason && !ctx.rosterOnly) {
    const from = addDays(now, ctx.prevState?.lastFull ? -14 : -120), to = addDays(now, 150);
    for (const [y, m] of monthsBetween(from, to)) {
      if (m >= 5 && m <= 9) continue;
      const a = new Date(Math.max(Date.UTC(y, m - 1, 1), from.getTime())), b = new Date(Math.min(Date.UTC(y, m, 0), to.getTime()));
      const j = await cli.json(`https://api.kbl.or.kr/match/list?fromDate=${ymd(kstNow(a))}&toDate=${ymd(kstNow(b))}&tcodeList=all&seasonGrade=1`, { headers: KBL_H });
      events.push(...parseKblSchedule(j));
    }
  }
  const rank = await cli.json('https://api.kbl.or.kr/league/rank/team', { headers: KBL_H });
  return { events, standings: standingsOf(parseKblRank(rank), ''), offseason, season: '', full: true };
}

/* ───────── WKBL (wkbl.or.kr) — 일정표에 시각·홈/원정이 없어 네이버로 보완 ───────── */
const WKBL_TEAMS = ['삼성생명', '신한은행', '우리은행', '하나은행', 'BNK 썸', 'KB스타즈'];
function wkblSeasons(page) { const m = /<select name="season_gu"[\s\S]*?<\/select>/.exec(page); return m ? [...m[0].matchAll(/<option value="(\d{3})"[^>]*>([^<]+)/g)].map(x => [x[1], x[2].trim()]) : []; }
function parseWkblSchedule(page, y, m) {
  const out = [];
  for (const cell of page.split('<td>').slice(1)) {
    const dm = /class="date_day">(\d+)</.exec(cell); if (!dm) continue;
    const games = cell.split('<div class="info_game">').slice(1);
    games.forEach((g, gi) => {
      const names = [...g.matchAll(/<span class="language" data-kr="([^"]+)"/g)].map(x => x[1]); if (names.length < 2) return;
      const sc = [...g.matchAll(/<em>(\d+)<\/em>/g)].map(x => +x[1]); const gno = (/game_no=(\d+)/.exec(g) || [])[1];
      const [start] = kstIso(y, m, +dm[1], null);
      out.push(ev('wkbl', gno ? `${y}${pad(m)}-${gno}` : `${y}${pad(m)}${pad(+dm[1])}-${gi}`, start, true, team(`wkbl:${names[0]}`, names[0]), team(`wkbl:${names[1]}`, names[1]),
        sc.length === 2 ? sc[0] : null, sc.length === 2 ? sc[1] : null, sc.length === 2 ? 'final' : 'scheduled', { ha_unknown: true }));
    });
  }
  return out;
}
function parseWkblRank(frag) {
  const rows = [];
  for (const tr of frag.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || []) {
    const td = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(x => stripTags(x[1])); if (td.length < 6) continue;
    const short = WKBL_TEAMS.find(s => td[1].startsWith(s) || s.startsWith(td[1])) || td[1].split(' ')[0];
    const wl = /(\d+)승\s*(\d+)패/.exec(td[3]); const p = toNum(td[4]);
    rows.push(row(`wkbl:${short}`, short, toInt(td[0]), { gp: toInt(td[2]), w: wl ? +wl[1] : null, l: wl ? +wl[2] : null, pct: p !== null && p > 1 ? Math.round(p * 10) / 1000 : p, gb: toNum(td[5]), streak: td[10] || null }));
  }
  return rows;
}
async function fetchWkbl(cli, comp, ctx) {
  const base = await cli.text('https://www.wkbl.or.kr/game/sch/schedule1.asp');
  const seasons = wkblSeasons(base); if (!seasons.length) throw new SourceError('WKBL 시즌 목록 없음');
  const now = ctx.now; const mo = kstNow(now).getUTCMonth() + 1;
  const offseason = mo >= 5 && mo <= 9;
  let events = [];
  if (!offseason && !ctx.rosterOnly) {
    const from = addDays(now, ctx.prevState?.lastFull ? -14 : -120), to = addDays(now, 150);
    for (const [y, m] of monthsBetween(from, to)) {
      if (m >= 5 && m <= 9) continue;
      const page = await cli.text(`https://www.wkbl.or.kr/game/sch/schedule1.asp?season_gu=${seasons[0][0]}&ym=${y}${pad(m)}&gun=1`);
      const sel = (/<option value="(\d{6})"\s*selected/.exec(page) || [])[1];
      if (sel && sel !== `${y}${pad(m)}`) continue;
      events.push(...parseWkblSchedule(page, y, m));
    }
    try { events = await enrichFromNaver(cli, comp, events, from, to); } catch (e) { /* 보완 실패해도 공식 일정은 유지 */ }
  }
  const frag = await cli.text('https://www.wkbl.or.kr/game/ajax/ajax_team_rank.asp', { method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest', Referer: 'https://www.wkbl.or.kr/game/team_rank.asp' },
    body: `season_gu=${seasons[0][0]}&gun=1` });
  return { events, standings: standingsOf(parseWkblRank(frag), seasons[0][1]), offseason, season: seasons[0][1], full: true };
}

/* ───────── V리그 (user-api.kovo.co.kr) ───────── */
const KOVO = 'https://user-api.kovo.co.kr';
const KOVO_H = { 'Accept-Language': 'ko', Origin: 'https://kovo.co.kr', Referer: 'https://kovo.co.kr/' };
function parseKovoSchedule(data, cid) {
  const out = [];
  for (const g of (((data.payload || {}).content) || [])) {
    const p = String(g.gdate || '').split('-').map(Number); if (p.length !== 3) continue;
    const hs = toInt(g.hspoint), as = toInt(g.aspoint);
    const done = String(g.getime || '').trim() !== '' && ((hs || 0) + (as || 0)) > 0;
    const [start, tbd] = kstIso(p[0], p[1], p[2], g.gstime);
    out.push(ev(cid, `${g.seasonCode}-${g.leagueCode}-${g.gnum}`, start, tbd, team(`${cid}:${g.hcode}`, g.hsname || g.hname), team(`${cid}:${g.acode}`, g.asname || g.aname),
      hs, as, done ? 'final' : 'scheduled', { venue: g.place || '', round: g.roundName || '', broadcast: String(g.gtv || '').split(',').map(s => s.trim()).filter(Boolean) }));
  }
  return out;
}
function parseKovoRank(data, cid) {
  return (data.payload || []).map(t => row(`${cid}:${t.tcode}`, t.tsname, toInt(t.rank), { w: toInt(t.win), l: toInt(t.lost), pts: toNum(t.winp),
    gf: toInt(t.point), ga: toInt(t.lpoint), gd: t.point !== undefined ? (toInt(t.point) || 0) - (toInt(t.lpoint) || 0) : null, streak: t.con || null }));
}
async function fetchKovo(cli, comp) {
  const seasons = await cli.json(`${KOVO}/stat/season-list?gcode=001`, { headers: KOVO_H });
  const list = seasons.payload || []; if (!list.length) throw new SourceError('V리그 시즌 목록 없음');
  const season = list[list.length - 1].seasonCode;
  const sched = await cli.json(`${KOVO}/stat/game-schedule?gcode=001&seasonCode=${season}&leagueCode=201&gender=${comp.gender}`, { headers: KOVO_H });
  const rank = await cli.json(`${KOVO}/stat/league/team-rank?seasonCode=${season}&leagueCode=201&gender=${comp.gender}&round=0&page=0&size=30`, { headers: KOVO_H });
  const events = parseKovoSchedule(sched, comp.id);
  const offseason = !events.some(e => e.status === 'scheduled');
  return { events, standings: standingsOf(parseKovoRank(rank, comp.id), list[list.length - 1].seasonName || season), offseason, season, full: true };
}

/* ───────── 네이버 스포츠 (대체·보완용, 국내에서만 응답) ───────── */
const NAVER_CAT = { kbo: ['kbaseball', 'kbo'], kleague1: ['kfootball', 'kleague'], kbl: ['basketball', 'kbl'], wkbl: ['basketball', 'wkbl'], vleague_m: ['volleyball', 'kovo'], vleague_w: ['volleyball', 'wkovo'] };
async function naverGames(cli, comp, from, to) {
  const [upper, cat] = NAVER_CAT[comp.id] || [];
  if (!upper) throw new SourceError('네이버 대상 아님');
  const out = [];
  for (let a = from; a <= to; a = addDays(a, 31)) {
    const b = new Date(Math.min(addDays(a, 30).getTime(), to.getTime()));
    const j = await cli.json(`https://api-gw.sports.naver.com/schedule/games?fields=basic,superCategoryId,categoryName,stadium,statusNum&upperCategoryId=${upper}&fromDate=${isoDay(kstNow(a))}&toDate=${isoDay(kstNow(b))}&size=500`,
      { headers: { Referer: 'https://m.sports.naver.com/', Accept: 'application/json' } });
    const games = ((j.result || {}).games); if (!Array.isArray(games)) throw new SourceError('네이버 응답 형식 이상');
    for (const g of games) if (g.categoryId === cat) out.push(g);
  }
  return out;
}
function parseNaverGame(comp, g, teamIdByName) {
  const dt = g.gameDateTime ? Date.parse(g.gameDateTime + '+09:00') : NaN; if (!Number.isFinite(dt)) return null;
  const code = String(g.statusCode || '').toUpperCase();
  const status = (g.cancel || /CANCEL/.test(code)) ? 'canceled' : ['RESULT', 'ENDED'].includes(code) ? 'final' : ['STARTED', 'LIVE'].includes(code) ? 'live' : 'scheduled';
  const T = side => { const n = g[`${side}TeamName`]; return team(teamIdByName(n) || `${comp.id}:${g[`${side}TeamCode`] || n}`, n); };
  return ev(comp.id, `n${g.gameId}`, utcIso(dt), false, T('home'), T('away'), toInt(g.homeTeamScore), toInt(g.awayTeamScore), status, { venue: g.stadium || '', status_text: g.statusInfo || '' });
}
// 공식 일정(날짜·대진)에 네이버의 시각·홈/원정을 덧붙인다
async function enrichFromNaver(cli, comp, events, from, to) {
  const games = await naverGames(cli, comp, from, to);
  const key = (day, a, b) => `${day}|${[a, b].sort().join('|')}`;
  const norm = s => String(s || '').replace(/\s/g, '');
  const short = n => WKBL_TEAMS.find(s => norm(n).includes(norm(s).replace('썸', '')) || norm(s).includes(norm(n))) || n;
  const idx = new Map();
  for (const g of games) {
    const day = String(g.gameDate || g.gameDateTime || '').slice(0, 10);
    idx.set(key(day, short(g.homeTeamName), short(g.awayTeamName)), g);
  }
  return events.map(e => {
    const day = isoDay(new Date(Date.parse(e.start) + KST_OFFSET));
    const g = idx.get(key(day, e.home.name, e.away.name)); if (!g || !g.gameDateTime) return e;
    const dt = Date.parse(g.gameDateTime + '+09:00'); if (!Number.isFinite(dt)) return e;
    const homeIsFirst = short(g.homeTeamName) === e.home.name;
    const out = Object.assign({}, e, { start: utcIso(dt), time_tbd: false, ha_unknown: false, venue: g.stadium || e.venue });
    if (!homeIsFirst) { out.home = e.away; out.away = e.home; out.home_score = e.away_score; out.away_score = e.home_score; }
    return out;
  });
}

/* ───────── LoL (esports-api.lolesports.com) ───────── */
const LOL = 'https://esports-api.lolesports.com/persisted/gw';
const LOL_H = { 'x-api-key': '0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z' };
const LOL_COLORS = { T1: '#E2012D', GEN: '#AA8B56', HLE: '#F37321', KT: '#FF0A07', DK: '#1AB5B5', NS: '#DE2027', BFX: '#F5D000', DRX: '#5A8DFF', KRX: '#E3002B', DNS: '#2E6BF0', BRO: '#00A651', FOX: '#E8432E', DNF: '#4C6EF5' };
async function lolLeagueIds(cli, ctx) {
  if (ctx.cache.lolLeagues && ctx.now.getTime() - ctx.cache.lolLeagues.t < 7 * 86400e3) return ctx.cache.lolLeagues.ids;
  const j = await cli.json(`${LOL}/getLeagues?hl=ko-KR`, { headers: LOL_H });
  const ids = Object.fromEntries((((j.data || {}).leagues) || []).map(l => [l.slug, l.id]));
  ctx.cache.lolLeagues = { t: ctx.now.getTime(), ids };
  return ids;
}
function parseLolEvent(comp, e) {
  if (e.type !== 'match' || !e.match) return null;
  const t = e.match.teams || []; if (t.length !== 2) return null;
  const st = e.state === 'completed' ? 'final' : e.state === 'inProgress' ? 'live' : 'scheduled';
  const T = x => team(`lol:${x.code || x.name}`, x.name, { short: x.code || '', color: LOL_COLORS[x.code] || undefined });
  const w = x => (x.result || {}).gameWins;
  const bo = ((e.match.strategy || {}).count) || null;
  const rec = x => x.record ? [toInt(x.record.wins), toInt(x.record.losses)] : null;
  return ev(comp.id, e.match.id, e.startTime, false, T(t[0]), T(t[1]), toInt(w(t[0])), toInt(w(t[1])), st,
    { round: e.blockName || '', ha_unknown: true, bo, league_name: (e.league || {}).name || '', home_rec: rec(t[0]), away_rec: rec(t[1]) });
}
async function fetchLol(cli, comp, ctx) {
  const ids = await lolLeagueIds(cli, ctx); const id = ids[comp.slug];
  if (!id) return { events: [], standings: null, offseason: true, season: '', full: true };
  const raw = []; let token = null; const seen = new Set(); const cutoff = ctx.now.getTime() - (ctx.prevState?.lastFull ? 21 : 200) * 86400e3;
  for (let i = 0; i < 6; i++) {
    const j = await cli.json(`${LOL}/getSchedule?hl=ko-KR&leagueId=${id}${token ? `&pageToken=${encodeURIComponent(token)}` : ''}`, { headers: LOL_H });
    const s = (j.data || {}).schedule || {}; const evs = s.events || []; raw.push(...evs);
    const oldest = Math.min(...evs.map(e => Date.parse(e.startTime)).filter(Number.isFinite));
    token = (s.pages || {}).older;
    if (!token || seen.has(token) || !(oldest > cutoff)) break; seen.add(token);
  }
  let events = raw.map(e => parseLolEvent(comp, e)).filter(Boolean);
  if (comp.id !== 'lck') { // 한국 팀(LCK 팀 또는 국가대표) 경기만
    const lck = new Set(ctx.lckTeams || []);
    events = events.filter(e => lck.has(e.home.id) || lck.has(e.away.id) || /korea|대한민국|한국/i.test(e.home.name + e.away.name));
  }
  const future = events.some(e => Date.parse(e.start) > ctx.now.getTime());
  const recent = events.some(e => Date.parse(e.start) > ctx.now.getTime() - 30 * 86400e3);
  let standings = null;
  if (comp.id === 'lck') standings = lolStandings(events);
  return { events, standings, offseason: !future && !recent, season: '', full: true };
}
// LCK 순위: 가장 최근 정규 시즌 경기들(플레이오프·결승 제외)의 승패·세트 득실로 계산
function lolStandings(events) {
  const reg = events.filter(e => e.status === 'final' && !/플레이오프|결승|플레이-인|선발전|playoff|final/i.test(e.round));
  if (!reg.length) return null;
  const lastYear = new Date(Math.max(...reg.map(e => Date.parse(e.start)))).getUTCFullYear();
  const latest = reg.filter(e => new Date(e.start).getUTCFullYear() === lastYear);
  // 같은 해 안에서도 마지막 정규 구간(경기 사이 공백 21일 이상으로 구분)
  latest.sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  let startIdx = 0; for (let i = 1; i < latest.length; i++) if (Date.parse(latest[i].start) - Date.parse(latest[i - 1].start) > 21 * 86400e3) startIdx = i;
  const seg = latest.slice(startIdx); const m = new Map();
  const r = (t) => { if (!m.has(t.id)) m.set(t.id, { team: t, w: 0, l: 0, sw: 0, sl: 0, rec: null }); return m.get(t.id); };
  for (const e of seg) {
    const h = r(e.home), a = r(e.away), hs = e.home_score || 0, as = e.away_score || 0;
    h.sw += hs; h.sl += as; a.sw += as; a.sl += hs;
    if (hs > as) { h.w++; a.l++; } else if (as > hs) { a.w++; h.l++; }
    if (e.home_rec) h.rec = e.home_rec; if (e.away_rec) a.rec = e.away_rec; // API가 주는 누적 전적이 있으면 그걸 우선
  }
  for (const x of m.values()) if (x.rec && x.rec[0] !== null && x.rec[0] + x.rec[1] >= x.w + x.l) { x.w = x.rec[0]; x.l = x.rec[1]; }
  const rows = [...m.values()].sort((x, y) => (y.w - x.w) || ((y.sw - y.sl) - (x.sw - x.sl)))
    .map((x, i) => row(x.team.id, x.team.name, i + 1, { w: x.w, l: x.l, pct: x.w + x.l ? Math.round(x.w / (x.w + x.l) * 1000) / 1000 : null, gf: x.sw, ga: x.sl, gd: x.sw - x.sl }));
  return standingsOf(rows, lastYear, '전체');
}

/* ───────── 팀 목록 (첫 실행 때 팀 고르기용, 가볍게) ───────── */
async function rosterOne(cli, comp, ctx) {
  const T = (id, name, short, color, color2) => ({ id, name, short: short || '', color: color || null, color2: color2 || null });
  if (comp.src === 'espn') {
    const j = await cli.json(`${ESPN}/${comp.path}/teams?limit=200`);
    const list = (((j.sports || [])[0] || {}).leagues || [])[0] || {};
    const out = (list.teams || []).map(x => x.team || x).filter(t => t && t.id && !JUNK.test(t.displayName || ''))
      .map(t => T(espnTeamId(comp, t), t.displayName || t.name, t.abbreviation, t.color ? '#' + t.color : null, t.alternateColor ? '#' + t.alternateColor : null));
    // ESPN 팀 목록에는 하부·해체 팀이 섞일 수 있어 순위표에 있는 팀으로 좁힌다(순위표가 있으면)
    try {
      const st = parseEspnStandings(comp, await cli.json(`${ESPN_ST}/${comp.path}/standings`));
      const ids = new Set(st.groups.flatMap(g => g.rows.map(r => r.team_id)));
      if (ids.size >= 4) return out.filter(t => ids.has(t.id));
    } catch (e) { /* 순위표 없으면 전체 */ }
    return out;
  }
  if (comp.src === 'lol') {
    const r = await fetchLol(cli, comp, Object.assign({}, ctx, { prevState: null }));
    const last = r.events.map(e => Date.parse(e.start)).sort((a, b) => b - a)[0] || 0;
    const m = new Map();
    for (const e of r.events) if (Date.parse(e.start) > last - 200 * 86400e3) for (const t of [e.home, e.away]) m.set(t.id, T(t.id, t.name, t.short, t.color));
    return [...m.values()];
  }
  const r = await FETCHERS[comp.src](cli, comp, Object.assign({}, ctx, { prevState: { lastFull: 1 }, rosterOnly: true }));
  const m = new Map();
  for (const g of (r.standings || {}).groups || []) for (const x of g.rows) m.set(x.team_id, T(x.team_id, x.name, x.name));
  if (!m.size) for (const e of r.events) for (const t of [e.home, e.away]) m.set(t.id, T(t.id, t.name, t.short));
  return [...m.values()];
}
async function roster(opts) {
  const cli = makeClient(opts.http, 0); const ctx = { now: opts.now || new Date(), cache: {} };
  const out = {};
  await Promise.all((opts.comps || []).map(async id => {
    const comp = BY_ID[id]; if (!comp || comp.kind !== 'league') return;
    try { out[id] = { ok: true, teams: await rosterOne(cli, comp, ctx) }; } catch (e) { out[id] = { ok: false, error: String(e && e.message || e), teams: [] }; }
  }));
  return out;
}

/* ───────── 실행 ───────── */
const FETCHERS = { espn: fetchEspn, kbo: fetchKbo, kleague: fetchKleague, kbl: fetchKbl, wkbl: fetchWkbl, kovo: fetchKovo, lol: fetchLol };

// 공식 출처가 실패하거나 시즌 중인데 0경기면 네이버로 대체
async function withNaverFallback(cli, comp, ctx, primary) {
  try {
    const r = await primary();
    if (NAVER_CAT[comp.id] && !r.offseason && !r.events.length) throw new SourceError('시즌 중인데 경기가 없음');
    return Object.assign(r, { source: 'official' });
  } catch (e) {
    if (!NAVER_CAT[comp.id]) throw e;
    const known = ctx.knownTeams || {};
    const byName = n => { const k = Object.entries(known).find(([id, t]) => t.comp === comp.id && (t.name === n || String(n).includes(t.name) || String(t.name).includes(n))); return k ? k[0] : null; };
    const games = await naverGames(cli, comp, addDays(ctx.now, -14), addDays(ctx.now, 150));
    const events = games.map(g => parseNaverGame(comp, g, byName)).filter(Boolean);
    if (!events.length) throw e;
    return { events, standings: null, offseason: false, season: '', full: true, source: 'naver', fallbackReason: String(e.message || e) };
  }
}

async function collect(opts) {
  const { http, now = new Date(), state = {}, onProgress } = opts;
  const cli = makeClient(http, opts.delayMs ?? 150);
  const wanted = new Set(opts.comps || []);
  // 고른 리그 + 그 리그에 딸린 컵·국제대회
  const leagues = COMPETITIONS.filter(c => c.kind === 'league' && wanted.has(c.id));
  const cups = COMPETITIONS.filter(c => c.kind === 'cup' && (c.parents || []).some(p => wanted.has(p)));
  const targets = [...leagues, ...cups];
  const out = { version: VERSION, comps: {}, state: Object.assign({}, state, { cache: Object.assign({}, state.cache) }) };
  const ctxBase = { now, cache: out.state.cache, knownTeams: opts.knownTeams || {} };
  let done = 0;
  const teamsOf = new Set(); // 고른 리그의 팀 (컵대회 경기 거르기용)
  for (const comp of targets) {
    onProgress && onProgress({ comp: comp.id, done, total: targets.length });
    const ctx = Object.assign({}, ctxBase, { prevState: (state.comps || {})[comp.id] });
    if (comp.id !== 'lck' && comp.src === 'lol') ctx.lckTeams = [...teamsOf].filter(id => id.startsWith('lol:')).concat(opts.lckTeams || []);
    try {
      const fetcher = FETCHERS[comp.src];
      const r = await withNaverFallback(cli, comp, ctx, () => fetcher(cli, comp, ctx));
      if (comp.kind === 'league') {
        for (const e of r.events) { teamsOf.add(e.home.id); teamsOf.add(e.away.id); }
        for (const g of (r.standings || {}).groups || []) for (const x of g.rows) teamsOf.add(x.team_id);
      } else if (comp.sport === 'soccer') {
        const known = new Set([...teamsOf, ...Object.keys(opts.knownTeams || {})]);
        r.events = r.events.filter(e => known.has(e.home.id) || known.has(e.away.id));
      }
      if (!r.window && r.events.length) { const ds = r.events.map(e => e.start.slice(0, 10)).sort(); r.window = [ds[0], ds[ds.length - 1]]; }
      out.comps[comp.id] = Object.assign({ ok: true, error: ctx.standingsError || null }, r);
      out.state.comps = Object.assign({}, out.state.comps, { [comp.id]: { lastFull: r.full ? now.getTime() : (ctx.prevState || {}).lastFull, season: r.season, lastOk: now.getTime() } });
    } catch (e) {
      out.comps[comp.id] = { ok: false, error: String(e && e.message || e), events: [], standings: null };
    }
    done++;
  }
  onProgress && onProgress({ done, total: targets.length });
  return out;
}

const API = { VERSION, API_LEVEL: 2, COMPETITIONS, BY_ID, collect, roster, ROUND_KO,
  _test: { parseEspnEvent, parseEspnStandings, espnRange, parseKboSchedule, parseKboRank, parseKleagueSchedule, parseKleagueRank, parseKblSchedule, parseKblRank,
    wkblSeasons, parseWkblSchedule, parseWkblRank, parseKovoSchedule, parseKovoRank, parseLolEvent, lolStandings, parseNaverGame, enrichFromNaver, kstIso, monthsBetween } };
root.MVCollector = API;
if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
