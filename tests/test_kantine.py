"""Prøver kantinens ugemenu: kantine.py (opdigtede beskeder i flere mulige former, plus brugerens eksempel) og kobling i Sync-Aula.py."""
import contextlib, importlib.util, io, json, os, sys, tempfile, types
_R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(_R, "docker", "aula"))
import kantine as K
ok_all = True
def t(n, c, x=""):
    global ok_all; ok_all &= bool(c); print("ok  " if c else "FEJL", n, "" if c else x)
EKSEMPEL = "Menu:\n\nKartoffel/ porre suppe\nFrikadeller, rugbrød og rødkål\nPasta salat m. Kyllingelår\nEfterårsgrød m. Æblemos\nKylling i karry m. Ris"
DAGE5 = {"1": "Kartoffel/ porre suppe", "2": "Frikadeller, rugbrød og rødkål", "3": "Pasta salat m. Kyllingelår", "4": "Efterårsgrød m. Æblemos", "5": "Kylling i karry m. Ris"}
f = K.find_kantine([{"subject": "Kantinen uge 46", "text": EKSEMPEL}])
t("brugerens eksempel: fem retter, én pr. skoledag, og ugen 46 fra emnet", f and f["dage"] == DAGE5 and f["uge"] == 46, f)
f = K.find_kantine([{"subject": "Besked fra skolen", "text": "Kantinen uge 47\n\n" + EKSEMPEL}])
t("står «Kantinen uge 47» i stedet som beskedens første linje, findes den også (uge 47)", f and f["uge"] == 47 and f["dage"] == DAGE5, f)
t("svaret kan være {items: […]} (aula messages --search) eller en liste, og med en tråd, hvor emnet står på tråden og teksten i beskederne", all(K.find_kantine(x) and K.find_kantine(x)["dage"] == DAGE5 for x in (
    {"items": [{"subject": "Kantinen uge 46", "content": EKSEMPEL}], "complete": True, "termination_reason": "exhausted"},
    [{"id": 1, "title": "Kantinen uge 46", "messages": [{"id": 5, "text": "Hej"}, {"id": 6, "text": EKSEMPEL}]}],
    {"threads": [{"subject": "Kantinen uge 46", "messages": [{"body": EKSEMPEL}]}]})))
t("HTML-tekst (p, br og li) giver de samme retter som ren tekst", (lambda f: f and f["dage"] == DAGE5)(K.find_kantine([{"subject": "Kantinen uge 46", "content_html": "<p>Menu:</p><p>Kartoffel/ porre suppe<br>Frikadeller, rugbrød og rødkål</p><div>Pasta salat m. Kyllingelår</div><p>Efterårsgrød m. &AElig;blemos".replace("&AElig;", "Æ") + "</p><p>Kylling i karry m. Ris</p>"}])))
t("er der flere kantine-breve, vælges det nyeste efter dato (også med Z i tidsstemplet), uanset rækkefølge", K.find_kantine([{"subject": "Kantinen uge 45", "text": "Menu:\na\nb\nc\nd\ne", "sent_datetime": "2026-11-02T08:00:00+01:00"}, {"subject": "Kantinen uge 46", "text": EKSEMPEL, "sent_datetime": "2026-11-09T07:00:00Z"}, {"subject": "Kantinen uge 44", "text": "Menu:\nx\ny\nz", "sent_datetime": "2026-10-26T08:00:00Z"}])["uge"] == 46)
m = K.find_kantine([{"subject": "Kantinen uge 46", "text": "Menu:\nMandag: Suppe\nTirsdag - Pizza\nOnsdag Fisk\nTors: Ris\nFre. Pasta"}])
t("retter mærket med ugedag (Mandag: …, Tirsdag - …, Tors: …, Fre. …) lægges på den dag, også uden kolon", m and m["dage"] == {"1": "Suppe", "2": "Pizza", "3": "Fisk", "4": "Ris", "5": "Pasta"}, m)
m = K.find_kantine([{"subject": "Kantinen uge 46", "text": "Menu:\nTirsdag: Suppe\nTorsdag: Pizza\nFredag: Fisk"}])
t("en uge med fridage: kun de mærkede dage får en ret (tirsdag, torsdag, fredag)", m and m["dage"] == {"2": "Suppe", "4": "Pizza", "5": "Fisk"}, m)
m = K.find_kantine([{"subject": "Kantinen uge 46", "text": "Menu:\n- Suppe\n• Pizza\n1. Fisk\n2) Ris\n* Pasta"}])
t("punkttegn og nummerering (-, •, 1., 2), *) fjernes", m and list(m["dage"].values()) == ["Suppe", "Pizza", "Fisk", "Ris", "Pasta"], m)
m = K.find_kantine([{"subject": "Kantinen uge 46", "text": EKSEMPEL + "\n\nMvh\nKantinen\n\nHusk at melde fra"}])
t("afslutningen (Mvh …) er ikke en ret", m and len(m["dage"]) == 5 and "Mvh" not in " ".join(m["dage"].values()))
m = K.find_kantine([{"subject": "Kantinen uge 46", "text": "Menu:\nSuppe\nPizza\nFisk\nRis\nPasta\nBemærk: ingen mad fredag\nFrugt: æbler"}])
t("en ny overskrift eller «Bemærk:» efter menuen stopper listen, og der er højst fem retter (mandag til fredag)", m and len(m["dage"]) == 5 and "Bemærk" not in " ".join(m["dage"].values()))
m = K.find_kantine([{"subject": "Kantinen uge 46", "text": "Menu: Suppe\nPizza\nFisk"}])
t("«Menu: Suppe» med første ret på samme linje, og «Menuen:» og «MENU» kendes også", m and m["dage"] == {"1": "Suppe", "2": "Pizza", "3": "Fisk"} and K.find_kantine([{"subject": "Kantine", "text": "MENUEN:\na\nb\nc"}])["dage"] == {"1": "a", "2": "b", "3": "c"})
t("andre beskeder ignoreres: andet emne, ingen menu, færre end tre retter, og «Menu» som del af en sætning", all(K.find_kantine(x) is None for x in (
    [{"subject": "Skolefest", "text": EKSEMPEL}], [{"subject": "Kantinen uge 46", "text": "Ingen menu i denne uge"}], [{"subject": "Kantinen uge 46", "text": "Menu:\nSuppe\nPizza"}],
    [{"subject": "Kantinen uge 46", "text": "Menuen for ugen er:\nSuppe\nPizza\nFisk"}], [], None, {}, "tekst", 5, [{"subject": 5, "text": None}])))
