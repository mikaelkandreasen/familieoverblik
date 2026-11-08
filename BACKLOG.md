# Backlog: Familieoverblik

Sidst opdateret 7. november 2026. Baseret på version **3.5.1**.

**Sådan læses den**
- **Prioritet:** P1 = næste, P2 = derefter, P3 = når der er tid, P4 = parkeret (fremtid).
- **Størrelse:** arbejdsdage for mig inkl. prøver og dokumentation, **uden** runder frem og tilbage, fordi jeg ikke kan køre PHP, Docker eller de eksterne tjenester her. Regn med 1 til 3 runder med dine fejlmeldinger pr. punkt.
- **Risiko:** hvor meget der afhænger af noget uden for projektet (uofficielle API'er, tjenester der ændrer vilkår).
- **Status:** Idé · Planlagt · I gang · Færdig · Droppet.

## Beslutninger (7. november 2026)

- **Billedgalleri fra skyen (Google Drive, Dropbox, Jottacloud og alternativer) er droppet for nu.** Researchen ligger under «Fremtid».
- **Flere elbiler** er kun til fremtiden og ligger under «Fremtid».
- **Menuen** bliver, hvor den er (nederst på forsiden). Backlog-siden kommer ind i den som et almindeligt menupunkt.
- **Google Translate** som oversættelsesmotor er droppet. Claude bliver ved.
- **Renosyd** gælder kun Skanderborg. Tømningsdatoerne ligger i dag bag en login-portal (se punkt 2).
- **Familien bruger både iPhone og Android.** Det afgør valget, hvis billedgalleriet tages op igen.

## Overblik

| # | Punkt | Pri. | Størrelse | Risiko | Status |
|---|---|---|---|---|---|
| 1 | Backlog-side i appen, nået fra menuen, hvor nye tiltag kan logges | **P1** | 1 til 1,5 dag | Lav | **Færdig i 3.3.0** (afventer din test) |
| 2 | Tømningskalender fra Renosyd (Skanderborg) for en valgt adresse eller bruger | P2 | 0,5 dag til afklaring, så 1 til 4 dage | Høj, afhænger af loginet | Afklaring |
| 3 | Åben visning med PIN kun til indstillinger og sikkerhedskopi | P3 | ca. 1 dag | Lav | Idé |
| 4 | Vejledning og færdig opsætning til https (reverse proxy) | P3 | 1 dag | Lav | Idé |
| 5 | Login pr. enhed (kan tilbagekaldes enkeltvis) i stedet for én fælles cookie | P4 | 1 til 2 dage | Lav | Idé |
| 6 | Aula-login i browseren i stedet for i en terminal | P4 | 3 til 5 dage | Høj | Idé |
| 7 | Billedgalleri fra skyen til pauseskærmen (research færdig, Immich foretrukket) | P4 (fremtid) | 4 til 6 dage med rclone, 1,5 til 2,5 med Immich | Mellem | Droppet for nu |
| 8 | Flere elbiler: Kia, Audi, VW og Tesla | P4 (fremtid) | 1 til 2 dage til grundlaget, så 0,5 til 4 dage pr. mærke | Mellem til høj | Parkeret |

Forslag til rækkefølge: **punkt 1 er bygget** (version 3.3.0; læg `backlog-start.json` ind på siden for at få disse punkter dér). **Punkt 2** starter med en afklaring, som kun du kan lave (se nedenfor).

---

## 1. Backlog-side i appen (P1): færdig i 3.3.0

**Bygget:** se `CHANGELOG.md`. Der blev ikke lavet en «Send til udvikling»-knap (GitHub-issue); den står stadig som idé nedenfor.

**Mål:** En side, hvor man selv kan logge nye tiltag, og som kan nås fra menuen **Sider ▾** (som den er i dag, nederst på forsiden).

**Indhold**
- **Nyt punkt:** titel, beskrivelse, kategori (billeder, bil, kalender, sprog, sikkerhed, andet), ønsket prioritet, hvem der foreslår det.
- **Liste:** filtre (kategori, status, prioritet), sortering, søgning.
- **Status:** Idé, Planlagt, I gang, Færdig, Droppet. Ændres af den, der har PIN-koden.
- **Stemmer:** et plus pr. person pr. punkt, så familien kan prioritere.
- **Kommentarer** på et punkt.
- **Eksport** som Markdown og CSV, så den kan lægges ind her.
- Gemmes i `private/backlog.json` (med i sikkerhedskopien), kun med login.
- Menupunktet kommer i **Sider ▾**.

**Størrelse:** 1 til 1,5 dag. **Senere:** knap «Send til udvikling» (opretter en GitHub-issue, kræver et token).

---

## 2. Tømningskalender fra Renosyd, Skanderborg (P2)

**Mål:** Vis, hvornår skraldespandene tømmes, for en valgt adresse (og evt. flere: din egen og fx en slægtnings), og mind om det aftenen før.

**Hvad jeg ved, og hvad jeg ikke ved**
- **Renosyd dækker Skanderborg og Odder.** Du bruger kun Skanderborg.
- Du siger, at datoerne i dag ligger **bag en login-portal («Mit Renosyd»)**. Så findes der ingen åben adresse, vi bare kan spørge.
- Det community-vedligeholdte projekt «affalddk» (Home Assistant) lister Skanderborg som understøttet via et **uofficielt** API. Jeg kunne **ikke** se, om det kræver login, eller hvordan det logger ind. Det skal undersøges.
- **Alt afhænger af, hvordan portalens login virker.** Er det bruger og adgangskode, kan en tjeneste logge ind for dig (adgangskoden gemmes i `private/instans.json`, og portalen kan ændre sig). Er det **MitID**, kan det **ikke** automatiseres.

**Afklaring (0,5 dag, og jeg skal bruge din hjælp):**
1. Hvordan logger du ind i Mit Renosyd (bruger og adgangskode, eller MitID)?
2. Står der en knap som «Hent kalender», «Abonnér» eller «Eksportér» (iCal/ICS) på tømmekalenderen? Så kan linket lægges ind under **Kalendere** i dag uden kode (0 dage).
3. Er der en mobilapp? (Den bruger typisk et API, vi kan bruge.)

**Veje, afhængigt af svaret**
- **A. iCal-link findes:** brug Kalendere. 0 dage. Et lille kort «Næste tømning» ovenpå: 1 dag.
- **B. Almindeligt login:** adapter, der logger ind og henter datoerne hver nat. 2 til 4 dage. Skrøbelig.
- **C. Kun MitID:** en **egen tidsplan**. Under Opsætning → **Affald** angiver man pr. fraktion en startdato og et interval (fx restaffald hver anden torsdag fra 12. november) og evt. undtagelser. Virker uden nogen forbindelse, men skal rettes i hånden, når kommunen ændrer. 0,5 til 1 dag.

**Kort på forsiden (alle veje):** «Næste tømning» pr. fraktion (restaffald, papir og pap, glas og metal, plast, mad, storskrald) med dato og farve. **Påmindelse** «Husk spanden i aften» i **Klar til i morgen**. **Flere adresser** med navn og evt. en person. Hentes af cron-containeren hver nat, gemmes 24 timer, og ved fejl vises den seneste kendte dato med «ikke opdateret».

---

## Parkeret og idéer

- **3. Åben visning med PIN til indstillinger:** Forsiden åbner uden login (til væg-skærmen), men alt, der kan ændre eller hente noget, kræver PIN. ca. 1 dag.
- **4. https:** En færdig opskrift (Caddy eller Traefik) til at sætte siden bag https på det lokale net. Nødvendigt, hvis gæster eller ukendte enheder er på samme net.
- **5. Login pr. enhed:** Hver enhed får sin egen cookie, så en tabt tablet kan tilbagekaldes alene.
- **6. Aula-login i browseren:** Vise MitID-QR-koderne på en side i stedet for i en terminal. Afhænger af, at aula-biblioteket kan give QR-data uden terminalen. Usikkert.

---

## Fremtid: Billedgalleri fra skyen til pauseskærmen (P4)

**Status 7. november: droppet for nu.** Researchen er bevaret nedenfor, så den ikke skal laves igen.

**Når det tages op igen:** I bruger **både iPhone og Android**. Det taler for **Immich** (begge slags telefoner uploader automatisk, og Immich laver selv de mindre udgaver). Et **delt iCloud-album** passer dårligt, fordi kun iPhone-brugere kan lægge billeder i det, og **Syncthing** har ingen officiel iPhone-app. Den enkleste uden at drive noget selv er en **delt Dropbox-mappe**.

**Mål:** Vælg en mappe i en sky, og få billederne vist i pauseskærmen uden at uploade dem i hånden.

**Hvad jeg har fundet (kontrolleret):**
- **Google Fotos kan ikke bruges.** Fra 31. marts 2025 kan Photos Library API kun læse medier, appen selv har lavet. Vi bruger i stedet en mappe i **Google Drive**.
- **Google Drive er besværligt at drive uden opsyn.** Laver man sin egen app hos Google og lader den stå i «testing», **udløber adgangen efter 7 dage**, og man skal logge ind igen. Det er det, der får mange til at opgive. Den delte nøgle, rclone selv leverer, er overbelastet (fejl 403), og den er ifølge en kilde (en blog, ikke rclone selv) planlagt udfaset i 2026. Den vej, der holder, er en **servicekonto**: man laver en i Google Cloud (ca. 10 klik, én gang), og deler mappen med servicekontoens adresse. Den kan ikke udløbe.
- **Dropbox** er den nemmeste at holde kørende: rclone har Dropbox indbygget, man godkender én gang, og adgangen fornyes af sig selv. *Jeg har ikke kunnet bekræfte hver detalje om Dropbox i dag. Det skal ses i første fase.*
- **Jottacloud har ikke et offentligt API for private konti.** rclone logger ind med et «personal login token», man laver på jottacloud.com/web/secure. Det er ikke et officielt integrationsspor, så det kan holde op med at virke.
- **rclone** dækker alle tre, så **én løsning** kan bruges.

**Gratis og nemmere alternativer (undersøgt 7. november)**

| Mulighed | Pris | Hvor nemt | Hvad der kan gå galt |
|---|---|---|---|
| **Delt album med «offentlig hjemmeside» i iCloud** | Gratis | **Meget nemt for iPhone-familier** (I deler allerede albums). Serveren skal ikke logge ind nogen steder. | Apple har **intet officielt API**. Det bruger det interne, som kan ændre sig. Nogle brugere rapporterer, at den offentlige side ikke kan vise billederne. Alle med linket kan se albummet. |
| **Delt mappe-link i Dropbox eller Google Drive** («alle med linket») | Gratis | **Nemt:** intet token og ingen fornyelse. For Drive skal der laves en API-nøgle (ikke en login-godkendelse). *Skal bekræftes i praksis.* | Alle med linket kan se mappen. Linket er langt og ikke til at gætte, men det er ikke en adgangskode. |
| **Immich** (selvhostet fotobibliotek på din NUC) | Gratis, åben kildekode | **Det bedste, men ikke det nemmeste at sætte op:** telefonerne uploader af sig selv, og Immich laver selv de mindre udgaver (så HEIC og store billeder er løst). Adgang med en API-nøgle, og albums kan vælges. | En ny tjeneste at holde opdateret (flere containere og lidt hukommelse, men det kan en NUC med 16 GB). Billederne skal ind i Immich. |
| **Syncthing** (mappesynkronisering mellem dine egne enheder) | Gratis, ingen sky | Nem fra en computer eller Android. Serveren ser bare en mappe. | **Ingen officiel iPhone-app.** Skal sættes op én gang med en lille webside. |
| **Dropbox via login** (rclone) | Gratis (2 GB) | Nem, og adgangen fornyes af sig selv. | Kun 2 GB. Kræver en godkendelse på en computer med browser. |
| Google Drive via login | Gratis (15 GB) | **Besværlig:** adgangen udløber efter 7 dage, medmindre man bruger en servicekonto (ca. 10 klik i Google Cloud). | Se ovenfor. |
| Jottacloud | Betalt eller lille gratis | Ikke et officielt spor (login-token). | Kan holde op med at virke. |

**Forslag (hvis vi vælger rclone og login):** Én ny container, `familieoverblik-galleri`, bygget på rclone.
1. Opsætning → **Galleri**: tilføj en kilde (type, mappe, hvor ofte, højst hvor mange billeder). Adgangen gemmes i `private/instans.json`. For Dropbox indsættes et token fra `rclone authorize` (køres én gang på en computer med browser), for Google Drive en servicekonto-nøgle, for Jottacloud login-tokenet.
2. Containeren kopierer (kun nye og ændrede) til `billeder/<kilde>/` i datavolumet. Pauseskærmen bruger allerede billedmappen, så den virker uden ændring.
3. **Billederne omskaleres** til højst 1920 punkter og **HEIC laves om til JPEG** (iPhone-billeder er ofte HEIC, og originaler på 5 til 10 MB er for tunge til væg-skærmen). Billeder, der er fjernet i skyen, fjernes også her (kun i den kilde-mappe).
4. Status og fejl vises under Opsætning (sidste kørsel, antal billeder, fejltekst) med en knap «Hent nu». Der er et loft på diskplads.
5. Medtages i sikkerhedskopien (uden de hentede billeder, som kan hentes igen).

**Størrelse for alternativerne (hver for sig, når rammen med omskalering og status findes):** delt link 0,5 til 1 dag pr. tjeneste. Immich 1,5 til 2,5 dage (ingen omskalering eller HEIC-trin, fordi Immich laver udgaverne). Syncthing 1 dag (kun en mappe, men ingen status at vise).

**Faser (rclone-sporet):**
- **a)** Dropbox og selve rammen (container, opsætning, omskalering, status): 2 til 3 dage.
- **b)** Google Drive via servicekonto, med en guide til Google Cloud-trinnene: 1 til 1,5 dag.
- **c)** Jottacloud: 1 til 2 dage, den skrøbeligste.

