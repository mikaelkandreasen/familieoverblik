"""Prøver cron.sh, loop.sh og bil_sync.laes_login uden Docker (med falske curl, sleep, date og python i PATH)."""
import importlib.util, json, os, stat, subprocess, sys, tempfile
ROD = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ok_all = True
def t(n, c, x=""):
    global ok_all; ok_all &= bool(c); print("ok  " if c else "FEJL", n, "" if c else x)
tmp = tempfile.mkdtemp(prefix="fo-s-"); bin_ = f"{tmp}/bin"; os.makedirs(bin_)
def stub(navn, kode):
    p = f"{bin_}/{navn}"; open(p, "w").write("#!/bin/sh\n" + kode + "\n"); os.chmod(p, 0o755)
log = f"{tmp}/kald.log"
stub("curl", f'echo "curl $*" >> {log}; [ -n "$CURL_FEJL" ] && exit 22; exit 0')
stub("sleep", f'echo "sleep $*" >> {log}')
stub("python", f'echo "python $*" >> {log}; [ -n "$PY_FEJL" ] && exit 1; exit 0')
env = lambda **k: {**os.environ, "PATH": f"{bin_}:{os.environ['PATH']}", **k}
def kor(script, **k):
    open(log, "w").close(); r = subprocess.run(["sh", f"{ROD}/{script}"], capture_output=True, text=True, env=env(**k), timeout=20)
    return r, open(log).read()
