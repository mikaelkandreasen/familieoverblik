"""Prøver docker/web/bootstrap.py uden Docker: kører det som en rigtig proces med miljøvariabler, der peger på midlertidige mapper."""
import io, json, os, re, shutil, subprocess, sys, tarfile, tempfile, zipfile
ROD = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BOOT = os.path.join(ROD, "docker", "web", "bootstrap.py")
ok_all = True
def t(n, c, x=""):
    global ok_all; ok_all &= bool(c); print("ok  " if c else "FEJL", n, "" if c else x)

def miljo():
    tmp = tempfile.mkdtemp(prefix="fo-")
    sk = os.path.join(tmp, "skabelon"); os.makedirs(sk)
    shutil.copytree(os.path.join(ROD, "public_html"), os.path.join(sk, "html"))
    shutil.copytree(os.path.join(ROD, "ugeplan-lib"), os.path.join(sk, "lib"))
    shutil.copytree(os.path.join(ROD, "ugeplan-data"), os.path.join(sk, "data"))
    shutil.copyfile(os.path.join(ROD, "docker", "aula", "config-skabelon.py"), os.path.join(sk, "aula-config.py"))
    for f in ("CHANGELOG.md", "VERSION"): shutil.copyfile(os.path.join(ROD, f), os.path.join(sk, f))
    e = {**os.environ, "FO_SKABELON": sk, "FO_HTML": f"{tmp}/html", "FO_LIB": f"{tmp}/lib", "FO_DATA": f"{tmp}/data", "FO_AULA_CONFIG": f"{tmp}/data/private/aula-config", "FO_BRUGER": "findes-ikke"}
    return tmp, e
def kor(e, *a, stdin=None):
    return subprocess.run([sys.executable, BOOT, *a], input=stdin, capture_output=True, env=e)
def js(r): return json.loads(r.stdout.decode().strip().splitlines()[-1])
L = lambda p: open(p, encoding="utf-8").read()

