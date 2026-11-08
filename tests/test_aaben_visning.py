"""Åben visning (Opsætning → Login og sikkerhed): forsiden kan ses uden PIN, alt andet kræver stadig PIN.
Apache og PHP kan ikke køres her. Derfor læses den .htaccess, opstarten skriver ud, af en lille tolker (RewriteCond/RewriteRule, som filen bruger), og PHP-reglen i gate.php spejles i Python efter den kildetekst, der står i filen."""
import importlib.util, json, os, re, shutil, subprocess, sys, tarfile, tempfile
ROD = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BOOT = os.path.join(ROD, "docker", "web", "bootstrap.py")
ok_all = True
def t(n, c, x=""):
    global ok_all; ok_all &= bool(c); print("ok  " if c else "FEJL", n, "" if c else x)
spec = importlib.util.spec_from_file_location("b", BOOT); B = importlib.util.module_from_spec(spec); spec.loader.exec_module(B)

def miljo():
    tmp = tempfile.mkdtemp(prefix="fo-av-"); sk = os.path.join(tmp, "skabelon"); os.makedirs(sk)
    for a, b in (("public_html", "html"), ("ugeplan-lib", "lib"), ("ugeplan-data", "data")): shutil.copytree(os.path.join(ROD, a), os.path.join(sk, b))
    shutil.copyfile(os.path.join(ROD, "docker", "aula", "config-skabelon.py"), os.path.join(sk, "aula-config.py"))
    for f in ("CHANGELOG.md", "VERSION"): shutil.copyfile(os.path.join(ROD, f), os.path.join(sk, f))
    return tmp, {**os.environ, "FO_SKABELON": sk, "FO_HTML": f"{tmp}/html", "FO_LIB": f"{tmp}/lib", "FO_DATA": f"{tmp}/data", "FO_AULA_CONFIG": f"{tmp}/data/private/aula-config", "FO_BRUGER": "findes-ikke"}
def kor(e, *a, stdin=None): return subprocess.run([sys.executable, BOOT, *a], input=stdin, capture_output=True, env=e)
def js(r): return json.loads(r.stdout.decode().strip().splitlines()[-1])
L = lambda p: open(p, encoding="utf-8").read()
tmp, e = miljo(); H, D, LIB = f"{tmp}/html", f"{tmp}/data", f"{tmp}/lib"
kor(e, "start"); kode = json.load(open(f"{D}/private/instans.json"))["opsaetningskode"]
r = kor(e, "anvend", stdin=json.dumps({"kode": kode, "sv": {"voksne": ["Anna"], "boern": [{"navn": "Sofie"}]}, "pin": "4711"}).encode())
gate = json.load(open(f"{D}/private/instans.json"))["tokens"]["gate"]

# ── tolker for .htaccess ──
def afgoer(htaccess, sti, metode="GET", cookie=""):
    """Hvad sker der med en forespørgsel? 'pass', 'F' (403), ('intern', mål) eller ('R302', mål). Tolker kun de direktiver, filen bruger."""
    conds = []; sti = sti.lstrip("/")
    for linje in htaccess.split("\n"):
        l = linje.strip()
        if l.startswith("RewriteCond"):
            m = re.match(r"RewriteCond %\{(\w+(?::[\w-]+)?)\} (!?)(\S+)(?: \[(.*)\])?$", l)
            if not m: raise ValueError("ukendt RewriteCond: " + l)
            var, neg, pat, fl = m.groups(); vaerdi = {"HTTP_COOKIE": cookie, "REQUEST_METHOD": metode, "HTTPS": "off", "HTTP:X-Forwarded-Proto": ""}[var]
            pat = pat[1:] if pat.startswith("=") and var == "HTTPS" else pat
            flag = re.I if fl and "NC" in fl else 0
            hit = (vaerdi == pat[1:]) if pat.startswith("=") else bool(re.search(pat, vaerdi, flag))
            conds.append(hit != bool(neg))
        elif l.startswith("RewriteRule"):
            m = re.match(r"RewriteRule (\S+) (\S+)(?: \[(.*)\])?$", l)
            pat, subst, fl = m.group(1), m.group(2), (m.group(3) or "")
            if all(conds) and re.search(pat, sti):
                if "F" in fl.split(","): return "F"
                if "R=302" in fl: return ("R302", subst)
                if subst != "-": return ("intern", re.sub(r"\$1", (re.search(pat, sti).group(1) or "") if re.search(pat, sti).groups() else "", subst))
            conds = []
        elif l and not l.startswith("#"): conds = conds if l.startswith("RewriteEngine") or l.startswith("<") else conds
    return "pass"
