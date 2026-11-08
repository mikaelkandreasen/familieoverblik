#!/usr/bin/env python3
"""
bootstrap.py — webcontainerens opstart, og det eneste, der erstatter opsaet.py, klargoer.sh og .env i version 2.

Kommandoer (kører inde i containeren; alle stier kan sættes med miljøvariabler, så det kan afprøves uden Docker):

  start          Ved hver opstart: sørger for datamappen, laver nøgler og en opsætningskode FØRSTE gang, og skriver siderne ud.
  render         Skriv siderne ud igen (efter at indstillinger er ændret).
  anvend [--foerste]  (stdin: JSON) Opsætningsguiden og indstillingerne. --foerste afviser, hvis opsætningen allerede er gennemført.
                  Validerer, gemmer og renderer. Svar som JSON på stdout.
  laes           Nuværende indstillinger som JSON (hemmeligheder vises kun som «sat» eller ikke).
  backup         tar.gz af alle data på stdout.
  backlog HANDLING  Backlog-siden: liste, nyt, ret, stem, kommentar, slet, importer, eksport (stdin: JSON).
  totp HANDLING  Totrinsbekræftelse (TOTP): status, start, bekraeft, tjek, fra, koder, husk, alle-ud (stdin: JSON). Se nedenfor.
  gendan FIL     Læg en sikkerhedskopi (tar.gz eller zip, også fra version 2) ind i datamappen.

Alt det, der var hemmeligt og indstillet i hånden før (tokens, PIN, navne, sted, MitID-brugernavn, Anthropic-nøgle, Hyundai-login),
ligger nu i ÉN fil: ugeplan-data/private/instans.json (rettighed 660, ikke i webmappen, spærret af .htaccess).
"""
import base64
import contextlib
import csv
import fcntl
import hashlib
import hmac
import io
import json
import os
import re
import secrets
import shutil
import string
import struct
import sys
import tarfile
import time
import zipfile
from datetime import datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

SKABELON = os.environ.get("FO_SKABELON", "/opt/familieoverblik/skabelon")
HTML = os.environ.get("FO_HTML", "/var/www/html")
LIB = os.environ.get("FO_LIB", "/var/www/ugeplan-lib")
DATA = os.environ.get("FO_DATA", "/var/www/ugeplan-data")
AULA_CONFIG = os.environ.get("FO_AULA_CONFIG", os.path.join(DATA, "private", "aula-config"))
BRUGER = os.environ.get("FO_BRUGER", "www-data")
API_BASE = os.environ.get("FO_API_BASE", "http://web/api.php")

INSTANS = os.path.join(DATA, "private", "instans.json")
FORSOEG = os.path.join(DATA, "private", "opsaetning-forsoeg.json")
ALFA = string.ascii_lowercase + string.digits
KODE_ALFA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"          # uden tegn, der ligner hinanden
MAPPER = ("aula", "ics", "planner", "settings", "private", "cache", "billeder", "bil", "tegneserie")
HEMMELIGE_NOEGLER = {"mitid_brugernavn": 60, "anthropic_noegle": 300, "aula_model": 60, "hyundai_bruger": 120, "hyundai_kode": 120, "hyundai_pin": 12, "hyundai_vin": 30}
MAX_FORSOEG, LAAS_SEKUNDER = 8, 600


class Fejl(Exception):
    """En fejl, brugeren kan rette. Teksten vises i guiden."""


def tilfaeldig(n=40): return "".join(secrets.choice(ALFA) for _ in range(n))
def ident(navn): return navn.strip().lower()
def laes(p):
    with open(p, encoding="utf-8", newline="") as f: return f.read()
def skriv(p, t, mode=None):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    tmp = p + ".tmp"
    with open(tmp, "w", encoding="utf-8", newline="\n") as f: f.write(t)
    if mode is not None: os.chmod(tmp, mode)
    os.replace(tmp, p)


# ── instans.json ─────────────────────────────────────────────────────
def ny_instans():
    return {
        "format": 1, "opsat": False,
        "opsaetningskode": "".join(secrets.choice(KODE_ALFA) for _ in range(8)),
        "tokens": {"read": tilfaeldig(), "write": tilfaeldig(), "cron": tilfaeldig(), "gate": tilfaeldig()},
        "pin": "".join(secrets.choice(string.digits) for _ in range(6)),
        "sv": {"voksne": [{"navn": "Voksen 1", "foedselsdag": ""}], "boern": [{"navn": "Barn 1", "calendar_id": 0, "foedselsdag": ""}], "fodselsdagstema": True},
        "sted": {"lat": 56.1629, "lon": 10.2039, "tidszone": "Europe/Copenhagen"},
        "hemmeligheder": {"aula_model": "claude-opus-5-5"},
    }

def laes_instans():
    if not os.path.exists(INSTANS): return None
    try:
        d = json.loads(laes(INSTANS))
        if isinstance(d, dict) and "sv" in d: d["sv"] = normaliser_sv(d["sv"])
        return d
    except ValueError: raise SystemExit(f"{INSTANS} er ødelagt. Gendan en sikkerhedskopi, eller slet filen for at starte forfra (nye nøgler).")

def gem_instans(d):
    skriv(INSTANS, json.dumps(d, ensure_ascii=False, indent=1) + "\n", 0o660)
    ret_ejer(INSTANS)

def ret_ejer_rekursivt(*rodder):
    """Kører vi som root (ved opstart), gives de renderede mapper til webbrugeren, så PHP (www-data) kan skrive dem om senere."""
    if not hasattr(os, "geteuid") or os.geteuid() != 0: return
    try:
        import pwd; u = pwd.getpwnam(BRUGER)
    except (ImportError, KeyError): return
    for rod in rodder:
        if not os.path.isdir(rod): continue
        for r, dirs, filer in os.walk(rod):
            for n in [r] + [os.path.join(r, x) for x in dirs + filer]:
                try: os.chown(n, u.pw_uid, u.pw_gid, follow_symlinks=False)
                except OSError: pass

def ret_ejer(*stier):
    try:
        import pwd
        u = pwd.getpwnam(BRUGER)
    except (ImportError, KeyError): return
    for s in stier:
        try: os.chown(s, u.pw_uid, u.pw_gid)
        except OSError: pass


# ── validering ───────────────────────────────────────────────────────
def _navn(x, hvad):
    if not isinstance(x, str) or not x.strip(): raise Fejl(f"{hvad} mangler.")
    x = x.strip()
    if len(x) > 30 or re.search(r"[\x00-\x1f\x7f<>\"'\\]", x): raise Fejl(f"{hvad} må højst være 30 tegn uden specialtegn.")
    return x

MAX_VOKSNE, MAX_BOERN = 4, 8
ADULT_SLOTS = [1, 2, 6, 7]                  # farveplads (--p-N) pr. voksen. De første to og børnenes tre første er som før, så eksisterende farver ikke skifter.
CHILD_SLOTS = [3, 4, 5, 8, 9, 10, 11, 12]