tmp, e = miljo(); H, B, D = f"{tmp}/html", f"{tmp}/lib", f"{tmp}/data"
r = kor(e, "start")
t("første start lykkes og skriver opsætningskoden i loggen", r.returncode == 0 and re.search(r"Opsætningskode: [A-Z2-9]{8}", r.stdout.decode()), r.stderr.decode()[-300:])
ins = json.loads(L(f"{D}/private/instans.json"))
t("instans.json: tokens, PIN, kode og standardværdier", all(len(ins["tokens"][k]) == 40 for k in ("read", "write", "cron", "gate")) and len(set(ins["tokens"].values())) == 4 and re.fullmatch(r"\d{6}", ins["pin"]) and re.fullmatch(r"[A-Z2-9]{8}", ins["opsaetningskode"]) and ins["opsat"] is False and ins["sted"]["tidszone"] == "Europe/Copenhagen")
t("instans.json har rettighed 660 (ikke læsbar for andre)", oct(os.stat(f"{D}/private/instans.json").st_mode & 0o777) == "0o660")
alle = [os.path.join(r_, f) for r_, _, fs in os.walk(tmp) for f in fs if not f.endswith(".png")]
tekst = {p: L(p) for p in alle if "skabelon" not in p and not p.endswith("instans.json")}
t("ingen pladsholdere (__READ_TOKEN__ osv.) er tilbage i de renderede filer", not [p for p, x in tekst.items() if re.search(r"__(READ|WRITE|CRON|GATE)_TOKEN__|__PIN__|__API_BASE__", x)], [p for p, x in tekst.items() if re.search(r"__(READ|WRITE|CRON|GATE)_TOKEN__|__PIN__", x)][:3])
t("nøglerne er sat ind rigtige steder", ins["tokens"]["read"] in L(f"{H}/config.js") and f"'{ins['tokens']['read']}'" in L(f"{B}/config.php") and ins["tokens"]["gate"] in L(f"{B}/gate.php") and ins["tokens"]["gate"] in L(f"{H}/.htaccess") and f"'{ins['pin']}'" in L(f"{H}/login.php"))
t("gate-tokenen er den samme i .htaccess og gate.php (ellers kan ingen logge ind)", L(f"{H}/.htaccess").count(ins["tokens"]["gate"]) >= 5)
t(".htaccess: HTTPS-kravet er fjernet (lokalt netværk), PIN-reglerne er der stadig", "RewriteCond %{HTTPS}" not in L(f"{H}/.htaccess") and "info\\.php" in L(f"{H}/.htaccess") and "sprog\\.php" in L(f"{H}/.htaccess"))
t("login.php: cookien kan bruges over http", "'secure'   => false" in L(f"{H}/login.php"))
t("før opsætning sendes login.php til guiden", "header('Location: start.html');" in L(f"{H}/login.php") and L(f"{H}/login.php").count("start.html") == 1)
t("config.js: standardpersoner (Voksen 1, Barn 1)", 'name: "Voksen 1"' in L(f"{H}/config.js") and 'name: "Barn 1"' in L(f"{H}/config.js") and "var(--p-3)" in L(f"{H}/config.js"))
cp = L(f"{D}/private/aula-config/config.py")
t("aula-config: adresse til web-containeren, skrivenøgle som tekst (ikke miljøvariabel), børn", 'API_BASE = "http://web/api.php"' in cp and f'WRITE_TOKEN = "{ins["tokens"]["write"]}"' in cp and "os.environ[" not in cp and '"name": "Barn 1"' in cp and 'MITID_USERNAME = ""' in cp)
t("datamappen: alle undermapper, .htaccess fra skabelonen, og aula-state", all(os.path.isdir(f"{D}/{m}") for m in ("aula", "ics", "planner", "settings", "private", "cache", "billeder", "bil", "tegneserie", "private/aula-state")) and os.path.exists(f"{D}/.htaccess"))
t("CHANGELOG.md og VERSION lægges i webmappen", os.path.exists(f"{H}/CHANGELOG.md") and L(f"{H}/VERSION").strip() == L(f"{ROD}/VERSION").strip())
# anden start
os.makedirs(f"{D}/settings", exist_ok=True); open(f"{D}/settings/dated.json", "w").write('{"mine":"data"}'); open(f"{D}/billeder/foto.jpg", "w").write("FOTO")
r = kor(e, "start"); ins2 = json.loads(L(f"{D}/private/instans.json"))
t("anden start: nøglerne og koden er uændrede, og dine data røres ikke", ins2 == ins and L(f"{D}/settings/dated.json") == '{"mine":"data"}' and L(f"{D}/billeder/foto.jpg") == "FOTO")
# forkert kode
payload = {"sv": {"voksne": [{"navn": "Anna", "foedselsdag": "14.3.1985"}, "Peter"], "boern": [{"navn": "Sofie", "calendar_id": "12345", "foedselsdag": "09.06.2015"}, {"navn": "Emil", "calendar_id": 0}], "fodselsdagstema": True}, "pin": "4711",
           "sted": {"lat": 55.4, "lon": 10.4, "tidszone": "Europe/Copenhagen"}, "hemmeligheder": {"mitid_brugernavn": "anna-mitid", "anthropic_noegle": "sk-ant-HEMMELIG", "aula_model": "claude-sonnet-5-5"}}
