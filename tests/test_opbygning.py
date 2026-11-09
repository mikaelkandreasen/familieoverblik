"""Statiske kontroller af compose, GitHub-workflow og Dockerfiles: at de peger på filer, der findes, og at de passer sammen."""
import os, re, stat, yaml
ROD = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ok_all = True
def t(n, c, x=""):
    global ok_all; ok_all &= bool(c); print("ok  " if c else "FEJL", n, "" if c else x)
L = lambda p: open(os.path.join(ROD, p), encoding="utf-8").read()
c = yaml.safe_load(L("compose.yaml")); raw = L("compose.yaml")
t("compose: fire services (web, cron, aula, bil) og to volumes", set(c["services"]) == {"web", "cron", "aula", "bil"} and set(c["volumes"]) == {"familieoverblik-data", "familieoverblik-aula-login"})
t("compose: ingen build: og ingen bind-mounts til værten (alt er billeder og volumes)", all("build" not in s for s in c["services"].values()) and not re.search(r"^\s+- [./~]", raw, re.M))
t("compose: billederne hentes fra registeret, og FAMILIE_REGISTER er påkrævet", all(s["image"].startswith("${FAMILIE_REGISTER") and ":${FAMILIE_VERSION:-3}" in s["image"] for s in c["services"].values()) and ":?" in c["services"]["web"]["image"])
t("compose: kun disse variabler bruges: FAMILIE_REGISTER, FAMILIE_VERSION, FAMILIE_PORT, FAMILIE_LAN_IP, TZ", set(re.findall(r"\$\{([A-Z_]+)[:}]", raw)) == {"FAMILIE_REGISTER", "FAMILIE_VERSION", "FAMILIE_PORT", "FAMILIE_LAN_IP", "TZ"}, set(re.findall(r"\$\{([A-Z_]+)[:}]", raw)))
t("compose: standardporten er 8085 (udefra) og 80 inde i containeren, og den kan overstyres med FAMILIE_PORT", c["services"]["web"]["ports"][0] == "${FAMILIE_LAN_IP:-0.0.0.0}:${FAMILIE_PORT:-8085}:80" and "8080" not in raw.replace("8085", ""))
t("compose: web har datavolumet på /var/www/ugeplan-data, og porten er bundet til FAMILIE_LAN_IP", "familieoverblik-data:/var/www/ugeplan-data" in c["services"]["web"]["volumes"] and c["services"]["web"]["ports"][0].startswith("${FAMILIE_LAN_IP"))
t("compose: aula har data, Aula-login-volumet og en terminal (stdin_open + tty) til MitID-login", "familieoverblik-data:/data" in c["services"]["aula"]["volumes"] and "familieoverblik-aula-login:/root/.config/aula" in c["services"]["aula"]["volumes"] and c["services"]["aula"]["stdin_open"] is True and c["services"]["aula"]["tty"] is True)
t("compose: cron får kun læseadgang til data", "familieoverblik-data:/data:ro" in c["services"]["cron"]["volumes"])
t("compose: alle services genstarter af sig selv", all(s.get("restart") == "unless-stopped" for s in c["services"].values()))
f = yaml.safe_load(L("compose-frameo.yaml"))
t("compose-frameo: én service, påkrævet FRAMEO_IP, det eksterne datavolume", list(f["services"]) == ["frameo"] and "FRAMEO_IP:?" in f["services"]["frameo"]["environment"]["FRAMEO_IP"] and f["volumes"]["familieoverblik_familieoverblik-data"]["external"] is True)
# Dockerfiles
for navn in ("web", "aula", "bil", "cron", "frameo"):
    d = L(f"docker/{navn}/Dockerfile")
    kilder = re.findall(r"^COPY\s+(.+?)\s+\S+\s*$", d, re.M)
    mangler = [p for linje in kilder for p in linje.split() if not os.path.exists(os.path.join(ROD, p.rstrip("/")))]
    t(f"Dockerfile {navn}: alle COPY-kilder findes i projektet", not mangler, mangler)
    t(f"Dockerfile {navn}: label med versionen", "org.opencontainers.image.version" in d and "ARG VERSION" in d)
for navn in ("aula", "bil"):
    d = L(f"docker/{navn}/Dockerfile")
    t(f"Dockerfile {navn}: Python-versionen er et argument (fallback i workflow)", re.match(r"(#.*\n)*ARG PYTHON_VERSION=3\.1\d\nFROM python:\$\{PYTHON_VERSION\}-slim", d))
