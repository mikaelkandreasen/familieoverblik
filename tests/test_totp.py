"""Prøver totrinsbekræftelsen (TOTP) i docker/web/bootstrap.py: RFC 6238-testvektorer og hele forløbet (start, bekræft, tjek, fra, koder, husk, alle-ud)."""
import base64, hashlib, hmac, importlib.util, json, os, re, shutil, subprocess, sys, tempfile, time
ROD = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BOOT = os.path.join(ROD, "docker", "web", "bootstrap.py")
ok_all = True
def t(n, c, x=""):
    global ok_all; ok_all &= bool(c); print("ok  " if c else "FEJL", n, "" if c else x)
spec = importlib.util.spec_from_file_location("bootstrap", BOOT); B = importlib.util.module_from_spec(spec); spec.loader.exec_module(B)
# ── RFC 6238 (SHA-1, 20 byte hemmelighed «12345678901234567890») ──
SECRET = base64.b32encode(b"12345678901234567890").decode().rstrip("=")
t("hemmeligheden i base32 er GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", SECRET == "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ")
for tid, otte in ((59, "94287082"), (1111111109, "07081804"), (1111111111, "14050471"), (1234567890, "89005924"), (2000000000, "69279037"), (20000000000, "65353130")):
    t(f"RFC 6238 vektor ved t={tid}: 8 cifre {otte}, 6 cifre {otte[-6:]}", B.hotp(SECRET, tid // 30, 8) == otte and B.hotp(SECRET, tid // 30, 6) == otte[-6:])
t("RFC 4226 vektor (HOTP, tæller 0 til 9)", [B.hotp(SECRET, c) for c in range(10)] == ["755224", "287082", "359152", "969429", "338314", "254676", "287922", "162583", "399871", "520489"])
t("base32 tåler små bogstaver og manglende udfyldningstegn", B.hotp(SECRET.lower(), 1) == B.hotp(SECRET, 1))
# ── vindue og genbrug ──
tid = 1111111109; kode = B.hotp(SECRET, tid // 30)
t("rigtig kode accepteres, og tælleren returneres", B.tjek_totp(SECRET, kode, -1, tid) == tid // 30)
t("mellemrum i koden er ligegyldige, forkert længde og bogstaver afvises", B.tjek_totp(SECRET, kode[:3] + " " + kode[3:], -1, tid) == tid // 30 and B.tjek_totp(SECRET, kode[:5], -1, tid) is None and B.tjek_totp(SECRET, "abcdef", -1, tid) is None and B.tjek_totp(SECRET, None, -1, tid) is None)
t("vindue: ét skridt før og efter accepteres (urene går skævt), to skridt gør ikke", B.tjek_totp(SECRET, kode, -1, tid + 30) == tid // 30 and B.tjek_totp(SECRET, kode, -1, tid - 30) == tid // 30 and B.tjek_totp(SECRET, kode, -1, tid + 61) is None and B.tjek_totp(SECRET, kode, -1, tid - 61) is None)
t("genbrug: samme eller ældre tæller afvises, en nyere accepteres", B.tjek_totp(SECRET, kode, tid // 30, tid) is None and B.tjek_totp(SECRET, kode, tid // 30 + 5, tid) is None and B.tjek_totp(SECRET, kode, tid // 30 - 1, tid) == tid // 30)
t("forkert kode afvises", B.tjek_totp(SECRET, "000000" if kode != "000000" else "111111", -1, tid) is None)
# ── gendannelseskoder ──
koder, hashes = B.ny_gendannelseskoder()
t("8 gendannelseskoder på formen abcd-efgh uden tegn, der ligner hinanden, alle forskellige, og kun hashes gemmes", len(koder) == 8 and len(set(koder)) == 8 and all(re.fullmatch(r"[a-hj-km-np-z2-9]{4}-[a-hj-km-np-z2-9]{4}", k) for k in koder) and all(len(h) == 64 for h in hashes) and not any(k.replace("-", "") in "".join(hashes) for k in koder))
t("gendannelseskoder normaliseres (store bogstaver, mellemrum, uden bindestreg)", B.gendan_hash(koder[0]) == B.gendan_hash(koder[0].upper()) == B.gendan_hash(koder[0].replace("-", "")) == B.gendan_hash(" " + koder[0] + " "))
# ── hele forløbet som en rigtig proces ──
def miljo():
    tmp = tempfile.mkdtemp(prefix="fo-t-"); sk = os.path.join(tmp, "skabelon"); os.makedirs(sk)
    shutil.copytree(os.path.join(ROD, "public_html"), os.path.join(sk, "html")); shutil.copytree(os.path.join(ROD, "ugeplan-lib"), os.path.join(sk, "lib")); shutil.copytree(os.path.join(ROD, "ugeplan-data"), os.path.join(sk, "data"))
    shutil.copyfile(os.path.join(ROD, "docker", "aula", "config-skabelon.py"), os.path.join(sk, "aula-config.py"))
    for f in ("CHANGELOG.md", "VERSION"): shutil.copyfile(os.path.join(ROD, f), os.path.join(sk, f))
    return tmp, {**os.environ, "FO_SKABELON": sk, "FO_HTML": f"{tmp}/html", "FO_LIB": f"{tmp}/lib", "FO_DATA": f"{tmp}/data", "FO_AULA_CONFIG": f"{tmp}/data/private/aula-config", "FO_BRUGER": "findes-ikke"}
tmp, e = miljo(); H, D = f"{tmp}/html", f"{tmp}/data"
def kor(*a, stdin=None, nu=None):
    env = {**e, **({"FO_NU": str(nu)} if nu is not None else {})}
    return subprocess.run([sys.executable, BOOT, *a], input=stdin, capture_output=True, env=env)
def js(r): return json.loads(r.stdout.decode().strip().splitlines()[-1])
L = lambda p: open(p, encoding="utf-8").read()
kor("start"); kode0 = json.loads(L(f"{D}/private/instans.json"))["opsaetningskode"]
kor("anvend", stdin=json.dumps({"kode": kode0, "sv": {"voksne": ["Anna"], "boern": [{"navn": "Sofie"}]}, "pin": "4711"}).encode())
gate0 = json.loads(L(f"{D}/private/instans.json"))["tokens"]["gate"]
r = kor("totp", "alle-ud", stdin=b"{}"); gate_ud = js(r)["ny_gate"]
t("«Log alle enheder ud» virker også uden totrinsbekræftelse og bytter adgangscookien", r.returncode == 0 and gate_ud != gate0 and gate_ud in L(f"{H}/.htaccess") and not os.path.exists(f"{D}/private/totp.json"))
gate0 = gate_ud
r = js(kor("totp", "status")); t("status: slået fra fra start", r == {"aktiv": False, "gendannelse_tilbage": 0, "husk_dage": 90}, r)
N = 1_800_000_000
r = kor("totp", "tjek", stdin=b'{"kode":"123456"}', nu=N); t("tjek, mens det er slået fra, afvises med en forklaring", r.returncode == 1 and "ikke slået til" in js(r)["fejl"])
r = js(kor("totp", "start", stdin=b"{}", nu=N)); secret = r["secret"]
t("start: en ny 32-tegns base32-hemmelighed og en otpauth-adresse med appens navn, SHA1, 6 cifre og 30 sekunder", re.fullmatch(r"[A-Z2-7]{32}", secret) and r["uri"] == f"otpauth://totp/Familieoverblik?secret={secret}&issuer=Familieoverblik&algorithm=SHA1&digits=6&period=30", r)
t("start: hemmeligheden gemmes med rettighed 660, men er endnu IKKE slået til", oct(os.stat(f"{D}/private/totp.json").st_mode & 0o777) == "0o660" and js(kor("totp", "status"))["aktiv"] is False)
t("start to gange giver en ny hemmelighed (den gamle kan ikke bruges)", js(kor("totp", "start", stdin=b"{}", nu=N))["secret"] != secret)
r = kor("totp", "start", stdin=b"[]", nu=N)
t("«start» med [] som krop virker: det er det, totp.php sender, når «handling» var det eneste felt (PHP gør et tomt array til [], ikke {}). Fejlen var «Forespørgslen skal være JSON»", r.returncode == 0 and "secret" in js(r), (r.stdout + r.stderr).decode()[-200:])
r = kor("totp", "fra", stdin=b"[]", nu=N)
t("andre handlinger med [] giver en forklaring på det, der mangler, og ikke «skal være JSON»", r.returncode == 1 and "JSON" not in js(r)["fejl"], js(r))
r = kor("totp", "start", stdin=b"[1, 2]", nu=N)
t("en liste med noget i er stadig ikke en forespørgsel (afvises som JSON-fejl)", r.returncode == 1 and "skal være JSON" in js(r)["fejl"], js(r))
secret = json.loads(L(f"{D}/private/totp.json"))["afventer"]["secret"]
r = kor("totp", "bekraeft", stdin=b'{"kode":"000000"}', nu=N); t("bekræft med forkert kode afvises, og intet slås til", r.returncode == 1 and "passer ikke" in js(r)["fejl"] and js(kor("totp", "status"))["aktiv"] is False)
r = kor("totp", "bekraeft", stdin=json.dumps({"kode": B.hotp(secret, N // 30)}).encode(), nu=N + AFV if (AFV := 901) else N); t("bekræft efter 15 minutter er udløbet", r.returncode == 1 and "udløbet" in js(r)["fejl"])
r = js(kor("totp", "bekraeft", stdin=json.dumps({"kode": B.hotp(secret, N // 30)}).encode(), nu=N))
t("bekræft med rigtig kode: slået til, 8 gendannelseskoder returneres (kun denne ene gang), og en ny adgangscookie", r["ok"] and len(r["gendannelseskoder"]) == 8 and len(r["ny_gate"]) == 40 and r["ny_gate"] != gate0, r)
tf = json.loads(L(f"{D}/private/totp.json"))
t("filen har nu hemmelighed, hashes (ikke koderne), enhedsnøgle, sidste tæller og 90 dages husk", tf["aktiv"] is True and tf["secret"] == secret and len(tf["gendannelse"]) == 8 and not any(k.replace("-", "") in json.dumps(tf) for k in r["gendannelseskoder"]) and len(tf["enhedsnoegle"]) == 64 and tf["sidste"] == N // 30 and tf["husk_dage"] == 90 and "afventer" not in tf)
ny_gate = r["ny_gate"]; koder = r["gendannelseskoder"]
t("adgangscookien er byttet i instans.json, .htaccess og gate.php (alle enheder skal logge ind igen)", json.loads(L(f"{D}/private/instans.json"))["tokens"]["gate"] == ny_gate and ny_gate in L(f"{H}/.htaccess") and gate0 not in L(f"{H}/.htaccess") and ny_gate in L(f"{tmp}/lib/gate.php") and gate0 not in L(f"{tmp}/lib/gate.php"))
t("de øvrige nøgler og PIN er uændrede", json.loads(L(f"{D}/private/instans.json"))["pin"] == "4711")
t("status: slået til med 8 gendannelseskoder tilbage", js(kor("totp", "status")) == {"aktiv": True, "gendannelse_tilbage": 8, "husk_dage": 90})
t("start, mens det er slået til, afvises", kor("totp", "start", stdin=b"{}", nu=N).returncode == 1)
# tjek (login)
r = kor("totp", "tjek", stdin=json.dumps({"kode": B.hotp(secret, N // 30 + 1)}).encode(), nu=N + 30); t("tjek: rigtig kode (næste skridt) accepteres som «totp»", js(r)["ok"] and js(r)["type"] == "totp" and js(r)["gendannelse_tilbage"] == 8, js(r))
r = kor("totp", "tjek", stdin=json.dumps({"kode": B.hotp(secret, N // 30 + 1)}).encode(), nu=N + 30); t("samme kode igen afvises (genbrug)", r.returncode == 1 and js(r) == {"ok": False})
r = kor("totp", "tjek", stdin=json.dumps({"kode": B.hotp(secret, N // 30)}).encode(), nu=N + 30); t("en ældre kode end den sidst brugte afvises", r.returncode == 1)
r = kor("totp", "tjek", stdin=b'{"kode":"abc"}', nu=N + 30); t("skrald afvises uden fejl", r.returncode == 1 and js(r) == {"ok": False})
r = kor("totp", "tjek", stdin=json.dumps({"kode": koder[0].upper()}).encode(), nu=N + 30); j = js(r)
t("en gendannelseskode virker (også med store bogstaver), én gang, og tæller ned", j["ok"] and j["type"] == "gendannelse" and j["gendannelse_tilbage"] == 7, j)
r = kor("totp", "tjek", stdin=json.dumps({"kode": koder[0]}).encode(), nu=N + 30); t("samme gendannelseskode igen afvises", r.returncode == 1)
r = kor("totp", "tjek", stdin=b'{"kode":"aaaa-bbbb"}', nu=N + 30); t("en gendannelseskode, der ikke findes, afvises", r.returncode == 1)
# husk
t("husk: kun 7, 30, 90, 180 og 365 dage", js(kor("totp", "husk", stdin=b'{"dage":30}'))["husk_dage"] == 30 and json.loads(L(f"{D}/private/totp.json"))["husk_dage"] == 30 and kor("totp", "husk", stdin=b'{"dage":31}').returncode == 1 and kor("totp", "husk", stdin=b'{"dage":"90"}').returncode == 1)
# alle enheder ud
nogle0 = json.loads(L(f"{D}/private/totp.json"))["enhedsnoegle"]; r = js(kor("totp", "alle-ud", stdin=b"{}"))
t("alle ud: ny adgangscookie og ny enhedsnøgle (husk-cookies bliver ugyldige), men totrinsbekræftelsen forbliver slået til", r["ny_gate"] != ny_gate and json.loads(L(f"{D}/private/totp.json"))["enhedsnoegle"] != nogle0 and js(kor("totp", "status"))["aktiv"] is True)
ny_gate = r["ny_gate"]
# nye gendannelseskoder
r = kor("totp", "koder", stdin=b'{"kode":"000000"}', nu=N + 60); t("nye gendannelseskoder kræver en rigtig kode", r.returncode == 1 and "passer ikke" in js(r)["fejl"])
r = js(kor("totp", "koder", stdin=json.dumps({"kode": B.hotp(secret, N // 30 + 2)}).encode(), nu=N + 60)); nye = r["gendannelseskoder"]
t("med en rigtig kode: 8 nye, og de gamle virker ikke længere", len(nye) == 8 and not set(nye) & set(koder) and kor("totp", "tjek", stdin=json.dumps({"kode": koder[1]}).encode(), nu=N + 90).returncode == 1 and js(kor("totp", "status"))["gendannelse_tilbage"] == 8)
# slå fra
r = kor("totp", "fra", stdin=b'{"kode":"000000"}', nu=N + 120); t("slå fra kræver en rigtig kode, og forkert kode ændrer intet", r.returncode == 1 and js(kor("totp", "status"))["aktiv"] is True)
r = js(kor("totp", "fra", stdin=json.dumps({"kode": nye[0]}).encode(), nu=N + 120))
t("slå fra med en gendannelseskode: filen slettes, og adgangscookien byttes igen", r["ok"] and r["ny_gate"] != ny_gate and not os.path.exists(f"{D}/private/totp.json") and js(kor("totp", "status"))["aktiv"] is False)
t("ukendt handling og ikke-JSON giver en fejl, ikke et nedbrud", kor("totp", "noget", stdin=b"{}").returncode == 1 and kor("totp", "start", stdin=b"ikke json").returncode == 1)
# ── samme formler som login.php (spejlet i Python) ──
GATE = "g" * 40
def pending_lav(nu): return f"{int(nu)}.{hmac.new(GATE.encode(), f'pending|{int(nu)}'.encode(), hashlib.sha256).hexdigest()}"
def pending_ok(p, nu):
    try: ts, h = p.split(".", 1)
    except ValueError: return False
    return ts.isdigit() and hmac.compare_digest(hmac.new(GATE.encode(), f"pending|{ts}".encode(), hashlib.sha256).hexdigest(), h) and -5 <= nu - int(ts) <= 300
def enhed_lav(nu, dage, nogle): u = int(nu) + 86400 * dage; return f"{u}.{hmac.new(GATE.encode(), f'enhed|{u}|{nogle}'.encode(), hashlib.sha256).hexdigest()}"
def enhed_ok(c, nu, nogle):
    try: u, h = c.split(".", 1)
    except ValueError: return False
    return u.isdigit() and int(u) > nu and hmac.compare_digest(hmac.new(GATE.encode(), f"enhed|{u}|{nogle}".encode(), hashlib.sha256).hexdigest(), h)
p = pending_lav(1000)
t("ventende login (PIN rigtig, kode mangler): gyldig i 5 minutter, ikke længere, ikke forfalsket, ikke fra fremtiden", pending_ok(p, 1100) and pending_ok(p, 1300) and not pending_ok(p, 1301) and not pending_ok(p, 999 - 10) and not pending_ok(p.replace("1000", "1001"), 1100) and not pending_ok("1000.x", 1100) and not pending_ok("skrald", 1100) and not pending_ok("", 1100))
c = enhed_lav(1000, 90, "nogle1")
t("husket enhed: gyldig til udløb, forfalsket cookie, forkert enhedsnøgle (ny nøgle = alle logget ud) og udløbet afvises", enhed_ok(c, 2000, "nogle1") and not enhed_ok(c, 1000 + 86400 * 90 + 1, "nogle1") and not enhed_ok(c, 2000, "nogle2") and not enhed_ok(c.replace(c.split(".")[0], str(int(c.split(".")[0]) + 999999)), 2000, "nogle1") and not enhed_ok("x", 2000, "nogle1") and not enhed_ok("", 2000, "nogle1"))
# ── den rendrede login.php og .htaccess (PHP kan ikke køres her, så formerne tjekkes som tekst) ──
lg = L(f"{H}/login.php"); gt = L(f"{tmp}/lib/gate.php"); hta = L(f"{H}/.htaccess")
gate_nu = json.loads(L(f"{D}/private/instans.json"))["tokens"]["gate"]
t("login.php: PIN-koden er sat ind, cookien bruges uden https (lokalt), og alle cookies sættes ét sted (login_cookie)", "const SITE_PIN = '4711';" in lg and lg.count("setcookie(") == 1 and "'secure'   => false" in lg and "'secure'   => true" not in lg and lg.count("login_cookie(") >= 3)
t("login.php: andet trin kommer før PIN-trinnet, og PIN-trinnet sender kun videre uden kode, hvis enheden er husket eller totrinsbekræftelse er fra", lg.index("isset($_POST['kode'])") < lg.index("$pin = (string)($_POST['pin']") and "if ($totp && !login_enhed_ok($totp," in lg and lg.index("hash_equals(SITE_PIN, $pin)") < lg.index("login_enhed_ok($totp,"))
t("login.php: koden tjekkes af bootstrap.py (totp tjek), med egen tæller (5 forkerte pr. 15 minutter) adskilt fra PIN'ens", "'totp', 'tjek'" in lg and "gate_spaerret($ip, 'totp', 5)" in lg and "gate_forkert($ip, 'totp')" in lg and "gate_rigtig($ip, 'totp')" in lg)
t("login.php: underskrifterne har samme form som den afprøvede Python-model (pending| og enhed|… med enhedsnøglen)", "hash_hmac('sha256', 'pending|' . $t, GATE_TOKEN)" in lg and "hash_hmac('sha256', 'enhed|' . $u . '|' . $totp['enhedsnoegle'], GATE_TOKEN)" in lg and "hash_hmac('sha256', 'pending|' . $dele[0], GATE_TOKEN)" in lg and "hash_hmac('sha256', 'enhed|' . $dele[0] . '|' . $totp['enhedsnoegle'], GATE_TOKEN)" in lg)
t("login.php: ventende login højst 5 minutter, og en udløbet husk-cookie afvises", "$alder >= -5 && $alder <= 300" in lg and "(int)$dele[0] <= time()" in lg)
t("login.php: formularens andet trin har skjult «ventende», engangskode-felt og «husk»", 'name="ventende"' in lg and 'autocomplete="one-time-code"' in lg and 'name="husk"' in lg)
t("gate.php: tællerne kan have et navn og en egen grænse, uden at ændre den gamle nøgle (hash af «ugeplan|ip»)", "function gate_spaerret(string $ip, string $tag = '', int $max = GATE_MAX_FEJL)" in gt and "'ugeplan|' . ($tag !== '' ? $tag . '|' : '') . $ip" in gt and gate_nu in gt)
t(".htaccess: totp.php er låst bag cookien med den nuværende adgangscookie, og login.php er ikke", "RewriteRule ^totp\\.php(/|$) - [F,L]" in hta and hta.count(gate_nu) >= 9 and "RewriteRule ^login" not in hta)
t(".htaccess: config.js (som indeholder læsenøglen) er låst bag cookien, så nøglen ikke kan hentes uden login", "RewriteRule ^config\\.js$ - [F,L]" in hta and hta.index("RewriteCond %{HTTP_COOKIE} !ugeplan_ok=" + gate_nu) < hta.index("^config\\.js$"))
fores = [f for f in ("login.php", "start.html") if "config.js" in L(f"{H}/{f}")]
t("siderne, der vises FØR login (login.php og start.html), henter ikke config.js, så de stadig virker", not fores, fores)
tp = L(f"{H}/totp.php")
t("totp.php: kun de seks handlinger, den nye adgangscookie sættes og fjernes fra svaret, kræver nøgle og cookie", "const TO_HANDLINGER = ['start', 'bekraeft', 'fra', 'koder', 'husk', 'alle-ud'];" in tp and "unset($j['ny_gate'])" in tp and "setcookie('ugeplan_ok', $j['ny_gate']" in tp and "gate_ok()" in tp and "'tjek'" not in tp)
raise SystemExit(0 if ok_all else 1)
