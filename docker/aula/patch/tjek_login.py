"""Viser, om aula-biblioteket selv kender de to sider efter MitID, og om tilføjelsen er slået til.
Kør:  ./lokal/hjaelp.sh aula-tjek-login   Skriver kun filnavne og linjenumre, ingen kode og ingen hemmeligheder."""
import importlib.util
import os
import pathlib
import sys

ord_ = ["selected-aktoer", "KONTAKT", "ACCEPT", "confirmation-button", "post-broker-login", "first-broker-login"]
spec = importlib.util.find_spec("aula")
print("python:", sys.version.split()[0])
try:
    import httpx
    print("httpx:", httpx.__version__, "| tilføjelsen aktiv:", bool(getattr(httpx, "_familieoverblik_aula_forms", False)))
except ImportError:
    print("httpx: findes ikke")
print("AULA_LOGIN_PATCH =", os.environ.get("AULA_LOGIN_PATCH", "1"), "| AULA_AKTOER =", os.environ.get("AULA_AKTOER", "KONTAKT"))
if not spec or not spec.submodule_search_locations:
    print("aula-biblioteket er ikke installeret her.")
    sys.exit(1)
rod = pathlib.Path(list(spec.submodule_search_locations)[0])
print("aula-biblioteket ligger i", rod)
fundet = {o: [] for o in ord_}
for f in sorted(rod.rglob("*.py")):
    for i, linje in enumerate(f.read_text(encoding="utf-8", errors="replace").splitlines(), 1):
        for o in ord_:
            if o in linje:
                fundet[o].append(f"{f.relative_to(rod)}:{i}")
for o in ord_:
    steder = fundet[o]
    print(f"  {o:20s} {len(steder)} steder" + (f"  ({', '.join(steder[:4])}{' …' if len(steder) > 4 else ''})" if steder else ""))
print()
if fundet["selected-aktoer"] or fundet["confirmation-button"]:
    print("Biblioteket nævner selv rolle- eller bekræftelsessiden. Virker login uden tilføjelsen, så sæt AULA_LOGIN_PATCH=0.")
else:
    print("Biblioteket kender ikke rolle- eller bekræftelsessiden. Tilføjelsen klarer dem (hvis den er aktiv).")
