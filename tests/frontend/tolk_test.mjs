import * as P from "../../public_html/pdfaffald.js";
import * as AFF from "../../public_html/affald.js";
const T=[]; const t=(n,ok,x="")=>{T.push(ok);console.log(ok?"ok  ":"FEJL",n,ok?"":x)};
const dat = (tk, navn) => (tk.fraktioner.find(f => f.navn === navn) || { datoer: [] }).datoer;
const lige = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// ── findFraktioner ──
const F = l => P.findFraktioner(l).map(f => f.navn);
t("slags affald kendes, også med små/store bogstaver og i rækkefølge", lige(F("RESTAFFALD og papir, Plast"), ["Restaffald", "Papir", "Plast"]));
t("«Papir og pap» tæller som ÉN (ikke også Papir og Pap), «Glas og metal» også, og «Mad- og drikkekartoner» er ikke Madaffald", lige(F("Papir og pap"), ["Papir og pap"]) && lige(F("Glas og metal"), ["Glas og metal"]) && lige(F("Mad- og drikkekartoner"), ["Mad- og drikkekartoner"]) && lige(F("Plast og mad- og drikkekartoner"), ["Plast og mad- og drikkekartoner"]));
t("madaffald, farligt affald, haveaffald, storskrald, tekstil, batterier og restaffald (også «småt brændbart») findes", lige(F("Madaffald Farligt affald Haveaffald Storskrald Tekstiler Batterier"), ["Madaffald", "Farligt affald", "Haveaffald", "Storskrald", "Tekstiler", "Batterier"]) && lige(F("Småt brændbart"), ["Restaffald"]));
t("ord, der ligner men ikke er slags affald, giver intet (papirløs, glasur, kontor)", F("papirløs glasur kontor tekstbehandling").length === 0, F("papirløs glasur kontor"));
// ── findDatoer ──
const D = (l, å = 2026) => P.findDatoer(l, å).map(d => d.iso);
t("datoformaterne: 24.12.2026, 24/12/26, 24-12-2026, 24/12, 24-12, 24. december, 24 dec 2026, 24. dec.", lige(D("24.12.2026 24/12/26 24-12-2026 24/12 24-12 24. december 24 dec 2027 24. dec."), ["2026-12-24", "2026-12-24", "2026-12-24", "2026-12-24", "2026-12-24", "2026-12-24", "2027-12-24", "2026-12-24"]), D("24.12.2026 24/12/26 24-12-2026 24/12 24-12 24. december 24 dec 2027 24. dec."));
t("urealistiske datoer (31/2, 0/5, 32/1, 13/13) og klokkeslæt (kl. 08.30, 7:45) er ikke datoer", D("31/2 0/5 32/1 13/13 kl. 08.30 7:45 ").length === 0, D("31/2 0/5 32/1 13/13 kl. 08.30"));
t("flere datoer i én linje (6/1, 20/1 og 3/2) findes alle, og et tal uden måned (uge 12, Eksempelvej 12) er ingen dato", lige(D("6/1, 20/1 og 3/2"), ["2026-01-06", "2026-01-20", "2026-02-03"]) && D("uge 12 Eksempelvej 12 tlf. 12345678").length === 0);
t("en fuld dato bliver ikke også fundet som dag/måned (24.12.2026 giver én)", D("24.12.2026").length === 1);
// ── layouts ──
let tk = P.tolkKalender(["Tømmekalender 2026", "Restaffald", "6/1 20/1 3/2 17/2", "Papir", "13/1 10/2", "10/3"]);
t("A: en overskrift pr. slags affald og datoer under (flere pr. linje og flere linjer)", lige(dat(tk, "Restaffald"), ["2026-01-06", "2026-01-20", "2026-02-03", "2026-02-17"]) && lige(dat(tk, "Papir"), ["2026-01-13", "2026-02-10", "2026-03-10"]) && tk.layout === "overskrift først", tk);
tk = P.tolkKalender(["2026", "Restaffald: 6. jan, 20. jan, 3. feb", "Papir: 13. jan, 10. feb"]);
t("B: slags affald og datoer på samme linje («Restaffald: 6. jan, 20. jan»)", lige(dat(tk, "Restaffald"), ["2026-01-06", "2026-01-20", "2026-02-03"]) && lige(dat(tk, "Papir"), ["2026-01-13", "2026-02-10"]), tk);
tk = P.tolkKalender(["Tirsdag 6. januar 2026 Restaffald, Papir", "Tirsdag 13. januar Madaffald", "Tirsdag 20. januar Restaffald"]);
t("C: dato først på linjen, så slags affald (flere pr. linje)", lige(dat(tk, "Restaffald"), ["2026-01-06", "2026-01-20"]) && lige(dat(tk, "Papir"), ["2026-01-06"]) && lige(dat(tk, "Madaffald"), ["2026-01-13"]), tk);
tk = P.tolkKalender(["Kalender 2026", "6. januar", "Restaffald", "Papir", "13. januar", "Madaffald", "20. januar", "Restaffald"]);
t("D: en dato på en linje og slags affald på linjerne under (dato først)", lige(dat(tk, "Restaffald"), ["2026-01-06", "2026-01-20"]) && lige(dat(tk, "Papir"), ["2026-01-06"]) && lige(dat(tk, "Madaffald"), ["2026-01-13"]) && tk.layout === "dato først", tk);
tk = P.tolkKalender(["Tømmekalender 2026", "Måned\tRestaffald\tPapir\tMadaffald", "Januar\t6, 20\t13\t7, 14, 21, 28", "Februar\t3, 17\t10\t4, 11"]);
t("E: månedsrækker med en kolonne pr. slags affald (adskilt af tabulator)", lige(dat(tk, "Restaffald"), ["2026-01-06", "2026-01-20", "2026-02-03", "2026-02-17"]) && lige(dat(tk, "Papir"), ["2026-01-13", "2026-02-10"]) && lige(dat(tk, "Madaffald"), ["2026-01-07", "2026-01-14", "2026-01-21", "2026-01-28", "2026-02-04", "2026-02-11"]) && tk.layout === "kolonner", tk);
tk = P.tolkKalender(["Tømmekalender 2026", "Restaffald", "Januar: 6, 20", "Februar: 3, 17", "Papir", "Januar 13", "Februar 10"]);
t("F: månedslister under en overskrift («Januar: 6, 20» og «Februar 10»)", lige(dat(tk, "Restaffald"), ["2026-01-06", "2026-01-20", "2026-02-03", "2026-02-17"]) && lige(dat(tk, "Papir"), ["2026-01-13", "2026-02-10"]), tk);
tk = P.tolkKalender(["Restaffald", "Januar", "6, 20", "Februar", "3, 17"]);
t("G: en måned på en linje og dagene på næste («Januar», så «6, 20»)", lige(dat(tk, "Restaffald"), ["2026-01-06", "2026-01-20", "2026-02-03", "2026-02-17"]), tk);
tk = P.tolkKalender(["Januar", "Tirs 6 Restaffald", "Tirs 13 Papir", "Februar", "Tirs 3 Restaffald"]);
t("H: ugedag og dag uden måned, med månedsoverskrifter imellem («Tirs 6 Restaffald»)", lige(dat(tk, "Restaffald"), ["2026-01-06", "2026-02-03"]) && lige(dat(tk, "Papir"), ["2026-01-13"]), tk);
// støj
tk = P.tolkKalender(["Tømmekalender 2026", "Eksempelvej 12, 8000 Aarhus C", "Tlf. 12 34 56 78 – åbent man-fre kl. 08.00-16.00", "Side 1 af 2", "Restaffald", "6/1 20/1", "Spørgsmål? Skriv til info@example.dk", "Papir", "13/1"]);
t("støj (adresse, telefon, åbningstider, sidetal, e-mail) giver ingen falske datoer", lige(dat(tk, "Restaffald"), ["2026-01-06", "2026-01-20"]) && lige(dat(tk, "Papir"), ["2026-01-13"]) && tk.fraktioner.length === 2, tk);
t("året tages fra teksten (det hyppigste 20xx), også et andet år end i år, og datoer langt fra det året udelades", P.tolkKalender(["Kalender 2031", "Restaffald", "6/1"]).aar === 2031 && dat(P.tolkKalender(["Restaffald 2026-01-06 6/1/2026 6/1/2019 6/1/2040"]), "Restaffald").length === 1);
t("året kan gives udefra, og ellers bruges i år", P.tolkKalender(["Restaffald", "6/1"], { aar: 2030 }).aar === 2030 && P.tolkKalender(["Restaffald", "6/1"]).aar === new Date().getFullYear());
// advarsler
t("ingen datoer: en advarsel, og ingen slags affald uden datoer; datoer uden slags affald: en advarsel", /ingen datoer/.test(P.tolkKalender(["Hej", "intet her"]).advarsler[0]) && /hvilken slags affald/.test(P.tolkKalender(["6/1 20/1 3/2"]).advarsler[0]));
t("få datoer for en slags affald giver en advarsel («Kontrollér dem»)", /Kun få datoer for Plast/.test(P.tolkKalender(["Plast: 6/1", "Restaffald: 6/1, 20/1, 3/2, 17/2"]).advarsler.join(" ")));
t("skrald giver et tomt forslag og aldrig en fejl", [null, undefined, "", [], [null, 5, {}], "\u0000\u0001"].every(x => { try { const r = P.tolkKalender(x); return Array.isArray(r.fraktioner); } catch { return false; } }));
t("teksten kan gives som én streng (indsat fra en PDF) med linjeskift af alle slags", lige(dat(P.tolkKalender("Restaffald\r\n6/1\r20/1\n"), "Restaffald"), ["2026-01-06", "2026-01-20"].map(d => d.replace("2026", String(new Date().getFullYear())))) || lige(dat(P.tolkKalender("Kalender 2026\r\nRestaffald\r\n6/1\r\n20/1\n"), "Restaffald"), ["2026-01-06", "2026-01-20"]));
// rækkefølge
t("slags affald står i samme rækkefølge som i listen over kendte (Restaffald før Papir før Glas …), uanset hvor de står i teksten", lige(P.tolkKalender(["Glas: 1/1, 2/1, 3/1", "Papir: 1/1, 2/1, 3/1", "Restaffald: 1/1, 2/1, 3/1"]).fraktioner.map(f => f.navn), ["Restaffald", "Papir", "Glas"]));
process.exit(T.every(Boolean) ? 0 : 1);
