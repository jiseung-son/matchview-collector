// 국내 리그 경기 상세(라인업·기록) 출처 조사용 일회성 스크립트
const UA = { 'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36' };
const get = async (u, h = {}) => { try { const r = await fetch(u, { headers: { ...UA, ...h } }); const t = await r.text(); return { s: r.status, t }; } catch (e) { return { s: 'ERR ' + e.message, t: '' }; } };
const keys = (t) => { try { const j = JSON.parse(t); const walk = (o, d = 0) => o && typeof o === 'object' && d < 2 ? Object.keys(o).slice(0, 14).map(k => k + (typeof o[k] === 'object' && o[k] ? '{' + walk(o[k], d + 1) + '}' : '')).join(',') : ''; return walk(j); } catch { return 'non-json ' + t.slice(0, 120).replace(/\s+/g, ' '); } };
const line = (name, r) => console.log(`${name} | ${r.s} | ${keys(r.t).slice(0, 600)}`);
(async () => {
  // 1) ESPN: K리그1(kor.1)·KBO
  for (const sl of ['soccer/kor.1', 'baseball/kbo', 'basketball/kbl']) {
    const sb = await get(`https://site.api.espn.com/apis/site/v2/sports/${sl}/scoreboard?dates=20261101-20261122`); line('ESPN ' + sl + ' scoreboard', sb);
    try { const evs = JSON.parse(sb.t).events || []; const done = evs.filter(e => e.status?.type?.completed); console.log('  events', evs.length, 'completed', done.length);
      if (done[0]) { const s = await get(`https://site.api.espn.com/apis/site/v2/sports/${sl}/summary?event=${done.at(-1).id}`); line('  summary ' + done.at(-1).id, s);
        try { const j = JSON.parse(s.t); for (const r of j.rosters || []) console.log('  roster', r.homeAway, r.formation, (r.roster || []).filter(x => x.starter).map(x => `${x.formationPlace}:${x.position?.abbreviation}:${x.athlete?.shortName}`).join(' ')); console.log('  keyEvents', (j.keyEvents || []).length, 'commentary', (j.commentary || []).length, 'boxscore teams stats', (j.boxscore?.teams?.[0]?.statistics || []).length); } catch {} } } catch {}
  }
  // 2) 네이버 (국내 IP만 응답할 수 있음)
  const nv = await get('https://api-gw.sports.naver.com/schedule/games?fields=basic&upperCategoryId=kfootball&fromDate=2026-11-01&toDate=2026-11-22&size=50', { Referer: 'https://m.sports.naver.com/' }); line('NAVER schedule', nv);
  // 3) LoL e스포츠 (LCK)
  const LH = { 'x-api-key': '0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z' };
  const sch = await get('https://esports-api.lolesports.com/persisted/gw/getSchedule?hl=ko-KR&leagueId=98767991310872058', LH); line('LOL schedule', sch);
  try { const ev = (JSON.parse(sch.t).data.schedule.events || []).filter(e => e.state === 'completed' && e.match).at(-1);
    if (ev) { const d = await get(`https://esports-api.lolesports.com/persisted/gw/getEventDetails?hl=ko-KR&id=${ev.match.id}`, LH); line('LOL eventDetails', d);
      const gid = (JSON.parse(d.t).data.event.match.games || []).find(g => g.state === 'completed')?.id; console.log('  gameId', gid);
      if (gid) { const w = await get(`https://feed.lolesports.com/livestats/v1/window/${gid}`); line('LOL livestats window', w); const dt = await get(`https://feed.lolesports.com/livestats/v1/details/${gid}`); line('LOL livestats details', dt); } } } catch (e) { console.log('LOL err', e.message); }
  // 4) 공식 사이트 첫 화면 응답 여부 (해외에서 열리는지)
  for (const u of ['https://www.koreabaseball.com/Schedule/GameCenter/Main.aspx', 'https://www.kleague.com/match.do', 'https://data.kleague.com/', 'https://api.kbl.or.kr/match/list?fromDate=20261101&toDate=20261122', 'https://www.wkbl.or.kr/game/result.asp', 'https://kovo.co.kr/'])
    { const r = await get(u); console.log(`SITE ${u} | ${r.s} | ${r.t.length}B`); }
})();
