# Overdragelse til den næste Claude (eller udvikler)

Læs denne fil først. Den er skrevet, så en Claude, der får projektet som en zip-fil uden at kende historien, kan bygge videre uden at gætte.
Projektet hedder **Familieoverblik 3**: en væg-skærm og en telefonside med skema og ugebreve fra Aula, kalendere, vejr, elpris, indkøb, bil, træning, tegneserie, tømning m.m.
Det kører i Docker på familiens egen server og styres med Dockhand, uden SSH. Sproget i koden, kommentarerne og guiderne er **dansk**. Brugeren er ikke udvikler: svar kort og på dansk, giv trin-for-trin, og sig ærligt, hvad der ikke er afprøvet.

## 1. De første ti minutter

1. Pak zip-filen ud. Læs, i denne rækkefølge: denne fil, `UDVIKLING.md`, øverste del af `CHANGELOG.md`, `BACKLOG.md` (og afsnittet «Status»).
2. Tjek værktøjerne: `python3 --version` (3.11 eller nyere), `node --version` (22 eller nyere), og `pip install pyyaml` (kun `test_opbygning.py` bruger den). Du får **hverken PHP, Apache, Docker eller netværk** i et almindeligt udviklingsmiljø. Alt nedenfor er lavet til at kunne prøves uden dem.
3. Kør alle prøver: `python3 tests/alle.py`. Alt skal være grønt, før du ændrer noget. (`--uden-js` hopper JavaScript-prøverne over. `test_rettigheder.py` kræver root og springer sig selv over ellers.)
4. Spørg brugeren, hvad der skal bygges. Ligger det i `BACKLOG.md`, så brug beskrivelsen og størrelsen der. Ellers skriv et forslag til afgrænsning, og få det bekræftet, før du bygger noget stort.

## 2. Hvad der er hvor

| Sti | Hvad |
|---|---|
| `docker/web/bootstrap.py` | **Opstarten og al logik, der skal kunne prøves**: rendering af siderne, guiden, indstillinger (`instans.json`), sikkerhedskopi, totrinsbekræftelse (`totp`), backlog (`backlog`), åben visning. Kommandoer: `start`, `render`, `anvend`, `laes`, `backup`, `gendan`, `totp …`, `backlog …`. |
| `public_html/*.html` | Sidernes kode. Hver side har ét `<script type="module">`. `overblik.html` er forsiden, `index.html` er opsætningen (og ugeplanen), `backlog.html`, `vaelger.html`, `billeder.html`, `start.html` (guiden ved første opstart). |
| `public_html/*.js` | Delte moduler: `affald.js`, `vaelgerlister.js`, `tema-forvalg.js`, `qr.js`, `sprog.js` og `sprog-pakker.js` (genereres). De hentes med `import()`, så en manglende fil ikke vælter siden. |
| `public_html/*.php`, `ugeplan-lib/` | **Tynde** PHP-endpoints. Logik, der skal prøves, ligger i Python. `gate.php` er den fælles login-kontrol (`gate_ok()`). |
| `docker/aula`, `bil`, `cron`, `frameo` | Øvrige containere. `docker/aula/patch/aula_login_forms.py` er en tilføjelse til aula-biblioteket (se «Kendte svage steder»). |
| `public_html/htaccess.txt` (og to til) | Adgangsreglerne. Hedder **uden punktum**, og skrives ud som `.htaccess` ved opstart (se «Faldgruber»). |
| `sprog/sprog.json` | Alle oversættelser (dansk er kilden, dertil engelsk og tysk). `python3 vaerktoej/sprog.py tjek` og `byg`. |
| `docs/` | Præsentationen til deling: `DELING.md` (tekster til GitHub og sociale medier, tjekliste før offentliggørelse), `social-preview.png`, `social-linkedin-1200x630.png`, `arkitektur.svg`. `README.md` (dansk) og `README.en.md` er projektets forside på GitHub. |
| `tests/` | `alle.py` kører alt. Python-prøver i `tests/`, JavaScript-prøver i `tests/frontend/` (`kor_alle.py`, `udtraek.py`), falsk httpx i `tests/fakehttpx/`. |
| `vaerktoej/pak.py` | Pakker udgaven: zip og guiden til Notepad++ (`python3 vaerktoej/pak.py`). |
| `GUIDE-V3.md`, `CHANGELOG.md`, `BACKLOG.md`, `README.md` | Guiden (brugerens), ændringslog, ønsker og status, oversigt. |
| `.github/workflows/billeder.yml` og `github-workflow/billeder.yml` | Workflowet, der kører prøverne og bygger billederne. Den anden er en **synlig kopi**: mappen `.github` kan ikke uploades i en browser. De skal være ens. |

