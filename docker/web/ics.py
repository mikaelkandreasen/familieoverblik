"""
ics.py — begivenhederne i en ICS-kalender (iCalendar, RFC 5545) i et tidsrum, OGSÅ de gentagne.

PHP-læseren i hent.php kendte kun enkeltstående begivenheder. En familiekalender er fuld af gentagelser («hver tirsdag», «hver anden uge»), og dem så man kun den første gang. Her udvides gentagelserne,
så hent.php (som kalder dette script) får hver forekomst som en almindelig begivenhed. Findes scriptet ikke, eller fejler det, bruger hent.php sin gamle læser.

  python3 ics.py                       stdin: {"text": "...ICS...", "fra": ISO, "til": ISO, "tz": "Europe/Copenhagen"}  →  stdout: {"events": [...], "vevent": n, "gentagne": n}
  python3 ics.py --fil F.ics --dato i-morgen [--tz Europe/Copenhagen]     til fejlfinding: viser, hvad der står den dag, og hvor mange der er gentagne

Understøttet: DTSTART/DTEND/DURATION (dato, UTC, TZID, svævende tid, Windows-tidszonenavne), heldagsposter, RRULE med FREQ (DAILY, WEEKLY, MONTHLY, YEARLY), INTERVAL, COUNT, UNTIL, BYDAY (også 1MO og -1FR),
BYMONTHDAY, BYMONTH, BYSETPOS og WKST, EXDATE, RDATE, RECURRENCE-ID (en flyttet eller aflyst forekomst), STATUS:CANCELLED. Gentagelser, der ikke kan regnes ud (BYWEEKNO, BYYEARDAY …), giver kun den første forekomst.
Kun standardbiblioteket (zoneinfo). Ren logik uden netværk (tests/test_ics.py).
"""
import calendar
import json
import re
import sys
from datetime import date, datetime, time, timedelta, timezone

try:
    from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
except ImportError:                                           # pragma: no cover
    ZoneInfo = None

MAX_FOREKOMSTER = 3000                                        # pr. begivenhed: en daglig gentagelse i otte år
WINDOWS_TZ = {                                                # Outlook og Exchange bruger Windows' navne
    "w. europe standard time": "Europe/Berlin", "romance standard time": "Europe/Paris", "central europe standard time": "Europe/Budapest",
    "central european standard time": "Europe/Warsaw", "gmt standard time": "Europe/London", "greenwich standard time": "Atlantic/Reykjavik",
    "e. europe standard time": "Europe/Bucharest", "fle standard time": "Europe/Kiev", "gtb standard time": "Europe/Bucharest",
    "russian standard time": "Europe/Moscow", "turkey standard time": "Europe/Istanbul", "utc": "UTC", "eastern standard time": "America/New_York",
    "central standard time": "America/Chicago", "mountain standard time": "America/Denver", "pacific standard time": "America/Los_Angeles",
}
UGEDAGE = {"MO": 0, "TU": 1, "WE": 2, "TH": 3, "FR": 4, "SA": 5, "SU": 6}
POSTPONED = re.compile("^\\s*\u26a0\ufe0f?\\s*Postponed:\\s*")


def udfold(text):
    """Linjer, hvor en fortsættelse (starter med mellemrum eller tab) er sat sammen med linjen før."""
    ud = []
    for raa in str(text or "").replace("\r\n", "\n").replace("\r", "\n").split("\n"):
        if raa[:1] in (" ", "\t") and ud:
            ud[-1] += raa[1:]
        else:
            ud.append(raa)
    return ud


def egenskab(linje):
    """(NAVN, {parametre}, værdi) af «NAVN;PARAM=x:værdi». Kolon i anførselstegn i parametrene tæller ikke."""
    i, ind = 0, False
    for i, c in enumerate(linje):
        if c == '"':
            ind = not ind
        elif c == ":" and not ind:
            break
    else:
        return None
    if linje[i] != ":":
        return None
    hoved, vaerdi = linje[:i], linje[i + 1:]
    dele = hoved.split(";")
    par = {}
    for d in dele[1:]:
        if "=" in d:
            k, v = d.split("=", 1)
            par[k.upper()] = v.strip('"')
    return dele[0].upper(), par, vaerdi


