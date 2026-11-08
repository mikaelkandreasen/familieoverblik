"""
kantine.py — skolens ugemenu fra den besked, kantinen sender hver uge.

Beskeden starter med «Kantinen uge 46» (som emne eller som første linje) og har en liste efter «Menu:», én ret pr. skoledag:

    Menu:

    Kartoffel/ porre suppe
    Frikadeller, rugbrød og rødkål
    ...

Aula-bibliotekets JSON kan skifte felter mellem udgaver, og jeg har ikke set den rigtige besked. Derfor leder koden generisk: den går gennem ALLE ordbøger i svaret, tager emnet fra et felt der hedder noget med «subject»/«title»
og teksten fra felter, der hedder noget med «text»/«content»/«body»/«message», og arver emnet fra en tråd, hvis beskederne ligger i den. Finder den ikke beskeden, viser `Sync-Aula.py --kantineform` svarets opbygning uden indhold.
Kun standardbiblioteket. Ren logik uden netværk (tests/test_kantine.py).
"""
import html as _html
import re
from datetime import datetime

EMNE_NOEGLER = ("subject", "title", "thread_subject", "headline", "name")
TEKST_NOEGLER = ("text", "content", "content_html", "body", "html", "message", "preview", "description", "raw_text", "plain_text")
DATO_NOEGLER = ("send_datetime", "sent_datetime", "sent_at", "sent", "created", "created_at", "date", "timestamp", "start_datetime", "last_message_date", "latest_message_date", "updated_at")
KANTINE = re.compile(r"^\W*kantine[nr]?\b", re.I)
MENU = re.compile(r"^\W*(?:ugens\s+|dagens\s+|uge)?menu(?:en)?(?:\s+(?:for\s+)?uge\s*\d{1,2})?\s*(?::\s*(?P<rest>.*))?$", re.I)
SLUT = re.compile(r"^(mvh|med venlig|venlig hilsen|hilsen|kærlig hilsen|de bedste|god appetit|bemærk|obs\b|husk\b|p\.?s\b)", re.I)
DAGE = ("mandag", "tirsdag", "onsdag", "torsdag", "fredag")
DAGMAERKE = re.compile(r"^\W*(?P<dag>man(?:dag)?|tir(?:s(?:dag)?)?|ons(?:dag)?|tor(?:s(?:dag)?)?|fre(?:dag)?)\b\.?\s*[:\-–—]?\s*(?P<rest>.*)$", re.I)
KUGLE = re.compile(r"^\s*(?:[-–—•*·▪●]+|\d+[.)])\s+")


def _tekst_fra_html(s):
    """Tekst med linjeskift af en streng, der kan være HTML. Almindelig tekst røres ikke ud over linjeskift."""
    if "<" not in s:
        return s
    s = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", s, flags=re.I | re.S)
    s = re.sub(r"<li[^>]*>", "\n• ", s, flags=re.I)
    s = re.sub(r"</(p|div|li|h[1-6]|tr|table|ul|ol)>|<br\s*/?>", "\n", s, flags=re.I)
    s = re.sub(r"<[^>]+>", "", s)
    return _html.unescape(s).replace("\xa0", " ")


def _linjer(tekst):
    ud = []
    for l in _tekst_fra_html(str(tekst)).splitlines():
        l = re.sub(r"[ \t]+", " ", l).strip()
        if l:
            ud.append(l)
    return ud


def parse_menu(tekst):
    """[(ugedag 1–5 eller None, ret), …] fra linjerne efter «Menu:» (også «Ugens menu:», «Menu uge 46:»). Er en ugedag skrevet alene på en linje, er retten på linjen efter den.
    Står der ingen «Menu:»-linje, men mindst tre linjer, der begynder med en ugedag og har en ret efter («Mandag: …»), bruges de. Stopper ved en afslutning (Mvh …) eller en ny overskrift (linje, der ender på kolon). Højst 7 retter."""
    lin = _linjer(tekst)
    start = forste = None
    for i, l in enumerate(lin):
        m = MENU.match(l)
        if m:
            start, forste = i, (m.group("rest") or "").strip()      # «Menu: Suppe» har første ret på samme linje
            break
    if start is None:
        mærkede = [l for l in lin if (m := DAGMAERKE.match(KUGLE.sub("", l).strip())) and m.group("rest").strip()]
        if len(mærkede) < 3:
            return []
        start, forste = -1, ""                                      # uden overskrift: hele teksten gennemgås
    ud, i = [], 0
    efter = ([forste] if forste else []) + lin[start + 1:]
    while i < len(efter):
        l = efter[i]
        i += 1
        if SLUT.match(l) or (l.endswith(":") and len(l) <= 40 and not DAGMAERKE.match(l)):
            if start == -1:
                continue
            break
        l = KUGLE.sub("", l).strip()
        if not l:
            continue
        m = DAGMAERKE.match(l)
        dag = None
        if m and m.group("rest").strip():
            dag = next((k for k, d in enumerate(DAGE, 1) if d.startswith(m.group("dag").lower()[:3])), None)
            l = m.group("rest").strip()
        elif m and i < len(efter) and not DAGMAERKE.match(KUGLE.sub("", efter[i]).strip()):      # ugedagen alene på linjen: retten står på den næste
            dag = next((k for k, d in enumerate(DAGE, 1) if d.startswith(m.group("dag").lower()[:3])), None)
            l = KUGLE.sub("", efter[i]).strip()
            i += 1
        elif start == -1:
            continue                                                # uden «Menu:»-overskrift tæller kun de mærkede linjer
        ud.append((dag, l))
        if len(ud) >= 7:
            break
    return ud