r = kor(e, "anvend", stdin=json.dumps({**payload, "kode": "FORKERT1"}).encode())
t("forkert opsætningskode afvises, og intet er ændret", r.returncode == 1 and "forkert" in js(r)["fejl"] and json.loads(L(f"{D}/private/instans.json"))["opsat"] is False)
r = kor(e, "anvend", stdin=json.dumps({"sv": payload["sv"], "pin": "4711"}).encode()); t("uden kode afvises", r.returncode == 1)
for i in range(7): kor(e, "anvend", stdin=json.dumps({**payload, "kode": "FORKERT1"}).encode())
r = kor(e, "anvend", stdin=json.dumps({**payload, "kode": ins["opsaetningskode"]}).encode())
t("efter 8 forkerte forsøg låses guiden, selv med den rigtige kode", r.returncode == 1 and "For mange forkerte" in js(r)["fejl"], js(r))
os.remove(f"{D}/private/opsaetning-forsoeg.json")
r = kor(e, "anvend", stdin=json.dumps({"sv": payload["sv"], "kode": ins["opsaetningskode"].lower()[:4] + "-" + ins["opsaetningskode"].lower()[4:]}).encode())
t("koden accepteres med små bogstaver og bindestreg, men uden PIN afvises første opsætning", r.returncode == 1 and "PIN" in js(r)["fejl"], js(r))
r = kor(e, "anvend", stdin=json.dumps({**payload, "kode": ins["opsaetningskode"]}).encode()); sv = js(r)
t("rigtig kode og gyldige svar: opsætning gennemført, PIN returneres én gang", r.returncode == 0 and sv == {"ok": True, "foerste": True, "pin": "4711"}, sv)
ins3 = json.loads(L(f"{D}/private/instans.json"))
t("instans.json: opsat, koden fjernet, nøgler uændrede, PIN og sted gemt", ins3["opsat"] is True and "opsaetningskode" not in ins3 and ins3["tokens"] == ins["tokens"] and ins3["pin"] == "4711" and ins3["sted"]["lat"] == 55.4 and ins3["sv"]["boern"][0]["calendar_id"] == 12345)
t("login.php sender ikke længere til guiden, og har den nye PIN", "start.html" not in L(f"{H}/login.php") and "'4711'" in L(f"{H}/login.php"))
cj = L(f"{H}/config.js")
t("config.js: personerne er Anna, Peter, Sofie, Emil med farverne p-1, p-2, p-3, p-4 og fødselsdage", all(x in cj for x in ('id: "anna"', 'id: "peter"', 'id: "sofie"', 'id: "emil"')) and 'color: "var(--p-4)"' in cj and "Voksen 1" not in cj and cj.index('"anna"') < cj.index('"emil"') and 'birthday: "14.03.1985"' in cj and 'birthday: "09.06.2015"' in cj and cj.count("birthday:") == 2 and "export const BIRTHDAY_THEME = true;" in cj, cj)
t("config.php: breddegrad, længdegrad og tidszone", "const LATITUDE  = 55.4;" in L(f"{B}/config.php") and "const LONGITUDE = 10.4;" in L(f"{B}/config.php") and "'Europe/Copenhagen'" in L(f"{B}/config.php"))
cp = L(f"{D}/private/aula-config/config.py")
t("aula-config: børn med calendar_id, MitID-navn, nøgle og model", '{"name": "Sofie", "calendar_id": 12345}' in cp and '{"name": "Emil", "calendar_id": 0},   # TODO' in cp and 'MITID_USERNAME = "anna-mitid"' in cp and 'ANTHROPIC_API_KEY = "sk-ant-HEMMELIG"' in cp and 'ANTHROPIC_MODEL = "claude-sonnet-5-5"' in cp)
compile(cp, "config.py", "exec")
t("den renderede config.py er gyldig Python", True)
r = kor(e, "anvend", "--foerste", stdin=json.dumps({"hemmeligheder": {"mitid_brugernavn": "hacker"}}).encode())
t("guidens kald (--foerste) afvises, når opsætningen er gennemført (ellers kunne enhver ændre indstillinger uden login)", r.returncode == 1 and "allerede gennemført" in js(r)["fejl"] and json.loads(L(f"{D}/private/instans.json"))["hemmeligheder"]["mitid_brugernavn"] == "anna-mitid")
# efter opsætning: indstillinger
r = kor(e, "anvend", stdin=json.dumps({"hemmeligheder": {"hyundai_bruger": "mig@x.dk", "hyundai_kode": "pw", "hyundai_pin": "1234"}}).encode())
t("efter opsætning kræver ændringer ingen kode, og PIN returneres ikke igen", r.returncode == 0 and js(r) == {"ok": True, "foerste": False, "pin": None})
ins4 = json.loads(L(f"{D}/private/instans.json"))
t("manglende nøgler i en opdatering beholdes (ANTHROPIC-nøglen er der stadig)", ins4["hemmeligheder"]["anthropic_noegle"] == "sk-ant-HEMMELIG" and ins4["hemmeligheder"]["hyundai_bruger"] == "mig@x.dk" and ins4["pin"] == "4711")
r = kor(e, "anvend", stdin=json.dumps({"hemmeligheder": {"anthropic_noegle": ""}}).encode()); ins5 = json.loads(L(f"{D}/private/instans.json"))
t("en tom værdi rydder en nøgle", "anthropic_noegle" not in ins5["hemmeligheder"] and 'ANTHROPIC_API_KEY = ""' in L(f"{D}/private/aula-config/config.py"))
r = kor(e, "anvend", stdin=json.dumps({"pin": "123456"}).encode()); t("ny PIN gemmes og lægges i login.php", "'123456'" in L(f"{H}/login.php") and json.loads(L(f"{D}/private/instans.json"))["pin"] == "123456")
r = kor(e, "laes"); v = js(r)
t("laes: navne, fødselsdage og sted, men ingen hemmeligheder i klartekst", [x["navn"] for x in v["sv"]["voksne"]] == ["Anna", "Peter"] and v["sv"]["voksne"][0]["foedselsdag"] == "14.03.1985" and v["sv"]["boern"][0]["foedselsdag"] == "09.06.2015" and v["sv"]["fodselsdagstema"] is True and v["sat"]["hyundai_kode"] is True and v["hemmeligheder"]["hyundai_kode"] is None and v["hemmeligheder"]["anthropic_noegle"] is None and "pw" not in r.stdout.decode() and "sk-ant" not in r.stdout.decode() and v["hemmeligheder"]["mitid_brugernavn"] == "anna-mitid" and v["pin_laengde"] == 6)
# validering
def fejl(p, tekst=None):
    r = kor(e, "anvend", stdin=json.dumps(p).encode()); d = js(r)
    return r.returncode == 1 and (tekst is None or tekst in d["fejl"])
