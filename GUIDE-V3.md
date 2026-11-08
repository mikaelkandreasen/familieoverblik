# Familieoverblik 3: sæt op og opdater uden SSH

Version 3 kører som Docker-billeder fra et register. Du skal ikke køre scripts på NUC'en. Du bruger en browser, GitHub og Dockhand.

**Det du skal bruge:** en gratis GitHub-konto, Dockhand kørende på NUC'en, og en browser. Ca. 30 minutter første gang.

## Overblik

```
GitHub (dit repo)  ──bygger──▶  GitHub Container Registry  ──hentes af──▶  Dockhand  ──▶  4 containere på NUC'en
   du uploader filerne            billederne (web, aula, bil, cron)                         + ét volume med alle dine data
```

- **GitHub** bygger billederne for dig, hver gang du laver en udgave (tag `v3.x.y`). Det tager ca. 5 minutter og koster ikke noget.
- **Dockhand** henter billederne og kører dem. En opdatering er **Redeploy** (eller Dockhands auto-opdatering).
- **Alt dit** (indstillinger, billeder, nøgler, PIN, historik) ligger i volumet `familieoverblik-data`. Det overlever opdateringer.
- **Opsætningen** (navne, PIN, sted, nøgler) sker i en guide i browseren. Intet skal redigeres i filer.

## 1. Engangsopsætning

### 1.1 Læg projektet i GitHub

1. Opret en konto på github.com, og tryk **New repository**. Navn fx `familieoverblik`. **Private** er fint.
2. Pak zip-filen ud på din computer. Åbn dit nye repo, og tryk **Add file → Upload files**. Træk **indholdet** af den udpakkede mappe ind (ikke selve zip-filen). GitHub tager højst 100 filer ad gangen, så upload i to omgange: først alle mapper undtagen `public_html`, så `public_html` for sig. Tryk **Commit changes** hver gang.
3. **Workflowet:** Mappen `.github` (som starter med punktum) kan ikke uploades i en browser. Åbn derfor filen `github-workflow/billeder.yml` i dit repo, og kopiér hele indholdet. Tryk **Add file → Create new file**, skriv `.github/workflows/billeder.yml` som filnavn (skråstregerne laver mapperne), indsæt indholdet, og tryk **Commit changes**. Alternativt: Actions → **set up a workflow yourself**, omdøb filen til `billeder.yml`, og indsæt indholdet.

### 1.2 Byg billederne

1. I dit repo: **Releases → Draft a new release**. Under **Choose a tag** skriver du `v3.0.0` og vælger **Create new tag**. Tryk **Publish release**.
2. Åbn fanen **Actions**. Du ser kørslen «Byg billeder». Efter ca. 5 til 10 minutter er alle jobs grønne. Er et job rødt, så åbn det og send mig de sidste linjer.
3. Under din profil → **Packages** står nu fem billeder: `familieoverblik-web`, `-aula`, `-bil`, `-cron` og `-frameo`.

### 1.3 Giv Dockhand adgang til billederne

Vælg **én** af disse:

- **Gør billederne offentlige** (nemmest). Åbn hver af de fem pakker → **Package settings** → **Change visibility** → **Public**. Billederne indeholder ingen af dine data eller nøgler, kun programmerne.
- **Behold dem private.** På GitHub: **Settings → Developer settings → Personal access tokens → Tokens (classic)**, lav et token med kun `read:packages`. I Dockhand: tilføj registeret `ghcr.io` med dit GitHub-brugernavn og tokenet.

### 1.4 Opret stakken i Dockhand

1. **Stacks → Create.** Navn: `familieoverblik`. Indsæt hele indholdet af `compose.yaml`.
2. Sæt miljøvariabler på stakken:

| Variabel | Værdi |
|---|---|
| `FAMILIE_REGISTER` | `ghcr.io/dit-github-brugernavn` (små bogstaver) |
| `FAMILIE_LAN_IP` | NUC'ens adresse, fx `192.168.1.50` (anbefalet: så kan siden kun nås på dit eget netværk) |
| `FAMILIE_VERSION` | valgfri. `3` = nyeste 3.x. Eller fx `3.0.1` for en bestemt |
| `FAMILIE_PORT` | valgfri, standard `8085` |

3. **Deploy.** Dockhand henter de fire billeder og starter dem.
4. **Lav aldrig en port-forward** i routeren til porten. Siden er til dit eget netværk.

### 1.5 Gennemfør guiden

1. I Dockhand: åbn stakken → containeren **web** → **Logs**. Find linjen **Opsætningskode** (8 tegn).
2. Åbn `http://NUC-adressen:8085` i en browser. Du sendes til guiden.
3. Skriv opsætningskoden, familien, en PIN-kode (4 til 8 cifre), og stedet til vejret (standard er Aarhus). Under **Familien** tilføjer du op til **4 voksne og 8 børn** med **+ Tilføj voksen / + Tilføj barn** (× fjerner en række). Skriv fornavne, som de står i Aula, og gerne **fødselsdag** (`dd.mm` eller `dd.mm.åååå`). Sæt hak i **Flag og fødselsdagstema**, hvis forsiden skal fejre dagen. MitID-brugernavn og Anthropic-nøgle kan vente.
4. Skriv PIN-koden ned. Tryk **Åbn oversigten**, og skriv PIN-koden.

Guiden virker kun, før opsætningen er gennemført. Skriver nogen den forkerte opsætningskode 8 gange, låses den i 10 minutter.

### 1.6 Aula-login (MitID, én gang)

Det er det eneste, der kræver en terminal, og Dockhand har en:

1. Stakken → containeren **aula** → **Terminal** (eller Shell/Console, afhængigt af Dockhand-versionen). Åbn den bredt: QR-koden er i to halvdele og fylder.
2. Skriv: `aula --username DIT-MITID-BRUGERNAVN login`
3. Scan QR-koderne med MitID-appen (dansk IP-adresse kræves).
4. Under **Opsætning → Familie og forbindelser** udfylder du børnenes `calendar_id` (kolonnen «ID» fra `aula profile` i terminalen), MitID-brugernavn og Anthropic-nøgle, og trykker **Gem**.

**Fejler login?** Hver prøve kræver, at du scanner QR-koderne igen, så prøv ikke mange gange i træk. Siden 3.5.6 vælger tilføjelsen kun rollen og lader aula-biblioteket selv sende «Næste»-siden.
- **Send mig linjerne, der starter med `aula-login:`** og fejlteksten nederst. Der står ingen koder i dem. Siden 3.3.2 beskriver de, hvad Aula svarede.
- **Prøv uden vores tilføjelse:** `AULA_LOGIN_PATCH=0 aula --username DIT-MITID-BRUGERNAVN login`. Virker det, er tilføjelsen unødvendig, og vi slår den fra som standard.
- **Prøv med en anden rolle:** `AULA_AKTOER=KONTAKT` er standard (forælder). Tilbydes en anden, står den i fejlteksten.

Synkroniseringen kører hver morgen kl. 07:00. Er login udløbet (efter nogle måneder), står det i containerens log. Så gentager du punkt 1 til 3.

### 1.7 Resten

Alt andet (Hyundai, Strava, Microsoft To Do, FotMob, elpris, kalendere, vejr, joke, tegneserie, farver, sprog) sættes under **Opsætning** som før.

## 2. Opdatering

1. Har jeg lavet en ny version, så upload de ændrede filer i dit repo (**Add file → Upload files**, de nye filer overskriver de gamle).
2. **Releases → Draft a new release** med et nyt tag, fx `v3.0.1`.
3. Vent på grønne jobs under **Actions**.
4. I Dockhand: **Redeploy** stakken. Med `FAMILIE_VERSION=3` henter den nyeste 3.x. Dockhands auto-opdatering virker også, fordi billederne ligger i et register.