lukket = L(f"{H}/.htaccess"); c_ok = f"ugeplan_ok={gate}"
SIDER = ("index.html", "overblik.html", "billeder.html", "gaest-wifi.html", "vaelger.html", "backlog.html")
PHP_COOKIE = ("indkob", "elpris", "strava", "tegneserie", "billeder", "bil", "info", "tema", "wifi", "joke", "vejr", "sprog", "oversaet", "sikkerhedskopi", "totp", "backlog", "kalendere")
t("uden åben visning: alle sider (og roden) sender til login uden cookie, og slipper igennem med cookie", all(afgoer(lukket, s)[0] == "intern" and afgoer(lukket, s)[1].startswith("login.php?to=") for s in SIDER + ("",)) and all(afgoer(lukket, s, cookie=c_ok) == "pass" for s in SIDER + ("",)))
t("uden åben visning: alle endpoints og config.js giver 403 uden cookie (GET og POST), og slipper igennem med cookie", all(afgoer(lukket, f"{n}.php", m) == "F" for n in PHP_COOKIE for m in ("GET", "POST")) and afgoer(lukket, "config.js") == "F" and all(afgoer(lukket, f"{n}.php", m, c_ok) == "pass" for n in PHP_COOKIE for m in ("GET", "POST")) and afgoer(lukket, "config.js", cookie=c_ok) == "pass")
t("login.php, start.html, sw.js, manifestet og ikoner er altid åbne (ellers kan man ikke logge ind)", all(afgoer(lukket, s) == "pass" for s in ("login.php", "start.html", "sw.js", "manifest.webmanifest", "icons/icon-192.png", "sprog.js", "affald.js", "qr.js")))
t("filtyper, der aldrig skal kunne hentes (.json, .md, .py, .bak …) giver 403, også med cookie", all(afgoer(lukket, f, cookie=c_ok) == "F" for f in ("data.json", "CHANGELOG.md", "x.py", "overblik.html.bak", "overblik.html.bak-2026-09-08", "ugeplan-data/private/instans.json")))
t("standardindstillingen er «laast», og gate.php siger «nej» til åben visning", js(kor(e, "laes"))["adgang"] == "laast" and "const GATE_AABEN_VISNING = 'nej';" in L(f"{LIB}/gate.php"))
# ── åben visning ──
r = kor(e, "anvend", stdin=json.dumps({"adgang": "aaben_visning"}).encode()); kor(e, "render")
åben = L(f"{H}/.htaccess")
t("«aaben_visning» kan slås til, vises i indstillingerne, og gate.php siger «ja»", r.returncode == 0 and js(kor(e, "laes"))["adgang"] == "aaben_visning" and "const GATE_AABEN_VISNING = 'ja';" in L(f"{LIB}/gate.php"), (r.stdout + r.stderr).decode()[-300:])
t("åben visning, uden cookie: roden går til forsiden (302), og forsiden og vælgeren er åbne", afgoer(åben, "") == ("R302", "overblik.html") and afgoer(åben, "overblik.html") == "pass" and afgoer(åben, "vaelger.html") == "pass")
t("åben visning, uden cookie: indstillinger, billeder-siden, gæste-wifi og backlog kræver stadig PIN (sendes til login)", all(afgoer(åben, s)[0] == "intern" and afgoer(åben, s)[1] == f"login.php?to={s}" for s in ("index.html", "billeder.html", "gaest-wifi.html", "backlog.html")), [afgoer(åben, s) for s in ("index.html", "billeder.html")])
LAES = ("vejr", "tema", "joke", "elpris", "bil", "info", "sprog", "tegneserie", "strava", "indkob", "billeder")
t("åben visning, uden cookie: de scripts, forsiden bruger, kan LÆSES (GET og HEAD), men ikke skrives (POST, PUT, DELETE giver 403)", all(afgoer(åben, f"{n}.php", m) == "pass" for n in LAES for m in ("GET", "HEAD")) and all(afgoer(åben, f"{n}.php", m) == "F" for n in LAES for m in ("POST", "PUT", "DELETE", "PATCH")))
t("åben visning: config.js kan læses uden PIN (forsiden skal bruge nøglen), men ikke skrives", afgoer(åben, "config.js") == "pass" and afgoer(åben, "config.js", "POST") == "F")
t("åben visning: alt andet kræver stadig PIN-cookien, uanset metode (kalendere, wifi, oversættelse, sikkerhedskopi, totrinsbekræftelse, backlog)", all(afgoer(åben, f"{n}.php", m) == "F" for n in ("kalendere", "wifi", "oversaet", "sikkerhedskopi", "totp", "backlog") for m in ("GET", "POST")))
t("åben visning, med cookie: alt virker som før", all(afgoer(åben, s, cookie=c_ok) == "pass" for s in SIDER) and all(afgoer(åben, f"{n}.php", m, c_ok) == "pass" for n in PHP_COOKIE for m in ("GET", "POST")) and afgoer(åben, "config.js", "POST", c_ok) == "pass")
t("åben visning: de forbudte filtyper er stadig forbudt", all(afgoer(åben, f) == "F" for f in ("CHANGELOG.md", "x.py", "overblik.html.bak", "ugeplan-data/private/instans.json")))
t("kun reglerne for forsiden er ændret: åben og lukket .htaccess adskiller sig præcis ved side-reglen, de 11 læsninger og config.js", len(åben.split("\n")) - len(lukket.split("\n")) == 3 + 12 and åben.count("RewriteCond %{REQUEST_METHOD} !^(GET|HEAD)$") == 12, (len(åben.split("\n")), len(lukket.split("\n"))))
# gate.php: nøjagtig den samme liste som .htaccess og opstarten
gsrc = L(f"{LIB}/gate.php")
tabel = dict((m.group(1), [x for x in re.findall(r"'([^']*)'", m.group(2))]) for m in re.finditer(r"'([a-z]+\.php)' => \[([^\]]*)\]", gsrc[gsrc.index("GATE_AABNE_LAESNINGER"):gsrc.index("/** Har browseren")]))
t("listen over åbne læsninger i gate.php indeholder præcis de scripts, .htaccess åbner og bootstrap.AABNE_PHP kender", set(tabel) == {f"{n}.php" for n in LAES} == {f"{n}.php" for n in B.AABNE_PHP}, sorted(tabel))
# PHP-reglen (spejlet): gate_aaben_laesning
def php_aaben(aaben, metode, script, action):
    if aaben != "ja": return False
    if metode not in ("GET", "HEAD"): return False
    tilladt = tabel.get(os.path.basename(script))
    return tilladt is not None and action in tilladt
