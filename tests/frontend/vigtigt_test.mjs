import fs from "fs";
const T=[]; const t=(n,ok,x="")=>{T.push(ok);console.log(ok?"ok  ":"FEJL",n,ok?"":x)};
const V = new Function(fs.readFileSync("/tmp/vigtigt_block.js", "utf8") + "; return { vigtigtListe };")().vigtigtListe;
const midnight = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }, addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const idag = new Date(2026, 10, 9);                          // mandag 9. nov. 2026
const kald = (o = {}) => V({ today: idag, soonDays: 45, addDays, midnight, ...o });
// aula
let r = kald({ important: [{ date: "2026-11-09", text: "Skolefoto", children: ["Sofie", "Emil"] }] });
t("en Aula-dato, der står til i dag, har days 0 (og hører dermed under «I dag»), med børnene efter teksten og kilden «Aula · vigtige datoer»", r.length === 1 && r[0].days === 0 && r[0].text === "Skolefoto — Sofie, Emil" && r[0].kilde === "Aula · vigtige datoer", r);
r = kald({ important: [{ date: "2026-11-08", text: "I går" }, { date: "2026-11-10", text: "I morgen" }, { date: "2026-12-24", text: "Om 45 dage" }, { date: "2026-12-25", text: "For langt" }, { date: "2026-11-09", text: "Venter", waiting: true }, null, { date: "ikke en dato", text: "Skrald" }, { date: "2026-11-11", text: "Uden børn" }] });
t("datoer før i dag, efter 45 dage, dem der venter på svar, tomme poster og ugyldige datoer er ikke med; dem inden for tidsrummet er det, sorteret", r.map(x => x.text).join() === "I morgen,Uden børn,Om 45 dage" && r.map(x => x.days).join() === "1,2,45", r.map(x => [x.text, x.days]));
// tømning
r = kald({ affald: [{ dage: 0, fraktion: "Restaffald", farve: "#111", adresse: "Hjemme" }, { dage: 1, fraktion: "Papir", farve: "#00a", adresse: "Hjemme" }], affIkon: x => `<i>${x.fraktion}</i>` });
t("tømning i dag (days 0, «tømmes i dag») og i morgen (days 1, «sæt spanden ud i aften»), med ikon og adresse", r[0].days === 0 && r[0].text === "Restaffald tømmes i dag (Hjemme)" && r[0].ikon === "<i>Restaffald</i>" && r[1].days === 1 && r[1].text === "Papir tømmes i morgen — sæt spanden ud i aften (Hjemme)" && r[0].kilde === "Tømning");
t("uden ikonfunktion er ikonet tomt (ingen fejl)", kald({ affald: [{ dage: 0, fraktion: "Glas", adresse: "A" }] })[0].ikon === "");
// fødselsdage
const fd = [{ name: "Sofie", day: 9, month: 11, year: 2015 }, { name: "Peter", day: 20, month: 11, year: 0, familie: true }, { name: "Lise", day: 9, month: 11, year: 1985, familie: true }, { name: "For langt", day: 1, month: 3, year: 2000 }];
r = kald({ fd });
t("fødselsdage: dagens har days 0 og alder («fylder 11»), dem uden fødselsår har ingen alder, kilden er «Familie» eller «Egne fødselsdage», og fødselsdage uden for 45 dage er ikke med", r.length === 3 && r[0].days === 0 && r.filter(x => x.days === 0).map(x => x.text).sort().join("|") === "Lise har fødselsdag — fylder 41|Sofie har fødselsdag — fylder 11" && r[2].text === "Peter har fødselsdag" && r[2].days === 11 && r.find(x => x.text.startsWith("Sofie")).kilde === "Egne fødselsdage" && r.find(x => x.text.startsWith("Lise")).kilde === "Familie", r.map(x => [x.text, x.days, x.kilde]));
t("en fødselsdag, der falder over årsskiftet, findes også (21. dec. 2026 → 5. jan. 2027 ligger 15 dage fremme)", (x => x.length === 1 && x[0].days === 15)(V({ today: new Date(2026, 11, 21), soonDays: 45, addDays, midnight, fd: [{ name: "Anna", day: 5, month: 1, year: 1990 }] })));
// samlet
r = kald({ fd, affald: [{ dage: 0, fraktion: "Restaffald", adresse: "A" }], important: [{ date: "2026-11-09", text: "Skolefoto" }, { date: "2026-11-13", text: "Fredag" }] });
t("alt samlet og sorteret efter dage: de punkter, der står til i dag, er først (fødselsdage, tømning og Aula), og dem senere kommer bagefter", r.map(x => x.days).join() === [0, 0, 0, 0, 4, 11].join() && r.slice(0, 4).every(x => x.days === 0) && r.filter(x => x.days === 0).length === 4, r.map(x => [x.text, x.days]));
t("ingen data eller skrald (null, undefined, tomme lister, ikke-lister) giver en tom liste uden fejl", [{}, { fd: null, affald: null, important: null }, { fd: [], affald: [], important: [] }].every(x => kald(x).length === 0));
// siden
const ov = fs.readFileSync(import.meta.dirname + "/../../public_html/overblik.html", "utf8");
t("«I dag» har en sektion «Vigtigt» (skjult, til der er noget), og den ligger før «Husk»", /<section id="tVigtigSek" hidden>\s*<div class="sec-label">Vigtigt<\/div>\s*<div id="tVigtig"><\/div>/.test(ov) && ov.indexOf('id="tVigtigSek"') < ov.indexOf('id="tRemCount"') && ov.indexOf('id="tVigtigSek"') > ov.indexOf('id="tSchool"'));
t("siden beregner listen én gang, viser dagens (days === 0) under «I dag», og lader «Vigtigt snart» nøjes med de øvrige (days > 0)", ov.includes("const vigt = vigtigtListe({ fd: alleFd(birthdays), affald: affaldPaaminde(), important, today, soonDays: SOON_DAYS,") && ov.includes("const idagVigt = vigt.filter(x => x.days === 0);") && ov.includes('$("tVigtigSek").hidden = !idagVigt.length;') && ov.includes("const soon = vigt.filter(x => x.days > 0);"));
process.exit(T.every(Boolean) ? 0 : 1);
