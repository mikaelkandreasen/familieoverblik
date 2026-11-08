# Udviklingsnoter (til den, der arbejder videre på projektet)

**Start med `CLAUDE.md`** (overdragelsen). Denne fil er den korte udgave. Alle prøver: `python3 tests/alle.py`. Pakning: `python3 vaerktoej/pak.py`.

**Version:** se `VERSION`. Ændringer: `CHANGELOG.md`. Ønsker og status: `BACKLOG.md` (og backlog-siden i appen).

## Sådan kører man alle prøver (uden PHP og Docker)

```
python3 tests/test_skjulte_filer.py && python3 tests/test_bootstrap.py && python3 tests/test_scripts.py
python3 tests/test_totp.py && python3 tests/test_backlog.py && python3 tests/test_aulapatch.py && python3 tests/test_aula_diagnose.py && python3 tests/test_aaben_visning.py
python3 tests/test_opbygning.py && sudo python3 tests/test_rettigheder.py     # den sidste kræver root
python3 tests/frontend/kor_alle.py                                              # alle sidernes JavaScript (node)
```
`kor_alle.py` skærer først de dele af siderne ud, som prøverne tester (`tests/frontend/udtraek.py`, markørerne står i sidernes script), og kører så alle `*.mjs`. Hører en markør op med at findes, stopper udtrækket med en tydelig fejl.

## Opbygning

- **Python (`docker/web/bootstrap.py`)** er opstarten og al logik, der skal kunne prøves: rendering af siderne, guiden, indstillinger, sikkerhedskopi, totrinsbekræftelse (`totp`) og backlog (`backlog`). PHP-filerne (`login.php`, `totp.php`, `backlog.php`, `instans.php`, `sikkerhedskopi.php`) videresender kun.
- **Sider:** `public_html/*.html` hver med ét `<script type="module">`. Delte moduler: `affald.js`, `vaelgerlister.js`, `tema-forvalg.js`, `qr.js`, `sprog.js`. De hentes med `import()`, så en manglende fil ikke vælter siden. `tema-forvalg.js` skal være ens med `TEMA_PRESETS` i `index.html` (en prøve sammenligner).
- **Indstillinger** gemmes som `settings/<navn>` via `api.php`. En ny sti skal tilføjes i `api_read_token_may_write()` i `api.php`, ellers må skærmen ikke gemme den.
- **Filer med punktum** (`.htaccess`) hedder `htaccess.txt` i projektet og skrives ud som `.htaccess` ved opstart. En upload i en browser tager ikke filer med punktum med.
- **Sprog:** `sprog/sprog.json` er kilden. Efter en ændring: `python3 vaerktoej/sprog.py tjek && python3 vaerktoej/sprog.py byg`.

## Kendte begrænsninger

- **Åben visning** (`gate.php`, `.htaccess`): prøves med en lille tolker af `.htaccess` og med PHP-reglen spejlet fra kildeteksten (`tests/test_aaben_visning.py`). Apache og PHP selv er ikke kørt.
- PHP kan ikke køres i udviklingsmiljøet. De PHP-ændringer, der ikke er afprøvet: `login.php`, `totp.php`, `backlog.php`, `vejr.php` (vind), `hent.php` (kilde), `api.php` (stier).
- Aula-login er afprøvet mod en falsk httpx, ikke mod Aula (se changelog 3.3.2 og 3.3.3).
