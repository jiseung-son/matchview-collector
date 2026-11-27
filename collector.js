/* matchview-collector — 매치뷰 앱이 폰 안에서 실행하는 수집 코드.
 * 앱은 시작할 때 이 파일의 최신 버전을 받아 쓰고, 실패하면 앱에 들어 있는 사본을 쓴다.
 * 네트워크 요청은 앱이 넘겨주는 http() 로만 한다(CORS를 피하려고 앱의 네이티브 기능을 씀).
 *
 *   const out = await MVCollector.collect({ http, comps: ['epl','kbo','lck'], state, now });
 *
 * 결과: { version, comps: {id: {ok, events, standings, error, offseason, season, source}}, state }
 */
(function (root) {
'use strict';
const VERSION = '2.4.0';

/* ───────── 대회 설정 ───────── */
// kind: league(사용자가 고르는 리그) | cup(부모 리그 팀이 나오는 대회, 자동 포함)
const C = (id, name, extra) => Object.assign({ id, name }, extra);
const SOCCER5 = ['epl', 'laliga', 'seriea', 'bundesliga', 'ligue1'];
const COMPETITIONS = [
  C('epl', '프리미어리그', { kind: 'league', sport: 'soccer', group: '유럽 축구', country: '잉글랜드', src: 'espn', path: 'soccer/eng.1', color: '#3D195B' }),
  C('laliga', '라리가', { kind: 'league', sport: 'soccer', group: '유럽 축구', country: '스페인', src: 'espn', path: 'soccer/esp.1', color: '#EE8707' }),
  C('seriea', '세리에 A', { kind: 'league', sport: 'soccer', group: '유럽 축구', country: '이탈리아', src: 'espn', path: 'soccer/ita.1', color: '#008FD7' }),
  C('bundesliga', '분데스리가', { kind: 'league', sport: 'soccer', group: '유럽 축구', country: '독일', src: 'espn', path: 'soccer/ger.1', color: '#D20515' }),
  C('ligue1', '리그 1', { kind: 'league', sport: 'soccer', group: '유럽 축구', country: '프랑스', src: 'espn', path: 'soccer/fra.1', color: '#4F6BD8' }),
  C('nfl', 'NFL', { kind: 'league', sport: 'football', group: '미국 프로스포츠', country: '미국', src: 'espn', path: 'football/nfl', color: '#013369' }),
  C('nba', 'NBA', { kind: 'league', sport: 'basketball', group: '미국 프로스포츠', country: '미국', src: 'espn', path: 'basketball/nba', color: '#C9082A' }),
  C('mlb', 'MLB', { kind: 'league', sport: 'baseball', group: '미국 프로스포츠', country: '미국', src: 'espn', path: 'baseball/mlb', color: '#041E42' }),
  C('nhl', 'NHL', { kind: 'league', sport: 'hockey', group: '미국 프로스포츠', country: '미국', src: 'espn', path: 'hockey/nhl', color: '#5A6A7A' }),
  C('mls', 'MLS', { kind: 'league', sport: 'soccer', group: '미국 프로스포츠', country: '미국', src: 'espn', path: 'soccer/usa.1', color: '#0B2240' }),
  C('kbo', 'KBO 리그', { kind: 'league', sport: 'baseball', group: '국내 프로스포츠', country: '대한민국', src: 'kbo', color: '#0D2C6C' }),
  C('kleague1', 'K리그1', { kind: 'league', sport: 'soccer', group: '국내 프로스포츠', country: '대한민국', src: 'kleague', color: '#00377A' }),
  C('kbl', 'KBL', { kind: 'league', sport: 'basketball', group: '국내 프로스포츠', country: '대한민국', src: 'kbl', color: '#E5352B' }),
  C('wkbl', 'WKBL', { kind: 'league', sport: 'basketball', group: '국내 프로스포츠', country: '대한민국', src: 'wkbl', color: '#E4007F' }),
  C('vleague_m', 'V리그 남자부', { kind: 'league', sport: 'volleyball', group: '국내 프로스포츠', country: '대한민국', src: 'kovo', gender: '1', color: '#1B4F9C' }),
  C('vleague_w', 'V리그 여자부', { kind: 'league', sport: 'volleyball', group: '국내 프로스포츠', country: '대한민국', src: 'kovo', gender: '2', color: '#D6336C' }),
  C('lck', 'LCK', { kind: 'league', sport: 'esports', group: 'e스포츠', country: '대한민국', src: 'lol', slug: 'lck', color: '#C89B3C' }),
  C('f1', 'F1', { kind: 'league', sport: 'racing', group: '모터스포츠', country: '국제', src: 'f1', color: '#E10600' }),
  // 컵·국제대회 (부모 리그를 고르면 자동 포함, 고른 팀 경기만 표시)
  C('ucl', '챔피언스리그', { kind: 'cup', sport: 'soccer', src: 'espn', path: 'soccer/uefa.champions', parents: SOCCER5, standings: true }),
  C('uel', '유로파리그', { kind: 'cup', sport: 'soccer', src: 'espn', path: 'soccer/uefa.europa', parents: SOCCER5, standings: true }),
  C('uecl', '컨퍼런스리그', { kind: 'cup', sport: 'soccer', src: 'espn', path: 'soccer/uefa.europa.conf', parents: SOCCER5, standings: true }),
  C('uefa_super', 'UEFA 슈퍼컵', { kind: 'cup', sport: 'soccer', src: 'espn', path: 'soccer/uefa.super_cup', parents: SOCCER5 }),
  C('fa_cup', 'FA컵', { kind: 'cup', sport: 'soccer', src: 'espn', path: 'soccer/eng.fa', parents: ['epl'] }),
  C('efl_cup', '카라바오컵', { kind: 'cup', sport: 'soccer', src: 'espn', path: 'soccer/eng.league_cup', parents: ['epl'] }),
  C('community_shield', '커뮤니티 실드', { kind: 'cup', sport: 'soccer', src: 'espn', path: 'soccer/eng.charity', parents: ['epl'] }),
  C('copa_del_rey', '코파 델 레이', { kind: 'cup', sport: 'soccer', src: 'espn', path: 'soccer/esp.copa_del_rey', parents: ['laliga'] }),
  C('supercopa', '수페르코파 (스페인)', { kind: 'cup', sport: 'soccer', src: 'espn', path: 'soccer/esp.super_cup', parents: ['laliga'] }),
  C('coppa_italia', '코파 이탈리아', { kind: 'cup', sport: 'soccer', src: 'espn', path: 'soccer/ita.coppa_italia', parents: ['seriea'] }),
  C('supercoppa', '수페르코파 (이탈리아)', { kind: 'cup', sport: 'soccer', src: 'espn', path: 'soccer/ita.super_cup', parents: ['seriea'] }),
  C('dfb_pokal', 'DFB 포칼', { kind: 'cup', sport: 'soccer', src: 'espn', path: 'soccer/ger.dfb_pokal', parents: ['bundesliga'] }),
  C('dfl_supercup', 'DFL 슈퍼컵', { kind: 'cup', sport: 'soccer', src: 'espn', path: 'soccer/ger.super_cup', parents: ['bundesliga'] }),
  C('coupe_de_france', '쿠프 드 프랑스', { kind: 'cup', sport: 'soccer', src: 'espn', path: 'soccer/fra.coupe_de_france', parents: ['ligue1'] }),
  C('trophee', '트로페 데 샹피옹', { kind: 'cup', sport: 'soccer', src: 'espn', path: 'soccer/fra.super_cup', parents: ['ligue1'] }),
  C('lol_fst', 'First Stand', { kind: 'cup', sport: 'esports', src: 'lol', slug: 'first_stand', parents: ['lck'] }),
  C('lol_msi', 'MSI', { kind: 'cup', sport: 'esports', src: 'lol', slug: 'msi', parents: ['lck'] }),
  C('lol_worlds', '월드 챔피언십', { kind: 'cup', sport: 'esports', src: 'lol', slug: 'worlds', parents: ['lck'] }),
  C('lol_ewc', 'e스포츠 월드컵', { kind: 'cup', sport: 'esports', src: 'lol', slug: 'ewc_lol', parents: ['lck'] }),
  C('lol_kespa', 'KeSPA컵', { kind: 'cup', sport: 'esports', src: 'lol', slug: 'kespa_cup', parents: ['lck'] }),
  C('lol_asiad', '아시안게임', { kind: 'cup', sport: 'esports', src: 'lol', slug: 'asian_games', parents: ['lck'] }),
];
const BY_ID = Object.fromEntries(COMPETITIONS.map(c => [c.id, c]));

const ROUND_KO = {
  'league-phase': '리그 페이즈', 'knockout-round-playoffs': '플레이오프', 'knockout-playoffs': '플레이오프',
  'round-of-64': '64강', 'round-of-32': '32강', 'round-of-16': '16강', 'quarterfinals': '8강', 'quarter-finals': '8강',
  'semifinals': '4강', 'semi-finals': '4강', 'final': '결승', 'finals': '결승',
  'first-round': '1라운드', 'second-round': '2라운드', 'third-round': '3라운드', 'fourth-round': '4라운드',
  'fifth-round': '5라운드', 'sixth-round': '6라운드', 'seventh-round': '7라운드', 'eighth-round': '8라운드',
  'group-stage': '조별리그', 'play-off-round': '플레이오프 라운드', 'playoff-round': '플레이오프 라운드',
  'qualifying-rounds': '예선', 'first-qualifying-round': '1차 예선', 'second-qualifying-round': '2차 예선', 'third-qualifying-round': '3차 예선',
};

/* ───────── 공통 유틸 ───────── */
const KST_OFFSET = 9 * 3600e3;
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
const isoDay = d => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const addDays = (d, n) => new Date(d.getTime() + n * 86400e3);
const utcIso = ms => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
const toInt = v => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : null; };
const toNum = v => { if (v === null || v === undefined || v === '' || v === '-') return null; const n = Number(String(v).replace(/,/g, '')); return Number.isFinite(n) ? n : null; };
const stripTags = s => decodeEntities(String(s || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
function decodeEntities(s) { return s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)); }
// KST 날짜 + "HH:MM" → UTC ISO. 시각이 없으면 자정 + time_tbd
function kstIso(y, m, d, hhmm) {
  const mm = /^\s*(\d{1,2}):?(\d{2})\s*$/.exec(hhmm || '');
  const ms = Date.UTC(y, m - 1, d, mm ? +mm[1] : 0, mm ? +mm[2] : 0) - KST_OFFSET;
  return [utcIso(ms), !mm];
}
function monthsBetween(a, b) { // a,b: Date(UTC) → [[y,m],...]
  const out = []; let y = a.getUTCFullYear(), m = a.getUTCMonth() + 1;
  while (y < b.getUTCFullYear() || (y === b.getUTCFullYear() && m <= b.getUTCMonth() + 1)) { out.push([y, m]); m === 12 ? (y++, m = 1) : m++; }
  return out;
}
const kstNow = now => new Date(now.getTime() + KST_OFFSET); // getUTC* 로 KST 날짜를 읽는 용도
const JUNK = /all[- ]?stars?|^tbd\b|^team |^(afc|nfc|world|rising stars)$|^usa$/i;


/* ───────── 구단 대표색 (공식 브랜드·홈 유니폼 기준, [주색, 보조색, 무늬]) ─────────
 * 무늬: stripes 세로 줄무늬 · hoops 가로 줄무늬 · halves 반반 · band 가운데 띠 · sash 대각선 띠 · pin 흰 바탕 핀스트라이프(주색 선)
 * ESPN이 주는 색은 원정·서드 유니폼 색이 섞여 있어 직접 정리했다. 이름 일부로 찾는다(가장 긴 것 우선). */
const BRAND = {
  soccer: {
    arsenal: ['#EF0107', '#FFFFFF'], astonvilla: ['#670E36', '#95BFE5'], bournemouth: ['#DA291C', '#000000', 'stripes'], brentford: ['#E30613', '#FFFFFF', 'stripes'],
    brighton: ['#0057B8', '#FFFFFF'], burnley: ['#6C1D45', '#99D6EA'], chelsea: ['#034694', '#FFFFFF'], crystalpalace: ['#1B458F', '#C4122E', 'stripes'],
    everton: ['#003399', '#FFFFFF'], fulham: ['#FFFFFF', '#000000'], leeds: ['#FFFFFF', '#1D428A'], liverpool: ['#C8102E', '#F6EB61'],
    manchestercity: ['#6CABDD', '#1C2C5B'], manchesterunited: ['#DA291C', '#FBE122'], newcastle: ['#241F20', '#FFFFFF', 'stripes'], nottingham: ['#DD0000', '#FFFFFF'],
    sunderland: ['#EB172B', '#FFFFFF', 'stripes'], tottenham: ['#132257', '#FFFFFF'], westham: ['#7A263A', '#1BB1E7'], wolverhampton: ['#FDB913', '#231F20'],
    ipswich: ['#0044A9', '#FFFFFF'], leicester: ['#003090', '#FDBE11'], southampton: ['#D71920', '#FFFFFF', 'stripes'],
    alaves: ['#0761AF', '#FFFFFF'], athletic: ['#EE2523', '#FFFFFF', 'stripes'], atleticomadrid: ['#CB3524', '#FFFFFF', 'stripes'], barcelona: ['#A50044', '#004D98', 'stripes'],
    celta: ['#8AC3EE', '#E5254E'], elche: ['#05642C', '#FFFFFF'], espanyol: ['#007FC8', '#FFFFFF', 'stripes'], getafe: ['#005999', '#FFFFFF'],
    girona: ['#CD2534', '#FFFFFF', 'stripes'], levante: ['#B4053F', '#005093'], mallorca: ['#E20613', '#000000'], osasuna: ['#D91A21', '#0A346F'],
    rayovallecano: ['#FFFFFF', '#E53027', 'sash'], betis: ['#00954C', '#FFFFFF'], realmadrid: ['#FFFFFF', '#FEBE10'], oviedo: ['#0047AB', '#FFFFFF'],
    realsociedad: ['#0067B1', '#FFFFFF', 'stripes'], sevilla: ['#D81920', '#FFFFFF'], valencia: ['#FFFFFF', '#EE7F00'], villarreal: ['#FFE667', '#005187'],
    leganes: ['#0A4FA1', '#FFFFFF', 'stripes'], laspalmas: ['#FFE400', '#0055A5'], valladolid: ['#921B88', '#FFFFFF'],
    atalanta: ['#1E71B8', '#000000', 'stripes'], bologna: ['#A21C26', '#1A2F48', 'stripes'], cagliari: ['#A71930', '#002350', 'halves'], como: ['#003DA5', '#FFFFFF'],
    cremonese: ['#C8102E', '#A7A9AC'], fiorentina: ['#482E92', '#FFFFFF'], genoa: ['#C8102E', '#002855', 'halves'], verona: ['#002F6C', '#FFD200'],
    internazionale: ['#0068A8', '#000000', 'stripes'], intermilan: ['#0068A8', '#000000', 'stripes'], juventus: ['#000000', '#FFFFFF', 'stripes'], lazio: ['#87D8F7', '#FFFFFF'],
    lecce: ['#FFD700', '#D7182A'], acmilan: ['#FB090B', '#000000', 'stripes'], napoli: ['#12A0D7', '#FFFFFF'], parma: ['#FFD200', '#005BAC'],
    pisa: ['#1F4FA0', '#000000'], roma: ['#8E1F2F', '#F0BC42'], sassuolo: ['#00A752', '#000000'], torino: ['#8A1E03', '#FFFFFF'],
    udinese: ['#000000', '#FFFFFF', 'stripes'], empoli: ['#00579C', '#FFFFFF'], monza: ['#E4002B', '#FFFFFF'], venezia: ['#F37021', '#00843D'],
    augsburg: ['#BA3733', '#46714D'], unionberlin: ['#EB1923', '#FFFFFF'], werderbremen: ['#1D9053', '#FFFFFF'], dortmund: ['#FDE100', '#000000'],
    eintrachtfrankfurt: ['#E1000F', '#000000'], freiburg: ['#E2001A', '#000000'], hamburg: ['#0A3F86', '#FFFFFF'], heidenheim: ['#E30613', '#003B79'],
    hoffenheim: ['#1961B5', '#FFFFFF'], koln: ['#ED1C24', '#FFFFFF'], cologne: ['#ED1C24', '#FFFFFF'], leipzig: ['#DD0741', '#FFFFFF'],
    leverkusen: ['#E32221', '#000000'], mainz: ['#ED1C24', '#FFFFFF'], monchengladbach: ['#00A650', '#000000'], gladbach: ['#00A650', '#000000'],
    bayernmunich: ['#DC052D', '#0066B2'], bayernmunchen: ['#DC052D', '#0066B2'], stpauli: ['#6F4E37', '#FFFFFF'], stuttgart: ['#E32219', '#FFFFFF'],
    wolfsburg: ['#65B32E', '#FFFFFF'], bochum: ['#005CA9', '#FFFFFF'], holsteinkiel: ['#003B7E', '#FFFFFF'],
    angers: ['#000000', '#FFFFFF'], auxerre: ['#0055A4', '#FFFFFF'], brest: ['#E30613', '#FFFFFF'], lehavre: ['#68A4DC', '#002C5F'],
    lens: ['#FFD700', '#EC1C24'], lille: ['#E01E13', '#24216A'], lorient: ['#F58220', '#000000'], lyon: ['#DA0812', '#1B3C8D'],
    marseille: ['#2FAEE0', '#FFFFFF'], metz: ['#8D1931', '#FFFFFF'], monaco: ['#E7192F', '#FFFFFF'], nantes: ['#FCDD09', '#00843D'],
    nice: ['#C8102E', '#000000'], parisfc: ['#1A2A5A', '#FFFFFF'], parissaintgermain: ['#004170', '#DA291C', 'band'], rennes: ['#E13327', '#000000'],
    strasbourg: ['#009FE3', '#FFFFFF'], toulouse: ['#6A2C8E', '#FFFFFF'], montpellier: ['#F48C12', '#002B5C'], reims: ['#EE1C25', '#FFFFFF'], saintetienne: ['#00A650', '#FFFFFF'],
    benfica: ['#E83030', '#FFFFFF'], porto: ['#003893', '#FFFFFF', 'stripes'], sportingcp: ['#00785A', '#FFFFFF', 'hoops'], ajax: ['#FFFFFF', '#D2122E', 'band'], psv: ['#ED1C24', '#FFFFFF'],
    feyenoord: ['#E30613', '#FFFFFF', 'halves'], clubbrugge: ['#0077C8', '#000000', 'stripes'], celtic: ['#018749', '#FFFFFF', 'hoops'], rangers: ['#1B458F', '#FFFFFF'],
    galatasaray: ['#A90432', '#FDB912', 'halves'], fenerbahce: ['#002D72', '#FFED00', 'stripes'], olympiacos: ['#E2001A', '#FFFFFF', 'stripes'], shakhtar: ['#FF6600', '#000000'], salzburg: ['#D50032', '#FFFFFF'],
    atlantaunited: ['#80000A', '#A19060'], austin: ['#00B140', '#000000'], charlotte: ['#1A85C8', '#000000'], chicagofire: ['#C8102E', '#141946'],
    cincinnati: ['#F05323', '#263B80'], colorado: ['#862633', '#8BB8E8'], columbus: ['#FEDD00', '#000000'], dcunited: ['#000000', '#EF3E42'],
    fcdallas: ['#E81F3E', '#2A4076'], houston: ['#FF6B00', '#101820'], intermiami: ['#F7B5CD', '#231F20'], lagalaxy: ['#00245D', '#FFD200'],
    losangelesfc: ['#C39E6D', '#000000'], lafc: ['#C39E6D', '#000000'], minnesota: ['#8CD2F4', '#231F20'], montreal: ['#0033A1', '#000000'],
    nashville: ['#ECE83A', '#1F1646'], newengland: ['#0A2240', '#CE0E2D'], newyorkcity: ['#6CACE4', '#041E42'], redbulls: ['#ED1E36', '#23326A'],
    orlando: ['#633492', '#FDE192'], philadelphiaunion: ['#071B2C', '#B19B69'], portland: ['#004812', '#D69A00'], realsaltlake: ['#B30838', '#013A81'],
    sanjose: ['#0067B1', '#000000'], seattle: ['#5D9741', '#005595'], sportingkansascity: ['#91B0D5', '#002F65'], stlouis: ['#EC1458', '#001544'],
    torontofc: ['#B81137', '#455560'], vancouver: ['#00245E', '#9DC2EA'],
  },
  basketball: {
    hawks: ['#E03A3E', '#C1D32F'], celtics: ['#007A33', '#BA9653'], nets: ['#000000', '#FFFFFF'], hornets: ['#00788C', '#1D1160'], bulls: ['#CE1141', '#000000'],
    cavaliers: ['#860038', '#FDBB30'], mavericks: ['#00538C', '#B8C4CA'], nuggets: ['#0E2240', '#FEC524'], pistons: ['#C8102E', '#1D42BA'], warriors: ['#1D428A', '#FFC72C'],
    rockets: ['#CE1141', '#000000'], pacers: ['#002D62', '#FDBB30'], clippers: ['#C8102E', '#1D428A'], lakers: ['#552583', '#FDB927'], grizzlies: ['#5D76A9', '#12173F'],
    heat: ['#98002E', '#F9A01B'], bucks: ['#00471B', '#EEE1C6'], timberwolves: ['#0C2340', '#78BE20'], pelicans: ['#0C2340', '#85714D'], knicks: ['#006BB6', '#F58426'],
    thunder: ['#007AC1', '#EF3B24'], magic: ['#0077C0', '#C4CED4'], '76ers': ['#006BB6', '#ED174C'], suns: ['#E56020', '#1D1160'], trailblazers: ['#E03A3E', '#000000'],
    kings: ['#5A2D81', '#63727A'], spurs: ['#C4CED4', '#000000'], raptors: ['#CE1141', '#000000'], jazz: ['#002B5C', '#F9A01B'], wizards: ['#002B5C', '#E31837'],
  },
  football: {
    cardinals: ['#97233F', '#FFB612'], falcons: ['#A71930', '#000000'], ravens: ['#241773', '#9E7C0C'], bills: ['#00338D', '#C60C30'], panthers: ['#0085CA', '#101820'],
    bears: ['#0B162A', '#C83803'], bengals: ['#FB4F14', '#000000'], browns: ['#FF3C00', '#311D00'], cowboys: ['#003594', '#869397'], broncos: ['#FB4F14', '#002244'],
    lions: ['#0076B6', '#B0B7BC'], packers: ['#203731', '#FFB612'], texans: ['#03202F', '#A71930'], colts: ['#002C5F', '#A2AAAD'], jaguars: ['#006778', '#D7A22A'],
    chiefs: ['#E31837', '#FFB81C'], raiders: ['#000000', '#A5ACAF'], chargers: ['#0080C6', '#FFC20E'], rams: ['#003594', '#FFA300'], dolphins: ['#008E97', '#FC4C02'],
    vikings: ['#4F2683', '#FFC62F'], patriots: ['#002244', '#C60C30'], saints: ['#D3BC8D', '#101820'], giants: ['#0B2265', '#A71930'], jets: ['#125740', '#FFFFFF'],
    eagles: ['#004C54', '#A5ACAF'], steelers: ['#FFB612', '#101820'], '49ers': ['#AA0000', '#B3995D'], seahawks: ['#002244', '#69BE28'], buccaneers: ['#D50A0A', '#34302B'],
    titans: ['#4B92DB', '#0C2340'], commanders: ['#5A1414', '#FFB612'],
  },
  baseball: {
    diamondbacks: ['#A71930', '#E3D4AD'], athletics: ['#003831', '#EFB21E'], braves: ['#CE1141', '#13274F'], orioles: ['#DF4601', '#000000'], redsox: ['#BD3039', '#0C2340'],
    cubs: ['#0E3386', '#CC3433', 'pin'], whitesox: ['#27251F', '#C4CED4', 'pin'], reds: ['#C6011F', '#000000'], guardians: ['#00385D', '#E50022'], rockies: ['#33006F', '#C4CED4'],
    tigers: ['#0C2340', '#FA4616'], astros: ['#002D62', '#EB6E1F'], royals: ['#004687', '#BD9B60'], angels: ['#BA0021', '#003263'], dodgers: ['#005A9C', '#EF3E42'],
    marlins: ['#00A3E0', '#EF3340'], brewers: ['#12284B', '#FFC52F'], twins: ['#002B5C', '#D31145', 'pin'], mets: ['#002D72', '#FF5910', 'pin'], yankees: ['#0C2340', '#C4CED4', 'pin'],
    phillies: ['#E81828', '#002D72', 'pin'], pirates: ['#FDB827', '#27251F'], padres: ['#FFC425', '#2F241D'], giants: ['#FD5A1E', '#27251F'], mariners: ['#0C2C56', '#005C5C'],
    cardinals: ['#C41E3A', '#0C2340'], rays: ['#092C5C', '#8FBCE6'], rangers: ['#003278', '#C0111F'], bluejays: ['#134A8E', '#1D2D5C'], nationals: ['#AB0003', '#14225A'],
  },
  racing: {
    ferrari: ['#E8002D', '#FFEB00'], mclaren: ['#FF8000', '#47C7FC'], redbull: ['#3671C6', '#CC1E4A'], mercedes: ['#27F4D2', '#000000'],
    astonmartin: ['#229971', '#CEDC00'], alpine: ['#0093CC', '#FF87BC'], williams: ['#64C4FF', '#041E42'], rb: ['#6692FF', '#FFFFFF'],
    racingbulls: ['#6692FF', '#FFFFFF'], audi: ['#BB0A30', '#C0C0C0'], sauber: ['#52E252', '#000000'], haas: ['#B6BABD', '#E6002B'], cadillac: ['#C9A35A', '#1A1A1A'],
  },
  hockey: {
    ducks: ['#F47A38', '#B9975B'], utah: ['#6CACE4', '#010101'], bruins: ['#FFB81C', '#000000'], sabres: ['#003087', '#FFB81C'], flames: ['#C8102E', '#F1BE48'],
    hurricanes: ['#CE1126', '#000000'], blackhawks: ['#CF0A2C', '#000000'], avalanche: ['#6F263D', '#236192'], bluejackets: ['#002654', '#CE1126'], stars: ['#006847', '#8F8F8C'],
    redwings: ['#CE1126', '#FFFFFF'], oilers: ['#FF4C00', '#041E42'], panthers: ['#C8102E', '#041E42'], kings: ['#A2AAAD', '#111111'], wild: ['#154734', '#A6192E'],
    canadiens: ['#AF1E2D', '#192168'], predators: ['#FFB81C', '#041E42'], devils: ['#CE1126', '#000000'], islanders: ['#00539B', '#F47D30'], rangers: ['#0038A8', '#CE1126'],
    senators: ['#C52032', '#C2912C'], flyers: ['#F74902', '#000000'], penguins: ['#FCB514', '#000000'], sharks: ['#006D75', '#EA7200'], kraken: ['#99D9D9', '#001628'],
    blues: ['#002F87', '#FCB514'], lightning: ['#002868', '#FFFFFF'], mapleleafs: ['#00205B', '#FFFFFF'], canucks: ['#00205B', '#00843D'], goldenknights: ['#B4975A', '#333F42'],
    capitals: ['#C8102E', '#041E42'], jets: ['#041E42', '#AC162C'],
  },
};
const BRAND_KEYS = Object.fromEntries(Object.entries(BRAND).map(([k, v]) => [k, Object.keys(v).sort((a, b) => b.length - a.length)]));
const normName = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
function brand(compOrId, name) {
  const c = typeof compOrId === 'string' ? BY_ID[compOrId] : compOrId; const sport = c && c.sport;
  const keys = BRAND_KEYS[sport]; if (!keys) return null;
  const n = normName(name); const k = keys.find(x => n.includes(x));
  return k ? BRAND[sport][k] : null;
}


/* ───────── 홈 유니폼 (배지용): b 몸판 · s 소매 · t 옷깃·소매 끝 · p 무늬 · pc 무늬 색 ─────────
 * 없으면 몸판 = 대표색, 소매 = 몸판, 테두리 = 보조색. 무늬: stripes·hoops·halves·band·sash·pin·chest(가슴 띠)·diag(대각선 반반) */
const W_ = '#FFFFFF', K_ = '#1A1A1A';
const KIT = {
  soccer: {
    arsenal: { s: W_, t: W_ }, astonvilla: { s: '#95BFE5' }, westham: { s: '#1BB1E7' }, burnley: { s: '#99D6EA' },
    tottenham: { b: W_, t: '#132257' }, fulham: { b: W_, t: K_ }, leeds: { b: W_, t: '#1D428A' }, manchesterunited: { t: W_ }, liverpool: { t: W_ },
    brighton: { p: 'stripes', pc: W_ }, manchestercity: { t: W_ },
    realmadrid: { b: W_, t: '#FEBE10' }, sevilla: { b: W_, t: '#D81920' }, valencia: { b: W_, t: K_ }, betis: { p: 'stripes', pc: W_ },
    alaves: { p: 'stripes', pc: W_ }, levante: { b: '#B4053F', p: 'stripes', pc: '#005093' }, valladolid: { p: 'stripes', pc: W_ }, elche: { b: W_, p: 'chest', pc: '#05642C' },
    lecce: { p: 'stripes', pc: '#D7182A' }, pisa: { p: 'stripes', pc: K_ }, sassuolo: { p: 'stripes', pc: K_ }, cremonese: { p: 'stripes', pc: '#A7A9AC' },
    venezia: { b: K_, t: '#F37021' }, bayernmunich: { t: W_ }, bayernmunchen: { t: W_ },
    augsburg: { b: W_, t: '#BA3733' }, hamburg: { b: W_, t: '#E2001A' }, koln: { b: W_, t: '#ED1C24' }, cologne: { b: W_, t: '#ED1C24' },
    leipzig: { b: W_, t: '#DD0741' }, monchengladbach: { b: W_, t: K_ }, gladbach: { b: W_, t: K_ }, stuttgart: { b: W_, p: 'chest', pc: '#E32219' },
    angers: { b: K_, p: 'stripes', pc: W_ }, auxerre: { b: W_, t: '#0055A4' }, lehavre: { p: 'halves', pc: '#002C5F' }, lens: { s: '#EC1C24' },
    lyon: { b: W_, t: '#DA0812' }, marseille: { b: W_, t: '#2FAEE0' }, monaco: { p: 'diag', pc: W_ }, nice: { p: 'stripes', pc: K_ }, rennes: { s: K_ },
    psv: { p: 'stripes', pc: W_ }, shakhtar: { p: 'stripes', pc: K_ }, salzburg: { b: W_, t: '#D50032' }, celtic: { s: W_ },
    atlantaunited: { p: 'stripes', pc: K_ }, fcdallas: { p: 'hoops', pc: '#2A4076' }, lagalaxy: { b: W_, p: 'sash', pc: '#00245D' },
    losangelesfc: { b: K_, t: '#C39E6D' }, lafc: { b: K_, t: '#C39E6D' }, redbulls: { b: W_, t: '#ED1E36' },
  },
  baseball: { giants: { b: '#F4EFE2' } }, // 야구 홈 유니폼은 기본이 흰색(아래 kit()에서 처리)
};
const KIT_KEYS = Object.fromEntries(Object.entries(KIT).map(([k, v]) => [k, Object.keys(v).sort((a, b) => b.length - a.length)]));
function kit(compOrId, name) {
  const c = typeof compOrId === 'string' ? BY_ID[compOrId] : compOrId; const sport = c && c.sport;
  const keys = KIT_KEYS[sport]; const n = normName(name); const k = keys && keys.find(x => n.includes(x));
  const o = k ? Object.assign({}, KIT[sport][k]) : {};
  if (sport === 'baseball' && !o.b) o.b = '#F4F3EE'; // MLB·KBO 홈은 흰색
  return Object.keys(o).length ? o : null;
}

class SourceError extends Error {}

function makeClient(http, delayMs) {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  async function req(url, opt = {}) {
    let last;
    for (let i = 0; i < 2; i++) {
      try {
        const r = await http({ url, method: opt.method || 'GET', headers: opt.headers || {}, body: opt.body || null, timeout: 30000 });
        if (delayMs) await sleep(delayMs);
        if (r.status === 200) return r.text;
        last = new SourceError(`HTTP ${r.status}`);
        if ([400, 401, 403, 404].includes(r.status)) break;
      } catch (e) { last = new SourceError(String(e && e.message || e)); }
      await sleep(1000 * (i + 1));
    }
    throw last;
  }
  return {
    text: req,
    json: async (url, opt) => { const t = await req(url, opt); try { return JSON.parse(t); } catch { throw new SourceError('JSON 형식 오류'); } },
  };
}

const ev = (comp, id, start, tbd, home, away, hs, as, status, extra) => {
  const scored = ['final', 'live', 'suspended'].includes(status);
  return Object.assign({ id: `${comp}:${id}`, comp, start, time_tbd: !!tbd, home, away,
    home_score: scored ? hs : null, away_score: scored ? as : null, venue: '', status, status_text: '' }, extra || {});
};
const team = (id, name, extra) => Object.assign({ id, name: name || '?', short: name || '' }, extra || {});
function standingsOf(rows, season, groupName) {
  rows.sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
  rows.forEach((r, i) => { r.pos = i + 1; });
  return { season: String(season || ''), groups: [{ name: groupName || '전체', rows }] };
}
const row = (team_id, name, rank, f) => {
  const r = Object.assign({ team_id, name, rank, gp: null, w: null, d: null, l: null, otl: null, pct: null, pts: null, gf: null, ga: null, gd: null, gb: null, streak: null }, f || {});
  if (r.gp === null && r.w !== null && r.l !== null) r.gp = r.w + r.l + (r.d || 0);
  return r;
};

/* ───────── ESPN ───────── */
const ESPN = 'https://site.api.espn.com/apis/site/v2/sports';
const ESPN_ST = 'https://site.api.espn.com/apis/v2/sports';

function espnStatus(e) {
  const t = (e.status || {}).type || {}; const name = String(t.name || '').toUpperCase(); const state = String(t.state || '').toLowerCase();
  const text = t.shortDetail || t.description || '';
  if (name.includes('POSTPONED')) return ['postponed', '연기'];
  if (/CANCEL|ABANDON|FORFEIT/.test(name)) return ['canceled', '취소'];
  if (/SUSPENDED|DELAYED/.test(name)) return ['suspended', '중단'];
  if (state === 'post' || t.completed) return ['final', text];
  if (state === 'in') return ['live', text];
  return ['scheduled', ''];
}
function espnTeamId(comp, t) {
  const sport = comp.sport === 'soccer' ? 'soccer' : comp.id; // 축구는 대회가 달라도 같은 팀 id
  return `${sport}:${t.id || t.abbreviation}`;
}
function parseEspnEvent(comp, e) {
  const c = (e.competitions || [])[0]; if (!c) return null;
  const H = (c.competitors || []).find(x => x.homeAway === 'home'), A = (c.competitors || []).find(x => x.homeAway === 'away');
  if (!H || !A) return null;
  const tn = x => (x.team || {});
  if (JUNK.test(tn(H).displayName || '') || JUNK.test(tn(A).displayName || '')) return null;
  const start = Date.parse(e.date || c.date); if (!Number.isFinite(start)) return null;
  const [status, statusText] = espnStatus(e);
  const T = x => { const t = tn(x); const o = team(espnTeamId(comp, t), t.displayName || t.name, { short: t.abbreviation || t.shortDisplayName || '' });
    const b = brand(comp, t.displayName || t.name);
    if (b) { o.color = b[0]; o.color2 = b[1]; o.brand = true; if (b[2]) o.pattern = b[2]; }
    else { if (t.color) o.color = '#' + String(t.color).replace('#', '').slice(0, 6); if (t.alternateColor) o.color2 = '#' + String(t.alternateColor).replace('#', '').slice(0, 6); }
    return o; };
  const slug = (e.season || {}).slug;
  const round = comp.kind === 'cup' && slug ? (ROUND_KO[slug] || slug.replace(/-/g, ' ')) : '';
  return ev(comp.id, e.id, utcIso(start), c.timeValid === false, T(H), T(A), toInt(H.score), toInt(A.score), status,
    { venue: (c.venue || e.venue || {}).fullName || '', status_text: statusText, round, net: espnNational(c) });
}
// 미국 전국 중계사 이름 (예: ['Netflix'], ['CBS']). 앱이 중계 정보의 규칙과 맞춰 본다 — 넷플릭스 NFL 경기는 전 세계 생중계
function espnNational(c) {
  const geo = (c.geoBroadcasts || []).filter(g => !g.market || !g.market.type || g.market.type === 'National').map(g => (g.media || {}).shortName).filter(Boolean);
  const names = geo.length ? geo : (c.broadcasts || []).flatMap(b => b.names || []);
  return [...new Set(names.map(n => String(n).trim()).filter(Boolean))].slice(0, 6);
}
async function espnSeason(cli, comp) {
  const j = await cli.json(`${ESPN}/${comp.path}/scoreboard`);
  const lg = (j.leagues || [])[0] || {}; const s = lg.season || {};
  const cal = Array.isArray(lg.calendar) && typeof lg.calendar[0] === 'string' ? lg.calendar.map(x => Date.parse(x)).filter(Number.isFinite) : null;
  return { start: Date.parse(s.startDate), end: Date.parse(s.endDate), label: s.displayName || String(s.year || ''), calendar: cal };
}
async function espnRange(cli, comp, from, to) {
  const raw = [];
  for (const [y, m] of monthsBetween(from, to)) {
    const j = await cli.json(`${ESPN}/${comp.path}/scoreboard?dates=${y}${pad(m)}&limit=1000`);
    const evs = j.events || []; raw.push(...evs);
    if (evs.length >= 100) { // 경기가 많은 달은 응답이 잘린다 → 마지막 날짜부터 하루씩 보충
      const last = evs.map(e => Date.parse(e.date)).filter(Number.isFinite).sort((a, b) => b - a)[0];
      const monthEnd = new Date(Date.UTC(y, m, 0));
      for (let d = new Date(Date.UTC(new Date(last).getUTCFullYear(), new Date(last).getUTCMonth(), new Date(last).getUTCDate())); d <= monthEnd && d <= to; d = addDays(d, 1)) {
        if (d < from) continue;
        const jd = await cli.json(`${ESPN}/${comp.path}/scoreboard?dates=${ymd(d)}&limit=1000`);
        raw.push(...(jd.events || []));
      }
    }
  }
  const out = new Map();
  for (const e of raw) { const p = parseEspnEvent(comp, e); if (p && Date.parse(p.start) >= from.getTime() - 86400e3 && Date.parse(p.start) <= to.getTime() + 86400e3) out.set(p.id, p); }
  return [...out.values()];
}
function espnStats(entry) {
  const o = {};
  for (const s of entry.stats || []) { const n = s.name || s.type; if (!n) continue; o[n] = s.value ?? s.displayValue; if (n === 'streak' && s.displayValue) o[n] = s.displayValue; }
  return o;
}
function parseEspnStandings(comp, data) {
  const found = [];
  (function walk(node, label) {
    const name = node.name || node.abbreviation || label; const st = node.standings || {};
    if ((st.entries || []).length) found.push([name, st.entries, st.season || st.seasonDisplayName]);
    for (const ch of node.children || []) walk(ch, name);
  })(data, '');
  const groups = []; let season = '';
  for (const [name, entries, ssn] of found) {
    const rows = [];
    for (const en of entries) {
      const t = en.team || {}; if (!t.id && !t.abbreviation) continue;
      const s = espnStats(en);
      const pf = toNum(s.pointsFor), pa = toNum(s.pointsAgainst);
      let gd = toNum(s.pointDifferential); if (gd === null) gd = toNum(s.differential); if (gd === null && pf !== null && pa !== null) gd = pf - pa;
      rows.push(row(espnTeamId(comp, t), t.displayName || t.name, toNum(s.rank) ?? toNum(s.playoffSeed), {
        gp: toNum(s.gamesPlayed), w: toNum(s.wins), d: toNum(s.ties), l: toNum(s.losses),
        otl: toNum(s.otLosses ?? s.overtimeLosses), pct: toNum(s.winPercent),
        pts: ['soccer', 'hockey'].includes(comp.sport) ? toNum(s.points) : null,
        gf: pf, ga: pa, gd, gb: toNum(s.gamesBehind), streak: typeof s.streak === 'string' ? s.streak : null,
      }));
    }
    const pts = comp.sport === 'soccer' || comp.sport === 'hockey';
    rows.sort((a, b) => pts && a.pts !== null ? (b.pts - a.pts) || ((b.gd || 0) - (a.gd || 0)) : a.pct !== null ? (b.pct - a.pct) || ((b.w || 0) - (a.w || 0)) : (a.rank ?? 999) - (b.rank ?? 999));
    rows.forEach((r, i) => { r.pos = i + 1; });
    if (rows.length) groups.push({ name, rows });
    season = season || ssn || '';
  }
  if (!groups.length) throw new SourceError('순위 데이터 없음');
  if (groups.length === 1) groups[0].name = '전체';
  return { season: String(season), groups };
}
async function fetchEspn(cli, comp, ctx) {
  const now = ctx.now;
  const s = await espnSeason(cli, comp);
  const prev = ctx.prevState || {};
  const seasonEnded = Number.isFinite(s.end) && s.end < now.getTime();
  const nextDates = (s.calendar || []).filter(t => t >= now.getTime() - 86400e3);
  // 시즌이 끝났고 다음 시즌 일정이 아직 없으면: 일정은 받지 않고 순위만(최종 결과)
  const offseason = seasonEnded || (s.calendar && s.calendar.length > 0 && !nextDates.length);
  let events = [];
  let full = false;
  if (!offseason) {
    const seasonStart = Number.isFinite(s.start) ? new Date(s.start) : addDays(now, -30);
    const seasonEnd = Number.isFinite(s.end) ? new Date(s.end) : addDays(now, 180);
    full = !prev.lastFull || now.getTime() - prev.lastFull > 20 * 3600e3 || prev.season !== s.label;
    // 처음이거나 하루가 지났으면 시즌 전체(지난 경기 포함), 아니면 가까운 기간만
    const from = full ? (prev.lastFull ? addDays(now, -21) : new Date(Math.max(seasonStart.getTime(), addDays(now, -200).getTime()))) : addDays(now, -3);
    const to = full ? new Date(Math.min(seasonEnd.getTime(), addDays(now, 200).getTime())) : addDays(now, 21);
    if (from <= to) events = await espnRange(cli, comp, from, to);
    ctx.window = [isoDay(from), isoDay(to)];
  }
  let standings = null;
  if (comp.kind === 'league' || comp.standings) {
    try { standings = parseEspnStandings(comp, await cli.json(`${ESPN_ST}/${comp.path}/standings`)); } catch (e) { if (comp.kind === 'league') ctx.standingsError = String(e.message || e); }
  }
  return { events, standings, offseason, season: s.label, full, window: ctx.window || null, seasonStart: s.start, seasonEnd: s.end };
}

/* ───────── KBO (koreabaseball.com) ───────── */
function parseKboSchedule(data, year) {
  const out = []; let cur = null;
  for (const r of data.rows || []) {
    const cells = r.row || []; const by = {};
    for (const c of cells) if (c.Class) by[c.Class] = c.Text || '';
    if (by.day) { const m = /(\d{2})\.(\d{2})/.exec(stripTags(by.day)); if (m) cur = [year, +m[1], +m[2]]; }
    const play = by.play; if (!play || !cur) continue;
    const em = /<em>([\s\S]*?)<\/em>/.exec(play);
    const nums = em ? [...em[1].matchAll(/<span[^>]*>([\s\S]*?)<\/span>/g)].map(x => stripTags(x[1])).filter(x => /^\d+$/.test(x)).map(Number) : [];
    const teams = play.replace(/<em>[\s\S]*?<\/em>/, '|').split('|').map(stripTags).filter(Boolean);
    if (teams.length !== 2) continue;
    const [awayN, homeN] = teams; // KBO 표기: 원정 vs 홈
    const tail = cells.slice(-2).map(c => stripTags(c.Text));
    const venue = tail[0] || ''; let note = tail[1] || ''; if (note === '-') note = '';
    const tv = cells.filter(c => !c.Class).map(c => stripTags(c.Text)).filter(t => /^[A-Z0-9+-]+(,[A-Z0-9+-]+)*$/.test(t) && /T$|TVING/.test(t));
    const gid = (/gameId=(\w+)/.exec(cells.map(c => c.Text || '').join(' ')) || [])[1] || `${cur.join('')}${awayN}${homeN}`;
    let status = 'scheduled';
    if (/취소|연기/.test(note)) status = note.includes('취소') ? 'canceled' : 'postponed';
    else if (nums.length === 2) status = 'final';
    const [start, tbd] = kstIso(cur[0], cur[1], cur[2], stripTags(by.time));
    out.push(ev('kbo', gid, start, tbd, team(`kbo:${homeN}`, homeN), team(`kbo:${awayN}`, awayN), nums[1] ?? null, nums[0] ?? null, status,
      { venue, status_text: note, broadcast: tv.join(',').split(',').filter(Boolean).concat(['TVING']) }));
  }
  return out;
}
function parseKboRank(page) {
  const m = /<table[^>]*class="tData"[^>]*>([\s\S]*?)<\/table>/.exec(page); if (!m) throw new SourceError('KBO 순위표 없음');
  const rows = [];
  for (const tr of m[1].match(/<tr>[\s\S]*?<\/tr>/g) || []) {
    const td = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(x => stripTags(x[1])); if (td.length < 8) continue;
    rows.push(row(`kbo:${td[1]}`, td[1], toInt(td[0]), { gp: toInt(td[2]), w: toInt(td[3]), l: toInt(td[4]), d: toInt(td[5]), pct: toNum(td[6]), gb: toNum(td[7]), streak: td[9] || null }));
  }
  return rows;
}
async function fetchKbo(cli, comp, ctx) {
  const now = kstNow(ctx.now); const y = now.getUTCFullYear(); const mo = now.getUTCMonth() + 1;
  const offseason = mo >= 11 || mo <= 2; // 정규시즌 3~10월(포스트시즌 ~11월 초)
  let events = [];
  const months = offseason || ctx.rosterOnly ? [] : [mo - 1, mo, mo + 1].filter(m => m >= 3 && m <= 11);
  if (!ctx.prevState?.lastFull && !offseason && !ctx.rosterOnly) for (let m = 3; m < mo - 1; m++) months.unshift(m);
  for (const m of [...new Set(months)].sort((a, b) => a - b)) {
    const t = await cli.json('https://www.koreabaseball.com/ws/Schedule.asmx/GetScheduleList', { method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', Referer: 'https://www.koreabaseball.com/Schedule/Schedule.aspx', 'X-Requested-With': 'XMLHttpRequest' },
      body: `leId=1&srIdList=0%2C3%2C4%2C5%2C7%2C9%2C6&seasonId=${y}&gameMonth=${pad(m)}&teamId=` });
    events.push(...parseKboSchedule(t, y));
  }
  const page = await cli.text('https://www.koreabaseball.com/Record/TeamRank/TeamRankDaily.aspx');
  return { events, standings: standingsOf(parseKboRank(page), y), offseason, season: String(y), full: true };
}

/* ───────── K리그1 (kleague.com) ───────── */
function parseKleagueSchedule(data) {
  const out = [];
  for (const g of ((data.data || {}).scheduleList) || []) {
    const p = String(g.gameDate || '').split('.').map(Number); if (p.length !== 3) continue;
    const code = String(g.gameStatus || '').toUpperCase();
    const status = code === 'PP' ? 'postponed' : code === 'CAN' ? 'canceled' : (g.endYn === 'Y' || code === 'FE') ? 'final' : ['LIVE', 'IN', 'HT'].includes(code) ? 'live' : 'scheduled';
    const [start, tbd] = kstIso(p[0], p[1], p[2], g.gameTime);
    out.push(ev('kleague1', `${g.year}-${g.gameId}`, start, tbd, team(`kleague1:${g.homeTeam}`, g.homeTeamName), team(`kleague1:${g.awayTeam}`, g.awayTeamName),
      toInt(g.homeGoal), toInt(g.awayGoal), status, { venue: g.fieldNameFull || g.fieldName || '', round: g.roundId ? `${g.roundId}라운드` : '',
        broadcast: String(g.broadcastName || '').split('/').map(s => s.trim()).filter(Boolean) }));
  }
  return out;
}
function parseKleagueRank(data) {
  const seen = new Set(), rows = [];
  for (const t of ((data.data || {}).teamRank) || []) {
    if (seen.has(t.teamId)) continue; seen.add(t.teamId);
    rows.push(row(`kleague1:${t.teamId}`, t.teamName, toInt(t.rank), { gp: toInt(t.gameCount), w: toInt(t.winCnt), d: toInt(t.tieCnt), l: toInt(t.lossCnt),
      pts: toInt(t.gainPoint), gf: toInt(t.gainGoal), ga: toInt(t.lossGoal), gd: toInt(t.gapCnt) }));
  }
  return rows;
}
async function fetchKleague(cli, comp, ctx) {
  const now = kstNow(ctx.now); const y = now.getUTCFullYear(); const mo = now.getUTCMonth() + 1;
  const offseason = mo === 1 || (mo === 12 && now.getUTCDate() > 10);
  const months = [];
  if (!offseason && !ctx.rosterOnly) { for (let m = ctx.prevState?.lastFull ? Math.max(2, mo - 1) : 2; m <= Math.min(12, mo + 2); m++) months.push(m); }
  let events = [];
  for (const m of months) {
    const j = await cli.json('https://www.kleague.com/getScheduleList.do', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ year: String(y), month: pad(m), leagueId: 1 }) });
    events.push(...parseKleagueSchedule(j));
  }
  let rows = [], season = y;
  for (const yy of [y, y - 1]) {
    const j = await cli.json(`https://www.kleague.com/record/teamRank.do?leagueId=1&year=${yy}&stadium=all&recordType=rank`, { method: 'POST' });
    rows = parseKleagueRank(j); season = yy; if (rows.some(r => (r.gp || 0) > 0)) break;
  }
  return { events, standings: standingsOf(rows, season), offseason, season: String(season), full: true };
}

