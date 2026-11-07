"""Prøver, at opstart som root efterlader filer, webbrugeren (www-data) kan skrive om, og at guiden, indstillinger og TOTP så virker som webbrugeren.
Kræver root (som i containeren). Uden root springes prøven over. Her bruges brugeren «nobody» i stedet for www-data."""
import json, os, pwd, shutil, stat, subprocess, sys, tempfile, zipfile
ROD = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BOOT = os.path.join(ROD, "docker", "web", "bootstrap.py")
if os.geteuid() != 0: print("ok   (sprunget over: kræver root)"); raise SystemExit(0)
ok_all = True
def t(n, c, x=""):
    global ok_all; ok_all &= bool(c); print("ok  " if c else "FEJL", n, "" if c else x)
nob = pwd.getpwnam("nobody")
tmp = tempfile.mkdtemp(prefix="fo-r-"); os.chmod(tmp, 0o755)
sk = os.path.join(tmp, "skabelon"); os.makedirs(sk)
shutil.copytree(os.path.join(ROD, "public_html"), os.path.join(sk, "html")); shutil.copytree(os.path.join(ROD, "ugeplan-lib"), os.path.join(sk, "lib")); shutil.copytree(os.path.join(ROD, "ugeplan-data"), os.path.join(sk, "data"))
shutil.copyfile(os.path.join(ROD, "docker", "aula", "config-skabelon.py"), os.path.join(sk, "aula-config.py"))
for f in ("CHANGELOG.md", "VERSION"): shutil.copyfile(os.path.join(ROD, f), os.path.join(sk, f))
shutil.copyfile(BOOT, os.path.join(tmp, "bootstrap.py")); os.chmod(os.path.join(tmp, "bootstrap.py"), 0o755); BOOT = os.path.join(tmp, "bootstrap.py")   # som /opt/familieoverblik i containeren: læsbar for alle
for r, ds, fs in os.walk(sk):
    for n in ds: os.chmod(os.path.join(r, n), 0o755)
    for n in fs: os.chmod(os.path.join(r, n), 0o644)
e = {**os.environ, "FO_SKABELON": sk, "FO_HTML": f"{tmp}/html", "FO_LIB": f"{tmp}/lib", "FO_DATA": f"{tmp}/data", "FO_AULA_CONFIG": f"{tmp}/data/private/aula-config", "FO_BRUGER": "nobody"}
def som_root(*a, stdin=None): return subprocess.run([sys.executable, BOOT, *a], input=stdin, capture_output=True, env=e)
def som_web(*a, stdin=None):
    def ned(): os.setgid(nob.pw_gid); os.setuid(nob.pw_uid)
    return subprocess.run([sys.executable, BOOT, *a], input=stdin, capture_output=True, env=e, preexec_fn=ned)
def js(r): return json.loads(r.stdout.decode().strip().splitlines()[-1])
r = som_root("start"); t("opstart som root lykkes", r.returncode == 0, r.stderr.decode()[-300:])
ejere = {}
for rod in (f"{tmp}/html", f"{tmp}/lib", f"{tmp}/data/private/aula-config", f"{tmp}/data"):
    for rr, ds, fs in os.walk(rod):
        for n in [rr] + [os.path.join(rr, x) for x in ds + fs]: ejere[n] = os.lstat(n).st_uid