def valider_fd(x, hvem="fødselsdagen"):
    """«14.03», «14.03.1985» eller tomt. Returnerer en normaliseret tekst (altid to cifre) eller ''. Kaster Fejl ved en dato, der ikke findes."""
    if x is None or (isinstance(x, str) and not x.strip()): return ""
    if not isinstance(x, str): raise Fejl(f"{hvem}: skriv dato som dd.mm eller dd.mm.åååå.")
    m = re.fullmatch(r"\s*(\d{1,2})[./-](\d{1,2})(?:[./-](\d{4}))?\s*", x)
    if not m: raise Fejl(f"{hvem}: skriv dato som dd.mm eller dd.mm.åååå (fx 14.03 eller 14.03.1985).")
    d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3)) if m.group(3) else None
    try: datetime(y if y else 2000, mo, d)                       # 2000 er et skudår, så 29.02 uden årstal er gyldig
    except ValueError: raise Fejl(f"{hvem}: den dato findes ikke ({x.strip()}).")
    if y is not None and y > datetime.now().year: raise Fejl(f"{hvem}: fødselsdagen kan ikke ligge i fremtiden.")
    if y is not None and y < 1900: raise Fejl(f"{hvem}: årstallet skal være 1900 eller senere.")
    if y is not None and datetime(y, mo, d) > datetime.now(): raise Fejl(f"{hvem}: fødselsdagen kan ikke ligge i fremtiden.")
    return f"{d:02d}.{mo:02d}" + (f".{y}" if y else "")

def normaliser_sv(sv):
    """Version 3.0.0 gemte voksne som tekster. Gør dem til objekter, og sæt standardværdier. Ændrer ikke på gyldige data."""
    if not isinstance(sv, dict): return sv
    ud = dict(sv)
    ud["voksne"] = [{"navn": v} if isinstance(v, str) else v for v in sv.get("voksne", [])] if isinstance(sv.get("voksne"), list) else sv.get("voksne")
    ud.setdefault("fodselsdagstema", True)
    return ud

def valider_sv(sv):
    sv = normaliser_sv(sv)
    if not isinstance(sv, dict): raise Fejl("Navne mangler.")
    voksne = sv.get("voksne"); boern = sv.get("boern")
    if not isinstance(voksne, list) or not 1 <= len(voksne) <= MAX_VOKSNE: raise Fejl(f"Der skal være 1 til {MAX_VOKSNE} voksne.")
    if not isinstance(boern, list) or not 1 <= len(boern) <= MAX_BOERN: raise Fejl(f"Der skal være 1 til {MAX_BOERN} børn.")
    tema = sv.get("fodselsdagstema", True)
    if not isinstance(tema, bool): raise Fejl("Flag og fødselsdagstema skal være til eller fra.")
    v = []
    for x in voksne:
        if not isinstance(x, dict): raise Fejl("Voksne skal have et navn.")
        navn = _navn(x.get("navn"), "Voksnes fornavn")
        v.append({"navn": navn, "foedselsdag": valider_fd(x.get("foedselsdag"), f"Fødselsdag for {navn}")})
    b = []
    for x in boern:
        if not isinstance(x, dict): raise Fejl("Børnene skal have navn og calendar_id.")
        cid = x.get("calendar_id", 0)
        if isinstance(cid, str) and cid.strip().isdigit(): cid = int(cid)
        if isinstance(cid, bool) or not isinstance(cid, int) or cid < 0 or cid > 10**12: raise Fejl("calendar_id skal være et helt tal (eller 0, hvis det udfyldes senere).")
        navn = _navn(x.get("navn"), "Børnenes fornavn")
        b.append({"navn": navn, "calendar_id": cid, "foedselsdag": valider_fd(x.get("foedselsdag"), f"Fødselsdag for {navn}")})
    ids = [ident(x["navn"]) for x in v] + [ident(x["navn"]) for x in b]
    if len(set(ids)) != len(ids): raise Fejl("To personer må ikke have samme navn.")
    if "alle" in ids: raise Fejl("«Alle» er forbeholdt filteret på skærmen. Vælg et andet navn.")
    return {"voksne": v, "boern": b, "fodselsdagstema": tema}

def valider_sted(s):
    if not isinstance(s, dict): raise Fejl("Sted mangler.")
    try: lat, lon = float(s.get("lat")), float(s.get("lon"))
    except (TypeError, ValueError): raise Fejl("Breddegrad og længdegrad skal være tal.")
    if not (-90 <= lat <= 90 and -180 <= lon <= 180): raise Fejl("Breddegrad skal være mellem -90 og 90, længdegrad mellem -180 og 180.")
    tz = s.get("tidszone")
    if not isinstance(tz, str) or not re.fullmatch(r"[A-Za-z][A-Za-z0-9_+-]*(/[A-Za-z0-9_+-]+){0,2}", tz): raise Fejl("Ukendt tidszone. Brug fx Europe/Copenhagen.")
    try: ZoneInfo(tz)
    except (ZoneInfoNotFoundError, ValueError, TypeError): raise Fejl("Ukendt tidszone. Brug fx Europe/Copenhagen.")
    return {"lat": round(lat, 4), "lon": round(lon, 4), "tidszone": tz}

def valider_pin(p):
    p = str(p or "").strip()
    if not (p.isdigit() and 4 <= len(p) <= 8): raise Fejl("PIN-koden skal være 4 til 8 cifre.")
    return p

def valider_hemmeligheder(h):
    if not isinstance(h, dict): raise Fejl("Forbindelser skal være en liste.")
    ud = {}
    for k, v in h.items():
        if k not in HEMMELIGE_NOEGLER: raise Fejl(f"Ukendt indstilling: {k}")
        if not isinstance(v, str) or len(v) > HEMMELIGE_NOEGLER[k] or re.search(r"[\x00-\x1f\x7f]", v): raise Fejl(f"{k}: ugyldig værdi (højst {HEMMELIGE_NOEGLER[k]} tegn, ingen styretegn).")
        v = v.strip()
        if k == "aula_model" and v and not re.fullmatch(r"[A-Za-z0-9._-]{3,60}", v): raise Fejl("Modelnavnet må kun indeholde bogstaver, tal, punktum, understreg og bindestreg.")
        if k == "hyundai_pin" and v and not v.isdigit(): raise Fejl("Hyundai-PIN skal være cifre.")
        ud[k] = v
    return ud


# ── forsøgsloft mod gætning af opsætningskoden ───────────────────────
def _forsoeg():
    try: return json.loads(laes(FORSOEG))
    except (OSError, ValueError): return {"antal": 0, "til": 0}

def tjek_kode(instans, kode):
    f, nu = _forsoeg(), time.time()
    if f.get("til", 0) > nu: raise Fejl(f"For mange forkerte forsøg. Vent {int((f['til'] - nu) // 60) + 1} minutter.")
    if isinstance(kode, str) and hmac.compare_digest(kode.strip().upper().replace("-", "").replace(" ", ""), instans["opsaetningskode"]):
        if os.path.exists(FORSOEG): os.remove(FORSOEG)
        return
    f["antal"] = f.get("antal", 0) + 1
    if f["antal"] >= MAX_FORSOEG: f = {"antal": 0, "til": nu + LAAS_SEKUNDER}
    skriv(FORSOEG, json.dumps(f), 0o660); ret_ejer(FORSOEG)
    raise Fejl("Opsætningskoden er forkert. Den står i containerens log (Dockhand → familieoverblik → web → Logs).")