def udskaer(v):
    return v.replace("\\n", "\n").replace("\\N", "\n").replace("\\,", ",").replace("\\;", ";").replace("\\\\", "\\").strip()


def tz_af(navn, standard):
    """Tidszonen for et TZID (også Windows-navne). Kendes den ikke, bruges standardzonen."""
    n = (navn or "").strip().strip('"')
    if not n:
        return standard
    for kandidat in (n, WINDOWS_TZ.get(n.lower())):
        if kandidat:
            try:
                return ZoneInfo(kandidat)
            except Exception:
                pass
    return standard


def laes_tid(par, vaerdi, standard):
    """(naiv klokketid eller dato, zone eller None for heldag, erHeldag) eller None. UTC-værdier (…Z) gives som UTC; svævende tid får TZID-zonen eller standardzonen."""
    v = vaerdi.strip()
    try:
        if par.get("VALUE", "").upper() == "DATE" or re.fullmatch(r"\d{8}", v):
            return datetime.strptime(v[:8], "%Y%m%d").date(), None, True
        m = re.fullmatch(r"(\d{8})T(\d{6})(Z?)", v)
        if not m:
            return None
        naiv = datetime.strptime(m.group(1) + m.group(2), "%Y%m%d%H%M%S")
        if m.group(3):
            return naiv, timezone.utc, False
        return naiv, tz_af(par.get("TZID"), standard), False
    except ValueError:
        return None


def til_aware(naiv, zone):
    return naiv.replace(tzinfo=zone)


def laes_regel(tekst):
    r = {}
    for del_ in tekst.split(";"):
        if "=" in del_:
            k, v = del_.split("=", 1)
            r[k.strip().upper()] = v.strip()
    return r


def _tal(v, standard=None):
    try:
        return int(v)
    except (TypeError, ValueError):
        return standard


def _byday(tekst):
    ud = []
    for d in (tekst or "").split(","):
        m = re.fullmatch(r"\s*([+-]?\d{1,2})?(MO|TU|WE|TH|FR|SA|SU)\s*", d.upper())
        if m:
            ud.append((int(m.group(1)) if m.group(1) else None, UGEDAGE[m.group(2)]))
    return ud


def _maaneds_dage(aar, maaned, bydag, bymdag, standard_dag):
    """De dage i en måned, en månedlig eller årlig regel rammer (sorteret)."""
    antal = calendar.monthrange(aar, maaned)[1]
    dage = set()
    if bymdag:
        for d in bymdag:
            n = d if d > 0 else antal + 1 + d
            if 1 <= n <= antal:
                dage.add(n)
    if bydag:
        for ordinal, ugedag in bydag:
            alle = [d for d in range(1, antal + 1) if date(aar, maaned, d).weekday() == ugedag]
            if ordinal is None:
                dage.update(alle)
            elif ordinal > 0 and ordinal <= len(alle):
                dage.add(alle[ordinal - 1])
            elif ordinal < 0 and -ordinal <= len(alle):
                dage.add(alle[ordinal])
        if bymdag:                                              # begge: kun dage, der opfylder begge
            dage = {d for d in dage if any(d == (x if x > 0 else antal + 1 + x) for x in bymdag) and any(date(aar, maaned, d).weekday() == u for _, u in bydag)}
    if not bymdag and not bydag:
        if standard_dag <= antal:
            dage.add(standard_dag)
    return sorted(dage)


