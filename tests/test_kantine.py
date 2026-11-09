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
# ── mere tolerant ──
m = lambda tekst: K.find_kantine([{"subject": "Kantinen uge 46", "text": tekst}])
t("«Ugens menu:», «Menu uge 46:», «Dagens menu:» og «Menu for uge 46» kendes som menu-overskrifter", all(m(f"{o}\nSuppe\nPizza\nFisk") and m(f"{o}\nSuppe\nPizza\nFisk")["dage"] == {"1": "Suppe", "2": "Pizza", "3": "Fisk"} for o in ("Ugens menu:", "Menu uge 46:", "Dagens menu:", "Menu for uge 46", "Ugemenu: ")))
f = m("Menu:\nMandag\nKartoffelsuppe\nTirsdag\nFrikadeller\nOnsdag\nPasta")
t("…efter «Menu:»: retterne er på de rigtige dage, og ugedagene er ikke retter", f and f["dage"] == {"1": "Kartoffelsuppe", "2": "Frikadeller", "3": "Pasta"}, f)
f = m("Hej alle\nMandag: Suppe\nTirsdag: Pizza\nOnsdag: Fisk\nTorsdag: Ris\nFredag: Pasta\nGod appetit")
t("uden «Menu:»-linje bruges mindst tre linjer, der begynder med en ugedag og har en ret (og teksten omkring røres ikke)", f and f["dage"] == {"1": "Suppe", "2": "Pizza", "3": "Fisk", "4": "Ris", "5": "Pasta"}, f)
t("to mærkede linjer uden «Menu:» er ikke nok (kunne være en tilfældig sætning)", m("Mandag: Suppe\nTirsdag: Pizza\nVi ses") is None)
# diagnosen
svar = {"items": [{"subject": "Kantinen uge 45", "content_html": "<p>Hej</p><p>Ingen liste her</p>", "send_datetime": "2026-11-02T08:00:00+01:00", "sender_name": "Navn Efternavn"}, {"subject": "Kantinen uge 46", "content_html": "<p>Menu:</p>" + "".join(f"<p>Ret nummer {i}</p>" for i in range(30)), "send_datetime": "2026-11-09T08:00:00+01:00", "sender_name": "Navn Efternavn"}, {"subject": "Skolefest", "content_html": "<p>x</p>"}]}
v = K.tekstvisning(svar)
t("diagnosen viser antal kantine-breve, de nyeste først (uge 46 før uge 45), linjerne nummereret og afkortet til 25 med en note om resten, og om «Menu»-linjen findes og hvor mange retter, der blev læst", v.startswith("=== svar: 3 poster med tekst, 2 handler om kantinen, 0 af dem uden læsbar dato. De 2 nyeste: ===") and v.index("uge 46") < v.index("uge 45") and "  1| Menu:" in v and " 25| Ret nummer 23" in v and "Ret nummer 24" not in v and "og 6 linjer mere" in v and "«Menu»-linje: nr. 1" in v and "læst som 7 retter" in v and "«Menu»-linje: FINDES IKKE" in v and "læst som 0 retter" in v, v[:400])
t("diagnosen viser ikke afsenderens navn", "Efternavn" not in v and "sender" not in v.lower())
t("uden kantine-breve siger den det i stedet for at fejle", "0 handler om kantinen" in K.tekstvisning([{"subject": "x", "text": "y"}]) and "0 handler om kantinen" in K.tekstvisning(None))
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
# ── opslag (kantinens ugemenu er et opslag, ikke en besked) ──
OBS = "O.B.S. Husk at være opmærksom på om jeres barn har penge på deres kantine kort hvis de skal købe. Vi og skolens øvrige personale bruger meget tid på det. Og børne bliver ked af ikke at have penge på."
OPSLAG46 = {"id": 101, "title": "Kantinen uge 46", "timestamp": "2026-11-03T10:30:00+01:00", "owner": "Navn Efternavn", "content": "<p>Menu:</p><p><br></p><p>Kartoffel/ porre suppe<br>Frikadeller, rugbrød og rødkål<br>Pasta salat m. Kyllingelår<br>Efterårsgrød m. Æblemos<br>Kylling i karry m. Ris</p><p><br></p><p>" + OBS + "</p><p>Kantinen har åbent i den lille og store pause. Man må gå i kantinen når man har fået lov af sin lærer.</p><p>Vh Kantinen</p>"}
OPSLAG45 = {"id": 100, "title": "Kantinen uge 45", "timestamp": "2026-10-29T19:57:00+01:00", "edited_at": "2026-11-03T10:17:00+01:00", "content": "<p>Ugens menu:<br>Gulerodssuppe m. brød<br>Fiskefrikadelle m. ovnbagte kartofler<br>Lasagnette<br>Tarteletter<br>Pitabrød</p><p>" + OBS + "</p>"}
ANDET = {"id": 99, "title": "Skolefoto", "timestamp": "2026-11-02T08:00:00+01:00", "content": "<p>Husk skolefoto på torsdag. Mød op i pænt tøj, og husk at aflevere sedlen i tide til klasselæreren.</p>"}
GAMMEL = {"subject": "Kantinen genåbner", "send_datetime": "2026-08-28T09:00:00+01:00", "content_html": "<p>Kære alle</p><p>Så er kantinen åben igen på mandag.</p>"}
uger = K.find_kantiner([OPSLAG45, OPSLAG46, ANDET])
t("OPSLAG: begge ugers menu findes (uge 45 og uge 46), sorteret efter uge, med de rigtige retter, og «O.B.S.»-afsnittet er ikke en ret", [u["uge"] for u in uger] == [45, 46] and uger[1]["dage"] == DAGE5 and uger[0]["dage"] == {"1": "Gulerodssuppe m. brød", "2": "Fiskefrikadelle m. ovnbagte kartofler", "3": "Lasagnette", "4": "Tarteletter", "5": "Pitabrød"}, uger)
t("kun fire retter (en uge med fridag) og så «O.B.S.»-afsnittet: fire retter, ikke fem (afsnittet er brødtekst)", (lambda f: f and len(f["dage"]) == 4 and "O.B.S." not in " ".join(f["dage"].values()))(K.find_kantine([{"title": "Kantinen uge 47", "content": "<p>Menu:<br>Suppe<br>Pizza<br>Fisk<br>Ris</p><p>" + OBS + "</p>"}])))
t("afsnit, der begynder med «O.B.S.» (med og uden punktummer), «Vh» og lange linjer (over 90 tegn) afslutter menuen", all(len(K.find_kantine([{"title": "Kantinen uge 5", "content": f"<p>Menu:<br>A<br>B<br>C<br>{x}<br>D</p>"}])["dage"]) == 3 for x in ("OBS husk penge", "O.B.S. husk", "o. b. s. husk", "Vh Kantinen", "x" * 91)))
t("er en menu rettet (to udgaver af samme uge), vinder den nyeste, og de to uger forbliver to", (lambda l: len(l) == 2 and l[0]["uge"] == 45 and l[0]["dage"]["1"] == "Ny suppe")(K.find_kantiner([OPSLAG45, {**OPSLAG45, "id": 102, "timestamp": "2026-11-04T09:00:00+01:00", "content": OPSLAG45["content"].replace("Gulerodssuppe m. brød", "Ny suppe")}, OPSLAG46])))
t("opslag og beskeder lægges sammen: en gammel besked uden menu forstyrrer ikke, og samme uge i begge kilder giver den nyeste", [u["uge"] for u in K.find_kantiner([OPSLAG46, ANDET], [GAMMEL])] == [46])
t("ukendte feltnavne i et opslag (overskrift, indhold) virker også: emnet læses af første linje, og den længste tekst er brødteksten", (lambda f: f and f["uge"] == 46 and f["dage"] == DAGE5)(K.find_kantine([{"id": 5, "overskrift": "x", "indhold": "Kantinen uge 46\n\nMenu:\n" + "\n".join(DAGE5.values()) + "\n\n" + OBS, "oprettet": "i går"}])))
t("opslag uden dato og uden ugenummer i emnet findes stadig (uge ukendt), men placeres ikke", (lambda f: f and f["uge"] is None and f["dato"] is None)(K.find_kantine([{"title": "Kantinen", "content": "Menu:\nA\nB\nC"}])))
# ── Sync: hent_kantine ──
def sv_opslag(a):
    if a[0] == "posts": return [OPSLAG46, OPSLAG45, ANDET]
    return [GAMMEL]