# ── anvend: guiden og indstillinger ──────────────────────────────────
def anvend(payload, instans, kun_foerste=False):
    """Returnerer (ny instans, svar). Kaster Fejl med tekst til brugeren. kun_foerste: bruges af guiden, som ikke kræver login."""
    if not isinstance(payload, dict): raise Fejl("Forespørgslen skal være JSON.")
    if kun_foerste and instans["opsat"]: raise Fejl("Opsætningen er allerede gennemført. Log ind med PIN-koden og brug Opsætning i stedet.")
    if not instans["opsat"]:
        tjek_kode(instans, payload.get("kode"))
        if "sv" not in payload or "pin" not in payload: raise Fejl("Navne og en PIN-kode skal med, første gang.")
    d = json.loads(json.dumps(instans))
    if "sv" in payload: d["sv"] = valider_sv(payload["sv"])
    if "sted" in payload: d["sted"] = valider_sted(payload["sted"])
    if "pin" in payload and payload["pin"] not in (None, ""): d["pin"] = valider_pin(payload["pin"])
    if "adgang" in payload: d["adgang"] = valider_adgang(payload["adgang"])
    if "hemmeligheder" in payload:
        for k, v in valider_hemmeligheder(payload["hemmeligheder"]).items():
            if v == "": d["hemmeligheder"].pop(k, None)
            else: d["hemmeligheder"][k] = v
    foerste = not d["opsat"]
    d["opsat"] = True; d.pop("opsaetningskode", None)
    return d, {"ok": True, "foerste": foerste, "pin": d["pin"] if foerste else None}

ADGANG_VALG = ("laast", "aaben_visning")
def valider_adgang(x):
    if x not in ADGANG_VALG: raise Fejl("Adgangen skal være «laast» (PIN til alt) eller «aaben_visning» (forsiden kan ses uden PIN).")
    return x

# Åben visning: de scripts og den fil, forsiden bruger. De må læses (GET) uden PIN-cookie. Skal følge GATE_AABNE_LAESNINGER i ugeplan-lib/gate.php (en prøve sammenligner).
AABNE_PHP = ("vejr", "tema", "joke", "elpris", "bil", "info", "sprog", "tegneserie", "strava", "indkob", "billeder")
def aaben_visning_htaccess(t):
    """Omskriver spærreregler i .htaccess til åben visning. Kaster Fejl, hvis skabelonen ikke ligner det, der forventes (så en ændret skabelon ikke stille giver en forkert adgang)."""
    cond = r"RewriteCond %\{HTTP_COOKIE\} !ugeplan_ok=\S+ \[NC\]\n"
    side_regel = r"RewriteRule ^(index\.html|overblik\.html|billeder\.html|gaest-wifi\.html|vaelger\.html|backlog\.html)?$ login.php?to=$1 [L,QSA]"
    m = re.search(r"([ \t]*)(" + cond + r")[ \t]*" + re.escape(side_regel) + r"\n", t)
    if not m: raise Fejl("Kunne ikke finde side-reglen i .htaccess. Åben visning er ikke slået til.")
    ind, c = m.group(1), m.group(2)
    ny = (f"{ind}# ÅBEN VISNING (Opsætning → Login og sikkerhed): forsiden og vælgeren kan ses uden PIN. Alt andet kræver stadig PIN.\n"
          f"{ind}{c}{ind}RewriteRule ^$ overblik.html [R=302,L]\n"
          f"{ind}{c}{ind}RewriteRule ^(index\\.html|billeder\\.html|gaest-wifi\\.html|backlog\\.html)$ login.php?to=$1 [L,QSA]\n")
    t = t[:m.start()] + ny + t[m.end():]
    for regel in [f"RewriteRule ^{n}\\.php(/|$) - [F,L]" for n in AABNE_PHP] + ["RewriteRule ^config\\.js$ - [F,L]"]:
        r = re.compile(r"([ \t]*)(" + cond + r")([ \t]*" + re.escape(regel) + r"\n)")
        if not r.search(t): raise Fejl("Kunne ikke finde reglen «" + regel + "» i .htaccess. Åben visning er ikke slået til.")
        t = r.sub(lambda x: f"{x.group(1)}{x.group(2)}{x.group(1)}RewriteCond %{{REQUEST_METHOD}} !^(GET|HEAD)$\n{x.group(3)}", t, count=1)
    return t

def sikker_visning(d):
    h = d.get("hemmeligheder", {})
    return {"opsat": d["opsat"], "sv": d["sv"], "sted": d["sted"],
            "hemmeligheder": {k: (h.get(k, "") if k in ("aula_model", "mitid_brugernavn", "hyundai_bruger", "hyundai_vin") else None) for k in HEMMELIGE_NOEGLER},
            "sat": {k: bool(h.get(k)) for k in HEMMELIGE_NOEGLER}, "pin_laengde": len(d["pin"]), "adgang": d.get("adgang", "laast")}


# ── render ───────────────────────────────────────────────────────────
def personblok(sv):
    sv = normaliser_sv(sv)
    raekker = [("alle", "Alle", "var(--p-alle)", "")]
    for i, v in enumerate(sv["voksne"]): raekker.append((ident(v["navn"]), v["navn"], f"var(--p-{ADULT_SLOTS[i]})", v.get("foedselsdag", "")))
    for i, b in enumerate(sv["boern"]): raekker.append((ident(b["navn"]), b["navn"], f"var(--p-{CHILD_SLOTS[i]})", b.get("foedselsdag", "")))
    def linje(i, n, c, fd):
        fdtxt = f", birthday: {json.dumps(fd)}" if fd else ""
        return f"  {{ id: {json.dumps(i, ensure_ascii=False)}, name: {json.dumps(n, ensure_ascii=False)}, color: \"{c}\"{fdtxt} }}"
    return ("export const PEOPLE = [\n" + ",\n".join(linje(*r) for r in raekker) + "\n];\n"
            "// Flag og fødselsdagstema på familiemedlemmers fødselsdag (Opsætning → Familie og forbindelser)\n"
            f"export const BIRTHDAY_THEME = {'true' if sv.get('fodselsdagstema', True) else 'false'};\n")

def boernblok(sv):
    linjer = [f"    {{\"name\": {json.dumps(b['navn'], ensure_ascii=False)}, \"calendar_id\": {b['calendar_id']}}}," + ("   # TODO: udfyld calendar_id (Opsætning → Familie)" if not b["calendar_id"] else "") for b in sv["boern"]]
    return "CHILDREN = [\n" + "\n".join(linjer) + "\n]\n"

SKJULT = {"htaccess.txt": ".htaccess"}          # filer, der ligger i projektet uden punktum i navnet (en browser-upload til GitHub tager ikke filer med punktum med) og skrives ud med det rigtige navn

def ud_navn(f): return SKJULT.get(f, f)

