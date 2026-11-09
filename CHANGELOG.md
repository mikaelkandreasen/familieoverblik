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

## [3.15.0] – 2026-11-09

### Rettet og tilføjet (dine backlog-punkter fra 9. november)
- **Kantinens menu (#19): den står i et OPSLAG, ikke i en besked.** Skærmbilledet viste «Delt med Hele skolen»: det er et opslag i Aula. Hentningen søgte kun i beskeder, hvor kun de gamle kantinebeskeder fra august ligger. Nu hentes **`aula posts --limit 40`** først (og `aula posts` uden grænse, hvis den fejler), derefter beskederne, og **alle ugers menuer** lægges på hver sin uge: kantinen lægger næste uges menu op ugen før (uge 46 den 3. nov., og uge 45 den 29. okt.), så både denne og næste uges menu er med. Er en menu rettet, vinder den nyeste udgave.
  - Menuen læses efter «Menu:» eller «Ugens menu:». Den slutter ved **«O.B.S. …»-afsnittet**, ved «Vh» og ved enhver linje over 90 tegn (en ret er kort), så en uge med fire retter ikke får afsnittet som femte ret.
  - Ukendte feltnavne i opslag klares: emnet læses også af første linje, og den længste tekst er brødteksten.
  - `--kantinetekst` og `--kantineform` viser nu også opslagene (antal, hvor mange der mangler dato, og linjerne).
  - **Jeg kender ikke opslagenes feltnavne** (kun beskedernes), og Aula-kommandoen er prøvet med opdigtede opslag formet efter dit skærmbillede, ikke mod Aula. Står kortet «Kantine» stadig tomt, så send udskriften fra `python /app/Sync-Aula.py --kantinetekst`.
- **Kilden til kalenderposter er forkert (#21 og #26).** «I morgen» og «De næste dage» tabte kilde-teksten og gættede ud fra ikonet (⚽ blev til «DBU KampKlar»). Nu følger kilden med dem, og **ikonet bruges aldrig mere til at gætte kilden**: først teksten fra «Navn og kilde», så tjenesten i linket (DBU vises som «DBU KampKlar», Holdsport, FotMob …; Google, Outlook og iCloud siger intet), ellers personens kalender.
- **Aftensmaden følger den valgte dag (#22).** Den lå inde i «I dag»-kortet, men læste altid i dag.
- **Dagknapperne (#23):** de ikke valgte er mindre (30 px, 11 px skrift), den valgte har samme størrelse som før.
- **Automatisk fuld skærm pr. enhed (#24).** Ny side i opsætningen, **System → Denne enhed**, med afkrydsningsfeltet «Gå automatisk i fuld skærm på forsiden». Valget gemmes i enhedens browser og er det samme som «Fuld skærm»-knappen på forsiden. **En browser kræver et tryk:** første tryk på forsiden går i fuld skærm. En iPhone kan ikke gå i fuld skærm på en side; feltet er slået fra dér og peger på hjemmeskærmen.
- **Kalenderikoner (#27):** 🏑 (floorball; der findes ingen floorball-emoji, så landhockey) er tilføjet lige efter fodbold. 🏊 (svømning) fandtes allerede. **Ridning, kampsport og skøjter er fjernet** fra valget; en kalender, der allerede har et af dem, beholder det.
- **Drej billeder på pauseskærmen og gem (#25, variant a).** To knapper (↶ ↷) øverst til højre på pauseskærmen, dæmpede til de røres. Et tryk på dem lukker ikke pauseskærmen, og billedet bliver stående, mens man drejer. **Drejningen gemmes pr. billede** (`billeder.php?action=drej`) og vises ved visning; billedfilen ændres ikke, og den kan nulstilles ved at dreje hele vejen rundt. Opsætningens miniaturer viser drejningen. **Kræver PIN:** i åben visning uden login gælder drejningen, til siden genindlæses, og der står, at man skal logge ind.
- 90 nye prøver (Python 16, JavaScript 74). **PHP-delen af billeder.php er kun kontrolleret som tekst**, ikke kørt.

### Til din backlog
Se `backlog-status-3.15.0.json` (læg den ind under «Læg en JSON-fil ind»): #5 Droppet, #12 Færdig, #19 I gang, og #21, #22, #23, #24, #25, #26 og #27 Færdige.

### Opdatering fra 3.14.0
Upload filerne, kør **Actions → Byg billeder → Run workflow**, og tryk **Redeploy**. Hent så kantinen med det samme i `aula`-containerens terminal: `python /app/Sync-Aula.py`, og se efter linjer, der starter med `kantine:`. Genindlæs forsiden to gange.

## [3.14.0] – 2026-11-09

### Tilføjet
- **«I dag»-kortet kan vise en anden dag.** Under overskriften er der fem knapper: **Forgårs · I går · I dag · I morgen · Overmorgen**. Et tryk viser den dag i hele kortet: kalender, skole (og dagens timer), fritid, **vigtigt** (fødselsdage, tømning og Aulas vigtige datoer, som står til den dag) og huskepunkter. Overskriften skifter til «I går» osv., og en linje viser ugedag og dato («Onsdag 11. november»). På en anden dag end i dag har kortet en stiplet kant, så man kan se, at man ikke kigger på i dag.
  - **Kortet vender selv tilbage til i dag** efter to minutter uden et tryk, og ved midnat. Væggen skal ikke blive stående på i går.
  - **Alt andet er uændret:** toppen, «Vigtigt snart», «Klar til i morgen», aftensmaden og «De næste dage» viser stadig fra i dag.
  - Huskepunkter kan krydses af på alle fem dage.
  - **Forrige uge hentes, når den skal bruges.** Om mandagen og tirsdagen ligger i går og i forgårs i forrige uge, som siden ikke henter til daglig. Første gang du trykker dig tilbage dertil, hentes den (planlægning, skema og kalender), og siden bevarer den resten af ugen. Er der ingen data for den uge, står der bare «Ingen aftaler» og «Ingen skema».
  - **Hvad man ikke kan se i går:** kun det, der er gemt. Skema og ugebreve hentes for denne og næste uge, så en dag i forrige uge viser det, der blev hentet, da den uge var den nuværende. Tømning vises efter tidsplanen, også tilbage i tiden, men først fra den første dato i tidsplanen.
- 24 + 2 nye prøver (forskydning og grænser, overskrifter og datoer, tryk og tidsgrænse, fejl i hentningen, at kortet læser fra den valgte dag og ikke fra i dag, og at resten af siden stadig regnes fra i dag). **Ikke afprøvet på en rigtig skærm.**

### Opdatering fra 3.13.2
Upload filerne, kør **Actions → Byg billeder → Run workflow**, og tryk **Redeploy**. Genindlæs forsiden to gange.

## [3.13.2] – 2026-11-09

### Rettet (GitHub-workflowet fejlede)
- **Alle kørsler af «Byg billeder» fejlede i trinnet «Prøver»**, og så blev billederne aldrig bygget. Årsagen var mine to nyere prøver, `test_pak.py` og `test_offentlig.py`: de krævede filerne `.gitignore` og `.github/workflows/billeder.yml`. En upload i browseren tager **ikke** filer og mapper med punktum med, så de findes ikke i jeres repo, og prøverne fejlede, selv om alt var grønt hos mig. Billederne bygges først, når prøverne er grønne, så fejlen stoppede alt.
- Begge prøver (og `test_opbygning.py`) bruger nu kun det, der findes: `.gitignore` og `.github` er valgfri, og den synlige kopi `github-workflow/billeder.yml` bruges, hvis den rigtige mappe mangler.
- **Spærrevagt:** `test_skjulte_filer.py` kører nu også de prøver, der læser projektets egne filer (pakning, offentlig-tjek, README, stier, opbygning), i en kopi uden nogen filer med punktum, som en browser-upload giver. Jeg har kontrolleret, at vagten fanger fejlen, hvis den genindføres.
- **Hvad jeg ikke kan se:** selve fejlteksten fra jeres kørsel. Jeg har gengivet fejlen ved at køre workflowets prøver i en kopi uden filer med punktum, og det er de to prøver, der fejlede. Fejler det stadig, så åbn kørslen, åbn jobbet **«Prøver»** og det røde trin, og send de sidste 30 linjer.

### Opdatering fra 3.13.1
Upload filerne til GitHub (erstat dem, der findes), og kør **Actions → Byg billeder → Run workflow**. Tjek, at din `.github/workflows/billeder.yml` er den nyeste: åbn den på GitHub (blyanten), og indholdet skal være det samme som i `github-workflow/billeder.yml`. Er det ikke, så kopiér det ind.

## [3.13.1] – 2026-11-09

### Rettet (vigtig fejl siden 3.11.0)
- **Den røde besked «Din browser er for gammel» (og browser-tjekket) sagde «mangler» i alle moderne browsere**, også Safari 27 på en iPhone 15. Browser-tjekket (3.11.0) prøvede ny JavaScript-syntaks ved at køre små stumper kode med `new Function`. Serverens indholdssikkerhedsregel (CSP, `script-src 'self' 'unsafe-inline'`) forbyder det med vilje, så kaldet fejlede i alle browsere, og fejlen blev læst som «browseren mangler det». Konsekvensen var, at **den røde bjælke kunne komme øverst på alle sider** (fra 3.11.0), og at `browser.html` viste «Siderne kan ikke køre i denne browser».
- **Sådan prøves syntaksen nu:** seks små prøvefiler (`syntaks/*.js`) hentes som almindelige scripts, som CSP'en tillader. Hver indeholder ét stykke ny syntaks (`?.`, `??`, `??=`, `import()`, `async`). Kan browseren ikke læse en fil, kører intet i den, og flaget bliver ikke sat. En kontrolfil (gammel syntaks) viser, at hentningen virker. **Kan prøvefilerne ikke hentes (offline, blokeret), er resultatet «ukendt» og tæller ikke som en fejl**, så en fin browser aldrig får en besked ved en fejl. Hænger hentningen, udløber en tidsgrænse på 8 sekunder.
- `browser.html` viser nu «Kunne ikke tjekkes» for ukendte prøver, og de seks filer ligger i service workerens skal (cache `shell-v5`).
- **Hvorfor prøverne ikke fandt det:** de brugte en falsk browser, der ikke håndhæver CSP. Nu er der en regel, der afviser `new Function`, `eval` og tekst i `setTimeout` i alle sider og scripts, og som kontrollerer, at CSP'en ikke har `'unsafe-eval'`. De rigtige prøvefiler køres også i en sandkasse for at bekræfte, at de sætter deres flag. 33 prøver i alt.
- **Stadig ikke afprøvet i en gammel browser**, kun med falske browsere i flere versioner.

### Opdatering fra 3.13.0
Upload filerne, kør **Actions → Byg billeder → Run workflow**, og tryk **Redeploy**. **Genindlæs siderne to gange.** Åbn så `browser.html` på din iPhone: den skal sige «Alt, siderne bruger, findes i denne browser», og den røde bjælke skal være væk på alle siderne.

## [3.13.0] – 2026-11-08

### Tilføjet
- **Kortet «Ønskelister»: et link til hver persons Ønskeskyen-liste.** Under **Opsætning → Familie og forbindelser** har hver person (voksne og børn) nu et felt **«Link til Ønskeskyen-listen»**. Kopiér linket fra Ønskeskyen (del-linket til listen), og sæt det ind. På forsiden står så kortet **«Ønskelister»** med en række pr. person: *«Annas ønskeliste ↗»*, med personens farve og forbogstav. Et tryk åbner listen i en ny fane, hvor du kan se og tilføje ønsker (og hvor Ønskeskyens reservationer stadig er skjult for ejeren).
  - **En person uden link vises ikke**, og er der slet ingen links, er hele kortet skjult.
  - Det er bevidst kun et link: Ønskeskyen har ingen åben adgang for private (kun et samarbejde for webshops), og at læse deres sider uden aftale kan holde op fra den ene dag til den anden. Ønskerne vises derfor ikke på forsiden, og jeres Ønskeskyen-login ligger ikke hos Familieoverblik.
  - Linket skal være en **https-adresse** (højst 300 tegn, uden mellemrum og citationstegn). Alt andet (http, `javascript:` …) afvises af serveren med en forklaring, og kortet tjekker det en gang til. Navne på s, x og z får kun apostrof («Hans' ønskeliste»).
  - Linkene gemmes sammen med navnene og tages med i sikkerhedskopien. De står i `config.js`, som **kan hentes uden PIN, hvis åben visning er slået til**: det er delings-links, men tænk over det, hvis I har en liste, I ikke vil have, at alle på netværket kan finde.
  - I fuld skærm åbner linket i en ny fane, så fuld skærm kan blive afbrudt (en ny fane kan ikke ligge i rammen).
- 12 + 7 + 15 nye prøver (link gyldige og ugyldige, kun dem med link vises, escape, indstillingsfeltet, config.js, sikkerhedskopi, og at et ugyldigt link ikke ændrer noget). Jeg har kontrolleret, at prøverne fejler, hvis http tillades, eller linket ikke kommer med i config.js.
- **Ikke afprøvet med et rigtigt Ønskeskyen-link.** Jeg kender ikke deres adresser. Virker et link ikke, så er det sandsynligvis ikke et https-delings-link, eller også har Ønskeskyen ændret noget; skriv, hvad der står i feltet (uden at dele selve listen).

### Opdatering fra 3.12.0
Upload filerne, kør **Actions → Byg billeder → Run workflow**, og tryk **Redeploy**. Åbn derefter **Opsætning → Familie og forbindelser**, sæt linkene ind og tryk **Gem**. Genindlæs forsiden to gange.

## [3.12.0] – 2026-11-08

### Tilføjet
- **Menuen «Sider ▾» på alle sider.** Før fandtes den kun i bunden af forsiden. Nu sidder en knap øverst til højre i overskriften på **opsætningen, backlog, gæste-wifi, den tilfældige vælger og billedsiden** (på opsætningen i den øverste række). Rullemenuen åbner nedad og indeholder: **Oversigt, Madplan, Opsætning, Gæste-wifi, Tilfældig vælger, Backlog, Tilføj billeder og Browser-tjek.** Den side, du står på, er fed. Den lukker, når du trykker udenfor eller Escape.
  - Punkterne står ét sted (`public_html/sidemenu.js`). Forsidens egen menu er uændret (den har desuden Ændringslog og Tokyo, som kun hører hjemme dér), og en prøve sikrer, at de to ikke driver fra hinanden.
  - Menuen følger sidens sprog (engelsk og tysk). Guiden (første opsætning) og browser-tjekket har ingen menu med vilje.
  - **I fuld skærm** åbner siderne i rammen (3.9.0), så «Oversigt» i menuen lukker rammen og tager dig til forsiden, uden at fuld skærm afbrydes.
- Service workerens cache er `shell-v4`. 24 nye prøver (placering, punkter, den aktuelle side, åbne og lukke, kun én kopi, sider uden overskrift, ødelagt omgivelse, cache og oversættelser).

### Opdatering fra 3.11.0
Upload filerne, kør **Actions → Byg billeder → Run workflow**, og tryk **Redeploy**. Genindlæs siderne to gange.

## [3.11.0] – 2026-11-08

### Tilføjet
- **Browser-tjek (`browser.html`).** En side, der viser, om en browser kan det, siderne bruger: JavaScript-moduler, `?.`, `??` og `??=`, `import()`, `async`, `fetch`, CSS-variabler og grid (skal være), gap og inset (pænere med), fuld skærm og offline (valgfri). Den viser browserens navn og version og en dom: *alt findes*, *kan køre, men ser anderledes ud* eller *kan ikke køre*. Den er åben uden PIN og sender intet, så den kan åbnes på den gamle tablet, før man opsætter noget.
- **En besked i stedet for en blank side.** Alle syv sider henter nu `gamlebrowser.js` (et script i gammel JavaScript, der selv kan køre i en gammel browser). Kan browseren ikke det, siderne kræver (cirka Chrome 85), vises en rød bjælke øverst: *«Din browser (Chrome 49) er for gammel til Familieoverblik. Det mangler: … Opdatér browseren (Chrome 85, Safari 14 eller Firefox 79 og nyere) eller brug en anden. Se hvad der mangler»*. Før så man en tom side uden forklaring. I en moderne browser sker der ingenting.
- Service workerens cache er `shell-v3` (to nye filer). 22 nye prøver, bl.a. at scriptet selv er skrevet i gammel syntaks (ellers kan det ikke advare de browsere, det er til).
- **Ikke afprøvet i en gammel browser.** Prøverne bruger falske browsere med de funktioner, en bestemt version har. Åbn `browser.html` på din Android 5.1-tablet, og sig, hvad den viser.

### Opdatering fra 3.10.2
Upload filerne, kør **Actions → Byg billeder → Run workflow**, og tryk **Redeploy**. Åbn `http://adressen:8085/browser.html` på tabletten.

## [3.10.2] – 2026-11-08

### Rettet
- **Det, der står til i dag i «Vigtigt snart», står nu også under «I dag».** «Vigtigt snart» samler tre slags: **familiens fødselsdage**, **tømning** (påmindelserne) og **Aulas vigtige datoer**. Er et punkt dér dateret i dag, stod det kun dér, for «I dag» (Kalender, Skole, Fritid, Husk, Aftensmad) viste ikke de tre slags. Nu er der en sektion **«Vigtigt»** i «I dag» (skjult, til der er noget), og punkter dateret i dag står dér i stedet for i «Vigtigt snart». «Vigtigt snart» viser de kommende (i morgen og frem).
- Logikken ligger nu i én ren funktion (`vigtigtListe`), der er prøvet for sig (10 nye prøver: dato i dag, i går, om 45 dage og for langt, ventende punkter, tømning i dag og i morgen, fødselsdage med alder og over årsskiftet, sortering og skrald).

### Opdatering fra 3.10.1
Upload filerne, kør **Actions → Byg billeder → Run workflow**, og tryk **Redeploy**. Genindlæs forsiden to gange.

## [3.10.1] – 2026-11-08

### Rettet (klar til at være offentligt)
- **Gennemgang inden offentliggørelse.** Hele projektet er gennemsøgt for nøgler og tokens, hemmelige filer, e-mailadresser, IP-adresser og navne. Der var ingen nøgler, men:
  - **lærernes fornavne fra et rigtigt ugebrev** stod i en prøve og i ændringsloggen. De er udskiftet med opdigtede.
  - **fire filer med familiens egne backlog-punkter** (`backlog-status-*.json`) lå i projektet. De er fjernet (du har dem allerede som filer, du kan lægge ind på backlog-siden).
  - **kommunens navn** stod i startbacklogen og i prøver. Det er gjort generisk.
- **README's status** er rettet: den sagde, at Aula-login kun var prøvet mod en simulering. Den siger nu, hvad der er prøvet i virkeligheden (Aula hos én familie), og hvad der kun er prøvet med simuleringer.
- **`SECURITY.md`:** hvordan man melder en sikkerhedsfejl privat, at siden ikke skal ud på internettet, og hvad man ikke må dele.
- **Ny prøve `tests/test_offentlig.py`** (kører også i GitHub-workflowet): leder efter API-nøgler og tokens, lange hemmeligheder, filer, der kun hører hjemme på en kørende installation, e-mailadresser, IP-adresser og navne. **Navne lægges ikke i projektet:** sæt dem i `FO_PRIVAT_ORD` (kommasepareret), når du kører den, fx `FO_PRIVAT_ORD="fornavn,efternavn,gade" python3 tests/test_offentlig.py`. Jeg har kontrolleret, at den fanger en indsat e-mail, IP, nøgle, hemmelig fil og navn.

### Opdatering fra 3.10.0
Intet at gøre på serveren. Upload filerne, hvis du vil have det ryddede projekt i dit repo.

## [3.10.0] – 2026-11-08

### Rettet (kalendere: manglende aftaler)
- **Gentagne aftaler vises nu.** Kalenderlæseren i `hent.php` kendte kun enkeltstående begivenheder og **ingen gentagelser** (`RRULE`). En familiekalender er fuld af dem («hver tirsdag», «hver anden uge», «den 2. torsdag hver måned», fødselsdage hvert år), og dem så man kun ved den første forekomst, ikke i morgen. Der er en ny læser i Python (`docker/web/ics.py`), som `hent.php` kalder; den udvider gentagelserne til hver forekomst.
  - Den kender: `FREQ` (dagligt, ugentligt, månedligt, årligt), `INTERVAL`, `COUNT`, `UNTIL`, `BYDAY` (også «2TU» og «-1FR»), `BYMONTHDAY`, `BYMONTH`, `BYSETPOS`, `WKST`, **undtagelser** (`EXDATE`), ekstra datoer (`RDATE`) og **flyttede eller aflyste forekomster** (`RECURRENCE-ID`). Klokkeslættet holder over sommertid, når aftalen står i en tidszone (TZID).
  - Den kender også tidszoner med Windows' navne (Outlook), heldagsposter over flere dage, `DURATION` og svævende tid.
  - Gentagelser, der ikke kan regnes ud (`BYWEEKNO`, `BYYEARDAY`), giver kun den første forekomst. **Fejler Python-læseren, eller findes den ikke, bruges den gamle læser**, så en kalender aldrig forsvinder.
- **Kalenderne hentes oftere.** Cachen var 6 timer, så en ny aftale til i morgen kunne vente, før den vistes. Den er nu en halv time, så hver time-kørsel henter på ny.
- **Hent kalenderne nu:** i `cron`-containerens terminal: `CRON_START=0 CRON_ENKELT=1 CRON_FRISK=1 sh /cron.sh` (ignorerer cachen). Se, hvad en kalender indeholder en bestemt dag: i `web`-containerens terminal `ls /var/www/ugeplan-data/cache/` og så `python3 /opt/familieoverblik/ics.py --fil /var/www/ugeplan-data/cache/FILNAVN --dato i-morgen`. Den siger, hvor mange begivenheder der er i filen, hvor mange der gentages, og hvad der står den dag.
- 49 nye prøver (RFC 5545-eksempler, sommertid, undtagelser, flyttede forekomster, tidszoner, skrald). **PHP-delen er ikke kørt** (kun kontrolleret som tekst), og læseren er ikke afprøvet mod din kalender.

### Kantine
- Læseren kender flere måder at skrive overskriften på («Ugens menu:», «Menu uge 46:», «Dagens menu:», «Ugemenu:») og en ugedag skrevet alene på en linje med retten på den næste. Står der ingen «Menu:»-linje, bruges mindst tre linjer, der begynder med en ugedag og har en ret («Mandag: …»).
- **Ny diagnose:** `python /app/Sync-Aula.py --kantinetekst` viser de tre nyeste kantine-breve linje for linje (første 25 linjer, ikke afsenderen) og hvordan menuen blev læst. Send mig udskriften, hvis kortet «Kantine» stadig er tomt.

### Opdatering fra 3.9.0
Upload filerne, kør **Actions → Byg billeder → Run workflow**, og tryk **Redeploy**. Hent så kalenderne med det samme (kommandoen ovenfor) og genindlæs forsiden.

## [3.9.0] – 2026-11-08

### Tilføjet
- **Fuld skærm består, når du skifter side.** En browser forlader altid fuld skærm, når siden skifter til en anden side, og det kan en hjemmeside ikke forhindre. Derfor åbnes de andre sider (**Madplan, Opsætning, Backlog, Gæste-wifi, Tilfældig vælger, Tilføj billeder**) nu **i en ramme oven på forsiden**, når fuld skærm er slået til. Forsiden forlades aldrig, så fuld skærm består. Uden fuld skærm virker linkene som før (almindelig sideskift).
  - **«← Forsiden»** øverst i rammen lukker den, og det gør «← Oversigten» og «‹ Overblik» inde i siderne også. Forsiden genopfriskes, når rammen lukkes, så det, du har rettet, er der med det samme.
  - En ramme, ingen rører ved i **10 minutter**, lukker af sig selv, så væggen ikke bliver stående i opsætningen.
  - Skifter du mellem siderne inde i rammen (fx fra Opsætning til Tilføj billeder), sker det inde i rammen.
  - Ctrl/cmd-klik, midterklik og links, der åbner en ny fane (som «Kør rundt i Tokyo»), åbner som de plejer.
- **Serverens regel for rammer er ændret:** `frame-ancestors 'none'` (ingen ramme) er blevet til `frame-ancestors 'self'` (kun siderne selv må ligge i en ramme). Andre hjemmesider må stadig ikke lægge dine sider i en ramme.
- **Ikke afprøvet i en rigtig browser.** Reglerne og forløbet er prøvet med falske elementer (21 prøver), og jeg ved, at en ramme i en side i fuld skærm ikke afbryder fuld skærm, men jeg har ikke set det på din tablet. Afbrydes fuld skærm alligevel, så sig til.

### Opdatering fra 3.8.1
Upload filerne, kør **Actions → Byg billeder → Run workflow**, og tryk **Redeploy**. **Genindlæs forsiden to gange** (reglen for rammer kommer fra serveren). Slå fuld skærm til nederst, og åbn Opsætning fra menuen «Sider».

## [3.8.1] – 2026-11-08

### Rettet (skemaet i ugebrevet, andet barns klasse)
Det andet barns ugeplan er bygget anderledes end det første, og læseren fra 3.6.0 kunne ikke tage højde for det:
- **Sammenflettede celler (rowspan og colspan).** Hos det andet barn strækker nogle celler sig over flere rækker (fx onsdag «I er sammen med 0. klasse hele dagen»). I en HTML-tabel rykker kolonnerne så mod venstre i de rækker, der følger, hvis man tæller celler i stedet for pladser, og en lektion havner på den forkerte ugedag. Læseren lægger nu tabellen ud som en browser gør (hver celle på sin rigtige plads, dækkede pladser holdes ude), og en celle over flere rækker varer til slutningen af den sidste af dem.
- **«samme» er ditto.** I den klasse skriver læreren «samme» (og «Samme») i stedet for «DO.». Det forlænger nu timen før. «Samme som mandag» og lignende er stadig almindelig tekst.
- **Brev uden hilsen.** Brevet begynder ved «Ugen der …», når der ikke er en «Kære …», og overskriftslinjer som «Barn 1Buge 46» (hvor «uge» sidder fast i klassens navn) og «Ugeplan for uge 46» kasseres nu.
- **Overskrifter uden kolon** («Ugen der gik», «Ugen der kommer», «Ekstra») vises nu som overskrifter, når et afsnit følger. Før var det kun overskrifter, der endte på kolon.
- Nye prøver bygger en opdigtet klasse med den samme opbygning (sammenflettede celler, «samme», tomme pausesrækker, en «HUSK!»-række og et brev uden hilsen) og kontrollerer ugedag og tidspunkt for hver lektion. 16 nye prøver. **Ikke afprøvet med selve brevets HTML**: jeg kender kun den flade tekst. Viser Skema-vinduet stadig noget forkert, så kør `python /app/Sync-Aula.py --brevform` og send udskriften (kun opbygning, ingen tekst).
- Noter i skemaet vises som lærerne har skrevet dem. De kan indeholde fornavne (fx «Fornavn og Fornavn/ PC»); forbogstaver i parentes fjernes stadig.

### Opdatering fra 3.8.0
Upload filerne, kør **Actions → Byg billeder → Run workflow**, og tryk **Redeploy**. Hent så skema og breve med det samme: `python /app/Sync-Aula.py`.

## [3.8.0] – 2026-11-08

### Tilføjet
- **Læs tidsplanen fra en PDF-tømmekalender** (Opsætning → Tømning → «Læs tidsplanen fra en PDF-tømmekalender»). Vælg PDF'en, og siden foreslår en tidsplan for hver slags affald: første dato, hvor tit (hver 1., 2., 4. … uge), hvilke datoer der udgår (helligdage), og hvilke der er ekstra. Man ser forslaget, sætter hak ved dem, man vil bruge, vælger adresse og lægger dem ind. **Intet gemmes, før man har set det og trykket Gem.** En slags affald, der allerede står der, bliver erstattet.
  - **PDF'en læses i din browser og sendes ikke noget sted hen.** Der er ingen ny server-kode.
  - Læseren forstår almindelige PDF'er med tekst: pakkede og upakkede indholdsstrømme, objektstrømme (PDF 1.5), skrifttyper med ToUnicode (også to-bytes koder), egne kodninger med æøå, tabeller (kolonner holdes ved), spejlede koordinater (browserens «Gem som PDF») og flere sider. Den siger tydeligt, hvis filen er krypteret, ikke er en PDF, eller ikke har tekst (en skannet kalender).
  - Teksten tolkes på flere måder, en kalender kan være sat op på: slags affald som overskrift og datoer under, dato først og så slags affald, begge dele på samme linje, månedsrækker med en kolonne pr. slags affald, og månedslister («Januar: 6, 20»). Datoformater: 24.12.2026, 24/12, 24. dec. m.fl. Støj som adresser, telefonnumre og klokkeslæt giver ikke falske datoer.
  - **Hjælper ikke PDF'en** (fx fordi teksten ikke kan trækkes ud), kan man markere al tekst i PDF'en, kopiere den og indsætte den i et felt. Det, der blev læst, kan ses i forslaget.
- **Ikoner på hver slags affald**: skraldespand (restaffald), æble (madaffald), papir, pap, glas, dåse (metal), flaske (plast), karton, advarselstrekant (farligt affald), blad (haveaffald), sofa (storskrald), T-shirt (tekstiler) og batteri. Ikonet vælges ud fra navnet (også et navn, du selv har skrevet). De står på **kortet Tømning**, ved **påmindelserne** i «Vigtigt snart», **på hver dag i «De næste dage»** (så man kan se, hvad der hentes den dag), i editoren og i PDF-forslaget.
- To nye kendte slags affald: **Mad- og drikkekartoner** og **Batterier**.
- Nye prøver: 48 for modulet (ikoner, «hvad hentes en dag», datoer → tidsplan), 22 for PDF-læseren (med selvbyggede PDF'er i 15 former), 24 for tolkningen af teksten og 24 for panelet.

### Opdatering fra 3.7.0
Upload filerne, kør **Actions → Byg billeder → Run workflow**, og tryk **Redeploy**. Ikonerne kommer med det samme. Åbn Opsætning → Tømning for at prøve PDF-læsningen.
- **Ikke afprøvet mod din rigtige PDF.** Jeg har aldrig set Renosyds kalender, kun selvbyggede PDF'er. Er den et billede, eller viser den kun farver og symboler, kan den ikke læses (så bruges de manuelle felter som før). Læser den forkert, så send mig teksten fra «Det, jeg læste» (uden adresse), så tilpasser jeg tolkningen.

## [3.8.0] – 2026-11-08

### Tilføjet
- **Tømmekalendere, hvor affaldet kun vises som symboler** (som Renosyds PDF). Opsætning → Tømning → *Læs fra PDF* kunne før kun læse kalendere med navne på affaldet i teksten. En kalender med symboler og farver har ingen navne at læse, så den gav intet. Nu samler læseren datoerne **pr. ugedag** (en ugedag er som regel én gruppe affald) og laver en tidsplan for hver: *første dato* og *hver n. uge*.
  - Du **skriver selv, hvilke slags affald hver gruppe er**, i et felt under gruppen. Du kan skrive flere navne adskilt af komma, og de får alle de samme datoer (fx *Glas og metal, Plast og mad- og drikkekartoner*). Navnene kan vælges fra listen over kendte slags affald, så de får det rigtige ikon. Hjælpeteksten forklarer Renosyds symboler (sort pose = restaffald, grøn = madaffald, flaske = glas, dåse = metal, karton = mad- og drikkekartoner, dunk = plast, papkasse = pap, papir, trøje = tekstiler).
  - Mangler et navn, lægges gruppen ikke ind, og siden siger hvilken gruppe det er.
  - Kontrolleret med en Renosyd-kalender for 2026 og 2027 (51 datoer): de tre tidsplaner (mandag hver 2. uge, fredag hver 3. uge, onsdag hver 6. uge) **genskaber præcis alle datoerne** og fortsætter derefter.
- **Året læses fra overskriften.** Månedsnavne uden eget år (november og december på 2026-siden) får året fra overskriften «Tømmekalender 2026», og månedsnavne med år («JANUAR 2027») beholder det. Før blev 2026-datoerne i en PDF med begge år regnet som 2027.

### Opdatering fra 3.7.1
Upload filerne, kør **Actions → Byg billeder → Run workflow**, og tryk **Redeploy**. Gå så til **Opsætning → Tømning → Læs fra PDF**, vælg tømmekalenderen, skriv navnene, tryk **Læg de valgte ind i tidsplanen** og så **Gem**.
- **Afprøvet** med en opbygget PDF i samme form (to sider, symboler uden navne), men **ikke med selve din fil**: læseren kan ikke se symbolerne, kun teksten. Siger den noget andet end din kalender, så åbn «Det, jeg læste» under forslaget.

## [3.7.1] – 2026-11-08

### Rettet
- **Totrinsbekræftelse kunne ikke slås til:** «Forespørgslen skal være JSON.» Når man trykker **Slå til**, sender siden kun `{"handling":"start"}`. `totp.php` fjerner «handling» og sender resten videre til Python, men PHP gør et tomt array til `[]` (en liste) i JSON og ikke til `{}` (et objekt), og Python afviste en liste. Fejlen har været der siden 3.2.0, og prøverne sendte altid `{}`, så de så den ikke.
- Samme mønster fandtes i `backlog.php` (handlinger uden andre felter). Backlog-siden sender altid mindst ét felt til de handlinger, så den var ikke ramt i praksis, men den er rettet på samme måde.
- **Begge rettelser:** PHP sender nu `{}`, og Python tager også imod en tom liste. En liste med noget i afvises stadig.
- Nye prøver sender `[]` som krop (det PHP faktisk sender), og en prøve sikrer, at alle PHP-skaller med dette mønster har rettelsen. Jeg har kontrolleret, at prøverne fejler uden rettelsen.

### Opdatering fra 3.7.0
Upload filerne, kør **Actions → Byg billeder → Run workflow**, og tryk **Redeploy**. Prøv så Opsætning → Login og sikkerhed → Totrinsbekræftelse → Slå til igen.

## [3.7.0] – 2026-11-08

### Tilføjet
- **Kortet «Kantine»** (#19): skolens menu for ugen, som et kort for sig selv. Menuen står i den besked, kantinen sender hver uge (emnet eller første linje starter med «Kantinen uge 46», og efter «Menu:» står én ret pr. dag). Aula-hentningen finder beskeden (`aula messages --search Kantine`), læser retterne og lægger dem på den uge, ugenummeret i emnet peger på. Kortet viser **denne uges menu, men i weekenden næste uges**, markerer **dagens ret** og dæmper de dage, der er gået. Det er skjult, til der er en menu, og kan flyttes, skjules og gøres halvt eller bredt i «Tilpas layout» som de andre kort.
  - Retterne kan stå som en liste (som i dit eksempel), med punkttegn eller nummer, eller mærket med ugedag (**Mandag:**, **Tors:** …), og en uge med fridage viser kun de dage, der har en ret. Afslutninger («Mvh …») og nye overskrifter («Bemærk: …») er ikke retter.
  - Afprøvet med din eksempeltekst og opdigtede varianter. **Ikke afprøvet mod Aulas rigtige svar:** jeg kender ikke bibliotekets feltnavne for beskeder, så søgningen leder generisk. Findes beskeden ikke, siger loggen det, og `python /app/Sync-Aula.py --kantineform` viser svarets opbygning uden indhold.
- En søgning i Aula, der ikke nåede til ende (kode 1), men gav resultater, bruges nu i stedet for at blive kasseret.
- `backlog-status-3.7.0.json` sætter «Aula kantine menu» til Færdig i jeres backlog.

### Opdatering fra 3.6.0
Upload filerne, kør **Actions → Byg billeder → Run workflow**, og tryk **Redeploy**. Hent så med det samme i `aula`-containerens terminal: `python /app/Sync-Aula.py`, og se efter linjen `kantine: menuen for uge 46 … gemmes` i udskriften. Kommer den ikke, så kør `python /app/Sync-Aula.py --kantineform` og send mig udskriften (den viser kun felternes navne).

## [3.6.0] – 2026-11-08

### Tilføjet
- **«Opsætning» i menuen går direkte til opsætningsfanen**, og der er et nyt punkt **«Madplan»**, der går direkte til madplanen (`index.html#ops` og `index.html#mad`). Også `#faste` og `#uge` virker, og skifter du link, mens siden er åben, skifter fanen med. Uden `#` er Uge stadig udgangspunktet. (Er du ikke logget ind endnu, får du PIN-siden først og lander derefter på Uge.)
- **Ugebrevene er delt i skema og tekst.** Brevet står nu som læsbare afsnit: hilsen, overskrifter («Ugen der gik», «Ugen der kommer»), emner fremhævet («**Novemberlæsning:** …») og en afslutning. Skemaet, der før stod som hundrede løse linjer foran brevet, er taget ud af brevteksten. Brevene hentes igen ved næste Aula-hentning; indtil da klippes ældre breve ved hilsenen, så skemaet heller ikke dér står først.
- **Skemaet i ugebrevet bruges som skema.** Står lektionerne ikke i Aulas kalender, læses tabellen i ugebrevet (tider ned ad, ugedage hen ad), og **Skema-vinduet** og skolelinjen pr. dag fyldes ud fra den. Cellerne beholder deres plads (en tom celle er tom, og fredag er stadig fredag), «Pause» er ingen lektion, «DO.» (ditto) forlænger timen før, hold (A:/B:) står sammen, og noter som «Husk svømmetøj» vises under faget. **Lærernes forbogstaver sendes ikke videre** og gemmes ikke på serveren.
- `Sync-Aula.py --brevform` viser, **hvordan et ugebrev er bygget**, uden at vise, hvad der står i det (tags, klasser og tekstmængde). Bruges, hvis skemaet i brevet ikke findes.
- Skema-vinduets tomme besked nævner barnet og hvor skemaet kommer fra.

### Rettet
- **Skema-knappen viste intet,** når Aulas kalender ikke havde lektionerne (skemaet stod kun i ugebrevet).

### Opdatering fra 3.5.7
Upload filerne, kør **Actions → Byg billeder → Run workflow**, og tryk **Redeploy**. Hent så skema og breve med det samme i stedet for at vente til kl. 07: kør `python /app/Sync-Aula.py` i `aula`-containerens terminal. Står skemaet stadig ikke i Skema-vinduet, så kør `python /app/Sync-Aula.py --brevform` og send mig udskriften (den indeholder ikke brevenes tekst).
- **Ikke afprøvet mod rigtige Aula-breve.** Læseren er prøvet mod en opdigtet kopi af brevets opbygning (en HTML-tabel). Er dit brev bygget på en anden måde end en tabel, finder den ikke skemaet, og det er det, `--brevform` viser.

## [3.5.7] – 2026-11-08

### Rettet (alvorlig fejl siden 3.4.0)
- **Forsiden viste «kunne ikke hente data: HTTP 400».** Serverens liste over gyldige stier (`store_valid_path` i `ugeplan-lib/store.php`) kendte ikke de tre indstillinger, 3.4.0 og 3.5.0 indførte: **`settings/affald`** (Tømning), **`settings/visning`** (joke i toppen) og **`settings/vaelger`** (egne lister til den tilfældige vælger). Forsiden bad om dem i samme forespørgsel som alt andet, så **hele hentningen blev afvist**, og både skema og breve manglede, selvom de var hentet fra Aula. Også at gemme Tømning, joke-visning og vælger-lister blev afvist.
- Fejlen kom fra mig: jeg tilføjede stierne i `api.php` (skrivetilladelsen), men ikke i den anden liste, og prøverne kunne ikke se det, fordi de kun tjekkede den ene liste, og PHP ikke kan køres i udviklingsmiljøet.
- **Ny prøve `tests/test_stier.py`** læser serverens regler direkte ud af PHP-koden og sammenligner dem med **alle** stier, siderne bruger, og med skrivetilladelserne. Jeg har kontrolleret, at prøven fejler på den gamle regel. Den tjekker også, at forsiden højst beder om 16 stier ad gangen (grænsen er 40).

### Opdatering fra 3.5.6
Upload filerne, kør **Actions → Byg billeder → Run workflow**, og tryk **Redeploy**. Tøm eventuelt browserens cache (eller genindlæs siden to gange), så den nye side bruges.

## [3.5.6] – 2026-11-08

### Rettet (Aula-login)
Den nye log viste, at omdirigeringen blev fulgt, men at aula-biblioteket stadig afviste siden (`No SAML form found in broker response`). Koden i biblioteket (`mitid_client._process_broker_response`, sendt fra din container) viste hvorfor, og det var ikke `RelayState`:
biblioteket er skrevet til **selv** at sende bekræftelsessiden: det tager den første `<form>` på siden, sender alle dens `<input>`-felter, forventer en **302**, henter dens `Location`, og forventer, at **den** side har Aula-formularen (`SAMLResponse`). Tilføjelsen (3.3.3 til 3.5.5) sendte bekræftelsen selv og gav biblioteket Aula-siden for tidligt. Biblioteket sendte så Aula-formularen, fik en 302 til portalen og ledte efter endnu en formular.
- **Tilføjelsen sender nu kun rollevalget** (KONTAKT) og giver biblioteket **bekræftelsessiden** i stedet. Siden får to ændringer, så biblioteket kan sende den: en **fuld adresse** som `action` (httpx afviser relative adresser) og knappens felt (`accept=ACCEPT`) som **skjult felt**, fordi biblioteket kun læser `<input>`, ikke `<button name=accept>`, som en browser ville sende.
- Er bekræftelsen ikke den første formular på siden (biblioteket tager altid den første), eller kan svaret ikke ændres, sender tilføjelsen selv som før, og det står i loggen.
- `AULA_LOGIN_BEKRAEFT=send` (i `lokal/.env`) giver den gamle opførsel tilbage, hvis et senere bibliotek selv klarer rollesiden.
- Aula-biblioteket er sat til **1.16.0** (den version, du har prøvet med).
- Ny prøve `tests/test_aula_overdrag.py`: en tro gengivelse af bibliotekets eget forløb mod en falsk broker (23 prøver). Den viser, at forløbet nu kommer igennem, og at det gamle forløb giver præcis den fejl, du fik.
- **Stadig ikke afprøvet mod Aula.** Siden efter omdirigeringen, Aulas svar på selve SAML-formularen og alt derefter (tokens, skema, breve) er ikke set endnu. Loggen (`aula-login:`) viser, hvor det eventuelt stopper.

### Opdatering fra 3.5.5
Upload filerne, kør **Actions → Byg billeder → Run workflow**, tryk **Redeploy**, og kør `aula --username DIT-MITID-BRUGERNAVN login` i `aula`-containerens terminal igen. Du behøver ikke opgradere biblioteket selv, for billedet har 1.16.0 nu.

## [3.5.5] – 2026-11-08

### Rettet (Aula-login)
Loggen fra et rigtigt login (version 3.3.3 med diagnose) viste, hvor det gik galt: MitID blev godkendt, rolle-siden («Log ind som: Forælder eller kontaktperson») blev udfyldt, siden med knappen **Næste** blev accepteret, og så svarede Aula med en **omdirigering (HTTP 302)** til `after-post-broker-login`. Tilføjelsen gav den tomme omdirigering videre til aula-biblioteket, som venter en side med en formular, og derfor kom fejlen `No form found in page`.
- **HTTP-omdirigeringer (301, 302, 303) følges nu** med GET, når de peger på `broker.unilogin.dk` eller `login.aula.dk` (højst 6 skridt). Andre mål og http følges ikke. 307 og 308 (gentag POST) følges ikke, og det står i loggen.
- **Formularer og omdirigeringer kan afløse hinanden:** er siden efter en omdirigering en ny rolle- eller bekræftelsesside, udfyldes den også. Højst 4 afsendelser og 6 omdirigeringer i alt.
- Hele kæden fra den rigtige log er gentaget i en prøve (rolle, «Næste», 302, SAML-siden). 21 nye prøver, og de gamle består.
- **Stadig ikke afprøvet mod Aula.** Ligger der flere trin efter omdirigeringen, viser loggen (`aula-login:`) dem.

### Opdatering fra 3.5.4
Upload filerne, kør **Actions → Byg billeder → Run workflow**, tryk **Redeploy**, og kør `aula --username DIT-MITID-BRUGERNAVN login` i `aula`-containerens terminal igen. Send linjerne med `aula-login:` og fejlteksten, hvis det ikke lykkes.

## [3.5.4] – 2026-11-08

### Tilføjet (ingen ændring i selve løsningen)
- **Licens: MIT** (`LICENSE`, ophavsret «Familieoverblik contributors»). Projektet er nu open source. Der er ingen tredjepartskode kopieret ind, og de to biblioteker, billederne installerer (`aula` og `hyundai-kia-connect-api`), er begge MIT.
- **`THIRD_PARTY.md`:** hvilke biblioteker der installeres i billederne og på hvilke vilkår, hvilke tjenester løsningen kontakter (de har egne vilkår), og varemærker.
- README'erne, `docs/DELING.md`, det sociale kort og `CLAUDE.md` er rettet til: licensen står der, og opslagene nævner den. `DELING.md` peger på, at tegneseriekortet (GoComics) er slået til som standard og viser billeder direkte fra GoComics.

### Opdatering fra 3.5.3
Intet at gøre i opsætningen. Upload `LICENSE` og `THIRD_PARTY.md` sammen med resten, så GitHub viser licensen på repoets forside.

## [3.5.3] – 2026-11-08

### Tilføjet (ingen ændring i selve løsningen)
- **Præsentation til GitHub og sociale medier.**
  - `README.md` (dansk) og `README.en.md` er skrevet om til en forside for projektet: hvad det er, hvad det kan, hvordan det hænger sammen, kom i gang, privatliv og sikkerhed, ærlig status, ansvar og tak. Ingen skærmbilleder (der er et sted til dem) og ingen licens (den vælger ejeren).
  - `docs/DELING.md`: tjekliste, før projektet gøres offentligt, tekster til GitHub (beskrivelse, emner, udgave), opslag til LinkedIn, Facebook, Reddit, X/Bluesky og Mastodon (dansk og engelsk, med grænser for længden), svar på de spørgsmål, der kommer, og en disposition til en kort video.
  - `docs/social-preview.png` (1280×640, til GitHub), `docs/social-linkedin-1200x630.png` og `docs/arkitektur.svg` (hvordan det hænger sammen).
- Ny prøve `tests/test_praesentation.py`: alle links i README'erne peger på filer, der findes, billederne har de rigtige mål, diagrammet er gyldigt, opslagene holder sig inden for deres grænser, og der står ingen personnavne eller hemmeligheder i de offentlige filer.

### Opdatering fra 3.5.2
Intet at gøre i opsætningen. Upload filerne, hvis du vil have den nye forside i dit repo.

## [3.5.2] – 2026-11-08

### Tilføjet (ingen ændring i selve løsningen)
- **`CLAUDE.md`: overdragelse til den næste Claude eller udvikler.** Hvad projektet er, hvordan man kommer i gang på ti minutter, hvor tingene ligger, arbejdsregler, faldgruber, opskrifter (ny indstilling, nyt kort, nyt endpoint, ny udgave), status, åbne punkter og kendte svage steder. Skrevet, så en Claude, der får zip-filen uden at kende historien, kan bygge videre uden at gætte.
- **`tests/alle.py`** kører alle prøver (Python og JavaScript) og giver en samlet oversigt.
- **`vaerktoej/pak.py`** pakker en udgave: zip-filen og guiden til Notepad++ (UTF-8 med BOM, CRLF). Prøvet i `tests/test_pak.py`, som også kører i GitHub-workflowet.
- `README.md` og `UDVIKLING.md` peger på de nye filer.
- Prøven af shell-scripts er ikke længere afhængig af filens «kørbar»-markering, som en upload i browseren og nogle udpakningsværktøjer ikke bevarer. Billederne afhænger ikke af den (Dockerfilen kører `chmod +x` eller starter scriptet med `sh`). Fundet ved at køre alle prøver i en frisk udpakning.

### Opdatering fra 3.5.1
Intet at gøre i opsætningen. Upload filerne, hvis du vil have de nye filer i dit repo.

## [3.5.1] – 2026-11-08

### Tilføjet
- **Knappen «Fuld skærm»** nederst på forsiden (ved siden af «Tilpas layout»). Chrome på Android har ingen fuldskærmsknap, og en side må kun gå i fuld skærm efter et tryk. Knappen virker i Chrome, Firefox og andre browsere med Fullscreen API, **også den præfikserede udgave i ældre Chrome (Android 5)**. Knappen er skjult på enheder uden Fullscreen API (fx iPhone) og i en installeret app, der allerede er i fuld skærm. Chrome går ud af fuld skærm, når siden skifter eller genindlæses; derfor **huskes valget på enheden**, og første tryk efter en genindlæsning går i fuld skærm igen. «Afslut fuld skærm» slår det fra. Valget huskes først, når browseren har sagt ja.

### Rettet
- Teksten om flere fødselsdage på samme dag brugte `Array.at()` (Chrome 92) og kunne vælte siden i ældre browsere. Den bruger nu almindelig indeksering. Siderne kræver nu cirka Chrome 85 (valgfri kæde `?.`, `??=` og mellemrum i fleksible rækker), så de kan køre i Chrome 95, som er den sidste til Android 5.
- Oversættelser af «Fuld skærm» og «Afslut fuld skærm».

### Opdatering fra 3.5.0
Upload filerne, kør **Actions → Byg billeder → Run workflow**, og tryk **Redeploy**.

## [3.5.0] – 2026-11-08

### Tilføjet
- **Åben visning** (#3). Under Opsætning → Login og sikkerhed vælger du **Hvem må se forsiden?**: *Kun med PIN-kode* (standard) eller *Forsiden kan ses uden PIN-kode (PIN til alt andet)*.
  Er åben visning slået til, kan **forsiden (`overblik.html`) og vælgeren** ses uden login, og roden (`/`) sender til forsiden. De data, forsiden viser (vejr, joke, elpris, bil, tegneserie, tema, billeder til pauseskærmen, sprog, version, Strava-aktiviteter og indkøbsliste), kan **læses** (GET) uden PIN. `config.js` kan hentes, fordi forsiden skal bruge læsenøglen.
  **Alt andet kræver stadig PIN** (eller totrinsbekræftelse): indstillinger (`index.html`), billeder-siden, gæste-wifi, backlog, kalendere, wifi, oversættelse, sikkerhedskopi, totrinsbekræftelse og enhver skrivning til disse scripts.
  Pas på: læsenøglen står åbent, så alle på netværket også kan ændre det, skærmen selv ændrer (afkrydsninger, opslagstavlen, huskepunkter). Vælg det kun på et netværk, du stoler på. Valget gælder med det samme og gemmes i sikkerhedskopien.
  Afprøvet med en lille tolker af `.htaccess` (alle sider og scripts, GET/HEAD/POST/PUT/DELETE, med og uden cookie) og med PHP-reglen i `gate.php` spejlet efter kildeteksten. 24 prøver. Selve Apache og PHP er stadig ikke kørt.
- **Drej billeder** (#12). Hver miniature i pauseskærmens billedliste har knapper til at **dreje mod uret og med uret**. Billedet hentes, drejes i browseren, lægges ind som et nyt billede, og først bagefter slettes det gamle (så intet kan gå tabt, hvis noget fejler).
- `backlog-status-3.5.0.json` sætter de to punkter til Færdig i jeres backlog.

### Rettet
- Læsning af åben visning gik gennem hvert scripts egen cookie-kontrol. Alle scripts bruger nu den fælles `gate_ok()`, og en prøve sikrer, at ingen har deres egen cookie-kontrol ved siden af.

### Opdatering fra 3.4.0
Upload filerne, kør **Actions → Byg billeder → Run workflow**, og tryk **Redeploy**. Åben visning er slået fra, til du slår den til.

## [3.4.0] – 2026-11-08

Bygget ud fra familiens egen backlog (punkterne, I selv har lagt ind på backlog-siden).

### Tilføjet
- **Skjul et kort helt** (#17). I «Tilpas layout» har hvert kort en **✕**. De skjulte kort samles som knapper i panelet (**＋ Kortets navn**), så de kan hentes tilbage. Valget gemmes pr. enhed.
- **Halv størrelse** (#10). Størrelsesknappen på hvert kort skifter mellem **Smal** (i kolonnen), **Halv** (to kort side om side) og **Bred** (hele rækken). På en telefon står halve kort under hinanden.
- **Opsætning som træ** (#9). Én side pr. hovedoverskrift, i fire grupper: Familie, Kort på oversigten, Tjenester, Sider og System. Til venstre på en computer, som valgmenu på en telefon. Den valgte side huskes. En sektion, der først vises, når serveren har svaret, kommer med i træet, når den vises.
- **Tømning** (#2, den manuelle del). Nyt kort på forsiden og en side i opsætningen. For hver fraktion skriver du **én dato med tømning og antal uger imellem**; resten regnes ud. Datoer, der **udgår** (helligdage), og **ekstra** datoer (storskrald). Flere adresser. Kortet viser næste tømning pr. fraktion med farve og ugedag, og aftenen før står «sæt spanden ud» under **Vigtigt snart**. Den automatiske del fra Renosyd venter på afklaring af loginet.
- **Dagens joke i toppen** (#18). Under Dagens joke vælger du, om joken er et kort eller står **i toppen af forsiden, kun selve joken**. Gælder alle enheder.
- **Egne lister til den tilfældige vælger** (#13). Under Opsætning → Tilfældig vælger, eller med **Gem som liste** på selve siden. Listerne står under «Indsæt en liste» på alle enheder, og standardlisterne kan skjules.
- **Elpris: «Kun søjler»** (#15). Skjuler alt på kortet undtagen søjlediagrammet (billigste periode, tal, noter og prognose for de næste dage). Gemmes pr. enhed.
- **Enklere vejrkort med vind** (#16). Timerne vises hver tredje time. Hver time, dag og «i dag»-linjen er farvet efter vejrtype (sol, let skyet, overskyet, tåge, regn, sne, torden), og natten er markeret. **Vind** står med styrke, retning og stød («8 m/s fra SV, stød 14, jævn vind») for i dag og for hver af de næste dage.
- **Kilde på kalenderposter** (#11). Feltet **Navn og kilde** i kalenderdialogen vises som kilde på forsiden (fx «Holdsport» eller «Skolen»). Uden tekst bruges det gamle gæt ud fra ikonet.
- **Tema pr. enhed** (#20). Nederst på forsiden vælger du **Tema: som opsat**, **automatisk** (lys eller mørk efter enheden), **lys**, **varm**, **mørk** eller **høj kontrast** på netop den enhed. Valget går forud for de fælles farver, og siden blinker ikke ved indlæsning.
- **Backlog-import kan opdatere** status, prioritet og kommentarer på punkter, der findes (en fil med `"opdater": true`). `backlog-status-3.4.0.json` sætter de byggede punkter til Færdig i jeres backlog.
- Oversættelser (English, Deutsch) af de nye knapper, valg og tekster.

### Rettet
- **Pauseskærmen** (#14) viser ikke længere sidens rullelinje. Billedet fylder hele skærmen.
- Fødselsdagsfeltet i opsætningsguiden sammenlignede med et tidspunkt i UTC og kunne i visse tidszoner godkende «i morgen» sent på dagen. Det bruger nu dagens lokale dato.
- En vejrkode, der mangler (`null`), blev regnet som sol.
- Ordet «constructor» blev accepteret som et gemt temavalg.
- **Prøverne:** alle sidernes JavaScript-prøver (984) ligger nu i projektet og **kører i GitHub-workflowet**, i alle tidszoner. Fire prøvefiler pegede på den gamle 2.6.0-kilde i stedet for denne.

### Ændret
- Forsiden henter nu også `settings/affald`, `settings/visning` og `settings/vaelger`. `api.php` tillader, at skærmen gemmer dem (to linjer i listen over stier).
- Service workerens cache er `shell-v2` (to nye filer: `affald.js` og `tema-forvalg.js`).
- **Workflowet er udvidet** med en JavaScript-prøve. Du behøver ikke opdatere din egen kopi, men `github-workflow/billeder.yml` har den nye version.

### Opdatering fra 3.3.3
Upload filerne, kør **Actions → Byg billeder → Run workflow**, og tryk **Redeploy**. Vinddata til vejrkortet og kilder på kalenderposter dukker op ved næste hentning (inden for en halv time til en time). Åbn **Sider ▾ → Backlog**, og læg `backlog-status-3.4.0.json` ind under «Læg en JSON-fil ind» for at sætte de byggede punkter til Færdig.

## [3.3.3] – 2026-11-07

### Rettet (Aula-login)
- **Billedet, der skal loade, før man sendes videre.** Efter rolle og bekræftelse viser Aulas login en side, der loader et billede (typisk et lille sporingsbillede, der sætter en cookie), og først bagefter sendes man videre. En browser gør det af sig selv. Aula-biblioteket gør det ikke, og det er den mest sandsynlige årsag til `SAMLError: No form found in page`.
  Tilføjelsen henter nu billederne på svarsiden (`<img src>` og JavaScript-billeder) **før** den følger omdirigeringen og giver siden til biblioteket. Kun https og kun værter hos Aula og Unilogin (andre hentes ikke og står i loggen), højst 6 pr. side, med `Referer` og `Accept: image/*`. Et billede, der ikke kan hentes, vælter ikke login.
- Loggen viser nu også, hvilke billeder en side indeholder (`billeder: …`), og hvilke der blev hentet.
- Rettet: en loft-fejl, så højst 3 omdirigeringer følges. Prøven af endeløse omdirigeringer prøvede ikke det rigtige før.
- 14 nye prøver (40 i alt i `tests/test_aula_diagnose.py`).
- **Stadig ikke afprøvet mod Aula.** Er billedet ikke løsningen, eller bygger siden adressen op i JavaScript, vil loggen vise, hvad siden indeholder.

### Opdatering fra 3.3.2
Upload filerne, kør **Actions → Byg billeder → Run workflow**, tryk **Redeploy**, og log ind igen i `aula`-containerens terminal.

## [3.3.2] – 2026-11-07

### Rettet / Tilføjet (Aula-login)
Første rigtige Aula-login fra containeren: MitID blev godkendt, rolle og bekræftelsesside blev udfyldt, men så stoppede det med `SAMLError: No form found in page`. Svaret efter bekræftelsen indeholdt altså ingen formular, som aula-biblioteket kan arbejde videre med. Hvad svaret indeholder, kunne vi ikke se. Derfor:
- **Diagnose:** Efter hver formular, tilføjelsen sender, skrives en linje om svaret: status, adresse uden query, titel, tekst, formularernes feltnavne og knapper, links og omdirigeringer. Aldrig værdier eller koder. Der skrives også en linje om selve bekræftelsessiden. `AULA_LOGIN_DETALJER=0` gør det stille.
- **Omdirigering:** Er svaret en side uden formular, men med en omdirigering (meta refresh eller JavaScript) til `broker.unilogin.dk` eller `login.aula.dk`, følges den (højst 3 gange), så biblioteket får den side, det venter. Andre værter og http følges aldrig.
- 26 nye prøver (`tests/test_aula_diagnose.py`), og de 39 eksisterende prøver af tilføjelsen (`tests/test_aulapatch.py`) kører nu i projektet og i GitHub-workflowet.
- **Ikke afprøvet mod Aula.** Tilføjelsen er kun afprøvet mod en falsk httpx. Om omdirigeringen er det, der mangler, vil loggen vise.

### Opdatering fra 3.3.1
Upload filerne, kør **Actions → Byg billeder → Run workflow**, og tryk **Redeploy**. Log så ind igen i `aula`-containerens terminal og send linjerne med `aula-login:`.

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
