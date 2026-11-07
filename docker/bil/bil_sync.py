#!/usr/bin/env python3
"""
bil_sync.py — henter batteriniveauet fra din Hyundai (Bluelink, Europa) på faste tidspunkter
og lægger det i ugeplan-data/bil/, så kortet "Bil" på overblik.html kan vise det.

Tidspunkterne og om en aflæsning er "frisk" rettes i index.html (Opsætning → Bil) og står
i ugeplan-data/private/bil.json. Standard: 06:15, 12:00, 18:00 (frisk) og 22:00.

  gemt  = læs det, Hyundais server allerede ved. Vækker IKKE bilen.
  frisk = bed bilen om en ny status først. Vækker bilen og belaster 12 V-batteriet,
          og Hyundai begrænser antal kald pr. døgn. Derfor højst MAX_FRISKE om dagen.

Adgangen er UOFFICIEL (biblioteket hyundai_kia_connect_api). Hyundai har flere gange ændret
login i Europa, så den kan holde op med at virke. Fejlen står så i kortet, og siden virker ellers.

Kør én gang og vis, hvilke felter bilen giver (til fejlfinding, ingen hemmeligheder skrives):
    docker compose run --rm bil python /app/bil_sync.py --diagnose
"""
import datetime as dt
import json
import os
import re
import sys
import time
from zoneinfo import ZoneInfo

TZ = ZoneInfo(os.environ.get("TZ", "Europe/Copenhagen"))
DATA = os.environ.get("DATA_DIR", "/data")
INDSTILLINGER = f"{DATA}/private/bil.json"
MAPPE = f"{DATA}/bil"
STATUS = f"{MAPPE}/status.json"
HISTORIK = f"{MAPPE}/historik.json"
ANMODNING = f"{MAPPE}/anmodning.json"
TILSTAND = f"{MAPPE}/tilstand.json"

MAX_FRISKE = 2            # frisk aflæsning (vækker bilen) højst så mange gange om dagen
MIN_MELLEMRUM = 10        # minutter mellem to forbindelser til Hyundai
VINDUE = 15               # en aflæsning må komme op til så mange minutter for sent (fx efter en genstart)
GENFORSOEG_EFTER = 5      # minutter til et nyt forsøg, hvis det mislykkedes
MAX_FORSOEG = 2
FRISK_VENTETID = 25       # sekunder efter en frisk forespørgsel, før der læses igen
HISTORIK_DAGE = 90
TID_RE = re.compile(r"^([01]\d|2[0-3]):([0-5]\d)\Z")

STANDARD = {
    "aktiv": True,
    "tider": [
        {"tid": "06:15", "frisk": False},
        {"tid": "12:00", "frisk": False},
        {"tid": "18:00", "frisk": True},
        {"tid": "22:00", "frisk": False},
    ],
}


# ─── Indstillinger ─────────────────────────────────────────────────
def rens_tider(raa):
    """Gyldige tider, sorteret, uden dubletter og uden to for tæt på hinanden. Ugyldigt springes over."""
    ud, set_ = [], []
    for e in raa if isinstance(raa, list) else []:
        if not isinstance(e, dict) or not isinstance(e.get("tid"), str) or not TID_RE.match(e["tid"]):
            continue
        if e["tid"] in set_:
            continue
        set_.append(e["tid"])
        ud.append({"tid": e["tid"], "frisk": bool(e.get("frisk", False))})
    ud.sort(key=lambda x: x["tid"])
    return ud


def laes_json(sti, standard):
    try:
        with open(sti, encoding="utf-8") as f:
            d = json.load(f)
        return d if isinstance(d, type(standard)) else standard
    except (OSError, ValueError):
        return standard


def laes_indstillinger():
    d = laes_json(INDSTILLINGER, {})
    tider = rens_tider(d.get("tider")) or STANDARD["tider"]
    return {"aktiv": bool(d.get("aktiv", STANDARD["aktiv"])), "tider": tider}