**Risici og åbne punkter**
- **Privatliv:** Billederne kopieres til din NUC og forlader den ikke igen. Pas på, at mappen kun indeholder billeder, du vil have vist.
- **Dropbox:** Gratis konti har 2 GB. Det er rigeligt til en udvalgt mappe, men ikke til hele fotobiblioteket.
- **Alternativ uden login:** en offentlig delt mappe. Den er nem, men kan ses af alle med linket. Frarådes.

**Færdig når:** en kilde pr. type kan tilføjes og fjernes i Opsætning, billederne dukker op i pauseskærmen inden for ét interval, fjernede billeder forsvinder, HEIC virker, og fejl vises forståeligt. Prøver med en falsk rclone og med rigtige billedfiler.

---

## Fremtid: Flere elbiler (P4)

Ikke planlagt nu. Her er det, jeg fandt, så det ikke skal findes igen.

**I dag:** Kun Hyundai Ioniq 6 (via `hyundai-kia-connect-api`), ét køretøj.

**Fund (kontrolleret):**
- **Kia:** samme bibliotek som Hyundai understøtter Kia. Samme sårbarhed over for Europa-loginets ustabilitet.
- **VW, Audi, Škoda, Seat og Cupra:** **VW har blokeret WeConnect-adgang for tredjepartsintegrationer.** Den vej, der er tilbage til private, er **EU Data Act-portalen**: kun læsning, data cirka hvert 15. minut, delvise data (rækkevidde mangler ofte), og forbindelsen findes kun som et pre-release i CarConnectivity. Audi er med på samme portal. **Škoda** har et officielt API (beta) med en nøgle fra MyŠkoda-appen, men kun 20 forespørgsler i timen.
- **Tesla:** Fleet API er betaling efter forbrug (data ca. 0,002 dollar pr. forespørgsel), kræver en udviklerkonto og godkendelse af en app og typisk en offentlig nøgle på et domæne. *Kravene skal bekræftes, før noget bygges.*