def _traer(src, dst, erstat, skip=()):
    for rod, _, filer in os.walk(src):
        for f in filer:
            if f == ".htaccess" and "htaccess.txt" in filer: continue          # den synlige udgave har forrang
            s = os.path.join(rod, f); rel = os.path.join(os.path.relpath(rod, src), ud_navn(f)) if rod != src else ud_navn(f)
            if rel in skip: continue
            d = os.path.join(dst, rel)
            os.makedirs(os.path.dirname(d), exist_ok=True)
            if f.endswith((".png", ".ico", ".woff2")): shutil.copyfile(s, d); continue
            t = laes(s)
            for k, v in erstat.items(): t = t.replace(k, v)
            skriv(d, t)

def lokal_patch(rel, t, opsat, adgang="laast"):
    """Kun lokalt netværk og http: ingen tvungen HTTPS, og login-cookien må bruges uden. Er opsætningen ikke gennemført, sendes login til guiden."""
    if rel == ".htaccess":
        t = re.sub(r"[ \t]*RewriteCond %\{HTTPS\} !=on\n.*?[ \t]*RewriteRule \^ https:[^\n]*\n", "", t, count=1, flags=re.S)
        if adgang == "aaben_visning": t = aaben_visning_htaccess(t)
    elif rel == "login.php":
        t = t.replace("'secure'   => true", "'secure'   => false")
        if not opsat and "start.html" not in t:
            t = t.replace("declare(strict_types=1);", "declare(strict_types=1);\n\n// Opsætningen er ikke gennemført: send til guiden.\nheader('Location: start.html');\nexit;", 1)
    return t

def render(d):
    t = d["tokens"]
    erstat = {"__AABEN_VISNING__": "ja" if d.get("adgang") == "aaben_visning" else "nej", "__READ_TOKEN__": t["read"], "__WRITE_TOKEN__": t["write"], "__CRON_TOKEN__": t["cron"], "__GATE_TOKEN__": t["gate"], "__PIN__": d["pin"], "__API_BASE__": API_BASE}
    os.makedirs(HTML, exist_ok=True); os.makedirs(LIB, exist_ok=True)
    _traer(os.path.join(SKABELON, "html"), HTML, erstat)
    _traer(os.path.join(SKABELON, "lib"), LIB, erstat)
    for rel in (".htaccess", "login.php"):
        p = os.path.join(HTML, rel); skriv(p, lokal_patch(rel, laes(p), d["opsat"], d.get("adgang", "laast")))
    p = os.path.join(HTML, "config.js"); js = laes(p)
    skriv(p, re.sub(r"// <<PEOPLE-START>>\n.*?// <<PEOPLE-END>>", lambda m: "// <<PEOPLE-START>>\n" + personblok(d["sv"]) + "// <<PEOPLE-END>>", js, flags=re.S))
    for n in ("CHANGELOG.md", "VERSION"):
        if os.path.exists(os.path.join(SKABELON, n)): shutil.copyfile(os.path.join(SKABELON, n), os.path.join(HTML, n))
    p = os.path.join(LIB, "config.php"); php = laes(p); s = d["sted"]
    php = re.sub(r"const LATITUDE\s*=\s*[-0-9.]+;", f"const LATITUDE  = {s['lat']};", php)
    php = re.sub(r"const LONGITUDE\s*=\s*[-0-9.]+;", f"const LONGITUDE = {s['lon']};", php)
    php = re.sub(r"const TIMEZONE\s*=\s*'[^']*';", f"const TIMEZONE  = '{s['tidszone']}';", php)
    skriv(p, php)
    # Aula-sync: config.py med de rigtige værdier i stedet for miljøvariabler
    h = d.get("hemmeligheder", {})
    cfg = laes(os.path.join(SKABELON, "aula-config.py")).replace("__API_BASE__", API_BASE)
    cfg = re.sub(r'^ANTHROPIC_MODEL = .*$', f"ANTHROPIC_MODEL = {json.dumps(h.get('aula_model') or 'claude-opus-5-5')}", cfg, flags=re.M)
    cfg = re.sub(r'^WRITE_TOKEN = .*$', f"WRITE_TOKEN = {json.dumps(t['write'])}", cfg, flags=re.M)
    cfg = re.sub(r'^MITID_USERNAME = .*$', f"MITID_USERNAME = {json.dumps(h.get('mitid_brugernavn', ''))}", cfg, flags=re.M)
    cfg = re.sub(r'^ANTHROPIC_API_KEY = .*$', f"ANTHROPIC_API_KEY = {json.dumps(h.get('anthropic_noegle', ''))}", cfg, flags=re.M)
    cfg = re.sub(r"# <<CHILDREN-START>>\n.*?# <<CHILDREN-END>>", lambda m: "# <<CHILDREN-START>>\n" + boernblok(d["sv"]) + "# <<CHILDREN-END>>", cfg, flags=re.S)
    skriv(os.path.join(AULA_CONFIG, "config.py"), cfg, 0o640)
    ret_ejer_rekursivt(HTML, LIB, AULA_CONFIG)

def sikr_data():
    os.makedirs(DATA, exist_ok=True)
    skel = os.path.join(SKABELON, "data")
    for rod, _, filer in os.walk(skel):
        for f in filer:
            if f == ".htaccess" and "htaccess.txt" in filer: continue
            s = os.path.join(rod, f); d = os.path.join(DATA, os.path.relpath(rod, skel), ud_navn(f)) if rod != skel else os.path.join(DATA, ud_navn(f))
            if f == ".gitkeep" or (os.path.exists(d) and ud_navn(f) != ".htaccess"): continue          # spærrefilen skrives altid, så en gammel udgave ikke bliver stående
            os.makedirs(os.path.dirname(d), exist_ok=True); shutil.copyfile(s, d)
    for m in MAPPER: os.makedirs(os.path.join(DATA, m), exist_ok=True)
    os.makedirs(os.path.join(DATA, "private", "aula-state"), exist_ok=True)
    os.makedirs(AULA_CONFIG, exist_ok=True)
    try:
        import pwd; u = pwd.getpwnam(BRUGER)
        for rod, dirs, filer in os.walk(DATA):                 # ejerskab: kun det, der ikke allerede er rigtigt (billedmappen kan være stor)
            for n in dirs + filer:
                p = os.path.join(rod, n)
                try:
                    if os.lstat(p).st_uid != u.pw_uid: os.chown(p, u.pw_uid, u.pw_gid, follow_symlinks=False)
                except OSError: pass
        os.chown(DATA, u.pw_uid, u.pw_gid)
    except (ImportError, KeyError): pass


# ── sikkerhedskopi ───────────────────────────────────────────────────
TILLADT_TOP = set(MAPPER) | {"tegneserie"}
MAX_FILER, MAX_BYTES = 30000, 3 * 1024**3
def _sikkert_navn(n):
    n = n.replace("\\", "/")
    dele = [x for x in n.split("/") if x not in ("", ".")]
    if not dele or n.startswith("/") or ".." in dele or re.match(r"^[A-Za-z]:", n): return None
    if dele[0] == "ugeplan-data": dele = dele[1:]                      # en zip af selve mappen fra version 2
    if not dele or dele[0] not in TILLADT_TOP: return None
    if "cache" == dele[0]: return None
    if any(len(x) > 200 or re.search(r"[\x00-\x1f]", x) for x in dele): return None
    if dele[:2] == ["private", "opsaetning-forsoeg.json"]: return None
    if dele[:2] in (["private", "aula-state"], ["private", "aula-config"]): return None      # Aula-containerens tilstand og config laves af sig selv
    return "/".join(dele)

