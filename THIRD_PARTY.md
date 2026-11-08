# Tredjepart: hvad løsningen bruger, og på hvilke vilkår

**Familieoverblik er udgivet under MIT-licensen** (se [LICENSE](LICENSE)). Der er **ingen tredjepartskode kopieret ind i dette repo**: koden, ikonerne og QR-generatoren (`qr.js`) er skrevet til projektet. Det, der hentes udefra, hentes, når Docker-billederne bygges.

## Biblioteker, der installeres i Docker-billederne

| Billede | Bibliotek | Licens | Bemærkning |
|---|---|---|---|
| aula | [`aula`](https://pypi.org/project/aula/) 1.16.0 | MIT | Uofficielt bibliotek til Aula. Dets egne afhængigheder installeres med og har hver deres licens. |
| bil | [`hyundai-kia-connect-api`](https://pypi.org/project/hyundai-kia-connect-api/) 4.49.0 | MIT | Afhænger bl.a. af `beautifulsoup4`, `requests`, `certifi`, `tzdata` og `geopy` (hver med sin egen licens). |
| alle | Basisbillederne (`php:apache`, `python`, `alpine` m.fl.) | Hver sin | Se billedernes sider på Docker Hub. De er ikke en del af dette repo. |

Når du bygger og udgiver billederne, indeholder de disse biblioteker. Alle de nævnte licenser tillader det (MIT kræver, at licensteksten følger med; pakkerne indeholder den selv). Indeholder en afhængighed en anden licens, gælder den for den afhængighed.

## Tjenester på nettet, der kontaktes (ingen kode herfra)

Open-Meteo (vejr), Energi Data Service (elpriser), GoComics (tegneserien), JokeAPI, og valgfrit Strava, Microsoft Graph (indkøbslisten), Hyundai og Anthropic (oversættelse). De har **egne vilkår**, som du selv skal overholde som bruger, fx rimelig brug, kildeangivelse og begrænsninger på videredistribution af indhold. Licensen for dette projekt giver ingen rettigheder til deres indhold eller varemærker.

## Varemærker

Aula, MitID, UNI-C, Hyundai, Strava og Microsoft er varemærker eller navne tilhørende deres ejere og bruges kun til at beskrive, hvad løsningen kan forbindes til. Projektet er ikke tilknyttet dem.
