# Deling: GitHub og sociale medier

Alt, du skal bruge for at præsentere Familieoverblik: tekster til GitHub, opslag til sociale medier (dansk og engelsk), svar på de spørgsmål, der kommer, og en tjekliste, **inden du gør noget offentligt**.
Billederne ligger i denne mappe: `social-preview.png` (1280×640, til GitHub) og `social-linkedin-1200x630.png` (til LinkedIn og Facebook), og diagrammet `arkitektur.svg`.

## 1. Tjekliste, før du deler

- [x] **Licens: MIT er valgt** (filen `LICENSE` ligger i repoet, og `THIRD_PARTY.md` oplister bibliotekerne, som alle er MIT). Vil du hellere have, at ændringer skal deles videre, så skift `LICENSE` til **GPL-3.0** eller **AGPL-3.0** (de er forenelige med MIT-bibliotekerne) og ret «Licens» i README'erne. Ophavsretten står i navnet «Familieoverblik contributors». Vil du have dit eget navn på, så ret linjen i `LICENSE`. Vær opmærksom på, at tjenesterne, løsningen kontakter, har egne vilkår, især **GoComics** (tegneseriekortet viser billeder direkte fra deres sider og er slået til som standard): overvej at slå det fra som standard, før du anbefaler løsningen bredt.
- [ ] **Prøv det på din egen server først**, især Aula-login, totrinsbekræftelse og åben visning. Står der i README, at det er en *tidlig udgave*, er det fint, men du skal selv vide, hvad der virker.
- [ ] **Ingen hemmeligheder i repoet.** Der må ikke ligge `instans.json`, `totp.json`, `backlog.json`, nøgler eller `.env` (zip-filen indeholder dem ikke). Åbn repoets filliste, og kig efter.
- [ ] **Skærmbilleder uden persondata.** Skjul børns navne, skolens navn, breve, adresser og kalenderposter, der afslører, hvor I er. Vis det hellere med en testprofil end med jeres rigtige data.
- [ ] **Læs `CLAUDE.md` igennem.** Afsnit 8 beskriver brugeren uden navne, men du skal selv være tryg ved, at det er offentligt. Slet afsnittet, hvis du vil.
- [ ] **Overvej sætningen «Bygget i samarbejde med Claude (Anthropic)»** i README. Den er sand og gør det nemt for andre at vurdere projektet. Fjern den, hvis du ikke vil have den med.
- [ ] **Upload det sociale kort:** repo → *Settings → General → Social preview → Edit → Upload an image* → `docs/social-preview.png`.
- [ ] **Sæt beskrivelse og emner** (afsnit 2), og slå *Issues* til.
- [ ] **Gør repoet offentligt:** *Settings → General → Danger Zone → Change repository visibility → Make public*. (Billederne i *Packages* er separate og kan blive private.)
- [ ] **Sikkerhedsproblemer:** slå *Private vulnerability reporting* til under *Settings → Code security*, så folk kan melde fejl uden at gøre dem offentlige.

## 2. GitHub

**Repo-navn:** `familieoverblik`

**About (beskrivelse, højst 350 tegn):**

<!-- maks: 350 -->
```
Selvhostet familieoverblik til væg-skærm og telefon: skema og breve fra Aula, kalendere, vejr, elpris, tømning og fødselsdage på én side. Docker og Dockhand, ingen SSH, dansk. Uofficielt projekt.
```

**Emner (topics):** `aula` `denmark` `dashboard` `family-dashboard` `home-dashboard` `self-hosted` `selfhosted` `docker` `docker-compose` `dockhand` `php` `python` `wall-display` `kiosk` `danish` `claude`

**Udgave (release):** tag `v3.5.3`, titel *Familieoverblik 3.5.3*, og i teksten:

```
Tidlig udgave. Se README for status og begrænsninger.

Nyt siden sidst: fuld skærm-knap, drej billeder, åben visning, tømningskalender, enklere vejrkort med vind, tema pr. enhed, backlog-side, egne lister til den tilfældige vælger og mere. Hele listen står i CHANGELOG.md.

Kom i gang: GUIDE-V3.md. Uofficielt projekt, ikke tilknyttet Aula.
```

## 3. Opslag (dansk)

### LinkedIn

<!-- maks: 1500 -->
```
Jeg har lavet et familieoverblik til væggen derhjemme.

På én skærm: børnenes skema og ugebreve fra Aula, kalenderen med fodbold og fritid, vejret, hvornår strømmen er billigst, hvornår skraldespanden skal ud, og en fødselsdagsflagning, der får hele skærmen til at fejre dagen.

Det kører på en lille server hjemme (Docker, styret med Dockhand), og man behøver ikke SSH: opsætningen er en guide i browseren. Alt gemmes hos én selv. Der er PIN, totrinsbekræftelse og en valgfri åben visning til væg-skærmen.

Det er bygget i samarbejde med Claude (Anthropic) med automatiske prøver hele vejen (over 1.300), og jeg er ærlig om, hvad der ikke er afprøvet endnu: Aula-delen bruger et uofficielt bibliotek, og jeg har ikke kørt det mod Aula selv.

Koden (MIT-licens, open source) og en trin-for-trin-guide ligger på GitHub: [link]

Det er uofficielt og ikke tilknyttet Aula. Fortæl gerne, hvad der virker, og hvad der ikke gør.

#selfhosted #docker #Aula #smarthome #opensource
```

### Facebook (fx en forældre- eller smart home-gruppe)

