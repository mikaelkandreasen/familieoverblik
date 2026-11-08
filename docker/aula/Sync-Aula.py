"""
Sync-Aula.py

Henter data fra Aula og skriver det til webhotellets api.php, så ugeplan-
skærmen kan vise det.

Kalder `aula`-kommandolinjeværktøjet frem for at bruge biblioteket direkte. Det er
bevidst: CLI'ens JSON-format er stabilt og afprøvet, hvor bibliotekets funktioner
skifter signatur mellem versioner.

Hvad der hentes:
  - skemaet, som koges ned til én linje per barn per dag ("8.05-13.25")
  - de enkelte lektioner (fag, tid, lokale, vikar), til Skema-vinduet i Overblik
  - ugebreve fra MinUddannelse for hver af de viste uger, strippet for HTML
  - huskepunkter per ugedag, udtrukket af ugebrevene med Claude
  - datobestemte begivenheder ("23/9: i biografen"), som gemmes uafhængigt af ugen
  - opgaver (tom i august — gemmes råt til senere, hvis der kommer noget)

Konfiguration står i config.py. Kør:  uv run Sync-Aula.py

Kør med --dump for at gemme Aulas rå svar i aula-dump/ (til fejlfinding, hvis Aula eller biblioteket har ændret formatet).
"""

import hashlib
import html
import json
import os
import re
import subprocess
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta
from pathlib import Path

import brev
import kantine
from config import (ANTHROPIC_API_KEY, ANTHROPIC_MODEL, API_BASE, CHILDREN,
                    MITID_USERNAME, WRITE_TOKEN)

WEEKS = 2                      # denne uge + næste
GEAR_PATTERN = re.compile(r"idræt|svømning|bevægelse", re.I)
LONG_EVENT_HOURS = 10          # poster længere end dette regnes som heldagsposter
LETTER_LIMIT = 14000           # hvor meget af et ugebrev der sendes til analyse

HERE = Path(__file__).parent
# Log, cache og dump ligger i AULA_STATE_DIR (et volume i version 3), ellers ved siden af scriptet.
STATE = Path(os.environ.get("AULA_STATE_DIR") or HERE)
STATE.mkdir(parents=True, exist_ok=True)
LOG = STATE / "aula-sync.log"


def log(msg: str) -> None:
    line = f"{datetime.now():%Y-%m-%d %H:%M:%S}  {msg}"
    print(line)
    with LOG.open("a", encoding="utf-8") as f:
        f.write(line + "\n")


# ─── 1. Kald aula-CLI'en ────────────────────────────────────────────
AULA_TRIES = 3               # Aula svarer 503 i ny og næ
AULA_TIMEOUT = 180           # sekunder, før en aula-kommando opgives
AULA_PAUSE = 4               # sekunder mellem forsøg


def aula_json(*args: str, delvist: bool = False):
    """Kør en aula-kommando og returnér den parsede JSON.

    Aulas API svarer med jævne mellemrum 503 uden grund. Et enkelt forsøg
    er derfor for skrøbeligt til en opgave, der kører uden nogen kigger med
    — så vi prøver et par gange, før vi giver op.
    """
    sidste = None
    for forsøg in range(1, AULA_TRIES + 1):
        try:
            return _aula_json_once(*args, delvist=delvist)
        except Exception as exc:
            sidste = exc
            if forsøg < AULA_TRIES:
                log(f"  {' '.join(args)} fejlede ({exc}) — prøver igen om {AULA_PAUSE}s")
                time.sleep(AULA_PAUSE)
    raise sidste


def _aula_json_once(*args: str, delvist: bool = False):
    cmd = ["aula", "--username", MITID_USERNAME, "--output", "json", *args]

    # Tving underprocessen til UTF-8. Uden det skriver den i konsollens egen
    # kodning, og danske tegn brækker læsningen.
    env = {**os.environ, "PYTHONUTF8": "1", "PYTHONIOENCODING": "utf-8"}

    # Uden shell=True: med shell=True samler Windows selv listen til én streng
    # og quoter den, og et brugernavn med mellemrum eller & brækker kaldet.
    # Skulle PATH kun kende en .cmd-genvej, falder vi tilbage.
    # stdin lukkes og der er en tidsgrænse: er loginnøglen udløbet, vil aula ellers vise en QR-kode og vente
    # på, at nogen scanner den. Det hænger en kørsel uden skærm i al evighed.
    try:
        try:
            r = subprocess.run(cmd, capture_output=True, env=env, stdin=subprocess.DEVNULL, timeout=AULA_TIMEOUT)
        except FileNotFoundError:
            r = subprocess.run(subprocess.list2cmdline(cmd), capture_output=True,
                               env=env, shell=True, stdin=subprocess.DEVNULL, timeout=AULA_TIMEOUT)
    except subprocess.TimeoutExpired:
        raise RuntimeError(f"{' '.join(args)} svarede ikke inden {AULA_TIMEOUT}s. Er Aula-login udløbet? "
                           f"Log ind igen (./lokal/hjaelp.sh aula-login), og kør derefter synkroniseringen igen.") from None

    # delvist: en søgning, der ikke nåede til ende, giver kode 1, men skriver stadig de resultater, den fandt (aula messages --search). De er bedre end ingenting.
    if r.returncode != 0 and not (delvist and (r.stdout or b"").strip()):
        err = (r.stderr or b"").decode("utf-8", "replace").strip()[:400]
        raise RuntimeError(f"{' '.join(args)} fejlede: {err}")

    raw = r.stdout or b""
    try:
        out = raw.decode("utf-8")
    except UnicodeDecodeError:
        out = raw.decode("cp1252", "replace")

    # CLI'en kan skrive statuslinjer før JSON'en — find starten på selve dokumentet
    i = min((p for p in (out.find("["), out.find("{")) if p != -1), default=-1)
    if i == -1:
        # Uden at vise hvad der KOM, kan man ikke se forskel paa en udloebet
        # session, en tom uge og en aendret CLI — og alle tre giver samme
        # intetsigende fejl.
        err = (r.stderr or b"").decode("utf-8", "replace").strip()
        vist = out.strip()[:200] or "(ingenting)"
        raise RuntimeError(f"{' '.join(args)} gav ingen JSON tilbage. "
                           f"Svar: {vist!r}" + (f" Fejlkanal: {err[:200]!r}" if err else ""))
    return json.loads(out[i:])


def aula_version() -> str:
    """Versionen af aula-værktøjet og Python, til loggen. Ældre udgaver kender ikke --version."""
    try:
        r = subprocess.run(["aula", "--version"], capture_output=True, stdin=subprocess.DEVNULL, timeout=30)
        tekst = ((r.stdout or b"") + (r.stderr or b"")).decode("utf-8", "replace").strip().splitlines()
        return tekst[0][:120] if tekst else "ukendt"
    except Exception:
        return "ukendt"


