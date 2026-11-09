"""Er projektet klart til at være offentligt? Leder efter nøgler, hemmelige filer, e-mailadresser, IP-adresser og (valgfrit) navne, der ikke må stå i en offentlig udgave.
Navne lægges IKKE i projektet (så ville de stå der): sæt dem i miljøvariablen FO_PRIVAT_ORD, adskilt af komma, fx  FO_PRIVAT_ORD="fornavn,efternavn,gadenavn" python3 tests/test_offentlig.py"""
import os, re, sys
ROD = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ok_all = True
def t(n, c, x=""):
    global ok_all; ok_all &= bool(c); print("ok  " if c else "FEJL", n, "" if c else x)
filer = []
for rod, mapper, fs in os.walk(ROD):
    mapper[:] = [d for d in mapper if d not in (".git", "__pycache__", "node_modules")]
    for f in fs: filer.append(os.path.join(rod, f))
rel = lambda p: os.path.relpath(p, ROD).replace(os.sep, "/")
def tekster():
    for p in filer:
        if os.path.getsize(p) > 3_000_000 or p.endswith((".png", ".jpg", ".zip", ".pyc")): continue
        try: yield rel(p), open(p, encoding="utf-8").read()
        except (UnicodeDecodeError, OSError): continue
def find(rx, flags=0, undtagen=()):
    return [(r, m.group(0)) for r, s in tekster() if not any(u in r for u in undtagen) for m in re.finditer(rx, s, flags)]
n1 = find(r"sk-ant-[A-Za-z0-9_-]{10,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{12,}|xox[bp]-[A-Za-z0-9-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY")
t("ingen API-nøgler, GitHub-tokens, AWS-nøgler, Slack-tokens eller private nøgler", not n1, n1[:3])
n2 = find(r"(?<![A-Za-z0-9/+_=.-])[A-Za-z0-9]{40,}(?![A-Za-z0-9/+_=.-])", 0, ("sprog-pakker.js", "THIRD_PARTY"))
t("ingen lange hemmeligheds-agtige strenge (40+ bogstaver og tal i træk)", not n2, n2[:3])
FORBUDT = {"instans.json", "totp.json", "backlog.json", ".env", "aula-config.py", "config.py", ".aula_tokens.json", "feeds.json", "aula-sync.log"}
fund = [rel(p) for p in filer if os.path.basename(p) in FORBUDT or "aula-dump" in p or p.endswith((".pem", ".key", ".p12"))]
t("ingen filer, der kun hører hjemme på en kørende installation (instans.json, totp.json, backlog.json, .env, tokens, dumps, nøglefiler)", not fund, fund)
mails = {m.lower() for _, m in find(r"[\w.+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}\b")}
tilladt = {"mig@x.dk", "env@x.dk", "a@b.dk", "info@example.dk"}
t("kun opdigtede e-mailadresser (x.dk, b.dk, example.dk)", mails <= tilladt, sorted(mails - tilladt))
ips = {m for _, m in find(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")} - {"192.168.1.50", "192.168.1.60", "127.0.0.1", "0.0.0.0", "10.0.0.1"}
t("kun eksempel-IP-adresser (192.168.1.x) og lokale adresser", not ips, sorted(ips)[:5])
ord_ = [x.strip() for x in os.environ.get("FO_PRIVAT_ORD", "").split(",") if x.strip()]
if ord_:
    hits = [(r, o) for o in ord_ for r, s in tekster() if re.search(rf"(?<![\w]){re.escape(o)}(?![\w])", s, re.I)]
    t(f"ingen af de {len(ord_)} private ord (FO_PRIVAT_ORD) står i projektet", not hits, hits[:5])
else:
    print("      (FO_PRIVAT_ORD er ikke sat: navne og steder er ikke kontrolleret)")
nodv = ["LICENSE", "README.md", "README.en.md", "SECURITY.md", "THIRD_PARTY.md", "CHANGELOG.md", "CLAUDE.md"]          # .gitignore er valgfri: en upload i browseren tager filer med punktum ikke med
t("de filer, et offentligt projekt skal have, findes: licens, README (dansk og engelsk), sikkerhed, tredjepart, ændringslog", all(os.path.exists(os.path.join(ROD, f)) for f in nodv), [f for f in nodv if not os.path.exists(os.path.join(ROD, f))])
if os.path.exists(os.path.join(ROD, ".gitignore")):
    gi = open(os.path.join(ROD, ".gitignore"), encoding="utf-8").read()
    t(".gitignore holder .env og cache-filer ude af repoet", ".env" in gi and "__pycache__/" in gi)
else:
    print("      (.gitignore findes ikke i dette repo, fx efter en upload i browseren: det er i orden, men læg ingen .env eller nøglefiler op)")
t("README siger, at projektet er uofficielt og en tidlig udgave, og SECURITY.md peger på privat sårbarhedsmelding og siger, at siden ikke skal ud på internettet", "Uofficielt" in open(os.path.join(ROD, "README.md"), encoding="utf-8").read() and "Report a vulnerability" in open(os.path.join(ROD, "SECURITY.md"), encoding="utf-8").read() and "ikke direkte på internettet" in open(os.path.join(ROD, "SECURITY.md"), encoding="utf-8").read())
sys.exit(0 if ok_all else 1)
