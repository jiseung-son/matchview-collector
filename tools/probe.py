# 데이터 출처 진단 (임시)
import json, os, urllib.request, urllib.error, gzip
os.makedirs("o", exist_ok=True)
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36"
def get(url, headers=None):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json", **(headers or {})})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            b = r.read()
            if r.headers.get("Content-Encoding") == "gzip": b = gzip.decompress(b)
            return r.status, json.loads(b.decode("utf-8"))
    except urllib.error.HTTPError as e:
        return e.code, e.read()[:200]
    except Exception as e:
        return 0, str(e)[:200]
E = "https://site.api.espn.com/apis/site/v2/sports/soccer"
slugs = ["uefa.champions","uefa.europa","uefa.europa.conf","uefa.super_cup","eng.fa","eng.league_cup","eng.charity",
         "esp.copa_del_rey","esp.super_cup","ita.coppa_italia","ita.super_cup","ger.dfb_pokal","ger.super_cup",
         "fra.coupe_de_france","fra.super_cup"]
for s in slugs:
    for d in ["202611","202612","202601","202602","202608"]:
        st, j = get(f"{E}/{s}/scoreboard?dates={d}&limit=1000")
        if st != 200 or not isinstance(j, dict):
            print(s, d, "HTTP", st); continue
        ev = j.get("events") or []
        lg = (j.get("leagues") or [{}])[0]
        print(s, d, "events", len(ev), "| league:", lg.get("name"), "| season:", (lg.get("season") or {}).get("displayName"),
              (lg.get("season") or {}).get("startDate"), (lg.get("season") or {}).get("endDate"))
        if ev and not os.path.exists(f"o/{s}.json"):
            json.dump(ev[:3], open(f"o/{s}.json","w"), ensure_ascii=False)
# default scoreboard season info
for p in ["soccer/eng.1","baseball/mlb","football/nfl","basketball/nba","hockey/nhl","soccer/usa.1"]:
    st, j = get(f"https://site.api.espn.com/apis/site/v2/sports/{p}/scoreboard")
    if isinstance(j, dict):
        lg=(j.get("leagues") or [{}])[0]; s=lg.get("season") or {}
        cal = lg.get("calendar") or []
        print("DEFAULT", p, st, s.get("year"), s.get("displayName"), s.get("startDate"), s.get("endDate"), "type", (s.get("type") or {}).get("name"),
              "calendarType", lg.get("calendarType"), "cal", (cal[:2] if cal and isinstance(cal[0], str) else [c.get("label") for c in cal[:3]] if cal else None), "events", len(j.get("events") or []))
# standings for UEFA
for s in ["uefa.champions","uefa.europa","uefa.europa.conf"]:
    st, j = get(f"https://site.api.espn.com/apis/v2/sports/soccer/{s}/standings")
    if isinstance(j, dict):
        ch = j.get("children") or []
        print("STANDINGS", s, st, [ (c.get("name"), len(((c.get("standings") or {}).get("entries") or []))) for c in ch][:5])
# team colors
for p in ["soccer/eng.1","basketball/nba","baseball/mlb"]:
    st, j = get(f"https://site.api.espn.com/apis/site/v2/sports/{p}/teams")
    if isinstance(j, dict):
        ts = (((j.get("sports") or [{}])[0].get("leagues") or [{}])[0].get("teams") or [])
        print("TEAMS", p, len(ts), [ (t["team"].get("abbreviation"), t["team"].get("color"), t["team"].get("alternateColor")) for t in ts[:4]])
        json.dump([t["team"] for t in ts], open(f"o/teams_{p.replace('/','_')}.json","w"), ensure_ascii=False)
# LoL
K = {"x-api-key": "0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z"}
L = "https://esports-api.lolesports.com/persisted/gw"
st, j = get(f"{L}/getLeagues?hl=ko-KR", K)
print("LOL leagues", st)
if isinstance(j, dict):
    lgs = j["data"]["leagues"]
    json.dump(lgs, open("o/lol_leagues.json","w"), ensure_ascii=False)
    for l in lgs:
        if any(k in (l.get("slug") or "") for k in ["lck","msi","world","first","ewc","asian","kespa","cup"]):
            print("  ", l.get("slug"), l.get("id"), l.get("name"), l.get("region"))
    lck = next((l for l in lgs if l.get("slug")=="lck"), None)
    if lck:
        st, s = get(f"{L}/getSchedule?hl=ko-KR&leagueId={lck['id']}", K)
        if isinstance(s, dict):
            evs = s["data"]["schedule"]["events"]; pages = s["data"]["schedule"].get("pages")
            print("LCK schedule", len(evs), "pages", pages, evs[0]["startTime"] if evs else None, evs[-1]["startTime"] if evs else None)
            json.dump(s["data"]["schedule"], open("o/lol_lck_schedule.json","w"), ensure_ascii=False)
        st, t = get(f"{L}/getTournamentsForLeague?hl=ko-KR&leagueId={lck['id']}", K)
        if isinstance(t, dict):
            tours = t["data"]["leagues"][0]["tournaments"]; print("LCK tournaments", [(x.get("slug"), x.get("startDate"), x.get("endDate")) for x in tours[:6]])
            if tours:
                st, sd = get(f"{L}/getStandings?hl=ko-KR&tournamentId={tours[0]['id']}", K)
                if isinstance(sd, dict): json.dump(sd, open("o/lol_standings.json","w"), ensure_ascii=False); print("LCK standings ok")
