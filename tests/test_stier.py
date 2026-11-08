"""Hver sti, siderne beder om, skal serveren også acceptere. Fundet efter 3.4.0: forsiden bad om settings/affald og settings/visning, men store_valid_path kendte dem ikke,
så HELE hentningen svarede «HTTP 400 ugyldig sti» og forsiden sagde «kunne ikke hente data». PHP kan ikke køres her; derfor oversættes serverens regler til Python
direkte fra kildeteksten og sammenlignes med alle stier i siderne. Prøven kunne have fundet fejlen."""
import glob, os, re, sys
ROD = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ok_all = True
def t(n, c, x=""):
    global ok_all; ok_all &= bool(c); print("ok  " if c else "FEJL", n, "" if c else x)
L = lambda p: open(os.path.join(ROD, p), encoding="utf-8").read()
store = L("ugeplan-lib/store.php"); api = L("public_html/api.php")
# serverens regler, læst ud af PHP-koden
uge = re.search(r"preg_match\('#\^\(([a-z|]+)\)/\\d\{4\}-W\\d\{2\}\$#', \$path\)", store)
sett = re.search(r"preg_match\('#\^settings/\(([a-z|]+)\)\$#', \$path\)", store)
t("store_valid_path kan læses ud af koden (ugestier og indstillinger)", uge and sett)
UGEDOK = set(uge.group(1).split("|")); SETT = set(sett.group(1).split("|"))
def gyldig(sti):
    m = re.match(rf"^({'|'.join(UGEDOK)})/(\d{{4}})-W(\d{{2}})$", sti)
    if m: return 1 <= int(m.group(3)) <= 53
    return bool(re.match(rf"^settings/({'|'.join(SETT)})$", sti))
skriv = set(re.findall(r"\$path === 'settings/([a-z]+)'", api))
t("alle indstillinger, læsenøglen må skrive til (api.php), er også gyldige stier (ellers svarer en skrivning 400 «ugyldig sti»)", skriv <= SETT, sorted(skriv - SETT))
brugt = {}
for f in ("public_html/overblik.html", "public_html/index.html", "public_html/vaelger.html", "public_html/backlog.html", "public_html/billeder.html", "public_html/start.html", "public_html/gaest-wifi.html", "public_html/sw.js"):
    for m in re.finditer(r'["\'`](settings/[a-z]+)["\'`]', L(f)): brugt.setdefault(m.group(1), set()).add(os.path.basename(f))
ugyldige = {s: sorted(f) for s, f in brugt.items() if not gyldig(s)}
t(f"alle {len(brugt)} indstillingsstier, siderne bruger ({', '.join(sorted(s.split('/')[1] for s in brugt))}), accepteres af serveren", not ugyldige, ugyldige)
t("regelen afviser det, den skal: ukendte indstillinger, ugenumre uden for 1–53, traversal og tomme stier", not any(gyldig(s) for s in ("settings/ukendt", "settings/", "settings/../x", "planner/2026-W00", "planner/2026-W54", "planner/2026-W5", "../planner/2026-W10", "")) and gyldig("planner/2026-W53") and gyldig("settings/affald"))
# de filer, der skrives, hedder det samme som stien (ingen anden liste skal ajourføres)
t("store_file bygger filnavnet af stien (der er ingen anden liste over navne at ajourføre)", re.search(r"function store_file\(string \$path\): string\s*\{[^}]*DATA_DIR", store, re.S) is not None)
# antal stier i én hentning på forsiden må ikke overskride serverens grænse
maks = int(re.search(r"API_MAX_PATHS = (\d+)", api).group(1))
ov = L("public_html/overblik.html")
krop = re.search(r"return \[`planner/\$\{wk\.id\}`.*?\];", ov, re.S).group(0)
antal = len(re.findall(r"`(?:planner|aula|ics|calendar)/\$\{[a-zA-Z0-9.]+\}`", krop)) + len(re.findall(r'"settings/[a-z]+"', krop))
t(f"forsiden henter {antal} stier ad gangen, og serverens grænse er {maks}", 0 < antal <= maks)
t("alle stier i forsidens hentning er gyldige (ugestier af formen planner/<uge> og de faste indstillinger)", all(gyldig(x) for x in re.findall(r'"(settings/[a-z]+)"', krop)))
sys.exit(0 if ok_all else 1)