/* ───────── KBL (api.kbl.or.kr) ───────── */
const KBL_H = { channel: 'WEB', teamcode: 'XX', lang: 'ko', 'X-Requested-With': 'XMLHttpRequest', Accept: 'application/json, text/plain, */*' };
function parseKblSchedule(items) {
  const out = [];
  for (const g of items || []) {
    if (![1, '1', undefined, null].includes(g.seasonGrade)) continue; // D리그 제외
    const d = String(g.gameDate || ''); if (!/^\d{8}$/.test(d)) continue;
    const status = g.isEnded ? 'final' : g.isStarted ? 'live' : 'scheduled';
    const [start, tbd] = kstIso(+d.slice(0, 4), +d.slice(4, 6), +d.slice(6, 8), g.gameStart);
    out.push(ev('kbl', g.gmkey || `${d}${g.tcodeH}`, start, tbd, team(`kbl:${g.tcodeH}`, g.tnameH), team(`kbl:${g.tcodeA}`, g.tnameA),
      toInt(g.scoreH), toInt(g.scoreA), status, { venue: g.stadiumnameF || g.stadiumname || '', round: g.seasonCategoryName && g.seasonCategoryName !== '정규시즌' ? g.seasonCategoryName : '',
        broadcast: [g.tv, 'TVING'].filter(Boolean) }));
  }
  return out;
}
function parseKblRank(items) {
  return (items || []).map(t => { const w = toInt(t.win), l = toInt(t.loss);
    return row(`kbl:${t.tcode}`, t.tname, toInt(t.rank), { w, l, pct: w !== null && l !== null && w + l ? Math.round(w / (w + l) * 1000) / 1000 : null,
      gb: toNum(t.winDiff), streak: t.contiWin ? `${t.contiWin}연승` : t.contiLoss ? `${t.contiLoss}연패` : null }); });
}
async function fetchKbl(cli, comp, ctx) {
  const now = ctx.now; const mo = kstNow(now).getUTCMonth() + 1;
  const offseason = mo >= 5 && mo <= 9;
  let events = [];
  if (!offseason && !ctx.rosterOnly) {
    const from = addDays(now, ctx.prevState?.lastFull ? -14 : -120), to = addDays(now, 150);
    for (const [y, m] of monthsBetween(from, to)) {
      if (m >= 5 && m <= 9) continue;
      const a = new Date(Math.max(Date.UTC(y, m - 1, 1), from.getTime())), b = new Date(Math.min(Date.UTC(y, m, 0), to.getTime()));
      const j = await cli.json(`https://api.kbl.or.kr/match/list?fromDate=${ymd(kstNow(a))}&toDate=${ymd(kstNow(b))}&tcodeList=all&seasonGrade=1`, { headers: KBL_H });
      events.push(...parseKblSchedule(j));
    }
  }
  const rank = await cli.json('https://api.kbl.or.kr/league/rank/team', { headers: KBL_H });
  return { events, standings: standingsOf(parseKblRank(rank), ''), offseason, season: '', full: true };
}

