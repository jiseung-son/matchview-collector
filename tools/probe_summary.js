// 종목별 ESPN 경기 상세(summary) 샘플을 받아 o/ 에 저장 (임시 점검용)
const fs = require('fs'); fs.mkdirSync('o', { recursive: true });
const S = 'https://site.api.espn.com/apis/site/v2/sports';
const j = async u => { const r = await fetch(u); if (r.status !== 200) throw new Error(r.status + ' ' + u); return r.json(); };
const L = [['soccer/eng.1', ['20261108', '20261109', '20261101']], ['basketball/nba', ['20261118', '20261117']], ['baseball/mlb', ['20261031', '20261030', '20261028']],
  ['football/nfl', ['20261116', '20261115']], ['hockey/nhl', ['20261118', '20261117']], ['soccer/uefa.champions', ['20261105', '20261104']]];
(async () => {
  for (const [p, days] of L) {
    for (const d of days) {
      try {
        const sb = await j(`${S}/${p}/scoreboard?dates=${d}`);
        const ev = (sb.events || []).find(e => e.status?.type?.completed); if (!ev) continue;
        const sm = await j(`${S}/${p}/summary?event=${ev.id}`);
        const name = p.replace('/', '_'); fs.writeFileSync(`o/${name}.json`, JSON.stringify(sm));
        console.log(name, ev.id, ev.name, Object.keys(sm).join(','));
        break;
      } catch (e) { console.log('ERR', p, d, e.message); }
    }
  }
})();
