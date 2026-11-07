"""Bygningen må ikke afhænge af filer, der starter med punktum: en browser-upload til GitHub tager dem ikke med, og så fejler både prøverne og Docker-billederne.
Prøven her fjerner alle skjulte filer og mapper fra en kopi, kører opstarten i kopien og tjekker, at siderne, spærrefilerne og dataene stadig bliver rigtige."""
import json, os, shutil, subprocess, sys, tempfile
ROD = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ok_all = True
def t(n, c, x=""):
    global ok_all; ok_all &= bool(c); print("ok  " if c else "FEJL", n, "" if c else x)
skjulte = [os.path.relpath(os.path.join(r, n), ROD) for r, ds, fs in os.walk(ROD) for n in ds + fs if n.startswith(".") and ".git" not in os.path.relpath(r, ROD).split(os.sep)]
bygning = [p for p in skjulte if p.split(os.sep)[0] in ("public_html", "ugeplan-lib", "ugeplan-data", "docker", "sprog", "vaerktoej")]
t("ingen skjulte filer i de mapper, bygningen bruger (public_html, ugeplan-lib, ugeplan-data, docker, sprog, vaerktoej)", not bygning, bygning)
t("spærrefilerne ligger som htaccess.txt og findes alle tre steder", all(os.path.isfile(os.path.join(ROD, m, "htaccess.txt")) for m in ("public_html", "ugeplan-lib", "ugeplan-data")))
t("ugeplan-data har mindst én synlig fil (ellers er mappen tom i Git, og Docker-bygningen finder den ikke)", any(not n.startswith(".") for r, ds, fs in os.walk(os.path.join(ROD, "ugeplan-data")) for n in fs))
t("en synlig kopi af GitHub-workflowet ligger i github-workflow/ (mappen .github kan ikke uploades i en browser)", os.path.isfile(os.path.join(ROD, "github-workflow", "billeder.yml")) and open(os.path.join(ROD, "github-workflow", "billeder.yml"), encoding="utf-8").read() == open(os.path.join(ROD, ".github", "workflows", "billeder.yml"), encoding="utf-8").read() if os.path.isfile(os.path.join(ROD, ".github", "workflows", "billeder.yml")) else True)
tmp = tempfile.mkdtemp(prefix="fo-sk-")
def kopi(src, dst):
    for r, ds, fs in os.walk(src):
        ds[:] = [d for d in ds if not d.startswith(".")]
        for f in fs:
            if f.startswith("."): continue
            s = os.path.join(r, f); d = os.path.join(dst, os.path.relpath(s, src)); os.makedirs(os.path.dirname(d), exist_ok=True); shutil.copyfile(s, d)
rod2 = os.path.join(tmp, "repo"); kopi(ROD, rod2)
sk = os.path.join(tmp, "skabelon"); os.makedirs(sk)
for a, b in (("public_html", "html"), ("ugeplan-lib", "lib"), ("ugeplan-data", "data")): shutil.copytree(os.path.join(rod2, a), os.path.join(sk, b))
shutil.copyfile(os.path.join(rod2, "docker", "aula", "config-skabelon.py"), os.path.join(sk, "aula-config.py"))
for f in ("CHANGELOG.md", "VERSION"): shutil.copyfile(os.path.join(rod2, f), os.path.join(sk, f))
e = {**os.environ, "FO_SKABELON": sk, "FO_HTML": f"{tmp}/html", "FO_LIB": f"{tmp}/lib", "FO_DATA": f"{tmp}/data", "FO_AULA_CONFIG": f"{tmp}/data/private/aula-config", "FO_BRUGER": "findes-ikke"}
r = subprocess.run([sys.executable, os.path.join(rod2, "docker", "web", "bootstrap.py"), "start"], capture_output=True, env=e)
t("opstart i en kopi UDEN nogen skjulte filer lykkes", r.returncode == 0, r.stderr.decode()[-300:])
ins = json.load(open(f"{tmp}/data/private/instans.json")); gate = ins["tokens"]["gate"]
H, B, D = f"{tmp}/html", f"{tmp}/lib", f"{tmp}/data"
t("spærrefilerne bliver skrevet ud med det rigtige navn: .htaccess i web, lib og data", all(os.path.isfile(os.path.join(x, ".htaccess")) for x in (H, B, D)) and not any(os.path.exists(os.path.join(x, "htaccess.txt")) for x in (H, B, D)))
hta = open(f"{H}/.htaccess", encoding="utf-8").read()
t("web-.htaccess er udfyldt: login-token, cookie-regler for alle endpoints, og ingen https-krav (lokalt)", gate in hta and "^config\\.js$" in hta and "^totp\\.php" in hta and "^backlog\\.php" in hta and "RewriteCond %{HTTPS}" not in hta)
t("lib og data spærres: Require all denied (så nøgler og data ikke kan hentes direkte)", "denied" in open(f"{B}/.htaccess", encoding="utf-8").read().lower() and "denied" in open(f"{D}/.htaccess", encoding="utf-8").read().lower())
open(f"{D}/.htaccess", "w").write("XX-GAMMEL-UDGAVE-XX"); open(f"{H}/.htaccess", "w").write("XX-GAMMEL-UDGAVE-XX")
subprocess.run([sys.executable, os.path.join(rod2, "docker", "web", "bootstrap.py"), "start"], capture_output=True, env=e)
t("ved næste opstart skrives spærrefilerne igen (en gammel udgave bliver ikke stående)", "XX-GAMMEL-UDGAVE-XX" not in open(f"{D}/.htaccess", encoding="utf-8").read() and "XX-GAMMEL-UDGAVE-XX" not in open(f"{H}/.htaccess", encoding="utf-8").read())
# begge udgaver ved siden af hinanden: den synlige har forrang
open(os.path.join(sk, "html", ".htaccess"), "w").write("FORKERT GAMMEL")
subprocess.run([sys.executable, os.path.join(rod2, "docker", "web", "bootstrap.py"), "render"], capture_output=True, env=e)
t("ligger både .htaccess og htaccess.txt i skabelonen, vinder htaccess.txt", "FORKERT" not in open(f"{H}/.htaccess", encoding="utf-8").read() and gate in open(f"{H}/.htaccess", encoding="utf-8").read())
raise SystemExit(0 if ok_all else 1)
