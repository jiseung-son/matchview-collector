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
const VERSION = '2.1.0';

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


/* ───────── 구단 대표색 (공식 브랜드·홈 유니폼 기준, [주색, 보조색]) ─────────
 * ESPN이 주는 색은 원정·서드 유니폼 색이 섞여 있어 직접 정리했다. 이름 일부로 찾는다(가장 긴 것 우선). */
const BRAND = {
  soccer: {
    arsenal: ['#EF0107', '#FFFFFF'], astonvilla: ['#670E36', '#95BFE5'], bournemouth: ['#DA291C', '#000000'], brentford: ['#E30613', '#FFFFFF'],
    brighton: ['#0057B8', '#FFFFFF'], burnley: ['#6C1D45', '#99D6EA'], chelsea: ['#034694', '#FFFFFF'], crystalpalace: ['#1B458F', '#C4122E'],
    everton: ['#003399', '#FFFFFF'], fulham: ['#FFFFFF', '#000000'], leeds: ['#FFFFFF', '#1D428A'], liverpool: ['#C8102E', '#F6EB61'],
    manchestercity: ['#6CABDD', '#1C2C5B'], manchesterunited: ['#DA291C', '#FBE122'], newcastle: ['#241F20', '#FFFFFF'], nottingham: ['#DD0000', '#FFFFFF'],
    sunderland: ['#EB172B', '#FFFFFF'], tottenham: ['#132257', '#FFFFFF'], westham: ['#7A263A', '#1BB1E7'], wolverhampton: ['#FDB913', '#231F20'],
    ipswich: ['#0044A9', '#FFFFFF'], leicester: ['#003090', '#FDBE11'], southampton: ['#D71920', '#FFFFFF'],
    alaves: ['#0761AF', '#FFFFFF'], athletic: ['#EE2523', '#FFFFFF'], atleticomadrid: ['#CB3524', '#262F61'], barcelona: ['#A50044', '#004D98'],
    celta: ['#8AC3EE', '#E5254E'], elche: ['#05642C', '#FFFFFF'], espanyol: ['#007FC8', '#FFFFFF'], getafe: ['#005999', '#FFFFFF'],
    girona: ['#CD2534', '#FFFFFF'], levante: ['#B4053F', '#005093'], mallorca: ['#E20613', '#000000'], osasuna: ['#D91A21', '#0A346F'],
    rayovallecano: ['#E53027', '#FFFFFF'], betis: ['#00954C', '#FFFFFF'], realmadrid: ['#FFFFFF', '#FEBE10'], oviedo: ['#0047AB', '#FFFFFF'],
    realsociedad: ['#0067B1', '#FFFFFF'], sevilla: ['#D81920', '#FFFFFF'], valencia: ['#FFFFFF', '#EE7F00'], villarreal: ['#FFE667', '#005187'],
    leganes: ['#0A4FA1', '#FFFFFF'], laspalmas: ['#FFE400', '#0055A5'], valladolid: ['#921B88', '#FFFFFF'],
    atalanta: ['#1E71B8', '#000000'], bologna: ['#A21C26', '#1A2F48'], cagliari: ['#A71930', '#002350'], como: ['#003DA5', '#FFFFFF'],
    cremonese: ['#C8102E', '#A7A9AC'], fiorentina: ['#482E92', '#FFFFFF'], genoa: ['#C8102E', '#002855'], verona: ['#002F6C', '#FFD200'],
    internazionale: ['#0068A8', '#000000'], intermilan: ['#0068A8', '#000000'], juventus: ['#000000', '#FFFFFF'], lazio: ['#87D8F7', '#FFFFFF'],
    lecce: ['#FFD700', '#D7182A'], acmilan: ['#FB090B', '#000000'], napoli: ['#12A0D7', '#FFFFFF'], parma: ['#FFD200', '#005BAC'],
    pisa: ['#1F4FA0', '#000000'], roma: ['#8E1F2F', '#F0BC42'], sassuolo: ['#00A752', '#000000'], torino: ['#8A1E03', '#FFFFFF'],
    udinese: ['#000000', '#FFFFFF'], empoli: ['#00579C', '#FFFFFF'], monza: ['#E4002B', '#FFFFFF'], venezia: ['#F37021', '#00843D'],
    augsburg: ['#BA3733', '#46714D'], unionberlin: ['#EB1923', '#FFFFFF'], werderbremen: ['#1D9053', '#FFFFFF'], dortmund: ['#FDE100', '#000000'],
    eintrachtfrankfurt: ['#E1000F', '#000000'], freiburg: ['#E2001A', '#000000'], hamburg: ['#0A3F86', '#FFFFFF'], heidenheim: ['#E30613', '#003B79'],
    hoffenheim: ['#1961B5', '#FFFFFF'], koln: ['#ED1C24', '#FFFFFF'], cologne: ['#ED1C24', '#FFFFFF'], leipzig: ['#DD0741', '#FFFFFF'],
    leverkusen: ['#E32221', '#000000'], mainz: ['#ED1C24', '#FFFFFF'], monchengladbach: ['#00A650', '#000000'], gladbach: ['#00A650', '#000000'],
    bayernmunich: ['#DC052D', '#0066B2'], bayernmunchen: ['#DC052D', '#0066B2'], stpauli: ['#6F4E37', '#FFFFFF'], stuttgart: ['#E32219', '#FFFFFF'],
    wolfsburg: ['#65B32E', '#FFFFFF'], bochum: ['#005CA9', '#FFFFFF'], holsteinkiel: ['#003B7E', '#FFFFFF'],
    angers: ['#000000', '#FFFFFF'], auxerre: ['#0055A4', '#FFFFFF'], brest: ['#E30613', '#FFFFFF'], lehavre: ['#68A4DC', '#002C5F'],
    lens: ['#FFD700', '#EC1C24'], lille: ['#E01E13', '#24216A'], lorient: ['#F58220', '#000000'], lyon: ['#DA0812', '#1B3C8D'],
    marseille: ['#2FAEE0', '#FFFFFF'], metz: ['#8D1931', '#FFFFFF'], monaco: ['#E7192F', '#FFFFFF'], nantes: ['#FCDD09', '#00843D'],
    nice: ['#C8102E', '#000000'], parisfc: ['#1A2A5A', '#FFFFFF'], parissaintgermain: ['#004170', '#DA291C'], rennes: ['#E13327', '#000000'],
    strasbourg: ['#009FE3', '#FFFFFF'], toulouse: ['#6A2C8E', '#FFFFFF'], montpellier: ['#F48C12', '#002B5C'], reims: ['#EE1C25', '#FFFFFF'], saintetienne: ['#00A650', '#FFFFFF'],
    benfica: ['#E83030', '#FFFFFF'], porto: ['#003893', '#FFFFFF'], sportingcp: ['#00785A', '#FFFFFF'], ajax: ['#D2122E', '#FFFFFF'], psv: ['#ED1C24', '#FFFFFF'],
    feyenoord: ['#E30613', '#FFFFFF'], clubbrugge: ['#0077C8', '#000000'], celtic: ['#018749', '#FFFFFF'], rangers: ['#1B458F', '#FFFFFF'],
    galatasaray: ['#A90432', '#FDB912'], fenerbahce: ['#002D72', '#FFED00'], olympiacos: ['#E2001A', '#FFFFFF'], shakhtar: ['#FF6600', '#000000'], salzburg: ['#D50032', '#FFFFFF'],
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
    cubs: ['#0E3386', '#CC3433'], whitesox: ['#27251F', '#C4CED4'], reds: ['#C6011F', '#000000'], guardians: ['#00385D', '#E50022'], rockies: ['#33006F', '#C4CED4'],
    tigers: ['#0C2340', '#FA4616'], astros: ['#002D62', '#EB6E1F'], royals: ['#004687', '#BD9B60'], angels: ['#BA0021', '#003263'], dodgers: ['#005A9C', '#EF3E42'],
    marlins: ['#00A3E0', '#EF3340'], brewers: ['#12284B', '#FFC52F'], twins: ['#002B5C', '#D31145'], mets: ['#002D72', '#FF5910'], yankees: ['#0C2340', '#C4CED4'],
    phillies: ['#E81828', '#002D72'], pirates: ['#FDB827', '#27251F'], padres: ['#FFC425', '#2F241D'], giants: ['#FD5A1E', '#27251F'], mariners: ['#0C2C56', '#005C5C'],
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
    if (b) { o.color = b[0]; o.color2 = b[1]; o.brand = true; }
    else { if (t.color) o.color = '#' + String(t.color).replace('#', '').slice(0, 6); if (t.alternateColor) o.color2 = '#' + String(t.alternateColor).replace('#', '').slice(0, 6); }
    return o; };
  const slug = (e.season || {}).slug;
  const round = comp.kind === 'cup' && slug ? (ROUND_KO[slug] || slug.replace(/-/g, ' ')) : '';
  return ev(comp.id, e.id, utcIso(start), c.timeValid === false, T(H), T(A), toInt(H.score), toInt(A.score), status,
    { venue: (c.venue || e.venue || {}).fullName || '', status_text: statusText, round });
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

/* ───────── WKBL (wkbl.or.kr) — 일정표에 시각·홈/원정이 없어 네이버로 보완 ───────── */
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
      const page = await cli.text(`https://www.wkbl.or.kr/game/sch/schedule1.asp?season_gu=${seasons[0][0]}&ym=${y}${pad(m)}&gun=1`);
      const sel = (/<option value="(\d{6})"\s*selected/.exec(page) || [])[1];
      if (sel && sel !== `${y}${pad(m)}`) continue;
      events.push(...parseWkblSchedule(page, y, m));
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

const API = { VERSION, API_LEVEL: 2, COMPETITIONS, BY_ID, collect, roster, brand, ROUND_KO,
  _test: { parseEspnEvent, parseEspnStandings, espnRange, parseKboSchedule, parseKboRank, parseKleagueSchedule, parseKleagueRank, parseKblSchedule, parseKblRank,
    wkblSeasons, parseWkblSchedule, parseWkblRank, parseKovoSchedule, parseKovoRank, parseLolEvent, lolStandings, parseF1Schedule, parseF1Standings, gpKo, f1Best, parseNaverGame, enrichFromNaver, kstIso, monthsBetween } };
root.MVCollector = API;
if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