**Når det bliver aktuelt:**
- **Trin 0 (1 til 1,5 dag):** Lav bil-delen om til **adaptere** (samme svar fra alle: batteri i procent, rækkevidde, lader/tilsluttet, hentet hvornår) og **flere biler** (navn, mærke, ejer, ikon).
- **Trin 1 – Kia (0,5 dag).**
- **Trin 2 – Home Assistant-adapter (1 til 2 dage),** hvis du kører Home Assistant: den korteste vej til Tesla, VW og Audi, fordi HA ofte allerede har løst logins.
- **Trin 3 og 4 – VW-gruppen eller Tesla direkte** (2 til 4 dage hver), kun hvis HA ikke er en mulighed.

---

## Spørgsmål, der skal besvares

1. **Renosyd:** De tre afklaringsspørgsmål i punkt 2: hvordan logger du ind i Mit Renosyd (bruger og adgangskode, eller MitID), findes en «Hent kalender»-knap på tømmekalenderen, og er der en mobilapp?

## Definition af færdig (gælder alle punkter)

Prøver, som kan køre uden netværk (falske tjenester), opdateret guide og changelog, ingen nye hemmeligheder uden for `private/`, nye endpoints bag login, og en ærlig liste over det, jeg ikke har kunnet afprøve.


---