/* ───────── WKBL (wkbl.or.kr) ─────────
 * 주 출처: 모바일 일정 /m/game/schedule.asp?sch_ym=YYYYMM
 *   - 앞으로 할 경기: 경기장·시각이 있음 ("아산<br />19:00")
 *   - 먼저 나오는 팀이 홈 팀 (2026-11 20경기 경기장과 대조해 확인)
 *   - 끝난 경기는 시각이 없어 날짜만 (네이버로 보완)
 * 예비: PC 달력 /game/sch/schedule1.asp (홈/원정·시각 없음) */
const WKBL_TEAMS = ['삼성생명', '신한은행', '우리은행', '하나은행', 'BNK 썸', 'KB스타즈'];
function wkblSeasons(page) { const m = /<select name="season_gu"[\s\S]*?<\/select>/.exec(page); return m ? [...m[0].matchAll(/<option value="(\d{3})"[^>]*>([^<]+)/g)].map(x => [x[1], x[2].trim()]) : []; }
function parseWkblSchedule(page, y, m) {
  const out = [];
  for (const cell of page.split('<td>').slice(1)) {
    const dm = /class="date_day">(\d+)</.exec(cell); if (!dm) continue;
    const games = cell.split('<div class="info_game">').slice(1);
    games.forEach((g, gi) => {
      const names = [...g.matchAll(/<span class="language" data-kr="([^"]+)"/g)].map(x => x[1]); if (names.length < 2) return;
      const sc = [...g.matchAll(/<em>(\d+)<\/em>/g)].map(x => +x[1]); const gno = (/game_no=(\d+)/.exec(g) || [])[1];
      const [start] = kstIso(y, m, +dm[1], null);
      out.push(ev('wkbl', gno ? `${y}${pad(m)}-${gno}` : `${y}${pad(m)}${pad(+dm[1])}-${gi}`, start, true, team(`wkbl:${names[0]}`, names[0]), team(`wkbl:${names[1]}`, names[1]),
        sc.length === 2 ? sc[0] : null, sc.length === 2 ? sc[1] : null, sc.length === 2 ? 'final' : 'scheduled', { ha_unknown: true }));
    });
  }
  return out;
}
function parseWkblMobile(page, y, m) {
  const out = []; const perDay = {};
  for (const li of page.split(/<li>\s*<a /).slice(1)) {
    const dm = /class="date">(\d{1,2})\.(\d{1,2})</.exec(li); if (!dm || +dm[1] !== m) continue;
    const d = +dm[2]; const gi = perDay[d] = (perDay[d] ?? -1) + 1;
    const names = [...li.matchAll(/class="team_name">([^<]+)</g)].map(x => x[1].trim()); if (names.length < 2) continue;
    const sc = [...li.matchAll(/<em>(\d+)<\/em>/g)].map(x => +x[1]); const gno = (/game_no=(\d+)/.exec(li) || [])[1];
    const pl = /class="place_block">[\s\S]*?<span>([^<]*)<br\s*\/?>\s*(\d{1,2}:\d{2})/.exec(li);
    const [start, tbd] = kstIso(y, m, d, pl ? pl[2] : null);
    out.push(ev('wkbl', gno ? `${y}${pad(m)}-${gno}` : `${y}${pad(m)}${pad(d)}-${gi}`, start, tbd, team(`wkbl:${names[0]}`, names[0]), team(`wkbl:${names[1]}`, names[1]),
      sc.length === 2 ? sc[0] : null, sc.length === 2 ? sc[1] : null, sc.length === 2 ? 'final' : 'scheduled', { venue: pl ? pl[1].trim() : '' }));
  }
  return out;
}
function parseWkblRank(frag) {
  const rows = [];
  for (const tr of frag.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || []) {
    const td = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(x => stripTags(x[1])); if (td.length < 6) continue;
    const short = WKBL_TEAMS.find(s => td[1].startsWith(s) || s.startsWith(td[1])) || td[1].split(' ')[0];
    const wl = /(\d+)승\s*(\d+)패/.exec(td[3]); const p = toNum(td[4]);
    rows.push(row(`wkbl:${short}`, short, toInt(td[0]), { gp: toInt(td[2]), w: wl ? +wl[1] : null, l: wl ? +wl[2] : null, pct: p !== null && p > 1 ? Math.round(p * 10) / 1000 : p, gb: toNum(td[5]), streak: td[10] || null }));
  }
  return rows;
}
async function fetchWkbl(cli, comp, ctx) {
  const base = await cli.text('https://www.wkbl.or.kr/game/sch/schedule1.asp');
  const seasons = wkblSeasons(base); if (!seasons.length) throw new SourceError('WKBL 시즌 목록 없음');
  const now = ctx.now; const mo = kstNow(now).getUTCMonth() + 1;
  const offseason = mo >= 5 && mo <= 9;
  let events = [];
  if (!offseason && !ctx.rosterOnly) {
    const from = addDays(now, ctx.prevState?.lastFull ? -14 : -120), to = addDays(now, 150);
    for (const [y, m] of monthsBetween(from, to)) {
      if (m >= 5 && m <= 9) continue;
      let got = [];
      try { got = parseWkblMobile(await cli.text(`https://www.wkbl.or.kr/m/game/schedule.asp?sch_ym=${y}${pad(m)}`), y, m); } catch (e) { /* 아래 예비 출처로 */ }
      if (!got.length) {
        const page = await cli.text(`https://www.wkbl.or.kr/game/sch/schedule1.asp?season_gu=${seasons[0][0]}&ym=${y}${pad(m)}&gun=1`);
        const sel = (/<option value="(\d{6})"\s*selected/.exec(page) || [])[1];
        if (sel && sel !== `${y}${pad(m)}`) continue;
        got = parseWkblSchedule(page, y, m);
      }
      events.push(...got);
    }
    try { events = await enrichFromNaver(cli, comp, events, from, to); } catch (e) { /* 보완 실패해도 공식 일정은 유지 */ }
  }
  const frag = await cli.text('https://www.wkbl.or.kr/game/ajax/ajax_team_rank.asp', { method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest', Referer: 'https://www.wkbl.or.kr/game/team_rank.asp' },
    body: `season_gu=${seasons[0][0]}&gun=1` });
  return { events, standings: standingsOf(parseWkblRank(frag), seasons[0][1]), offseason, season: seasons[0][1], full: true };
}

