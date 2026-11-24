const UA = { 'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36' };
const get = async (u, o = {}) => { try { const r = await fetch(u, { ...o, headers: { ...UA, ...(o.headers || {}) } }); return { s: r.status, t: await r.text() }; } catch (e) { return { s: 'ERR ' + e.message, t: '' }; } };
const clean = s => s.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/\s+/g, ' ');
(async () => {
  const m = await get('https://www.wkbl.or.kr/m/game/schedule.asp'); const c = clean(m.t);
  const i = c.indexOf('schedule_head'); console.log('MBODY', c.slice(i, i + 3500));
  const f = c.indexOf('function goScedule'); console.log('MFUNC', c.slice(f, f + 600));
  for (const no of [30, 45, 60]) { const g = await get(`https://www.wkbl.or.kr/game/result.asp?season_gu=047&gun=1&game_type=01&game_no=${no}&ym=202612&viewType=2`); const k = clean(g.t); const j = k.indexOf('board_score'); console.log('FUTURE', no, g.s, k.slice(j, j + 900)); }
})();