Dine data bliver. Webcontaineren skriver siderne og konfigurationen ud igen ved hver start.

**Sikkerhedskopi før en opdatering:** Opsætning → Sikkerhedskopi → **Hent sikkerhedskopi**. Filen indeholder **nøgler og PIN-kode**: gem den som en adgangskode.

## 3. Flyt fra version 2.x

1. Hent mappen `klar-til-upload/ugeplan-data` fra den gamle installation (netværksdrev, WinSCP eller SFTP) og pak den som en **zip** på din computer.
2. Gennemfør trin 1.1 til 1.5 for version 3.
3. **Opsætning → Sikkerhedskopi → Gendan fra en fil**, vælg zip-filen, og tryk to gange. Data, billeder, tegneserie-historik og indstillinger flytter med. Cachen gør ikke.
4. Nøgler og PIN er **nye**. Alle enheder skal skrive den nye PIN. Aula skal logges ind på ny (trin 1.6). Hyundai-login og Anthropic-nøgle lægges ind under Opsætning → Familie og forbindelser.
5. Standser du version 2, så husk at tage dens stak ned. Version 2 brugte port 8080. Version 3 bruger **8085** som standard, så de to kan køre side om side under flytningen.

**Det, du ikke kan ændre i version 3:** indstillinger, der kun stod som konstanter i `ugeplan-lib/config.php` (`TICKERS`, `ICS_FEEDS`, `ELPRIS_*`-standarder). Dem, der også har en indstilling under Opsætning (kalendere, elpris), gælder stadig. Skriv til mig, hvis du savner en.

## 4. Sikkerhed

**Det der er på plads:**
- **Login:** Siderne, indstillingerne, sikkerhedskopien og `config.js` (med læsenøglen) kræver login. Der er PIN, og valgfrit totrinsbekræftelse. Spærringen er 20 forkerte PIN-forsøg og 5 forkerte koder pr. 15 minutter.
- **Hemmeligheder:** Nøgler, PIN og TOTP ligger i `private/` i volumet (rettighed 660, ikke i webmappen).
- **Kalenderlinks:** Serveren henter kun fra offentlige adresser over http og https.
- **Indholdssikkerhed:** Siden kan ikke vises i en ramme, og den må kun tale med sin egen server.
- **Opsætningskoden** står kun i containerens log. Guiden virker kun før opsætning og låses efter 8 forkerte forsøg.
- **Billederne i GitHub** indeholder ingen af dine hemmeligheder, og de bygges igen hver uge med sikkerhedsrettelser.

**Det du selv skal sørge for:**
- **Sæt `FAMILIE_LAN_IP`,** og lav ingen port-forward. Uden den lytter siden på alle NUC'ens netværk (også VPN og Docker).
- **Siden kører over http.** PIN, koder og cookies sendes ukrypteret på dit lokale net. Er der gæster eller ukendte enheder på samme net, så sæt siden bag https med en reverse proxy (fx Caddy eller Traefik med eget certifikat) eller brug Tailscale (https til dine egne enheder). Gæste-wifi'en bør være et separat net.
- **Brug en PIN på 6 til 8 cifre.** 4 cifre er hurtigere at gætte, selv med spærringen.
- **NUC'ens ur skal gå rigtigt** (NTP), ellers fejler totrinsbekræftelsen.
- **Sikkerhedskopien indeholder nøgler og PIN.** Gem den som en adgangskode.
- **Mistet enhed:** Opsætning → Login og sikkerhed → **Log alle enheder ud**.

**Kendte begrænsninger:**
- **Fælles cookie:** Alle enheder deler den samme login-cookie. Den kan kun trækkes tilbage fra alle på én gang.
- **Workflowet:** De officielle GitHub-actions er låst til hovedversion (fx `@v4`), ikke til en bestemt commit.
- **Over http:** Offline-visning (service worker) og «Kopiér» virker ikke. Browserens egen oversætter virker heller ikke, så oversættelse sker via serveren.