def skriv_json(sti, data):
    os.makedirs(os.path.dirname(sti), exist_ok=True)
    tmp = f"{sti}.tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    os.chmod(tmp, 0o644)
    os.replace(tmp, sti)


# ─── Hvornår skal der hentes? ──────────────────────────────────────
def slot_tid(dato, tid):
    h, m = int(tid[:2]), int(tid[3:])
    return dt.datetime(dato.year, dato.month, dato.day, h, m, tzinfo=TZ)


def find_opgave(nu, ind, tilstand, anmodning=False):
    """
    Returnerer None eller (type, tid, frisk), hvor type er 'nu' (bedt om i opsætningen) eller 'plan'.
    tilstand = {"koert": {"ÅÅÅÅ-MM-DD": {"HH:MM": {"n": forsøg, "klar": bool, "sidst": iso}}},
                "sidst_session": iso, "friske": {"ÅÅÅÅ-MM-DD": antal}}
    """
    sidst = tilstand.get("sidst_session")
    if sidst:
        try:
            if nu - dt.datetime.fromisoformat(sidst) < dt.timedelta(minutes=MIN_MELLEMRUM):
                return None
        except ValueError:
            pass
    if anmodning:
        return ("nu", None, False)
    if not ind["aktiv"]:
        return None
    dato = nu.date().isoformat()
    friske = tilstand.get("friske", {}).get(dato, 0)
    for s in ind["tider"]:
        start = slot_tid(nu.date(), s["tid"])
        if not (start <= nu < start + dt.timedelta(minutes=VINDUE)):
            continue
        k = tilstand.get("koert", {}).get(dato, {}).get(s["tid"], {})
        if k.get("klar") or k.get("n", 0) >= MAX_FORSOEG:
            continue
        if k.get("n", 0) >= 1 and k.get("sidst"):
            if nu - dt.datetime.fromisoformat(k["sidst"]) < dt.timedelta(minutes=GENFORSOEG_EFTER):
                continue
        frisk = bool(s["frisk"]) and friske < MAX_FRISKE      # loftet beskytter 12 V-batteriet
        return ("plan", s["tid"], frisk)
    return None


def registrer(tilstand, nu, opgave, ok, frisk_brugt):
    dato = nu.date().isoformat()
    tilstand["sidst_session"] = nu.isoformat()
    # kun i dag gemmes; gamle dage ryddes
    tilstand["koert"] = {dato: tilstand.get("koert", {}).get(dato, {})}
    tilstand["friske"] = {dato: tilstand.get("friske", {}).get(dato, 0)}
    if frisk_brugt:
        tilstand["friske"][dato] += 1
    if opgave[0] == "plan":
        k = tilstand["koert"][dato].setdefault(opgave[1], {"n": 0, "klar": False})
        k["n"] += 1
        k["sidst"] = nu.isoformat()
        if ok:
            k["klar"] = True


# ─── Hent fra bilen ────────────────────────────────────────────────
def tal(v, lo=None, hi=None):
    try:
        x = float(v)
    except (TypeError, ValueError):
        return None
    if x != x or (lo is not None and x < lo) or (hi is not None and x > hi):
        return None
    return int(x) if x == int(x) else round(x, 1)


def flag(v):
    if v is None:
        return None
    if isinstance(v, str):
        return v.strip().lower() in ("1", "true", "yes", "on")
    return bool(v)


def uddrag(bil):
    """Det kortet skal bruge, fra et Vehicle-objekt. Felterne læses forsigtigt, så et manglende felt ikke vælter alt."""
    g = lambda *navne: next((getattr(bil, n) for n in navne if getattr(bil, n, None) is not None), None)
    bil_tid = g("last_updated_at")
    if isinstance(bil_tid, dt.datetime):
        bil_tid = (bil_tid if bil_tid.tzinfo else bil_tid.replace(tzinfo=TZ)).isoformat()
    else:
        bil_tid = None
    navn = g("name", "model")
    return {
        "soc": tal(g("ev_battery_percentage"), 0, 100),
        "plugged": flag(g("ev_battery_is_plugged_in")),
        "charging": flag(g("ev_battery_is_charging")),
        "rangeKm": tal(g("ev_driving_range", "total_driving_range"), 0, 2000),
        "bil12v": tal(g("car_battery_percentage"), 0, 100),
        "bilTid": bil_tid,
        "navn": str(navn)[:60] if navn else None,
    }