## 3. Arbejdsregler, der har virket

- **Hver ændring får prøver**, og prøverne kører, før du siger, at noget er færdigt. Prøverne har fundet rigtige fejl flere gange (en manglende vejrkode blev sol, «constructor» blev et gyldigt tema, `.at()` væltede ældre browsere).
- **Ren logik først, siden bagefter.** I siderne ligger de rene funktioner mellem markørerne `// ── Kerne: …` og `// ── Slut på kernen`, eller i egne blokke, som `tests/frontend/udtraek.py` skærer ud. Prøverne kører koden mod en simpel falsk DOM. Findes en markør ikke, stopper udtrækket med en fejl. Omdøb derfor ikke en sektion uden at rette `udtraek.py`.
- **Python til alt med regler** (validering, filhåndtering, kryptografi, adgang). PHP er kun en tynd skal, fordi PHP ikke kan køres i miljøet.
- **Hold changelog, guide, versionsnummer og oversættelser i trit.** En udgave består af: `VERSION` og `public_html/version.json`, `CHANGELOG.md` (øverst, med «Opdatering fra x»), `GUIDE-V3.md` hvis noget er nyt for brugeren, `sprog/sprog.json` for nye tekster (derefter `sprog.py byg`), `BACKLOG.md`, og så `python3 vaerktoej/pak.py`.
- **Vær ærlig om det uprøvede.** Skriv i changelog og i svaret, hvad der ikke er kørt mod den rigtige tjeneste (Apache, PHP, Docker, Aula, Hyundai, Open-Meteo m.fl.). Brugeren tester selv og sender fejl tilbage.
- **Sikkerhed:** nøgler og PIN ligger kun i `ugeplan-data/private/` (rettighed 660, aldrig i webmappen eller i en udgave). Et nyt endpoint skal kalde `gate_ok()`, have en regel i `public_html/htaccess.txt` og en prøve i `tests/test_aaben_visning.py`. En ny indstilling, skærmen selv må gemme, skal tilføjes i `api_read_token_may_write()` i `api.php` (se opskriften).
- **Tidszoner:** kør JavaScript-prøverne med forskellige `TZ` (fx `TZ=UTC`, `TZ=America/Los_Angeles`, `TZ=Asia/Tokyo`). GitHub kører i UTC.
- **Ingen absolutte stier i prøver.** Brug stier ud fra prøvens egen placering (`import.meta.dirname` i JavaScript, `os.path.dirname(__file__)` i Python). `/tmp` kan blive ryddet mellem sessioner, og `udtraek.py` genskaber det, prøverne skal bruge.

## 4. Faldgruber (de har alle kostet tid)

