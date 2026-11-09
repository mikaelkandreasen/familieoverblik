"""Ønskeskyen-linket pr. person: valideringen, lagringen, config.js (PEOPLE) og sikkerhedskopien. Opdigtede links."""
import importlib.util, json, os, shutil, subprocess, sys, tempfile
_R = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); BOOT = os.path.join(_R, "docker", "web", "bootstrap.py")
ok_all = True
def t(n, c, x=""):
    global ok_all; ok_all &= bool(c); print("ok  " if c else "FEJL", n, "" if c else x)
spec = importlib.util.spec_from_file_location("b", BOOT); B = importlib.util.module_from_spec(spec); spec.loader.exec_module(B)
def miljo():
    tmp = tempfile.mkdtemp(prefix="fo-ons-"); sk = os.path.join(tmp, "skabelon"); os.makedirs(sk)
    for a, b in (("public_html", "html"), ("ugeplan-lib", "lib"), ("ugeplan-data", "data")): shutil.copytree(os.path.join(_R, a), os.path.join(sk, b))
    shutil.copyfile(os.path.join(_R, "docker", "aula", "config-skabelon.py"), os.path.join(sk, "aula-config.py"))
    for f in ("CHANGELOG.md", "VERSION"): shutil.copyfile(os.path.join(_R, f), os.path.join(sk, f))
    return tmp, {**os.environ, "FO_SKABELON": sk, "FO_HTML": f"{tmp}/html", "FO_LIB": f"{tmp}/lib", "FO_DATA": f"{tmp}/data", "FO_AULA_CONFIG": f"{tmp}/data/private/aula-config", "FO_BRUGER": "findes-ikke"}
def kor(e, *a, stdin=None): return subprocess.run([sys.executable, BOOT, *a], input=stdin, capture_output=True, env=e)
def js(r): return json.loads(r.stdout.decode().strip().splitlines()[-1])
L = lambda p: open(p, encoding="utf-8").read()
# ── valideringen ──
V = B.valider_link
gyldige = ["https://onskeskyen.dk/share/abc123", "https://www.onskeskyen.dk/wishlist/12345?x=1#y", "https://gowish.com/w/abc", "https://a.dk:8443/x", "https://onskeskyen.dk"]
t("gyldige https-links accepteres uændret (med www, port, søgning og anker), og mellemrum omkring trimmes", all(V(u, "L") == u for u in gyldige) and V("  https://a.dk/x \n", "L") == "https://a.dk/x")
t("tomt og manglende giver tom tekst (linket er valgfrit)", V("", "L") == "" and V("   ", "L") == "" and V(None, "L") == "")
ugyldige = ["http://a.dk/x", "javascript:alert(1)", "https://", "https://localhost/a", "https://a b.dk", 'https://a.dk/"x', "https://a.dk/<x>", "https://a.dk/'x", "https://a.dk/`x", "https://a.dk/\\x", "https://u:p" + "@a.dk/x", "ftp://a.dk", "//a.dk/x", "data:text/html,x", "https://a.dk/" + "x" * 300, "https://a.dk/x\ny", "https://.dk/x", "https://a..dk/x"]
def afvises(u):
    try: V(u, "Ønskeskyen-link for Anna"); return False
    except B.Fejl as e: return "Ønskeskyen-link for Anna" in str(e)
t("ugyldige links afvises med en fejl, der nævner personen (http, javascript:, data:, ftp, uden domæne, mellemrum, citationstegn, <>, bagstreg, brugernavn, linjeskift, for langt)", all(afvises(u) for u in ugyldige), [u for u in ugyldige if not afvises(u)])
def ikke_tekst(x):
    try: V(x, "L"); return False
    except B.Fejl: return True