# ─── 1b. Form-vagter ────────────────────────────────────────────────
# Aula-biblioteket har skiftet udgave mange gange, og dets JSON kan skifte felter. Uden et tjek giver det
# et tomt skema uden nogen fejl. Her stoppes det i stedet med en besked, der siger, hvad der mangler.
SKEMA_FELTER = ("belongs_to", "start_datetime", "end_datetime")


def tjek_skema(events):
    if not isinstance(events, list):
        raise RuntimeError(f"skemaet kom som {type(events).__name__} og ikke som en liste. Kør Sync-Aula.py --dump og send filen aula-dump/calendar.json.")
    if events and not any(isinstance(e, dict) and all(k in e for k in SKEMA_FELTER) for e in events[:50]):
        fundet = sorted(events[0].keys()) if isinstance(events[0], dict) else type(events[0]).__name__
        raise RuntimeError(f"skemaet har ikke felterne {', '.join(SKEMA_FELTER)}. Fandt: {fundet}. "
                           "Aula-biblioteket har sikkert ændret formatet. Kør Sync-Aula.py --dump og send filen aula-dump/calendar.json.")
    return events


def tjek_ugeplan(ugeplan):
    if not isinstance(ugeplan, list):
        raise RuntimeError(f"ugebrevene kom som {type(ugeplan).__name__} og ikke som en liste. Kør Sync-Aula.py --dump og send aula-dump/ugeplan.json.")
    if ugeplan and not any(isinstance(p, dict) and "institutions" in p for p in ugeplan):
        fundet = sorted(ugeplan[0].keys()) if isinstance(ugeplan[0], dict) else type(ugeplan[0]).__name__
        raise RuntimeError(f"ugebrevene har ikke feltet 'institutions'. Fandt: {fundet}. "
                           "Kør Sync-Aula.py --dump og send filen aula-dump/ugeplan.json.")
    return ugeplan


def hent_kantine():
    """Kantinens ugemenu: den nyeste besked, hvis emne (eller første linje) starter med «Kantine» og har en liste efter «Menu:». Returnerer {"uge", "dage", "dato"} eller None. Fejl er en advarsel, aldrig et stop."""
    for args in (("messages", "--search", "Kantine"), ("messages", "--limit", "40")):
        try:
            k = kantine.find_kantine(aula_json(*args, delvist=True))
        except Exception as exc:
            log(f"advarsel: kantinens menu kunne ikke hentes med «aula {' '.join(args)}» ({exc})")
            continue
        if k:
            return k
    log("kantine: ingen besked med en menu fundet. Kør Sync-Aula.py --kantineform for at se svarets opbygning (uden indhold).")
    return None


def kantinetekst() -> int:
    """Viser de nyeste kantine-breve linje for linje, så man kan se, hvorfor menuen ikke findes (kantinens tekst står der, ikke afsenderen)."""
    try:
        print(kantine.tekstvisning(aula_json("messages", "--search", "Kantine", delvist=True)))
    except Exception as exc:
        print(f"fejlede: {exc}")
    return 0


def placer_kantine(weeks, kant) -> str:
    """Lægger menuen på den hentede uge, den handler om (ugenummeret står i beskedens emne). Returnerer en logtekst."""
    uge = kant.get("uge")
    mal = next((w for w in weeks if w["monday"].isocalendar().week == uge), None) if uge else None
    if mal is None:
        hentet = ", ".join(str(w["monday"].isocalendar().week) for w in weeks)
        return f"kantine: menuen er for uge {uge or 'ukendt (ugenummeret kunne ikke læses)'}, og der hentes kun uge {hentet}. Gemmes ikke."
    mal["kantine"] = {"dage": kant["dage"]}
    return f"kantine: menuen for uge {uge} ({len(kant['dage'])} retter) gemmes på {mal['id']}"


def kantineform() -> int:
    """Viser opbygningen af det, aula messages svarer, UDEN indhold (feltnavne, antal, og om en kantine-besked blev fundet)."""
    for args in (("messages", "--search", "Kantine"), ("messages", "--limit", "40")):
        print("== aula " + " ".join(args))
        try:
            print(kantine.opbygning(aula_json(*args, delvist=True)))
        except Exception as exc:
            print(f"fejlede: {exc}")
    return 0


def brevform() -> int:
    """Viser, hvordan ugebrevenes HTML er bygget, UDEN at vise, hvad der står i dem (tags, klasser og tekstmængde). Kan sendes uden skoledata."""
    iso = date.today().isocalendar()
    ugeplan = aula_json("mu:ugeplan", "--week", f"{iso.year}-W{iso.week:02d}")
    n = 0
    for person in ugeplan or []:
        for inst in person.get("institutions") or []:
            for letter in inst.get("letters") or []:
                n += 1
                raa = letter.get("content_html", "") or ""
                tab, lin = brev.laes_html(raa)
                plan = brev.find_plan(tab)
                print(f"--- brev {n}: felter {sorted(letter.keys())}, {len(raa)} tegn HTML, {len(tab)} tabeller, {len(lin)} tekstlinjer uden for tabeller, "
                      f"skema {'FUNDET: ' + str(len(plan['raekker'])) + ' rækker, dage ' + str(plan['dage']) if plan else 'ikke fundet'} ---")
                print(brev.skelet(raa))
    if not n:
        print("Ingen ugebreve at vise for denne uge.")
    return 0


def dump() -> int:
    """Gemmer Aulas rå svar, så et ændret format kan ses. Filerne indeholder skoledata: del dem kun med omtanke."""
    mappe = STATE / "aula-dump"
    mappe.mkdir(exist_ok=True)
    today = date.today()
    monday = today - timedelta(days=today.weekday())
    iso = monday.isocalendar()
    opgaver = [("calendar", ("calendar", "--start-date", monday.isoformat())),
               ("ugeplan", ("mu:ugeplan", "--week", f"{iso.year}-W{iso.week:02d}")),
               ("important-dates", ("important-dates",))]
    log(f"aula: {aula_version()}  python: {sys.version.split()[0]}")
    ok = True
    for navn, args in opgaver:
        try:
            data = aula_json(*args)
        except Exception as exc:
            log(f"  {navn}: FEJL {exc}")
            ok = False
            continue
        (mappe / f"{navn}.json").write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        første = data[0] if isinstance(data, list) and data else data
        felter = sorted(første.keys()) if isinstance(første, dict) else type(første).__name__
        log(f"  {navn}: {len(data) if hasattr(data, '__len__') else '?'} poster, felter: {felter}")
    log(f"gemt i {mappe}. Filerne indeholder skoledata: del dem kun med omtanke.")
    return 0 if ok else 1


