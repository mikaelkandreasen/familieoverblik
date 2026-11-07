# Ændringslog

Alle ændringer i Familieoverblik står her, nyeste øverst. Formatet følger
[Keep a Changelog](https://keepachangelog.com/da/), og versionsnumrene følger
[semantisk versionering](https://semver.org/lang/da/): **MAJOR.MINOR.PATCH**.

- **MAJOR** (fx 3.0.0): ændringer, der kræver, at du gør noget (ny opsætning, nye nøgler, flyttede filer).
- **MINOR** (fx 2.1.0): nye funktioner, der virker uden at du gør noget.
- **PATCH** (fx 2.0.1): rettelser.

Versionen står i filen `VERSION`, i `public_html/version.json` (vises nederst på siderne) og som tag på
Docker-billederne (`familieoverblik-web:2.0.0`), så du kan rulle tilbage til en tidligere udgave.
Før en opdatering tager `lokal/backup.sh` en sikkerhedskopi, og `lokal/opdater.sh` opdaterer koden uden at røre
dine data og indstillinger. Se afsnittet «Versioner og opdatering» i `LOKAL-GUIDE.md`.

> Udgaverne **1.0.0 til 1.8.0** blev ikke udgivet enkeltvis. De er samlet bagud ud fra rækkefølgen, funktionerne
> blev bygget i (november 2026). Fra 2.0.0 skrives hver udgave her, når den laves.

## [3.3.1] – 2026-11-07

### Rettet
- **Bygningen fejlede, hvis filer og mapper, der starter med punktum, ikke kom med i GitHub.** En upload i browseren tager dem ikke med. Det gjaldt de tre spærrefiler `.htaccess` (web, `ugeplan-lib` og `ugeplan-data`) og `.gitkeep`-filerne, og dermed var `ugeplan-data` en tom mappe, som Git ikke gemmer.
  Resultatet var, at jobbet «Prøver» fejlede efter få sekunder, og at Docker-billederne ikke ville kunne bygges (og ville mangle spærrefilerne).
  - Spærrefilerne hedder nu `htaccess.txt` i projektet og skrives ud som `.htaccess` ved opstart. Ligger begge, vinder `htaccess.txt`.
  - Spærrefilen i `ugeplan-data` skrives nu ved hver opstart, så en gammel udgave ikke bliver stående.
  - `ugeplan-data` indeholder mindst én synlig fil. `.gitkeep`-filerne er væk (mapperne laves af opstartsprogrammet).
  - En synlig kopi af GitHub-workflowet ligger i `github-workflow/billeder.yml`, til at kopiere ind i GitHubs editor (mappen `.github` kan ikke uploades i en browser).
  - Ny prøve `tests/test_skjulte_filer.py` kører hele opstarten i en kopi uden nogen skjulte filer.

### Opdatering fra 3.3.0
Upload filerne til dit repo igen (de nye overskriver de gamle), og kør **Actions → Byg billeder → Run workflow**. Du skal ikke ændre workflowet. De `.htaccess`-filer, du eventuelt selv har lavet i repoet, kan slettes (de bruges ikke, hvis `htaccess.txt` findes).

## [3.3.0] – 2026-11-07

### Tilføjet
- **Backlog-side** (`backlog.html`), nået fra menuen **Sider ▾** på forsiden («Backlog (idéer og ønsker)»). Her kan alle med PIN-koden:
  - logge et nyt punkt (titel, beskrivelse, kategori, ønsket prioritet P1 til P4),
  - **stemme** (ét plus pr. person, kan fortrydes) og **kommentere**,
  - skifte **status** (Idé, Planlagt, I gang, Færdig, Droppet) og prioritet, rette og slette (to tryk),
  - **søge og filtrere** (kategori, status, prioritet) og sortere (prioritet og stemmer, flest stemmer, nyeste, sidst ændret). Færdige og droppede skjules som standard,
  - **hente** backloggen som Markdown (til `BACKLOG.md`), CSV (til regneark, med beskyttelse mod formler) eller JSON, og **lægge en JSON-fil ind** (dubletter springes over).
- `backlog-start.json`: de nuværende punkter fra `BACKLOG.md`, klar til at blive lagt ind på siden.
- `backlog.php`. Al logik og validering ligger i `bootstrap.py` og er afprøvet (loft: 500 punkter, 50 kommentarer og 40 stemmer pr. punkt, låsning ved samtidige skrivninger). Gemmes i `private/backlog.json`, som er med i sikkerhedskopien.
- Oversættelser (English, Deutsch) af de nye tekster.

### Opdatering fra 3.2.x
Upload filerne, lav tagget `v3.3.0`, og **Redeploy**. Åbn **Sider ▾ → Backlog**, og læg `backlog-start.json` ind under «Læg en JSON-fil ind», hvis du vil have de eksisterende punkter.

## [3.2.2] – 2026-11-07

Gennemgang for sikkerhedshuller og ting, der kan gå galt.

### Rettet
- **Kritisk: opsætningsguiden, indstillingerne og totrinsbekræftelsen kunne ikke gemme i den rigtige container.** Ved opstart skriver `bootstrap.py` siderne som root. Bagefter kører PHP som `www-data` og skal skrive dem om, men `ugeplan-lib/`, `icons/` og Aula-config var ejet af root. Webbrugeren får nu alle de renderede filer og mapper efter hver rendering.
  Afprøvet som root og derefter som en almindelig bruger (guide, indstillinger og TOTP).
- **Gendannelse:** de bytes, der faktisk pakkes ud, tælles (et arkiv kan lyve om størrelsen: zip-bombe). En fil, der ikke kan skrives (fx en, som bil-containeren ejer), springes over med en forklaring i stedet for at stoppe det hele. Aula-containerens tilstand og config tages ikke med i sikkerhedskopien og lægges ikke ind.
- **Cron-nøglen står ikke længere i Apaches log.** `cron`-containeren sender den i headeren `X-Cron-Key`. `?key=` virker stadig.
- **Tidszone:** kun almindelige zonenavne tages imod (ud over at zonen skal findes), før navnet skrives ind i `config.php`.
- **«Log alle enheder ud»** virker nu også uden totrinsbekræftelse (fx hvis en tablet er blevet væk).
- **Forkert påstand rettet:** browserens egen oversætter (Chrome/Edge) kræver https. Over http i dit lokale net sendes teksten altid via serveren til Claude.

### Tilføjet
- GitHub-workflowet bygger nu også **hver mandag nat**, så sikkerhedsrettelser i php-, python- og alpine-billederne kommer med. Dockhands auto-opdatering kan hente dem.

### Gennemgået uden fund
Adgang til alle 20 PHP-endpoints (nøgle og login), at data indsat i siderne escapes, adgangskontrol til kalenderlinks (kun offentlige adresser og http/https), indholdssikkerhed (`frame-ancestors 'none'`, `connect-src 'self'`), åbne omdirigeringer i login, og Python 3.11-kompatibilitet.

## [3.2.1] – 2026-11-07

### Ændret
- **Siden er nu udstillet på port 8085** (før 8080): `compose.yaml` bruger `${FAMILIE_PORT:-8085}`. Port 8080 er derfor fri til version 2 under en flytning. Containerens egen port (80) og Docker-navnene mellem containerne er uændrede.
- **Har du allerede en stak på 3.x uden `FAMILIE_PORT`,** flytter den til 8085 ved næste Redeploy. Åbn `http://NUC-adressen:8085` (og opdatér bogmærker og væg-skærmens adresse). Vil du blive på 8080, så sæt `FAMILIE_PORT=8080` på stakken.

## [3.2.0] – 2026-11-07

### Tilføjet
- **Totrinsbekræftelse (TOTP) til login.** Under Opsætning → **Login og sikkerhed** slår du det til: scan en QR-kode med en autentificeringsapp (Google Authenticator, Microsoft Authenticator, 2FAS, Aegis, 1Password m.fl.) og bekræft med en kode.
  Efter PIN-koden spørger login så efter den 6-cifrede kode. Standarden RFC 6238 (SHA-1, 6 cifre, 30 sekunder, ét skridt tolerance for urene), og en kode kan **ikke bruges to gange**.
  - **8 gendannelseskoder** (vises kun én gang, gemmes kun som hash, hver kan bruges én gang), og **nye** kan laves med en gyldig kode.
  - **Husk enhed** i 7, 30, 90, 180 eller 365 dage, så væg-skærmen ikke spørger hver gang. **Log alle enheder ud** nulstiller alle huskede enheder.
  - Slås det til eller fra, **skal alle andre enheder logge ind igen**. Du selv bliver ved med at være logget ind.
  - Egen spærring: højst 5 forkerte koder pr. 15 minutter pr. adresse, adskilt fra PIN-forsøgene.
  - Kryptografien ligger i `bootstrap.py` og er afprøvet mod de officielle testvektorer (RFC 6238 og RFC 4226). `login.php` kalder den.
- `totp.php` (kun nøgle og login) og gendannelse/backup medtager `private/totp.json`.

### Rettet
- **Personfarverne i det mørke «I dag»-panel følger nu de farver, du vælger** under Farver. Panelet har lysere farver, så en lysere udgave af din farve afledes automatisk (mindst 4,5 : 1 mod panelets baggrund), og aftenvisningen bruger din farve. Før blev panelet ved med at bruge sine egne farver.
- **Sikkerhed: `config.js` var ikke bag login.** Filen indeholder læsenøglen til `api.php`, så enhver på netværket kunne hente den og læse alle data uden PIN-kode. Den er nu låst bag login-cookien som siderne. **Det gælder også 2.x og 3.0 til 3.1**, hvor PIN-koden altså kun beskyttede selve siderne. Opdatér, hvis siden kan nås af andre end familien.

### Opdatering fra 3.1.0
Upload filerne til dit repo, lav tagget `v3.2.0`, og **Redeploy**. Totrinsbekræftelse er slået fra, til du slår den til.

## [3.1.0] – 2026-11-07

### Tilføjet
- **Antal voksne og børn kan justeres.** Op til **4 voksne og 8 børn** (før: 2 og 3). I opsætningsguiden og under Opsætning → Familie og forbindelser tilføjer og fjerner du rækker med **+ Tilføj voksen / + Tilføj barn** og ×.
  Der er nu **12 personfarver** (`--p-1` til `--p-12`), også i farvevalget og i forvalgene. De første fem pladser har de samme farver som før, så eksisterende farver skifter ikke.
- **Fødselsdag ved oprettelsen.** Hver person kan få en fødselsdag (`dd.mm` eller `dd.mm.åååå`, med årstal vises alderen). Datoen valideres (29. februar uden årstal er tilladt, fremtiden afvises).
- **Flag og fødselsdagstema på fødselsdagen.** På dagen får forsiden et rødt bånd med to **Dannebrog**, en flagguirlande og konfetti, teksten «Tillykke med fødselsdagen, Anna!» (med «fylder 41 i dag», hvis årstallet er kendt), rød fremhævning og en rød kant på kortene. 29. februar fejres den 28. i år, der ikke er skudår. Flere fødselsdage samme dag nævnes sammen.
  Animationerne slås fra ved «reducer bevægelse». Temaet kan slås fra med et hak i guiden og under Familie og forbindelser.
- **Familiens fødselsdage i «Vigtigt snart»** sammen med de egne fødselsdage (uden dubletter).
- Oversættelser (English, Deutsch) af de nye tekster.

### Ændret
- `instans.json`: voksne gemmes nu som objekter (`navn`, `foedselsdag`), og `sv.fodselsdagstema` er ny. **Filer fra 3.0.0 læses og opgraderes af sig selv.**
- Farverne følger personernes rækkefølge: voksne får `--p-1`, `--p-2`, `--p-6`, `--p-7`, og børn får `--p-3`, `--p-4`, `--p-5`, `--p-8` til `--p-12`.

### Opdatering fra 3.0.0
Upload filerne til dit repo, lav tagget `v3.1.0`, og **Redeploy**. Intet skal gøres i hånden.

## [3.0.0] – 2026-11-06

**Version 3 kan sættes op og opdateres helt uden SSH.** Alt kører som Docker-billeder fra et register, og opsætningen sker i browseren.

### Ændret (stor omlægning)
- **Billeder fra et register i stedet for lokale bygninger.** Et GitHub-workflow (`.github/workflows/billeder.yml`) bygger fem billeder (web, aula, bil, cron, frameo) og lægger dem i GitHub Container Registry. Dockhand henter dem, og **Redeploy** (eller Dockhands auto-opdatering) er en opdatering.
  `build-billeder.sh`, `byg-billeder.sh`, `auto-byg.sh`, `klargoer.sh`, `dockhand-klar.sh`, `opdater.sh`, `backup.sh`, `hjaelp.sh` og `opsaet.py` er væk. De er ikke længere nødvendige.
- **Én stak, to volumes.** `compose.yaml` har fire services og to volumes (`familieoverblik-data` til alle data, og `familieoverblik-aula-login`). Ingen bind-mounts, ingen `.env`, ingen `DATA_ROOT`. Kun fem miljøvariabler (`FAMILIE_REGISTER`, `FAMILIE_VERSION`, `FAMILIE_PORT`, `FAMILIE_LAN_IP`, `TZ`).
- **Nøgler, PIN og konfiguration laves af containeren selv** (`docker/web/bootstrap.py`) første gang den starter og gemmes i `ugeplan-data/private/instans.json`. Siderne og configfilerne skrives ud igen ved hver opstart og hver gang indstillinger ændres.
- Aula-, bil- og cron-containerne læser konfigurationen fra det delte volume. Hyundai-login og Anthropic-nøgle står under Opsætning i stedet for i `lokal/.env`.
- Python-billederne bygges på 3.15 og falder tilbage til 3.14, hvis et bibliotek ikke kan bygges dér.

### Tilføjet
- **Opsætningsguide i browseren** (`start.html`): opsætningskode fra containerens log, familien, PIN, sted og valgfrie forbindelser. Guiden virker kun, før opsætningen er gennemført, og låses i 10 minutter efter 8 forkerte forsøg.
- **Opsætning → Familie og forbindelser:** ret navne, børn og `calendar_id`, sted, PIN, MitID-brugernavn, Anthropic-nøgle, Aula-model og Hyundai-login. Nøgler vises aldrig igen og sendes kun, når du skriver en ny.
- **Opsætning → Sikkerhedskopi:** hent alle data (også nøgler og PIN) som én `tar.gz`, og gendan fra en `tar.gz` eller en zip, også en zip af `ugeplan-data` fra version 2. Udpakningen afviser farlige stier og ugyldige indstillinger.
- `instans.php` og `sikkerhedskopi.php`.

### Fjernet
- Webhotel-opsætningen (`opsaet.py`, mappe med tilfældigt navn, GitHub Actions til Aula-synkronisering). Version 3 er til dit eget netværk.

### Flytning fra 2.x
Se `GUIDE-V3.md`. Kort: opret stakken, gennemfør guiden, og gendan en zip af din gamle `ugeplan-data` under Opsætning → Sikkerhedskopi. Nøgler og PIN er nye, så enhederne skal logge ind igen. Aula skal logges ind på ny.

## [2.6.0] – 2026-11-06

### Tilføjet
- **Sprogmodul.** Vælg sprog for hele løsningen under **Sider ▾** på forsiden og i Opsætning → Sprog. Hver enhed husker sit valg, og et **standardsprog** gælder for enheder, der ikke har valgt.
  Dansk er originalen. **English** og **Deutsch** følger med (ca. 290 tekster hver). 31 andre sprog kan vælges som maskinoversat.
- **Alle sprog i én fil.** `sprog/sprog.json` er kilden til alle oversættelser: den danske tekst er nøglen, og hvert sprog er en liste «dansk → oversat» (med `{0}` til tal og navne).
  Filen kan opdateres på to måder: læg den ind under Opsætning → Sprog (ligger ovenpå de medfølgende, og det, den ikke nævner, bliver stående), eller ret den og kør `python3 lokal/sprog.py byg`.
  Nye sprog tilføjes ved at hente en **skabelon**, oversætte værdierne og lægge filen ind. Filen valideres hårdt: kun `<b> <i> <em> <strong> <code> <br>` uden attributter, så en sprogfil aldrig kan sætte script ind.
- **`lokal/sprog.py`** med `tjek`, `byg`, `daek` (dækning pr. side) og `skabelon KODE Navn` (alle sidernes danske tekster, klar til oversættelse).
- **Knappen «Oversæt siden»** maskinoversætter alt det, sprogfilen ikke dækker: skolebreve, aftaler, noter, jokes og stednavne. Den bruger **browserens egen oversætter** (Chrome 138+ og Edge 148+ på computer, på enheden og uden at sende noget),
  ellers **serveren** (`oversaet.php`, Claude). «Vis original» fortryder den. Valget og oversættelserne huskes på enheden.
- `sprog.php` (standardsprog og sprogfiler) og `oversaet.php` (maskinoversættelse med et loft på 400 kald om dagen, 60 tekster og 14.000 tegn pr. kald). Begge kræver PIN-koden.
- Webcontaineren får `ANTHROPIC_API_KEY`, `OVERSAET_MODEL` (standard `claude-haiku-5-5`) og `OVERSAET_MAX_PR_DOEGN` (se `.env.example`, `compose.dockhand.yaml`). Uden nøgle oversætter serveren ikke, men Chrome og Edge kan stadig selv.

### Bemærk
- Sprogene er oversat af en AI og ikke gennemlæst af en, der taler dem som modersmål.
- Dato- og ugedagsnavne, som koden selv laver, bliver på dansk, medmindre du trykker «Oversæt siden». Højre-mod-venstre-sprog (arabisk, hebraisk) sætter `dir="rtl"`, men layoutet er ikke tilpasset dem.
- Serveren sender den synlige tekst til Anthropic, når den bruges til oversættelse. Det kan være børnenes fornavne og skolens tekster. Browserens oversætter sender intet.

### Opdatering fra 2.5.0
`./lokal/opdater.sh`, og `./lokal/byg-billeder.sh` + **Redeploy** (webcontaineren har fået nye miljøvariabler). Står `ANTHROPIC_API_KEY` i `lokal/.env`, bruges den også til oversættelsen. Billederne er ellers uændrede.

## [2.5.0] – 2026-11-06

### Tilføjet
- **Menuen «Sider ▾»** nederst på forsiden. Den samler: Gæste-wifi (QR-kode), Tilfældig vælger (spinner), Kør rundt i Tokyo (ekstern side, åbner i en ny fane),
  Ændringslog, Tilføj billeder og Opsætning. De enkelte knapper i foden er erstattet af menuen.
- **Gæste-wifi som QR-kode** (`gaest-wifi.html`, `wifi.php`). Indtast netværkets navn og adgangskode én gang. Så viser siden en stor QR-kode, som gæster scanner med telefonens kamera.
  Koden tegnes i browseren af `qr.js` (ingen tjeneste uden for huset). Siden kan vise adgangskoden som tekst og udskrive koden.
- **Tilfældig vælger** (`vaelger.html`). Skriv valg, ét pr. linje, og drej et hjul, eller brug hurtigt valg med flere vindere. Valget trækkes med `crypto.getRandomValues`, før hjulet drejer.
  Valgmuligheder: fjern vinderen efter valg, bland, eksempler, historik, og husk listen i browseren.
- **Dagens joke** nederst på forsiden (`joke.php`), fra JokeAPI. Én joke om dagen, hentet af serveren. Safe mode og alle filtre er altid slået til, kategorien Dark tilbydes ikke.
  Jokes i to dele viser svaret, når man trykker. Opsætning → Dagens joke vælger kategori og sprog. Der findes ikke danske jokes.
- **Vejrkort** (`vejr.php`) med timevejr for i dag og 5 dages prognose for hjemmet og **højst én ekstra lokation**, som du søger efter og vælger under Opsætning → Vejr.
  Den ekstra lokation bruger stedets egen tidszone. Data kommer fra Open-Meteo.
- `ugeplan-lib/eksternt.php`: fælles, begrænset hentning af JSON fra de få tjenester, serveren må kontakte.
- `.htaccess`: PIN-regler for `wifi.php`, `joke.php` og `vejr.php`, og de to nye sider kræver PIN-koden som de andre.

### Bemærk
- QR-koden er afprøvet ved at afkode de tegnede billeder med OpenCV (alle versioner til 25 og alle fire fejlretningsniveauer, og alle testede wifi-tekster), men ikke med en rigtig telefon.
- Adgangskoden til gæste-wifi'en gemmes i klartekst i `ugeplan-data/private/wifi.json`. Brug et gæstenetværk.

### Opdatering fra 2.4.0
`./lokal/opdater.sh`. Det kopierer de nye filer og opdaterer `.htaccess` og `login.php`. Billederne er uændrede.

## [2.4.0] – 2026-11-06

### Tilføjet
- **Ændringslog på forsiden.** Nederst på `overblik.html` åbner **Ændringslog ▾** et vindue med en dropdown over alle udgaver (den installerede er valgt og markeret).
  Vinduet viser Tilføjet, Ændret og Rettet for den valgte version. Loggen læses fra `CHANGELOG.md` i webmappen, som `opsaet.py` og `opdater.sh` kopierer derhen.
- **Link til opsætningen** nederst på forsiden.
- **Farver i opsætningen.** Under Opsætning → Farver kan du ændre 21 farver (flader, tekst og streger, kortfarver og personfarver) med farvevælger eller `#rrggbb`.
  Forvalgene Standard, Varm, Mørk og Høj kontrast kan sættes ind med ét tryk. Ændringerne ses straks på siden, og en kontrol siger, om tekst og baggrund er læsbare (mindst 4,5 : 1).
  Farverne gemmes på serveren (`ugeplan-data/private/tema.json`, kun de, der er ændret) og gælder forsiden, opsætningen og uploadsiden på alle enheder.
- Nye filer: `info.php` (version og ændringslog) og `tema.php` (farver). Begge kræver PIN-koden, som de andre endpoints.

### Rettet
- **Versionen nederst på siderne blev aldrig vist** i en rigtig installation. `.htaccess` spærrer alle `.json`- og `.md`-filer med vilje, så `version.json` kunne ikke hentes.
  Versionen og ændringsloggen læses nu af `info.php`.

### Opdatering fra 2.3.1
`./lokal/opdater.sh`. Det kopierer også `CHANGELOG.md` til webmappen og opdaterer `.htaccess` med reglerne for de to nye filer. Billederne er uændrede.

## [2.3.1] – 2026-11-06

### Rettet
- Guiderne sagde, at datoadressen kun var vist for Calvin and Hobbes, og at andre tegneserier «følger samme mønster». Det er bekræftet, at alle bruger samme opbygning:
  `https://www.gocomics.com/<navn>/ÅÅÅÅ/MM/DD`, fx `https://www.gocomics.com/brewsterrockit/2026/11/05`. A–Z-listen bruges kun til at finde `<navn>`. Koden er uændret, den gjorde det allerede.

### Opdatering fra 2.3.0
Ingen. Kun tekst i guiderne og versionsnummeret er ændret.

## [2.3.0] – 2026-11-06

### Tilføjet
- **Søg i alle GoComics' tegneserier.** Under Opsætning → Tegneserie vælger du **Andet …** og søger efter en tegneserie. Listen læses fra GoComics' A–Z-side
  (`https://www.gocomics.com/comics/a-to-z`) og dens undersider, hentes første gang, du trykker i feltet, og gemmes i 7 døgn.
  Hver tegneserie bruger sin egen adresse, og datosiderne er den adresse + `/ÅÅÅÅ/MM/DD`. Det var kun Calvin and Hobbes, jeg havde vist eksemplet for.
- Nyt endpoint `tegneserie.php?action=liste[&opdater=1]`.
- Findes gårsdagens datoside ikke for en tegneserie, står det i indstillingerne, når du gemmer, og kortet viser den seneste strip.

### Ændret
- Valgfeltet tager både «Navn (navn)» fra listen, et navn fra listen, det der står efter `gocomics.com/` og en hel adresse.

### Opdatering fra 2.2.0
`./lokal/opdater.sh`. Der er ikke noget nyt i config-filerne, og billederne er uændrede.

## [2.2.0] – 2026-11-06

### Ændret
- **Tegneseriekortet viser nu gårsdagens strip** og hedder «Gårsdagens tegneserie». Striben hentes fra datosiden, fx
  `https://www.gocomics.com/calvinandhobbes/2026/11/05`, i stedet for forsiden. Gårsdagen findes altid, i dag kan mangle. «I går» regnes efter familiens tidszone.
- **Samme adresse bruges til tidligere dage.** Historikken viser nu alle de seneste 90 dage, og en dag hentes fra sin datoside, første gang den åbnes
  (eller af baggrundsjobbet, hvis det er gårsdagen). Hentede dage gemmes som adresser og titler, ikke som billeder. Dage, der ikke kan hentes, får en forklaring og et link til datosiden.
- En datoside, der viser en anden dato end den ønskede (fx en tegneserie, der ikke udkommer hver dag), vises ikke som gårsdagens. Findes gårsdagens datoside slet ikke, bruges forsidens seneste strip, og kortet siger det.
- Stripen for en dato ændrer sig ikke, så den gemmes i 7 døgn og hentes højst én gang pr. dato. Før blev forsiden hentet hver tredje time.
- Nyt endpoint `tegneserie.php?action=dag&dato=ÅÅÅÅ-MM-DD`. `action=historik` sender nu alle 90 dage med `gemt: true/false`.

### Opdatering fra 2.1.0
Kopiér de nye filer med `./lokal/opdater.sh`. Der er ikke noget nyt i `config`-filerne. Billederne er uændrede, så der skal ikke bygges noget. Tegneseriens historik fra før bliver stående og vises som hentede dage.

## [2.1.0] – 2026-11-06

### Tilføjet
- **Natlig genopbygning af billederne** (`lokal/auto-byg.sh`). Dockhands egen auto-opdatering springer lokale billeder over, så det her bygger
  `familieoverblik-web`, `-aula` og `-bil` igen med de nyeste grundbilleder (`docker build --pull`) og får Pythons og PHPs sikkerhedsrettelser med.
  `--installer [tt:mm]` sætter det i din crontab (standard 03:30), `--fjern` tager det ud, `--status` viser sidste kørsel og om nye billeder venter.
  Er grundbillederne uændrede, sker intet. Mislykkes en bygning, beholdes de gamle billeder. Loggen står i `lokal/auto-byg.log`.
- `lokal/byg-billeder.sh --pull` henter de nyeste grundbilleder først.

### Ændret
- Nye billeder tages først i brug, når containerne startes igen: tryk **Redeploy** i Dockhand. Med `docker compose` kan `auto-byg.sh --genstart` gøre det.
  Scriptet genstarter ikke selv Dockhand-stakken, så en Aula-kørsel ikke afbrydes uden at du ved det.

### Opdatering fra 2.0.0
1. `./lokal/backup.sh`, pak 2.1.0 ud over mappen, `./lokal/opdater.sh`, `./lokal/byg-billeder.sh`.
2. Billederne hedder nu `…:2.1.0`. I Dockhand: kør `./lokal/dockhand-klar.sh` igen, sæt `VERSION=2.1.0` i stakkens miljøvariabler (indsæt `lokal/dockhand-env.txt`), og tryk **Redeploy**.
3. Valgfrit: `./lokal/auto-byg.sh --installer`. Slå Dockhands egen auto-opdatering FRA på web, aula og bil.

## [2.0.0] – 2026-11-06

### Tilføjet
- **Dockhand-version.** `lokal/compose.dockhand.yaml` bruger færdigbyggede billeder og faste stier, så hele stakken kan
  oprettes i Dockhand. `lokal/byg-billeder.sh` bygger billederne, `lokal/dockhand-klar.sh` bygger og skriver miljøvariablerne,
  og `lokal/hjaelp.sh` kører engangskommandoer (Aula-login, Hyundai-diagnose, hent job).
- **Uploadside til billeder** (`billeder.html`): vælg mange billeder på én gang eller træk dem ind, se status pr. billede,
  og slet billeder. Billederne gøres mindre i browseren, før de sendes.
- **Flyt og klap kortene sammen** på forsiden. «Tilpas layout» nederst på siden giver pile og en knap til at flytte et
  kort mellem kolonnen og den brede række. Pilen på hvert kort klapper det sammen. Valget gemmes pr. enhed.
- **Versionsstyring.** `VERSION`, denne ændringslog, `public_html/version.json` (versionen vises nederst på siderne),
  `lokal/version.sh`, `lokal/backup.sh` (sikkerhedskopi mærket med version) og `lokal/opdater.sh` med `opsaetning/opdater.py`
  (opdaterer koden og rører ikke `config.js`, `config.php`, `config.py`, `.env` eller `ugeplan-data`).
- `lokal/byg-billeder.sh` prøver Python 3.15 og falder tilbage til 3.14, hvis et bibliotek ikke kan bygges på 3.15.
- `Sync-Aula.py --dump` gemmer Aulas rå svar i `aula-dump/` til fejlfinding. Ved start logges versionerne af `aula` og Python.
- **Aula-login: rolle og bekræftelse.** Efter MitID sættes `selected-aktoer` til `KONTAKT`, og bekræftelsessiden sendes med `ACCEPT`.
  Det gør en lille tilføjelse (`lokal/aula-patch/`), der lægger sig i httpx og kun rører svar fra `broker.unilogin.dk` og `login.aula.dk`
  med en af de to formularer. Den skriver, hvad den vælger og accepterer. Slås fra med `AULA_LOGIN_PATCH=0`, rollen kan ændres med
  `AULA_AKTOER`, og `./lokal/hjaelp.sh aula-tjek-login` viser, om aula-biblioteket selv kender siderne.
- Uploadsiden `billeder.html` har link både i opsætningen og nederst på forsiden.

### Ændret
- **Python opgraderet til 3.15** (fallback 3.14) i `Dockerfile.aula` og `Dockerfile.bil`.
- **Aula opgraderet fra 0.8.2 til 1.15.0.** Den kræver Python 3.14 eller nyere. Login med MitID-appen viser nu en QR-kode i to halvdele,
  og der findes `aula logout`. Brug en bred terminal ved login.
- `Sync-Aula.py` tjekker nu, at Aulas JSON har de felter, den bruger, og stopper med en tydelig besked i stedet for at skrive et tomt skema.
- Docker-billederne får versionstags (`familieoverblik-web:2.0.0` m.fl.), også i `lokal/docker-compose.yml`.
- `opsaetning/opsaet.py` **nægter** nu at køre, hvis `klar-til-upload/` allerede findes. Den slettede før hele mappen, også `ugeplan-data`.
  Brug `lokal/opdater.sh` til en kørende installation, eller `--tving`, hvis du vil starte forfra.
- Pauseskærmens og kortenes tekster i guiderne er opdateret til de nye trin.

### Rettet
- Guiden sagde, at `opsaet.py` kunne køres igen. På en kørende installation ville det have slettet dine data.
- Filstørrelser på uploadsiden vises i decimale megabyte, så de passer med grænsen på 15 MB.

### Opdatering fra 1.8.0
1. `./lokal/backup.sh`
2. Pak 2.0.0 ud over den gamle mappe (behold `lokal/.env`, `klar-til-upload/`, `klar-til-github/`, `opsaetning/.tilstand.json`).
3. `./lokal/opdater.sh`, derefter `./lokal/byg-billeder.sh`, og start stakken igen.
4. Gentag Aula-login (`./lokal/hjaelp.sh aula-login`). Tokenformatet fra 0.8.2 er ikke afprøvet mod 1.15.0.

## [1.8.0] – november 2026
### Tilføjet
- Kortet **Bil**: batteriniveau fra Hyundai Ioniq 6 på faste tidspunkter (06:15, 12:00, 18:00 frisk, 22:00), med indstillinger,
  Docker-servicen `bil` og `--diagnose`.

## [1.7.0] – november 2026
### Tilføjet
- **Pauseskærm** med billeder, indstillinger, billedmappe (`ugeplan-data/billeder`) og upload i opsætningen.
- Eksperiment: Frameo-synkronisering over ADB (`frameo-sync.sh`).
### Rettet
- Navnetjek i PHP (`\z` i stedet for `$`), så et filnavn med linjeskift ikke slipper igennem.

## [1.6.0] – november 2026
### Tilføjet
- **Historik for dagens tegneserie** (90 dage, kun adresser og titler) og cron-jobbet `tegneserie`.

## [1.5.0] – november 2026
### Tilføjet
- Kortet **Dagens tegneserie** fra GoComics med valg af tegneserie i opsætningen.

## [1.4.0] – november 2026
### Tilføjet
- Kortet **Træning** fra Strava, pr. person, med forbindelse og antal i opsætningen.

## [1.3.0] – november 2026
### Tilføjet
- Kortet **Elpris** med børspris fra Energinet, prognose fra elpriser.org og indstillinger for moms og tillæg.

## [1.2.0] – november 2026
### Tilføjet
- **Indkøbsseddel** med Microsoft To Do.

## [1.1.0] – november 2026
### Tilføjet
- Hurtigvalg til fodbold- og håndboldhold i Kalendere.
### Rettet
- Kilden på skærmen siger «FotMob» og ikke «DBU KampKlar» for hold hentet derfra.

## [1.0.0] – november 2026
### Tilføjet
- Lokal Docker-version (`lokal/`): `klargoer.sh`, `docker-compose.yml` med web, cron og aula, `test-api.sh`.
- `LOKAL-GUIDE.md` og `ANTHROPIC-GUIDE.md`.