def forekomster(start, regel, grænse, fra=None):
    """Gentagelsens datoer/klokketider (naive, i begivenhedens egen tid) fra start og til og med grænsen. start er en dato (heldag) eller en naiv datetime."""
    heldag = not isinstance(start, datetime)
    d0 = start if heldag else start.date()
    tid = None if heldag else start.time()
    frek = regel.get("FREQ", "").upper()
    interval = max(1, _tal(regel.get("INTERVAL"), 1) or 1)
    antal = _tal(regel.get("COUNT"))
    until = None
    if regel.get("UNTIL"):
        u = laes_tid({}, regel["UNTIL"], None)
        if u:
            until = u[0] if not isinstance(u[0], datetime) else u[0]
    bydag, bymdag = _byday(regel.get("BYDAY")), [x for x in (_tal(v) for v in regel.get("BYMONTHDAY", "").split(",")) if x]
    bymaaned = [x for x in (_tal(v) for v in regel.get("BYMONTH", "").split(",")) if x and 1 <= x <= 12]
    sætpos = [x for x in (_tal(v) for v in regel.get("BYSETPOS", "").split(",")) if x]
    wkst = UGEDAGE.get(regel.get("WKST", "MO").upper(), 0)
    if frek not in ("DAILY", "WEEKLY", "MONTHLY", "YEARLY") or any(k in regel for k in ("BYWEEKNO", "BYYEARDAY", "BYHOUR", "BYMINUTE", "BYSECOND")):
        return [start]                                          # kan ikke regnes ud: kun den første forekomst
    ud, set_ = [], set()
    def laeg(d):
        """Tilføj en dato, hvis den er på eller efter start, før grænsen og ikke set før. Returnerer False, når vi er færdige."""
        if d < d0:
            return True
        v = d if heldag else datetime.combine(d, tid)
        gr = grænse if isinstance(grænse, date) and not isinstance(grænse, datetime) else grænse.date()
        if d > gr:
            return False
        if until is not None:
            u = until.date() if isinstance(until, datetime) else until
            if d > u:
                return False
        if v in set_:
            return True
        set_.add(v)
        ud.append(v)
        return not (antal is not None and len(ud) >= antal) and len(ud) < MAX_FOREKOMSTER
    k = 0
    if fra is not None and antal is None and fra > d0:                          # uden COUNT kan vi springe frem til tidsrummet (en daglig gentagelse siden 2018 skal ikke tælles forfra)
        mellem = {"DAILY": (fra - d0).days, "WEEKLY": (fra - d0).days // 7, "MONTHLY": (fra.year - d0.year) * 12 + fra.month - d0.month, "YEARLY": fra.year - d0.year}[frek]
        k = max(0, mellem // interval - 1)
    grænse_k = k + 5000
    while k < grænse_k:
        if frek == "DAILY":
            kandidater = [d0 + timedelta(days=k * interval)]
            kandidater = [d for d in kandidater if (not bymaaned or d.month in bymaaned) and (not bydag or d.weekday() in {u for _, u in bydag}) and (not bymdag or d.day in bymdag)]
        elif frek == "WEEKLY":
            uge0 = d0 - timedelta(days=(d0.weekday() - wkst) % 7)
            ugestart = uge0 + timedelta(weeks=k * interval)
            dage = sorted({(u - wkst) % 7 for _, u in bydag}) if bydag else [(d0.weekday() - wkst) % 7]
            kandidater = [ugestart + timedelta(days=x) for x in dage]
            if bymaaned:
                kandidater = [d for d in kandidater if d.month in bymaaned]
        elif frek == "MONTHLY":
            m = d0.month - 1 + k * interval
            aar, maaned = d0.year + m // 12, m % 12 + 1
            if aar > 9999:
                break
            kandidater = [date(aar, maaned, d) for d in _maaneds_dage(aar, maaned, bydag, bymdag, d0.day)]
            if bymaaned and maaned not in bymaaned:
                kandidater = []
            if sætpos:
                kandidater = [kandidater[p - 1 if p > 0 else p] for p in sætpos if kandidater and -len(kandidater) <= (p - 1 if p > 0 else p) < len(kandidater)]
                kandidater.sort()
        else:                                                   # YEARLY
            aar = d0.year + k * interval
            if aar > 9999:
                break
            kandidater = []
            for maaned in (sorted(bymaaned) if bymaaned else [d0.month]):
                kandidater += [date(aar, maaned, d) for d in _maaneds_dage(aar, maaned, bydag, bymdag, d0.day)]
            if sætpos:
                kandidater = [kandidater[p - 1 if p > 0 else p] for p in sætpos if kandidater and -len(kandidater) <= (p - 1 if p > 0 else p) < len(kandidater)]
                kandidater.sort()
        færdig = False
        for d in kandidater:
            if not laeg(d):
                færdig = True
                break
        if færdig:
            break
        # er hele perioden efter grænsen, er vi færdige
        gr = grænse if not isinstance(grænse, datetime) else grænse.date()
        periode_start = {"DAILY": d0 + timedelta(days=k * interval), "WEEKLY": d0 + timedelta(weeks=k * interval), "MONTHLY": date(d0.year + (d0.month - 1 + k * interval) // 12, (d0.month - 1 + k * interval) % 12 + 1, 1) if d0.year + (d0.month - 1 + k * interval) // 12 <= 9999 else None, "YEARLY": date(min(9999, d0.year + k * interval), 1, 1)}[frek]
        if periode_start is None or (periode_start > gr + timedelta(days=1) and k > 0):
            break
        k += 1
    return ud or [start]


def _begivenheder(text, standard):
    """Alle VEVENT'er som ordbøger med de rå egenskaber."""
    ud, cur = [], None
    for linje in udfold(text):
        l = linje.strip("\n")
        if l.strip().upper() == "BEGIN:VEVENT":
            cur = {"exdate": [], "rdate": []}
            continue
        if cur is None:
            continue
        if l.strip().upper() == "END:VEVENT":
            ud.append(cur)
            cur = None
            continue
        e = egenskab(l)
        if not e:
            continue
        navn, par, v = e
        if navn == "DTSTART":
            t = laes_tid(par, v, standard)
            if t:
                cur["start"] = t
        elif navn == "DTEND":
            t = laes_tid(par, v, standard)
            if t:
                cur["end"] = t
        elif navn == "DURATION":
            m = re.fullmatch(r"([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?", v.strip().upper())
            if m:
                s = -1 if m.group(1) == "-" else 1
                cur["duration"] = s * timedelta(weeks=int(m.group(2) or 0), days=int(m.group(3) or 0), hours=int(m.group(4) or 0), minutes=int(m.group(5) or 0), seconds=int(m.group(6) or 0))
        elif navn == "SUMMARY":
            s = POSTPONED.sub("UDSAT: ", udskaer(v))
            if s:
                cur["summary"] = s
        elif navn == "LOCATION":
            s = udskaer(v)
            if s:
                cur["location"] = s
        elif navn == "STATUS":
            if v.strip().upper() == "CANCELLED":
                cur["cancelled"] = True
        elif navn == "UID":
            cur["uid"] = v.strip()
        elif navn == "RRULE":
            cur["rrule"] = laes_regel(v)
        elif navn == "RECURRENCE-ID":
            t = laes_tid(par, v, standard)
            if t:
                cur["recid"] = t
        elif navn in ("EXDATE", "RDATE"):
            for del_ in v.split(","):
                t = laes_tid(par, del_, standard)
                if t:
                    cur["exdate" if navn == "EXDATE" else "rdate"].append(t)
    return ud


def _noegle(t):
    """En forekomsts identitet: datoen (heldag) eller tidspunktet i UTC."""
    naiv, zone, heldag = t
    return naiv if heldag else til_aware(naiv, zone).astimezone(timezone.utc).replace(tzinfo=None)


def _hel_dag(d, lokal):
    return datetime.combine(d, time(0), lokal)


def begivenheder(text, fra, til, tz_navn="Europe/Copenhagen"):
    """Begivenhederne, der overlapper [fra, til), som ordbøger: start, end (eller None), last, allDay, summary, location (tidspunkter som ISO med tidszone, i tz_navn). Sorteret efter start."""
    lokal = tz_af(tz_navn, timezone.utc)
    rå = _begivenheder(text, lokal)
    omlagt = {(b["uid"], _noegle(b["recid"])) for b in rå if b.get("uid") and b.get("recid")}      # forekomster, en anden VEVENT har overtaget
    ud, antal_gentagne = [], 0
    for b in rå:
        if "start" not in b or "summary" not in b or b.get("cancelled"):
            continue
        naiv, zone, heldag = b["start"]
        if heldag:
            if "end" in b and b["end"][2]:
                dage = max(1, (b["end"][0] - naiv).days)
            elif "duration" in b:
                dage = max(1, b["duration"].days)
            else:
                dage = 1
            varighed = timedelta(days=dage)
        else:
            if "end" in b and not b["end"][2]:
                varighed = til_aware(b["end"][0], b["end"][1]) - til_aware(naiv, zone)
            elif "duration" in b:
                varighed = b["duration"]
            else:
                varighed = None
        if varighed is not None and varighed < timedelta(0):
            varighed = timedelta(0)
        rk = b.get("rrule")
        if rk and not b.get("recid"):
            antal_gentagne += 1
            lokal_til = til.astimezone(zone if zone else lokal) if not heldag else til.astimezone(lokal)
            grænse = (lokal_til + timedelta(days=2)).date() if not heldag else (lokal_til + timedelta(days=2)).date()
            fra_dato = (fra.astimezone(zone if zone else lokal) - (varighed or timedelta(0))).date() - timedelta(days=2)
            starter = forekomster(naiv, rk, grænse, fra_dato)
            starter += [t[0] for t in b["rdate"] if (t[2] == heldag)]
        else:
            starter = [naiv]
        undtaget = {_noegle(t) for t in b["exdate"]}
        for s in sorted(set(starter), key=lambda x: (x if isinstance(x, datetime) else datetime.combine(x, time(0)))):
            nogle = _noegle((s, zone, heldag))
            if nogle in undtaget:
                continue
            if b.get("uid") and rk and not b.get("recid") and (b["uid"], nogle) in omlagt:
                continue
            if heldag:
                start = _hel_dag(s, lokal)
                slut = start + varighed
                sidste = slut - timedelta(days=1) if varighed >= timedelta(days=1) else start
                slut_ud = slut
            else:
                start = til_aware(s, zone).astimezone(lokal)
                slut_ud = start + varighed if varighed is not None else None
                sidste = slut_ud if slut_ud is not None else start
            if sidste < start:
                sidste = start
            if start < til and sidste >= fra:
                ud.append({"start": start.isoformat(), "end": slut_ud.isoformat() if slut_ud is not None else None, "last": sidste.isoformat(), "allDay": heldag,
                           "summary": b["summary"], "location": b.get("location", "")})
    ud.sort(key=lambda e: (e["start"], e["summary"]))
    return ud, len(rå), antal_gentagne


def main(argv):
    if "--fil" in argv:
        i = argv.index("--fil")
        sti = argv[i + 1]
        tz_navn = argv[argv.index("--tz") + 1] if "--tz" in argv else "Europe/Copenhagen"
        lokal = tz_af(tz_navn, timezone.utc)
        dato = argv[argv.index("--dato") + 1] if "--dato" in argv else "i-dag"
        nu = datetime.now(lokal).date()
        d = {"i-dag": nu, "i-morgen": nu + timedelta(days=1)}.get(dato) or datetime.strptime(dato, "%Y-%m-%d").date()
        tekst = open(sti, encoding="utf-8", errors="replace").read()
        ev, n, g = begivenheder(tekst, datetime.combine(d, time(0), lokal), datetime.combine(d + timedelta(days=1), time(0), lokal), tz_navn)
        print(f"{sti}: {n} begivenheder i filen, {g} med gentagelse. Den {d.isoformat()} står der {len(ev)}:")
        for e in ev:
            print("  " + ("hele dagen" if e["allDay"] else e["start"][11:16] + ("–" + e["end"][11:16] if e["end"] else "")) + "  " + e["summary"])
        return 0
    try:
        ind = json.loads(sys.stdin.read())
        fra, til = datetime.fromisoformat(ind["fra"]), datetime.fromisoformat(ind["til"])
        ev, n, g = begivenheder(str(ind.get("text", "")), fra, til, str(ind.get("tz") or "Europe/Copenhagen"))
    except Exception as e:                                       # noqa: BLE001 — PHP bruger så sin egen læser
        print(json.dumps({"fejl": f"{type(e).__name__}: {e}"}))
        return 1
    print(json.dumps({"events": ev, "vevent": n, "gentagne": g}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
