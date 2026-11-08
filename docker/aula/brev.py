"""
brev.py — ugebrevets HTML → brødtekst og skema.

Et ugebrev fra Min Uddannelse kan indeholde BÅDE ugens skema (en tabel: tider ned ad, ugedage hen ad) og selve brevet (Kære forældre, Ugen der gik …).
Før blev alt strippet til én lang tekst, så skemaet stod som hundrede løse linjer foran brevet, og dagene gik tabt.

Her læses HTML'en med en rigtig parser, så

  - cellerne beholder deres PLADS (en tom celle er tom, og ugedagen er stadig den rigtige). Det kan en flad tekst ikke.
  - skemaet (tabellen med klokkeslæt) tages ud og bliver til lektioner pr. ugedag, som Skema-vinduet kan vise, hvis Aulas kalender ikke har dem.
  - resten (selve brevet) bliver til brødtekst, med et afsnit pr. linje.

Lærernes forbogstaver («(MO, EKS)») sendes bevidst ikke videre: skærmen hænger i køkkenet og skal ikke vise voksnes navne (samme regel som Sync-Aula.build_lessons).
Kun standardbiblioteket. Ren logik uden netværk, så den kan prøves for sig (tests/test_brev.py).
"""
import re
from html.parser import HTMLParser

DAGE = ("mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag", "søndag")
TID = re.compile(r"^\s*(\d{1,2})[:.](\d{2})\s*[-–—]\s*(\d{1,2})[:.](\d{2})\s*$")
HILSEN = re.compile(r"^(kære|hej|goddag|godmorgen)\b", re.I)
LAERERE = re.compile(r"\s*\((?:[A-ZÆØÅ]{1,5})(?:\s*,\s*[A-ZÆØÅ]{1,5})*\)")      # (MO, EKS)
GRUPPE = re.compile(r"^[A-D]\s*:\s*")                                              # «A: Engelsk», «B: Matematik»
DO = re.compile(r"^do\.?$", re.I)                                                  # «DO.» = ditto: samme som timen før
GEAR = re.compile(r"idræt|svømning|bevægelse", re.I)                               # som i Sync-Aula.GEAR_PATTERN
BLOKKE = {"p", "div", "li", "br", "tr", "table", "ul", "ol", "h1", "h2", "h3", "h4", "h5", "h6", "section", "article", "blockquote", "hr", "dd", "dt", "header", "footer"}
SPRING = {"script", "style", "head", "title"}


