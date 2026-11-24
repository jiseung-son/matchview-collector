const UA = { 'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36' };
const get = async (u, o = {}) => { try { const r = await fetch(u, { ...o, headers: { ...UA, ...(o.headers || {}) } }); return { s: r.status, t: await r.text() }; } catch (e) { return { s: 'ERR ' + e.message, t: '' }; } };
(async () => {
  const p = await get('https://www.wkbl.or.kr/m/game/schedule.asp');
  const i = p.t.indexOf('goScedule'); let k = p.t.indexOf('function goScedule'); console.log('INLINE', k, k >= 0 ? p.t.slice(k, k + 500) : '');
  const forms = [...p.t.matchAll(/<form[\s\S]*?<\/form>/g)].map(m => m[0].replace(/\s+/g, ' ').slice(0, 600)); console.log('FORMS', forms.join('\n'));
  const srcs = [...p.t.matchAll(/<script[^>]*src="([^"]+)"/g)].map(m => m[1]); console.log('SRCS', srcs.join(' '));
  for (const s of srcs) { const r = await get(new URL(s, 'https://www.wkbl.or.kr/m/game/').href); const j = r.t.indexOf('goScedule'); if (j >= 0) console.log('FOUND in', s, r.t.slice(Math.max(0, j - 50), j + 500)); }
  const cnt = t => (t.match(/class="date">(\d\d)\./g) || []).slice(0, 3).join(',');
  for (const q of ['?gym=202612', '?sch_ym=202612', '?yyyymm=202612', '?s_ym=202612', '?ymd=202612', '?date=202612', '?month=202612', '?search_ym=202612']) { const r = await get('https://www.wkbl.or.kr/m/game/schedule.asp' + q); console.log('TRY', q, cnt(r.t)); }
  const r = await get('https://www.wkbl.or.kr/m/game/schedule.asp', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'ym=202612' }); console.log('POST ym', cnt(r.t));
})();