## 5. Når noget går galt

| Symptom | Prøv |
|---|---|
| Dockhand kan ikke hente billederne («pull access denied», «manifest unknown») | Er pakkerne offentlige, eller er registeret tilføjet med token (1.3)? Er `FAMILIE_REGISTER` med små bogstaver? Har jobbet i Actions været grønt? |
| «Prøver» er rødt efter få sekunder | Åbn jobbet → trinnet «Prøv opstartsprogrammet og scripts», og læs de sidste linjer. Oftest mangler der filer i repoet. Tjek fanen **Code**: der skal være mapperne `docker`, `public_html`, `ugeplan-lib`, `ugeplan-data` (med filen `htaccess.txt`), `sprog`, `tests` og `vaerktoej` samt `compose.yaml` og `VERSION`. Uploads fra en browser tager ikke filer med punktum med, og mapper, der er tomme, findes ikke i Git. |
| Jobbet i Actions er rødt | Åbn jobbet, og send mig de sidste 30 linjer. «Prøver» er rødt = en prøve fejlede. aula/bil rød på begge Python-versioner = et bibliotek kan ikke bygges. |
| Siden åbner ikke | Dockhand → web → Logs. Står der en Python-fejl fra `bootstrap.py`, så send den. |
| Du finder ikke opsætningskoden | Logs for **web**, øverst efter en genstart. Står den ikke dér, er opsætningen allerede gennemført (så brug PIN-koden). |
| Guiden siger «allerede gennemført» | Opsætningen er gjort. Åbn `overblik.html`. Har du glemt PIN-koden, så gendan en sikkerhedskopi eller slet volumet `familieoverblik-data` (alt går tabt). |
| Aula: «Venter på opsætning» | Gennemfør guiden. Containeren skriver `config.py`, når opsætningen er færdig. |
| Aula-login i terminalen virker ikke | Kræver dansk IP og en bred terminal. Send linjerne med `aula-login:` fra containerens log. |
| Cron: «Venter på at opsætningen laver instans.json» | Normalt kort efter første start. Vent et minut. |
| Dockhand har ingen Terminal-knap til aula | Så er det den ene ting, du må bruge SSH eller `docker exec -it` til: `docker exec -it <aula-container> aula --username … login`. |

## 6. Familie, fødselsdage og flag

- **Flere eller færre personer:** Opsætning → Familie og forbindelser. Tilføj eller fjern rækker (1 til 4 voksne og 1 til 8 børn), og tryk **Gem**. Siderne skal genindlæses. Børnene bruges også til Aula-synkroniseringen (`calendar_id`).
- **Farver:** Hver person får en fast farve efter rækkefølgen (voksne først). Der er 12 farver. De kan ændres under **Farver** (gruppen Personer). Det mørke «I dag»-panel har lysere farver, og dem afleder siden selv af dine valg (mindst 4,5 : 1 mod panelet).
- **Fødselsdag:** `dd.mm` eller `dd.mm.åååå`. Med årstal vises alderen («fylder 41 i dag»). 29. februar uden årstal er tilladt og fejres den 28. i år, der ikke er skudår.
- **På fødselsdagen** får forsiden et rødt bånd med to Dannebrog, en flagguirlande og konfetti, teksten «Tillykke med fødselsdagen, Anna!», rød fremhævning og en rød kant på kortene. Falder flere fødselsdage på samme dag, nævnes de sammen. Skærmen skifter selv ved midnat.
- **Slå det fra:** fjern hakket ved **Flag og fødselsdagstema** under Familie og forbindelser. Animationerne slås også fra, hvis enheden er sat til «reducer bevægelse».
- **Kommende fødselsdage** (inden for 30 dage) står under **Vigtigt snart**, sammen med dem du selv har lagt ind under Fødselsdage.
- **Opgraderer du fra 3.0.0**, læses dine indstillinger af sig selv (voksne uden fødselsdag). Du behøver ikke gøre noget.