# ─── 2. Skemaet → én linje per barn per dag ─────────────────────────
def build_school(events, monday: date):
    """Reducer enkeltlektioner til mødetid, sluttid og eventuelle huskeflag."""
    buckets: dict[tuple[int, str], dict] = {}

    for e in events:
        owner = next((c for c in CHILDREN if c["calendar_id"] == e.get("belongs_to")), None)
        if not owner:
            continue
        try:
            start = datetime.fromisoformat(e["start_datetime"])
            end = datetime.fromisoformat(e["end_datetime"])
        except (KeyError, ValueError):
            continue

        idx = (start.date() - monday).days + 1
        if not 1 <= idx <= 7:
            continue

        b = buckets.setdefault((idx, owner["name"]),
                               {"start": None, "end": None, "flags": set(), "note": ""})

        # Skemaet indeholder af og til poster der dækker hele dagen (ture, emneuger).
        # De ville trække mødetiden til 02.00 og sluttiden til 01.59, så de holdes
        # uden for beregningen og vises i stedet med deres egen tekst.
        if (end - start).total_seconds() >= LONG_EVENT_HOURS * 3600:
            b["note"] = b["note"] or (e.get("title") or "hele dagen")
            continue

        b["start"] = start if b["start"] is None else min(b["start"], start)
        b["end"] = end if b["end"] is None else max(b["end"], end)
        if GEAR_PATTERN.search(e.get("title") or ""):
            b["flags"].add("Idræt")

    days: dict[str, list] = {str(i): [] for i in range(1, 8)}
    # Rækkefølgen følger CHILDREN, så børnene altid står ens på skærmen
    order = {c["name"]: i for i, c in enumerate(CHILDREN)}
    for (idx, child), b in sorted(buckets.items(), key=lambda kv: (kv[0][0], order.get(kv[0][1], 99))):
        # En emneuge har som regel almindelige lektioner registreret omkring sig.
        # Før vandt klokkeslættene, og titlen forsvandt — netop de dage hvor den
        # betyder mest. Nu vises begge: tiderne som tid, noten som flag.
        flags = sorted(b["flags"])
        if b["note"] and b["start"]:
            flags.append(b["note"])

        days[str(idx)].append({
            "child": child,
            "hours": f"{b['start']:%H.%M}-{b['end']:%H.%M}" if b["start"] else b["note"],
            "flags": flags,
        })
    return days


# ─── 2b. De enkelte lektioner → Skema-vinduet i Overblik ────────────
def build_lessons(events, monday: date):
    """Hver lektion for sig: tid, fag, lokale og om der er vikar.

    build_school koger dagen ned til "8.05-13.25", og det er stadig den linje
    forsiden viser. Børnene vil også kunne se, HVAD de har — det er det her.
    Samme regler som build_school: kun børn i CHILDREN, kun ugens dage, og
    heldagsposter (ture, emneuger) er ikke lektioner, så de springes over her;
    deres tekst står allerede som flag på skole-linjen.

    Lærernavne sendes bevidst IKKE med: skærmen hænger i køkkenet og skal
    ikke vise voksnes navne, bare for at vise noget. Vikar vises som et flag.
    """
    days: dict[str, list] = {str(i): [] for i in range(1, 8)}
    order = {c["name"]: i for i, c in enumerate(CHILDREN)}
    for e in events:
        owner = next((c for c in CHILDREN if c["calendar_id"] == e.get("belongs_to")), None)
        if not owner:
            continue
        try:
            start = datetime.fromisoformat(e["start_datetime"])
            end = datetime.fromisoformat(e["end_datetime"])
        except (KeyError, TypeError, ValueError):
            continue
        idx = (start.date() - monday).days + 1
        if not 1 <= idx <= 7:
            continue
        if (end - start).total_seconds() >= LONG_EVENT_HOURS * 3600:
            continue
        days[str(idx)].append({
            "child": owner["name"],
            "start": f"{start:%H.%M}",
            "end": f"{end:%H.%M}",
            "title": (e.get("title") or "").strip() or "Lektion",
            "room": (e.get("location") or "").strip(),
            "sub": bool(e.get("has_substitute")),
        })
    for lst in days.values():
        lst.sort(key=lambda x: (order.get(x["child"], 99), x["start"], x["title"]))
    return days


# ─── 3. Ugebreve → ren tekst ────────────────────────────────────────
TAG = re.compile(r"<[^>]+>")
BREAKS = re.compile(r"</(p|div|li|h[1-6]|tr)>|<br\s*/?>", re.I)


def strip_html(raw: str) -> str:
    if not raw:
        return ""
    s = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", raw, flags=re.I | re.S)
    s = re.sub(r"<li[^>]*>", "\n• ", s, flags=re.I)
    s = BREAKS.sub("\n", s)
    s = TAG.sub("", s)
    s = html.unescape(s).replace("\xa0", " ")
    lines = [re.sub(r"[ \t]+", " ", ln).strip() for ln in s.split("\n")]
    return "\n".join(ln for ln in lines if ln)


def rens_breve(letters):
    """Brevene, som de gemmes: uden de nøgler, der kun er til brug her (understreg)."""
    return [{k: v for k, v in l.items() if not k.startswith("_")} for l in letters]


def fyld_fra_breve(wk) -> int:
    """Står skemaet ikke i Aulas kalender, bruges det, der står i ugebrevet (en tabel med klokkeslæt). Pr. barn og dag: har kalenderen lektioner, bevares de.
    Fejlede kalenderen helt (school er None), skrives kun de dage, brevet har lektioner for, så en tidligere hentning ikke overskrives med tomme dage.
    Returnerer antal lektioner, der kom fra brevene."""
    planer = [(l["child"], l["_plan"]) for l in wk["letters"] if l.get("_plan")]
    if not planer:
        return 0
    fra_kalender = wk["school"] is not None
    lessons = wk["lessons_by_day"] if wk["lessons_by_day"] is not None else {str(i): [] for i in range(1, 8)}
    school = wk["school"] if fra_kalender else {str(i): [] for i in range(1, 8)}
    ny_les = {str(i): [] for i in range(1, 8)}
    n = 0
    for barn, plan in planer:
        les, sk = brev.plan_til_lektioner(plan, barn), brev.plan_til_skole(plan, barn)
        for k in "1234567":
            if les[k] and not any(x["child"] == barn for x in lessons[k]):
                lessons[k].extend(les[k]); ny_les[k].extend(les[k]); n += len(les[k])
            if sk[k] and not any(x["child"] == barn for x in school[k]):
                school[k].extend(sk[k])
    if n == 0:
        return 0
    order = {c["name"]: i for i, c in enumerate(CHILDREN)}
    for lst in lessons.values():
        lst.sort(key=lambda x: (order.get(x["child"], 99), x["start"], x["title"]))
    for lst in school.values():
        lst.sort(key=lambda x: order.get(x["child"], 99))
    if not fra_kalender:                                 # kun de dage, vi har noget for
        lessons = {k: v for k, v in lessons.items() if v}
        school = {k: v for k, v in school.items() if v}
    wk["lessons_by_day"], wk["school"] = lessons, school
    return n


