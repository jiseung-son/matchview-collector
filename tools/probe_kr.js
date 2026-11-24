const UA = { 'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36' };
const get = async (u, o = {}) => { try { const r = await fetch(u, { ...o, headers: { ...UA, ...(o.headers || {}) } }); return { s: r.status, t: await r.text() }; } catch (e) { return { s: 'ERR ' + e.message, t: '' }; } };
const clean = s => s.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/\s+/g, ' ');
(async () => {
  const main = clean((await get('https://www.wkbl.or.kr/main/main.asp')).t);
  const sl = main.slice(main.indexOf('game_slider'), main.indexOf('</ul>', main.indexOf('game_slider')));
  const items = sl.split('<li').slice(1);
  console.log('MAIN items', items.length);
  for (const it of items) { const d = (/data-kr="(\d{4}\.\d{2}\.\d{2})/.exec(it) || [])[1], t = (/class="time">([^<]*)</.exec(it) || [])[1], v = (/class="bar"><\/span> <span data-kr="([^"]+)"/.exec(it) || [])[1], n = [...it.matchAll(/class="name eli">([^<]+)</g)].map(m => m[1]); const lk = (/href="([^"]*)"/.exec(it) || [])[1]; console.log(' ', d, t, v, n.join(' vs '), lk || ''); }
  console.log('MAINRAW', items[0] ? items[0].slice(0, 1400) : '');
  for (const ym of ['202611', '202612']) {
    const m = clean((await get(`https://www.wkbl.or.kr/m/game/schedule.asp?ym=${ym}`)).t);
    const lis = m.split('<li> <a href="/m/game/result.asp').slice(1).concat(m.split('<li>').filter(x => /date_block/.test(x) && !/result\.asp/.test(x)));
    const fut = m.split('<li').filter(x => /date_block/.test(x) && !/<em>\d+<\/em>/.test(x));
    console.log('MLIST', ym, 'future items', fut.length, fut[0] ? fut[0].slice(0, 900) : '');
  }
})();
