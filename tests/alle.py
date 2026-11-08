"""Kører ALLE prøver (Python og JavaScript) og skriver en samlet oversigt.   python3 tests/alle.py   (--uden-js hopper node-prøverne over)
Kræver Python 3.11+ og Node 22+. PHP, Apache og Docker er IKKE nødvendige (og bruges ikke). test_rettigheder.py springer sig selv over, hvis man ikke er root."""
import os, subprocess, sys, time
ROD = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PY = ["test_skjulte_filer", "test_stier", "test_bootstrap", "test_scripts", "test_opbygning", "test_totp", "test_backlog", "test_aulapatch", "test_aula_diagnose", "test_aula_overdrag", "test_aaben_visning", "test_pak", "test_praesentation", "test_rettigheder"]
def koer(cmd):
    t0 = time.time(); r = subprocess.run(cmd, capture_output=True, text=True, cwd=ROD)
    return r.returncode == 0, sum(1 for l in r.stdout.splitlines() if l.startswith("ok")), [l[:170] for l in r.stdout.splitlines() if l.startswith("FEJL")][:3], time.time() - t0, r.stdout, r.stderr
alt_ok = True; sum_ok = 0
for navn in PY:
    ok, n, fejl, sek, ud, err = koer([sys.executable, f"tests/{navn}.py"]); alt_ok &= ok; sum_ok += n
    print(f"{navn:24} {'ok  ' if ok else 'FEJL'} {n:>5} prøver  {sek:5.1f} s", *fejl, (err.strip().splitlines() or [""])[-1][:160] if not ok else "")
if "--uden-js" not in sys.argv:
    ok, n, fejl, sek, ud, err = koer([sys.executable, "tests/frontend/kor_alle.py"]); alt_ok &= ok
    linjer = ud.strip().splitlines()
    for l in linjer:
        if " FEJL " in l: print("   ", l[:200])
    print(f"{'JavaScript (alle sider)':24} {'ok  ' if ok else 'FEJL'} {linjer[-1] if linjer else err[-200:]}  {sek:5.1f} s")
print(f"\nPython i alt: {sum_ok} prøver. {'ALT GRØNT' if alt_ok else 'DER ER FEJL'}")
sys.exit(0 if alt_ok else 1)