def til_dage(retter):
    """{"1": ret, …, "5": ret}. Er alle retter mærket med en ugedag (Mandag: …), bruges mærkerne; ellers fylder retterne mandag, tirsdag, … i rækkefølge (højst fem)."""
    if not retter:
        return {}
    if all(d is not None for d, _ in retter):
        return {str(d): r for d, r in retter if 1 <= d <= 5}
    return {str(i): r for i, (_, r) in enumerate(retter[:5], 1)}


def _dato(x):
    try:
        return datetime.fromisoformat(str(x).replace("Z", "+00:00"))
    except ValueError:
        return None


def _poster(x, arvet_emne="", arvet_dato=None):
    """Alle ordbøger i svaret med et emne (eget eller arvet fra tråden) og en tekst."""
    if isinstance(x, list):
        for y in x:
            yield from _poster(y, arvet_emne, arvet_dato)
        return
    if not isinstance(x, dict):
        return
    emne = next((str(x[k]) for k in EMNE_NOEGLER if isinstance(x.get(k), str) and x[k].strip()), "") or arvet_emne
    dato = next((d for d in (_dato(x[k]) for k in DATO_NOEGLER if isinstance(x.get(k), str)) if d), None) or arvet_dato
    tekster = [x[k] for k in TEKST_NOEGLER if isinstance(x.get(k), str) and x[k].strip()]
    # felter, der er en liste/ordbog (fx text: {"html": …}), lader vi rekursionen om
    if tekster:
        yield {"emne": emne, "tekst": "\n".join(tekster), "dato": dato}
    for v in x.values():
        if isinstance(v, (list, dict)):
            yield from _poster(v, emne, dato)


def find_kantine(svar):
    """Den nyeste besked, der handler om kantinen og har en menu: {"uge": 46 eller None, "dage": {"1": …}, "dato": datetime eller None}. Ellers None."""
    if isinstance(svar, dict) and isinstance(svar.get("items"), list):
        svar = svar["items"]
    kandidater = []
    for p in _poster(svar):
        forste = (_linjer(p["tekst"]) or [""])[0]
        if not (KANTINE.match(p["emne"]) or KANTINE.match(forste)):
            continue
        dage = til_dage(parse_menu(p["tekst"]))
        if len(dage) < 3:
            continue
        m = re.search(r"\buge\s*(\d{1,2})\b", p["emne"] + " " + forste, re.I)
        kandidater.append({"uge": int(m.group(1)) if m and 1 <= int(m.group(1)) <= 53 else None, "dage": dage, "dato": p["dato"]})
    if not kandidater:
        return None
    return max(kandidater, key=lambda k: (k["dato"].timestamp() if k["dato"] else 0, k["uge"] or 0))


def tekstvisning(svar, maks=3):
    """De nyeste kantine-breve linje for linje (emne, dato og de første 25 linjer, hver højst 90 tegn), og hvordan menuen blev læst. Til at se, hvorfor en menu ikke findes. Viser ikke afsenderen."""
    if isinstance(svar, dict) and isinstance(svar.get("items"), list):
        svar = svar["items"]
    kandidater = []
    for p in _poster(svar):
        lin = _linjer(p["tekst"])
        if KANTINE.match(p["emne"]) or KANTINE.match(lin[0] if lin else ""):
            kandidater.append((p["dato"].timestamp() if p["dato"] else 0, p, lin))
    kandidater.sort(key=lambda x: -x[0])
    ud = [f"{len(kandidater)} breve handler om kantinen. De {min(maks, len(kandidater))} nyeste:"]
    for nr, (_, p, lin) in enumerate(kandidater[:maks], 1):
        retter = parse_menu(p["tekst"])
        mlinje = next((i for i, l in enumerate(lin) if MENU.match(l)), None)
        ud.append(f"--- brev {nr}: emne «{p['emne'][:80]}», {p['dato'].date().isoformat() if p['dato'] else 'ukendt dato'}, {len(lin)} linjer, «Menu»-linje: {('nr. ' + str(mlinje + 1)) if mlinje is not None else 'FINDES IKKE'}, læst som {len(retter)} retter ---")
        for i, l in enumerate(lin[:25], 1):
            ud.append(f"{i:>3}| {l[:90]}")
        if len(lin) > 25:
            ud.append(f"    … og {len(lin) - 25} linjer mere")
    return "\n".join(ud)


def opbygning(svar):
    """Svarets opbygning UDEN indhold: typer, feltnavne, antal, og om en kantine-besked blev fundet (uge og antal retter). Til fejlfinding."""
    ud = []
    def felter(x, dyb=0, sti="svar"):
        if dyb > 4:
            return
        if isinstance(x, list):
            ud.append(f"{'  ' * dyb}{sti}: liste med {len(x)} elementer")
            if x:
                felter(x[0], dyb + 1, sti + "[0]")
        elif isinstance(x, dict):
            ud.append(f"{'  ' * dyb}{sti}: ordbog med felterne {sorted(x.keys())}")
            for k, v in x.items():
                if isinstance(v, (list, dict)):
                    felter(v, dyb + 1, f"{sti}.{k}")
        else:
            ud.append(f"{'  ' * dyb}{sti}: {type(x).__name__}")
    felter(svar)
    poster = list(_poster(svar.get("items") if isinstance(svar, dict) and isinstance(svar.get("items"), list) else svar))
    ud.append(f"poster med emne/tekst: {len(poster)}; heraf handler {sum(1 for p in poster if KANTINE.match(p['emne']) or KANTINE.match((_linjer(p['tekst']) or [''])[0]))} om kantinen")
    k = find_kantine(svar)
    ud.append("kantine-besked fundet: " + (f"uge {k['uge']}, {len(k['dage'])} retter, dage {sorted(k['dage'])}" if k else "NEJ (ingen med en menu på mindst tre retter)"))
    return "\n".join(ud)
