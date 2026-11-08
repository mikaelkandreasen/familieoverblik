"""Prøver præsentationen til GitHub og sociale medier: links, billeder, diagram, opslagenes længde, og at der ikke står personnavne eller hemmeligheder i de offentlige filer."""
import os, re, struct, sys, xml.etree.ElementTree as ET
ROD = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ok_all = True
def t(n, c, x=""):
    global ok_all; ok_all &= bool(c); print("ok  " if c else "FEJL", n, "" if c else x)
L = lambda p: open(os.path.join(ROD, p), encoding="utf-8").read()
def png_mal(p):
    b = open(os.path.join(ROD, p), "rb").read(24)
    return struct.unpack(">II", b[16:24]) if b[:8] == b"\x89PNG\r\n\x1a\n" else None
READMES = ("README.md", "README.en.md", "docs/DELING.md")
for r in READMES:
    manglende = []
    for m in re.finditer(r"\]\(([^)\s]+)\)", L(r)):
        mal = m.group(1)
        if mal.startswith(("http://", "https://", "#", "mailto:")): continue
        sti = os.path.normpath(os.path.join(os.path.dirname(os.path.join(ROD, r)), mal.split("#")[0]))
        if not os.path.exists(sti): manglende.append(mal)
    t(f"{r}: alle relative links og billeder peger på filer, der findes", not manglende, manglende)
t("det sociale kort er 1280×640 (GitHubs anbefaling), og LinkedIn-udgaven er 1200×630, begge under 1 MB", png_mal("docs/social-preview.png") == (1280, 640) and png_mal("docs/social-linkedin-1200x630.png") == (1200, 630) and all(os.path.getsize(os.path.join(ROD, p)) < 1_000_000 for p in ("docs/social-preview.png", "docs/social-linkedin-1200x630.png")))
try:
    svg = ET.parse(os.path.join(ROD, "docs", "arkitektur.svg")).getroot(); sv_ok = svg.tag.endswith("svg") and svg.get("viewBox") and any(e.tag.endswith("title") for e in svg.iter())
except ET.ParseError as e: sv_ok = False
t("diagrammet er gyldig SVG med en viewBox og en titel (til skærmlæsere)", sv_ok)
poster = re.findall(r"<!-- maks: (\d+) -->\n```\n(.*?)\n```", L("docs/DELING.md"), re.S)
t(f"alle {len(poster)} opslag og tekster i DELING.md holder sig inden for deres længdegrænse", len(poster) >= 7 and all(len(tekst) <= int(maks) for maks, tekst in poster), [(m, len(x)) for m, x in poster if len(x) > int(m)])
t("de to README'er hører sammen: begge har de samme afsnit i samme rækkefølge (antal overskrifter ens) og peger på hinanden", len(re.findall(r"^## ", L("README.md"), re.M)) == len(re.findall(r"^## ", L("README.en.md"), re.M)) and "README.en.md" in L("README.md") and "README.md" in L("README.en.md"))
alt = "\n".join(L(r) for r in READMES)
t("README'erne er ærlige: de siger, at projektet er uofficielt og en tidlig udgave, og at Aula-login ikke er prøvet mod Aula", all(x in L("README.md") for x in ("Uofficielt", "Tidlig udgave", "prøvet mod en simulering, ikke mod Aula")) and all(x in L("README.en.md") for x in ("Unofficial", "Early release", "simulation, not Aula itself")))
lic = L("LICENSE")
t("licensen er MIT, med årstal og et neutralt ophavsretsnavn (ingen personnavne), og har den almindelige ansvarsfraskrivelse", lic.startswith("MIT License\n") and "Copyright (c) 2026 Familieoverblik contributors" in lic and 'THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND' in lic and "Permission is hereby granted, free of charge" in lic)
t("README'erne siger, at det er open source under MIT og peger på LICENSE og THIRD_PARTY.md, og siger det kun, fordi LICENSE findes", os.path.exists(os.path.join(ROD, "LICENSE")) and all(x in L("README.md") for x in ("MIT-licensen](LICENSE)", "THIRD_PARTY.md")) and all(x in L("README.en.md") for x in ("MIT licence](LICENSE)", "THIRD_PARTY.md")))
tp = L("THIRD_PARTY.md")
t("THIRD_PARTY.md nævner bibliotekerne fra Dockerfilerne med de versioner, de faktisk installerer, og at der ikke er kopieret tredjepartskode ind", all(v in L(f) for f, v in (("docker/aula/Dockerfile", "aula==1.16.0"), ("docker/bil/Dockerfile", "hyundai-kia-connect-api==4.49.0"))) and "aula`](https://pypi.org/project/aula/) 1.16.0" in tp and "hyundai-kia-connect-api`](https://pypi.org/project/hyundai-kia-connect-api/) 4.49.0" in tp and "ingen tredjepartskode kopieret" in tp.lower())
t("de opslag, der nævner licensen, siger MIT (og ingen siger «open source» uden at LICENSE findes)", "MIT" in L("docs/DELING.md") and ("open source" not in L("docs/DELING.md").lower() or os.path.exists(os.path.join(ROD, "LICENSE"))))
t("ingen hemmeligheder eller personlige adresser i de offentlige filer (nøgler, e-mailadresser, IP-adresser, brugernavne i ghcr-adresser)", not re.search(r"sk-ant-|[\w.+-]+@[\w-]+\.\w+|\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b|ghcr\.io/(?!dit-github-brugernavn|your-github-username|<)\w", alt))
t("README'erne nævner de rigtige porte og filer (8085, GUIDE-V3.md, compose.yaml, FAMILIE_REGISTER), så kom-i-gang passer til projektet", all(x in L("README.md") for x in ("8085", "GUIDE-V3.md", "compose.yaml", "FAMILIE_REGISTER")) and "8085" in L("compose.yaml") and "FAMILIE_REGISTER" in L("compose.yaml"))
sys.exit(0 if ok_all else 1)