## 7. Login: PIN og totrinsbekræftelse (TOTP)

Siderne er låst med en PIN-kode (en cookie i 180 dage). Du kan lægge **totrinsbekræftelse** oven på: efter PIN-koden skal man skrive en 6-cifret kode fra en autentificeringsapp.

**Slå til** (Opsætning → **Login og sikkerhed**):

1. Tryk **Slå totrinsbekræftelse til**, og scan QR-koden med en app (Google Authenticator, Microsoft Authenticator, 2FAS, Aegis, 1Password …). Kan du ikke scanne, så skriv hemmeligheden ind i hånden.
2. Skriv den 6-cifrede kode, appen viser, og tryk **Bekræft og slå til**.
3. **Gem de 8 gendannelseskoder** et sikkert sted. De vises kun nu. Hver kan bruges én gang, hvis du mister telefonen.
4. **Alle andre enheder skal nu logge ind igen** med PIN og kode. Du selv er stadig logget ind.

**Væg-skærmen:** Log ind på den med PIN og kode, og lad **Husk denne enhed** stå afkrydset. Under **Husk en enhed i** vælger du 7 til 365 dage (vælg 365 til en væg-skærm, ingen rører). Når tiden er gået, spørger den igen, og så skal en med appen være ved hånden.

**Daglig brug:** Telefonens ur skal gå rigtigt (koderne gælder 30 sekunder, og ét skridt før og efter accepteres). Samme kode kan ikke bruges to gange. Højst 5 forkerte koder pr. 15 minutter pr. enhed, så er der spærret.

**Mister du telefonen:** Brug en gendannelseskode i kodefeltet ved login. Er den brugt eller væk: åbn **web**-containeren i Dockhand → **Terminal** og skriv `rm /var/www/ugeplan-data/private/totp.json`. Så er totrinsbekræftelse fra, og PIN-koden virker alene. Har Dockhand ingen terminal, kan du gendanne en ældre sikkerhedskopi, der er lavet FØR du slog det til.

**Slå fra / nye koder / log alle ud:** samme sted. Slå fra og nye koder kræver en gyldig kode. **Log alle enheder ud** nulstiller også alle huskede enheder.

**Hvad det beskytter:** siderne, indstillingerne, sikkerhedskopien og den læsenøgle, der ligger i `config.js` (den var ikke bag login før version 3.2.0, og det gælder også 2.x). Det beskytter ikke mod en, der kan se din skærm eller har din telefon og PIN, og over http kan koden opsnappes på samme net (se afsnit 4). Lav ingen port-forward: vil du nå siden hjemmefra, så brug en VPN (WireGuard eller Tailscale).

## 8. Backlog: idéer og ønsker

Under **Sider ▾ → Backlog (idéer og ønsker)** på forsiden ligger en side, hvor familien selv kan logge nye tiltag.

- **Vælg, hvem du er** øverst (huskes på enheden). Så står dit navn på punkter, stemmer og kommentarer.
- **+ Nyt punkt:** titel, beskrivelse (valgfri), kategori og ønsket prioritet (P1 højest). Nye punkter får status **Idé**.
- **Stem** med pilen: ét plus pr. person, og et tryk mere fortryder det. Punkter med flest stemmer kommer først, hvis du sorterer på det.
- **Status og prioritet** ændres med de to valgmenuer på punktet. **Ret** ændrer titel, beskrivelse og kategori. **Slet** kræver to tryk.
- **Kommentarer** skrives under punktet.
- **Søg og filtrér** øverst. Færdige og droppede er skjult, til du krydser «Vis også færdige og droppede» af eller vælger den status.
- **Hent** som Markdown (kan lægges ind i `BACKLOG.md`), CSV (regneark) eller JSON. **Læg ind** tager JSON og springer punkter over, der allerede findes (samme titel og kategori). Brug `backlog-start.json` fra projektet til at lægge de nuværende punkter ind første gang.
- Højst 500 punkter, 50 kommentarer og 40 stemmer pr. punkt. Gemmes i `private/backlog.json` (med i sikkerhedskopien). Alle med PIN-koden kan ændre alt.

