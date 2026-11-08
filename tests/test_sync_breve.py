"""Prøver, at Sync-Aula.py deler ugebrevene i tekst og skema, og at skemaet i brevet bruges, når kalenderen ikke har lektionerne (mod en stump af config og opdigtede data)."""
import contextlib, importlib.util, io, json, os, sys, tempfile, types
_R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(_R, "docker", "aula")); sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from brevfix import BREV
os.environ["AULA_STATE_DIR"] = tempfile.mkdtemp(prefix="fo-sync-")
cfg = types.ModuleType("config")
cfg.ANTHROPIC_API_KEY = ""; cfg.ANTHROPIC_MODEL = "x"; cfg.API_BASE = "https://x"; cfg.MITID_USERNAME = "x"; cfg.WRITE_TOKEN = "x"
cfg.CHILDREN = [{"name": "Barn", "calendar_id": 1}, {"name": "Søsken", "calendar_id": 2}]
sys.modules["config"] = cfg
spec = importlib.util.spec_from_file_location("sync", os.path.join(_R, "docker", "aula", "Sync-Aula.py")); S = importlib.util.module_from_spec(spec); spec.loader.exec_module(S)
ok_all = True
def t(n, c, x=""):
    global ok_all; ok_all &= bool(c); print("ok  " if c else "FEJL", n, "" if c else x)
ugeplan = [{"name": "Barn Efternavn", "institutions": [{"letters": [{"week_number": 46, "group_name": "4A", "content_html": BREV}]}]}]
with contextlib.redirect_stderr(io.StringIO()), contextlib.redirect_stdout(io.StringIO()):
    breve = S.build_letters(ugeplan, 46)
l = breve[0]
t("brevet deles: «full» er hele brevet som flad tekst (til analysen, som før), «body» er selve brevet fra hilsenen, og skemaet ligger i _plan", len(breve) == 1 and "Billedkunst" in l["full"] and l["body"].startswith("Kære forældre,") and "Billedkunst" not in l["body"] and l["_plan"]["dage"] == [1, 2, 3, 4, 5] and l["child"] == "Barn" and l["group"] == "4A", {k: str(v)[:60] for k, v in l.items()})
gemt = S.rens_breve(breve)
t("når brevene gemmes, er _plan væk (lærernes forbogstaver skal ikke ligge på serveren), og alt andet er der", "_plan" not in gemt[0] and set(gemt[0]) == {"child", "group", "full", "body"} and "_plan" in breve[0], set(gemt[0]))
def uge(school, lessons, breve):
    return {"id": "2026-W46", "school": school, "lessons_by_day": lessons, "letters": breve, "letters_ok": True, "lessons": 0}
tom = lambda: {str(i): [] for i in range(1, 8)}
w = uge(tom(), tom(), [dict(l)])
n = S.fyld_fra_breve(w)
t("tom kalender: lektionerne kommer fra brevet, og skolelinjen pr. dag (mandag 07.45-13.15)", n > 0 and any(x["title"] == "Billedkunst" for x in w["lessons_by_day"]["1"]) and w["school"]["1"] == [{"child": "Barn", "hours": "07.45-13.15", "flags": []}], (n, w["school"]["1"]))
t("lektionerne har ingen lærere og er sorteret; svømning giver Idræt-flag tirsdag", all("(" not in x["title"] for d in w["lessons_by_day"].values() for x in d) and [x["start"] for x in w["lessons_by_day"]["1"]] == sorted(x["start"] for x in w["lessons_by_day"]["1"]) and w["school"]["2"][0]["flags"] == ["Idræt"])
kal = tom(); kal["1"] = [{"child": "Barn", "start": "08.05", "end": "13.25", "title": "Kalenderfag", "room": "", "sub": False}]
sk = tom(); sk["1"] = [{"child": "Barn", "hours": "08.05-13.25", "flags": []}]
w2 = uge(sk, kal, [dict(l)]); S.fyld_fra_breve(w2)
t("har kalenderen lektioner for barnet den dag, bevares de (brevet overskriver dem ikke), og de andre dage fyldes op fra brevet", [x["title"] for x in w2["lessons_by_day"]["1"]] == ["Kalenderfag"] and w2["school"]["1"][0]["hours"] == "08.05-13.25" and w2["lessons_by_day"]["2"], [x["title"] for x in w2["lessons_by_day"]["1"]])
w3 = uge(None, None, [dict(l)]); n3 = S.fyld_fra_breve(w3)
t("fejlede kalenderen helt (None), skrives kun de dage, brevet har lektioner for, så en tidligere hentning ikke overskrives med tomme dage", n3 > 0 and set(w3["lessons_by_day"]) == {"1", "2", "3", "4", "5"} and set(w3["school"]) == {"1", "2", "3", "4", "5"} and all(w3["lessons_by_day"].values()), set(w3["lessons_by_day"]))
w4 = uge(tom(), tom(), [{"child": "Barn", "group": "", "full": "Kære forældre, ingen skema"}])
t("et brev uden skema ændrer ingenting (0 lektioner, kalenderdata urørt)", S.fyld_fra_breve(w4) == 0 and w4["lessons_by_day"] == tom() and w4["school"] == tom())
w5 = uge(None, None, [{"child": "Barn", "group": "", "full": "x"}]); S.fyld_fra_breve(w5)
t("uden skema i brev og uden kalender forbliver begge None (så main ved, at intet blev hentet, og lader det gamle stå)", w5["school"] is None and w5["lessons_by_day"] is None)
tosk = [dict(l), dict(l, child="Søsken")]
w6 = uge(tom(), tom(), tosk); S.fyld_fra_breve(w6)
t("to børn: rækkefølgen følger CHILDREN (Barn før Søsken) inden for en dag", [x["child"] for x in w6["lessons_by_day"]["1"]][:1] == ["Barn"] and {x["child"] for x in w6["lessons_by_day"]["1"]} == {"Barn", "Søsken"} and [x["child"] for x in w6["school"]["1"]] == ["Barn", "Søsken"])
# en læser, der fejler, vælter ikke synkroniseringen
orig = S.brev.laes_brev
S.brev.laes_brev = lambda raa: (_ for _ in ()).throw(ValueError("ødelagt"))
err = io.StringIO()
with contextlib.redirect_stderr(err), contextlib.redirect_stdout(err): b2 = S.build_letters(ugeplan, 46)
S.brev.laes_brev = orig
t("fejler læseren, vises brevet som ren tekst (uden body og skema), og det logges, uden at synkroniseringen vælter", len(b2) == 1 and "body" not in b2[0] and "_plan" not in b2[0] and b2[0]["full"] and "kunne ikke deles" in err.getvalue(), err.getvalue()[-200:])
# diagnosen viser opbygningen, ikke indholdet
S.aula_json = lambda *a: ugeplan
ud = io.StringIO()
with contextlib.redirect_stdout(ud): S.brevform()
v = ud.getvalue()
t("--brevform viser tabeller, rækker og skema fundet, men intet af brevets indhold og ingen navne", "skema FUNDET: 6 rækker" in v and "1 tabeller" in v and "<table>" in v and not any(x in v for x in ("Billedkunst", "Kære", "Barn", "Efternavn", "skolefest", "Linoleumstryk")), v[:300])
t("Dockerfilen kopierer brev.py ind sammen med Sync-Aula.py", "docker/aula/brev.py" in open(os.path.join(_R, "docker", "aula", "Dockerfile"), encoding="utf-8").read())
sys.exit(0 if ok_all else 1)
