"""Kører ALLE frontend-prøver (node) efter at have skåret blokkene ud. python3 tests/frontend/kor_alle.py  → en linje pr. fil og en samlet sum."""
import glob, os, subprocess, sys
D = os.path.dirname(os.path.abspath(__file__)); ROD = os.path.dirname(os.path.dirname(D))
r = subprocess.run([sys.executable, os.path.join(D, "udtraek.py")], capture_output=True, text=True)
if r.returncode: print(r.stdout, r.stderr[-600:]); sys.exit(2)
fejl = 0; sum_ok = 0
for f in sorted(glob.glob(os.path.join(D, "*.mjs"))):
    if os.path.basename(f) in ("el_test.mjs",): pass
    p = subprocess.run(["node", f], capture_output=True, text=True, cwd=ROD); n = sum(1 for l in p.stdout.splitlines() if l.startswith("ok")); sum_ok += n
    bad = [l[:160] for l in p.stdout.splitlines() if l.startswith("FEJL")]
    print(f"{os.path.basename(f):28}", "ok  " if p.returncode == 0 else "FEJL", f"{n:>4}", *bad[:3])
    fejl += p.returncode != 0
print(f"i alt {sum_ok} prøver, {fejl} filer med fejl"); sys.exit(1 if fejl else 0)
