"""Prøver pakkeværktøjet (vaerktoej/pak.py): zip-filens indhold og guidens form."""
import importlib.util, os, re, sys, tempfile, zipfile
ROD = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location("pak", os.path.join(ROD, "vaerktoej", "pak.py")); P = importlib.util.module_from_spec(spec); spec.loader.exec_module(P)
ok_all = True
def t(n, c, x=""):
    global ok_all; ok_all &= bool(c); print("ok  " if c else "FEJL", n, "" if c else x)
ud = tempfile.mkdtemp(prefix="fo-pak-"); z, n = P.lav_zip(ud); g, tekst = P.lav_guide(ud)
v = open(os.path.join(ROD, "VERSION")).read().strip(); Z = zipfile.ZipFile(z); navne = Z.namelist()
t("zip-filen hedder familieoverblik-<VERSION>.zip, og alt ligger i mappen «familieoverblik/»", os.path.basename(z) == f"familieoverblik-{v}.zip" and all(x.startswith("familieoverblik/") for x in navne), navne[:3])
t("VERSION i zip-filen er den samme som projektets, og antallet af filer stemmer", Z.read("familieoverblik/VERSION").decode().strip() == v and len(navne) == n)
t("de filer, en udgave skal bruge, er med: workflowet (både .github og github-workflow), spærrefilerne som htaccess.txt, guiden, changelog, CLAUDE.md og alle prøver", all(f"familieoverblik/{f}" in navne for f in (".github/workflows/billeder.yml", "github-workflow/billeder.yml", "public_html/htaccess.txt", "ugeplan-lib/htaccess.txt", "ugeplan-data/htaccess.txt", "GUIDE-V3.md", "CHANGELOG.md", "CLAUDE.md", "docker/web/bootstrap.py", "tests/alle.py", "LICENSE", "SECURITY.md", "THIRD_PARTY.md", "docs/DELING.md", "docs/social-preview.png", "docs/arkitektur.svg", "README.en.md", "tests/frontend/kor_alle.py", "vaerktoej/pak.py", "vaerktoej/sprog.py")))
t("ingen hemmeligheder eller rester: ingen instans.json, totp.json, backlog.json, .env, __pycache__, .pyc eller sprog-skabeloner", not [x for x in navne if re.search(r"instans\.json|totp\.json|/backlog\.json$|\.env$|__pycache__|\.pyc$|sprog/skabelon-", x)])
t("de eneste filer med punktum i navnet er dem, GitHub selv kræver (workflowet og .gitignore)", sorted(x for x in navne if any(p.startswith(".") for p in x.split("/")[1:])) == ["familieoverblik/.github/workflows/billeder.yml", "familieoverblik/.gitignore"], [x for x in navne if any(p.startswith(".") for p in x.split("/")[1:])])
t("pakker man to gange, bliver indholdet det samme (ingen tilfældighed), og rækkefølgen er stabil", (lambda z2: [i.filename for i in zipfile.ZipFile(z2[0]).infolist()] == [i.filename for i in Z.infolist()])(P.lav_zip(tempfile.mkdtemp(prefix="fo-pak2-"))))
raa = open(g, "rb").read()
t("guiden er UTF-8 med BOM og Windows-linjeskift (Notepad++), uden ensomme LF og uden tabulatorer", raa[:3] == b"\xef\xbb\xbf" and raa.count(b"\r\n") > 200 and raa.replace(b"\r\n", b"").count(b"\n") == 0 and b"\t" not in raa)
linjer = tekst.split("\r\n")
t("ingen linje i guiden er længere end 82 tegn (undtagen kommandolinjer), og der er mindst 30 afkrydsningstrin", not [i for i, l in enumerate(linjer) if len(l) > 82 and not l.lstrip().startswith("$")] and sum(l.startswith("[ ]") for l in linjer) >= 30)
t("guiden har overskrifter og afsnittene fra markdown-udgaven (fx tømning, åben visning, fuld skærm, browserkrav)", all(x in tekst for x in ("Tømning", "Åben visning", "Fuld skærm", "Gamle Android-enheder", "Backlog")))
t("markdown-tegn er væk (ingen ** eller `` ` ``) og pilen → er lavet om til > (ASCII)", "**" not in tekst and "`" not in tekst and "→" not in tekst)
sys.exit(0 if ok_all else 1)