t("Dockerfile web: python3 (ikke python3-minimal, som mangler json/tarfile), tzdata og de rigtige Apache-moduler", "install -y --no-install-recommends python3 tzdata" in L("docker/web/Dockerfile") and "python3-minimal" not in L("docker/web/Dockerfile") and "a2enmod rewrite headers" in L("docker/web/Dockerfile"))
t("Dockerfile web: entrypoint og bootstrap lægges ind, og datavolumet er erklæret", "ENTRYPOINT" in L("docker/web/Dockerfile") and "VOLUME /var/www/ugeplan-data" in L("docker/web/Dockerfile"))
t("Dockerfile aula: PYTHONPATH finder tilføjelsen og config.py fra volumet, og tilstanden ligger i volumet", "PYTHONPATH=/patch:/data/private/aula-config" in L("docker/aula/Dockerfile") and "AULA_STATE_DIR=/data/private/aula-state" in L("docker/aula/Dockerfile"))
t("Dockerfile aula: aula==1.16.0 og Python 3.14 som standard (aula 1.x kræver mindst 3.14)", "aula==1.16.0" in L("docker/aula/Dockerfile") and "ARG PYTHON_VERSION=3.14" in L("docker/aula/Dockerfile"))
# En browser-upload til GitHub og en udpakning med Pythons zipfile mister «kørbar»-markeringen. Derfor må billederne ikke afhænge af den:
# scriptet skal enten gøres kørbart i Dockerfilen (chmod +x) eller startes med «sh script».
for sh in ("docker/web/entrypoint.sh", "docker/aula/loop.sh", "docker/cron/cron.sh"):
    dfil = L(os.path.dirname(sh) + "/Dockerfile"); navn = os.path.basename(sh)
    t(f"{sh}: starter med #!/bin/sh, og Dockerfilen gør det kørbart eller starter det med sh (ikke afhængig af filens rettigheder)", L(sh).startswith("#!/bin/sh") and (f"chmod +x /opt/familieoverblik/{navn}" in dfil or re.search(r'"sh",\s*"[^"]*' + re.escape(navn) + '"', dfil)))
t("entrypoint: kører bootstrap start og overlader så til Apaches egen entrypoint", "bootstrap.py start" in L("docker/web/entrypoint.sh") and 'exec docker-php-entrypoint "$@"' in L("docker/web/entrypoint.sh"))
# workflow
w = yaml.safe_load(L(".github/workflows/billeder.yml")); on = w.get(True, w.get("on"))
t("workflow: kører ved tag v*, manuelt og hver uge (sikkerhedsrettelser i basisbillederne), og må kun læse kode og skrive pakker", on["push"]["tags"] == ["v*"] and "workflow_dispatch" in on and on["schedule"][0]["cron"] == "17 3 * * 1" and w["permissions"] == {"contents": "read", "packages": "write"})
b = w["jobs"]["billeder"]
t("workflow: bygger alle fem billeder, og først efter prøverne", b["strategy"]["matrix"]["billede"] == ["web", "aula", "bil", "cron", "frameo"] and b["needs"] == "proev")
t("workflow: prøverne kører Python-prøvesættene (opstart, scripts, totrinsbekræftelse, backlog)", all(x in str(w["jobs"]["proev"]) for x in ("tests/test_bootstrap.py", "tests/test_scripts.py", "tests/test_totp.py", "tests/test_backlog.py", "tests/frontend/kor_alle.py", "tests/test_aaben_visning.py", "tests/test_aula_overdrag.py", "tests/test_brev.py", "tests/test_kantine.py", "tests/test_ics.py", "tests/test_onsker.py", "tests/test_sync_breve.py", "tests/test_stier.py", "tests/test_pak.py", "tests/test_praesentation.py", "tests/test_offentlig.py")))
trin = {s.get("name") or s.get("uses"): s for s in b["steps"]}
t("workflow: login til ghcr.io med GITHUB_TOKEN (ingen hemmeligheder skal oprettes)", "docker/login-action@v3" in trin and trin["docker/login-action@v3"]["with"]["registry"] == "ghcr.io" and "GITHUB_TOKEN" in trin["docker/login-action@v3"]["with"]["password"])
t("workflow: Python 3.15 først (må fejle), 3.14 bagefter kun hvis 3.15 ikke lykkedes", trin["Byg (Python 3.15)"]["continue-on-error"] is True and "PYTHON_VERSION=3.15" in trin["Byg (Python 3.15)"]["with"]["build-args"] and "steps.py315.outcome != 'success'" in trin["Byg (Python 3.14)"]["if"] and "PYTHON_VERSION=3.14" in trin["Byg (Python 3.14)"]["with"]["build-args"])
t("workflow: alle byggetrin bruger projektets rod som context og docker/<billede>/Dockerfile", all(s["with"]["context"] == "." and s["with"]["file"] == "docker/${{ matrix.billede }}/Dockerfile" for n, s in trin.items() if n in ("Byg (Python 3.15)", "Byg (Python 3.14)", "Byg")))
t("workflow: tre tags pr. billede (version, major, latest), med små bogstaver i ejernavnet", all(all(x in s["with"]["tags"] for x in ("version }}", "major }}", ":latest")) for n, s in trin.items() if n.startswith("Byg")) and ",," in trin["Navne og versioner"]["run"])
t("workflow: det rigtige billede bygges kun én gang pr. matrixfelt", sum(1 for n, s in trin.items() if n.startswith("Byg")) == 3 and trin["Byg"]["if"] == "matrix.billede != 'aula' && matrix.billede != 'bil'")
# versionering
v = L("VERSION").strip()
t("VERSION er 3.x.y og version.json passer", re.fullmatch(r"3\.\d+\.\d+", v) and f'"version": "{v}"' in L("public_html/version.json"))
t("CHANGELOG har en sektion for versionen", f"## [{v}]" in L("CHANGELOG.md"))
raise SystemExit(0 if ok_all else 1)