class _Brev(HTMLParser):
    """Samler tekst uden for tabeller som linjer, og tabeller som rækker af celler (hver celle en liste af linjer). Kun den yderste tabel er en tabel; indre tabeller flades ud i cellen."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.linjer = []          # tekst uden for tabeller
        self.tabeller = []        # [[ [celle_linjer, ...], ... ], ...]  (rækker af celler)
        self._buf = ""
        self._dyb = 0             # tabeldybde
        self._spring = 0
        self._span = 1
        self._tabel = None
        self._raekke = None
        self._celle = None

    # linjer skrives enten til den åbne celle eller til brødteksten
    def _flush(self):
        t = re.sub(r"\s+", " ", self._buf).strip()
        self._buf = ""
        if not t:
            return
        if self._celle is not None:
            self._celle.append(t)
        elif self._dyb == 0:
            self.linjer.append(t)

    # en celle eller række uden sluttag (</td>, </tr>) lukkes, når den næste begynder
    def _luk_celle(self):
        if self._celle is not None:
            self._flush()
            self._raekke.append(self._celle)
            for _ in range(self._span - 1):                    # colspan: pladsen bevares med tomme celler
                self._raekke.append([])
            self._celle = None

    def _luk_raekke(self):
        self._luk_celle()
        if self._raekke is not None:
            self._tabel.append(self._raekke)
            self._raekke = None

    def handle_starttag(self, tag, attrs):
        if tag in SPRING:
            self._spring += 1
            return
        if tag == "table":
            if self._dyb == 0:
                self._flush()
                self._tabel = []
            self._dyb += 1
            return
        if self._dyb == 1 and tag == "tr":
            self._luk_raekke()
            self._flush()
            self._raekke = []
            return
        if self._dyb == 1 and tag in ("td", "th"):
            self._luk_celle()
            self._flush()
            if self._raekke is None:                            # en celle uden <tr>
                self._raekke = []
            try:
                self._span = max(1, min(12, int(dict(attrs).get("colspan") or 1)))
            except ValueError:
                self._span = 1
            self._celle = []
            return
        if tag == "li":
            self._flush()
            self._buf = "• "
            return
        if tag in BLOKKE:
            self._flush()

    def handle_endtag(self, tag):
        if tag in SPRING:
            self._spring = max(0, self._spring - 1)
            return
        if self._dyb == 1 and tag in ("td", "th"):
            self._luk_celle()
            return
        if self._dyb == 1 and tag == "tr":
            self._luk_raekke()
            return
        if tag == "table" and self._dyb > 0:
            self._dyb -= 1
            if self._dyb == 0:
                self._luk_raekke()
                if self._tabel:
                    self.tabeller.append(self._tabel)
                self._tabel = None
            return
        if tag in BLOKKE:
            self._flush()

    def handle_data(self, data):
        if self._spring:
            return
        self._buf += data

    def close(self):
        super().close()
        if self._dyb > 0:                                       # en tabel, der aldrig blev lukket
            self._dyb = 1
            self._luk_raekke()
            if self._tabel:
                self.tabeller.append(self._tabel)
            self._tabel = None
            self._dyb = 0
        self._flush()


def laes_html(raa):
    """Returnerer (tabeller, linjer): tabeller som rækker af celler (hver en liste af linjer), og linjerne uden for tabeller."""
    if not raa:
        return [], []
    p = _Brev()
    p.feed(raa)
    p.close()
    return p.tabeller, p.linjer


def _tid(linjer):
    for l in linjer:
        m = TID.match(l)
        if m:
            a, b, c, d = (int(x) for x in m.groups())
            if a < 24 and c < 24 and b < 60 and d < 60:
                return f"{a:02d}.{b:02d}", f"{c:02d}.{d:02d}", l.strip()
    return None


def find_plan(tabeller):
    """Det skema, der er i brevet: den tabel, der har flest rækker med et klokkeslæt (mindst to). Dagene læses af en overskriftsrække; findes den ikke, er kolonnerne efter tiden mandag, tirsdag …
    Returnerer {"dage": [1..], "raekker": [{"tid", "start", "slut", "celler": {"1": [linjer], …}}]} eller None."""
    bedst, antal_bedst = None, 1
    for tabel in tabeller:
        n = sum(1 for r in tabel if r and _tid(r[0]))
        if n > antal_bedst:
            bedst, antal_bedst = tabel, n
    if bedst is None:
        return None
    kolonner = None                                              # kolonneplads → ugedag (1 = mandag)
    for r in bedst:
        dagplads = {}
        for i, celle in enumerate(r):
            t = " ".join(celle).strip().lower()
            for k, dag in enumerate(DAGE, 1):
                if t == dag or t.startswith(dag + " ") or t.startswith(dag[:3] + "."):
                    dagplads[i] = k
        if len(dagplads) >= 3:
            kolonner = dagplads
            break
    raekker = []
    for r in bedst:
        if not r:
            continue
        t = _tid(r[0])
        if not t:
            continue
        start, slut, tekst = t
        celler = {}
        for i, celle in enumerate(r[1:], 1):
            k = kolonner.get(i) if kolonner else (i if i <= 7 else None)
            if k is None or not celle:
                continue
            celler[str(k)] = list(celle)
        raekker.append({"tid": tekst, "start": start, "slut": slut, "celler": celler})
    if len(raekker) < 2:
        return None
    dage = sorted({int(k) for r in raekker for k in r["celler"]})
    return {"dage": dage or [1, 2, 3, 4, 5], "raekker": raekker}


def _rens_linje(l):
    return LAERERE.sub("", l).strip()


def _lektion(linjer):
    """(titel, note) af en celles linjer. Lærernes forbogstaver fjernes. A:/B:-linjer (to hold i samme time) står sammen i titlen."""
    linjer = [l for l in linjer if l.strip() and not DO.match(l.strip())]
    if not linjer:
        return "", ""
    rene = [_rens_linje(l) for l in linjer]
    grupper = [l for l in rene if GRUPPE.match(l)]
    ovrige = [l for l in rene if not GRUPPE.match(l)]
    if grupper and (not ovrige or GRUPPE.match(rene[0])):
        # kun A:/B:-linjer i toppen: titlen er dem, resten er note
        return " / ".join(grupper), " · ".join(ovrige)
    titel = ovrige[0] if ovrige else rene[0]
    note = " · ".join(([l for l in ovrige[1:]] + grupper))
    return titel, note


def plan_til_lektioner(plan, barn):
    """Lektioner pr. ugedag («1»…«7») i samme form som Sync-Aula.build_lessons, plus «note». «Pause» er ingen lektion. En celle med «DO.» forlænger timen før."""
    dage = {str(i): [] for i in range(1, 8)}
    if not plan:
        return dage
    forrige = {}                                              # ugedag → den sidste lektion, en «DO.» kan forlænge
    for r in plan["raekker"]:
        for k in sorted(r["celler"], key=int):
            linjer = r["celler"][k]
            tekst = [l.strip() for l in linjer if l.strip()]
            if not tekst:
                forrige.pop(k, None)
                continue
            if any(DO.match(l) for l in tekst):                # ditto: samme som timen før
                if k in forrige:
                    forrige[k]["end"] = r["slut"]
                continue
            if all(l.lower() == "pause" for l in tekst):
                forrige.pop(k, None)
                continue
            titel, note = _lektion(tekst)
            if not titel:
                continue
            les = {"child": barn, "start": r["start"], "end": r["slut"], "title": titel, "room": "", "sub": False}
            if note:
                les["note"] = note
            dage[k].append(les)
            forrige[k] = les
    for lst in dage.values():
        lst.sort(key=lambda x: (x["start"], x["title"]))
    return dage


def plan_til_skole(plan, barn):
    """Skole-linjen pr. dag («8.05-13.25», som forsiden viser) af skemaet i brevet, i samme form som Sync-Aula.build_school."""
    ud = {str(i): [] for i in range(1, 8)}
    les = plan_til_lektioner(plan, barn)
    for k, lst in les.items():
        if not lst:
            continue
        flag = ["Idræt"] if any(GEAR.search(x["title"]) for x in lst) else []
        ud[k].append({"child": barn, "hours": f"{min(x['start'] for x in lst)}-{max(x['end'] for x in lst)}", "flags": flag})
    return ud


def krop(linjer, har_plan):
    """Selve brevet. Med et skema i brevet kasseres overskriftslinjerne før hilsenen («Barn 4A uge 46», «Uge 46»); uden skema er alt brev."""
    linjer = [l for l in linjer if l.strip()]
    if not har_plan:
        return "\n".join(linjer)
    g = next((i for i, l in enumerate(linjer) if HILSEN.match(l)), None)
    if g is not None:
        return "\n".join(linjer[g:])
    i = 0
    while i < len(linjer) and len(linjer[i]) <= 40 and re.search(r"\buge\s*\d+", linjer[i], re.I):
        i += 1
    return "\n".join(linjer[i:])


def laes_brev(raa):
    """Alt i ét: (brødtekst, plan eller None). Er der ingen brødtekst (alt stod i tabellen), er brødteksten tom, og kalderen bruger den flade tekst."""
    tabeller, linjer = laes_html(raa)
    plan = find_plan(tabeller)
    return krop(linjer, plan is not None), plan


def skelet(raa, maks=4000):
    """HTML'ens opbygning UDEN tekst: tags, klasser og hvor meget tekst, der stod hvor. Til at vise, hvordan et brev er bygget, uden at vise, hvad der står i det."""
    ud = []

    class P(HTMLParser):
        dyb = 0
        def handle_starttag(s, tag, attrs):
            kl = dict(attrs).get("class") or ""
            kl = ".".join(re.sub(r"[^A-Za-z0-9_-]", "", c) for c in kl.split()[:3])
            span = dict(attrs).get("colspan")
            ud.append("  " * min(s.dyb, 12) + f"<{tag}" + (f".{kl}" if kl else "") + (f" colspan={span}" if span else "") + ">")
            if tag not in ("br", "img", "hr", "input", "meta", "link"): s.dyb += 1
        def handle_endtag(s, tag): s.dyb = max(0, s.dyb - 1)
        def handle_data(s, d):
            n = len(d.strip())
            if n: ud.append("  " * min(s.dyb, 12) + f"[tekst {n} tegn]")
    P().feed(raa or "")
    t = "\n".join(ud)
    return t if len(t) <= maks else t[:maks] + f"\n… (afkortet, {len(ud)} linjer i alt)"
