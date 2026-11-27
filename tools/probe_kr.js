const UA = { 'User-Agent': 'Mozilla/5.0' };
(async () => {
  for (const d of ['20260910', '20261125', '20261126', '20261225', '20261129']) {
    const r = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${d}`, { headers: UA }); const j = await r.json();
    for (const e of j.events || []) { const c = e.competitions[0];
      console.log('NFL', d, e.id, e.shortName, '| broadcasts', JSON.stringify((c.broadcasts || []).map(b => b.names)), '| geo', JSON.stringify((c.geoBroadcasts || []).map(g => [g.type && g.type.shortName, g.market && g.market.type, g.media && g.media.shortName]))); }
  }
})();