<!-- maks: 1200 -->
```
Jeg har bygget et lille familieoverblik til væggen derhjemme, og jeg tænkte, om andre kunne have glæde af det.

Det samler børnenes skema og ugebreve fra Aula, kalenderen (fodbold, håndbold osv.), vejret, elprisen, tømningsdage og fødselsdage på én skærm. På en fødselsdag får skærmen flag og konfetti. Det kan vises på en væg-skærm, en tablet eller telefonen.

Det kører på en lille server derhjemme, og alt bliver hos dig selv. Det er en tidlig udgave og uofficielt (ikke noget fra Aula), så regn med lidt tålmodighed. Du skal kunne uploade filer til GitHub og bruge et program, der hedder Dockhand, men der er en guide, der går det igennem trin for trin.

Koden og guiden: [link]
```

## 4. Opslag (engelsk)

### Reddit (r/selfhosted)

<!-- maks: 2200 -->
```
Title: Familieoverblik: a self-hosted family wall dashboard for Danish parents (Aula, calendars, weather, electricity prices)

I built a self-hosted dashboard for the family wall screen. It pulls the kids' school schedule and newsletters from Aula (the Danish school platform), plus calendars, weather, electricity prices (DK), waste-collection days, birthdays (with flags and confetti on the day) and a few small things like a screensaver, guest wi-fi QR code and a random picker.

How it runs: four Docker containers (web, cron, aula, car) built by GitHub Actions and pulled by Dockhand. No SSH needed: first-run setup is a guide in the browser, and the web container prints a one-time setup code. Everything is stored in one volume on your own server. PIN login, optional TOTP two-step verification, and an optional open view for a wall display.

Things I want to be upfront about:
- It is unofficial and not affiliated with Aula. The Aula part uses an unofficial Python library and was tested against a simulation, not Aula itself. It is the most fragile part.
- Early release. About 400 Python tests and 1,000+ JS tests pass, but PHP/Apache/Docker were not run in my development environment, so please expect rough edges.
- It was built together with Claude (Anthropic).
- The UI and docs are Danish (English and German UI text exist), so it is mostly useful if you have Aula.

Licence: MIT. Repo: [link]. Feedback and bug reports are very welcome.
```

### Kort (X eller Bluesky, højst 280 tegn)

<!-- maks: 280 -->
```
Familieoverblik: selvhostet væg-skærm til familien. Skema og breve fra Aula, kalender, vejr, elpris, tømning og fødselsdage på én side. Docker + Dockhand, ingen SSH. Open source (MIT), uofficielt, tidlig udgave. [link] #selfhosted #Aula
```

<!-- maks: 280 -->
```
Familieoverblik: a self-hosted family wall display for Danish parents. Aula schedule and letters, calendars, weather, electricity prices, bin days and birthdays on one screen. Docker, no SSH. Open source (MIT), unofficial, early release. [link] #selfhosted
```

### Mastodon (højst 500 tegn)

<!-- maks: 500 -->
```
Jeg har lavet Familieoverblik, en selvhostet væg-skærm til familien: skema og ugebreve fra Aula, kalendere, vejr, elpris, tømning og fødselsdage (med flag og konfetti) på én side. Kører i Docker og styres med Dockhand, uden SSH. Alt gemmes hos dig selv. Open source (MIT), tidlig udgave og uofficielt, bygget sammen med Claude, og jeg skriver ærligt i README, hvad der ikke er afprøvet endnu. [link] #selfhosted #docker #Aula
```

## 5. Svar på spørgsmål, du får

**Er det lovligt at bruge med Aula?** Programmet bruger et uofficielt bibliotek og dit eget MitID-login og henter kun det, du selv har adgang til. Aula har ikke en åben API til private. Læs Aulas vilkår, og brug det på eget ansvar. Jeg kan ikke give juridisk rådgivning.

**Er det sikkert?** Det er lavet til dit eget lokale net: siden kører over http, og du bør ikke sætte den direkte på internettet. Der er PIN og valgfri totrinsbekræftelse. Nøgler og login ligger kun på din egen server. Se afsnittet «Privatliv og sikkerhed» i README.

**Kræver det, at jeg er teknisk?** Du skal kunne uploade filer til GitHub, oprette en stak i Dockhand og følge en guide. Regn med en til to timer første gang.

**Virker det uden Docker?** Nej, det er bygget til Docker.

**Virker det uden Aula?** Ja, men så mangler skema og breve. Kalendere, vejr, elpris, tømning m.m. virker uden. (Elprisen er til de danske prisområder.)

**Hvad med børnenes data?** Alt bliver på din egen server. Eksterne tjenester får kun det, de har brug for (fx en bys koordinater til vejret). Se listen i README.

**Hvorfor er det lavet med Claude?** Det er en ærlig oplysning, og alt er afprøvet med automatiske prøver. Det, der ikke er afprøvet mod de rigtige tjenester, står i README under «Status».

**Kan jeg bidrage?** Ja, opret et issue eller en pull request. `CLAUDE.md` forklarer, hvordan man kommer i gang (også for en AI-assistent).

**Hvilken licens?** MIT: du må bruge, ændre og dele det frit. Se `LICENSE` og `THIRD_PARTY.md`.

**Hvad koster det?** Ingenting ud over serveren. En del af tjenesterne er gratis uden nøgle.

## 6. Hvis du vil lave en kort video eller et GIF (30 til 60 sekunder)

1. Forsiden i fuld skærm (vis først en dag uden fødselsdag).
2. *Tilpas layout*: gør et kort halvt, skjul et andet.
3. Skift tema nederst (lys, mørk).
4. Pauseskærmen kommer frem.
5. Opsætning: vis træet til venstre.
6. Slut med repo-adressen.

Optag med en testprofil eller sløret data, så ingen børns navne eller breve kan ses.