- **Filer og mapper, der starter med punktum, kommer ikke med, når man uploader i en browser til GitHub.** Derfor hedder spærrefilerne `htaccess.txt` (skrives ud som `.htaccess`), og der er ingen `.gitkeep`. Mappen `ugeplan-data/` skal have mindst én synlig fil. `tests/test_skjulte_filer.py` kører hele opstarten i en kopi uden skjulte filer.
- **Browserkrav: cirka Chrome 85** (valgfri kæde `?.`, `??=`, `gap` i flex). Android 5.1 kan højst køre Chrome/WebView 95. Brug ikke `Array.at()`, `Object.hasOwn()`, `structuredClone()`, `:has()` eller `dvh` uden reserve. `crypto.randomUUID()` findes kun på https og skal have en reserve.
- **`v in objekt` er ikke et gyldigt tjek af en nøgle** (`"constructor" in {}` er sand). Brug `Object.prototype.hasOwnProperty.call`. **`Number(null)` er 0.**
- **PHP gør et tomt array til `[]`, ikke `{}`** i JSON. Send `$b === [] ? new stdClass() : $b` videre til Python (fundet i 3.7.1: totrinsbekræftelse kunne ikke slås til; prøver, der kun sender `{}`, ser det ikke).
- **En sidenavigation afbryder altid fuld skærm.** Derfor åbner forsiden de andre sider i en iframe (`rammeInit` i `overblik.html`), når fuld skærm er slået til, og serveren tillader det med `frame-ancestors 'self'` i `public_html/htaccess.txt` (ikke 'none'). Pas på nye links i siderne: et link til `overblik.html` inde i rammen lukker den; andre sider skal ligge i samme mappe (`^[a-z0-9_-]+\.html`).
- **Serverens CSP forbyder `eval` og `new Function`** (`script-src 'self' 'unsafe-inline'`, ingen `'unsafe-eval'`). Brug dem aldrig i siderne. Fundet i 3.13.1: browser-tjekket prøvede ny syntaks med `new Function` og meldte «mangler» i alle moderne browsere. Syntaks prøves i stedet med små prøvefiler (`public_html/syntaks/`). Prøver med falske browsere håndhæver ikke CSP; `browser_test.mjs` har en regel mod eval.
- **Chrome går ud af fuld skærm** ved genindlæsning, og en side må kun gå i fuld skærm efter et tryk.
- **Python i webbilledet er antaget at være 3.11** (Debian; ikke bekræftet): brug ingen 3.12-syntaks (samme anførselstegn inde i en f-streng). Aula- og bil-billederne bygges på 3.15 og ellers 3.14.
- **ZIP:** pak med `vaerktoej/pak.py`, ikke i hånden (rækkefølge, `__pycache__`, skabeloner til sprog og top-mappen `familieoverblik/` ordnes der).
- **Sprogpakken** (`public_html/sprog-pakker.js`) er genereret. Ret `sprog/sprog.json`, aldrig pakken.

## 5. Opskrifter

**Ny indstilling, som skærmen selv gemmer (`settings/<navn>`):** tilføj navnet i `store_valid_path()` i `ugeplan-lib/store.php` (glemmes det, svarer serveren 400 «ugyldig sti» på **hele** forsidens hentning; `tests/test_stier.py` fanger det), tilføj stien i `api_read_token_may_write()` i `public_html/api.php`; tilføj den i listen over stier i `overblik.html` og `index.html` (og i `applyDoc` begge steder); lav et modul med en `rens()`-funktion, der gør data brugbare (aldrig en fejl, grænser på længder); skriv prøver for `rens()` og for siden.

**Nyt kort på forsiden:** `<section class="card" data-kort="navn" hidden>` i kolonnen `#stak`. Det kommer automatisk med i «Tilpas layout» (skjul, størrelse, rækkefølge). Skriv tegnefunktionen, så den tåler skrald fra serveren. Tilføj udtræk i `tests/frontend/udtraek.py` og en prøve. Tilføj kortets tekster i `sprog/sprog.json`.

**Ny side i opsætningen:** en `<h2 class="f-over">Titel</h2>` med indhold under i `#fOps`, og titlen i `OPS_GRUPPER` i `index.html`. En prøve (`tests/frontend/ops_trae_test.mjs`) fejler, hvis en overskrift ikke står i en gruppe.

**Nyt PHP-endpoint:** nøgle (`X-Ugeplan-Key`) og `gate_ok()` først; en regel i `public_html/htaccess.txt`; videresend til Python, hvis der er logik (se `backlog.php`, `totp.php`); prøve i `tests/test_aaben_visning.py` (tolkeren af `.htaccess`). Skal det kunne læses i åben visning, skal det også stå i `GATE_AABNE_LAESNINGER` i `ugeplan-lib/gate.php` og i `AABNE_PHP` i `bootstrap.py` (en prøve sammenligner).

**Ny Python-kommando:** tilføj den i `bootstrap.py` (skriv logikken som funktioner, og kald dem fra `main`), og prøv den som en rigtig proces (se `tests/test_totp.py` og `tests/test_backlog.py`, som starter `bootstrap.py` med egne mapper via miljøvariabler `FO_*`).

