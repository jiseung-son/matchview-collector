const C = require('../collector.js');
const http = async ({ url, method, headers, body }) => { const r = await fetch(url, { method, headers: { 'User-Agent': 'Mozilla/5.0', ...headers }, body }); return { status: r.status, text: await r.text() }; };
(async () => {
  const out = await C.collect({ http, comps: ['nfl'], now: new Date() });
  const r = out.comps.nfl; console.log('NFLOK', r.ok, r.events.length, r.error || '');
  const nf = r.events.filter(e => (e.net || []).includes('Netflix'));
  for (const e of nf) console.log('NETFLIX', e.id, e.start, e.away.name, '@', e.home.name, JSON.stringify(e.net));
  console.log('WITHNET', r.events.filter(e => e.net && e.net.length).length, 'of', r.events.length);
})().catch(e => console.log('ERR', e.stack));