def foerste(vm, navne, *args):
    for n in navne:
        f = getattr(vm, n, None)
        if callable(f):
            return f(*args)
    raise RuntimeError("Biblioteket har ingen af metoderne " + ", ".join(navne) + ". Opdatér hyundai-kia-connect-api i Dockerfile.bil.")


def noegle(ordbog, vaerdi):
    return next(k for k, v in ordbog.items() if v == vaerdi)


def laes_login():
    """Hyundai-login: miljøvariabler først, ellers det, der er gemt under Opsætning → Forbindelser (private/instans.json)."""
    bruger, kode, pin, vin = (os.environ.get(n, "") for n in ("HYUNDAI_USERNAME", "HYUNDAI_PASSWORD", "HYUNDAI_PIN", "HYUNDAI_VIN"))
    if not (bruger and kode and pin):
        try:
            with open(f"{DATA}/private/instans.json", encoding="utf-8") as f: h = json.load(f).get("hemmeligheder", {})
        except (OSError, ValueError): h = {}
        bruger, kode, pin, vin = bruger or h.get("hyundai_bruger", ""), kode or h.get("hyundai_kode", ""), pin or h.get("hyundai_pin", ""), vin or h.get("hyundai_vin", "")
    return bruger, kode, pin, vin


def hent(frisk):
    """Logger ind, læser (og beder evt. om en frisk status) og returnerer (dict, brugt_frisk, note)."""
    bruger, kode, pin, vin = laes_login()
    if not (bruger and kode and pin):
        raise RuntimeError("Mangler Hyundai-login. Udfyld det under Opsætning → Forbindelser (bruger, adgangskode og PIN).")
    from hyundai_kia_connect_api import VehicleManager, const
    vm = VehicleManager(region=noegle(const.REGIONS, const.REGION_EUROPE), brand=noegle(const.BRANDS, const.BRAND_HYUNDAI),
                        username=bruger, password=kode, pin=pin)
    vm.check_and_refresh_token()
    vm.update_all_vehicles_with_cached_state()
    if not vm.vehicles:
        raise RuntimeError("Hyundai svarede uden nogen biler på kontoen.")
    vin = vin.strip()
    vid = next((k for k, v in vm.vehicles.items() if vin and getattr(v, "VIN", "") == vin), None) or next(iter(vm.vehicles))

    note, brugt = None, False
    if frisk:
        try:
            foerste(vm, ["force_refresh_vehicle_state", "force_refresh_vehicles_states"], vid)
            brugt = True
            time.sleep(FRISK_VENTETID)
            foerste(vm, ["update_vehicle_with_cached_state"], vid)
        except Exception as e:                                           # frisk mislykkedes: vis det gemte i stedet
            note = f"Frisk aflæsning mislykkedes ({str(e)[:120]}). Viser den gemte værdi."
    return uddrag(vm.vehicles[vid]), brugt, note


# Felter, der aldrig skrives ud i --diagnose, så udskriften kan sendes videre uden at afsløre noget.
# Navnene deles ved understreg og tjekkes ord for ord ("driving" indeholder "vin", men er ikke "vin").
SKJULT_ORD = {"vin", "lat", "lon", "pin", "id", "key", "token", "email", "phone", "plate", "password", "secret"}
SKJULT_START = ("location", "geocod", "latitude", "longitude", "address", "gps", "registration", "licen", "passw", "secret", "token")


def skjult(navn):
    return any(d in SKJULT_ORD or d.startswith(SKJULT_START) for d in navn.lower().split("_"))


