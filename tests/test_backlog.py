"""Prøver backlog-logikken i docker/web/bootstrap.py som en rigtig proces: nye punkter, ændringer, stemmer, kommentarer, import, eksport og grænser."""
import csv, io, json, os, re, shutil, subprocess, sys, tempfile, threading
ROD = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BOOT = os.path.join(ROD, "docker", "web", "bootstrap.py")
ok_all = True
def t(n, c, x=""):
    global ok_all; ok_all &= bool(c); print("ok  " if c else "FEJL", n, "" if c else x)
tmp = tempfile.mkdtemp(prefix="fo-b-"); os.makedirs(f"{tmp}/data/private")
E = {**os.environ, "FO_DATA": f"{tmp}/data", "FO_BRUGER": "findes-ikke", "FO_NU": "1794052800"}      # 2026-11-07 kl. 12 UTC (samme dato i alle tidszoner)
def kor(h, p=None, nu=None):
    env = {**E, **({"FO_NU": str(nu)} if nu else {})}
    r = subprocess.run([sys.executable, BOOT, "backlog", h], input=json.dumps(p if p is not None else {}).encode(), capture_output=True, env=env)
    return r.returncode, json.loads(r.stdout.decode().strip().splitlines()[-1])
ok = lambda h, p=None, **k: kor(h, p, **k)[1]
def fejl(h, p, tekst=None):
    c, j = kor(h, p); return c == 1 and j["ok"] is False and (tekst is None or tekst in j["fejl"])