def match_child(full_name: str):
    """Find barnet ud fra afsenderens fulde navn.

    Der matches på HELE fornavnet. Før var det en substring-test, og så fangede
    "Ida" et brev til "Frida", fordi next() tager første træf i CHILDREN-
    rækkefølge. Navnet styrer farve, sortering og hvilken blok huskepunkterne
    havner under, så ét forkert match flytter hele kolonnen.
    """
    first = (full_name or "").strip().split()
    if not first:
        return None
    first = first[0].casefold()
    return next((c["name"] for c in CHILDREN if c["name"].casefold() == first), None)


def build_letters(ugeplan, week_no: int):
    letters = []
    order = {c["name"]: i for i, c in enumerate(CHILDREN)}
    for person in ugeplan or []:
        full_name = person.get("name", "")
        child = match_child(full_name)
        if child is None:
            log(f"advarsel: ugebrev fra '{full_name}' matcher ingen i CHILDREN — springes over")
            continue

        for inst in person.get("institutions") or []:
            for letter in inst.get("letters") or []:
                # Et brev uden ugenummer kan ikke placeres. Før slap det igennem
                # for HVER uge i kørslen og stod derfor to gange på skærmen.
                if letter.get("week_number") != week_no:
                    continue
                raa = letter.get("content_html", "")
                text = strip_html(raa)
                if not text:
                    continue
                # «full» er hele brevet som flad tekst (det, analysen læser). «body» er selve brevet uden skemaet, og skemaet i brevet ligger i «_plan»
                # (en nøgle med understreg gemmes ikke, se rens_breve): lærernes forbogstaver skal ikke ligge på serveren.
                try:
                    krop, plan = brev.laes_brev(raa)
                except Exception as exc:                  # læseren må aldrig vælte synkroniseringen
                    log(f"advarsel: et ugebrev kunne ikke deles i skema og tekst ({type(exc).__name__}: {exc}). Det vises som ren tekst.")
                    krop, plan = "", None
                entry = {"child": child, "group": letter.get("group_name", ""), "full": text}
                if krop and krop != text:
                    entry["body"] = krop
                if plan:
                    entry["_plan"] = plan
                letters.append(entry)
    letters.sort(key=lambda l: order.get(l["child"], 99))
    return letters


# ─── 4. Huskepunkter og datoer ud af ugebrevene ─────────────────────
# Skrevet om 4. september 2026. Den gamle udgave naevnte "idrætstøj" fire
# gange, to af dem som ubetinget "tag det med" — og reglen om, at et punkt
# uden ugedag skal udelades, stod som én linje midt i en punktopstilling.
# Da et ugebrev skrev "det går rigtig godt med at huske idrætstøjet
# hjemmefra" (ros, ingen dag), lagde analysen punktet paa alle fem hverdage,
# ogsaa tirsdag hvor barnet havde fri.
#
# Maalt paa rigtige ugebreve:
#   gammel prompt + Haiku : fem falske punkter — og tre koersler gav tre
#                           forskellige svar, hver gang med et ANDET aegte
#                           punkt udeladt (skolekoncerten, en bog der skulle med)
#   ny prompt    + Haiku : fejlen vaek, og alle kernepunkter fundet i begge
#                           koersler. Det er stabiliteten, der er det store.
# Sonnet og Opus blev proevet med. De var ikke bedre end Haiku med den nye
# prompt — Sonnet mistede et punkt — saa modellen er beholdt.
#
# Prompten indgaar i cache-noeglen (letter_key), saa denne aendring faar af
# sig selv alle analyser til at blive hentet igen ved naeste koersel.
PROMPT = """Ugebrev fra dansk folkeskole. I dag: {today}.
Brevet gælder UGE {week}.

Et ugebrev er for det meste fortælling: hvad klassen laver, hvordan det
går, hvad læreren glæder sig til. Kun en lille del af det er noget, en
familie skal foretage sig. Din opgave er først og fremmest at VURDERE
hvad der er hvad — ikke at få mest muligt med.

═══ PRØVEN ═══
Alt, hvad du vil skrive som et punkt under A, skal bestå begge dele:

  1. Er det noget barnet eller forældrene skal GØRE — medbringe,
     forberede, læse, aflevere eller møde op til?
  2. Står ugedagen i brevet, eller fremgår den entydigt?

Er svaret nej til bare det ene, hører det ikke med.

Tvivlen gælder KUN spørgsmål 1. Er du i tvivl om, hvorvidt en sætning
overhovedet er en besked, så lad være. Men står der både en handling OG
en ugedag, skal punktet med — også når det virker småt eller
selvfølgeligt. En diktat, en side i læsebogen, en koncert klassen skal
til, en tur ud af huset: det er beskeder, og de skal alle sammen med.
At udelade en lektie er lige så galt som at opfinde en.

DETTE ER IKKE PUNKTER — heller ikke selvom de nævner ting fra
eksempellisterne længere nede:

  ros og status
    "Det går rigtig godt med at huske idrætstøjet hjemmefra! Stor ros
     til jer!"
    -> en tak for noget, I allerede gør. Ingen besked, ingen dag.
  beskrivelse af undervisningen
    "Vi arbejder videre med bogstaverne I og L"
    "Så længe vejret er godt vil vi primært være udendørs"
  opfordringer uden dag
    "I må meget gerne træne tallene hjemme"
  praktisk info uden en handling, hilsner, ønsker om god weekend

At noget står på eksempellisterne nedenfor betyder IKKE, at det skal
med. Det skal stadig bestå prøven.

═══ DAGEN SKAL STÅ I BREVET ═══
Kan du ikke pege på, hvor i teksten dagen står, hører punktet ikke med.

Du må ALDRIG lægge det samme punkt på flere dage for at dække dig ind.
Det er værre end at udelade det: familien får så en falsk besked fire ud
af fem dage og holder op med at stole på skærmen. Nævner brevet derimod
udtrykkeligt flere dage, er det ét punkt per dag.

═══ A) weekdays ═══
Det, der består prøven.
  - Er der en liste med en ugedag foran hvert punkt, fx "mandag: læsebog",
    så lav ét punkt for HVER linje i listen. Spring ingen over.
  - Står ugedagen som overskrift, hører alt derunder til den dag.
  - Teksten nævner ofte sit eget ugenummer ("I uge {week} læser vi ..."),
    og det er netop den uge, der er relevant — tag det med.
    Udelad kun ting, der udtrykkeligt handler om et ANDET ugenummer.

Læs HELE brevet, ikke kun huskelisten. Læseplaner og lektier står ofte
i fagafsnittene ("Dansk:", "Matematik:") og skal med, når de har en
ugedag på. En læseplan med ugedage er ikke "beskrivelse af undervisningen"
— den er en besked. Står der fx "mandag side 124-125, tirsdag s. 126-127
og fredag s. 128-131" i Dansk-afsnittet, giver det tre punkter:
  mandag "læsebog s. 124-125", tirsdag "læsebog s. 126-127",
  fredag "læsebog s. 128-131".
Står der sidetal, kapitel eller opgavenumre, skal de med i punktet.

Én dag må gerne have flere punkter, men hvert punkt skal dække sin egen
ting. Hører flere detaljer til den SAMME aktivitet, så forkort til det
væsentlige i stedet for at dele op:
  "regntøj, gummistøvler og skiftetøj i tasken"  ->  ét punkt: "regntøj"
Er et punkt for langt til ordgrænsen, så skær detaljer væk. Del det
ALDRIG op i to punkter for at overholde grænsen.

Slå punkter for samme dag sammen, når de hører til samme fag:
  "læsebog" + "læsebog s. 124-125"  ->  "læsebog s. 124-125"

Men slå ALDRIG ting af forskellig type sammen (se typerne nedenfor).
Lektier og ting, der skal medbringes, står hvert sit sted på skærmen,
så de skal være hvert sit punkt — også når brevet nævner dem i samme
sætning. Sammenlægning gælder kun inden for den samme type:
  "læsebog s. 142-145, biblioteksbøger og 'Jeg er Frede' retur"
    ->  "læsebog s. 142-145"                       (lektie)
    +   "biblioteksbøger og 'Jeg er Frede' retur"  (medbring)

═══ B) dated ═══
Begivenheder med konkret dato — ture, møder, fotografering, ferie.
Format ÅÅÅÅ-MM-DD. Mangler årstal, vælg førstkommende dato efter i dag.
Her er en dato nok; ugedagsprøven gælder ikke.

═══ TYPE ═══
Sæt en type på hvert weekdays-punkt:
  "lektie"   = skolearbejde der skal laves eller læses (læsebog, diktat,
               matematikopgaver, en aflevering)
  "medbring" = noget der skal med hjemmefra (idrætstøj, penge, madpakke,
               turudstyr, en seddel retur)
  "andet"    = alt andet der består prøven
Er du i tvivl, så skriv "andet". Typen bruges kun til at sortere punkterne
i to lister på skærmen — den ændrer ikke, hvad du skal finde.

Brug brevets egne ord, find ikke på noget. Højst 10 ord per punkt.

═══ CITAT ═══
Hvert punkt skal have et "quote": den sætning eller listelinje i brevet,
punktet stammer fra. Kopiér den ORD FOR ORD — ingen omskrivning, ingen
sammenskrivning af to steder i teksten, ingen rettelse af stavefejl.
Citatet bliver vist for familien, så de selv kan se, hvor beskeden kom
fra. Et opdigtet eller omskrevet citat er værre end intet citat.

Citér kun den ene sætning eller linje, der bærer beskeden — ikke hele
afsnittet. Er punktet slået sammen af flere linjer, så citér den linje,
der nævner dagen. Højst 30 ord.

Kan du ikke finde et ordret sted i teksten, så lad "quote" stå tom — men
BEHOLD punktet. Et punkt uden citat er stadig et punkt; det er kun kilden,
der mangler. Citatkravet er en oplysning til familien, ikke en ny prøve
punktet skal bestå. Reglerne for, HVAD der kommer med, står ovenfor og
ændres ikke af, om du kan finde et citat.

Gør det i den rækkefølge: find FØRST alle punkter efter reglerne ovenfor,
og sæt DEREFTER et citat på hvert af dem. Antallet af punkter skal være
det samme, som hvis du slet ikke var blevet bedt om citater. Bliver svaret
langt, så forkort citaterne — udelad aldrig et punkt for at spare plads.

Svar kun med JSON, ingen forklaring:
{{"weekdays":[{{"day":1,"text":"læsebog s. 124-125","type":"lektie","quote":"mandag: læsebog s. 124-125"}}],"dated":[{{"date":"2026-09-23","text":"i biografen","quote":"Den 23. september skal vi i biografen med skolen"}}]}}
day: 1=mandag ... 7=søndag. Tomme lister hvis intet.

---
"""