/* ───────── V리그 (user-api.kovo.co.kr) ───────── */
const KOVO = 'https://user-api.kovo.co.kr';
const KOVO_H = { 'Accept-Language': 'ko', Origin: 'https://kovo.co.kr', Referer: 'https://kovo.co.kr/' };
function parseKovoSchedule(data, cid) {
  const out = [];
  for (const g of (((data.payload || {}).content) || [])) {
    const p = String(g.gdate || '').split('-').map(Number); if (p.length !== 3) continue;
    const hs = toInt(g.hspoint), as = toInt(g.aspoint);
    const done = String(g.getime || '').trim() !== '' && ((hs || 0) + (as || 0)) > 0;
    const [start, tbd] = kstIso(p[0], p[1], p[2], g.gstime);
    out.push(ev(cid, `${g.seasonCode}-${g.leagueCode}-${g.gnum}`, start, tbd, team(`${cid}:${g.hcode}`, g.hsname || g.hname), team(`${cid}:${g.acode}`, g.asname || g.aname),
      hs, as, done ? 'final' : 'scheduled', { venue: g.place || '', round: g.roundName || '', broadcast: String(g.gtv || '').split(',').map(s => s.trim()).filter(Boolean) }));
  }
  return out;
}
function parseKovoRank(data, cid) {
  return (data.payload || []).map(t => row(`${cid}:${t.tcode}`, t.tsname, toInt(t.rank), { w: toInt(t.win), l: toInt(t.lost), pts: toNum(t.winp),
    gf: toInt(t.point), ga: toInt(t.lpoint), gd: t.point !== undefined ? (toInt(t.point) || 0) - (toInt(t.lpoint) || 0) : null, streak: t.con || null }));
}
async function fetchKovo(cli, comp) {
  const seasons = await cli.json(`${KOVO}/stat/season-list?gcode=001`, { headers: KOVO_H });
  const list = seasons.payload || []; if (!list.length) throw new SourceError('V리그 시즌 목록 없음');
  const season = list[list.length - 1].seasonCode;
  const sched = await cli.json(`${KOVO}/stat/game-schedule?gcode=001&seasonCode=${season}&leagueCode=201&gender=${comp.gender}`, { headers: KOVO_H });
  const rank = await cli.json(`${KOVO}/stat/league/team-rank?seasonCode=${season}&leagueCode=201&gender=${comp.gender}&round=0&page=0&size=30`, { headers: KOVO_H });
  const events = parseKovoSchedule(sched, comp.id);
  const offseason = !events.some(e => e.status === 'scheduled');
  return { events, standings: standingsOf(parseKovoRank(rank, comp.id), list[list.length - 1].seasonName || season), offseason, season, full: true };
}

/* ───────── 네이버 스포츠 (대체·보완용, 국내에서만 응답) ───────── */
const NAVER_CAT = { kbo: ['kbaseball', 'kbo'], kleague1: ['kfootball', 'kleague'], kbl: ['basketball', 'kbl'], wkbl: ['basketball', 'wkbl'], vleague_m: ['volleyball', 'kovo'], vleague_w: ['volleyball', 'wkovo'] };
async function naverGames(cli, comp, from, to) {
  const [upper, cat] = NAVER_CAT[comp.id] || [];
  if (!upper) throw new SourceError('네이버 대상 아님');
  const out = [];
  for (let a = from; a <= to; a = addDays(a, 31)) {
    const b = new Date(Math.min(addDays(a, 30).getTime(), to.getTime()));
    const j = await cli.json(`https://api-gw.sports.naver.com/schedule/games?fields=basic,superCategoryId,categoryName,stadium,statusNum&upperCategoryId=${upper}&fromDate=${isoDay(kstNow(a))}&toDate=${isoDay(kstNow(b))}&size=500`,
      { headers: { Referer: 'https://m.sports.naver.com/', Accept: 'application/json' } });
    const games = ((j.result || {}).games); if (!Array.isArray(games)) throw new SourceError('네이버 응답 형식 이상');
    for (const g of games) if (g.categoryId === cat) out.push(g);
  }
  return out;
}
function parseNaverGame(comp, g, teamIdByName) {
  const dt = g.gameDateTime ? Date.parse(g.gameDateTime + '+09:00') : NaN; if (!Number.isFinite(dt)) return null;
  const code = String(g.statusCode || '').toUpperCase();
  const status = (g.cancel || /CANCEL/.test(code)) ? 'canceled' : ['RESULT', 'ENDED'].includes(code) ? 'final' : ['STARTED', 'LIVE'].includes(code) ? 'live' : 'scheduled';
  const T = side => { const n = g[`${side}TeamName`]; return team(teamIdByName(n) || `${comp.id}:${g[`${side}TeamCode`] || n}`, n); };
  return ev(comp.id, `n${g.gameId}`, utcIso(dt), false, T('home'), T('away'), toInt(g.homeTeamScore), toInt(g.awayTeamScore), status, { venue: g.stadium || '', status_text: g.statusInfo || '' });
}
// 공식 일정(날짜·대진)에 네이버의 시각·홈/원정을 덧붙인다
async function enrichFromNaver(cli, comp, events, from, to) {
  const games = await naverGames(cli, comp, from, to);
  const key = (day, a, b) => `${day}|${[a, b].sort().join('|')}`;
  const norm = s => String(s || '').replace(/\s/g, '');
  const short = n => WKBL_TEAMS.find(s => norm(n).includes(norm(s).replace('썸', '')) || norm(s).includes(norm(n))) || n;
  const idx = new Map();
  for (const g of games) {
    const day = String(g.gameDate || g.gameDateTime || '').slice(0, 10);
    idx.set(key(day, short(g.homeTeamName), short(g.awayTeamName)), g);
  }
  return events.map(e => {
    const day = isoDay(new Date(Date.parse(e.start) + KST_OFFSET));
    const g = idx.get(key(day, e.home.name, e.away.name)); if (!g || !g.gameDateTime) return e;
    const dt = Date.parse(g.gameDateTime + '+09:00'); if (!Number.isFinite(dt)) return e;
    const homeIsFirst = short(g.homeTeamName) === e.home.name;
    const out = Object.assign({}, e, { start: utcIso(dt), time_tbd: false, ha_unknown: false, venue: g.stadium || e.venue });
    if (!homeIsFirst) { out.home = e.away; out.away = e.home; out.home_score = e.away_score; out.away_score = e.home_score; }
    return out;
  });
}

/* ───────── LoL (esports-api.lolesports.com) ───────── */
const LOL = 'https://esports-api.lolesports.com/persisted/gw';
const LOL_H = { 'x-api-key': '0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z' };
const LOL_COLORS = { T1: '#E2012D', GEN: '#AA8B56', HLE: '#F37321', KT: '#FF0A07', DK: '#1AB5B5', NS: '#DE2027', BFX: '#F5D000', DRX: '#5A8DFF', KRX: '#E3002B', DNS: '#2E6BF0', BRO: '#00A651', FOX: '#E8432E', DNF: '#4C6EF5' };
async function lolLeagueIds(cli, ctx) {
  if (ctx.cache.lolLeagues && ctx.now.getTime() - ctx.cache.lolLeagues.t < 7 * 86400e3) return ctx.cache.lolLeagues.ids;
  const j = await cli.json(`${LOL}/getLeagues?hl=ko-KR`, { headers: LOL_H });
  const ids = Object.fromEntries((((j.data || {}).leagues) || []).map(l => [l.slug, l.id]));
  ctx.cache.lolLeagues = { t: ctx.now.getTime(), ids };
  return ids;
}
function parseLolEvent(comp, e) {
  if (e.type !== 'match' || !e.match) return null;
  const t = e.match.teams || []; if (t.length !== 2) return null;
  const st = e.state === 'completed' ? 'final' : e.state === 'inProgress' ? 'live' : 'scheduled';
  const T = x => team(`lol:${x.code || x.name}`, x.name, { short: x.code || '', color: LOL_COLORS[x.code] || undefined });
  const w = x => (x.result || {}).gameWins;
  const bo = ((e.match.strategy || {}).count) || null;
  const rec = x => x.record ? [toInt(x.record.wins), toInt(x.record.losses)] : null;
  return ev(comp.id, e.match.id, e.startTime, false, T(t[0]), T(t[1]), toInt(w(t[0])), toInt(w(t[1])), st,
    { round: e.blockName || '', ha_unknown: true, bo, league_name: (e.league || {}).name || '', home_rec: rec(t[0]), away_rec: rec(t[1]) });
}
async function fetchLol(cli, comp, ctx) {
  const ids = await lolLeagueIds(cli, ctx); const id = ids[comp.slug];
  if (!id) return { events: [], standings: null, offseason: true, season: '', full: true };
  const raw = []; let token = null; const seen = new Set(); const cutoff = ctx.now.getTime() - (ctx.prevState?.lastFull ? 21 : 200) * 86400e3;
  for (let i = 0; i < 6; i++) {
    const j = await cli.json(`${LOL}/getSchedule?hl=ko-KR&leagueId=${id}${token ? `&pageToken=${encodeURIComponent(token)}` : ''}`, { headers: LOL_H });
    const s = (j.data || {}).schedule || {}; const evs = s.events || []; raw.push(...evs);
    const oldest = Math.min(...evs.map(e => Date.parse(e.startTime)).filter(Number.isFinite));
    token = (s.pages || {}).older;
    if (!token || seen.has(token) || !(oldest > cutoff)) break; seen.add(token);
  }
  let events = raw.map(e => parseLolEvent(comp, e)).filter(Boolean);
  if (comp.id !== 'lck') { // 한국 팀(LCK 팀 또는 국가대표) 경기만
    const lck = new Set(ctx.lckTeams || []);
    events = events.filter(e => lck.has(e.home.id) || lck.has(e.away.id) || /korea|대한민국|한국/i.test(e.home.name + e.away.name));
  }
  const future = events.some(e => Date.parse(e.start) > ctx.now.getTime());
  const recent = events.some(e => Date.parse(e.start) > ctx.now.getTime() - 30 * 86400e3);
  let standings = null;
  if (comp.id === 'lck') standings = lolStandings(events);
  return { events, standings, offseason: !future && !recent, season: '', full: true };
}
// LCK 순위: 가장 최근 정규 시즌 경기들(플레이오프·결승 제외)의 승패·세트 득실로 계산
function lolStandings(events) {
  const reg = events.filter(e => e.status === 'final' && !/플레이오프|결승|플레이-인|선발전|playoff|final/i.test(e.round));
  if (!reg.length) return null;
  const lastYear = new Date(Math.max(...reg.map(e => Date.parse(e.start)))).getUTCFullYear();
  const latest = reg.filter(e => new Date(e.start).getUTCFullYear() === lastYear);
  // 같은 해 안에서도 마지막 정규 구간(경기 사이 공백 21일 이상으로 구분)
  latest.sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  let startIdx = 0; for (let i = 1; i < latest.length; i++) if (Date.parse(latest[i].start) - Date.parse(latest[i - 1].start) > 21 * 86400e3) startIdx = i;
  const seg = latest.slice(startIdx); const m = new Map();
  const r = (t) => { if (!m.has(t.id)) m.set(t.id, { team: t, w: 0, l: 0, sw: 0, sl: 0, rec: null }); return m.get(t.id); };
  for (const e of seg) {
    const h = r(e.home), a = r(e.away), hs = e.home_score || 0, as = e.away_score || 0;
    h.sw += hs; h.sl += as; a.sw += as; a.sl += hs;
    if (hs > as) { h.w++; a.l++; } else if (as > hs) { a.w++; h.l++; }
    if (e.home_rec) h.rec = e.home_rec; if (e.away_rec) a.rec = e.away_rec; // API가 주는 누적 전적이 있으면 그걸 우선
  }
  for (const x of m.values()) if (x.rec && x.rec[0] !== null && x.rec[0] + x.rec[1] >= x.w + x.l) { x.w = x.rec[0]; x.l = x.rec[1]; }
  const rows = [...m.values()].sort((x, y) => (y.w - x.w) || ((y.sw - y.sl) - (x.sw - x.sl)))
    .map((x, i) => row(x.team.id, x.team.name, i + 1, { w: x.w, l: x.l, pct: x.w + x.l ? Math.round(x.w / (x.w + x.l) * 1000) / 1000 : null, gf: x.sw, ga: x.sl, gd: x.sw - x.sl }));
  return standingsOf(rows, lastYear, '전체');
}

/* ───────── F1 (api.jolpi.ca, 옛 Ergast) — 팀(컨스트럭터) 단위로 따라간다 ───────── */
const F1 = 'https://api.jolpi.ca/ergast/f1';
const F1_TEAM_KO = { ferrari: '페라리', mclaren: '맥라렌', red_bull: '레드불', mercedes: '메르세데스', aston_martin: '애스턴 마틴', alpine: '알핀',
  williams: '윌리엄스', rb: '레이싱 불스', audi: '아우디', sauber: '자우버', haas: '하스', cadillac: '캐딜락' };