S.aula_json = faelles(sv_opslag)
liste, log = stille(S.hent_kantine)
t("hent_kantine læser OPSLAG først (aula posts --limit 40, delvist svar tilladt), derefter beskeder, og finder begge ugers menu", [x["uge"] for x in liste] == [45, 46] and liste[1]["dage"] == DAGE5 and kald[0] == (("posts", "--limit", "40"), True) and [a[0][0] for a in kald] == ["posts", "messages", "messages"], [a[0] for a in kald])
kald.clear()
def uden_limit(a):
    if a == ("posts", "--limit", "40"): raise RuntimeError("no such option: --limit")
    return sv_opslag(a)
S.aula_json = faelles(uden_limit)
liste, log = stille(S.hent_kantine)
t("kender kommandoen ikke --limit, prøves «aula posts» uden, og fejlen er en advarsel, ikke et stop", [x["uge"] for x in liste] == [45, 46] and [a[0] for a in kald][:2] == [("posts", "--limit", "40"), ("posts",)] and "advarsel: kantinens menu kunne ikke hentes fra opslag" in log, (kald, log))
kald.clear()
S.aula_json = faelles(sv_opslag); stille(S.hent_kantine)
t("lykkes første opslags-kald, prøves «aula posts» uden grænse ikke (ingen overflødige kald): posts, derefter to beskedkald", [a[0] for a in kald] == [("posts", "--limit", "40"), ("messages", "--search", "Kantine"), ("messages", "--limit", "40")], [a[0] for a in kald])
def kun_beskeder(a):
    if a[0] == "posts": raise RuntimeError("opslag kunne ikke hentes")
    return [{"subject": "Kantinen uge 46", "text": EKSEMPEL}]