QUOTE_MAX = 300


def verify_quote(raw, letter: str) -> str:
    """Godkend kun et citat, der FAKTISK staar ordret i brevet.

    Citatet er hele grundlaget for, at familien kan stole paa et huskepunkt:
    det er beviset for, hvor beskeden kom fra. Et opdigtet eller omskrevet
    citat ville derfor vaere vaerre end slet ingen — det ville se ud som
    dokumentation og ikke vaere det. Modellen bliver bedt om at kopiere ordret,
    men vi tjekker efter i stedet for at tro paa det.

    Der sammenlignes med sammenpresset mellemrum, saa linjeskift og indrykning
    i brevet ikke faelder et ellers ordret citat. Alt andet skal passe.

    Et punkt mister ALDRIG sin plads paa skaermen af, at citatet underkendes —
    saa staar det bare uden kilde, praecis som punkterne gjorde foer.
    """
    q = (raw or "").strip().strip('"\u201d\u201c')
    if not q:
        return ""
    flad = lambda s: " ".join(s.split()).casefold()
    if flad(q) not in flad(letter):
        return ""
    return q if len(q) <= QUOTE_MAX else q[:QUOTE_MAX].rstrip() + "\u2026"


def ask_claude(text: str, week: int) -> dict:
    if len(text) > LETTER_LIMIT:
        # Prompten beder modellen læse HELE brevet, så en tavs afkortning ville
        # være en fejl, man ikke kan se på skærmen.
        log(f"  advarsel: brevet er {len(text)} tegn og afkortes til {LETTER_LIMIT}")
        text = text[:LETTER_LIMIT]

    body = {
        "model": ANTHROPIC_MODEL,
        # Haevet fra 4000 til 8000 den 5. september. Citaterne tredoblede
        # svarets laengde (Barn1s brev: 763 -> 2169 tokens ud), og et brev maa
        # fylde op til LETTER_LIMIT paa 14000 tegn. Et afkortet svar er ikke
        # farligt — det opdages nedenfor og kaster — men det ville koste en
        # koersel og staa som et tomt felt paa skaermen indtil naeste gang.
        # Ubrugte tokens koster ingenting; kun det, der faktisk skrives.
        "max_tokens": 8000,
        "messages": [{
            "role": "user",
            "content": PROMPT.format(today=date.today().isoformat(), week=week) + text,
        }],
    }
    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            data = json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        # Uden statuskode og fejlkrop kan man ikke se forskel på en forkert
        # nøgle, et ukendt model-id og en tom saldo — og alle tre giver
        # præcis samme tomme skærm.
        detail = e.read().decode("utf-8", "replace")[:300]
        raise RuntimeError(f"HTTP {e.code}: {detail}") from None

    u = data.get("usage", {})
    log(f"  kald: {u.get('input_tokens')} ind / {u.get('output_tokens')} ud")

    if data.get("stop_reason") == "max_tokens":
        raise RuntimeError("svaret blev afkortet — hæv max_tokens")

    raw = "".join(b.get("text", "") for b in data.get("content", []) if b.get("type") == "text")
    raw = re.sub(r"^```(?:json)?|```$", "", raw.strip(), flags=re.M).strip()
    if not raw:
        raise RuntimeError("tomt svar fra modellen")
    parsed = json.loads(raw)

    # Typen er pynt, ikke indhold: en model der glemmer den, eller finder på
    # en ny, skal ikke kunne faa et huskepunkt til at forsvinde fra skaermen.
    # Praecis det samme gaelder citatet nedenfor.
    kinds = {"lektie", "medbring", "andet"}
    weekdays = [
        {"day": i["day"], "text": (i.get("text") or "").strip(),
         "type": i.get("type") if i.get("type") in kinds else "andet",
         "quote": verify_quote(i.get("quote"), text)}
        for i in parsed.get("weekdays", [])
        if isinstance(i.get("day"), int) and 1 <= i["day"] <= 7 and (i.get("text") or "").strip()
    ]
    dated = []
    for i in parsed.get("dated", []):
        d, t = (i.get("date") or "").strip(), (i.get("text") or "").strip()
        if t and re.fullmatch(r"\d{4}-\d{2}-\d{2}", d):
            dated.append({"date": d, "text": t, "quote": verify_quote(i.get("quote"), text)})

    manglende = sum(1 for i in weekdays + dated if not i["quote"])
    if manglende:
        log(f"  {manglende} af {len(weekdays) + len(dated)} punkter fik intet "
            f"citat — modellen kunne ikke pege ordret i brevet")
    return {"weekdays": weekdays, "dated": dated}


