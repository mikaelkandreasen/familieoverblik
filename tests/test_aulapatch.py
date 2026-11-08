import asyncio, importlib, io, os, subprocess, sys, tempfile, textwrap, contextlib
_R = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); FH = os.path.join(_R, "tests", "fakehttpx"); sys.path.insert(0, FH); sys.path.insert(0, os.path.join(_R, "docker", "aula", "patch"))
os.environ["AULA_LOGIN_BEKRAEFT"] = "send"                # de ældre prøver tester forløbet, hvor tilføjelsen selv sender bekræftelsen (se test_aula_overdrag.py for standarden)
import httpx
import aula_login_forms as F
ok_all = True
def t(n, c, x=""):
    global ok_all; ok_all &= bool(c); print("ok  " if c else "FEJL", n, "" if c else x)

B = "https://broker.unilogin.dk/auth/realms/broker/login-actions/"
ROLLE_RADIO = f'''<html><body><h1>Vælg rolle</h1><form id="rolle" action="/auth/realms/broker/login-actions/post-broker-login?a=1&amp;b=2" method="post">
<input type="hidden" name="session_code" value="SC1"><input type="hidden" name="execution" value="EX1">
<input type="radio" name="selected-aktoer" value="MEDARBEJDER"> Medarbejder
<input type="radio" name="selected-aktoer" value="KONTAKT"> Kontaktperson
<input type="checkbox" name="husk" value="1"> Husk mig <input type="checkbox" name="nyhedsbrev" value="1" checked> Nyhedsbrev
<input type="text" name="ikke" value="v" disabled>
<input type="submit" name="login" value="Fortsæt"></form></body></html>'''
ROLLE_SELECT = '<form action="post-broker-login" method="post"><select name="selected-aktoer"><option value="MEDARBEJDER">M</option><option value="KONTAKT" selected>K</option></select><input type="hidden" name="execution" value="EX"></form>'
ROLLE_KNAPPER = '<form action="p" method="post"><input type="hidden" name="execution" value="EXK"><button name="selected-aktoer" value="MEDARBEJDER">Medarbejder</button><button name="selected-aktoer" value="KONTAKT">Kontaktperson</button></form>'
BEKR = '''<html><body><script>var x="skjult";</script><h1>Vilkår</h1><p>Du accepterer, at Aula må bruge dine oplysninger.</p>
<form action="/auth/realms/broker/login-actions/post-broker-login" method="post"><input type="hidden" name="execution" value="EX2" />
<button id="confirmation-button" name="confirmation" value="ACCEPT" type="submit">Acceptér</button><button type="submit" name="cancel" value="X">Annullér</button></form></body></html>'''
BEKR_UDEN_NAVN = '<form action="b" method="post"><input type="hidden" name="execution" value="EX3"><button id="confirmation-button" type="submit">Acceptér</button></form>'
SAML = '<html><body onload="document.forms[0].submit()"><form method="post" action="https://login.aula.dk/simplesaml/module.php/saml/sp/saml2-acs.php/default-sp"><input type="hidden" name="SAMLResponse" value="PHNhbWw+"><input type="hidden" name="RelayState" value="r"></form></body></html>'

log = []
def server(pages):
    def f(req, kw):
        log.append((req.method, str(req.url), dict(req.data) if req.data else None, dict(req.headers)))
        return pages(req, kw)
    return f
def kæde(rolle=ROLLE_RADIO, bekr=BEKR, slut=SAML):
    def pages(req, kw):
        u = str(req.url)
        if req.method == "GET": return httpx.Response(u, text=rolle)
        d = req.data or {}
        if "selected-aktoer" in d: return httpx.Response(B + "post-broker-login?step=2", text=bekr)
        if any(k in d for k in ("confirmation", "execution")): return httpx.Response("https://login.aula.dk/x", text=slut)
        return httpx.Response(u, text="uventet")
    return pages
def koer(pages, url=B + "post-broker-login?x=1", sync=False, **kw):
    httpx.SERVER = server(pages); log.clear()
    c = httpx.Client() if sync else httpx.AsyncClient()
    r = c.build_request("GET", url)
    err = io.StringIO()
    with contextlib.redirect_stderr(err):
        resp = c.send(r, **kw) if sync else asyncio.run(c.send(r, **kw))
    return resp, err.getvalue()

t("install lægger sig i httpx (én gang)", F.install(httpx) is True and F.install(httpx) is False)
os.environ.pop("AULA_AKTOER", None); os.environ.pop("AULA_ACCEPT_FELT", None)