t("PHP-reglen: slået fra giver aldrig adgang uden cookie", not any(php_aaben("nej", "GET", f"/{s}", a) for s, v in tabel.items() for a in v))
t("PHP-reglen: slået til åbner præcis de tilladte (script, handling) i GET, og ingen anden handling", all(php_aaben("ja", "GET", f"/{s}", a) for s, v in tabel.items() for a in v) and not php_aaben("ja", "GET", "/vejr.php", "sog") and not php_aaben("ja", "GET", "/strava.php", "") and not php_aaben("ja", "GET", "/strava.php", "forbind") and not php_aaben("ja", "GET", "/indkob.php", "") and not php_aaben("ja", "GET", "/billeder.php", "upload") and php_aaben("ja", "GET", "/vejr.php", ""))
t("PHP-reglen: POST åbner aldrig noget, og scripts uden for listen (kalendere, wifi, instans, sikkerhedskopi …) forbliver lukkede", not any(php_aaben("ja", m, f"/{s}", a) for s, v in tabel.items() for a in v for m in ("POST", "PUT", "DELETE")) and not any(php_aaben("ja", "GET", f"/{s}", a) for s in ("kalendere.php", "wifi.php", "instans.php", "sikkerhedskopi.php", "oversaet.php", "totp.php", "backlog.php", "hent.php", "api.php", "login.php") for a in ("", "liste", "items", "hent")))
t("PHP-reglen: stier som /undermappe/vejr.php eller vejr.php/ekstra regnes efter scriptets navn, og forfalskede navne (xvejr.php) åbner ikke", php_aaben("ja", "GET", "/a/b/vejr.php", "") and not php_aaben("ja", "GET", "/xvejr.php", "") and not php_aaben("ja", "GET", "/vejr.php.bak", ""))
t("gate_ok() er cookie ELLER åben læsning, og alle scripts bruger gate_ok() (ingen har deres egen cookie-kontrol uden om)", "return gate_cookie_ok() || gate_aaben_laesning();" in gsrc and all("gate_ok()" in L(os.path.join(H, f"{n}.php")) for n in LAES) and not any(re.search(r"\$_COOKIE\['ugeplan_ok'\]", L(os.path.join(H, f"{n}.php"))) for n in LAES + ("kalendere", "wifi", "totp", "backlog")))
# ── validering og sikkerhedskopi ──
t("en ugyldig adgang afvises med en forklaring og ændrer ingenting", (lambda r: r.returncode == 1 and "aaben_visning" in js(r)["fejl"])(kor(e, "anvend", stdin=json.dumps({"adgang": "alle"}).encode())) and js(kor(e, "laes"))["adgang"] == "aaben_visning")
t("adgangen ændres ikke af en rettelse af andet (fx navne), og slås fra igen", (kor(e, "anvend", stdin=json.dumps({"sted": {"lat": 56.1, "lon": 10.2, "tidszone": "Europe/Copenhagen"}}).encode()), js(kor(e, "laes"))["adgang"])[1] == "aaben_visning" and (kor(e, "anvend", stdin=json.dumps({"adgang": "laast"}).encode()), kor(e, "render"), L(f"{H}/.htaccess") == lukket)[2])
kor(e, "anvend", stdin=json.dumps({"adgang": "aaben_visning"}).encode()); kor(e, "render")
bk = f"{tmp}/kopi.tar.gz"; open(bk, "wb").write(kor(e, "backup").stdout)
tmp2, e2 = miljo(); kor(e2, "start"); rg = kor(e2, "gendan", bk)
t("sikkerhedskopien tager indstillingen med, og en gendannet installation er i åben visning (og har den rigtige .htaccess)", rg.returncode == 0 and js(kor(e2, "laes"))["adgang"] == "aaben_visning" and "RewriteRule ^$ overblik.html [R=302,L]" in L(f"{tmp2}/html/.htaccess"), (rg.stdout + rg.stderr).decode()[-300:])
# ── en ændret skabelon giver en tydelig fejl i stedet for en forkert adgang ──
ben = False
try: B.aaben_visning_htaccess("RewriteEngine On\n# ingen regler\n")
except B.Fejl as ex: ben = "side-reglen" in str(ex)
t("hvis skabelonen ikke ligner det forventede (en regel er omdøbt), kaster åben visning en fejl i stedet for at give en forkert adgang", ben)
raise SystemExit(0 if ok_all else 1)