ins = f"{tmp}/instans.json"
json.dump({"tokens": {"read": "r" * 40, "write": "w" * 40, "cron": "abc123XYZ789" * 3 + "abcd", "gate": "g" * 40}, "opsat": True}, open(ins, "w"), indent=1)
cron = json.load(open(ins))["tokens"]["cron"]
r, l = kor("docker/cron/cron.sh", INSTANS=ins, CRON_ENKELT="1", CRON_START="1")
t("cron.sh: læser cron-nøglen fra instans.json og sender den i en header (ikke i adressen, som logges)", f"curl -fsS -H X-Cron-Key: {cron} http://web/hent.php?job=all" in l and "key=" not in l and "sleep 1" in l, l)
r, l = kor("docker/cron/cron.sh", INSTANS=ins, CRON_ENKELT="1", CRON_START="0", WEB="http://anden")
t("cron.sh: adressen kan ændres (WEB)", "http://anden/hent.php?job=all" in l)
r, l = kor("docker/cron/cron.sh", INSTANS=ins, CRON_ENKELT="1", CRON_START="0", CRON_FRISK="1")
t("cron.sh: CRON_FRISK=1 tilføjer &frisk=1 (hent nu og ignorér cachen), og uden den er adressen som før", "hent.php?job=all&frisk=1" in l and "hent.php?job=all " not in l.replace("&frisk=1", ""), l)
r, l = kor("docker/cron/cron.sh", INSTANS=ins, CRON_ENKELT="1", CRON_START="0", CURL_FEJL="1")
t("cron.sh: en fejl fra hent.php logges, og scriptet fortsætter", "hent.php fejlede" in r.stdout and r.returncode == 0)
r, l = kor("docker/cron/cron.sh", INSTANS=f"{tmp}/findes-ikke.json", CRON_ENKELT="1", CRON_START="0")
t("cron.sh: uden instans.json (opsætning ikke begyndt) ventes der, og curl kaldes ikke", "curl" not in l and "Venter på" in r.stdout)
open(f"{tmp}/tom.json", "w").write("{}"); r, l = kor("docker/cron/cron.sh", INSTANS=f"{tmp}/tom.json", CRON_ENKELT="1", CRON_START="0")
t("cron.sh: instans.json uden nøgle giver en forklaring i stedet for et kald", "curl" not in l and "Fandt ingen cron-nøgle" in r.stdout)
r, l = kor("docker/cron/cron.sh", INSTANS=ins, CRON_START="0", CRON_ENKELT="", CRON_SEKUNDER="7", PATH=f"{bin_}:{os.environ['PATH']}") if False else (None, "")
# loop.sh
cfg = f"{tmp}/config.py"
r, l = kor("docker/aula/loop.sh", AULA_CONFIG=f"{tmp}/mangler.py", LOOP_ENKELT="1")
t("loop.sh: uden config.py ventes der, og Sync-Aula.py køres ikke", "Venter på" in r.stdout and "python" not in l)
open(cfg, "w").write("x=1")
stub("date", 'case "$*" in "+%s") echo 1000;; "-d today 07:00 +%s") echo 4000;; "-d tomorrow 07:00 +%s") echo 90400;; *) /bin/date "$@";; esac')
r, l = kor("docker/aula/loop.sh", AULA_CONFIG=cfg, LOOP_ENKELT="1")
t("loop.sh: kl. er før 07:00 → sover frem til i dag 07:00 og kører så Sync-Aula.py", "sleep 3000" in l and "python /app/Sync-Aula.py" in l and l.index("sleep 3000") < l.index("python"), l)
stub("date", 'case "$*" in "+%s") echo 5000;; "-d today 07:00 +%s") echo 4000;; "-d tomorrow 07:00 +%s") echo 90400;; *) /bin/date "$@";; esac')
r, l = kor("docker/aula/loop.sh", AULA_CONFIG=cfg, LOOP_ENKELT="1")
t("loop.sh: kl. er efter 07:00 → sover til i morgen 07:00", "sleep 85400" in l, l)
r, l = kor("docker/aula/loop.sh", AULA_CONFIG=cfg, LOOP_ENKELT="1", PY_FEJL="1")
t("loop.sh: en fejl i Sync-Aula.py stopper ikke løkken og forklarer, hvad man skal gøre", "fejlede" in r.stdout and "terminal" in r.stdout and r.returncode == 0)
stub("date", 'case "$*" in "+%s") echo 1000;; "-d today 08:30 +%s") echo 2800;; *) /bin/date "$@";; esac')
r, l = kor("docker/aula/loop.sh", AULA_CONFIG=cfg, LOOP_ENKELT="1", AULA_TID="08:30")
t("loop.sh: tidspunktet kan ændres (AULA_TID)", "sleep 1800" in l, l)
# bil_sync.laes_login
os.environ["DATA_DIR"] = tmp
spec = importlib.util.spec_from_file_location("bil_sync", f"{ROD}/docker/bil/bil_sync.py"); b = importlib.util.module_from_spec(spec); spec.loader.exec_module(b)
for k in ("HYUNDAI_USERNAME", "HYUNDAI_PASSWORD", "HYUNDAI_PIN", "HYUNDAI_VIN"): os.environ.pop(k, None)
os.makedirs(f"{tmp}/private", exist_ok=True)
t("bil: uden miljøvariabler og uden instans.json er login tomt", b.laes_login() == ("", "", "", ""))
json.dump({"hemmeligheder": {"hyundai_bruger": "mig@x.dk", "hyundai_kode": "pw", "hyundai_pin": "1234", "hyundai_vin": "VIN1"}}, open(f"{tmp}/private/instans.json", "w"))
t("bil: login læses fra instans.json (Opsætning → Forbindelser)", b.laes_login() == ("mig@x.dk", "pw", "1234", "VIN1"))
os.environ["HYUNDAI_USERNAME"] = "env@x.dk"
t("bil: miljøvariabler slår ikke de gemte enkeltvis, men fylder hullerne", b.laes_login()[0] == "env@x.dk" and b.laes_login()[1] == "pw")
open(f"{tmp}/private/instans.json", "w").write("{ødelagt"); os.environ.pop("HYUNDAI_USERNAME")
t("bil: ødelagt instans.json giver tomt login i stedet for et nedbrud", b.laes_login() == ("", "", "", ""))
try: b.hent(False); t("manglende login giver fejl", False)
except RuntimeError as e: t("bil: manglende login giver en forklaring med vej til indstillingen", "Opsætning → Forbindelser" in str(e), str(e))
raise SystemExit(0 if ok_all else 1)
