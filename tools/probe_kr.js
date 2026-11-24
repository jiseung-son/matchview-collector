// 일회성 조사: WKBL 공식 사이트에서 경기 시각·홈/원정 찾기
const UA = { 'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36' };
const get = async (u, o = {}) => { try { const r = await fetch(u, { ...o, headers: { ...UA, ...(o.headers || {}) } }); return { s: r.status, t: await r.text() }; } catch (e) { return { s: 'ERR ' + e.message, t: '' }; } };
const clean = s => s.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/\s+/g, ' ');
(async () => {
  const sch = await get('https://www.wkbl.or.kr/game/sch/schedule1.asp?ym=202611&gun=1');
  console.log('SCHEDULE1', sch.s, sch.t.length);
  const blk = sch.t.split('<div class="info_game">')[1] || ''; console.log('BLOCK', clean(blk.slice(0, 1500)));
  const hrefs = [...new Set([...sch.t.matchAll(/(?:href|location\.href)\s*=\s*["']([^"']*(?:game|sch|result|record)[^"']*)["']/gi)].map(m => m[1]))]; console.log('HREFS', hrefs.slice(0, 40).join('\n  '));
  const onclick = [...new Set([...sch.t.matchAll(/onclick="([^"]{0,160})"/gi)].map(m => m[1]))]; console.log('ONCLICK', onclick.slice(0, 15).join('\n  '));
  const times = [...new Set([...clean(sch.t).matchAll(/\d{1,2}:\d{2}/g)].map(m => m[0]))]; console.log('TIMES in schedule1', times.slice(0, 20).join(' '));
  for (const u of ['https://www.wkbl.or.kr/game/sch/schedule2.asp?ym=202611&gun=1', 'https://www.wkbl.or.kr/game/sch/schedule3.asp', 'https://www.wkbl.or.kr/game/sch/schedule.asp', 'https://www.wkbl.or.kr/main/main.asp', 'https://www.wkbl.or.kr/', 'https://m.wkbl.or.kr/', 'https://www.wkbl.or.kr/game/result.asp']) {
    const r = await get(u); const c = clean(r.t);
    const t = [...new Set([...c.matchAll(/\d{1,2}:\d{2}/g)].map(m => m[0]))];
    console.log('PAGE', u, r.s, r.t.length, 'times:', t.slice(0, 12).join(' '));
    const i = c.search(/\d{2}:\d{2}/); if (i > 0) console.log('   ctx:', c.slice(Math.max(0, i - 400), i + 300));
  }
  const gl = hrefs.find(h => /game_no=/.test(h)); if (gl) { const u = new URL(gl.replace(/&amp;/g, '&'), 'https://www.wkbl.or.kr/game/sch/'); const r = await get(u.href); const c = clean(r.t); console.log('GAMEPAGE', u.href, r.s, r.t.length); const i = c.search(/\d{2}:\d{2}/); console.log('   ctx:', c.slice(Math.max(0, i - 500), i + 500)); }
})();