forkerte = [p for p, u in ejere.items() if u != nob.pw_uid]
t("efter opstart ejer webbrugeren ALLE renderede filer og mapper (html, lib, aula-config og data), også undermapper som icons/", not forkerte, forkerte[:5])
kode = json.loads(open(f"{tmp}/data/private/instans.json").read())["opsaetningskode"]
r = som_web("anvend", "--foerste", stdin=json.dumps({"kode": kode, "sv": {"voksne": ["Anna"], "boern": [{"navn": "Sofie"}]}, "pin": "4711"}).encode())
t("opsætningsguiden virker som webbrugeren (rendering skriver html, lib og aula-config om)", r.returncode == 0 and js(r)["ok"] and "'4711'" in open(f"{tmp}/html/login.php").read() and "start.html" not in open(f"{tmp}/html/login.php").read() and 'id: "anna"' in open(f"{tmp}/html/config.js").read(), (r.stdout + r.stderr).decode()[-400:])
r = som_web("anvend", stdin=json.dumps({"sv": {"voksne": ["Anna", "Peter"], "boern": [{"navn": "Sofie"}]}}).encode())
t("indstillinger virker som webbrugeren", r.returncode == 0 and 'id: "peter"' in open(f"{tmp}/html/config.js").read(), (r.stdout + r.stderr).decode()[-300:])
r = som_web("totp", "start", stdin=b"{}"); sec = js(r)["secret"]
import importlib.util; spec = importlib.util.spec_from_file_location("b", BOOT); B = importlib.util.module_from_spec(spec); spec.loader.exec_module(B)
import time
r = som_web("totp", "bekraeft", stdin=json.dumps({"kode": B.hotp(sec, int(time.time() // 30))}).encode())
t("totrinsbekræftelse kan slås til som webbrugeren (adgangscookien byttes, og .htaccess og gate.php skrives om)", r.returncode == 0 and js(r)["ok"] and js(r)["ny_gate"] in open(f"{tmp}/html/.htaccess").read(), (r.stdout + r.stderr).decode()[-300:])
def bl_web(h, p): 
    def ned(): os.setgid(nob.pw_gid); os.setuid(nob.pw_uid)
    r = subprocess.run([sys.executable, BOOT, "backlog", h], input=json.dumps(p).encode(), capture_output=True, env=e, preexec_fn=ned); return r.returncode, json.loads(r.stdout.decode().strip().splitlines()[-1])
c1, j1 = bl_web("nyt", {"titel": "Fra webbrugeren", "af": "Anna"}); c2, j2 = bl_web("stem", {"id": 1, "hvem": "Anna"}); c3, j3 = bl_web("liste", {})
t("backlog virker som webbrugeren (opretter filen, stemmer, læser)", c1 == 0 and c2 == 0 and c3 == 0 and j3["punkter"][0]["stemmer"] == ["anna"] and os.stat(f"{tmp}/data/private/backlog.json").st_uid == nob.pw_uid, (j1, j2))
# sikkerhedskopi: en fil, webbrugeren ikke kan skrive, stopper ikke resten
os.makedirs(f"{tmp}/data/bil", exist_ok=True); open(f"{tmp}/data/bil/status.json", "w").write("root"); os.chown(f"{tmp}/data/bil/status.json", 0, 0); os.chown(f"{tmp}/data/bil", 0, 0); os.chmod(f"{tmp}/data/bil", 0o755)
z = f"{tmp}/k.zip"
with zipfile.ZipFile(z, "w") as zz: zz.writestr("bil/status.json", "ny"); zz.writestr("settings/ok.json", "ok"); zz.writestr("private/aula-state/aula-sync.log", "x")
os.chmod(z, 0o644)
r = som_web("gendan", z); g = js(r)
t("gendan: en fil, webbrugeren ikke må skrive (bil-containerens), tælles og forklares, resten lægges ind, og Aula-tilstanden springes over", g["ok"] and g.get("fejlet") == 1 and "kunne ikke skrives" in g.get("advarsel", "") and open(f"{tmp}/data/settings/ok.json").read() == "ok" and open(f"{tmp}/data/bil/status.json").read() == "root" and g["sprunget_over"] == 1 and not os.path.exists(f"{tmp}/data/private/aula-state/aula-sync.log"), g)
# zip-bombe: lyver om størrelsen
bomb = f"{tmp}/bombe.zip"
with zipfile.ZipFile(bomb, "w", zipfile.ZIP_DEFLATED) as zz: zz.writestr("settings/stor.json", b"0" * (8 * 1024 * 1024))
os.chmod(bomb, 0o644)
gl = B.MAX_BYTES
e2 = dict(e)
code = ("import importlib.util,sys,json,io; s=importlib.util.spec_from_file_location('b',sys.argv[1]); b=importlib.util.module_from_spec(s); s.loader.exec_module(b); b.MAX_BYTES=1024*1024\n"
        "try: print(json.dumps(b._gendan_ind([('settings/stor.json', 10, lambda: io.BytesIO(b'0'*(8*1024*1024)))])))\n"     # arkivet påstår 10 byte, men giver 8 MB
        "except b.Fejl as x: print(json.dumps({'ok':False,'fejl':str(x)}))")
r = subprocess.run([sys.executable, "-c", code, BOOT], capture_output=True, env=e2)
d = json.loads(r.stdout.decode().strip().splitlines()[-1])
t("gendan tæller de udpakkede bytes: en fil, der er større end loftet, stoppes, og den halve fil ryddes væk", d["ok"] is False and "fylder mere udpakket" in d["fejl"] and not os.path.exists(f"{tmp}/data/settings/stor.json") and not os.path.exists(f"{tmp}/data/settings/stor.json.tmp"), d)
raise SystemExit(0 if ok_all else 1)
