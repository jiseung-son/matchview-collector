const UA = { 'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36' };
const get = async (u) => { try { const r = await fetch(u, { headers: UA }); return { s: r.status, t: await r.text() }; } catch (e) { return { s: 'ERR', t: '' }; } };
const HOME = { '아산': '우리은행', '용인': '삼성생명', '인천': '신한은행', '부천': '하나은행', '부산': 'BNK 썸', '청주': 'KB스타즈' };
(async () => {
  const m = (await get('https://www.wkbl.or.kr/m/game/schedule.asp?sch_ym=202611')).t.replace(/\s+/g, ' ');
  const lis = m.split('<li>').filter(x => /date_block/.test(x));
  let ok = 0, bad = 0;
  for (const li of lis) {
    const no = (/game_no=(\d+)/.exec(li) || [])[1]; const names = [...li.matchAll(/class="team_name">([^<]+)</g)].map(x => x[1]);
    if (!no) { const pl = (/class="place_block">.*?<span>([^<]+)<br \/>(\d\d:\d\d)/.exec(li) || []); console.log('FUT', names.join(' vs '), pl[1], pl[2], '→ 홈(경기장)', HOME[(pl[1] || '').trim()]); continue; }
    const r = (await get(`https://www.wkbl.or.kr/game/result.asp?season_gu=047&gun=1&game_type=01&game_no=${no}&ym=202611&viewType=2`)).t.replace(/\s+/g, ' ');
    const venue = (/<p class="info_game">.*?<span>(\d\d:\d\d)<\/span> <span class="language" data-kr="([^"]+)"/.exec(r) || []);
    const v = venue[2] || ''; const homeByVenue = Object.entries(HOME).find(([k]) => v.includes(k))?.[1];
    const sides = [...r.matchAll(/class="info_team (home|away)">.*?data-kr="([^"]+)"/g)].map(x => x[1] + ':' + x[2]).slice(0, 2);
    const same = homeByVenue === names[0]; same ? ok++ : bad++;
    console.log('GAME', no, names.join(' vs '), '| time', venue[1], '| venue', v, '| 홈(경기장)', homeByVenue, '| 결과페이지', sides.join(' '), same ? 'OK 첫팀=홈' : 'DIFF');
  }
  console.log('SUMMARY first-listed=home by venue:', ok, 'ok,', bad, 'diff');
})();
