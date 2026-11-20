// 실제 사이트로 수집 코드를 돌려 보는 점검 도구. GitHub Actions에서 매주 실행된다.
// 해외(미국) 서버라서 네이버 대체 경로는 동작하지 않는 것이 정상이다.
const C = require('../collector.js');
const http = async ({ url, method, headers, body, timeout }) => {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeout || 30000);
  try {
    const r = await fetch(url, { method, headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36', ...headers }, body, signal: ctl.signal });
    return { status: r.status, text: await r.text() };
  } finally { clearTimeout(t); }
};
(async () => {
  const leagues = C.COMPETITIONS.filter(c => c.kind === 'league').map(c => c.id);
  const t0 = Date.now(); let reqs = 0;
  const out = await C.collect({ http: async r => { reqs++; return http(r); }, comps: leagues, now: new Date(), delayMs: 100 });
  const rows = Object.entries(out.comps).map(([id, r]) => {
    const st = r.standings ? r.standings.groups.reduce((n, g) => n + g.rows.length, 0) : 0;
    const next = r.events.filter(e => Date.parse(e.start) > Date.now()).sort((a, b) => a.start.localeCompare(b.start))[0];
    return { id, ok: r.ok, events: r.events.length, standings: st, offseason: !!r.offseason, source: r.source || '', error: r.error || '', next: next ? `${next.start} ${next.home.name} vs ${next.away.name}` : '' };
  });
  console.table(rows);
  console.log(`요청 ${reqs}회, ${Math.round((Date.now() - t0) / 1000)}초`);
  const sample = {};
  for (const [id, r] of Object.entries(out.comps)) sample[id] = { events: r.events.slice(0, 2), standings: r.standings ? { season: r.standings.season, groups: r.standings.groups.map(g => ({ name: g.name, rows: g.rows.slice(0, 2) })) } : null };
  require('fs').writeFileSync('sample.json', JSON.stringify(sample, null, 1));
  const broken = rows.filter(r => !r.ok && C.BY_ID[r.id].kind === 'league');
  if (broken.length) { console.error('고장난 리그:', broken.map(r => `${r.id}(${r.error})`).join(', ')); process.exitCode = 1; }
})();