# ── hele kæden ──
for sync in (False, True):
    r, err = koer(kæde(), sync=sync)
    navn = "synkron" if sync else "asynkron"
    t(f"[{navn}] kæden: rolle → bekræftelse → SAML-siden kommer retur", "SAMLResponse" in r.text and len(log) == 3, [l[:2] for l in log])
    rolle, bekr = log[1], log[2]
    t(f"[{navn}] rolle: POST til den afkodede og opløste adresse, selected-aktoer=KONTAKT, skjulte felter og afkrydset boks med", rolle[0] == "POST" and rolle[1] == "https://broker.unilogin.dk/auth/realms/broker/login-actions/post-broker-login?a=1&b=2"
      and rolle[2]["selected-aktoer"] == "KONTAKT" and rolle[2]["session_code"] == "SC1" and rolle[2]["execution"] == "EX1" and rolle[2]["nyhedsbrev"] == "1", rolle)
    t(f"[{navn}] rolle: uafkrydset boks og deaktiveret felt udelades, enlig sendeknap med", "husk" not in rolle[2] and "ikke" not in rolle[2] and rolle[2]["login"] == "Fortsæt")
    t(f"[{navn}] bekræftelse: knappens eget navn/værdi (confirmation=ACCEPT) og skjult felt sendes, Annullér-knappen IKKE", bekr[2] == {"execution": "EX2", "confirmation": "ACCEPT"}, bekr[2])
    t(f"[{navn}] Referer og Origin sættes", rolle[3]["Referer"].startswith(B) and rolle[3]["Origin"] == "https://broker.unilogin.dk")
    t(f"[{navn}] loggen siger, hvad der blev valgt og accepteret, med siden tekst (uden script)", "vælger rollen KONTAKT" in err and "accepterer bekræftelsessiden" in err and "Du accepterer, at Aula må bruge" in err and "skjult" not in err, err)
    t(f"[{navn}] loggen viser felternes NAVNE, ikke værdierne (koder)", "confirmation" in err and "EX2" not in err and "SC1" not in err)

# ── variationer af rolleformularen ──
r, _ = koer(kæde(rolle=ROLLE_SELECT)); t("rolle som <select>", log[1][2]["selected-aktoer"] == "KONTAKT" and log[1][2]["execution"] == "EX")
r, _ = koer(kæde(rolle=ROLLE_KNAPPER)); t("rolle som én knap pr. rolle", log[1][2] == {"execution": "EXK", "selected-aktoer": "KONTAKT"}, log[1][2])
os.environ["AULA_AKTOER"] = "medarbejder"
r, _ = koer(kæde()); t("AULA_AKTOER vælger en anden rolle (store/små bogstaver er ligegyldige)", log[1][2]["selected-aktoer"] == "MEDARBEJDER")
os.environ["AULA_AKTOER"] = "ELEV"
try: koer(kæde()); t("manglende rolle giver fejl", False)
except RuntimeError as e: t("manglende rolle: fejl med listen over roller og råd om AULA_AKTOER", "KONTAKT" in str(e) and "MEDARBEJDER" in str(e) and "AULA_AKTOER" in str(e), str(e))
os.environ.pop("AULA_AKTOER")
# ── bekræftelse uden navn ──
r, _ = koer(kæde(bekr=BEKR_UDEN_NAVN)); t("bekræftelsesknap uden navn: kun skjulte felter", log[2][2] == {"execution": "EX3"}, log[2][2])
os.environ["AULA_ACCEPT_FELT"] = "confirmation = ACCEPT"
r, _ = koer(kæde(bekr=BEKR_UDEN_NAVN)); t("AULA_ACCEPT_FELT tilføjer det manglende felt", log[2][2] == {"execution": "EX3", "confirmation": "ACCEPT"}, log[2][2])
os.environ.pop("AULA_ACCEPT_FELT")
# ── kun bekræftelse (ingen rolleside) ──
r, _ = koer(lambda req, kw: httpx.Response(str(req.url), text=BEKR) if req.method == "GET" else httpx.Response("https://login.aula.dk/x", text=SAML))
t("kun en bekræftelsesside: den accepteres", "SAMLResponse" in r.text and len(log) == 2)