def letter_key(letter: dict) -> str:
    """Nøgle for et brevs analyse.

    Prompten indgår i nøglen med vilje. Ændrer vi, hvad vi beder modellen
    om, er de gamle svar ikke længere gyldige — og så skal de hentes igen
    af sig selv i stedet for at ligge og se rigtige ud i cachen. Det kostede
    en fejlsøgning at opdage første gang: nye felter dukkede aldrig op,
    fordi brevene havde været analyseret før.

    MODELLEN indgår af nøjagtig samme grund, tilføjet 5. september samtidig
    med skiftet fra Haiku til Opus. Uden den ville et modelskifte ikke røre
    et eneste allerede analyseret brev: skærmen ville blive ved med at vise
    den gamle models svar, og man ville sidde og lede efter forbedringen i
    koden. Skiftet skal kunne ses med det samme, ellers kan det ikke måles.
    """
    return hashlib.sha256(
        (ANTHROPIC_MODEL + "\n" + PROMPT + letter["full"]).encode("utf-8")
    ).hexdigest()[:16]


def letter_src(week_id: str, letter: dict, seen: dict) -> str:
    """Hvilket BREV et datopunkt kom fra. Bevidst en ANDEN nøgle end letter_key().

    letter_key() indeholder MODEL og PROMPT, og det skal den — ændrer vi dem,
    er de gamle svar ikke gyldige længere. Men den blev også brugt som "src"
    på datopunkterne, altså som svaret på "hvilket brev kom dette fra", og de
    to krav er modsatrettede: hver gang prompten eller modellen blev ændret,
    fik hvert brev en ny identitet, og merge_dated kunne ikke længere genkende
    sine egne rækker. De blev derfor liggende, mens den nye analyse lagde sin
    egen omformulering ved siden af.

    Målt 8. september 2026: "Skolefoto" stod i TRE varianter under tirsdag
    — én pr. generation af prompt/model (ét barn havde to forskellige src for
    det samme brev). Ingen af dem var forkerte hver for sig; de var bare tre
    aftryk af den samme sætning.

    Identiteten her er brevets plads i virkeligheden: ugen, barnet og klassen.
    Den er stabil på tværs af prompt-, model- OG tekstændringer, så et RETTET
    brev nu også erstatter sine egne punkter — netop den fejl, hash-løsningen
    kun halvt løste ("skolefoto" -> "skolefotografering" stod begge i månedsvis).
    Læsbar med vilje: står der noget mærkeligt i dataene, kan man se hvorfra.

    'seen' tæller, hvis samme uge/barn/klasse optræder mere end én gang i en
    kørsel, så to breve til samme klasse i samme uge ikke overskriver hinanden.
    """
    base = f"{week_id}|{letter['child']}|{letter.get('group', '')}"
    n = seen.get(base, 0) + 1
    seen[base] = n
    return base if n == 1 else f"{base}#{n}"


def analyse_all(weeks: list):
    """Analysér alle ugers breve i ét hug.

    Cachen ryddes til sidst mod samtlige breve fra denne kørsel — ellers ville
    uge to's oprydning smide uge ets svar væk igen.

    Returnerer også, hvor mange kald der blev forsøgt og hvor mange der fejlede,
    så main() kan give en exit-kode, der siger sandheden.
    """
    empty = {str(i): [] for i in range(1, 8)}
    if not ANTHROPIC_API_KEY or ANTHROPIC_API_KEY == "UDFYLD":
        return {w["id"]: dict(empty) for w in weeks}, [], 0, 0

    if not ANTHROPIC_MODEL or ANTHROPIC_MODEL == "UDFYLD":
        log("FEJL: ANTHROPIC_MODEL er ikke udfyldt — huskepunkter springes over")
        return {w["id"]: dict(empty) for w in weeks}, [], 0, 0

    cache_file = STATE / "aula-cache.json"
    try:
        cache = json.loads(cache_file.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        cache = {}
    dirty = False

    per_week, dated = {}, []
    tried = failed = 0
    # Kun breve, vi faktisk fik et svar for i denne kørsel, må få deres gamle
    # datopunkter erstattet. Før blev sættet regnet ud af ALLE breve uanset
    # udfald, så en enkelt fejlet analyse slettede brevets rækker og lagde
    # ingenting tilbage — en usynlig sletning ved en forbigående API-fejl.
    srcs_ok: set[str] = set()
    src_seen: dict[str, int] = {}

    for wk in weeks:
        days: dict[str, list] = {str(i): [] for i in range(1, 8)}
        for letter in wk["letters"]:
            key = letter_key(letter)
            src = letter_src(wk["id"], letter, src_seen)
            if key not in cache:
                tried += 1
                try:
                    cache[key] = ask_claude(letter["full"], int(wk["id"].split("-W")[1]))
                    dirty = True
                    log(f"{wk['id']} {letter['child']}: {len(cache[key]['weekdays'])} huskepunkter, "
                        f"{len(cache[key]['dated'])} datoer")
                except Exception as exc:
                    failed += 1
                    log(f"advarsel: analyse af {letter['child']}s ugebrev fejlede ({exc})")
                    continue

            for item in cache[key]["weekdays"]:
                days[str(item["day"])].append({"child": letter["child"], "text": item["text"],
                                               "type": item.get("type", "andet"),
                                               "quote": item.get("quote", "")})
            # Kanariefugl. Et punkt paa fire eller flere hverdage betyder som
            # regel, at brevet ikke skrev nogen dag, og at modellen har daekket
            # sig ind. Det slettes IKKE: "husk skiftetoej hver dag" ser praecis
            # saadan ud og er aegte. Men det skal staa i loggen, saa den slags
            # ikke kan gaa ubemaerket i maanedsvis, som det gjorde denne gang.
            spredt: dict[str, set] = {}
            for item in cache[key]["weekdays"]:
                spredt.setdefault((item.get("text") or "").strip().lower(), set()).add(int(item["day"]))
            for tekst, dage in spredt.items():
                if len(dage & {1, 2, 3, 4, 5}) >= 4:
                    log(f"advarsel: {letter['child']} har \"{tekst}\" paa {len(dage)} dage "
                        f"— staar der en ugedag i brevet?")

            for item in cache[key]["dated"]:
                dated.append({**item, "child": letter["child"], "src": src})
            srcs_ok.add(src)
        per_week[wk["id"]] = days

    if dirty:
        keep = {letter_key(l) for wk in weeks for l in wk["letters"]}
        cache_file.write_text(json.dumps({k: v for k, v in cache.items() if k in keep},
                                         ensure_ascii=False), encoding="utf-8")
    return per_week, dated, srcs_ok, tried, failed


# ─── 5. Webhotellets API ────────────────────────────────────────────
BASE = API_BASE.rstrip("/")
HEADERS = {"Content-Type": "application/json", "X-Ugeplan-Key": WRITE_TOKEN}


def api_get(paths: list):
    url = f"{BASE}?get={urllib.parse.quote(','.join(paths))}"
    req = urllib.request.Request(url, headers={"X-Ugeplan-Key": WRITE_TOKEN})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"GET {paths}: HTTP {e.code} {e.read().decode('utf-8','replace')[:200]}") from None