sv = lambda v, b: {"sv": {"voksne": v, "boern": b}}
t("validering: 0 eller 5 voksne, 0 eller 9 børn", fejl(sv([], [{"navn": "A"}]), "1 til 4 voksne") and fejl(sv([f"V{i}" for i in range(5)], [{"navn": "D"}]), "1 til 4 voksne") and fejl(sv(["A"], []), "1 til 8 børn") and fejl(sv(["A"], [{"navn": f"B{i}"} for i in range(9)]), "1 til 8 børn"))
t("validering: samme navn to gange (også med store/små bogstaver), «Alle», tomt og for langt navn, specialtegn", fejl(sv(["Anna"], [{"navn": "anna"}]), "samme navn") and fejl(sv(["Alle"], [{"navn": "B"}]), "Alle") and fejl(sv([" "], [{"navn": "B"}]), "mangler") and fejl(sv(["x" * 31], [{"navn": "B"}]), "30 tegn") and fejl(sv(["A<b>"], [{"navn": "B"}]), "specialtegn") and fejl(sv(['A"'], [{"navn": "B"}])))
t("validering: calendar_id", fejl(sv(["A"], [{"navn": "B", "calendar_id": -1}]), "calendar_id") and fejl(sv(["A"], [{"navn": "B", "calendar_id": "abc"}]), "calendar_id") and fejl(sv(["A"], [{"navn": "B", "calendar_id": True}])))
t("validering: sted", fejl({"sted": {"lat": 91, "lon": 0, "tidszone": "Europe/Copenhagen"}}, "Breddegrad") and fejl({"sted": {"lat": 0, "lon": 181, "tidszone": "Europe/Copenhagen"}}, "længdegrad") and fejl({"sted": {"lat": "x", "lon": 0, "tidszone": "Europe/Copenhagen"}}, "tal") and fejl({"sted": {"lat": 0, "lon": 0, "tidszone": "Ikke/Til"}}, "tidszone") and fejl({"sted": {"lat": 0, "lon": 0}}, "tidszone"))
t("validering: PIN", fejl({"pin": "123"}, "4 til 8") and fejl({"pin": "123456789"}, "4 til 8") and fejl({"pin": "12ab"}, "4 til 8"))
t("validering: ukendt nøgle, for lang, styretegn, model og Hyundai-PIN", fejl({"hemmeligheder": {"ukendt": "x"}}, "Ukendt") and fejl({"hemmeligheder": {"mitid_brugernavn": "x" * 61}}, "højst") and fejl({"hemmeligheder": {"mitid_brugernavn": "a\nb"}}, "styretegn") and fejl({"hemmeligheder": {"aula_model": "ny model!"}}, "Modelnavnet") and fejl({"hemmeligheder": {"hyundai_pin": "12a"}}, "cifre") and fejl({"hemmeligheder": []}))
t("validering: forkert form", kor(e, "anvend", stdin=b"ikke json").returncode == 1 and kor(e, "anvend", stdin=b"[1,2]").returncode == 1 and kor(e, "anvend", stdin=b"null").returncode == 1)
t("et afvist forsøg ændrer ingenting i instans.json", [x["navn"] for x in json.loads(L(f"{D}/private/instans.json"))["sv"]["voksne"]] == ["Anna", "Peter"])
# flere personer, fødselsdage og tema
def stort(v, b, tema=True):
    return {"sv": {"voksne": [{"navn": f"V{i}", "foedselsdag": ""} for i in range(v)], "boern": [{"navn": f"B{i}", "calendar_id": i} for i in range(b)], "fodselsdagstema": tema}}