# ── det der IKKE må røres ──
r, err = koer(lambda req, kw: httpx.Response(str(req.url), text=SAML))
t("SAML-siden (SAMLResponse) røres ikke og intet sendes", len(log) == 1 and "SAMLResponse" in r.text and err == "")
r, _ = koer(kæde(), url="https://anden-vaert.dk/post-broker-login"); t("andre værter røres ikke", len(log) == 1 and "selected-aktoer" in r.text)
r, _ = koer(lambda req, kw: httpx.Response(str(req.url), status=302, text=ROLLE_RADIO, location="/x")); t("ikke-200 røres ikke", len(log) == 1 and r.status_code == 302)
r, _ = koer(lambda req, kw: httpx.Response(str(req.url), text='{"a":"selected-aktoer"}', ctype="application/json")); t("JSON røres ikke", len(log) == 1)
r, _ = koer(kæde(), stream=True); t("stream=True røres ikke", len(log) == 1)
r, _ = koer(lambda req, kw: httpx.Response(str(req.url), text="<p>ingen formular</p>")); t("sider uden formular røres ikke", len(log) == 1)
# ── sløjfebeskyttelse ──
r, err = koer(lambda req, kw: httpx.Response(B + "post-broker-login", text=ROLLE_RADIO))
t("samme rolleside igen og igen: stopper efter ét forsøg og giver siden tilbage", len(log) == 2 and "kom igen efter afsendelse" in err, (len(log), err))
sider = [ROLLE_RADIO, BEKR, ROLLE_SELECT.replace("post-broker-login", "r2"), BEKR.replace("post-broker-login", "b2"), ROLLE_KNAPPER.replace('"p"', '"r3"'), SAML]
tæller = {"i": 0}
def mange(req, kw):
    i = tæller["i"]; tæller["i"] += 1; return httpx.Response(f"https://login.aula.dk/{i}", text=sider[min(i, len(sider) - 1)])
tæller["i"] = 0; r, _ = koer(mange); t(f"højst {F.MAX_HOP} sendinger i træk", len(log) <= 1 + F.MAX_HOP, len(log))

# ── enhedsfunktioner ──
forms, tekst = F.laes_formularer(BEKR)
t("laes_formularer: én formular, to knapper, scripttekst udeladt", len(forms) == 1 and len(forms[0]["kontroller"]) == 3 and "skjult" not in tekst and "Vilkår" in tekst)
t("er_bekraeftelse via værdien ACCEPT på en sendeknap (uden id)", F.er_bekraeftelse(F.laes_formularer('<form><button name="x" value="accept">A</button></form>')[0][0]))
t("er_bekraeftelse: ikke en vilkårlig knap", not F.er_bekraeftelse(F.laes_formularer('<form><button name="x" value="Gem">A</button></form>')[0][0]))
t("planlaeg: tom side → None", F.planlaeg("", "https://broker.unilogin.dk/x") is None)

# ── sitecustomize og tjek_login som rigtige processer ──
patch = os.path.join(_R, "docker", "aula", "patch")
def py(kode, env_extra):
    env = {**os.environ, "PYTHONPATH": f"{patch}:{FH}", **env_extra}
    r = subprocess.run([sys.executable, "-c", kode], capture_output=True, text=True, env=env)
    return r.stdout.strip(), r.stderr.strip()
o, e = py("import httpx; print(getattr(httpx,'_familieoverblik_aula_forms',False))", {})
t("sitecustomize aktiverer tilføjelsen som standard", o == "True", (o, e))
o, e = py("import httpx; print(getattr(httpx,'_familieoverblik_aula_forms',False))", {"AULA_LOGIN_PATCH": "0"})
t("AULA_LOGIN_PATCH=0 slår den fra", o == "False", (o, e))
env2 = {**os.environ, "PYTHONPATH": patch}
r = subprocess.run([sys.executable, "-c", "print('ok uden httpx')"], capture_output=True, text=True, env={k: v for k, v in env2.items()})
t("uden httpx i Python sker der ingenting (og ingen fejl)", r.stdout.strip() == "ok uden httpx" and r.stderr.strip() == "", r.stderr)
# tjek_login mod en falsk aula-pakke
d = tempfile.mkdtemp(); os.makedirs(f"{d}/aula/auth")
open(f"{d}/aula/__init__.py", "w").write("")
open(f"{d}/aula/auth/mitid_client.py", "w").write("x=1\n# post-broker-login\nrolle = 'selected-aktoer'\n")
r = subprocess.run([sys.executable, f"{patch}/tjek_login.py"], capture_output=True, text=True, env={**os.environ, "PYTHONPATH": f"{d}:{FH}:{patch}"})
t("tjek_login: finder nøgleordene i biblioteket og siger det", "selected-aktoer" in r.stdout and "auth/mitid_client.py:3" in r.stdout and "Biblioteket nævner selv" in r.stdout and "tilføjelsen aktiv: True" in r.stdout, r.stdout[-400:])
d2 = tempfile.mkdtemp(); os.makedirs(f"{d2}/aula"); open(f"{d2}/aula/__init__.py", "w").write("x=1\n")
r = subprocess.run([sys.executable, f"{patch}/tjek_login.py"], capture_output=True, text=True, env={**os.environ, "PYTHONPATH": f"{d2}:{FH}:{patch}"})
t("tjek_login: biblioteket kender ikke siderne → siger at tilføjelsen klarer dem", "kender ikke rolle- eller bekræftelsessiden" in r.stdout, r.stdout[-300:])
sys.exit(0 if ok_all else 1)