r = subprocess.run([sys.executable, BOOT, "backlog", "liste"], input=b"[]", capture_output=True, env=E)
t("«liste» med [] som krop virker (det backlog.php sender, når «handling» er det eneste felt)", r.returncode == 0 and json.loads(r.stdout.decode().strip().splitlines()[-1])["ok"] is True, r.stdout[-200:])
r = subprocess.run([sys.executable, BOOT, "backlog", "liste"], input=b"[1]", capture_output=True, env=E)
t("en liste med noget i afvises stadig", r.returncode == 1 and "skal være JSON" in json.loads(r.stdout.decode().strip().splitlines()[-1])["fejl"])
j = ok("liste")
t("tom liste og de faste valg", j["ok"] and j["punkter"] == [] and j["kategorier"][0] == "billeder" and j["prioriteter"] == ["P1", "P2", "P3", "P4"] and j["statusser"] == ["Idé", "Planlagt", "I gang", "Færdig", "Droppet"])
j = ok("nyt", {"titel": "  Tømmekalender  ", "beskrivelse": "Vis tømning\r\nfor Eksempelby", "kategori": "kalender", "prioritet": "P2", "af": "Anna"}); p1 = j["punkt"]
t("nyt punkt: trimmet titel, linjeskift ens, standardstatus Idé, id 1, dato fra uret, ingen stemmer", j["ok"] and p1["id"] == 1 and p1["titel"] == "Tømmekalender" and p1["beskrivelse"] == "Vis tømning\nfor Eksempelby" and p1["status"] == "Idé" and p1["oprettet"] == "2026-11-07" and p1["stemmer"] == [] and p1["kommentarer"] == [] and p1["af"] == "Anna", j)
t("standard for kategori og prioritet, hvis de udelades (andet, P3)", (lambda q: q["kategori"] == "andet" and q["prioritet"] == "P3" and q["id"] == 2)(ok("nyt", {"titel": "Lille ting", "af": "Peter"})["punkt"]))
t("filen har rettighed 660 og indeholder punkterne", oct(os.stat(f"{tmp}/data/private/backlog.json").st_mode & 0o777) == "0o660" and len(json.load(open(f"{tmp}/data/private/backlog.json"))["punkter"]) == 2)
t("validering ved nyt: titel mangler/for lang/linjeskift, kategori, prioritet, status, navn, styretegn", fejl("nyt", {"titel": " ", "af": "A"}, "Titel mangler") and fejl("nyt", {"titel": "x" * 121, "af": "A"}, "120") and fejl("nyt", {"titel": "a\nb", "af": "A"}, "linjeskift") and fejl("nyt", {"titel": "t", "kategori": "x", "af": "A"}, "Kategori") and fejl("nyt", {"titel": "t", "prioritet": "P9", "af": "A"}, "Prioritet") and fejl("nyt", {"titel": "t", "status": "Færdigt", "af": "A"}, "Status") and fejl("nyt", {"titel": "t"}, "Navn mangler") and fejl("nyt", {"titel": "t", "af": "x" * 31}, "30") and fejl("nyt", {"titel": "t\x00", "af": "A"}, "styretegn") and fejl("nyt", {"titel": "t", "beskrivelse": "x" * 4001, "af": "A"}, "4000") and fejl("nyt", {"titel": 5, "af": "A"}, "tekst"))
t("et afvist forsøg skrev ikke noget (stadig 2 punkter, og næste id er 3)", len(ok("liste")["punkter"]) == 2 and ok("nyt", {"titel": "Tredje", "af": "A"})["punkt"]["id"] == 3)
# ret
j = ok("ret", {"id": 1, "status": "Planlagt", "prioritet": "P1", "kategori": "sikkerhed", "titel": "Ny titel", "beskrivelse": ""}, nu=1794139200)
t("ret: status, prioritet, kategori, titel og beskrivelse kan ændres hver for sig eller sammen, og «opdateret» får dagens dato", j["punkt"]["status"] == "Planlagt" and j["punkt"]["prioritet"] == "P1" and j["punkt"]["kategori"] == "sikkerhed" and j["punkt"]["titel"] == "Ny titel" and j["punkt"]["beskrivelse"] == "" and j["punkt"]["opdateret"] == "2026-11-08" and j["punkt"]["oprettet"] == "2026-11-07", j)
t("ret: kun det, der sendes, ændres", ok("ret", {"id": 1, "status": "I gang"})["punkt"]["titel"] == "Ny titel")
t("ret: ugyldige værdier og ukendt punkt afvises uden at ændre noget", fejl("ret", {"id": 1, "status": "x"}, "Status") and fejl("ret", {"id": 1, "titel": ""}, "Titel mangler") and fejl("ret", {"id": 99, "status": "Idé"}, "findes ikke") and fejl("ret", {"id": "1", "status": "Idé"}, "Ukendt punkt") and fejl("ret", {"id": True, "status": "Idé"}, "Ukendt punkt") and fejl("ret", {"status": "Idé"}, "Ukendt punkt") and [p for p in ok("liste")["punkter"] if p["id"] == 1][0]["status"] == "I gang")
# stemmer
j = ok("stem", {"id": 1, "hvem": "Anna"}); t("stem: tilføjes (små bogstaver)", j["stemmer"] == ["anna"])
t("flere personer kan stemme, hver kun én gang", ok("stem", {"id": 1, "hvem": "Peter"})["stemmer"] == ["anna", "peter"] and ok("stem", {"id": 1, "hvem": "anna"})["stemmer"] == ["peter"], "")
t("samme stemme igen fjerner den (kan fortrydes), og stor/lille forskel tæller ikke", ok("stem", {"id": 1, "hvem": "PETER"})["stemmer"] == [] and ok("stem", {"id": 2, "hvem": "Sofie"})["stemmer"] == ["sofie"])
t("stem: navn mangler eller ukendt punkt", fejl("stem", {"id": 1}, "Navn mangler") and fejl("stem", {"id": 99, "hvem": "A"}, "findes ikke"))
c = 0
for i in range(45): c, j = kor("stem", {"id": 3, "hvem": f"p{i}"})
t("højst 40 stemmer pr. punkt", c == 1 and "flest mulige" in j["fejl"] and len(ok("liste")["punkter"][2]["stemmer"]) == 40)
# kommentarer
j = ok("kommentar", {"id": 1, "af": "Peter", "tekst": " Det vil vi gerne \nhave "}); t("kommentar: trimmet, med navn og dato", j["kommentarer"] == [{"af": "Peter", "tekst": "Det vil vi gerne \nhave", "tid": "2026-11-07"}], j)
t("kommentar: tom, for lang, uden navn og ukendt punkt afvises", fejl("kommentar", {"id": 1, "af": "P", "tekst": " "}, "Kommentar mangler") and fejl("kommentar", {"id": 1, "af": "P", "tekst": "x" * 1001}, "1000") and fejl("kommentar", {"id": 1, "tekst": "t"}, "Navn mangler") and fejl("kommentar", {"id": 99, "af": "P", "tekst": "t"}, "findes ikke"))
for i in range(50): ok("kommentar", {"id": 2, "af": "A", "tekst": f"k{i}"})
t("højst 50 kommentarer pr. punkt (den 51. afvises)", fejl("kommentar", {"id": 2, "af": "A", "tekst": "for meget"}, "højst være 50") and len(ok("liste")["punkter"][1]["kommentarer"]) == 50)
# slet
ok("nyt", {"titel": "Skal slettes", "af": "A"}); ids = [p["id"] for p in ok("liste")["punkter"]]; sl = ids[-1]
t("slet fjerner kun det punkt, og id'et genbruges ikke", ok("slet", {"id": sl})["ok"] and sl not in [p["id"] for p in ok("liste")["punkter"]] and ok("nyt", {"titel": "Efter sletning", "af": "A"})["punkt"]["id"] == sl + 1 and fejl("slet", {"id": sl}, "findes ikke"))
# eksport
p = ok("nyt", {"titel": "=SUM(A1:A9)", "beskrivelse": "med; semikolon\nog \"citat\"", "kategori": "bil", "prioritet": "P4", "af": "+Mallory"})["punkt"]
ok("ret", {"id": p["id"], "status": "Droppet"})
j = ok("eksport", {"format": "csv"}); rows = list(csv.reader(io.StringIO(j["indhold"].lstrip("\ufeff")), delimiter=";"))
t("CSV: BOM til Excel, semikolon, alle felter i citationstegn, og en overskrift", j["indhold"].startswith("\ufeff") and j["filnavn"] == "backlog.csv" and rows[0][:3] == ["id", "titel", "beskrivelse"] and len(rows) == len(ok("liste")["punkter"]) + 1)
r = [x for x in rows if x[0] == str(p["id"])][0]
t("CSV: formler (= + - @) og linjeskift gøres harmløse i regneark, så =SUM bliver tekst", r[1] == "'=SUM(A1:A9)" and r[6] == "'+Mallory" and "\n" not in r[2] and r[2].startswith("med; semikolon"), r)
j = ok("eksport", {"format": "md"}); md = j["indhold"]
t("Markdown: overskrift, tabel sorteret efter prioritet og stemmer, beskrivelser og kommentarer, rør-tegn i titler escapes", md.startswith("# Backlog") and "| # | Punkt | Kategori | Pri. | Status | Stemmer |" in md and md.index("| 1 |") < md.index(f"| {p['id']} |") and "Kommentarer:" in md and "- **Peter** (2026-11-07):" in md and j["filnavn"] == "backlog.md", md[:300])
j = ok("eksport", {"format": "json"}); jd = json.loads(j["indhold"])
t("JSON: kan læses igen, med alle punkter", jd["format"] == 1 and len(jd["punkter"]) == len(ok("liste")["punkter"]) and j["type"] == "application/json")
t("eksport: ukendt format afvises", fejl("eksport", {"format": "xls"}, "md, csv eller json"))
# import
rund = json.loads(ok("eksport", {"format": "json"})["indhold"])["punkter"]
j = ok("importer", {"punkter": rund}); t("import af det, der allerede findes, gør ingenting (samme titel og kategori springes over)", j["tilfoejet"] == 0 and j["sprunget_over"] == len(rund))
nye = [{"titel": "Importeret ét", "beskrivelse": "b", "kategori": "billeder", "prioritet": "P2", "status": "Planlagt", "af": "Dev", "oprettet": "2026-01-02", "stemmer": ["Anna", "anna", "Peter"], "kommentarer": [{"af": "Dev", "tekst": "hej"}]},
       {"titel": "importeret ét", "kategori": "billeder"}, {"titel": "Ugyldig", "kategori": "findes-ikke"}, "skrald", {"titel": "", "kategori": "bil"}, {"titel": "Uden dato", "oprettet": "i går"}]
