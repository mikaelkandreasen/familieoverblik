import fs from "fs";
import * as REAL from "../../public_html/affald.js";
const ROD = new URL("../../", import.meta.url).pathname;
const T=[]; const t=(n,ok,x="")=>{T.push(ok);console.log(ok?"ok  ":"FEJL",n,ok?"":x)};
const tick = () => new Promise(r => setImmediate(r));
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const AFF = { ...REAL, dagIDag: () => "2026-11-11" };                         // fast «i dag» (en onsdag)
const medAFF = kode => kode.replace('import("./affald.js")', "Promise.resolve(AFFMOD)");
// ═════════ Opsætningen (index.html) ═════════
const kodeIdx = medAFF(fs.readFileSync("/tmp/aff_idx_block.js", "utf8"));
function bygIdx(data){
  const els = {}; const el = id => (els[id] ??= { id, value: "", innerHTML: "", textContent: "", disabled: false, _h: {}, addEventListener(t, f){ (this._h[t] ??= []).push(f); } });
  const gemt = [];
  const save = async (path, payload) => { gemt.push({ path, payload }); };
  const api = new Function("$", "esc", "save", "AFFMOD", kodeIdx + "; return { affDato, affDatoer, affFraStat, affTilStat, affForhaand, affTegn, affSynk, get stat(){ return affStat; }, set stat(v){ affStat = v; }, get smudsig(){ return affSmudsig; }, set affald(v){ affald = v; }, get AFF(){ return AFF; } };")(el, esc, save, AFF);
  return { api, els, el, gemt };
}
const U = bygIdx(); await tick(); await tick();
const A = U.api;
t("affDato: ÅÅÅÅ-MM-DD, dd.mm.åååå, d/m/åååå og d-m-åååå giver ISO; ugyldige giver null", A.affDato("2026-12-24") === "2026-12-24" && A.affDato("24.12.2026") === "2026-12-24" && A.affDato("4/1/2027") === "2027-01-04" && A.affDato(" 04-01-2027 ") === "2027-01-04" && ["30.02.2026", "24.12", "i går", "", null, "2026-13-01", "24.12.26"].every(x => A.affDato(x) === null));
const d = A.affDatoer("24.12.2026, 2026-12-31;  skrald\n05.01.2027,,");
t("affDatoer: flere datoer adskilt af komma, semikolon og linjeskift; ugyldige samles for sig", d.ok.join() === "2026-12-24,2026-12-31,2027-01-05" && d.fejl.join() === "skrald", JSON.stringify(d));
t("affDatoer: tom og null giver tomme lister", A.affDatoer("").ok.length === 0 && A.affDatoer(null).fejl.length === 0);
const stat = (frak, adrNavn = "Hjemme") => ({ adresser: [{ id: "a1", navn: adrNavn, fraktioner: frak }] });
const f = (o = {}) => ({ navn: "Restaffald", farve: "#5b6770", start: "2026-11-12", hver: 2, springes: "", ekstra: "", ...o });
let r = A.affFraStat(stat([f({ springes: "24.12.2026", ekstra: "2026-12-12" })]));
t("affFraStat: en gyldig fraktion giver en payload med ISO-datoer og tal", r.fejl.length === 0 && JSON.stringify(r.payload) === JSON.stringify({ adresser: [{ id: "a1", navn: "Hjemme", fraktioner: [{ navn: "Restaffald", farve: "#5b6770", start: "2026-11-12", hver: 2, springes: ["2026-12-24"], ekstra: ["2026-12-12"] }] }] }), JSON.stringify(r));
r = A.affFraStat(stat([f({ navn: "  " }), f({ start: "" }), f({ hver: 0 }), f({ hver: "x" }), f({ springes: "i morgen, 24.12.2026" }), f({ start: "30.02.2026" })]));
t("affFraStat: manglende navn, første dato, uger og ugyldige datoer giver forståelige fejl, og intet gemmes af de dårlige", r.fejl.length === 6 && /mangler et navn/.test(r.fejl[0]) && /vælg en første dato/.test(r.fejl[1]) && /antal uger/.test(r.fejl[2]) && /«i morgen» er ikke en dato/.test(r.fejl.join()), r.fejl.join(" | "));
t("affFraStat: en adresse uden fraktioner udelades (så alt kan ryddes), og tomt navn bliver «Hjemme»", A.affFraStat(stat([])).payload.adresser.length === 0 && A.affFraStat(stat([f()], "  ")).payload.adresser[0].navn === "Hjemme");
const rund = A.affTilStat(AFF.rens({ adresser: [{ id: "h", navn: "H", fraktioner: [{ navn: "Papir", start: "2026-11-13", hver: 4, springes: ["2026-12-24"], ekstra: ["2026-12-30", "2026-12-12"] }] }] }));
t("affTilStat: datoerne bliver kommaseparerede tekster (sorterede), og tom data giver én tom adresse «Hjemme»", rund.adresser[0].fraktioner[0].springes === "2026-12-24" && rund.adresser[0].fraktioner[0].ekstra === "2026-12-12, 2026-12-30" && A.affTilStat(AFF.rens(null)).adresser.length === 1 && A.affTilStat(AFF.rens(null)).adresser[0].navn === "Hjemme" && A.affTilStat(AFF.rens(null)).adresser[0].fraktioner.length === 0);
t("affForhaand: viser de næste datoer med ugedag, og beder om dato og uger, hvis de mangler", /^Næste: tor\. 12\. nov\., tor\. 26\. nov\./.test(A.affForhaand(f())) && /Vælg en første dato/.test(A.affForhaand(f({ start: "" }))) && /Vælg en første dato/.test(A.affForhaand(f({ hver: 99 }))) && /Næste: .*24\. dec\./.test(A.affForhaand(f({ ekstra: "2026-11-20" }))) === false);
// siden
A.stat = stat([f(), f({ navn: 'Papir "og" <pap>', start: "2026-11-13", hver: 4 })], 'Mormors <hus>');
A.affTegn();
const H = U.els.affEditor.innerHTML;
t("editoren viser adresser og fraktioner med navn, farve, første dato, uger, udgår og ekstra, og alt skrevet escapes", /value="Mormors &lt;hus&gt;"/.test(H) && /value="Papir &quot;og&quot; &lt;pap&gt;"/.test(H) && (H.match(/data-felt="start"/g) || []).length === 2 && (H.match(/type="color"/g) || []).length === 2 && /data-felt="springes"/.test(H) && /data-felt="ekstra"/.test(H) && !/<pap>/.test(H) && /Næste: tor\./.test(H));
t("«Tilføj adresse» er slået til, og slås fra ved 4 adresser", U.els.affNyAdresse.disabled === false && (A.stat = { adresser: Array.from({ length: 4 }, (_, i) => ({ id: "a" + i, navn: "A" + i, fraktioner: [] })), }, A.affTegn(), U.els.affNyAdresse.disabled === true));
A.stat = stat([f()]); A.affTegn();
const felt = (navn, v) => ({ dataset: { felt: navn }, value: v, closest: s => s === "[data-f]" ? { dataset: { f: "0" }, querySelector: q => q === "[data-forh]" ? U.forh : { value: "" } } : { dataset: { a: "0" } } });
U.forh = { textContent: "" };
U.els.affEditor._h.input[0]({ target: felt("start", "2026-11-19") });
t("at skrive i et felt opdaterer tilstanden og forhåndsvisningen med det samme, og markerer rettelsen som ikke gemt", A.stat.adresser[0].fraktioner[0].start === "2026-11-19" && /Næste: tor\. 19\. nov\./.test(U.forh.textContent) && A.smudsig === true, U.forh.textContent);
U.els.affEditor._h.input[0]({ target: { dataset: { felt: "adresse" }, value: "Mormor", closest: s => ({ dataset: { a: "0" } }) } });
t("adressens navn kan rettes", A.stat.adresser[0].navn === "Mormor");
const farveFelt = { value: "" };
U.els.affEditor._h.change[0]({ target: { dataset: { felt: "navn" }, value: "papir og pap", closest: s => s === "[data-f]" ? { dataset: { f: "0" }, querySelector: () => farveFelt } : { dataset: { a: "0" } } } });
t("vælges en kendt fraktion, får den sin standardfarve (store/små bogstaver ligegyldige), og farvefeltet opdateres", A.stat.adresser[0].fraktioner[0].farve === "#2F6DB5" && farveFelt.value === "#2F6DB5");
const klik = (hvad, a = "0", fr = "0") => U.els.affEditor._h.click[0]({ target: { closest: s => s === "[data-aff]" ? { dataset: { aff: hvad }, closest: q => q === "[data-a]" ? { dataset: { a } } : { dataset: { f: fr } } } : null } });
klik("ny-frak"); t("«Tilføj fraktion» lægger en ny til (med standardfarve)", A.stat.adresser[0].fraktioner.length === 2 && A.stat.adresser[0].fraktioner[1].navn === "Papir");
klik("fjern-frak", "0", "0"); t("× fjerner fraktionen", A.stat.adresser[0].fraktioner.length === 1 && A.stat.adresser[0].fraktioner[0].navn === "Papir");
for (let i = 0; i < 15; i++) klik("ny-frak"); t("højst 12 fraktioner pr. adresse", A.stat.adresser[0].fraktioner.length === 12);
A.stat = stat([f()]); U.els.affNyAdresse._h.click[0]({}); t("«Tilføj adresse» lægger en ny til med én fraktion", A.stat.adresser.length === 2 && A.stat.adresser[1].fraktioner.length === 1);
klik("fjern-adr", "1"); t("«Fjern adresse» fjerner den", A.stat.adresser.length === 1);
// gem
A.stat = stat([f({ start: "" })]); await U.els.affGem._h.click[0]({});
t("Gem med en fejl viser fejlen og gemmer ikke", /vælg en første dato/.test(U.els.affFejl.textContent) && U.gemt.length === 0);
A.stat = stat([f({ springes: "24.12.2026" })]); await U.els.affGem._h.click[0]({});
t("Gem uden fejl sender til settings/affald med renset payload og melder, at kortet nu vises", U.gemt.length === 1 && U.gemt[0].path === "settings/affald" && U.gemt[0].payload.adresser[0].fraktioner[0].springes.join() === "2026-12-24" && U.els.affFejl.textContent === "" && /Gemt\. Kortet «Tømning» vises/.test(U.els.affInfo.textContent), JSON.stringify(U.gemt));
A.stat = stat([]); await U.els.affGem._h.click[0]({});
t("Gem uden nogen fraktion gemmer en tom plan (kortet skjules)", U.gemt.at(-1).payload.adresser.length === 0 && /kortet er skjult/.test(U.els.affInfo.textContent));
// synk
A.affald = { adresser: [{ id: "h", navn: "Fra serveren", fraktioner: [{ navn: "Glas", start: "2026-11-13", hver: 8 }] }] };
A.stat = stat([f()]); A.stat.adresser[0].navn = "Mine rettelser";
const Ux = bygIdx(); await tick(); await tick(); Ux.api.stat = stat([f()]); Ux.api.stat.adresser[0].navn = "Mine rettelser"; Ux.els.affEditor._h.input[0]({ target: felt("start", "2026-11-26") });
Ux.api.affald = { adresser: [{ id: "h", navn: "Fra serveren", fraktioner: [{ navn: "Glas", start: "2026-11-13", hver: 8 }] }] }; Ux.api.affSynk(false);
t("en polling overskriver IKKE rettelser, der ikke er gemt", Ux.api.stat.adresser[0].navn === "Mine rettelser");
Ux.api.affSynk(true);
t("men en tvungen hentning (efter Gem) gør", Ux.api.stat.adresser[0].navn === "Fra serveren" && Ux.api.stat.adresser[0].fraktioner[0].navn === "Glas" && Ux.api.smudsig === false);
// ═════════ Forsiden (overblik.html) ═════════
const kodeOv = medAFF(fs.readFileSync("/tmp/aff_ov_block.js", "utf8"));
function bygOv(data){
  const els = { affKort: { hidden: true }, affKrop: { innerHTML: "" } }; const $ = id => els[id];
  const dage = ["2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14"].map(iso => ({ iso, innerHTML: "x", closest: () => ({ dataset: { dag: iso } }) }));
  const document = { querySelectorAll: sel => (sel === "[data-aff-dag]" ? dage : []) };
  const api = new Function("$", "esc", "AFFMOD", "document", kodeOv + "; return { affaldTegn, affaldPaaminde, set affald(v){ affald = v; } };")($, esc, AFF, document);
  return { els, api, dage };
}
const O = bygOv(); await tick(); await tick();
O.api.affald = { adresser: [{ id: "h", navn: "Hjemme", fraktioner: [{ navn: "Restaffald", farve: "#5b6770", start: "2026-11-12", hver: 2 }, { navn: "Papir", farve: "#2f6db5", start: "2026-11-20", hver: 4 }, { navn: "Glas <x>", farve: "#2e7d4f", start: "2026-11-11", hver: 8 }] }] };
O.api.affaldTegn();
const K = O.els.affKrop.innerHTML;
t("kortet vises, når der er en tidsplan, med fraktioner, nærmeste først (Glas i dag, Restaffald i morgen, Papir om 9 dage)", O.els.affKort.hidden === false && K.indexOf("Glas") < K.indexOf("Restaffald") && K.indexOf("Restaffald") < K.indexOf("Papir") && /i dag/.test(K) && /i morgen/.test(K) && /om 9 dage/.test(K), K);
t("hver række har fraktionens farve, ugedag og dato, og de, der er i dag/i morgen, er fremhævet; én adresse viser ingen adresseoverskrift", /--f:#2e7d4f/.test(K) && /torsdag 12\. nov\./.test(K) && (K.match(/aff-snart/g) || []).length === 2 && !/sub-label/.test(K));
t("fraktionens navn escapes", /Glas &lt;x&gt;/.test(K) && !/<x>/.test(K));
O.api.affald = { adresser: [{ id: "h", navn: "Hjemme", fraktioner: [{ navn: "Restaffald", start: "2026-11-12", hver: 2 }] }, { id: "m", navn: "Mormor <1>", fraktioner: [{ navn: "Papir", start: "2026-11-13", hver: 1 }] }] }; O.api.affaldTegn();
t("flere adresser: hver får en overskrift (escaped)", (O.els.affKrop.innerHTML.match(/sub-label/g) || []).length === 2 && /Mormor &lt;1&gt;/.test(O.els.affKrop.innerHTML));
const P = O.api.affaldPaaminde();
t("påmindelser: dem, der tømmes i dag eller i morgen, ellers ingen", P.length === 1 && P[0].fraktion === "Restaffald" && P[0].dage === 1 && P[0].adresse === "Hjemme", JSON.stringify(P));
O.api.affald = { adresser: [] }; O.api.affaldTegn();
t("uden tidsplan (eller efter at den er ryddet) er kortet skjult og tomt", O.els.affKort.hidden === true && O.els.affKrop.innerHTML === "");
for (const skrald of [null, undefined, "x", 5, { adresser: "x" }, { adresser: [null] }]){ O.api.affald = skrald; O.api.affaldTegn(); }
t("skrald fra serveren giver et skjult kort og ingen fejl", O.els.affKort.hidden === true && O.api.affaldPaaminde().length === 0);
const Oy = new Function("$", "esc", "AFFMOD", "document", kodeOv.replace('import("./affald.js")', 'Promise.reject(new Error("mangler"))') + "; return { affaldTegn, affaldPaaminde };")(id => ({ affKort: { hidden: false }, affKrop: { innerHTML: "x" } })[id], esc, AFF, { querySelectorAll: () => [] }); await tick(); await tick();
t("mangler affald.js (offline eller fejl), er kortet skjult og siden virker (ingen påmindelser, ingen fejl)", (() => { Oy.affaldTegn(); return Oy.affaldPaaminde().length === 0; })());
// ═════════ Ikoner ═════════
const OI = bygOv(); await tick(); await tick();
OI.api.affald = { adresser: [{ id: "h", navn: "Hjemme", fraktioner: [{ navn: "Restaffald", farve: "#5b6770", start: "2026-11-12", hver: 2 }, { navn: "Papir", farve: "#2f6db5", start: "2026-11-12", hver: 4 }, { navn: "Glas", farve: "#2e7d4f", start: "2026-11-11", hver: 8 }, { navn: "Madaffald <b>", farve: "#7a4b2a", start: "2026-11-14", hver: 1, ekstra: ["2026-11-13"] }] }] };
OI.api.affaldTegn();
const KI = OI.els.affKrop.innerHTML;
t("kortets rækker har et ikon (en rund farveflade med en tegning) i stedet for en farveprik, med fraktionens farve og navn som titel", (KI.match(/class="aff-ikon"/g) || []).length === 4 && !/aff-prik/.test(KI) && /aria-label="Glas"/.test(KI) && /--f:#2e7d4f/.test(KI) && /<svg viewBox="0 0 24 24"/.test(KI));
const dagIkoner = Object.fromEntries(OI.dage.map(d => [d.iso, d.innerHTML]));
t("ikonerne på dagene: onsdag 11. nov (Glas), torsdag 12. (Restaffald og Papir), fredag 13. (ekstra Madaffald), lørdag 14. (Madaffald)", (dagIkoner["2026-11-11"].match(/aff-ikon/g) || []).length === 1 && /aria-label="Glas"/.test(dagIkoner["2026-11-11"]) && (dagIkoner["2026-11-12"].match(/aff-ikon/g) || []).length === 2 && /Restaffald/.test(dagIkoner["2026-11-12"]) && /aria-label="Papir"/.test(dagIkoner["2026-11-12"]) && /Madaffald &lt;b&gt;/.test(dagIkoner["2026-11-13"]) && (dagIkoner["2026-11-14"].match(/aff-ikon/g) || []).length === 1, JSON.stringify(dagIkoner).slice(0, 300));
t("en dag uden tømning får ingen ikoner (feltet tømmes, så gamle ikoner ikke bliver stående)", (() => { OI.api.affald = { adresser: [{ id: "h", navn: "H", fraktioner: [{ navn: "Papir", start: "2026-11-30", hver: 4 }] }] }; OI.api.affaldTegn(); return OI.dage.every(d => d.innerHTML === ""); })());
t("det samme slags affald to gange samme dag (to adresser) giver ét ikon", (() => { OI.api.affald = { adresser: [{ id: "a", navn: "A", fraktioner: [{ navn: "Papir", start: "2026-11-12", hver: 4 }] }, { id: "b", navn: "B", fraktioner: [{ navn: "Papir", start: "2026-11-12", hver: 2 }] }] }; OI.api.affaldTegn(); return (OI.dage[1].innerHTML.match(/aff-ikon/g) || []).length === 1; })());
t("skrald i dataene giver ingen ikoner og ingen fejl", (() => { OI.api.affald = { adresser: "x" }; OI.api.affaldTegn(); return OI.dage.every(d => d.innerHTML === ""); })());
const ov2 = fs.readFileSync(ROD + "public_html/overblik.html", "utf8");
t("dagene i «De næste dage» har en dato (data-dag) og en plads til ikoner (data-aff-dag), og påmindelserne i «Vigtigt snart» bruger ikonet i stedet for prikken", /<div class="d5\$\{i === 0 \? " now" : ""\}" data-dag="\$\{ymd\(d\)\}">/.test(ov2) && ov2.includes('<span class="aff-dag" data-aff-dag></span>') && ov2.includes('kilde: "Tømning", ikon: affIkon ? affIkon(r) : ""') && ov2.includes('affIkon: r => (AFF ? AFF.ikonHtml(r.fraktion, r.farve) : "")') && ov2.includes("${s.ikon || `<span class=\"bullet\""));
t("CSS til ikonerne (rund, hvid streg, mindre på dagene) findes", /\.aff-ikon\{[^}]*border-radius:50%[^}]*background:var\(--f\)/.test(ov2) && /\.aff-dag \.aff-ikon\{width:20px/.test(ov2));
// ═════════ Statisk ═════════
const idx = fs.readFileSync(ROD + "public_html/index.html", "utf8"), ov = fs.readFileSync(ROD + "public_html/overblik.html", "utf8"), api = fs.readFileSync(ROD + "public_html/api.php", "utf8"), sw = fs.readFileSync(ROD + "public_html/sw.js", "utf8");
t("settings/affald er med i opsætningens og forsidens henteliste og i API'ets skrive-tilladelser", /"settings\/affald"[,\]]/.test(idx) && /"settings\/affald"[,\]]/.test(ov) && api.includes("$path === 'settings/affald'"));
t("kortet findes på forsiden som et skjult kort med data-kort=\"affald\" i kolonnen, og siden i opsætningen findes", /<section class="card" id="affKort" hidden data-kort="affald">/.test(ov) && ov.indexOf('id="affKort"') > ov.indexOf('id="stak"') && ov.indexOf('id="affKort"') < ov.indexOf('id="vejrKort"') && idx.includes('<h2 class="f-over">Tømning</h2>'));
t("affald.js hentes som modul (dynamisk, så en manglende fil ikke vælter siden), og ligger i service workerens skal med ny cache-version", ov.includes('import("./affald.js")') && idx.includes('import("./affald.js")') && !/^import .*affald/m.test(ov) && sw.includes('"./affald.js"') && sw.match(/shell-v([2-9]|\d\d)/) !== null);
process.exit(T.every(Boolean) ? 0 : 1);