t("ugenummer uden for 1–53 eller manglende gives som None (så synkroniseringen ikke gætter)", K.find_kantine([{"subject": "Kantinen uge 99", "text": EKSEMPEL}])["uge"] is None and K.find_kantine([{"subject": "Kantinen", "text": EKSEMPEL}])["uge"] is None)
t("«Kantine» kendes også som «Kantinens» og «kantinen» med små bogstaver, men ikke «Kantinestrejke» (et andet ord)", K.find_kantine([{"subject": "kantinen uge 5", "text": EKSEMPEL}]) and K.find_kantine([{"subject": "Kantinestrejke", "text": EKSEMPEL}]) is None)
# opbygning: ingen indhold
op = K.opbygning({"items": [{"subject": "Kantinen uge 46", "text": EKSEMPEL, "sender": "Skolen"}], "complete": True})
t("opbygningen til fejlfinding viser feltnavne, antal og om beskeden blev fundet (uge 46, 5 retter), men intet af indholdet", "kantine-besked fundet: uge 46, 5 retter" in op and "items" in op and "subject" in op and not any(x in op for x in ("Kartoffel", "Frikadeller", "Skolen", "Kylling")), op)
t("opbygningen af noget uden kantine siger NEJ i stedet for at fejle", "NEJ" in K.opbygning([{"subject": "x", "text": "y"}]) and "NEJ" in K.opbygning(None))
# ── Sync-Aula.py ──
os.environ["AULA_STATE_DIR"] = tempfile.mkdtemp(prefix="fo-kant-")
cfg = types.ModuleType("config"); cfg.ANTHROPIC_API_KEY = ""; cfg.ANTHROPIC_MODEL = "x"; cfg.API_BASE = "https://x"; cfg.MITID_USERNAME = "x"; cfg.WRITE_TOKEN = "x"; cfg.CHILDREN = [{"name": "Barn", "calendar_id": 1}]
sys.modules["config"] = cfg
spec = importlib.util.spec_from_file_location("sync", os.path.join(_R, "docker", "aula", "Sync-Aula.py")); S = importlib.util.module_from_spec(spec); spec.loader.exec_module(S)
from datetime import date
def stille(fn, *a):
    ud = io.StringIO()
    with contextlib.redirect_stdout(ud), contextlib.redirect_stderr(ud): r = fn(*a)
    return r, ud.getvalue()
kald = []
def faelles(sv):
    def aj(*args, delvist=False): kald.append((args, delvist)); return sv(args)
    return aj
S.aula_json = faelles(lambda a: {"items": [{"subject": "Kantinen uge 46", "text": EKSEMPEL}]})
k, log = stille(S.hent_kantine)
t("hent_kantine søger efter «Kantine» (med --search, og delvist svar tilladt) og finder menuen", k and k["dage"] == DAGE5 and kald[0] == (("messages", "--search", "Kantine"), True), kald)
kald.clear()
def kun_liste(a):
    if "--search" in a: raise RuntimeError("no such option: --search")
    return [{"subject": "Kantinen uge 46", "text": EKSEMPEL}]