def api_post(path: str, payload, merge: bool = False) -> None:
    url = f"{BASE}?path={urllib.parse.quote(path)}"
    body = json.dumps({"payload": payload, "merge": merge}, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers=HEADERS, method="POST")
    try:
        urllib.request.urlopen(req, timeout=30).read()
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"POST {path}: HTTP {e.code} {e.read().decode('utf-8','replace')[:200]}") from None


def norm(text: str) -> str:
    """Sammenligningsnøgle for et huskepunkt: uden tegn, uden accenter, uden store bogstaver."""
    s = unicodedata.normalize("NFKD", (text or "").casefold())
    return re.sub(r"[^a-z0-9æøå]+", "", s)


def merge_dated(found: list, letter_srcs: set) -> int:
    """Datoer lever uden for ugerne, så de skal lægges oven i det der allerede står.

    Et ugebrev nævner en tur to måneder frem, og brevet er væk længe før turen.
    Derfor akkumuleres de her, og kun datoer der er passeret, ryddes væk.

    Rettede breve gav før dubletter: skrev læreren "skolefoto" om til
    "skolefotografering", stod begge på skærmen i månedsvis. Hvert punkt bærer
    derfor identiteten på det brev, det kom fra (se letter_src), så en ny
    analyse af samme brev erstatter sine egne punkter i stedet for at lægge sig
    ved siden af dem.

    'letter_srcs' er KUN de breve, denne kørsel faktisk har et svar for. Et brev,
    hvis analyse fejlede, er ikke med — så bliver dets gamle punkter stående i
    stedet for at forsvinde.
    """
    docs = api_get(["settings/dated"])
    existing = (docs.get("settings/dated") or {}).get("payload") or {}
    old = existing.get("items", []) if isinstance(existing, dict) else []

    merged = {}
    # Punkter fra breve, der er analyseret i denne kørsel, kasseres og
    # erstattes af de nye. Alt andet beholdes.
    for item in old:
        if item.get("src") in letter_srcs:
            continue
        merged[(item.get("date"), norm(item.get("text")))] = item
    for item in found:
        merged[(item["date"], norm(item["text"]))] = item

    cutoff = (date.today() - timedelta(days=1)).isoformat()
    items = sorted((i for i in merged.values() if i.get("date", "") >= cutoff),
                   key=lambda i: (i["date"], i.get("text", "")))
    api_post("settings/dated", {"items": items})
    return len(items)


# ─── Vigtige datoer og det der mangler svar ─────────────────────────
IMPORTANT_DAYS = 60          # hvor langt frem "vigtigt snart" kigger


def _adate(raw: str):
    """Aula sender ISO med UTC-offset. astimezone() uden argument giver
    maskinens egen tidszone, så vi slipper for at slæbe en tzdata-pakke med
    rundt på Windows bare for at flytte et klokkeslæt en time."""
    try:
        return datetime.fromisoformat((raw or "").replace("Z", "+00:00")).astimezone()
    except (TypeError, ValueError):
        return None


def build_important(raw) -> list:
    """Del Aulas important-dates op i noget, skærmen kan bruge.

    To ting kommer ud af den samme liste: hvad der sker snart, og hvad der
    venter på et svar. Svar-flaget er Aulas eget (responseRequired +
    responseStatus), ikke vores gæt på en formulering — derfor er det den
    eneste kilde, vi tør sætte "kræver handling" på.

    Den samme begivenhed står én gang per barn. Ferieugen fylder altså tre
    ens linjer, hvis man ikke slår dem sammen — det gør vi her.
    """
    by_id = {c["calendar_id"]: c["name"] for c in CHILDREN}
    today = date.today()
    horizon = today + timedelta(days=IMPORTANT_DAYS)

    merged: dict = {}
    for e in raw or []:
        title = (e.get("title") or "").strip()
        if not title:
            continue

        all_day = bool(e.get("allDay"))
        if all_day:
            # Heldagsposter er datoer, ikke tidspunkter. Regnes de om til
            # lokal tid, rykker slutdatoen en dag frem (23:59 UTC + 2 timer).
            start_s = (e.get("startDateTime") or "")[:10]
            end_s = (e.get("endDateTime") or "")[:10] or start_s
            clock = ""
        else:
            sd, ed = _adate(e.get("startDateTime")), _adate(e.get("endDateTime"))
            if sd is None:
                continue
            start_s = sd.date().isoformat()
            end_s = (ed or sd).date().isoformat()
            clock = f"{sd:%H:%M}"
        if not start_s:
            continue

        waiting = bool(e.get("responseRequired")) and e.get("responseStatus") == "waiting"
        # Passerede begivenheder ryger ud — med mindre de stadig mangler svar,
        # for så er de netop ikke overståede.
        if end_s < today.isoformat() and not waiting:
            continue
        if start_s > horizon.isoformat() and not waiting:
            continue

        kids = [by_id[i] for i in (e.get("belongsToProfiles") or []) if i in by_id]
        key = (title, start_s, end_s)
        if key in merged:
            for k in kids:
                if k not in merged[key]["children"]:
                    merged[key]["children"].append(k)
            merged[key]["waiting"] = merged[key]["waiting"] or waiting
            continue

        merged[key] = {
            "date": start_s,
            "end": end_s,
            "time": clock,
            "allDay": all_day,
            "text": title,
            "children": kids,
            "waiting": waiting,
            "deadline": (e.get("responseDeadline") or "")[:10] or None,
            "where": (e.get("institutionName") or "").strip(),
        }

    order = {c["name"]: i for i, c in enumerate(CHILDREN)}
    for item in merged.values():
        item["children"].sort(key=lambda n: order.get(n, 99))
    return sorted(merged.values(), key=lambda i: (i["date"], i["text"]))