def backup_til(ud):
    with tarfile.open(fileobj=ud, mode="w|gz") as t:
        for rod, dirs, filer in os.walk(DATA):
            rel = os.path.relpath(rod, DATA)
            if rel == "cache" or rel.startswith("cache" + os.sep) or rel.startswith(os.path.join("private", "aula-config")) or rel.startswith(os.path.join("private", "aula-state")): dirs[:] = []; continue
            for f in filer:
                p = os.path.join(rod, f); r = os.path.relpath(p, DATA)
                if f.endswith(".tmp") or os.path.islink(p): continue
                t.add(p, arcname="ugeplan-data/" + r, recursive=False)

def gendan(fil):
    with contextlib.ExitStack() as stak:               # arkivet skal være åbent, mens filerne læses
        ind = []
        if zipfile.is_zipfile(fil):
            z = stak.enter_context(zipfile.ZipFile(fil))
            for i in z.infolist():
                if i.is_dir(): continue
                if (i.external_attr >> 28) in (0xA, 0x2, 0x6, 0x1): continue     # symlink, tegn-/blok-enhed, fifo
                ind.append((i.filename, i.file_size, lambda i=i, z=z: z.open(i)))
        else:
            try: t = stak.enter_context(tarfile.open(fil, "r:*"))
            except tarfile.TarError: raise Fejl("Filen er hverken en zip eller en tar.gz.")
            for m in t:
                if m.isfile(): ind.append((m.name, m.size, lambda m=m, t=t: t.extractfile(m)))
        return _gendan_ind(ind)

def _gendan_ind(ind):
    if not ind: raise Fejl("Sikkerhedskopien er tom.")
    if len(ind) > MAX_FILER or sum(x[1] for x in ind) > MAX_BYTES: raise Fejl("Sikkerhedskopien er for stor (højst 30.000 filer og 3 GB).")
    n = sprunget = fejlet = 0; instans_ny = None; instans_afvist = False; skrevet = 0
    for navn, _, aabn in ind:
        sikkert = _sikkert_navn(navn)
        if sikkert is None: sprunget += 1; continue
        mål = os.path.join(DATA, sikkert)
        if os.path.realpath(mål) != os.path.join(os.path.realpath(DATA), sikkert) and not os.path.realpath(mål).startswith(os.path.realpath(DATA) + os.sep): sprunget += 1; continue
        os.makedirs(os.path.dirname(mål), exist_ok=True)
        if os.path.islink(os.path.dirname(mål)) or os.path.islink(mål): sprunget += 1; continue
        if sikkert == "private/instans.json":
            # indstillingerne valideres FØR de skrives, så en ødelagt fil aldrig lægges ned over de gode
            with aabn() as k: raa = k.read(1_000_000)
            try:
                d = json.loads(raa.decode("utf-8"))
                if d.get("format") != 1 or not all(isinstance(d.get("tokens", {}).get(x), str) and len(d["tokens"][x]) >= 20 for x in ("read", "write", "cron", "gate")):
                    raise ValueError
                valider_sv(d["sv"]); valider_sted(d["sted"]); valider_pin(d["pin"])
                if not isinstance(d.get("opsat"), bool) or not isinstance(d.get("hemmeligheder", {}), dict): raise ValueError
            except (ValueError, KeyError, Fejl, UnicodeDecodeError): instans_afvist = True; sprunget += 1; continue
            skriv(mål, raa.decode("utf-8"), 0o660); ret_ejer(mål); n += 1; instans_ny = mål; continue
        try:
            with aabn() as k, open(mål + ".tmp", "wb") as o:
                while True:                                    # tæl de rigtige bytes: et arkiv kan lyve om størrelsen (zip-bombe)
                    bid = k.read(1 << 20)
                    if not bid: break
                    skrevet += len(bid)
                    if skrevet > MAX_BYTES: raise Fejl("Sikkerhedskopien fylder mere udpakket, end den påstår (højst 3 GB). Den er ikke lagt helt ind.")
                    o.write(bid)
            os.replace(mål + ".tmp", mål); n += 1
        except OSError:
            fejlet += 1
            try: os.remove(mål + ".tmp")
            except OSError: pass
        except Fejl:
            try: os.remove(mål + ".tmp")
            except OSError: pass
            raise
    sikr_data()
    d = laes_instans()
    if d: render(d)
    svar = {"ok": True, "filer": n, "sprunget_over": sprunget, "instans_gendannet": bool(instans_ny)}
    if fejlet: svar["fejlet"] = fejlet; svar["advarsel"] = f"{fejlet} filer kunne ikke skrives (rettigheder eller fuld disk). Resten er lagt ind. " + svar.get("advarsel", "")
    if instans_afvist: svar["advarsel"] = svar.get("advarsel", "") + "private/instans.json i sikkerhedskopien var ugyldig og blev ikke brugt. Dine nuværende indstillinger og nøgler er uændrede. Resten er lagt ind."
    return svar


# ── totrinsbekræftelse (TOTP, RFC 6238) ──────────────────────────────
# Slås til under Opsætning → Login og sikkerhed. Efter PIN-koden spørger login.php så efter en 6-cifret kode fra en autentificeringsapp
# (eller en gendannelseskode). En enhed kan huskes i et antal dage. login.php kalder «totp tjek» her, så al kryptografi ligger ét sted og er afprøvet.
TOTP_FIL = os.path.join(DATA, "private", "totp.json")
TOTP_SKRIDT, TOTP_CIFRE, TOTP_VINDUE, AFVENTER_SEKUNDER = 30, 6, 1, 900
GENDAN_ALFA = "abcdefghjkmnpqrstuvwxyz23456789"                 # uden i, l, o, 0 og 1, som ligner hinanden
HUSK_VALG = (7, 30, 90, 180, 365)

def nu_tid():
    return float(os.environ.get("FO_NU") or time.time())          # FO_NU findes kun for at kunne afprøve tidsvinduer

def hotp(secret_b32, taeller, cifre=TOTP_CIFRE):
    noegle = base64.b32decode(secret_b32 + "=" * (-len(secret_b32) % 8), casefold=True)
    mac = hmac.new(noegle, struct.pack(">Q", taeller), hashlib.sha1).digest()
    o = mac[-1] & 0xF
    return f"{(struct.unpack('>I', mac[o:o + 4])[0] & 0x7FFFFFFF) % (10 ** cifre):0{cifre}d}"