r = kor(e, "anvend", stdin=json.dumps(stort(4, 8, False)).encode()); cj = L(f"{H}/config.js")
t("4 voksne og 8 børn kan oprettes", r.returncode == 0, js(r))
cols = re.findall(r'id: "(v\d|b\d)", name: "[^"]+", color: "var\(--p-(\d+)\)"', cj); kort = dict(cols)
t("farvepladserne: voksne p-1, p-2, p-6, p-7, børn p-3, p-4, p-5, p-8 til p-12 (de første er uændrede), alle 12 forskellige", [kort[f"v{i}"] for i in range(4)] == ["1", "2", "6", "7"] and [kort[f"b{i}"] for i in range(8)] == ["3", "4", "5", "8", "9", "10", "11", "12"] and len(set(kort.values())) == 12, kort)
t("tema slået fra giver BIRTHDAY_THEME = false", "export const BIRTHDAY_THEME = false;" in cj)
t("aula-config har alle otte børn", L(f"{D}/private/aula-config/config.py").count('"calendar_id"') == 8)
t("kun én voksen og ét barn er stadig gyldigt (mindst)", kor(e, "anvend", stdin=json.dumps(stort(1, 1)).encode()).returncode == 0)
for fd, godkendt in (("14.03", "14.03"), ("1.3", "01.03"), ("14-03-1985", "14.03.1985"), ("14/3/1985", "14.03.1985"), ("29.02", "29.02"), ("29.02.2000", "29.02.2000"), ("", ""), ("  ", ""), (None, "")):
    p_ = {"sv": {"voksne": [{"navn": "Anna", "foedselsdag": fd}], "boern": [{"navn": "Sofie", "calendar_id": 0}]}}
    r = kor(e, "anvend", stdin=json.dumps(p_).encode())
    t(f"fødselsdag {fd!r} normaliseres til {godkendt!r}", r.returncode == 0 and json.loads(L(f"{D}/private/instans.json"))["sv"]["voksne"][0]["foedselsdag"] == godkendt, js(r))
for fd, tekst in (("31.02", "findes ikke"), ("29.02.2001", "findes ikke"), ("32.01", "findes ikke"), ("14.13", "findes ikke"), ("14.03.1850", "årstallet"), ("14.03.2999", "fremtiden"), ("i går", "dd.mm"), ("14.03.85", "dd.mm"), ("14", "dd.mm"), ("1985-03-14", "dd.mm"), (19850314, "dd.mm")):
    t(f"ugyldig fødselsdag {fd!r} afvises", fejl({"sv": {"voksne": [{"navn": "Anna", "foedselsdag": fd}], "boern": [{"navn": "S"}]}}, tekst))
