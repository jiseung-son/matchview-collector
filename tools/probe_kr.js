const C = require('../collector.js');
const http = async (req) => { const r = await fetch(req.url, { method: req.method || 'GET', headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile', ...(req.headers || {}) }, body: req.body }); return { status: r.status, body: await r.text() }; };
(async () => {
  const out = await C.collect({ http, comps: ['wkbl'], state: {}, now: new Date() });
  const r = out.results ? out.results.wkbl : (out.comps || out).wkbl;
  console.log('KEYS', Object.keys(out).join(','), JSON.stringify(Object.keys(r || {})));
  const evs = (r && r.events) || [];
  console.log('WKBL ok', r && r.ok, 'events', evs.length, 'error', r && r.error);
  const fut = evs.filter(e => e.status === 'scheduled'); const tbd = fut.filter(e => e.time_tbd || e.tbd);
  console.log('future', fut.length, 'future without time', tbd.length, 'ha_unknown', evs.filter(e => e.ha_unknown).length);
  for (const e of fut.slice(0, 8)) console.log(' ', e.start || e.date, e.home.name, 'vs', e.away.name, e.venue);
})().catch(e => console.log('ERR', e.stack));