**Ny udgave:** ret `VERSION` og `public_html/version.json`, skriv `CHANGELOG.md`, ret antallet af prøver i `README.md`, `README.en.md` og `docs/DELING.md` (stå ikke og lov flere, end der er), kør `python3 tests/alle.py`, og kør `python3 vaerktoej/pak.py --ud <mappe>`. Giv brugeren zip-filen, guiden og eventuelt en `backlog-status-<version>.json` (en fil med `"opdater": true`, der sætter punkter til Færdig i brugerens backlog ved import på backlog-siden).

## 6. Status og åbne punkter

Se `CHANGELOG.md` for alt, der er bygget, og `BACKLOG.md` for ønsker (afsnittet «Status» nederst). Ved overdragelsen:

- **Afventer brugeren:** et eksempel på en kantinebesked fra Aula (punktet «Aula kantine menu»); svar på tre spørgsmål om Mit Renosyd (bruger/adgangskode eller MitID, en «Hent kalender»-knap, en app) til den automatiske tømningskalender; brugerens `aula-login:`-linjer fra et login med version 3.3.3 eller nyere.
- **Idéer i backloggen:** browser-tjek og støtte til ældre enheder, flere elbiler (Kia, Audi, VW, Tesla), billedgalleri fra skyen (undersøgt, droppet for nu, Immich foretrækkes), flere punkter i sektionen «Parkeret».

## 7. Kendte svage steder (afprøvet mod falske tjenester, ikke mod de rigtige)

- **PHP og Apache er aldrig kørt i udviklingsmiljøet.** Adgangsreglerne er prøvet med en lille tolker af `.htaccess`; PHP-reglen i `gate.php` er prøvet ved at spejle den i Python. Brugeren skal teste login, totrinsbekræftelse, åben visning og de endpoints, der er ændret (se changelog for hver udgave).
- **Aula-login** (`docker/aula/patch/aula_login_forms.py`) er prøvet mod en falsk httpx, ikke mod Aula. Den vælger rollen (KONTAKT) og **giver bibliotekets egen kode bekræftelsessiden** (med fuld action og knappens felt som skjult input), fordi biblioteket (`mitid_client._process_broker_response`) selv sender den første formular, forventer en 302, henter Location og forventer en formular med SAMLResponse dér. Det er fundet ud fra bibliotekets rigtige kode og en rigtig log (3.5.5 og 3.5.6). `tests/test_aula_overdrag.py` gengiver bibliotekets forløb; ændres biblioteket, så sammenlign med dets kode igen (`sed -n 570,640p …/aula/auth/mitid_client.py` i aula-containeren). Logger linjer, der starter med `aula-login:` (uden koder), så man kan se, hvor det stopper.
- **Docker-billederne og GitHub-workflowet** er ikke bygget i udviklingsmiljøet. Brugeren kører workflowet og sender fejl tilbage.
- **Hyundai (Bluelink)**, Open-Meteo, JokeAPI, GoComics m.fl. er kun prøvet med falske svar.

**Ugebreve og skema (3.6.0):** `docker/aula/brev.py` læser brevets HTML med en parser (tabeller bevarer celleplads), skiller selve brevet (`body`) fra skemaet og laver lektioner (uden lærerinitialer). Den er prøvet mod en OPDIGTET tabel; det rigtige brevs opbygning er ikke set. `Sync-Aula.py --brevform` viser opbygningen uden indhold; brug den, før du gætter. Gemte breve har `full` (flad tekst, bruges af analysen), `body` og aldrig `_plan`.

**Kantine (3.7.0):** `docker/aula/kantine.py` finder kantinens besked i `aula messages --search Kantine` (generisk, fordi feltnavnene ikke er set) og lægger `{dage}` på `aula/<uge>.kantine`. Prøvet kun mod opdigtede beskeder og brugerens eksempeltekst. `--kantineform` viser svarets opbygning uden indhold.

**Tømning fra PDF og ikoner (3.8.0):** `public_html/pdfaffald.js` (kun opsætningen, hentes dynamisk) læser en PDF i browseren (`laesPdf`: egen lille PDF-læser med `DecompressionStream`, ToUnicode, tekstoperatorer; `tolkKalender`: tekst → datoer pr. slags affald). `affald.js` har `tilSerie` (datoer → start/hver/udgår/ekstra), `paaDag`, `ikonFor` og `ikonHtml`. Prøver bygger PDF'er selv (`tests/frontend/pdfbyg_hjaelp.mjs`); den rigtige kalender er ikke set. En ny slags affald: tilføj den i `FRAKTIONER` (navn og farve), i `FRAK` i `pdfaffald.js` (genkendelse) og evt. et ikon i `IKONER`/`ikonFor`.

