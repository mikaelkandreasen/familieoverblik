"""Pakker en udgave: zip-filen og trin-for-trin-guiden til Notepad++.
   python3 vaerktoej/pak.py [--ud MAPPE]        (standard: mappen over projektet)
Laver  familieoverblik-<VERSION>.zip  (alt i en mappe «familieoverblik/», uden __pycache__ og skabeloner til sprog)  og
       FAMILIEOVERBLIK-v<VERSION>-step-by-step.txt  (ud fra GUIDE-V3.md: UTF-8 med BOM, CRLF, 78 tegn pr. linje, ingen tabulatorer).
Zip-filen indeholder .github/workflows/billeder.yml, selvom en browser-upload ikke kan tage den med (der ligger en kopi i github-workflow/)."""
import os, re, sys, textwrap, zipfile
ROD = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BREDDE = 78
UDEN = ("__pycache__",)
def skal_med(rel):
    dele = rel.split("/")
    if any(d in UDEN for d in dele) or rel.endswith(".pyc"): return False
    if rel.startswith("sprog/skabelon-"): return False
    return True
def version(): return open(os.path.join(ROD, "VERSION"), encoding="utf-8").read().strip()
def lav_zip(ud):
    sti = os.path.join(ud, f"familieoverblik-{version()}.zip"); n = 0
    with zipfile.ZipFile(sti, "w", zipfile.ZIP_DEFLATED) as z:
        for rod, mapper, filer in os.walk(ROD):
            mapper[:] = sorted(d for d in mapper if d not in UDEN and d != ".git")
            for f in sorted(filer):
                p = os.path.join(rod, f); rel = os.path.relpath(p, ROD).replace(os.sep, "/")
                if skal_med(rel): z.write(p, "familieoverblik/" + rel); n += 1
    return sti, n
def rens(t): return re.sub(r"`([^`]*)`", r"\1", re.sub(r"\*\*([^*]+)\*\*", r"\1", re.sub(r"\*([^*]+)\*", r"\1", t)))
def md_til_kilde(md):
    """Markdown-guiden → en enkel tekstform med numrerede trin («[ ] 1.2.3  …»)."""
    ud = []; sek = ""; n = 0; kode = False
    for l in md.split("\n"):
        if l.startswith("```"): kode = not kode; continue
        if kode:
            if "GitHub (dit repo)" in l: ud += ["    1. GitHub: dit repo (du uploader filerne)", "    2. GitHub bygger billederne og lægger dem i ghcr.io (register)", "    3. Dockhand henter dem og starter 4 containere (+ volume med dine data)"]
            elif "du uploader filerne" in l: pass
            else: ud.append("    " + l)
            continue
        if l.startswith("# ") and not l.startswith("## "): ud += ["# " + rens(l[2:]), ""]; continue
        if l.startswith("## "): ud += ["# " + rens(re.sub(r"^\d+\.\s*", "", l[3:])), ""]; sek = (re.match(r"## (\d+)\.", l) or [None, ""])[1]; n = 0; continue
        if l.startswith("### "):
            ud += ["## " + rens(re.sub(r"^\d+\.\d+\s*", "", l[4:])), ""]; m = re.match(r"### (\d+\.\d+)", l); sek = m.group(1) if m else sek; n = 0; continue
        m = re.match(r"^(\d+)\.\s+(.*)$", l)
        if m: n += 1; ud.append(f"[ ] {sek}.{n}  " + rens(m.group(2))); continue
        if l.startswith("|"):
            c = [rens(x.strip()) for x in l.strip("|").split("|")]
            if set("".join(c)) <= set("-: ") or c[0] in ("Variabel", "Symptom"): continue
            ud.append("- " + c[0] + ": " + " ".join(c[1:])); continue
        if l.startswith("- "): ud.append("- " + rens(l[2:])); continue
        ud.append("" if l.strip() == "" else rens(l))
    return "\n".join(ud).replace("Dockhand → ", "Dockhand > ").replace("→", ">")
def kilde_til_txt(kilde):
    ud = []
    def wrap(t, foerste, rest): return textwrap.wrap(t, width=BREDDE, initial_indent=foerste, subsequent_indent=rest, break_long_words=False, break_on_hyphens=False) or [foerste.rstrip()]
    def blank():
        if ud and ud[-1] != "": ud.append("")
    for raw in kilde.split("\n"):
        l = raw.rstrip()
        if l == "": blank(); continue
        if l.startswith("# "): blank(); ud += ["=" * BREDDE, l[2:], "=" * BREDDE, ""]; continue
        if l.startswith("## "): blank(); tt = l[3:]; ud += [tt, "-" * min(len(tt), BREDDE), ""]; continue
        m = re.match(r"^\[ \] (\S+)\s+(.*)$", l)
        if m:
            if ud and ud[-1] != "" and not ud[-1].startswith("[ ]"): blank()
            pre = f"[ ] {m.group(1)}  "; ud += wrap(m.group(2), pre, " " * len(pre)); continue
        if l.startswith("$ "): ud.append(" " * 9 + l); continue
        if l.startswith("    ") or l.startswith("         "): ud.append(" " * 9 + l.lstrip()); continue
        if l.startswith("- "): ud += wrap(l[2:], "  - ", "    "); continue
        ud += wrap(l, "", "")
    res = []
    for l in ud:
        if l == "" and res and res[-1] == "": continue
        res.append(l)
    while res and res[-1] == "": res.pop()
    return "\r\n".join(res) + "\r\n"
def lav_guide(ud):
    sti = os.path.join(ud, f"FAMILIEOVERBLIK-v{version()}-step-by-step.txt")
    tekst = kilde_til_txt(md_til_kilde(open(os.path.join(ROD, "GUIDE-V3.md"), encoding="utf-8").read()))
    with open(sti, "w", encoding="utf-8-sig", newline="") as f: f.write(tekst)
    return sti, tekst
if __name__ == "__main__":
    ud = os.path.dirname(ROD)
    if "--ud" in sys.argv: ud = sys.argv[sys.argv.index("--ud") + 1]
    os.makedirs(ud, exist_ok=True)
    z, n = lav_zip(ud); g, tekst = lav_guide(ud)
    lange = [i + 1 for i, l in enumerate(tekst.split("\r\n")) if len(l) > 82 and not l.lstrip().startswith("$")]
    print(f"{z}: {n} filer\n{g}: {len(tekst.splitlines())} linjer, {sum(l.startswith('[ ]') for l in tekst.splitlines())} trin, lange linjer: {lange[:5] or 'ingen'}")