## Status efter 3.5.0 (8. november 2026)

Familiens egne punkter i appens backlog (de 12, I selv har lagt ind), og hvad der er sket:

| Punkt | Status |
|---|---|
| Fravalg af kort på oversigten | Færdig i 3.4.0 |
| Forsidekort side om side (halv størrelse) | Færdig i 3.4.0 |
| Opsætningssiden som træ | Færdig i 3.4.0 |
| Kilder på kalender (tekstfelt) | Færdig i 3.4.0 |
| Spinner: gem foruddefinerede valg | Færdig i 3.4.0 |
| Elpris: klap sammen til søjlegrafen | Færdig i 3.4.0 |
| Vejrkort: enklere, vind, farver | Færdig i 3.4.0 |
| Pauseskærm uden rullelinje | Færdig i 3.4.0 |
| Joke i toppen | Færdig i 3.4.0 |
| Lys/mørk/varm tema på oversigten | Færdig i 3.4.0 |
| Tømningskalender (Renosyd) | Manuel tidsplan færdig. Automatisk del afventer afklaring af loginet |
| Rotering af billeder | Færdig i 3.5.0 |
| Åben visning med PIN til indstillinger | Færdig i 3.5.0 (slået fra som standard) |
| Aula kantinemenu | Afventer et eksempel på en besked fra Aula |

## Ny idé: browser-tjek og ældre enheder (fra 8. november)

- **Browser-tjek (`browser.html`)** og en venlig besked på siderne, hvis browseren er for gammel («Din browser er for gammel»), i stedet for en blank side. Ca. et par timer.
- **Støtte under Chrome 85** (ældre Android-enheder, fx 4.4): oversættelse af `?.`, `??` og `??=` samt reserver til `gap` i fleksible rækker (2 til 3 dage). Under Chrome 61 mangler `<script type="module">`, og så skal alle sider bygges som almindeligt, ældre JavaScript med reserver til `grid` (1 til 2 uger, frarådes). Se spørgsmålet om Android 5.1.