t("noget, der ikke er tekst (tal, liste, ordbog, sand), afvises", all(ikke_tekst(x) for x in (5, [], {}, True, 1.5)))
# ── hele vejen: opsætning → config.js ──
tmp, e = miljo(); H, D = f"{tmp}/html", f"{tmp}/data"
kor(e, "start"); kode = json.load(open(f"{D}/private/instans.json"))["opsaetningskode"]
sv = {"voksne": [{"navn": "Anna", "foedselsdag": "14.3.1985", "onskeskyen": "https://onskeskyen.dk/share/anna"}, {"navn": "Peter"}], "boern": [{"navn": "Sofie", "calendar_id": "12345", "foedselsdag": "9.6.2015", "onskeskyen": " https://www.onskeskyen.dk/w/sofie?x=1 "}, {"navn": "Emil", "calendar_id": 0}]}
r = kor(e, "anvend", stdin=json.dumps({"kode": kode, "sv": sv, "pin": "4711"}).encode())
t("opsætning med links gemmes, og serveren svarer ok", r.returncode == 0, (r.stdout + r.stderr).decode()[-300:])
lae = js(kor(e, "laes"))["sv"]
t("de gemte personer har linket, hvor det er sat (trimmet), og intet felt hvor det ikke er; fødselsdag og calendar_id er uændrede", lae["voksne"][0] == {"navn": "Anna", "foedselsdag": "14.03.1985", "onskeskyen": "https://onskeskyen.dk/share/anna"} and "onskeskyen" not in lae["voksne"][1] and lae["boern"][0]["onskeskyen"] == "https://www.onskeskyen.dk/w/sofie?x=1" and lae["boern"][0]["calendar_id"] == 12345 and lae["boern"][0]["foedselsdag"] == "09.06.2015" and "onskeskyen" not in lae["boern"][1], lae)
cj = L(f"{H}/config.js")
t("config.js (PEOPLE) har linket for Anna og Sofie, og kun dem: ikke «Alle», ikke Peter eller Emil", 'name: "Anna", color: "var(--p-1)", birthday: "14.03.1985", onskeskyen: "https://onskeskyen.dk/share/anna"' in cj and 'onskeskyen: "https://www.onskeskyen.dk/w/sofie?x=1"' in cj and cj.count("onskeskyen:") == 2 and 'id: "alle", name: "Alle", color: "var(--p-alle)" }' in cj, cj[cj.index("PEOPLE"):cj.index("PEOPLE") + 700])
cj2 = cj.replace("export ", "").replace("const PEOPLE", "var PEOPLE")
t("config.js er stadig gyldig JavaScript med personerne som objekter", subprocess.run(["node", "--input-type=module", "-e", cj + "\nif (!Array.isArray(PEOPLE) || PEOPLE.filter(p => p.onskeskyen).length !== 2) process.exit(3);"], capture_output=True).returncode == 0)
# ugyldigt link afviser hele ændringen og ændrer ingenting
sv_d = json.loads(json.dumps(sv)); sv_d["voksne"][0]["onskeskyen"] = "http://usikkert.dk/x"
r = kor(e, "anvend", stdin=json.dumps({"sv": sv_d}).encode())
t("et ugyldigt link afviser hele ændringen med en forklaring (nævner Anna og https://), og de gemte links er uændrede", r.returncode == 1 and "Ønskeskyen-link for Anna" in js(r)["fejl"] and "https://" in js(r)["fejl"] and js(kor(e, "laes"))["sv"]["voksne"][0]["onskeskyen"] == "https://onskeskyen.dk/share/anna")
# fjern et link, og ret et andet
sv2 = json.loads(json.dumps(sv)); del sv2["voksne"][0]["onskeskyen"]; sv2["voksne"][1]["onskeskyen"] = "https://gowish.com/w/peter"
r = kor(e, "anvend", stdin=json.dumps({"sv": sv2}).encode()); kor(e, "render")
cj = L(f"{H}/config.js")
t("når linket fjernes fra Anna og tilføjes til Peter, følger config.js med (Annas er væk, Peters er der, Sofies bevares)", r.returncode == 0 and "share/anna" not in cj and 'name: "Peter", color: "var(--p-2)", onskeskyen: "https://gowish.com/w/peter"' in cj and "w/sofie" in cj and cj.count("onskeskyen:") == 2, cj[cj.index("PEOPLE"):cj.index("PEOPLE") + 600])
# rettelse af noget andet rører ikke ved linkene
r = kor(e, "anvend", stdin=json.dumps({"sted": {"lat": 56.1, "lon": 10.2, "tidszone": "Europe/Copenhagen"}}).encode())
t("en rettelse af noget andet (stedet) lader linkene stå", r.returncode == 0 and js(kor(e, "laes"))["sv"]["voksne"][1]["onskeskyen"] == "https://gowish.com/w/peter")
# sikkerhedskopi
bk = f"{tmp}/kopi.tar.gz"; open(bk, "wb").write(kor(e, "backup").stdout)
tmp2, e2 = miljo(); kor(e2, "start"); rg = kor(e2, "gendan", bk)
t("sikkerhedskopien tager linkene med, og en gendannet installation har dem i config.js", rg.returncode == 0 and js(kor(e2, "laes"))["sv"]["boern"][0]["onskeskyen"] == "https://www.onskeskyen.dk/w/sofie?x=1" and "https://gowish.com/w/peter" in L(f"{tmp2}/html/config.js"), (rg.stdout + rg.stderr).decode()[-300:])
# ældre installationer
tmp3, e3 = miljo(); kor(e3, "start"); ins = json.load(open(f"{tmp3}/data/private/instans.json"))
t("en ny installation uden links har ingen onskeskyen-felter, og config.js har ingen onskeskyen-linjer (så intet ændres for dem, der ikke bruger det)", all("onskeskyen" not in json.dumps(x) for x in ins["sv"]["voksne"] + ins["sv"]["boern"]) and "onskeskyen" not in L(f"{tmp3}/html/config.js") if os.path.exists(f"{tmp3}/html/config.js") else True)
t("sikker_visning (det, indstillingssiden henter) har linkene", "onskeskyen" in json.dumps(js(kor(e, "laes"))["sv"]))
# personerne som tekst (ældre format) kan stadig læses
t("personer skrevet som ren tekst (3.0.0-formatet) normaliseres uden fejl og uden link", B.valider_sv({"voksne": ["Anna"], "boern": [{"navn": "Sofie", "calendar_id": 1}]})["voksne"] == [{"navn": "Anna", "foedselsdag": ""}])
sys.exit(0 if ok_all else 1)
