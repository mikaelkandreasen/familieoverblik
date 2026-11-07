#!/usr/bin/env python3
"""
sprog.py — værktøj til sprogfilen. Sprogene ligger i EN fil: sprog/sprog.json (kilden til alle oversættelser).

  python3 lokal/sprog.py tjek                 kontrollér sprog/sprog.json (format, koder, tags i oversættelser, pladsholdere)
  python3 lokal/sprog.py byg                  skriv public_html/sprog-pakker.js ud fra sprog/sprog.json (det siderne indlæser)
  python3 lokal/sprog.py daek                 vis, hvor mange af sidernes danske tekster hvert sprog dækker
  python3 lokal/sprog.py skabelon KODE [Navn] lav en fil til et NYT sprog: alle danske tekster fra siderne, klar til at blive oversat
                                              (sprog/skabelon-KODE.json). Oversæt værdierne, og læg filen ind via Opsætning → Sprog
                                              eller læg sproget ind i sprog/sprog.json og kør «byg».

Format (sprog/sprog.json, samme format kan lægges ind under Opsætning → Sprog):
  {"format": 1, "kildesprog": "da",
   "sprog": {"en": {"navn": "English", "tekster": {"Dansk tekst": "English text", "Gemt ({0} farver)": "Saved ({0} colors)"}}}}
Nøglen er den danske tekst, præcis som den står på siden (mellemrum og linjeskift er ligegyldige). {0}, {1} … er pladsholdere
for tal og navne, der sættes ind igen. Tekst med <b>, <i>, <code> eller <br> oversættes som en hel (tagget) tekst.
"""
import html
import json
import os
import re
import sys
from html.parser import HTMLParser

ROD = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KILDE = os.path.join(ROD, "sprog", "sprog.json")
UD = os.path.join(ROD, "public_html", "sprog-pakker.js")
SIDER = ["overblik.html", "index.html", "billeder.html", "gaest-wifi.html", "vaelger.html"]
TILLADTE_TAGS = {"b", "i", "em", "strong", "code", "br"}
KODE_RE = re.compile(r"^[a-z]{2,3}(?:-[A-Za-z]{2,4})?$")
ATTR = ("placeholder", "title", "aria-label", "alt")
INLINE = {"b", "i", "em", "strong", "code", "br", "a", "span", "small", "kbd"}


def norm(s):
    return re.sub(r"\s+", " ", s).strip()


class Udtraek(HTMLParser):
    """Danske tekster i en HTML-side: tekstnoder, attributter og hele afsnit med indlejrede <i>/<b>/<code>."""
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stak, self.tekster = [], set()
        self.skjul = 0
        self.afsnit = []          # [(tag, startindex i rå tekst)]

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if a.get("translate") == "no":
            self.skjul += 1; self.stak.append((tag, True)); return
        if tag in ("script", "style", "textarea", "svg"):
            self.skjul += 1; self.stak.append((tag, True)); return
        self.stak.append((tag, False))
        for k in ATTR:
            v = a.get(k)
            if v and re.search(r"[A-Za-zÆØÅæøå]", v) and not self.skjul:
                self.tekster.add(norm(v))

    def handle_startendtag(self, tag, attrs):
        for k in ATTR:
            v = dict(attrs).get(k)
            if v and re.search(r"[A-Za-zÆØÅæøå]", v) and not self.skjul:
                self.tekster.add(norm(v))

    def handle_endtag(self, tag):
        while self.stak:
            t, skjult = self.stak.pop()
            if skjult: self.skjul -= 1
            if t == tag: break

    def handle_data(self, data):
        if self.skjul: return
        n = norm(data)
        if n and re.search(r"[A-Za-zÆØÅæøå]{2}", n): self.tekster.add(n)


def laes_pakker():
    if not os.path.exists(KILDE):
        sys.exit(f"Fandt ikke {KILDE}")
    d = json.load(open(KILDE, encoding="utf-8"))
    return d