## 9. Tilpas forsiden og opsætningen

**Layout (nederst på forsiden → Tilpas layout):** Hvert kort har ▲ ▼ (flyt), en **størrelsesknap** (Smal, Halv, Bred) og **✕** (skjul helt). Halv betyder, at to kort står side om side. De skjulte kort ligger som knapper i panelet nederst, og et tryk viser dem igen. **Nulstil** går tilbage til standarden. Layoutet gemmes kun på den enhed, du bruger.

**Tema på denne enhed (nederst på forsiden):** *Som opsat* følger farverne fra Opsætning → Farver (ens på alle enheder). De andre valg (automatisk lys/mørk, lys, varm, mørk, høj kontrast) gælder kun den enhed, du står på, fx mørkt på væggen om aftenen.

**Opsætning:** Træet til venstre (på en telefon en valgmenu øverst) viser én side ad gangen. Det samme sted ligger alt det, der før stod under hinanden.

**Tømning (Opsætning → Kort på oversigten → Tømning):**
1. Giv adressen et navn (fx Hjemme). Tryk **+ Tilføj fraktion**.
2. Vælg fraktionen (Restaffald, Papir …), en farve, **den første tømning** (en dato, hvor der er tømning, også en i fortiden) og **hver hvor mange uger**.
3. En tømning, der udgår (helligdag), skrives under **Udgår**, og en ekstra under **Ekstra**. Datoer: 24.12.2026 eller 2026-12-24, flere adskilt af komma.
4. Under hver fraktion står de næste datoer, så du kan se med det samme, om det passer. Tryk **Gem**.
Kortet «Tømning» vises på forsiden. Aftenen før står der under **Vigtigt snart**, at spanden skal sættes ud. Du kan have flere adresser (fx en slægtnings).

**Dagens joke i toppen:** Opsætning → Dagens joke → *Hvor skal joken vises?*

**Tilfældig vælger:** Opsætning → Tilfældig vælger. Du kan også skrive en liste på selve siden og trykke **Gem som liste**. Listerne står under **Indsæt en liste** på alle enheder.

**Elpris:** Knappen **Kun søjler** i kortets overskrift skjuler alt andet end søjlediagrammet. Valget gemmes på enheden.

**Vejr:** Timerne vises hver tredje time, og farven viser vejrtypen. Vinden står som styrke, retning og stød. Det første svar efter opdateringen mangler vind (det kommer ved næste hentning).

**Kalenderens kilde:** I kalenderdialogen (Opsætning → Kalendere) er feltet **Navn og kilde** den tekst, der står som kilde på forsiden under «Vis kilder». Uden tekst bruges det gamle gæt ud fra ikonet.

**Åben visning (Opsætning → Login og sikkerhed → Hvem må se forsiden?):** Standarden er, at alt kræver PIN. Vælger du *Forsiden kan ses uden PIN-kode*, kan alle på dit netværk se forsiden (skema, breve, fødselsdage, tømning, vejr, elpris, bil) uden at logge ind. Det er praktisk til en væg-skærm, der skal starte af sig selv. Indstillinger, billeder-siden, gæste-wifi, backlog, kalendere, oversættelse og sikkerhedskopi kræver stadig PIN. Læsenøglen står åbent i siden, så alle på netværket kan også ændre det, skærmen selv ændrer (afkrydsninger og opslagstavlen). Brug det kun på et netværk, du stoler på, og ikke på gæste-wifi. Kortene Strava og Indkøb vises kun, når siden er åbnet efter en PIN-kode. Du kan altid logge ind via **Opsætning** (så spørges der efter PIN).