const F1_DRIVER_KO = { russell: '조지 러셀', antonelli: '키미 안토넬리', leclerc: '샤를 르클레르', hamilton: '루이스 해밀턴', norris: '랜도 노리스',
  piastri: '오스카 피아스트리', max_verstappen: '막스 페르스타펜', hadjar: '이자크 아자르', lawson: '리암 로슨', arvid_lindblad: '아르비드 린드블라드',
  gasly: '피에르 가슬리', colapinto: '프랑코 콜라핀토', bearman: '올리버 베어먼', ocon: '에스테반 오콘', bortoleto: '가브리에우 보르툴레투',
  hulkenberg: '니코 휠켄베르크', alonso: '페르난도 알론소', stroll: '랜스 스트롤', sainz: '카를로스 사인스', albon: '알렉산더 알본',
  tsunoda: '츠노다 유키', bottas: '발테리 보타스', perez: '세르히오 페레스', ryo_hirakawa: '히라카와 료', rafael_camara: '하파엘 카마라', doohan: '잭 두한' };
const GP_KO = { australian: '호주', chinese: '중국', japanese: '일본', miami: '마이애미', canadian: '캐나다', monaco: '모나코', barcelona: '바르셀로나',
  austrian: '오스트리아', british: '영국', belgian: '벨기에', hungarian: '헝가리', dutch: '네덜란드', italian: '이탈리아', spanish: '스페인',
  azerbaijan: '아제르바이잔', bahrain: '바레인', saudi: '사우디아라비아', singapore: '싱가포르', 'united states': '미국', 'mexico city': '멕시코시티',
  'são paulo': '상파울루', brazilian: '브라질', 'las vegas': '라스베이거스', qatar: '카타르', 'abu dhabi': '아부다비', 'emilia romagna': '에밀리아로마냐',
  madrid: '마드리드', portuguese: '포르투갈', turkish: '튀르키예', malaysia: '말레이시아', korean: '한국', 'south african': '남아공', argentine: '아르헨티나' };
const F1_COUNTRY_KO = { malaysia: '말레이시아', bahrain: '바레인', 'saudi arabia': '사우디아라비아', usa: '미국', qatar: '카타르', uae: '아랍에미리트' };
function gpKo(raceName) {
  const name = String(raceName || '');
  const m = /^(.*?) Grand Prix(?: in (.+))?$/i.exec(name); if (!m) return name;
  const key = m[1].toLowerCase(); const hit = GP_KO[key] || Object.entries(GP_KO).find(([k]) => key.includes(k))?.[1] || m[1];
  return `${hit} GP` + (m[2] ? ` (${F1_COUNTRY_KO[m[2].toLowerCase()] || m[2]} 개최)` : '');
}
const f1TeamId = c => `f1:${c}`;
const f1Team = (id, name) => { const b = brand('f1', id.replace(/_/g, '')) || brand('f1', name); return team(f1TeamId(id), F1_TEAM_KO[id] || name, { short: (F1_TEAM_KO[id] || name).slice(0, 3), color: b ? b[0] : null, color2: b ? b[1] : null, brand: !!b }); };
const F1_SESSIONS = [['SprintQualifying', 'sq', '스프린트 예선'], ['Sprint', 's', '스프린트'], ['Qualifying', 'q', '예선'], [null, 'r', '결승']];
async function f1Pages(cli, url, key) { // 결과는 한 줄(드라이버) 단위로 100개씩 나뉘어 온다
  const races = new Map();
  for (let off = 0, total = 1; off < total && off < 1500; off += 100) {
    const j = await cli.json(`${url}${url.includes('?') ? '&' : '?'}limit=100&offset=${off}`);
    const m = j.MRData || {}; total = toInt(m.total) || 0;
    for (const r of ((m.RaceTable || {}).Races) || []) { const cur = races.get(r.round) || []; races.set(r.round, cur.concat(r[key] || [])); }
  }
  return races;
}
function f1Best(rows) { // 팀별 최고 순위 2개 (예: {ferrari: [2, 5]})
  const out = {};
  for (const x of rows) { const c = (x.Constructor || {}).constructorId; const pos = toInt(x.position); if (!c || pos === null) continue; (out[c] ||= []).push(pos); }
  for (const k of Object.keys(out)) out[k] = out[k].sort((a, b) => a - b).slice(0, 2);
  return out;
}
function parseF1Schedule(data, teams, results, sprints, now) {
  const out = [];
  for (const r of ((data.MRData || {}).RaceTable || {}).Races || []) {
    const title = gpKo(r.raceName); const loc = (r.Circuit || {}).Location || {};
    const venue = [(r.Circuit || {}).circuitName, loc.locality].filter(Boolean).join(', ');
    for (const [key, code, label] of F1_SESSIONS) {
      const ses = key ? r[key] : { date: r.date, time: r.time }; if (!ses || !ses.date) continue;
      const tbd = !ses.time; const start = utcIso(Date.parse(`${ses.date}T${ses.time || '00:00:00Z'}`));
      const res = code === 'r' ? (results.get(r.round) ? f1Best(results.get(r.round)) : null) : code === 's' ? (sprints.get(r.round) ? f1Best(sprints.get(r.round)) : null) : null;
      const ended = res && Object.keys(res).length > 0 || Date.parse(start) < now.getTime() - (code === 'r' || code === 's' ? 4 : 2) * 3600e3;
      const status = ended ? 'final' : Date.parse(start) <= now.getTime() ? 'live' : 'scheduled';
      const pseudo = { id: 'f1:race', name: title, short: 'F1' };
      out.push(Object.assign(ev('f1', `${r.season}-${r.round}-${code}`, start, tbd, pseudo, Object.assign({}, pseudo, { name: label }), null, null, status,
        { venue, round: `${r.round}라운드 · ${label}` }), { kind: 'race', title, session: label, participants: teams, results: res }));
    }
  }
  return out;
}
function parseF1Standings(cs, ds) {
  const groups = [];
  const cl = (((cs.MRData || {}).StandingsTable || {}).StandingsLists || [])[0];
  if (cl) groups.push({ name: '컨스트럭터', rows: cl.ConstructorStandings.map(x => { const id = x.Constructor.constructorId;
    return row(f1TeamId(id), F1_TEAM_KO[id] || x.Constructor.name, toInt(x.position), { pts: toNum(x.points), w: toInt(x.wins), gp: null, l: null }); }) });
  const dl = (((ds.MRData || {}).StandingsTable || {}).StandingsLists || [])[0];
  if (dl) groups.push({ name: '드라이버', rows: dl.DriverStandings.map(x => { const d = x.Driver; const c = ((x.Constructors || [])[0] || {}).constructorId;
    return Object.assign(row(`f1d:${d.driverId}`, F1_DRIVER_KO[d.driverId] || `${d.givenName} ${d.familyName}`, toInt(x.position), { pts: toNum(x.points), w: toInt(x.wins), gp: null, l: null }),
      { color_team: c ? f1TeamId(c) : null, sub: c ? (F1_TEAM_KO[c] || c) : '' }); }) });
  groups.forEach(g => g.rows.forEach((r, i) => { r.pos = i + 1; }));
  return groups.length ? { season: (cl || dl).season, groups } : null;
}
async function fetchF1(cli, comp, ctx) {
  const now = ctx.now; const y = now.getUTCFullYear();
  const cur = await cli.json(`${F1}/${y}.json?limit=100`);
  const races = ((cur.MRData || {}).RaceTable || {}).Races || [];
  const last = races.length ? Date.parse(races[races.length - 1].date) + 2 * 86400e3 : 0;
  let season = y, sched = cur;
  if (!races.length || last < now.getTime()) { // 시즌 끝: 다음 시즌 일정이 나왔으면 그걸, 아니면 일정 없이 최종 순위만
    const nx = await cli.json(`${F1}/${y + 1}.json?limit=100`);
    if ((((nx.MRData || {}).RaceTable || {}).Races || []).length) { season = y + 1; sched = nx; } else sched = null;
  }
  const standSeason = races.length ? y : y - 1;
  const cs = await cli.json(`${F1}/${standSeason}/constructorstandings.json`);
  const ds = await cli.json(`${F1}/${standSeason}/driverstandings.json`);
  const standings = parseF1Standings(cs, ds);
  let events = [];
  if (sched) {
    const con = await cli.json(`${F1}/${season}/constructors.json?limit=50`);
    const teams = ((((con.MRData || {}).ConstructorTable || {}).Constructors) || []).map(c => f1TeamId(c.constructorId));
    const started = (((sched.MRData || {}).RaceTable || {}).Races || []).some(r => Date.parse(r.date) < now.getTime());
    const results = started && !ctx.rosterOnly ? await f1Pages(cli, `${F1}/${season}/results.json`, 'Results') : new Map();
    const sprints = started && !ctx.rosterOnly ? await f1Pages(cli, `${F1}/${season}/sprint.json`, 'SprintResults') : new Map();
    events = parseF1Schedule(sched, teams, results, sprints, now);
    ctx.f1Teams = ((((con.MRData || {}).ConstructorTable || {}).Constructors) || []).map(c => f1Team(c.constructorId, c.name));
  }
  return { events, standings, offseason: !sched, season: String(season), full: true, window: events.length ? [events[0].start.slice(0, 10), events[events.length - 1].start.slice(0, 10)] : null };
}