def totp_taeller(t=None): return int((nu_tid() if t is None else t) // TOTP_SKRIDT)

def tjek_totp(secret, kode, sidste=-1, t=None, vindue=TOTP_VINDUE):
    """Tællerens nummer, hvis koden er rigtig i vinduet og nyere end den sidst brugte (ingen genbrug), ellers None."""
    kode = re.sub(r"\s", "", str(kode or ""))
    if not re.fullmatch(r"\d{%d}" % TOTP_CIFRE, kode): return None
    nu = totp_taeller(t); fundet = None
    for c in range(nu - vindue, nu + vindue + 1):
        if hmac.compare_digest(hotp(secret, c), kode) and c > sidste: fundet = c
    return fundet

def ny_secret(): return base64.b32encode(secrets.token_bytes(20)).decode().rstrip("=")
def gendan_hash(k): return hashlib.sha256(re.sub(r"[\s-]", "", str(k)).lower().encode()).hexdigest()
def ny_gendannelseskoder(n=8):
    koder = ["".join(secrets.choice(GENDAN_ALFA) for _ in range(4)) + "-" + "".join(secrets.choice(GENDAN_ALFA) for _ in range(4)) for _ in range(n)]
    return koder, [gendan_hash(k) for k in koder]

def laes_totp():
    try: d = json.loads(laes(TOTP_FIL))
    except (OSError, ValueError): return None
    return d if isinstance(d, dict) else None
def gem_totp(d):
    skriv(TOTP_FIL, json.dumps(d, indent=1) + "\n", 0o660); ret_ejer(TOTP_FIL)

def roter_gate():
    """Ny adgangscookie til siderne: alle enheder skal logge ind igen. Skriver siderne ud med den nye."""
    d = laes_instans()
    if not d: raise Fejl("Opsætningen er ikke gennemført endnu.")
    d["tokens"]["gate"] = tilfaeldig(); gem_instans(d); render(d)
    return d["tokens"]["gate"]

def totp_status(d=None):
    d = d if d is not None else laes_totp()
    aktiv = bool(d and d.get("aktiv") is True)
    return {"aktiv": aktiv, "gendannelse_tilbage": len(d.get("gendannelse", [])) if aktiv else 0, "husk_dage": d.get("husk_dage", 90) if aktiv else 90}

def totp_brug_kode(d, kode):
    """Prøv en kode (app eller gendannelse). Returnerer typen eller None, og opdaterer d (sidste tæller, brugt gendannelseskode)."""
    c = tjek_totp(d["secret"], kode, d.get("sidste", -1))
    if c is not None: d["sidste"] = c; return "totp"
    h = gendan_hash(kode)
    if re.fullmatch(r"[a-z0-9]{8}", re.sub(r"[\s-]", "", str(kode or "")).lower()) and h in d.get("gendannelse", []):
        d["gendannelse"] = [x for x in d["gendannelse"] if x != h]; return "gendannelse"
    return None

def totp_kommando(handling, payload):
    d = laes_totp()
    if handling == "status": return totp_status(d)
    if not isinstance(payload, dict): raise Fejl("Forespørgslen skal være JSON.")
    if handling == "start":
        if d and d.get("aktiv") is True: raise Fejl("Totrinsbekræftelse er allerede slået til. Slå den fra først, hvis du vil starte forfra.")
        secret = ny_secret(); gem_totp({"aktiv": False, "afventer": {"secret": secret, "oprettet": int(nu_tid())}})
        return {"ok": True, "secret": secret, "uri": f"otpauth://totp/Familieoverblik?secret={secret}&issuer=Familieoverblik&algorithm=SHA1&digits={TOTP_CIFRE}&period={TOTP_SKRIDT}"}
    if handling == "bekraeft":
        a = (d or {}).get("afventer")
        if not a or nu_tid() - a.get("oprettet", 0) > AFVENTER_SEKUNDER: raise Fejl("Opsætningen af totrinsbekræftelse er udløbet. Start forfra.")
        c = tjek_totp(a["secret"], payload.get("kode"))
        if c is None: raise Fejl("Koden passer ikke. Tjek, at telefonens ur er rigtigt, og prøv den næste kode.")
        koder, hashes = ny_gendannelseskoder()
        gem_totp({"aktiv": True, "secret": a["secret"], "sidste": c, "gendannelse": hashes, "enhedsnoegle": secrets.token_hex(32), "husk_dage": 90, "oprettet": datetime.now().isoformat(timespec="seconds")})
        return {"ok": True, "gendannelseskoder": koder, "ny_gate": roter_gate()}
    if handling == "alle-ud":                                   # virker med og uden totrinsbekræftelse: ny adgangscookie, og evt. ny enhedsnøgle
        if d and d.get("aktiv") is True: d["enhedsnoegle"] = secrets.token_hex(32); gem_totp(d)
        return {"ok": True, "ny_gate": roter_gate()}
    if not (d and d.get("aktiv") is True): raise Fejl("Totrinsbekræftelse er ikke slået til.")
    if handling == "tjek":
        t = totp_brug_kode(d, payload.get("kode"))
        if t is None: return {"ok": False}
        gem_totp(d); return {"ok": True, "type": t, "gendannelse_tilbage": len(d["gendannelse"])}
    if handling == "husk":
        dage = payload.get("dage")
        if dage not in HUSK_VALG: raise Fejl(f"Vælg {', '.join(map(str, HUSK_VALG))} dage.")
        d["husk_dage"] = dage; gem_totp(d); return {"ok": True, "husk_dage": dage}
    if handling in ("fra", "koder"):
        if totp_brug_kode(d, payload.get("kode")) is None: raise Fejl("Koden passer ikke.")
        if handling == "fra":
            os.remove(TOTP_FIL); return {"ok": True, "ny_gate": roter_gate()}
        koder, hashes = ny_gendannelseskoder(); d["gendannelse"] = hashes; gem_totp(d)
        return {"ok": True, "gendannelseskoder": koder}
    raise Fejl("Ukendt handling.")


# ── backlog (backlog.html): ønsker og idéer, som familien selv kan logge ─
# Gemmes i private/backlog.json. Al logik og validering ligger her (afprøvet), backlog.php sender kun forespørgslen videre.
BACKLOG_FIL = os.path.join(DATA, "private", "backlog.json")
BL_KATEGORIER = ("billeder", "bil", "kalender", "sprog", "sikkerhed", "skærm", "andet")
BL_PRIORITETER = ("P1", "P2", "P3", "P4")
BL_STATUSSER = ("Idé", "Planlagt", "I gang", "Færdig", "Droppet")
BL_MAX_PUNKTER, BL_MAX_KOMMENTARER, BL_MAX_STEMMER = 500, 50, 40

def bl_tekst(x, maks, hvad, kraevet=False):
    if x is None: x = ""
    if not isinstance(x, str): raise Fejl(f"{hvad} skal være tekst.")
    x = x.replace("\r\n", "\n").replace("\r", "\n").strip()
    if kraevet and not x: raise Fejl(f"{hvad} mangler.")
    if len(x) > maks: raise Fejl(f"{hvad} må højst være {maks} tegn.")
    if re.search(r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]", x): raise Fejl(f"{hvad} må ikke indeholde styretegn.")
    return x
def bl_valg(x, mulige, hvad):
    if x not in mulige: raise Fejl(f"{hvad}: vælg en af {', '.join(mulige)}.")
    return x
def bl_dato(): return datetime.fromtimestamp(nu_tid()).strftime("%Y-%m-%d")
def bl_hvem(x):
    x = bl_tekst(x, 30, "Navn", kraevet=True)
    if "\n" in x: raise Fejl("Navn må ikke indeholde linjeskift.")
    return x
def bl_laes():
    try: d = json.loads(laes(BACKLOG_FIL))
    except (OSError, ValueError): d = None
    if not isinstance(d, dict) or not isinstance(d.get("punkter"), list): d = {"format": 1, "naeste_id": 1, "punkter": []}
    d.setdefault("naeste_id", 1 + max([p.get("id", 0) for p in d["punkter"]] + [0]))
    return d
@contextlib.contextmanager
def bl_laas():
    os.makedirs(os.path.dirname(BACKLOG_FIL), exist_ok=True)
    with open(BACKLOG_FIL + ".lock", "w") as f:
        fcntl.flock(f, fcntl.LOCK_EX)
        try: yield
        finally: fcntl.flock(f, fcntl.LOCK_UN)
    try: ret_ejer(BACKLOG_FIL + ".lock")
    except OSError: pass
def bl_gem(d):
    skriv(BACKLOG_FIL, json.dumps(d, ensure_ascii=False, indent=1) + "\n", 0o660); ret_ejer(BACKLOG_FIL)
def bl_find(d, id_):
    if isinstance(id_, bool) or not isinstance(id_, int): raise Fejl("Ukendt punkt.")
    for p in d["punkter"]:
        if p["id"] == id_: return p
    raise Fejl("Det punkt findes ikke (mere). Opdatér siden.")
def bl_nyt_punkt(d, x, af, tid):
    if len(d["punkter"]) >= BL_MAX_PUNKTER: raise Fejl(f"Der kan højst være {BL_MAX_PUNKTER} punkter. Slet nogle færdige eller droppede.")
    p = {"id": d["naeste_id"], "titel": bl_tekst(x.get("titel"), 120, "Titel", kraevet=True), "beskrivelse": bl_tekst(x.get("beskrivelse"), 4000, "Beskrivelse"),
         "kategori": bl_valg(x.get("kategori", "andet"), BL_KATEGORIER, "Kategori"), "prioritet": bl_valg(x.get("prioritet", "P3"), BL_PRIORITETER, "Prioritet"),
         "status": bl_valg(x.get("status", "Idé"), BL_STATUSSER, "Status"), "af": af, "oprettet": tid, "opdateret": tid, "stemmer": [], "kommentarer": []}
    if "\n" in p["titel"]: raise Fejl("Titlen må ikke have linjeskift.")
    d["naeste_id"] += 1; d["punkter"].append(p); return p

def bl_eksport(d, format_):
    pts = sorted(d["punkter"], key=lambda p: (BL_PRIORITETER.index(p["prioritet"]), -len(p["stemmer"]), p["id"]))
    if format_ == "json":
        return {"filnavn": "backlog.json", "type": "application/json", "indhold": json.dumps({"format": 1, "punkter": d["punkter"]}, ensure_ascii=False, indent=1) + "\n"}
    if format_ == "csv":
        def celle(x):
            x = str(x).replace("\n", " ")
            return "'" + x if x[:1] in ("=", "+", "-", "@", "\t") else x                       # mod formelinjektion i regneark
        b = io.StringIO(); w = csv.writer(b, delimiter=";", quoting=csv.QUOTE_ALL, lineterminator="\r\n")
        w.writerow(["id", "titel", "beskrivelse", "kategori", "prioritet", "status", "oprettet af", "oprettet", "opdateret", "stemmer", "kommentarer"])
        for p in pts: w.writerow([p["id"], celle(p["titel"]), celle(p["beskrivelse"]), p["kategori"], p["prioritet"], p["status"], celle(p["af"]), p["oprettet"], p["opdateret"], len(p["stemmer"]), len(p["kommentarer"])])
        return {"filnavn": "backlog.csv", "type": "text/csv", "indhold": "\ufeff" + b.getvalue()}
    if format_ == "md":
        m = lambda x: str(x).replace("|", "\\|").replace("\n", " ")
        ud = ["# Backlog", "", f"Hentet {bl_dato()}. {len(pts)} punkter.", "", "| # | Punkt | Kategori | Pri. | Status | Stemmer |", "|---|---|---|---|---|---|"]
        for p in pts: ud.append(f"| {p['id']} | {m(p['titel'])} | {p['kategori']} | {p['prioritet']} | {p['status']} | {len(p['stemmer'])} |")
        for p in pts:
            if p["beskrivelse"] or p["kommentarer"]:
                ud += ["", f"## {p['id']}. {p['titel'].replace(chr(10), ' ')}", "", f"*{p['kategori']} · {p['prioritet']} · {p['status']} · foreslået af {p['af']} {p['oprettet']}*"]
                if p["beskrivelse"]: ud += ["", p["beskrivelse"]]
                if p["kommentarer"]: ud += ["", "Kommentarer:"] + [f"- **{k['af']}** ({k['tid']}): {k['tekst'].replace(chr(10), ' ')}" for k in p["kommentarer"]]
        return {"filnavn": "backlog.md", "type": "text/markdown", "indhold": "\n".join(ud) + "\n"}
    raise Fejl("Vælg md, csv eller json.")

def backlog_kommando(handling, payload):
    if not isinstance(payload, dict): raise Fejl("Forespørgslen skal være JSON.")
    ramme = {"kategorier": list(BL_KATEGORIER), "prioriteter": list(BL_PRIORITETER), "statusser": list(BL_STATUSSER)}
    if handling == "liste": return {"ok": True, "punkter": bl_laes()["punkter"], **ramme}
    if handling == "eksport":
        with bl_laas(): return {"ok": True, **bl_eksport(bl_laes(), payload.get("format"))}
    if handling not in ("nyt", "ret", "stem", "kommentar", "slet", "importer"): raise Fejl("Ukendt handling.")
    with bl_laas():
        d = bl_laes(); tid = bl_dato()
        if handling == "nyt":
            p = bl_nyt_punkt(d, payload, bl_hvem(payload.get("af")), tid); bl_gem(d); return {"ok": True, "punkt": p}
        if handling == "importer":
            ind = payload.get("punkter")
            if not isinstance(ind, list) or not ind or len(ind) > BL_MAX_PUNKTER: raise Fejl(f"Filen skal indeholde 1 til {BL_MAX_PUNKTER} punkter.")
            opdater = payload.get("opdater") is True          # {"opdater": true, "punkter": […]}: findes punktet, opdateres status, prioritet og kommentarer i stedet for at det springes over
            fund = {(p["titel"].lower(), p["kategori"]): p for p in d["punkter"]}; tilfoejet = sprunget = opdateret = 0
            for x in ind:
                if not isinstance(x, dict): sprunget += 1; continue
                try:
                    nøgle = (bl_tekst(x.get("titel"), 120, "Titel", kraevet=True).lower(), bl_valg(x.get("kategori", "andet"), BL_KATEGORIER, "Kategori"))
                    if nøgle in fund:
                        if not opdater: sprunget += 1; continue
                        eks = fund[nøgle]
                        if x.get("status") is not None: eks["status"] = bl_valg(x["status"], BL_STATUSSER, "Status")
                        if x.get("prioritet") is not None: eks["prioritet"] = bl_valg(x["prioritet"], BL_PRIORITETER, "Prioritet")
                        for k in (x.get("kommentarer") or [])[:BL_MAX_KOMMENTARER] if isinstance(x.get("kommentarer"), list) else []:
                            if isinstance(k, dict) and len(eks["kommentarer"]) < BL_MAX_KOMMENTARER:
                                eks["kommentarer"].append({"af": bl_hvem(k.get("af") or "Udvikling"), "tekst": bl_tekst(k.get("tekst"), 1000, "Kommentar", kraevet=True), "tid": tid})
                        eks["opdateret"] = tid; opdateret += 1; continue
                    p = bl_nyt_punkt(d, x, bl_hvem(x.get("af") or "Importeret"), bl_tekst(x.get("oprettet") or tid, 10, "Dato"))
                    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", p["oprettet"]): p["oprettet"] = p["opdateret"] = tid
                    p["stemmer"] = [bl_hvem(v) for v in (x.get("stemmer") or [])][:BL_MAX_STEMMER] if isinstance(x.get("stemmer"), list) else []
                    p["stemmer"] = list(dict.fromkeys(v.lower() for v in p["stemmer"]))
                    for k in (x.get("kommentarer") or [])[:BL_MAX_KOMMENTARER] if isinstance(x.get("kommentarer"), list) else []:
                        if isinstance(k, dict): p["kommentarer"].append({"af": bl_hvem(k.get("af") or "Importeret"), "tekst": bl_tekst(k.get("tekst"), 1000, "Kommentar", kraevet=True), "tid": tid})
                    fund[nøgle] = p; tilfoejet += 1
                except Fejl:
                    sprunget += 1
                    if len(d["punkter"]) >= BL_MAX_PUNKTER: break
            bl_gem(d); return {"ok": True, "tilfoejet": tilfoejet, "sprunget_over": sprunget, "opdateret": opdateret}
        p = bl_find(d, payload.get("id"))
        if handling == "slet":
            d["punkter"] = [x for x in d["punkter"] if x["id"] != p["id"]]; bl_gem(d); return {"ok": True}
        if handling == "ret":
            if "titel" in payload:
                p["titel"] = bl_tekst(payload["titel"], 120, "Titel", kraevet=True)
                if "\n" in p["titel"]: raise Fejl("Titlen må ikke have linjeskift.")
            if "beskrivelse" in payload: p["beskrivelse"] = bl_tekst(payload["beskrivelse"], 4000, "Beskrivelse")
            if "kategori" in payload: p["kategori"] = bl_valg(payload["kategori"], BL_KATEGORIER, "Kategori")
            if "prioritet" in payload: p["prioritet"] = bl_valg(payload["prioritet"], BL_PRIORITETER, "Prioritet")
            if "status" in payload: p["status"] = bl_valg(payload["status"], BL_STATUSSER, "Status")
            p["opdateret"] = tid; bl_gem(d); return {"ok": True, "punkt": p}
        if handling == "stem":
            v = bl_hvem(payload.get("hvem")).lower()
            if v in p["stemmer"]: p["stemmer"].remove(v)
            elif len(p["stemmer"]) >= BL_MAX_STEMMER: raise Fejl("Punktet har allerede flest mulige stemmer.")
            else: p["stemmer"].append(v)
            bl_gem(d); return {"ok": True, "stemmer": p["stemmer"]}
        if handling == "kommentar":
            if len(p["kommentarer"]) >= BL_MAX_KOMMENTARER: raise Fejl(f"Der kan højst være {BL_MAX_KOMMENTARER} kommentarer på et punkt.")
            p["kommentarer"].append({"af": bl_hvem(payload.get("af")), "tekst": bl_tekst(payload.get("tekst"), 1000, "Kommentar", kraevet=True), "tid": tid})
            p["opdateret"] = tid; bl_gem(d); return {"ok": True, "kommentarer": p["kommentarer"]}


# ── kommandoer ───────────────────────────────────────────────────────
def start():
    sikr_data()
    d = laes_instans()
    ny = d is None
    if ny: d = ny_instans(); gem_instans(d)
    render(d)
    if not d["opsat"]:
        print("=" * 64, flush=True)
        print(f"  FAMILIEOVERBLIK: opsætningen er ikke gennemført endnu.", flush=True)
        print(f"  Åbn siden i en browser og følg guiden. Opsætningskode: {d['opsaetningskode']}", flush=True)
        print("=" * 64, flush=True)
    else:
        print(f"Familieoverblik er sat op ({len(d['sv']['voksne'])} voksne, {len(d['sv']['boern'])} børn).", flush=True)

def main(a):
    if not a or a[0] in ("-h", "--help"): print(__doc__); return 0
    c = a[0]
    if c == "start": start(); return 0
    if c == "render":
        d = laes_instans()
        if not d: raise SystemExit("Ingen instans.json endnu. Kør start først.")
        render(d); return 0
    if c in ("anvend", "laes"):
        d = laes_instans()
        if not d: print(json.dumps({"ok": False, "fejl": "Serveren er ikke klar endnu. Prøv igen om lidt."}, ensure_ascii=False)); return 1
        if c == "laes": print(json.dumps(sikker_visning(d), ensure_ascii=False)); return 0
        try:
            payload = json.loads(sys.stdin.read() or "null")
            ny, svar = anvend(payload, d, kun_foerste="--foerste" in a[1:])
            gem_instans(ny); render(ny)
            print(json.dumps(svar, ensure_ascii=False)); return 0
        except Fejl as e: print(json.dumps({"ok": False, "fejl": str(e)}, ensure_ascii=False)); return 1
        except ValueError: print(json.dumps({"ok": False, "fejl": "Forespørgslen skal være JSON."}, ensure_ascii=False)); return 1
    if c == "backlog" and len(a) == 2:
        try:
            payload = json.loads(sys.stdin.read() or "{}")
            svar = backlog_kommando(a[1], payload)
            print(json.dumps(svar, ensure_ascii=False)); return 0
        except Fejl as e: print(json.dumps({"ok": False, "fejl": str(e)}, ensure_ascii=False)); return 1
        except ValueError: print(json.dumps({"ok": False, "fejl": "Forespørgslen skal være JSON."}, ensure_ascii=False)); return 1
    if c == "totp" and len(a) == 2:
        try:
            payload = json.loads(sys.stdin.read() or "{}") if a[1] != "status" else {}
            svar = totp_kommando(a[1], payload)
            print(json.dumps(svar, ensure_ascii=False)); return 0 if svar.get("ok", True) else 1
        except Fejl as e: print(json.dumps({"ok": False, "fejl": str(e)}, ensure_ascii=False)); return 1
        except ValueError: print(json.dumps({"ok": False, "fejl": "Forespørgslen skal være JSON."}, ensure_ascii=False)); return 1
    if c == "backup": backup_til(sys.stdout.buffer); return 0
    if c == "gendan" and len(a) == 2:
        try: print(json.dumps(gendan(a[1]), ensure_ascii=False)); return 0
        except Fejl as e: print(json.dumps({"ok": False, "fejl": str(e)}, ensure_ascii=False)); return 1
    print(__doc__); return 1

if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