**Drej et billede (Opsætning → Pauseskærm):** Hver miniature har to knapper nederst til venstre: drej mod uret og drej med uret. Billedet lægges ind igen som et nyt (det kommer forrest i listen), og det gamle slettes bagefter.

**Fuld skærm (nederst på forsiden):** Knappen **Fuld skærm** viser siden uden Chromes adresselinje. Den hjælper især på en gammel tablet (Android 5.1 med Chrome 95), hvor Chrome ellers ikke har en fuldskærmsknap. Går siden ud af fuld skærm (genindlæsning eller et sidestifte), går den i fuld skærm igen ved første tryk. **Afslut fuld skærm** slår det fra. Vil du også skjule Androids egne knapper og statuslinjen, kræver det en kioskapp (fx Fully Kiosk Browser) eller at siden føjes til startskærmen som app.

**Gamle Android-enheder:** Siderne kræver cirka Chrome 85. Android 5.1 kan højst få Chrome 95 (og Android System WebView 95). Find versionen i `chrome://version`. Er den under 85, skal siderne bygges om (se BACKLOG.md).

## 10. Hvad der er afprøvet, og hvad der ikke er

Afprøvet her (uden Docker og uden PHP, som ikke findes i min sandkasse):
- Opstartsprogrammet `bootstrap.py` som en rigtig proces: nøgler, opsætningskode og låsning, validering, rendering af alle filer, sikkerhedskopi og gendannelse (også angreb som `../`, symlinks og ødelagte indstillinger), fødselsdage, op til 4 voksne og 8 børn og farvepladser. 81 prøver.
- **Rettigheder i containeren:** opstart som root, derefter guide, indstillinger, totrinsbekræftelse og gendannelse som en almindelig bruger (som `www-data`), og en zip-bombe. 7 prøver.
- **Totrinsbekræftelse:** de officielle testvektorer fra RFC 6238 og RFC 4226, tidsvinduet, genbrug af en kode, gendannelseskoder, hele forløbet som en rigtig proces (start, bekræft, login-tjek, nye koder, husk, log alle ud, slå fra) og at adgangscookien byttes. 57 prøver.
- Cron- og Aula-scripts med falske `curl`, `sleep`, `date` og `python`, samt Hyundai-login fra de gemte indstillinger. 15 prøver.
- Compose, workflow og Dockerfiles som tekst: at de peger på filer, der findes, og passer sammen. 39 prøver.
- Guiden, indstillingerne og sikkerhedsindstillingerne mod en simuleret server (personrækker, fødselsdage, nøgler, sikkerhedskopi, QR-kode og gendannelseskoder): 94 prøver.
- **Backlog:** hele logikken som en rigtig proces (oprettelse, ændring, stemmer, kommentarer, sletning, import, eksport, grænser, samtidige skrivninger og beskyttelse mod regnearksformler): 34 prøver, og selve siden (filtre, sortering, at alt skrevet escapes, hele forløbet): 51 prøver.
- **Alle sidernes JavaScript** (layout, opsætningstræ, tømning, vejr, joke, vælger, tema, backlog, elpris, pauseskærm, guide, fødselsdage, farver og meget mere): 1027 prøver. De kører også i GitHub-workflowet og er afprøvet i fem tidszoner.

**Ikke afprøvet:** selve `docker build`, GitHub-workflowet, at Dockhand kan hente fra ghcr.io og starte stakken, **al PHP** (`login.php`, `totp.php`, `instans.php`, `sikkerhedskopi.php`, `backlog.php`) og Dockhands terminal til MitID-login. For PHP er kun den logik, der ligger i Python, afprøvet. Selve PHP-filerne er gennemlæst og kontrolleret som tekst (parenteser, at de bruger samme formler som den afprøvede model, at cookien kun sættes ét sted). **Test login med totrinsbekræftelse, før du stoler på det:** slå det til, åbn siden i et privat vindue, og prøv både PIN og kode, en forkert kode, en gendannelseskode og «husk enhed».