/* ───────── 경기 상세 (라인업 · 타임라인 · 기록) — 경기 상세를 열 때만 받는다 ───────── */
// 서킷 모양: bacinger/f1-circuits (MIT License, Copyright (c) 2019-2025 Tomislav Bacinger)를 0~100 크기로 줄인 것
const CIRCUITS = {"albert_park":{"w":81.6,"h":100.0,"d":"M32.3 73.8L19.3 60.8L19.2 59.9L20.4 56.2L19.8 52.8L18.7 51.2L9.8 42.2L6.9 38.6L4.0 34.3L0.0 26.9L0.3 25.9L0.9 25.6L6.7 24.5L7.6 23.8L8.0 22.1L7.6 12.0L8.5 10.8L16.1 5.4L24.2 2.3L28.4 0.0L33.4 3.1L38.2 3.6L41.1 4.8L44.6 8.1L46.1 11.4L47.9 21.2L47.8 23.3L47.0 25.4L44.0 30.1L42.0 41.5L42.8 47.9L44.7 52.4L48.2 57.1L54.2 62.3L56.6 63.3L62.2 63.4L63.8 63.9L73.2 71.8L75.0 74.0L76.7 77.3L81.6 94.6L81.2 95.3L68.8 100.0L67.1 99.6L65.8 98.6L59.8 88.4L58.8 88.5L54.4 93.1L53.2 93.5L51.3 93.0L32.3 73.8Z","len":5278},"shanghai":{"w":100.0,"h":87.7,"d":"M26.5 78.5L19.0 80.4L16.0 80.5L12.2 78.8L10.5 76.9L9.5 74.6L9.5 72.0L10.0 69.9L11.4 68.2L13.2 67.4L14.9 67.4L16.8 68.5L17.2 70.0L16.2 74.1L17.3 75.7L18.7 76.2L20.9 75.4L21.9 73.7L22.6 71.3L22.5 68.6L19.7 64.5L6.8 49.7L5.3 46.8L0.0 30.5L1.2 29.6L2.7 29.9L5.4 31.9L9.9 37.2L17.3 49.9L19.7 52.5L22.8 54.0L26.4 54.3L29.7 53.4L31.4 52.3L34.2 49.6L38.5 41.0L42.2 38.7L45.2 38.7L47.5 39.9L49.0 41.3L53.2 48.8L54.2 49.1L56.1 48.6L59.5 44.1L59.9 43.2L59.7 41.6L40.5 9.7L38.9 9.6L36.5 12.3L34.7 13.1L33.7 12.9L32.7 12.0L30.6 8.6L30.7 4.6L32.2 1.9L34.7 0.5L39.1 0.1L43.6 1.8L47.1 5.8L99.6 85.3L100.0 87.1L99.4 87.7L98.4 87.6L94.0 84.9L79.9 66.2L78.8 66.1L26.5 78.5Z","len":5451},"suzuka":{"w":100.0,"h":53.4,"d":"M85.4 28.5L99.4 45.7L100.0 48.4L99.0 51.7L97.6 53.2L95.9 53.4L94.2 52.4L88.3 43.9L84.4 43.5L82.5 42.7L79.5 35.7L77.8 34.7L73.1 34.2L71.4 33.2L70.4 31.4L70.3 29.7L71.9 23.9L70.9 21.7L68.8 20.4L64.1 18.8L60.7 19.0L56.0 21.7L50.0 28.9L41.9 29.7L41.3 28.8L40.2 24.1L38.5 14.5L38.7 12.2L40.6 7.6L39.9 6.7L38.6 6.9L34.5 13.6L32.1 15.8L29.9 16.7L24.5 17.0L17.5 14.7L14.2 12.2L11.5 8.5L8.9 2.0L7.8 0.6L6.0 0.0L2.6 0.4L0.7 1.5L0.2 2.3L0.1 4.2L1.2 6.3L5.2 9.8L11.1 13.9L17.7 16.9L42.4 25.5L45.3 25.1L50.0 22.8L60.3 14.0L62.7 15.4L66.6 13.1L70.4 13.3L72.8 14.3L75.4 16.4L85.4 28.5Z","len":5807},"miami":{"w":100.0,"h":39.8,"d":"M49.4 11.1L63.0 19.6L63.2 20.3L62.7 21.6L58.9 24.8L58.6 30.7L57.9 32.2L55.3 34.3L50.3 35.7L45.2 35.4L27.2 25.0L24.0 24.9L21.3 26.0L18.8 27.9L17.1 28.2L14.0 27.2L11.0 24.5L7.8 23.4L4.1 24.3L1.5 26.0L0.4 27.7L0.0 29.4L0.4 31.9L2.0 33.2L6.8 32.8L17.5 35.0L35.5 34.4L49.3 39.0L53.5 39.7L57.7 39.8L62.2 39.0L80.8 32.2L90.0 27.5L93.5 25.3L94.3 24.3L93.4 22.9L90.6 21.0L89.9 18.5L90.2 16.9L91.1 16.0L92.1 15.6L96.7 15.6L98.4 14.2L100.0 11.3L99.9 10.7L98.4 9.9L99.7 4.7L99.0 3.6L13.2 0.0L12.1 0.3L12.3 2.2L17.6 5.9L20.9 6.3L29.5 2.9L32.5 2.6L35.5 3.0L38.3 4.2L49.4 11.1Z","len":5412},"villeneuve":{"w":32.5,"h":100.0,"d":"M27.2 72.4L29.9 85.5L29.3 95.7L31.9 97.2L32.5 98.1L32.1 99.3L30.9 100.0L26.5 99.1L21.9 96.7L16.4 91.8L15.9 90.8L16.4 88.5L16.1 87.5L12.2 82.7L9.3 80.5L8.0 78.1L7.5 75.9L7.3 67.3L6.0 66.7L3.4 66.8L1.8 65.4L1.2 63.8L0.5 60.9L0.0 53.9L0.3 45.6L2.9 33.6L3.8 32.5L6.1 31.8L7.2 30.5L9.6 21.3L10.4 16.9L10.8 10.7L9.2 1.3L9.5 0.1L10.9 0.5L11.5 5.6L19.1 24.4L26.4 59.5L25.1 60.9L25.0 61.8L27.2 72.4Z","len":4361},"monaco":{"w":75.5,"h":100.0,"d":"M49.3 19.5L49.4 17.6L50.5 15.4L61.8 0.3L62.7 0.0L64.6 1.0L65.2 2.0L65.4 4.8L68.3 9.8L69.2 10.4L70.3 9.7L70.4 9.1L67.0 5.0L66.7 3.6L67.1 2.5L73.1 0.4L75.2 0.7L75.2 8.6L73.1 20.1L69.8 26.9L64.0 33.8L59.0 36.8L50.3 40.9L46.5 42.2L35.3 44.5L34.6 46.7L33.7 47.0L32.6 47.2L30.6 46.4L8.6 49.5L7.0 52.1L5.2 57.1L4.9 64.4L8.3 68.3L10.4 79.9L10.0 81.0L8.3 82.0L8.3 83.7L10.1 88.5L12.4 92.3L14.3 94.1L18.0 96.0L18.8 97.8L17.9 98.9L13.1 100.0L11.0 99.9L9.9 99.0L9.5 96.4L5.5 90.6L1.5 77.1L0.5 70.2L0.0 61.5L0.4 56.1L1.9 50.5L1.9 48.2L2.9 47.3L4.6 46.9L13.9 45.7L24.4 42.7L30.2 42.0L39.7 37.8L50.2 35.7L53.7 32.8L54.6 31.4L54.9 28.4L53.3 23.8L49.9 20.7L49.3 19.5Z","len":3337},"catalunya":{"w":81.7,"h":100.0,"d":"M64.3 44.7L33.3 94.2L32.0 95.5L29.6 95.8L25.4 93.6L23.2 93.3L20.9 94.1L14.8 98.7L10.8 100.0L6.5 99.4L3.2 97.1L1.6 95.1L0.3 91.7L0.0 87.5L0.9 83.2L2.4 79.4L14.5 60.6L17.0 59.7L19.9 60.6L21.7 62.3L22.6 64.0L22.9 67.3L22.6 69.9L20.9 73.2L13.3 85.2L13.2 87.6L14.6 89.1L16.9 89.3L30.5 82.9L34.8 78.8L39.9 70.5L39.9 68.6L39.3 67.5L35.2 64.5L33.6 62.3L27.4 47.6L27.3 43.9L28.7 40.9L30.8 38.9L67.5 20.0L69.5 18.6L69.9 17.1L69.2 15.4L67.7 14.1L64.1 13.1L60.7 13.4L53.7 17.8L51.1 17.7L48.9 16.3L47.9 14.3L48.0 11.2L49.5 9.2L59.1 1.2L61.2 0.3L64.0 0.0L66.2 0.7L78.2 8.4L79.9 9.8L81.0 11.6L81.7 14.0L81.4 17.2L64.3 44.7Z","len":4655},"red_bull_ring":{"w":100.0,"h":63.1,"d":"M66.7 56.5L41.5 63.1L27.1 42.0L23.9 36.4L17.1 21.7L14.9 18.1L11.4 13.9L0.3 2.8L0.0 1.3L6.4 0.2L15.2 0.0L46.6 5.1L61.5 5.7L62.8 6.2L63.8 7.9L63.3 9.8L60.7 13.4L58.5 15.3L56.1 16.6L50.1 18.0L34.0 15.8L30.9 16.5L28.6 18.5L27.6 21.3L28.1 25.2L34.3 36.0L37.0 38.1L40.7 38.4L42.6 37.6L47.4 32.4L48.8 31.4L50.6 30.4L55.4 29.0L90.4 28.2L92.0 28.2L94.9 29.7L96.7 32.7L99.8 43.2L100.0 44.2L99.5 45.4L96.6 47.3L92.2 49.4L66.7 56.5Z","len":4318},"silverstone":{"w":59.9,"h":100.0,"d":"M35.6 0.9L48.4 0.1L50.9 1.3L52.8 4.1L55.0 12.5L55.5 16.1L56.3 30.1L58.9 35.5L58.6 37.7L56.8 42.6L56.6 44.5L56.9 45.9L59.4 49.7L59.9 52.2L59.6 53.5L58.5 54.8L52.5 58.9L35.7 89.8L31.3 96.6L29.1 99.1L26.8 100.0L25.6 99.9L22.5 98.4L18.9 92.0L9.3 80.7L8.3 80.3L5.3 82.4L3.4 81.4L1.0 78.0L0.0 74.4L1.3 71.8L17.3 51.0L18.9 49.6L21.3 49.3L29.4 50.2L32.4 49.6L41.9 42.3L43.8 41.6L45.1 42.7L46.9 48.3L48.2 48.8L49.4 47.8L51.2 42.8L51.5 40.2L51.1 38.1L23.4 12.7L20.5 11.5L17.8 12.3L17.0 13.8L16.2 19.1L14.5 20.4L12.2 20.2L10.5 18.2L10.6 16.4L14.7 8.0L19.7 3.4L22.7 2.2L35.6 0.9Z","len":5891},"spa":{"w":61.7,"h":100.0,"d":"M18.6 10.6L13.1 1.0L13.3 0.2L13.8 0.0L20.6 3.2L26.9 7.8L36.8 19.5L41.0 22.6L42.1 24.7L43.1 29.1L50.3 40.9L51.5 43.6L61.7 79.5L61.2 80.9L59.4 82.3L58.8 83.5L59.9 88.8L59.2 91.1L46.2 100.0L44.0 99.3L43.4 98.0L43.6 96.6L44.6 95.5L49.7 92.3L50.5 91.2L50.6 89.7L47.8 81.1L45.5 68.1L43.9 65.9L42.2 65.0L37.0 64.8L34.0 66.1L31.6 69.4L25.7 83.9L24.1 85.1L22.4 85.4L18.9 83.8L16.2 84.0L14.4 85.9L9.2 93.7L8.0 94.2L6.5 93.8L1.5 90.1L0.2 88.1L0.1 85.3L1.5 81.5L3.8 77.9L10.5 71.4L19.9 66.5L23.1 64.0L25.8 59.9L28.9 52.8L29.0 49.3L25.0 39.0L23.9 32.5L23.5 25.5L26.1 25.1L26.5 24.4L18.6 10.6Z","len":7004},"hungaroring":{"w":88.4,"h":100.0,"d":"M22.0 75.3L0.7 58.4L0.1 56.1L0.9 55.0L2.4 54.6L7.5 54.6L12.4 55.8L18.0 58.7L31.5 69.3L34.3 70.1L36.6 69.0L37.9 67.1L37.9 65.4L33.5 57.2L33.3 54.2L45.7 28.5L51.3 20.4L47.8 5.8L48.0 2.9L49.2 1.3L51.0 0.2L53.0 0.0L55.4 0.9L60.6 4.5L69.2 13.8L69.6 15.7L68.2 17.3L68.1 18.5L70.8 29.0L71.8 30.8L73.4 31.9L81.0 33.4L82.8 35.2L83.2 37.7L81.7 48.1L81.8 50.8L82.5 52.9L87.7 61.2L88.3 63.3L88.1 65.8L87.1 67.4L66.9 90.0L65.1 89.7L59.2 83.1L54.2 78.9L51.8 78.1L50.1 78.6L48.7 80.7L49.1 83.3L59.3 91.9L60.1 93.6L60.1 96.0L59.3 97.8L56.3 99.8L53.7 99.8L51.3 98.6L22.0 75.3Z","len":4381},"zandvoort":{"w":100.0,"h":85.2,"d":"M12.2 38.9L27.7 1.9L28.6 0.8L31.4 0.0L32.7 0.3L34.8 2.2L35.3 5.0L30.5 16.5L29.4 20.5L28.8 30.3L26.2 32.8L19.1 35.5L17.8 36.5L17.3 39.4L17.9 40.7L18.9 41.7L20.1 42.2L22.1 42.2L31.6 39.1L36.0 38.3L39.8 38.2L55.8 40.8L61.1 39.5L71.6 33.7L74.1 33.0L79.9 32.7L90.8 33.3L93.2 33.9L95.6 35.1L97.2 36.5L99.3 39.7L100.0 43.8L99.2 47.9L91.1 59.9L87.0 68.9L82.5 69.9L77.4 69.3L71.4 66.8L68.4 64.7L66.5 62.6L66.1 61.3L66.5 59.9L67.6 58.2L69.3 57.2L71.8 56.3L80.0 54.6L83.7 53.2L85.8 51.7L86.6 50.0L86.7 48.1L86.0 46.2L84.3 44.5L82.8 44.0L74.8 43.0L66.7 43.0L58.2 44.1L51.0 45.9L41.6 49.1L31.6 54.0L30.6 53.8L28.6 50.6L27.3 49.8L25.5 49.7L23.8 50.5L22.4 53.1L26.7 78.4L26.4 81.4L25.0 83.6L23.4 84.7L21.6 85.1L12.7 85.1L8.2 84.1L3.8 81.2L1.1 77.2L0.0 72.5L0.2 68.9L0.9 66.3L12.2 38.9Z","len":4259},"monza":{"w":57.9,"h":100.0,"d":"M1.9 63.5L4.3 35.5L4.7 34.9L6.0 34.9L6.4 34.3L5.0 28.3L5.5 20.1L6.6 16.2L8.6 13.1L11.9 10.2L17.7 7.8L38.1 6.1L39.3 4.2L52.4 0.2L54.4 0.1L55.7 0.9L56.9 3.1L57.9 13.8L57.6 15.2L41.4 24.5L18.6 44.7L18.5 48.9L17.8 50.2L15.8 52.1L15.4 53.4L10.7 97.0L9.9 98.7L7.2 100.0L4.4 99.2L1.9 96.8L0.4 93.0L0.0 81.0L1.9 63.5Z","len":5793},"madring":{"w":62.1,"h":100.0,"d":"M39.3 94.5L29.0 96.3L28.4 96.7L28.0 99.4L24.4 100.0L22.7 99.9L20.6 99.0L19.1 97.6L7.0 78.3L4.9 73.9L3.7 69.5L3.4 63.2L3.8 60.2L6.2 54.8L5.1 53.9L5.9 52.1L5.0 48.3L2.8 44.2L1.3 38.7L0.0 36.4L0.0 35.8L2.3 33.6L2.3 32.6L0.2 28.4L0.0 21.6L0.2 19.3L4.0 15.8L4.6 14.5L4.4 12.1L2.4 7.1L2.2 5.5L2.3 3.9L3.0 2.4L4.1 1.1L5.7 0.3L9.4 0.1L13.0 2.6L14.1 4.5L14.3 8.5L13.5 10.6L11.9 13.5L6.3 20.4L3.2 25.4L3.5 26.5L8.6 30.4L11.0 33.0L11.5 41.5L13.1 44.3L14.1 45.4L17.1 46.8L24.6 46.8L27.9 45.3L30.5 48.9L34.2 55.4L36.5 56.3L43.0 55.8L45.1 56.5L47.2 59.2L50.2 75.3L51.1 75.5L53.2 74.3L58.4 73.7L58.9 74.2L61.0 82.1L62.0 88.0L62.1 89.6L61.2 90.6L39.3 94.5Z","len":5474},"baku":{"w":100.0,"h":73.6,"d":"M92.0 18.7L99.3 15.6L100.0 14.4L93.8 0.3L93.0 0.0L77.5 6.1L55.7 16.0L54.8 16.5L54.7 17.5L58.4 27.3L50.8 30.6L45.4 33.9L44.5 35.0L44.9 38.0L30.5 49.1L29.9 49.1L29.4 48.5L26.5 40.2L22.0 39.4L20.5 36.3L14.2 38.4L8.4 41.2L3.1 44.5L0.1 54.2L0.7 66.2L14.1 73.1L16.1 73.5L21.0 64.7L29.1 57.3L30.8 49.9L31.3 49.1L44.0 39.5L92.0 18.7Z","len":6003},"sepang":{"w":100.0,"h":81.9,"d":"M29.3 44.3L3.4 46.4L1.2 45.8L0.4 45.0L0.0 42.8L0.4 41.5L1.4 40.6L2.8 40.2L7.3 41.5L8.3 41.4L9.4 39.5L9.2 38.2L6.3 34.4L4.9 31.1L4.6 27.3L5.1 22.3L5.9 20.0L8.3 16.0L12.3 13.0L26.2 8.3L46.1 0.0L48.0 0.6L52.3 21.3L54.5 25.1L58.5 27.8L62.4 28.3L64.6 28.0L68.4 26.0L71.5 22.7L73.0 21.7L75.4 20.9L79.5 21.1L82.5 22.9L99.9 42.8L100.0 43.7L96.6 51.5L95.8 52.1L78.8 53.3L63.9 55.0L55.8 56.3L55.0 57.0L54.8 58.0L55.4 59.2L61.3 62.4L62.5 63.7L63.9 67.6L62.9 75.1L59.4 81.0L57.2 81.9L55.0 81.1L36.8 66.1L35.5 65.6L32.1 65.9L23.7 69.9L19.7 70.2L16.3 69.5L13.9 68.6L12.4 67.4L10.4 64.7L9.6 61.5L10.4 60.1L12.2 59.3L84.4 46.0L85.4 45.1L86.2 43.4L85.8 41.9L84.5 40.6L82.3 40.2L29.3 44.3Z","len":5543},"marina_bay":{"w":100.0,"h":64.8,"d":"M97.8 24.7L100.0 41.8L99.3 43.7L95.9 48.3L87.7 47.9L76.9 46.6L75.5 45.4L74.7 41.6L44.9 40.0L40.8 39.3L39.0 38.4L28.4 29.2L26.8 29.2L25.6 30.1L24.4 34.0L18.5 63.6L17.6 64.7L16.3 64.8L13.7 61.1L6.9 54.9L6.3 52.8L6.8 49.8L3.3 48.3L0.7 46.2L0.2 45.3L0.0 43.0L13.2 19.5L14.6 18.2L16.0 17.9L18.8 19.8L25.2 26.5L26.3 26.7L32.7 15.1L33.9 14.0L53.6 25.3L56.6 26.4L84.0 28.3L86.3 27.5L87.4 26.8L88.1 25.5L88.0 21.5L87.3 17.8L83.9 7.9L84.2 2.4L85.8 0.1L87.2 0.2L88.7 2.1L91.0 3.5L94.1 3.7L95.4 4.7L97.8 24.7Z","len":4928},"americas":{"w":100.0,"h":57.3,"d":"M20.1 46.8L29.1 54.0L33.5 56.9L34.8 57.3L35.3 56.2L32.4 47.2L32.8 44.0L34.3 41.7L43.4 36.0L44.7 34.5L46.6 30.7L50.4 28.6L51.1 27.6L51.9 23.5L53.8 21.3L56.2 19.9L58.1 19.8L65.1 22.6L67.7 20.8L70.1 18.0L71.8 17.1L74.0 17.7L76.1 20.0L86.5 17.7L99.2 2.5L99.9 0.5L98.8 0.0L81.4 5.3L64.6 9.0L36.2 12.7L35.9 13.4L40.7 19.7L42.3 22.3L42.3 23.2L41.3 23.9L37.7 23.8L37.0 23.1L35.5 19.9L33.3 17.7L30.2 17.5L30.0 18.5L35.1 27.5L35.2 29.0L33.5 33.0L29.2 35.2L25.9 35.1L22.2 33.3L15.8 24.5L14.5 23.9L11.9 24.6L1.0 29.4L0.0 30.6L0.7 31.5L20.1 46.8Z","len":5514},"rodriguez":{"w":100.0,"h":72.2,"d":"M18.3 1.4L74.2 8.7L92.6 11.4L97.4 12.7L97.0 18.6L100.0 20.7L99.0 26.6L97.0 31.2L88.6 45.6L77.8 62.5L77.8 63.7L81.5 66.3L81.3 67.1L75.1 71.9L74.1 72.2L72.6 71.4L72.5 70.1L75.0 49.3L74.4 48.3L69.0 44.4L67.7 41.3L66.2 39.5L64.2 38.4L53.9 36.7L52.9 35.7L51.5 31.5L50.5 30.1L40.1 24.6L13.7 20.4L13.2 19.7L12.3 9.0L11.8 8.2L10.7 8.1L8.2 10.5L0.3 8.5L0.3 6.5L1.5 3.7L2.6 2.3L5.5 0.4L8.3 0.0L18.3 1.4Z","len":4304},"interlagos":{"w":63.2,"h":100.0,"d":"M6.1 71.8L12.3 95.7L14.9 99.6L15.9 100.0L18.0 99.8L22.7 95.5L24.4 95.1L28.4 97.2L32.2 98.5L35.0 98.8L38.5 98.2L40.3 97.5L43.8 95.2L47.1 90.7L50.4 80.3L63.0 31.6L63.1 29.4L62.2 27.8L59.9 26.5L50.6 24.8L46.2 25.6L43.6 27.1L39.5 31.6L22.3 55.2L21.5 56.1L19.2 57.2L14.0 57.1L9.1 54.4L7.5 51.0L5.9 42.8L5.8 39.6L6.2 38.4L7.2 37.6L9.3 37.5L13.1 40.0L15.2 40.5L16.9 40.0L18.1 39.0L19.2 36.9L19.1 34.9L17.7 32.7L13.9 28.9L11.3 25.6L9.5 17.9L9.6 16.7L10.5 15.4L11.6 15.1L13.0 15.5L19.8 23.2L21.5 24.4L25.6 25.5L30.0 24.8L33.0 22.7L33.9 21.5L42.9 7.1L43.1 5.9L42.6 4.5L40.4 3.0L31.3 0.0L22.4 1.6L12.9 5.9L9.2 9.0L7.3 11.5L5.9 15.1L3.8 23.6L0.3 38.9L0.0 43.1L0.5 48.2L6.1 71.8Z","len":4309},"vegas":{"w":60.0,"h":100.0,"d":"M54.9 88.8L58.8 84.2L58.9 83.4L58.0 82.1L55.9 81.5L54.0 81.9L49.4 85.4L47.0 85.7L43.9 84.1L42.1 80.8L41.7 36.9L42.5 35.9L54.3 36.1L55.7 35.8L57.9 33.7L59.6 30.6L60.0 27.9L59.9 27.0L57.7 26.3L57.1 24.7L59.2 20.2L59.0 19.2L58.0 18.5L56.1 18.3L41.7 17.9L36.4 17.1L34.6 16.3L32.7 14.3L28.5 5.0L26.9 3.3L23.5 1.5L17.3 0.1L5.4 23.1L2.0 35.3L0.9 46.9L1.0 61.7L0.0 96.3L2.3 97.1L5.3 99.5L7.1 99.8L38.2 99.9L45.2 98.7L46.9 97.8L54.9 88.8Z","len":6201},"losail":{"w":84.7,"h":100.0,"d":"M14.9 60.5L0.3 33.9L0.2 31.1L1.5 29.1L4.2 28.1L5.6 28.4L16.1 34.7L18.4 35.1L19.9 34.6L21.8 32.2L21.8 21.8L22.8 18.5L38.4 1.1L39.2 0.5L41.7 0.0L43.9 0.9L48.4 5.1L48.9 6.0L49.1 8.3L48.1 10.3L38.4 21.0L38.0 22.6L38.7 23.9L39.4 24.3L41.0 24.2L58.8 17.1L61.3 17.1L62.4 17.7L63.3 18.6L64.1 20.8L64.1 21.8L63.1 23.9L59.7 27.2L57.5 30.7L55.7 36.8L54.5 38.8L52.7 39.8L43.1 42.2L41.6 43.3L41.1 45.1L41.2 46.5L44.1 49.7L46.8 51.8L49.7 53.4L55.6 55.1L58.5 55.4L76.0 53.5L77.3 53.7L80.0 55.4L81.1 56.9L84.4 63.1L84.7 65.1L83.9 67.4L78.7 75.8L77.1 76.8L74.7 77.1L58.2 73.7L55.8 74.1L54.8 74.8L42.6 98.0L40.7 99.8L39.1 100.0L36.9 99.4L35.7 98.4L14.9 60.5Z","len":5380},"yas_marina":{"w":46.9,"h":100.0,"d":"M22.9 56.0L36.8 54.1L38.1 53.3L38.5 51.7L36.1 41.4L35.2 39.7L33.6 38.6L29.7 37.3L27.4 36.0L25.3 33.7L24.7 32.3L24.5 30.0L26.2 23.4L26.5 18.6L24.4 1.8L23.9 0.8L22.2 0.0L21.3 0.3L20.4 1.6L18.7 7.9L6.4 44.6L0.1 65.6L0.9 65.9L3.6 65.6L6.3 73.7L8.6 77.4L12.6 81.4L25.9 91.8L30.2 94.4L42.3 100.0L44.4 99.8L45.4 99.2L46.3 98.2L46.9 96.1L46.3 93.4L44.4 91.5L42.2 90.9L30.5 89.8L23.7 85.4L22.2 78.1L27.3 77.0L28.5 76.3L29.0 74.8L29.0 70.8L28.3 69.7L25.1 69.1L14.1 70.7L11.4 70.2L10.5 69.3L6.4 61.9L6.1 59.6L6.6 58.6L22.9 56.0Z","len":5281},"bahrain":{"w":67.5,"h":100.0,"d":"M2.2 47.4L3.0 19.3L3.7 1.0L4.0 0.1L5.6 0.2L10.0 4.5L11.0 4.9L18.7 2.7L21.7 2.6L65.0 11.0L66.5 11.4L67.3 12.2L67.5 13.3L66.8 15.4L64.8 17.5L58.1 22.5L52.9 27.8L49.5 34.4L47.6 35.6L46.0 35.8L41.3 35.0L37.6 35.9L26.6 49.3L25.7 50.1L24.4 50.3L23.5 49.7L23.3 46.4L27.1 22.2L25.9 18.3L21.9 14.9L20.8 14.8L19.0 26.1L17.9 46.0L16.9 71.5L17.1 73.5L17.9 74.7L20.9 75.7L22.7 75.6L24.9 75.1L29.1 72.7L32.1 68.9L35.4 61.1L38.0 58.5L39.7 57.4L42.2 56.8L46.8 57.2L56.1 61.8L58.7 63.9L60.0 66.3L60.0 67.3L59.4 68.5L56.6 70.8L5.5 99.5L3.1 100.0L2.5 99.4L0.2 94.6L0.0 92.7L0.7 69.2L2.2 47.4Z","len":5412},"jeddah":{"w":21.4,"h":100.0,"d":"M15.8 77.0L10.7 62.1L8.7 62.1L8.1 61.2L9.3 56.2L7.7 46.0L5.2 44.4L4.3 42.5L4.4 40.4L5.8 38.0L5.9 36.2L5.4 34.4L3.1 32.1L2.9 31.3L3.1 27.0L4.4 25.7L6.3 24.9L6.7 24.2L8.5 16.7L7.9 1.7L7.4 0.6L6.1 0.0L4.2 0.8L3.5 2.8L3.8 4.7L6.2 9.2L6.3 13.5L4.3 18.1L3.9 21.5L1.7 22.6L0.4 24.0L0.0 27.9L0.2 29.9L3.0 37.1L3.2 43.8L6.3 49.8L7.3 52.9L7.5 57.2L6.7 61.8L9.5 65.4L10.1 68.3L9.9 69.9L6.7 76.3L6.2 78.7L6.3 81.7L8.0 87.7L11.3 93.4L14.3 96.3L19.0 99.6L20.5 99.8L21.4 98.9L21.3 98.3L18.9 86.7L15.8 77.0Z","len":6175},"imola":{"w":100.0,"h":51.7,"d":"M63.4 6.0L61.7 6.0L50.6 3.6L44.4 3.2L32.8 4.2L26.4 6.0L25.3 9.2L19.4 12.4L18.6 13.2L10.2 34.1L10.1 35.3L11.0 38.6L10.7 39.7L0.4 48.7L0.0 49.7L0.5 51.1L2.3 51.7L20.2 49.5L32.6 51.0L34.2 49.8L35.1 48.2L36.7 43.3L36.6 40.0L34.6 30.1L37.5 25.3L38.6 25.0L41.8 26.2L65.0 26.0L65.8 27.5L66.6 27.6L75.8 23.8L80.8 20.5L90.4 11.2L99.9 6.4L99.9 5.0L97.3 0.2L95.5 0.2L81.3 5.5L78.7 6.1L63.4 6.0Z","len":4909},"ricard":{"w":100.0,"h":62.4,"d":"M52.4 35.6L70.4 49.2L71.2 48.8L71.5 44.4L72.8 43.0L74.1 42.5L76.4 42.7L80.3 46.2L84.8 47.8L88.5 47.8L94.2 45.5L95.7 45.9L96.7 47.4L96.6 49.4L92.2 56.1L90.9 59.1L92.3 61.3L95.1 62.4L97.0 62.0L98.5 61.1L100.0 58.1L99.8 45.2L98.6 42.7L96.4 40.6L70.1 30.5L64.5 26.7L62.1 23.9L61.0 24.0L58.7 26.0L57.9 26.0L11.2 8.5L10.0 7.5L7.4 2.5L5.6 0.9L3.2 0.0L1.3 1.0L0.1 5.5L5.2 5.7L6.3 7.1L6.1 9.7L7.0 11.0L16.8 16.0L22.0 19.9L24.0 21.9L27.7 24.0L29.6 24.3L32.1 22.2L34.8 22.2L52.4 35.6Z","len":5842},"portimao":{"w":58.7,"h":100.0,"d":"M9.5 42.0L0.1 9.3L0.4 7.8L10.5 0.3L11.6 0.0L23.5 2.7L24.1 3.3L24.4 4.4L23.6 5.8L16.4 10.3L15.0 13.3L15.2 15.1L27.1 56.9L27.7 58.8L28.5 59.5L30.2 59.0L30.7 58.2L32.3 41.9L31.4 37.1L24.5 23.8L24.4 21.1L25.9 18.4L30.5 12.9L32.0 12.5L34.1 13.4L34.6 14.2L38.3 39.5L39.6 43.1L42.8 45.8L55.2 52.2L57.4 54.9L58.7 59.0L58.5 60.0L57.3 61.3L43.2 65.8L40.7 68.3L39.7 70.1L37.7 82.7L37.8 83.7L39.2 85.3L40.5 85.4L42.0 84.9L50.2 74.9L51.4 74.3L52.7 74.0L54.3 74.4L55.6 75.6L56.5 76.9L57.3 79.8L57.0 82.2L54.8 85.7L46.5 95.7L43.1 98.3L37.9 100.0L35.5 100.0L31.8 99.2L28.1 97.3L24.0 92.4L9.5 42.0Z","len":4653},"istanbul":{"w":100.0,"h":87.8,"d":"M35.2 82.3L51.9 78.3L52.5 77.2L50.7 70.0L50.7 68.4L51.1 66.1L52.5 63.6L54.8 61.4L59.5 58.6L65.5 56.4L71.7 55.2L77.8 55.0L80.9 55.5L83.7 54.6L85.1 53.2L86.1 49.9L85.6 43.8L86.4 43.2L93.7 43.6L95.2 43.2L95.9 42.4L95.3 36.9L93.7 35.1L68.6 22.3L67.0 21.1L66.4 20.0L66.8 17.9L67.5 17.1L69.6 15.9L71.4 15.4L73.0 15.3L80.6 16.7L91.8 19.5L97.8 16.5L100.0 10.8L100.0 9.6L97.6 5.2L93.3 0.7L90.3 0.0L87.8 0.3L55.9 9.8L54.1 10.8L53.4 11.6L53.5 12.8L55.5 16.2L55.5 18.0L45.3 49.5L44.0 51.1L42.1 53.0L0.9 75.3L0.2 76.1L0.2 78.2L1.0 79.3L1.9 79.6L4.7 79.4L5.8 80.3L4.9 86.3L5.1 87.2L5.7 87.8L35.2 82.3Z","len":5338},"nurburgring":{"w":73.5,"h":100.0,"d":"M62.6 15.8L40.7 38.0L33.2 43.4L31.8 43.3L31.7 41.7L32.3 39.6L35.0 33.9L34.6 31.9L33.2 30.3L31.4 29.7L26.5 30.3L22.9 31.4L21.0 32.8L20.9 35.3L21.7 36.1L25.9 36.4L27.2 37.4L27.3 38.2L25.1 52.6L21.0 66.7L21.5 68.4L22.8 69.9L28.8 73.1L29.5 74.3L29.2 76.3L16.6 84.1L10.2 90.6L4.7 98.8L3.0 100.0L1.4 99.7L0.2 98.5L0.3 95.9L13.6 82.6L14.6 80.9L14.9 78.1L14.0 74.5L13.8 71.4L21.6 46.3L20.6 44.0L12.0 40.2L11.0 39.4L10.2 36.3L10.9 34.5L25.7 16.5L27.4 15.2L55.2 7.5L55.3 4.7L59.9 2.5L71.1 0.0L73.0 1.4L73.5 2.9L73.1 5.0L62.6 15.8Z","len":5148},"hockenheimring":{"w":100.0,"h":62.8,"d":"M8.2 46.3L0.1 30.6L0.2 29.4L2.8 23.5L5.7 19.0L23.9 0.1L25.1 0.3L26.4 1.8L27.2 7.3L29.2 9.8L35.1 13.2L43.4 17.2L54.7 20.0L61.7 20.6L70.1 19.6L79.1 16.8L98.4 9.5L99.6 9.5L99.9 9.9L99.5 11.2L75.5 26.7L56.6 24.7L55.8 26.1L55.8 29.5L58.6 35.4L58.4 36.8L57.3 38.7L55.0 40.7L36.2 53.0L33.4 53.3L30.8 52.2L20.1 39.8L18.7 38.9L16.5 39.2L15.5 40.4L15.2 41.9L17.1 47.9L18.4 49.3L22.5 51.5L25.5 55.5L26.0 57.0L25.2 59.0L19.9 62.7L17.3 62.6L15.6 61.2L8.2 46.3Z","len":4574},"mugello":{"w":70.5,"h":100.0,"d":"M34.9 48.4L39.9 37.6L48.8 22.4L56.9 2.7L59.1 0.3L62.1 0.2L63.2 0.9L64.6 3.0L64.6 5.3L63.0 14.5L63.2 16.1L64.3 17.7L69.3 20.8L70.4 23.0L70.5 25.1L69.3 27.6L55.7 48.3L55.5 51.1L57.6 56.3L56.8 59.5L42.2 77.3L40.1 78.3L31.6 78.4L28.0 80.5L26.6 82.8L21.9 95.4L19.1 98.7L16.5 99.8L13.6 99.9L9.7 98.9L2.6 95.0L0.3 91.6L0.0 88.8L4.2 66.6L4.7 65.6L6.4 64.6L13.2 64.1L15.7 62.0L22.8 37.9L23.9 35.6L25.8 34.2L26.9 33.9L29.4 34.2L31.5 36.1L32.2 38.7L32.0 40.0L29.5 44.5L25.1 50.3L24.8 57.1L23.7 59.3L6.0 83.2L5.1 85.2L5.0 87.9L6.1 90.4L8.7 92.2L11.7 92.2L13.3 91.6L16.2 89.1L17.8 86.8L34.9 48.4Z","len":5245}};
const ST_KO = {
  soccer: { possessionPct: '점유율', totalShots: '슈팅', shotsOnTarget: '유효 슈팅', wonCorners: '코너킥', foulsCommitted: '파울', offsides: '오프사이드', yellowCards: '경고', redCards: '퇴장', saves: '선방', totalPasses: '패스', accuratePasses: '정확한 패스' },
  basketball: { fieldGoalPct: '야투 성공률', threePointFieldGoalPct: '3점슛 성공률', freeThrowPct: '자유투 성공률', totalRebounds: '리바운드', assists: '어시스트', steals: '스틸', blocks: '블록', totalTurnovers: '턴오버', pointsInPaint: '페인트존 득점', fastBreakPoints: '속공 득점', fouls: '파울' },
  football: { totalYards: '전체 전진', netPassingYards: '패스 전진', rushingYards: '러시 전진', firstDowns: '퍼스트다운', thirdDownEff: '3rd 다운 성공', turnovers: '턴오버', totalPenaltiesYards: '반칙-야드', possessionTime: '공격 시간' },
  hockey: { shotsTotal: '유효 슈팅', hits: '히트', blockedShots: '블록', faceoffPercent: '페이스오프 승률', powerPlayGoals: '파워플레이 골', giveaways: 'giveaway 실수', takeaways: '공 뺏기', penaltyMinutes: '페널티 시간(분)' },
  baseball: { hits: '안타', homeRuns: '홈런', RBIs: '타점', walks: '볼넷', strikeouts: '삼진', errors: '실책', leftOnBase: '잔루' },
};
const pnum = v => { const n = parseFloat(String(v).replace(/[^0-9.\-]/g, '')); return Number.isFinite(n) ? n : null; };
function sideOf(ids, teamId) { return teamId == null ? null : String(teamId) === String(ids.home) ? 'home' : String(teamId) === String(ids.away) ? 'away' : null; }
function espnHeader(d) {
  const comp0 = ((d.header || {}).competitions || [])[0] || {};
  const cs = comp0.competitors || [];
  const T = ha => { const c = cs.find(x => x.homeAway === ha) || {}; const t = c.team || {};
    return { id: t.id, abbr: t.abbreviation || '', name: t.displayName || '', score: c.score ?? null, lines: (c.linescores || []).map(l => l.displayValue), hits: c.hits ?? null, errors: c.errors ?? null }; };
  const st = ((comp0.status || {}).type || {});
  return { home: T('home'), away: T('away'), state: st.state || '', detail: st.shortDetail || st.description || '' };
}
function espnBoxStats(d, sport) {
  const ko = ST_KO[sport] || {}; const teams = (d.boxscore || {}).teams || [];
  if (teams.length !== 2) return [];
  const flat = t => { const o = {}; for (const s of t.statistics || []) { if (s.stats) for (const x of s.stats) { if (!(x.name in o)) o[x.name] = x.displayValue; } else o[s.name] = s.displayValue; } return o; };
  const hi = teams.findIndex(t => t.homeAway === 'home'); const H = flat(teams[hi < 0 ? 1 : hi]), A = flat(teams[hi < 0 ? 0 : 1 - hi]);
  return Object.keys(ko).filter(k => k in H || k in A).map(k => {
    let h = H[k] ?? '-', a = A[k] ?? '-';
    if (k === 'possessionPct') { h = `${pnum(h)}%`; a = `${pnum(a)}%`; }
    if (/Pct|Percent/.test(k) && sport !== 'soccer') { h = `${h}%`; a = `${a}%`; }
    return { label: ko[k], home: String(h), away: String(a), hv: pnum(h), av: pnum(a) };
  });
}
function soccerDetail(d) {
  const hd = espnHeader(d); const ids = { home: hd.home.id, away: hd.away.id };
  const marks = {}; const tl = [];
  const mk = n => (marks[n] ||= {});
  for (const k of d.keyEvents || []) {
    const ty = (k.type || {}).text || ''; const who = k.participants || []; const t = (k.clock || {}).displayValue || '';
    const side = sideOf(ids, (k.team || {}).id); const nm = i => ((who[i] || {}).athlete || {}).displayName || '';
    if (ty === 'Halftime') { tl.push({ t, side: null, kind: 'phase', text: '전반 종료' }); continue; }
    if (/Goal|Penalty - Scored/.test(ty) && !/Disallowed|Missed|Saved/.test(ty)) {
      const og = /Own Goal/i.test(ty); mk(nm(0)).goals = (mk(nm(0)).goals || 0) + 1;
      tl.push({ t, side, kind: 'goal', text: `${nm(0)}${/Penalty/.test(ty) ? ' (PK)' : og ? ' (자책)' : ''}`, sub: who[1] ? `도움 ${nm(1)}` : '' });
    } else if (/Yellow Card|Red Card/.test(ty)) {
      const red = /Red/.test(ty); mk(nm(0)).card = red ? 'red' : (mk(nm(0)).card === 'yellow' ? 'red' : 'yellow');
      tl.push({ t, side, kind: red ? 'red' : 'yellow', text: nm(0) });
    } else if (ty === 'Substitution' && who.length > 1) {
      mk(nm(0)).subIn = t; mk(nm(1)).subOut = t;
      tl.push({ t, side, kind: 'sub', text: nm(0), sub: nm(1) });
    } else if (/Penalty - Missed|Penalty - Saved/.test(ty)) tl.push({ t, side, kind: 'miss', text: `${nm(0)} PK 실축` });
  }
  const lineup = {};
  for (const r of d.rosters || []) {
    const P = x => { const n = ((x.athlete || {}).displayName) || ''; const m = marks[n] || {};
      return { n: x.jersey || '', name: (x.athlete || {}).shortName || n, full: n, pos: ((x.position || {}).abbreviation) || '', place: pnum(x.formationPlace) || 0, ...m }; };
    const ro = r.roster || [];
    lineup[r.homeAway] = { formation: r.formation || '', starters: ro.filter(x => x.starter).map(P), bench: ro.filter(x => !x.starter).map(P) };
  }
  const has = lineup.home && lineup.home.starters.length >= 7;
  return { kind: 'soccer', ...hd, lineup: has ? lineup : null, timeline: tl, stats: espnBoxStats(d, 'soccer') };
}
function nbaDetail(d) {
  const hd = espnHeader(d); const lineup = {};
  for (const bp of (d.boxscore || {}).players || []) {
    const side = String(bp.team.id) === String(hd.home.id) ? 'home' : 'away';
    const s0 = (bp.statistics || [])[0] || {}; const li = (s0.labels || []).indexOf('PTS'); const lm = (s0.labels || []).indexOf('MIN');
    const P = a => ({ n: (a.athlete || {}).jersey || '', name: (a.athlete || {}).shortName || (a.athlete || {}).displayName, pos: (((a.athlete || {}).position) || {}).abbreviation || '', pts: li >= 0 && a.stats ? a.stats[li] : null, min: lm >= 0 && a.stats ? a.stats[lm] : null, dnp: !!a.didNotPlay });
    const all = s0.athletes || [];
    lineup[side] = { starters: all.filter(a => a.starter).map(P), bench: all.filter(a => !a.starter).map(P) };
  }
  const n = Math.max(hd.home.lines.length, hd.away.lines.length);
  const labels = Array.from({ length: n }, (_, i) => i < 4 ? `${i + 1}Q` : `OT${i - 3 > 1 ? i - 3 : ''}`);
  const tl = []; let h = 0, a = 0;
  for (let i = 0; i < n; i++) { h += pnum(hd.home.lines[i]) || 0; a += pnum(hd.away.lines[i]) || 0; tl.push({ t: labels[i], side: null, kind: 'period', text: `${labels[i]} ${hd.home.lines[i] ?? '-'} : ${hd.away.lines[i] ?? '-'}`, sub: `누적 ${h} : ${a}` }); }
  return { kind: 'basketball', ...hd, lineup: lineup.home && lineup.home.starters.length ? lineup : null, periods: { labels, home: hd.home.lines, away: hd.away.lines }, timeline: tl, stats: espnBoxStats(d, 'basketball') };
}
function mlbDetail(d) {
  const hd = espnHeader(d); const ids = { home: hd.home.id, away: hd.away.id }; const lineup = {};
  for (const r of d.rosters || []) {
    const ro = r.roster || []; const seen = new Set();
    const order = ro.filter(x => x.starter && x.batOrder).sort((a, b) => a.batOrder - b.batOrder).filter(x => !seen.has(x.batOrder) && seen.add(x.batOrder))
      .map(x => ({ n: x.jersey || '', name: (x.athlete || {}).shortName || (x.athlete || {}).displayName, pos: ((x.position || {}).abbreviation) || '', order: x.batOrder }));
    const bench = ro.filter(x => !x.starter).map(x => ({ n: x.jersey || '', name: (x.athlete || {}).shortName || (x.athlete || {}).displayName, pos: ((x.position || {}).abbreviation) || '' }));
    lineup[r.homeAway] = { starters: order, bench };
  }
  for (const bp of (d.boxscore || {}).players || []) { // 선발 투수
    const side = String(bp.team.id) === String(hd.home.id) ? 'home' : 'away';
    const pit = (bp.statistics || []).find(s => s.type === 'pitching'); const sp = pit && (pit.athletes || []).find(a => a.starter);
    if (sp && lineup[side]) lineup[side].pitcher = { n: (sp.athlete || {}).jersey || '', name: (sp.athlete || {}).shortName || (sp.athlete || {}).displayName, pos: 'P' };
  }
  const n = Math.max(hd.home.lines.length, hd.away.lines.length, 9);
  const tl = (d.plays || []).filter(p => p.scoringPlay).map(p => ({ t: `${(p.period || {}).number}회${(p.period || {}).type === 'Top' ? '초' : '말'}`, side: sideOf(ids, (p.team || {}).id), kind: 'run', text: p.text || '', sub: `${p.homeScore ?? ''} : ${p.awayScore ?? ''}` }));
  return { kind: 'baseball', ...hd, lineup: lineup.home && lineup.home.starters.length ? lineup : null,
    periods: { labels: Array.from({ length: n }, (_, i) => String(i + 1)), home: hd.home.lines, away: hd.away.lines, extra: { labels: ['R', 'H', 'E'], home: [hd.home.score, hd.home.hits, hd.home.errors], away: [hd.away.score, hd.away.hits, hd.away.errors] } },
    timeline: tl, stats: espnBoxStats(d, 'baseball') };
}
function nflDetail(d) {
  const hd = espnHeader(d); const ids = { home: hd.home.id, away: hd.away.id };
  const n = Math.max(hd.home.lines.length, hd.away.lines.length);
  const labels = Array.from({ length: n }, (_, i) => i < 4 ? `${i + 1}Q` : 'OT');
  const tl = (d.scoringPlays || []).map(p => ({ t: `${labels[((p.period || {}).number || 1) - 1] || ''} ${(p.clock || {}).displayValue || ''}`.trim(), side: sideOf(ids, (p.team || {}).id), kind: 'score', text: `${(p.type || {}).text || ''}`, sub: `${p.text || ''} · ${p.homeScore} : ${p.awayScore}` }));
  const leaders = [];
  for (const bp of (d.boxscore || {}).players || []) {
    const side = String(bp.team.id) === String(hd.home.id) ? 'home' : 'away';
    for (const [cat, ko, cols] of [['passing', '패스', ['C/ATT', 'YDS', 'TD']], ['rushing', '러시', ['CAR', 'YDS', 'TD']], ['receiving', '리시브', ['REC', 'YDS', 'TD']]]) {
      const s = (bp.statistics || []).find(x => x.name === cat); const a = s && (s.athletes || [])[0]; if (!a) continue;
      const line = cols.map(c => { const i = (s.labels || []).indexOf(c); return i >= 0 ? `${c} ${a.stats[i]}` : ''; }).filter(Boolean).join(' · ');
      leaders.push({ side, cat: ko, n: (a.athlete || {}).jersey || '', name: (a.athlete || {}).displayName, line });
    }
  }
  return { kind: 'football', ...hd, lineup: null, periods: { labels, home: hd.home.lines, away: hd.away.lines }, timeline: tl, stats: espnBoxStats(d, 'football'), leaders };
}
const NHL_SKIP = new Set(['Blocked', 'End of Game', 'Face Off', 'Giveaway', 'Goal', 'Hit', 'Missed', 'Period End', 'Period Start', 'Shot', 'Stoppage', 'Takeaway', 'Shootout', 'Game End', 'Period Official']);
function nhlDetail(d) {
  const hd = espnHeader(d); const ids = { home: hd.home.id, away: hd.away.id }; const groups = {};
  for (const bp of (d.boxscore || {}).players || []) {
    const side = String(bp.team.id) === String(hd.home.id) ? 'home' : 'away';
    groups[side] = [['goalies', '골리'], ['forwards', '공격수'], ['defenses', '수비수']].map(([k, ko]) => {
      const s = (bp.statistics || []).find(x => x.name === k);
      return { label: ko, players: ((s && s.athletes) || []).map(a => ({ n: (a.athlete || {}).jersey || '', name: (a.athlete || {}).displayName, pos: (((a.athlete || {}).position) || {}).abbreviation || '', starter: !!a.starter })) };
    }).filter(g => g.players.length);
  }
  const n = Math.max(hd.home.lines.length, hd.away.lines.length);
  const labels = Array.from({ length: n }, (_, i) => i < 3 ? `${i + 1}P` : i === 3 ? 'OT' : 'SO');
  const tl = [];
  for (const p of d.plays || []) {
    const ty = (p.type || {}).text || ''; const t = `${labels[((p.period || {}).number || 1) - 1] || ''} ${(p.clock || {}).displayValue || ''}`.trim();
    if (ty === 'Goal' || p.scoringPlay) tl.push({ t, side: sideOf(ids, (p.team || {}).id), kind: 'goal', text: String(p.text || '').replace(/\s*Goal.*$/, '') || '골', sub: (String(p.text || '').match(/assists?: (.*)$/i) || [])[1] ? `도움 ${(String(p.text).match(/assists?: (.*)$/i) || [])[1]}` : '' });
    else if (!NHL_SKIP.has(ty) && p.team) tl.push({ t, side: sideOf(ids, (p.team || {}).id), kind: 'pen', text: `${ty} 페널티`, sub: String(p.text || '').slice(0, 60) });
  }
  return { kind: 'hockey', ...hd, lineup: null, groups: groups.home ? groups : null, periods: { labels, home: hd.home.lines, away: hd.away.lines }, timeline: tl, stats: espnBoxStats(d, 'hockey') };
}
async function f1Detail(cli, ev) {
  const m = /^f1:(\d{4})-(\d+)-(\w+)$/.exec(ev.id || ''); if (!m) throw new SourceError('F1 경기 번호 형식 오류');
  const [, season, round, code] = m;
  const get = async path => { const j = await cli.json(`${F1}/${season}/${round}/${path}`); return ((((j.MRData || {}).RaceTable || {}).Races) || [])[0] || null; };
  const q = await get('qualifying.json');
  const race = code === 'r' ? await get('results.json') : code === 's' ? await get('sprint.json') : null;
  const base = race || q || (await get('results.json'));
  const circuit = base ? base.Circuit : null;
  const drv = x => ({ name: F1_DRIVER_KO[(x.Driver || {}).driverId] || `${(x.Driver || {}).givenName || ''} ${(x.Driver || {}).familyName || ''}`.trim(), code: (x.Driver || {}).code || '',
    team: f1TeamId((x.Constructor || {}).constructorId || ''), teamName: F1_TEAM_KO[(x.Constructor || {}).constructorId] || (x.Constructor || {}).name || '' });
  const qual = q ? (q.QualifyingResults || []).map(x => ({ pos: toInt(x.position), ...drv(x), q: x.Q3 || x.Q2 || x.Q1 || '' })) : [];
  const rows = race ? (race.Results || race.SprintResults || []).map(x => ({ pos: toInt(x.position), ...drv(x), grid: toInt(x.grid), pts: toNum(x.points), status: x.status, time: (x.Time || {}).time || '', laps: toInt(x.laps), fl: x.FastestLap })) : [];
  const grid = rows.length ? rows.filter(r => r.grid > 0).slice().sort((a, b) => a.grid - b.grid).map(r => ({ pos: r.grid, name: r.name, code: r.code, team: r.team, teamName: r.teamName })) : qual.map(r => ({ pos: r.pos, name: r.name, code: r.code, team: r.team, teamName: r.teamName }));
  const tl = [];
  if (code === 'r' && race) {
    let pits = [];
    try { const p = await get('pitstops.json?limit=100'); pits = (p && p.PitStops) || []; } catch (e) { /* 피트스톱 없음 */ }
    const byId = Object.fromEntries((race.Results || []).map(x => [(x.Driver || {}).driverId, drv(x)]));
    for (const p of pits) { const dv = byId[p.driverId] || { name: p.driverId, team: '' }; tl.push({ lap: toInt(p.lap), t: `${p.lap}랩`, kind: 'pit', team: dv.team, text: `${dv.name} 피트스톱`, sub: `${p.stop}번째 · ${p.duration}초` }); }
    for (const r of rows) if (r.status && !/Finished|Lap/i.test(r.status) && r.laps !== null) tl.push({ lap: r.laps + 1, t: `${r.laps + 1}랩`, kind: 'out', team: r.team, text: `${r.name} ${/Did not start/i.test(r.status) ? '출발 못 함' : '리타이어'}`, sub: r.status });
    const best = rows.filter(r => r.fl && r.fl.rank === '1')[0];
    if (best) tl.push({ lap: toInt(best.fl.lap), t: `${best.fl.lap}랩`, kind: 'fast', team: best.team, text: `${best.name} 최고 랩`, sub: (best.fl.Time || {}).time || '' });
    tl.sort((a, b) => (a.lap || 0) - (b.lap || 0));
  }
  const cid = circuit ? circuit.circuitId : '';
  return { kind: 'f1', session: code, circuit: circuit ? { id: cid, name: circuit.circuitName, place: ((circuit.Location || {}).locality) || '' } : null,
    track: CIRCUITS[cid] || null, laps: rows.length ? Math.max(...rows.map(r => r.laps || 0)) : null, grid, results: rows, qualifying: qual, timeline: tl };
}
const DETAIL_SPORT = { soccer: soccerDetail, basketball: nbaDetail, baseball: mlbDetail, football: nflDetail, hockey: nhlDetail };
async function detail(opts) {
  const comp = BY_ID[opts.comp]; if (!comp) throw new SourceError('대회 정보 없음');
  const cli = makeClient(opts.http, 0);
  if (comp.src === 'f1') return f1Detail(cli, opts.event);
  if (comp.src !== 'espn') return null; // 국내 리그 · LoL은 링크로 대신
  const eid = String(opts.event.id || '').split(':').slice(1).join(':');
  const d = await cli.json(`${ESPN}/${comp.path}/summary?event=${encodeURIComponent(eid)}`);
  const fn = DETAIL_SPORT[comp.sport]; if (!fn) return null;
  return fn(d);
}

