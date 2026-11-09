# Sikkerhed

Familieoverblik er lavet til at køre på **dit eget lokale net** (en mini-pc hjemme), ikke direkte på internettet. Siden kører over http. Sæt den ikke ud på nettet med en port-forward; vil du nå den hjemmefra, så brug en VPN.

## Hvad der beskytter dine data

- Nøgler, PIN og Aula-login ligger kun på din egen server (`private/`, aldrig i GitHub eller i billederne).
- PIN-kode, valgfri totrinsbekræftelse (autentificeringsapp) og gendannelseskoder.
- «Åben visning» er slået fra som standard. Slår du den til, kan alle på netværket se forsiden uden PIN, og de kan ændre det, forsiden selv ændrer (afkrydsninger, opslagstavlen).

## Fandt du en sikkerhedsfejl?

Skriv **ikke** om den i et offentligt *issue*. Brug i stedet *Report a vulnerability* under fanen **Security** i dette repo (privat melding til ejeren). Beskriv, hvad du fandt, hvordan det kan gentages, og hvilken version du kørte (stå i `VERSION` eller nederst på forsiden).

Du får ikke en garanti for hurtigt svar: det er et lille projekt, der passes i fritiden.

## Del aldrig

I et issue, en fejlmelding eller et skærmbillede: nøgler, PIN-koder, `instans.json`, sikkerhedskopier, logfiler fra Aula-login og børns navne eller breve. Gør dem anonyme først.

## Kendte begrænsninger

- Aula-login bruger et uofficielt bibliotek og dit eget MitID-login. Brug det på eget ansvar, og læs Aulas vilkår.
- Siden har ingen https. Alle på netværket kan se trafikken, og en delt eller åben Wi-Fi er ikke egnet.
- Version 3.x er en tidlig udgave. Se README under «Status».