**Kalendere (3.10.0):** `hent.php` kalder `docker/web/ics.py` (gentagelser, undtagelser, flyttede forekomster, tidszoner) og bruger sin gamle PHP-læser (`ics_events_php`) som reserve. Python-læseren er prøvet grundigt (`tests/test_ics.py`); PHP-kaldet er kun kontrolleret som tekst. Kalendercachen er en halv time; `?frisk=1` (`CRON_FRISK=1`) ignorerer den.

**Før projektet gøres offentligt (eller en udgave deles):** kør `FO_PRIVAT_ORD="navne,på,børn,gade,by" python3 tests/test_offentlig.py`. Navne må aldrig stå i projektet. Brugerens egne filer (`backlog-status-*.json`, backlog-eksport, PDF'er med adresse, logfiler fra Aula) hører ikke hjemme i projektet. Lav hellere et NYT offentligt repo med de nuværende filer end at gøre et privat repo offentligt (historikken følger med).

**Ønskelister (3.13.0):** pr. person et valgfrit `onskeskyen`-link i `instans.json → sv` (valideres af `valider_link`: kun https), skrives som `onskeskyen: "…"` i `PEOPLE` i `config.js`, og vises af kortet `#onskKort` (kun dem med link). Ingen ny indstillingssti, og ingen Ønskeskyen-API (der er ingen åben).

**Menuen «Sider ▾» (3.12.0):** forsiden har sin egen i bunden (`#siderListe` i `overblik.html`); alle andre sider med en overskrift henter `public_html/sidemenu.js`, der sætter menuen ind i `header` (eller `.bar-r1` på opsætningen). Ny side: tilføj punktet BÅDE i `sidemenu.js` og i forsidens liste (en prøve sammenligner), og henter scriptet i den nye side lige efter `gamlebrowser.js`.

**Browsere (3.11.0):** `public_html/gamlebrowser.js` er et KLASSISK script i gammel JavaScript (prøven `browser_test.mjs` afviser pile, let/const, ?. m.m.), som alle sider henter FØR deres første modul-script, og som viser en rød besked i en browser, der ikke kan det, siderne kræver. Brug aldrig moderne syntaks i den fil, og aldrig `eval`/`new Function` (CSP). `browser.html` viser hele tjekket.

## 7b. Licens og tredjepart

Projektet er udgivet under **MIT** (`LICENSE`, ophavsret «Familieoverblik contributors»). Der er ingen tredjepartskode kopieret ind; biblioteker, der installeres i billederne, og vilkårene hos de tjenester, løsningen kontakter, står i `THIRD_PARTY.md`. **Kopiér aldrig kode ind fra andre projekter uden at kontrollere licensen** og tilføje den i `THIRD_PARTY.md`. Tegneseriekortet (GoComics) er slået til som standard og viser billeder direkte fra GoComics: overvej, om det skal være valgfrit, hvis projektet anbefales bredt. `aula`-biblioteket nævner en bot-kontrol hos STIL (`security-check.stil.dk`) for logins uden for Danmark; den kan give en side uden formular, som vores tilføjelse ikke kan komme forbi.

## 8. Om brugeren (uden personoplysninger)

Dansk, bor i Danmark, kører løsningen på en lille server derhjemme (kun lokalt net) og styrer den fra en telefon eller computer med Dockhand. Vil have korte svar, trin der kan følges, ærlige tidsoverslag (uden «runder frem og tilbage») og at tingene bliver afprøvet. Bruger både iPhone og Android. Har spurgt til at bruge en gammel Android-tablet (5.1) som væg-skærm. Har selv oprettet et GitHub-repo og lægger filer op med browserens upload (ikke git). **Gem aldrig personlige oplysninger, nøgler eller PIN-koder i projektet.** Beder brugeren om data (logs, billeder, beskeder), så bed om, at de gøres anonyme.