S.aula_json = faelles(kun_beskeder)
liste, log = stille(S.hent_kantine)
t("fejler opslag helt, men beskeder virker, findes menuen i en besked (som før 3.14.1)", [x["uge"] for x in liste] == [46] and "advarsel" in log)
S.aula_json = faelles(lambda a: (_ for _ in ()).throw(RuntimeError("Aula svarer ikke")))
liste, log = stille(S.hent_kantine)
t("fejler alle kald, er svaret en tom liste, og loggen peger på --kantinetekst", liste == [] and "--kantinetekst" in log, log)
S.aula_json = faelles(lambda a: [{"subject": "Skolefest", "text": "Hej"}])
liste, log = stille(S.hent_kantine)
t("er der ingen menu i opslag eller beskeder, er svaret tomt, og loggen siger det", liste == [] and "ingen opslag eller beskeder med en menu" in log)
uger2 = [{"id": "2026-W46", "monday": __import__("datetime").date(2026, 11, 9)}, {"id": "2026-W47", "monday": __import__("datetime").date(2026, 11, 16)}]
uger2 = [{"id": "2026-W45", "monday": __import__("datetime").date(2026, 11, 2)}, {"id": "2026-W46", "monday": __import__("datetime").date(2026, 11, 9)}]
for k_ in K.find_kantiner([OPSLAG45, OPSLAG46]): S.placer_kantine(uger2, k_)
t("begge uger placeres på hver sin uge (uge 45 og uge 46), så «I dag» og næste uge begge har en menu", uger2[0].get("kantine", {}).get("dage", {}).get("1") == "Gulerodssuppe m. brød" and uger2[1].get("kantine", {}).get("dage") == DAGE5)
# diagnosen over flere kilder
S.aula_json = faelles(sv_opslag)
ud1 = io.StringIO()
with contextlib.redirect_stdout(ud1): S.kantinetekst()
v1 = ud1.getvalue()
t("--kantinetekst viser opslag og beskeder hver for sig, med antal, hvor mange der mangler dato, og linjerne; ikke afsenderen", "=== opslag: 3 poster med tekst, 2 handler om kantinen, 0 af dem uden læsbar dato" in v1 and "=== beskeder, søgning:" in v1 and "Kartoffel/ porre suppe" in v1 and "Efternavn" not in v1 and "læst som 5 retter" in v1, v1[:300])
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
ud0 = io.StringIO()
with contextlib.redirect_stdout(ud0): S.kantinetekst()
t("--kantinetekst viser den nyeste kantine-besked linje for linje (og ikke andet)", "1 handler om kantinen" in ud0.getvalue() and "Kartoffel/ porre suppe" in ud0.getvalue() and "læst som 5 retter" in ud0.getvalue(), ud0.getvalue()[:300])
with contextlib.redirect_stdout(ud): S.kantineform()
v = ud.getvalue()
t("--kantineform viser opbygningen og om menuen blev fundet, men intet af indholdet", "kantine-besked fundet: uge 46, 5 retter" in v and not any(x in v for x in ("Kartoffel", "Frikadeller", "Navn", "Kylling")), v[:200])
t("Dockerfilen kopierer kantine.py ind", "docker/aula/kantine.py" in open(os.path.join(_R, "docker", "aula", "Dockerfile"), encoding="utf-8").read())
sys.exit(0 if ok_all else 1)