t("tema skal være sandt eller falsk", fejl({"sv": {"voksne": ["A"], "boern": [{"navn": "B"}], "fodselsdagstema": "ja"}}, "til eller fra"))
# 3.0.0-filer (voksne som tekster, uden fødselsdage) læses og gemmes som objekter
ind = json.loads(L(f"{D}/private/instans.json")); ind["sv"] = {"voksne": ["Gammel", "Anden"], "boern": [{"navn": "Barn", "calendar_id": 5}]}; json.dump(ind, open(f"{D}/private/instans.json", "w"))
kor(e, "render"); cj = L(f"{H}/config.js")
t("en 3.0.0-instans.json (voksne som tekster) kan stadig renderes, og tema er slået til som standard", 'name: "Gammel"' in cj and 'name: "Anden"' in cj and "birthday:" not in cj and "export const BIRTHDAY_THEME = true;" in cj, cj[-400:])
v = js(kor(e, "laes")); t("laes normaliserer en gammel fil til objekter", v["sv"]["voksne"] == [{"navn": "Gammel"}, {"navn": "Anden"}] or v["sv"]["voksne"][0]["navn"] == "Gammel")
# sikkerhedskopi og gendan
open(f"{D}/cache/midlertidigt.json", "w").write("{}"); open(f"{D}/settings/recurring.json", "w").write('{"x":1}')
r = kor(e, "backup"); tf = tarfile.open(fileobj=io.BytesIO(r.stdout), mode="r:gz"); navne = tf.getnames()
t("backup: tar.gz med data, billeder og instans.json, men uden cache og aula-config", "ugeplan-data/settings/dated.json" in navne and "ugeplan-data/billeder/foto.jpg" in navne and "ugeplan-data/private/instans.json" in navne and not any("cache/" in n or "aula-config" in n for n in navne), navne[:8])
bak = f"{tmp}/bak.tar.gz"; open(bak, "wb").write(r.stdout)
tmp2, e2 = miljo(); kor(e2, "start")
r = kor(e2, "gendan", bak); g = js(r)
t("gendan på en ny, tom installation: filer lagt ind, instans.json (nøgler og PIN) gendannet og siderne rendret igen", g["ok"] and g["instans_gendannet"] and L(f"{tmp2}/data/settings/dated.json") == '{"mine":"data"}' and json.loads(L(f"{tmp2}/data/private/instans.json"))["pin"] == "123456" and "'123456'" in L(f"{tmp2}/html/login.php") and 'id: "gammel"' in L(f"{tmp2}/html/config.js"), g)
# zip fra version 2
tmp3, e3 = miljo(); kor(e3, "start"); z = f"{tmp3}/v2.zip"; ins_foer = json.loads(L(f"{tmp3}/data/private/instans.json"))
with zipfile.ZipFile(z, "w") as zz:
    zz.writestr("ugeplan-data/settings/dated.json", '{"fra":"v2"}'); zz.writestr("ugeplan-data/billeder/a.jpg", "J"); zz.writestr("ugeplan-data/private/strava.json", "{}"); zz.writestr("ugeplan-data/cache/x.json", "cache")
r = kor(e3, "gendan", z); g = js(r)
t("gendan fra en zip af version 2's ugeplan-data: data lagt ind, cache sprunget over, den nye instans bevaret", g["ok"] and g["filer"] == 3 and L(f"{tmp3}/data/settings/dated.json") == '{"fra":"v2"}' and not os.path.exists(f"{tmp3}/data/cache/x.json") and json.loads(L(f"{tmp3}/data/private/instans.json")) == ins_foer and not g["instans_gendannet"], g)
# angreb
def angreb(poster, brug_zip=True):
    tm, em = miljo(); kor(em, "start"); fil = f"{tm}/a.zip"
    with zipfile.ZipFile(fil, "w") as zz:
        zz.writestr("settings/ok.json", "ok")
        for n, d in poster: zz.writestr(n, d)
    r = kor(em, "gendan", fil); udenfor = [p for p in (f"{tm}/ondt.txt", f"{tm}/data/ondt.txt", "/tmp/ondt-fo.txt") if os.path.exists(p)]
    return js(r), udenfor, tm
g, udenfor, tm = angreb([("../ondt.txt", "x"), ("/tmp/ondt-fo.txt", "x"), ("settings/../../ondt.txt", "x"), ("C:/ondt.txt", "x"), ("html/config.js", "x"), ("ugeplan-lib/config.php", "x"), ("../../etc/passwd", "x"), ("settings\\..\\..\\ondt.txt", "x")])
t("angreb: ../, absolutte stier, Windows-stier, ukendte mapper og kode-mapper afvises; kun den gyldige fil lægges ind", g["ok"] and g["filer"] == 1 and g["sprunget_over"] == 8 and not udenfor and L(f"{tm}/data/settings/ok.json") == "ok" and L(f"{tm}/html/config.js") != "x", (g, udenfor))
tm4, e4 = miljo(); kor(e4, "start"); tarf = f"{tm4}/s.tar"
with tarfile.open(tarf, "w") as tt:
    i = tarfile.TarInfo("settings/link"); i.type = tarfile.SYMTYPE; i.linkname = "/etc/passwd"; tt.addfile(i)
    i = tarfile.TarInfo("settings/hard"); i.type = tarfile.LNKTYPE; i.linkname = "/etc/passwd"; tt.addfile(i)
    d = b"ok"; i = tarfile.TarInfo("settings/god.json"); i.size = 2; tt.addfile(i, io.BytesIO(d))
