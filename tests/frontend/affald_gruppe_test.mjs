import fs from "fs";
import * as A from "../../public_html/affald.js";
const T=[]; const t=(n,ok,x="")=>{T.push(ok);console.log(ok?"ok  ":"FEJL",n,ok?"":x)};
const fr = (navn, start, hver, extra = {}) => ({ navn, farve: "#112233", start, hver, ...extra });
const data = { adresser: [{ navn: "Hjemme", fraktioner: [
  fr("Mad- og restaffald", "2026-11-09", 2), fr("Glas og metal", "2026-11-13", 3), fr("Plast og mad- og drikkekartoner", "2026-11-13", 3),
  fr("Papir og pap", "2026-12-09", 6), fr("Tekstiler", "2026-12-09", 6)] }] };
const rk = A.oversigt(data, "2026-11-09")[0].raekker;
t("udgangspunktet: fem fraktioner giver fem rækker (før gruppering)", rk.length === 5);
const g = A.gruppeRaekker(rk);
t("samme dag samles: fem rækker bliver til tre linjer (mandag, fredag og onsdag)", g.length === 3 && g.map(x => x.fraktioner.length).join() === "1,2,2", g.map(x => [x.dato, x.fraktioner.length]));
t("hver linje har datoen, hvor mange dage der er til, ordet («i dag», «i fredag …»), ugedag og kort dato fra rækkerne", g[0].dato === "2026-11-09" && g[0].dage === 0 && g[0].relativ === "i dag" && g[1].dato === "2026-11-13" && g[1].dage === 4 && /fredag/i.test(g[1].ugedag) && typeof g[1].datoKort === "string" && g[1].datoKort.length > 0, g[1]);
t("fraktionerne i en linje er i rækkernes rækkefølge (alfabetisk inden for samme dag), og de bærer deres farve", g[1].fraktioner.map(x => x.fraktion).join("|") === "Glas og metal|Plast og mad- og drikkekartoner" && g[1].fraktioner.every(x => x.farve === "#112233"));
t("linjerne er sorteret efter dato (nærmeste først), som rækkerne var", g.map(x => x.dato).join() === "2026-11-09,2026-11-13,2026-12-09");
const ekstra = { adresser: [{ navn: "A", fraktioner: [fr("Restaffald", "2026-11-09", 2, { ekstra: ["2026-11-13"] }), fr("Glas", "2026-11-13", 3)] }] };
const g2 = A.gruppeRaekker(A.oversigt(ekstra, "2026-11-10")[0].raekker);
t("en ekstra tømning, der falder samme dag som en anden fraktion, samles med den", g2.length === 1 && g2[0].fraktioner.length === 2 && g2[0].dato === "2026-11-13", g2);
const to = { adresser: [{ navn: "A", fraktioner: [fr("Restaffald", "2026-11-09", 2)] }, { navn: "B", fraktioner: [fr("Restaffald", "2026-11-09", 2), fr("Glas", "2026-11-09", 3)] }] };
const ov2 = A.oversigt(to, "2026-11-09");
t("flere adresser grupperes hver for sig (den ene har én fraktion og den anden to)", ov2.length === 2 && A.gruppeRaekker(ov2[0].raekker).length === 1 && A.gruppeRaekker(ov2[1].raekker).length === 1 && A.gruppeRaekker(ov2[1].raekker)[0].fraktioner.length === 2);
t("tom liste, ikke en liste og poster uden dato giver en tom liste uden fejl", [[], null, undefined, "x", 5, {}, [null, undefined, {}, { naeste: 5 }, { fraktion: "x" }]].every(x => A.gruppeRaekker(x).length === 0));
t("kortet bliver mindre: antal linjer = antal forskellige datoer, aldrig flere end antal fraktioner", g.length <= rk.length && new Set(rk.map(r => r.naeste)).size === g.length);
const ov = fs.readFileSync(import.meta.dirname + "/../../public_html/overblik.html", "utf8");
t("kortet tegner grupperne: én linje pr. gruppe med alle ikoner, alle navne (adskilt af komma) og datoen, og linjen er fremhævet, hvis det er i dag eller i morgen", ov.includes("AFF.gruppeRaekker(a.raekker).map(g =>") && ov.includes('class="line aff-raekke aff-gruppe${g.dage <= 1 ? " aff-snart" : ""}"') && ov.includes('<span class="aff-ikoner">${g.fraktioner.map(x => AFF.ikonHtml(x.fraktion, x.farve)).join("")}</span>') && ov.includes('${g.fraktioner.map(x => esc(x.fraktion)).join(", ")}') && ov.includes("esc(g.relativ)") && ov.includes("esc(g.datoKort)"));
t("ikonerne i en linje ligger ved siden af hinanden og må ombrydes, men fylder højst 112 px, så navnet har plads", /\.aff-ikoner\{flex:0 0 auto;display:inline-flex;flex-wrap:wrap;gap:3px;max-width:112px\}/.test(ov));
process.exit(T.every(Boolean) ? 0 : 1);