j = ok("importer", {"punkter": nye}); lst = ok("liste")["punkter"]; imp = [x for x in lst if x["titel"] == "Importeret ét"][0]
t("import: nye lægges ind med nyt id, dublet (også med andre store/små bogstaver), ugyldige og skrald springes over", j["tilfoejet"] == 2 and j["sprunget_over"] == 4, j)
t("import: dato, status og prioritet bevares, stemmer renses for dubletter, kommentarer kommer med", imp["oprettet"] == "2026-01-02" and imp["status"] == "Planlagt" and imp["prioritet"] == "P2" and imp["stemmer"] == ["anna", "peter"] and imp["kommentarer"] == [{"af": "Dev", "tekst": "hej", "tid": "2026-11-07"}], imp)
t("import: en ugyldig dato bliver dagens", [x for x in lst if x["titel"] == "Uden dato"][0]["oprettet"] == "2026-11-07")
t("import: tom liste og ikke-liste afvises", fejl("importer", {"punkter": []}, "1 til 500") and fejl("importer", {"punkter": "x"}, "1 til 500") and fejl("importer", {}, "1 til 500"))
# opdater: en fil med «opdater: true» ændrer status og kommentarer på punkter, der findes
j = ok("importer", {"punkter": [{"titel": "importeret ét", "kategori": "billeder"}]}); t("uden «opdater» springes et punkt, der findes, stadig over", j["tilfoejet"] == 0 and j["sprunget_over"] == 1 and j["opdateret"] == 0, j)
foer = [x for x in ok("liste")["punkter"] if x["titel"] == "Importeret ét"][0]
j = ok("importer", {"opdater": True, "punkter": [{"titel": "IMPORTERET ét", "kategori": "billeder", "status": "Færdig", "prioritet": "P1", "kommentarer": [{"af": "Udvikling", "tekst": "Bygget i 3.4.0"}]}, {"titel": "Helt nyt punkt", "kategori": "andet", "status": "Planlagt"}, {"titel": "Importeret ét", "kategori": "billeder", "status": "ugyldig"}]})
efter = [x for x in ok("liste")["punkter"] if x["titel"] == "Importeret ét"][0]
t("med «opdater: true» opdateres status og prioritet, kommentaren lægges til (titel uanset store/små bogstaver), og nye punkter lægges stadig ind", j["opdateret"] == 1 and j["tilfoejet"] == 1 and j["sprunget_over"] == 1 and efter["status"] == "Færdig" and efter["prioritet"] == "P1" and efter["kommentarer"][-1] == {"af": "Udvikling", "tekst": "Bygget i 3.4.0", "tid": "2026-11-07"} and efter["id"] == foer["id"] and len(efter["stemmer"]) == len(foer["stemmer"]), (j, efter))
t("opdateringen beholder id, stemmer, beskrivelse og den oprindelige titel; kun en ugyldig status afvises (uden at ændre noget)", efter["beskrivelse"] == foer["beskrivelse"] and efter["titel"] == "Importeret ét" and efter["oprettet"] == foer["oprettet"])
t("«opdater» skal være præcis true (ikke en tekst eller et tal)", ok("importer", {"opdater": "ja", "punkter": [{"titel": "Importeret ét", "kategori": "billeder", "status": "Idé"}]})["opdateret"] == 0)
# loft
tmp2 = tempfile.mkdtemp(prefix="fo-b2-"); os.makedirs(f"{tmp2}/data/private"); E2 = {**E, "FO_DATA": f"{tmp2}/data"}
big = [{"titel": f"P{i}", "kategori": "andet"} for i in range(500)]
r = subprocess.run([sys.executable, BOOT, "backlog", "importer"], input=json.dumps({"punkter": big}).encode(), capture_output=True, env=E2); jr = json.loads(r.stdout.decode().strip().splitlines()[-1])
t("500 punkter kan lægges ind", jr["tilfoejet"] == 500, jr)
r = subprocess.run([sys.executable, BOOT, "backlog", "nyt"], input=json.dumps({"titel": "501", "af": "A"}).encode(), capture_output=True, env=E2); jr = json.loads(r.stdout.decode().strip().splitlines()[-1])
t("det 501. punkt afvises med en forklaring", r.returncode == 1 and "højst være 500" in jr["fejl"])
# samtidighed: mange samtidige nye punkter må ikke miste noget
tmp3 = tempfile.mkdtemp(prefix="fo-b3-"); os.makedirs(f"{tmp3}/data/private"); E3 = {**E, "FO_DATA": f"{tmp3}/data"}
def tilfoej(i): subprocess.run([sys.executable, BOOT, "backlog", "nyt"], input=json.dumps({"titel": f"Samtidig {i}", "af": "A"}).encode(), capture_output=True, env=E3)
ts = [threading.Thread(target=tilfoej, args=(i,)) for i in range(12)]; [x.start() for x in ts]; [x.join() for x in ts]
fil = json.load(open(f"{tmp3}/data/private/backlog.json")); ids = [x["id"] for x in fil["punkter"]]
t("12 samtidige nye punkter: ingen går tabt, og id'erne er forskellige (filen er låst)", len(ids) == 12 and len(set(ids)) == 12, ids)
# ødelagt fil og ukendte kommandoer
open(f"{tmp3}/data/private/backlog.json", "w").write("{ødelagt")
r = subprocess.run([sys.executable, BOOT, "backlog", "liste"], input=b"{}", capture_output=True, env=E3)
t("en ødelagt backlog.json giver en tom liste i stedet for et nedbrud", r.returncode == 0 and json.loads(r.stdout.decode().strip().splitlines()[-1])["punkter"] == [])
t("ukendt handling og ikke-JSON giver en fejl", fejl("noget", {}, "Ukendt") and subprocess.run([sys.executable, BOOT, "backlog", "nyt"], input=b"ikke json", capture_output=True, env=E).returncode == 1 and subprocess.run([sys.executable, BOOT, "backlog", "nyt"], input=b"[1]", capture_output=True, env=E).returncode == 1)
# med i sikkerhedskopi: ligger i private/
t("backlog.json ligger i private/, som er med i sikkerhedskopien og spærret for web", os.path.dirname(f"{tmp}/data/private/backlog.json").endswith("private"))
raise SystemExit(0 if ok_all else 1)