g = js(kor(e4, "gendan", tarf))
t("angreb: symlinks og hardlinks i en tar ignoreres, almindelige filer lægges ind", g["ok"] and g["filer"] == 1 and not os.path.lexists(f"{tm4}/data/settings/link") and os.path.exists(f"{tm4}/data/settings/god.json"), g)
open(f"{tm4}/x.zip", "wb").write(b"ikke en zip"); r = kor(e4, "gendan", f"{tm4}/x.zip"); t("en fil, der hverken er zip eller tar, giver en forståelig fejl", r.returncode == 1 and "hverken" in js(r)["fejl"])
with zipfile.ZipFile(f"{tm4}/tom.zip", "w") as zz: pass
r = kor(e4, "gendan", f"{tm4}/tom.zip"); t("en tom sikkerhedskopi afvises", r.returncode == 1 and "tom" in js(r)["fejl"])
foer = L(f"{tm4}/data/private/instans.json")
with zipfile.ZipFile(f"{tm4}/ond.zip", "w") as zz: zz.writestr("private/instans.json", "{ikke json"); zz.writestr("settings/med.json", "m")
g = js(kor(e4, "gendan", f"{tm4}/ond.zip"))
t("en ødelagt instans.json i sikkerhedskopien lægges IKKE ned over den gode, og resten lægges ind med en advarsel", g["ok"] and g["instans_gendannet"] is False and "ugyldig" in g.get("advarsel", "") and L(f"{tm4}/data/private/instans.json") == foer and L(f"{tm4}/data/settings/med.json") == "m", g)
for navn, indhold in (("uden tokens", {"format": 1, "opsat": True, "tokens": {}, "pin": "1234", "sv": {"voksne": ["A"], "boern": [{"navn": "B", "calendar_id": 0}]}, "sted": {"lat": 1, "lon": 1, "tidszone": "UTC"}}),
                      ("forkert format", {"format": 2}), ("ugyldig PIN", {"format": 1, "opsat": True, "tokens": {k: "x" * 40 for k in ("read", "write", "cron", "gate")}, "pin": "x", "sv": {"voksne": ["A"], "boern": [{"navn": "B", "calendar_id": 0}]}, "sted": {"lat": 1, "lon": 1, "tidszone": "UTC"}}),
                      ("ugyldig sv", {"format": 1, "opsat": True, "tokens": {k: "x" * 40 for k in ("read", "write", "cron", "gate")}, "pin": "1234", "sv": {"voksne": [], "boern": []}, "sted": {"lat": 1, "lon": 1, "tidszone": "UTC"}})):
    with zipfile.ZipFile(f"{tm4}/x2.zip", "w") as zz: zz.writestr("private/instans.json", json.dumps(indhold))
    g = js(kor(e4, "gendan", f"{tm4}/x2.zip"))
    t(f"instans.json {navn} afvises", "ugyldig" in g.get("advarsel", "") and L(f"{tm4}/data/private/instans.json") == foer, g)
gyldig = json.loads(foer); gyldig["pin"] = "7777"
with zipfile.ZipFile(f"{tm4}/god.zip", "w") as zz: zz.writestr("private/instans.json", json.dumps(gyldig))
g = js(kor(e4, "gendan", f"{tm4}/god.zip"))
t("en gyldig instans.json fra en anden installation gendannes, og siderne renderes med den nye PIN", g["instans_gendannet"] and "advarsel" not in g and json.loads(L(f"{tm4}/data/private/instans.json"))["pin"] == "7777" and "'7777'" in L(f"{tm4}/html/login.php"), g)
# ødelagt instans.json ved opstart
tm5, e5 = miljo(); kor(e5, "start"); open(f"{tm5}/data/private/instans.json", "w").write("{ødelagt"); r = kor(e5, "start")
t("ødelagt instans.json ved opstart: tydelig fejl, ingen nye nøgler skrevet ovenpå", r.returncode != 0 and "ødelagt" in (r.stderr.decode() + r.stdout.decode()) and L(f"{tm5}/data/private/instans.json") == "{ødelagt")
raise SystemExit(0 if ok_all else 1)