# ─── Kør ────────────────────────────────────────────────────────────
def main() -> int:
    log(f"aula: {aula_version()}  python: {sys.version.split()[0]}")
    if "--dump" in sys.argv:
        return dump()
    if "--brevform" in sys.argv:
        return brevform()
    if "--kantineform" in sys.argv:
        return kantineform()
    if "--kantinetekst" in sys.argv:
        return kantinetekst()
    today = date.today()
    monday = today - timedelta(days=today.weekday())

    if "--tasks" in sys.argv:
        try:
            opgaver = aula_json("mu:opgaver")
            (STATE / "aula-opgaver-raw.json").write_text(
                json.dumps(opgaver, ensure_ascii=False, indent=2), encoding="utf-8")
            log(f"opgaver: {len(opgaver)} fundet — gemt i aula-opgaver-raw.json")
        except Exception as exc:
            log(f"advarsel: opgaver kunne ikke hentes ({exc})")

    # Først alt der skal hentes, derefter analysen samlet, til sidst skrivningen
    weeks = []
    for w in range(WEEKS):
        m = monday + timedelta(days=7 * w)
        iso = m.isocalendar()
        week_id = f"{iso.year}-W{iso.week:02d}"

        # Skemaet hentes pr. uge, og en uge kan fejle for sig. Foer vaeltede
        # den hele koerslen — ogsaa de uger, der gik fint — fordi alt hentes
        # foerst og skrives til sidst.
        try:
            events = tjek_skema(aula_json("calendar", "--start-date", m.isoformat()))
            school = build_school(events, m)
            lessons = build_lessons(events, m)
        except Exception as exc:
            log(f"advarsel: skema for {week_id} kunne ikke hentes ({exc})")
            events, school, lessons = [], None, None

        # CLI'en tager --week i formatet 2026-W35, så også næste uges brev kan hentes
        try:
            ugeplan = tjek_ugeplan(aula_json("mu:ugeplan", "--week", week_id))
            breve_ok = True
        except Exception as exc:
            log(f"advarsel: ugeplan for {week_id} kunne ikke hentes ({exc})")
            ugeplan, breve_ok = [], False

        weeks.append({
            "id": week_id,
            "monday": m,
            "school": school,
            "lessons_by_day": lessons,
            "letters": build_letters(ugeplan, iso.week),
            "letters_ok": breve_ok,
            "lessons": len(events),
        })
        fra_breve = fyld_fra_breve(weeks[-1])
        if fra_breve:
            log(f"{week_id}: {fra_breve} lektioner kommer fra skemaet i ugebrevet (Aulas kalender havde dem ikke for alle børn)")

    # Kantinens menu kommer i en besked, ikke i kalenderen: hent den, og læg den på den uge, den handler om (ugenummeret står i emnet).
    kant = hent_kantine()
    if kant:
        log(placer_kantine(weeks, kant))

    # Vigtige datoer staar uden for ugerne og hentes derfor for sig. Fejler
    # den, skal resten af synkroniseringen stadig komme igennem.
    try:
        vigtige = build_important(aula_json("important-dates"))
        api_post("settings/important", {"items": vigtige})
        mangler = sum(1 for i in vigtige if i["waiting"])
        log(f"vigtige datoer: {len(vigtige)} gemt, {mangler} mangler svar")
    except Exception as exc:
        log(f"advarsel: vigtige datoer kunne ikke hentes ({exc})")

    reminders, dated, srcs_ok, tried, failed = analyse_all(weeks)

    if dated or srcs_ok:
        log(f"datoer i alt gemt: {merge_dated(dated, srcs_ok)}")

    for wk in weeks:
        rem = reminders.get(wk["id"], {})

        # merge=True, saa en mislykket skema-hentning lader det gamle skema
        # blive staaende paa serveren i stedet for at overskrive det med
        # ingenting. Alle syv ugedage er altid med i det, vi sender, saa
        # fletningen giver samme resultat som en hel udskiftning.
        payload = {}
        if wk["school"] is not None:
            payload["school"] = wk["school"]
            # Alle syv dage skrives hver gang, ogsaa de tomme: api.php fletter
            # (merge=True), og en dag der mangler, ville beholde gamle lektioner.
            payload["lessons"] = wk["lessons_by_day"]
        if wk["letters_ok"]:
            # Huskepunkterne udledes af brevene. Kunne brevene ikke hentes,
            # ved vi ingenting om ugens huskepunkter — og saa maa vi ikke
            # skrive "ingen", for det ville slette dem, der allerede staar.
            payload["letters"] = rens_breve(wk["letters"])
            payload["reminders"] = rem

        if wk.get("kantine"):
            payload["kantine"] = wk["kantine"]
        if payload:
            api_post(f"aula/{wk['id']}", payload, merge=True)
        else:
            log(f"{wk['id']} : intet hentet — det gamle staar urørt")
            continue

        n = sum(len(v) for v in wk["school"].values()) if wk["school"] is not None else None
        r = sum(len(v) for v in rem.values())
        skema = f"{n} skoledage" if n is not None else "skema sprunget over"
        breve = (f"{len(wk['letters'])} ugebreve, {r} huskepunkter" if wk["letters_ok"]
                 else "ugebreve sprunget over, de gamle bevaret")
        log(f"{wk['id']} : {skema}, {breve} (af {wk['lessons']} lektioner)")

    # Fejlede hvert eneste analysekald, er huskepunkterne væk fra skærmen, og
    # det skal Opgavestyring kunne se. Før afsluttede scriptet med kode 0,
    # uanset hvad, og meldte dermed succes på en halv synkronisering.
    if tried and failed == tried:
        log(f"FEJL: alle {tried} analysekald fejlede — huskepunkter mangler")
        return 1
    if failed:
        log(f"advarsel: {failed} af {tried} analysekald fejlede")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        log(f"FEJL: {exc}")
        sys.exit(1)