S.aula_json = faelles(kun_liste)
k, log = stille(S.hent_kantine)
t("kender kommandoen ikke --search, prøves en almindelig liste af beskeder i stedet, og fejlen er en advarsel, ikke et stop", k and k["uge"] == 46 and len(kald) == 2 and "advarsel: kantinens menu" in log, (kald, log))
S.aula_json = faelles(lambda a: (_ for _ in ()).throw(RuntimeError("Aula svarer ikke")))
k, log = stille(S.hent_kantine)
t("fejler begge kald, er svaret None, og loggen peger på --kantineform", k is None and "--kantineform" in log, log)
S.aula_json = faelles(lambda a: [{"subject": "Skolefest", "text": "Hej"}])
k, log = stille(S.hent_kantine)
t("er der ingen kantine-besked, er svaret None, og loggen siger det", k is None and "ingen besked med en menu" in log)
# delvist: aula messages --search giver kode 1 (ikke nået til ende), men skriver resultater
class R:
    def __init__(s, rc, out, err=b""): s.returncode, s.stdout, s.stderr = rc, out, err
S2 = importlib.util.module_from_spec(spec); spec.loader.exec_module(S2)
js = json.dumps({"items": [{"subject": "Kantinen uge 46", "text": EKSEMPEL}], "complete": False}).encode()
S2.subprocess.run = lambda *a, **k: R(1, js, b"warning: incomplete")
t("en søgning, der ikke nåede til ende (kode 1), men gav resultater, bruges med delvist=True", S2._aula_json_once("messages", "--search", "Kantine", delvist=True)["complete"] is False)
try: S2._aula_json_once("messages", "--search", "Kantine"); fejl = None
except RuntimeError as e: fejl = str(e)
t("…men uden delvist=True er kode 1 stadig en fejl (som før), og tomt svar med kode 1 er også en fejl med delvist", fejl is not None and "fejlede" in fejl)
S2.subprocess.run = lambda *a, **k: R(1, b"", b"login udloebet")
try: S2._aula_json_once("messages", delvist=True); fejl2 = None
except RuntimeError as e: fejl2 = str(e)
t("tomt svar med kode 1 er en fejl, selv med delvist=True", fejl2 is not None and "login udloebet" in fejl2)
# placering på ugen
from datetime import date as D
uger = [{"id": "2026-W46", "monday": D(2026, 11, 9)}, {"id": "2026-W47", "monday": D(2026, 11, 16)}]
tekst = S.placer_kantine(uger, {"uge": 47, "dage": DAGE5})
t("menuen lægges på den uge, ugenummeret peger på (uge 47), og kun dér", uger[1]["kantine"] == {"dage": DAGE5} and "kantine" not in uger[0] and "W47" in tekst, tekst)
uger2 = [{"id": "2026-W46", "monday": D(2026, 11, 9)}]
tekst = S.placer_kantine(uger2, {"uge": 49, "dage": DAGE5})
t("er menuen for en uge, der ikke hentes (uge 49), gemmes den ikke, og loggen siger hvorfor", "kantine" not in uger2[0] and "Gemmes ikke" in tekst and "uge 49" in tekst, tekst)
tekst = S.placer_kantine(uger2, {"uge": None, "dage": DAGE5})
t("uden læsbart ugenummer gættes der ikke (ingen placering), og det siges", "kantine" not in uger2[0] and "ugenummeret kunne ikke læses" in tekst)
t("ugenummeret passer også ved årsskiftet (uge 1 i 2027 starter 4. januar)", S.placer_kantine([{"id": "2027-W01", "monday": D(2027, 1, 4)}], {"uge": 1, "dage": DAGE5}).startswith("kantine: menuen for uge 1"))
ud = io.StringIO()
S.aula_json = faelles(lambda a: {"items": [{"subject": "Kantinen uge 46", "text": EKSEMPEL, "forfatter": "Navn"}]})
with contextlib.redirect_stdout(ud): S.kantineform()
v = ud.getvalue()
t("--kantineform viser opbygningen og om menuen blev fundet, men intet af indholdet", "kantine-besked fundet: uge 46, 5 retter" in v and not any(x in v for x in ("Kartoffel", "Frikadeller", "Navn", "Kylling")), v[:200])
t("Dockerfilen kopierer kantine.py ind", "docker/aula/kantine.py" in open(os.path.join(_R, "docker", "aula", "Dockerfile"), encoding="utf-8").read())
sys.exit(0 if ok_all else 1)