/* ───────── 팀 목록 (첫 실행 때 팀 고르기용, 가볍게) ───────── */
async function rosterOne(cli, comp, ctx) {
  const T = (id, name, short, color, color2) => ({ id, name, short: short || '', color: color || null, color2: color2 || null });
  if (comp.src === 'espn') {
    const j = await cli.json(`${ESPN}/${comp.path}/teams?limit=200`);
    const list = (((j.sports || [])[0] || {}).leagues || [])[0] || {};
    const out = (list.teams || []).map(x => x.team || x).filter(t => t && t.id && !JUNK.test(t.displayName || ''))
      .map(t => { const b = brand(comp, t.displayName || t.name); return Object.assign(T(espnTeamId(comp, t), t.displayName || t.name, t.abbreviation, b ? b[0] : t.color ? '#' + t.color : null, b ? b[1] : t.alternateColor ? '#' + t.alternateColor : null), b ? { brand: true } : {}); });
    // ESPN 팀 목록에는 하부·해체 팀이 섞일 수 있어 순위표에 있는 팀으로 좁힌다(순위표가 있으면)
    try {
      const st = parseEspnStandings(comp, await cli.json(`${ESPN_ST}/${comp.path}/standings`));
      const ids = new Set(st.groups.flatMap(g => g.rows.map(r => r.team_id)));
      if (ids.size >= 4) return out.filter(t => ids.has(t.id));
    } catch (e) { /* 순위표 없으면 전체 */ }
    return out;
  }
  if (comp.src === 'f1') {
    const y = (ctx.now || new Date()).getUTCFullYear();
    let j = await cli.json(`${F1}/${y}/constructors.json?limit=50`);
    if (!(((j.MRData || {}).ConstructorTable || {}).Constructors || []).length) j = await cli.json(`${F1}/${y - 1}/constructors.json?limit=50`);
    return (((j.MRData || {}).ConstructorTable || {}).Constructors || []).map(c => { const t = f1Team(c.constructorId, c.name); return T(t.id, t.name, t.short, t.color, t.color2); });
  }
  if (comp.src === 'lol') {
    const r = await fetchLol(cli, comp, Object.assign({}, ctx, { prevState: null }));
    const last = r.events.map(e => Date.parse(e.start)).sort((a, b) => b - a)[0] || 0;
    const m = new Map();
    for (const e of r.events) if (Date.parse(e.start) > last - 200 * 86400e3) for (const t of [e.home, e.away]) m.set(t.id, T(t.id, t.name, t.short, t.color));
    return [...m.values()];
  }
  const r = await FETCHERS[comp.src](cli, comp, Object.assign({}, ctx, { prevState: { lastFull: 1 }, rosterOnly: true }));
  const m = new Map();
  for (const g of (r.standings || {}).groups || []) for (const x of g.rows) m.set(x.team_id, T(x.team_id, x.name, x.name));
  if (!m.size) for (const e of r.events) for (const t of [e.home, e.away]) m.set(t.id, T(t.id, t.name, t.short));
  return [...m.values()];
}
async function roster(opts) {
  const cli = makeClient(opts.http, 0); const ctx = { now: opts.now || new Date(), cache: {} };
  const out = {};
  await Promise.all((opts.comps || []).map(async id => {
    const comp = BY_ID[id]; if (!comp || comp.kind !== 'league') return;
    try { out[id] = { ok: true, teams: await rosterOne(cli, comp, ctx) }; } catch (e) { out[id] = { ok: false, error: String(e && e.message || e), teams: [] }; }
  }));
  return out;
}