def diagnose():
    """Skriver de simple felter, bilen giver. Ingen adgangskoder, stelnummer eller position."""
    from hyundai_kia_connect_api import VehicleManager, const
    bruger, kode, pin, _ = laes_login()
    vm = VehicleManager(region=noegle(const.REGIONS, const.REGION_EUROPE), brand=noegle(const.BRANDS, const.BRAND_HYUNDAI),
                        username=bruger, password=kode, pin=pin)
    vm.check_and_refresh_token()
    vm.update_all_vehicles_with_cached_state()
    for vid, v in vm.vehicles.items():
        print("bil:", getattr(v, "name", "?"), "| model:", getattr(v, "model", "?"), "| år:", getattr(v, "year", "?"))
        for n in sorted(a for a in dir(v) if not a.startswith("_")):
            val = getattr(v, n, None)
            if isinstance(val, (int, float, bool, str, dt.datetime)) and not skjult(n):
                print(f"  {n} = {val}")
        print("uddrag:", json.dumps(uddrag(v), ensure_ascii=False, default=str))


# ─── Gem resultatet ────────────────────────────────────────────────
def gem_status(nu, opgave, frisk_bedt, data, brugt_frisk, note, fejl):
    status = laes_json(STATUS, {})
    if fejl:
        status["fejl"] = {"tid": nu.isoformat(), "tidspunkt": opgave[1] or "nu", "besked": str(fejl)[:300]}
    else:
        status = {**data, "opdateret": nu.isoformat(), "kilde": "frisk" if brugt_frisk else "gemt",
                  "tidspunkt": opgave[1] or "nu", "note": note, "fejl": None}
        h = laes_json(HISTORIK, {"dage": []})
        graense = (nu - dt.timedelta(days=HISTORIK_DAGE)).isoformat()
        liste = [x for x in h.get("dage", []) if isinstance(x, dict) and str(x.get("t", "")) >= graense]
        liste.append({"t": nu.isoformat(), "soc": data["soc"], "kilde": status["kilde"],
                      "plugged": data["plugged"], "charging": data["charging"]})
        skriv_json(HISTORIK, {"dage": liste})
    skriv_json(STATUS, status)


def koer(nu, opgave, tilstand, hent_fn=hent):
    frisk = bool(opgave[2])
    try:
        data, brugt, note = hent_fn(frisk)
        if data.get("soc") is None:
            raise RuntimeError("Hyundai sendte intet batteriniveau (feltet ev_battery_percentage er tomt). Kør --diagnose.")
        gem_status(nu, opgave, frisk, data, brugt, note, None)
        registrer(tilstand, nu, opgave, True, brugt)
        return True
    except Exception as e:
        gem_status(nu, opgave, frisk, None, False, None, f"{type(e).__name__}: {e}")
        registrer(tilstand, nu, opgave, False, frisk)       # et mislykket frisk-forsøg tæller med: bilen kan være vækket
        return False


def main():
    if "--diagnose" in sys.argv:
        diagnose()
        return
    tilstand = laes_json(TILSTAND, {})
    print("bil_sync kører. Tider:", laes_indstillinger()["tider"], flush=True)
    if not os.path.exists(STATUS) and laes_indstillinger()["aktiv"]:      # første gang: en gemt aflæsning, så du kan se, om det virker
        nu = dt.datetime.now(TZ)
        print(nu.isoformat(), "første aflæsning (gemt)", flush=True)
        koer(nu, ("nu", "start", False), tilstand)
        skriv_json(TILSTAND, tilstand)
    while True:
        time.sleep(20)
        nu = dt.datetime.now(TZ)
        anmodning = os.path.exists(ANMODNING)
        opgave = find_opgave(nu, laes_indstillinger(), tilstand, anmodning)
        if not opgave:
            continue
        if anmodning:
            try:
                os.remove(ANMODNING)
            except OSError:
                pass
        print(nu.isoformat(), "henter", opgave, flush=True)
        ok = koer(nu, opgave, tilstand)
        print(nu.isoformat(), "ok" if ok else "mislykkedes: " + str(laes_json(STATUS, {}).get("fejl")), flush=True)
        skriv_json(TILSTAND, tilstand)


if __name__ == "__main__":
    main()
