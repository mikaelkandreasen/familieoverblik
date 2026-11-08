"""Skærer de dele ud af siderne, som frontend-prøverne tester, og lægger dem i /tmp. Kør først: python3 tests/frontend/udtraek.py
Hver blok starter ved en markør i sidens script og slutter ved den næste. Findes en markør ikke, stopper scriptet med en tydelig fejl (så en omdøbt sektion ikke går ubemærket hen)."""
import os, re, sys
ROD = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
P = os.path.join(ROD, "public_html") + "/"
L = lambda f: open(P + f, encoding="utf-8").read()
idx, ov, bh = L("index.html"), L("overblik.html"), L("billeder.html")
def put(navn, txt): open(f"/tmp/{navn}", "w", encoding="utf-8").write(txt)
def skær(s, a, b=None, med_slut=False):
    i = s.index(a)
    if b is None: return s[i:]
    j = s.index(b, i)
    return s[i:j + (len(b) if med_slut else 0)]
# index.html
put("ind_block.js", skær(idx, '/* ── Indkøbsseddel (Microsoft To Do)', '$("indHent").addEventListener("click", indLaes);', True))
put("elp_block.js", skær(idx, '/* ── Elpris-indstillinger', 'elpLaes();\n', True))
put("st_block.js", skær(idx, '/* ── Strava ─', '$("stLuk").addEventListener("click", () => stDlg.close());', True))
put("tg_block.js", skær(idx, '/* ── Tegneserie (GoComics)', '\ntgLaes();\n', True))
put("bi_block.js", skær(idx, '/* ── Pauseskærm (billeder)', '\nbiLaes();\n', True))
put("bilidx_block.js", skær(idx, '/* ── Bil (Hyundai)', '\nbilLaes();\n', True))
put("jokeidx_block.js", skær(idx, '/* ── Dagens joke (indstillinger)', '/* ── Vejr (indstillinger)'))
put("vejridx_block.js", skær(idx, '/* ── Vejr (indstillinger)', '/* ── Sprog (indstillinger)'))
put("sprogidx_block.js", skær(idx, '/* ── Sprog (indstillinger)', '/* ── Farver (tema.php)'))
put("temaidx_block.js", skær(idx, '/* ── Farver (tema.php)', '// Versionen i «Om»'))
put("ops_block.js", skær(idx, '/* ── Opsætning som træ', '/* ── Opstart'))
put("aff_idx_block.js", skær(idx, '/* ── Tømning (settings/affald)', '/* ── Opsætning som træ'))
put("kilde_block.js", skær(ov, 'function kalenderKilde(x){', 'function kildeAf'))
put("vl_idx_block.js", skær(idx, '/* ── Tilfældig vælger: egne lister', '/* ── Opsætning som træ'))
put("fs_block.js", skær(ov, '// ── Fuld skærm ──', '// ── Layout: flyt og klap kort sammen'))
put("aff_pdf_block.js", skær(idx, '/* ── Tømning: læs fra PDF', '/* ── Slut: tømning PDF ── */'))
put("kant_block.js", skær(ov, '// ── Kantine ──', '// ── Slut: kantine ──'))
put("brev_block.js", skær(ov, '// ── Ugebrev: tekst og afsnit ──', '// ── Slut: ugebrev ──'))
put("faner_block.js", skær(idx, '// ── Faner og links ──', '// ── Slut: faner og links ──'))
put("fam_block.js", skær(idx, '/* ── Familie og forbindelser (indstillinger)', '/* ── Login og sikkerhed'))
put("to_block.js", skær(idx, '/* ── Login og sikkerhed (totrinsbekræftelse)', '/* ── Sprog (indstillinger)'))
# overblik.html
M = [('el', '// ── Elpris ──', 'async function hentElpris()'), ('stov', '// ── Strava (kortet', 'async function hentStrava()'), ('bilov', '// ── Bil (Hyundai)', 'async function hentBil()'),
     ('tgov', '// ── Gårsdagens tegneserie (GoComics)', 'async function hentTegneserie()'), ('ps', '// ── Pauseskærm ──', '// ── Fuld skærm ──')]
for n, a, b in M: put({"el": "el_block.js", "stov": "stov_block.js", "bilov": "bilov_block.js", "tgov": "tgov_block.js", "ps": "ps_block.js"}[n], skær(ov, a, b))
put("aff_ov_block.js", skær(ov, '/* ── Tømning (settings/affald)', '/* ── Hentning'))
lay = ov.index('// ── Layout: flyt og klap kort sammen'); cl = ov.index('// ── Ændringslog ──', lay)
c1 = ov.index('// ── Farver (tema.php)', cl); fd = ov.index('// ── Fødselsdage: flag og tema', c1); m1 = ov.index('// ── Menu (Sider', fd); j1 = ov.index('// ── Dagens joke (joke.php)', m1); v1 = ov.index('// ── Vejrkort (vejr.php)', j1); c2 = ov.index('// Sprog og «Oversæt siden»', v1)
put("lay_block.js", ov[lay:cl]); put("clov_block.js", ov[cl:c1]); put("temaov_block.js", ov[c1:fd]); put("temaov3_block.js", ov[c1:fd]); put("fd_block.js", ov[fd:m1])
put("menuov_block.js", ov[m1:j1]); put("jokeov_block.js", ov[j1:v1]); put("vejrov_block.js", ov[v1:c2])
# billeder.html og de små sider
v = L("vaelger.html"); put("vl_side_block.js", skær(v, '// Egne lister (Opsætning', 'document.addEventListener("keydown"'))
for f, n in (("billeder.html", "bil_html.mjs"), ("gaest-wifi.html", "wifi_page.mjs"), ("vaelger.html", "vaelger_page.mjs"), ("start.html", "start_page.mjs")):
    put(n, re.search(r'<script type="module">(.*?)</script>', L(f), re.S).group(1))
js = re.search(r'<script type="module">(.*?)</script>', bh, re.S).group(1); put("bilh_kerne.js", js[js.index('// ── Kerne'):js.index('// ── Slut på kernen')])
for n, t in (("idx", idx), ("ov", ov)): put(f"{n}.mjs", re.search(r'<script type="module">(.*?)</script>', t, re.S).group(1))
print("udtrukket")