def valider(d):
    fejl = []
    if d.get("format") != 1: fejl.append("«format» skal være 1")
    if d.get("kildesprog") != "da": fejl.append("«kildesprog» skal være «da»")
    sp = d.get("sprog")
    if not isinstance(sp, dict) or not sp: return fejl + ["«sprog» mangler"]
    for kode, p in sp.items():
        if not KODE_RE.match(kode) or kode == "da": fejl.append(f"{kode}: ugyldig sprogkode (to eller tre små bogstaver, og ikke «da»)")
        if not isinstance(p, dict) or not isinstance(p.get("navn"), str) or not p["navn"].strip() or len(p["navn"]) > 40: fejl.append(f"{kode}: «navn» mangler eller er for langt"); continue
        t = p.get("tekster")
        if not isinstance(t, dict): fejl.append(f"{kode}: «tekster» mangler"); continue
        for k, v in t.items():
            if not isinstance(v, str) or not v.strip(): continue
            if len(k) > 600 or len(v) > 1200: fejl.append(f"{kode}: for lang tekst: {k[:40]}…")
            for tekst in (k, v):
                for tag in re.findall(r"<\s*/?\s*([A-Za-z0-9]+)[^>]*>", tekst):
                    if tag.lower() not in TILLADTE_TAGS: fejl.append(f"{kode}: tagget <{tag}> er ikke tilladt i «{k[:40]}»")
                if re.search(r"<[^>]*\s(?:on\w+|style|href|src)\s*=", tekst, re.I): fejl.append(f"{kode}: attributter er ikke tilladt i «{k[:40]}»")
            nk = sorted(re.findall(r"\{\d+\}", k)); nv = sorted(re.findall(r"\{\d+\}", v))
            if nk != nv: fejl.append(f"{kode}: pladsholdere passer ikke i «{k[:50]}» ({','.join(nk)} mod {','.join(nv)})")
    return fejl


def sider_tekster():
    ud = {}
    for s in SIDER:
        p = Udtraek()
        p.feed(open(os.path.join(ROD, "public_html", s), encoding="utf-8").read())
        ud[s] = sorted(p.tekster)
    return ud


def byg():
    d = laes_pakker()
    f = valider(d)
    if f:
        print("FEJL i sprog/sprog.json:"); [print("  -", x) for x in f]; sys.exit(1)
    pakker = {k: {"navn": p["navn"], "retning": p.get("retning", "ltr"), "tekster": {kk: vv for kk, vv in sorted(p["tekster"].items()) if isinstance(vv, str) and vv.strip()}} for k, p in sorted(d["sprog"].items())}
    js = ("// GENERERET af lokal/sprog.py byg ud fra sprog/sprog.json. Ret ikke her: ret sprog/sprog.json (eller læg en fil ind under Opsætning → Sprog) og kør byg.\n"
          "export const PAKKER = " + json.dumps(pakker, ensure_ascii=False, indent=1) + ";\n")
    open(UD, "w", encoding="utf-8", newline="\n").write(js)
    print(f"Skrev {os.path.relpath(UD, ROD)}: {', '.join(f'{k} ({len(p['tekster'])} tekster)' for k, p in pakker.items())}")


def daek():
    d = laes_pakker(); st = sider_tekster()
    print(f"{'side':<18}{'tekster':>8}" + "".join(f"{k:>8}" for k in d["sprog"]))
    for s, ts in st.items():
        print(f"{s:<18}{len(ts):>8}" + "".join(f"{100 * sum(1 for t in ts if norm(t) in {norm(k) for k, v in p['tekster'].items() if v}) // max(1, len(ts)):>7}%" for p in d["sprog"].values()))
    alle = set().union(*st.values())
    print(f"{'ialt (unikke)':<18}{len(alle):>8}" + "".join(f"{100 * sum(1 for t in alle if norm(t) in {norm(k) for k, v in p['tekster'].items() if v}) // max(1, len(alle)):>7}%" for p in d["sprog"].values()))


def skabelon(kode, navn):
    if not KODE_RE.match(kode) or kode == "da": sys.exit("Sprogkoden skal være to eller tre små bogstaver (fx sv, no, fr), og ikke «da».")
    d = laes_pakker(); eks = d["sprog"].get(kode, {}).get("tekster", {})
    alle = sorted(set().union(*sider_tekster().values()) | {k for p in d["sprog"].values() for k in p["tekster"]}, key=lambda s: s.lower())
    ud = {"format": 1, "kildesprog": "da", "sprog": {kode: {"navn": navn, "tekster": {t: eks.get(t, "") for t in alle}}}}
    sti = os.path.join(ROD, "sprog", f"skabelon-{kode}.json")
    json.dump(ud, open(sti, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"Skrev {os.path.relpath(sti, ROD)} med {len(alle)} danske tekster. Oversæt værdierne (tom = ikke oversat).")


if __name__ == "__main__":
    a = sys.argv[1:]
    if not a or a[0] in ("-h", "--help"): print(__doc__)
    elif a[0] == "tjek":
        f = valider(laes_pakker()); print("OK" if not f else "\n".join(["FEJL:"] + ["  - " + x for x in f])); sys.exit(1 if f else 0)
    elif a[0] == "byg": byg()
    elif a[0] == "daek": daek()
    elif a[0] == "skabelon" and len(a) >= 2: skabelon(a[1], a[2] if len(a) > 2 else a[1])
    else: print(__doc__); sys.exit(1)
