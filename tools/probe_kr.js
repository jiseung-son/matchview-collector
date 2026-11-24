const UA = { 'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36' };
const get = async (u, o = {}) => { try { const r = await fetch(u, { ...o, headers: { ...UA, ...(o.headers || {}) } }); return { s: r.status, t: await r.text() }; } catch (e) { return { s: 'ERR ' + e.message, t: '' }; } };
const clean = s => s.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/\s+/g, ' ');
(async () => {
  for (const u of ['https://www.wkbl.or.kr/m/game/schedule.asp', 'https://www.wkbl.or.kr/m/game/schedule.asp?ym=202612', 'https://www.wkbl.or.kr/m/game/schedule.asp?season_gu=047&ym=202612&gun=1']) {
    const r = await get(u); const c = clean(r.t); console.log('MSCHED', u, r.s, r.t.length);
    const i = c.indexOf('202'); const j = c.search(/class="[^"]*(game|sch|list)[^"]*"/); console.log('  body:', c.slice(Math.max(0, j), j + 2500));
    console.log('  forms:', [...r.t.matchAll(/<(select|input)[^>]*name="([^"]+)"/g)].map(m => m[2]).join(','), ' ajax:', [...new Set([...r.t.matchAll(/["']([^"']*ajax[^"']*)["']/g)].map(m => m[1]))].join(' '));
  }
  const g = await get('https://www.wkbl.or.kr/game/result.asp?season_gu=047&gun=1&game_type=01&game_no=20&ym=202611&viewType=2');
  const c = clean(g.t); const k = c.indexOf('result_'); const v = c.search(/(경기장|장소|체육관|Stadium)/);
  console.log('RESULT game20', g.s, ' venue ctx:', c.slice(Math.max(0, v - 600), v + 400));
  console.log('  ajax:', [...new Set([...g.t.matchAll(/["']([^"']*ajax[^"']*)["']/g)].map(m => m[1]))].join(' '));
})();