/* ───────── 실행 ───────── */
const FETCHERS = { espn: fetchEspn, kbo: fetchKbo, kleague: fetchKleague, kbl: fetchKbl, wkbl: fetchWkbl, kovo: fetchKovo, lol: fetchLol, f1: fetchF1 };

// 공식 출처가 실패하거나 시즌 중인데 0경기면 네이버로 대체
async function withNaverFallback(cli, comp, ctx, primary) {
  try {
    const r = await primary();
    if (NAVER_CAT[comp.id] && !r.offseason && !r.events.length) throw new SourceError('시즌 중인데 경기가 없음');
    return Object.assign(r, { source: 'official' });
  } catch (e) {
    if (!NAVER_CAT[comp.id]) throw e;
    const known = ctx.knownTeams || {};
    const byName = n => { const k = Object.entries(known).find(([id, t]) => t.comp === comp.id && (t.name === n || String(n).includes(t.name) || String(t.name).includes(n))); return k ? k[0] : null; };
    const games = await naverGames(cli, comp, addDays(ctx.now, -14), addDays(ctx.now, 150));
    const events = games.map(g => parseNaverGame(comp, g, byName)).filter(Boolean);
    if (!events.length) throw e;
    return { events, standings: null, offseason: false, season: '', full: true, source: 'naver', fallbackReason: String(e.message || e) };
  }
}

async function collect(opts) {
  const { http, now = new Date(), state = {}, onProgress } = opts;
  const cli = makeClient(http, opts.delayMs ?? 150);
  const wanted = new Set(opts.comps || []);
  // 고른 리그 + 그 리그에 딸린 컵·국제대회
  const leagues = COMPETITIONS.filter(c => c.kind === 'league' && wanted.has(c.id));
  const cups = COMPETITIONS.filter(c => c.kind === 'cup' && (c.parents || []).some(p => wanted.has(p)));
  const targets = [...leagues, ...cups];
  const out = { version: VERSION, comps: {}, state: Object.assign({}, state, { cache: Object.assign({}, state.cache) }) };
  const ctxBase = { now, cache: out.state.cache, knownTeams: opts.knownTeams || {} };
  let done = 0;
  const teamsOf = new Set(); // 고른 리그의 팀 (컵대회 경기 거르기용)
  for (const comp of targets) {
    onProgress && onProgress({ comp: comp.id, done, total: targets.length });
    const ctx = Object.assign({}, ctxBase, { prevState: (state.comps || {})[comp.id] });
    if (comp.id !== 'lck' && comp.src === 'lol') ctx.lckTeams = [...teamsOf].filter(id => id.startsWith('lol:')).concat(opts.lckTeams || []);
    try {
      const fetcher = FETCHERS[comp.src];
      const r = await withNaverFallback(cli, comp, ctx, () => fetcher(cli, comp, ctx));
      if (comp.kind === 'league') {
        for (const e of r.events) { teamsOf.add(e.home.id); teamsOf.add(e.away.id); }
        for (const g of (r.standings || {}).groups || []) for (const x of g.rows) teamsOf.add(x.team_id);
      } else if (comp.sport === 'soccer') {
        const known = new Set([...teamsOf, ...Object.keys(opts.knownTeams || {})]);
        r.events = r.events.filter(e => known.has(e.home.id) || known.has(e.away.id));
      }
      if (!r.window && r.events.length) { const ds = r.events.map(e => e.start.slice(0, 10)).sort(); r.window = [ds[0], ds[ds.length - 1]]; }
      out.comps[comp.id] = Object.assign({ ok: true, error: ctx.standingsError || null }, r);
      out.state.comps = Object.assign({}, out.state.comps, { [comp.id]: { lastFull: r.full ? now.getTime() : (ctx.prevState || {}).lastFull, season: r.season, lastOk: now.getTime() } });
    } catch (e) {
      out.comps[comp.id] = { ok: false, error: String(e && e.message || e), events: [], standings: null };
    }
    done++;
  }
  onProgress && onProgress({ done, total: targets.length });
  return out;
}

const API = { VERSION, API_LEVEL: 2, COMPETITIONS, BY_ID, collect, roster, brand, kit, detail, ROUND_KO,
  _test: { parseWkblMobile, parseEspnEvent, espnNational, parseEspnStandings, espnRange, parseKboSchedule, parseKboRank, parseKleagueSchedule, parseKleagueRank, parseKblSchedule, parseKblRank,
    wkblSeasons, parseWkblSchedule, parseWkblRank, parseKovoSchedule, parseKovoRank, parseLolEvent, lolStandings, parseF1Schedule, parseF1Standings, gpKo, f1Best, parseNaverGame, enrichFromNaver, kstIso, monthsBetween } };
root.MVCollector = API;
if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
