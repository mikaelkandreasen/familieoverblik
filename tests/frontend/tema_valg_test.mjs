import fs from "fs";
import * as MOD from "../../public_html/tema-forvalg.js";
const ROD = new URL("../../", import.meta.url).pathname;
const T=[]; const t=(n,ok,x="")=>{T.push(ok);console.log(ok?"ok  ":"FEJL",n,ok?"":x)};
const tick = () => new Promise(r => setImmediate(r));
const kode0 = fs.readFileSync("/tmp/temaov3_block.js", "utf8").replace(/\nhentTema\(\); setInterval\(hentTema, 600000\);\n/, "\n");
async function bygg({ gemt = {}, moerkt = false, modul = true, server = { "--paper": "#abcdef" } } = {}){
  const props = {}, lager = { ...gemt }, kald = []; const els = {}; let dark = moerkt; const lyt = [];
  const el = id => (els[id] ??= { id, value: "", _h: {}, addEventListener(t, f){ (this._h[t] ??= []).push(f); } });
  el("temaValg");
  globalThis.localStorage = { getItem: k => (k in lager ? lager[k] : null), setItem: (k, v) => { lager[k] = v; }, removeItem: k => { delete lager[k]; } };
  globalThis.matchMedia = q => ({ get matches(){ return dark; }, addEventListener(t, f){ lyt.push(f); } });
  const document = { documentElement: { style: { setProperty: (k, v) => { props[k] = v; }, removeProperty: k => { delete props[k]; } } } };
  const fetch = async url => { kald.push(url); return { ok: true, json: async () => ({ vars: server }) }; };
  const kode = modul ? kode0.replace('import("./tema-forvalg.js")', "Promise.resolve(MOD)") : kode0.replace('import("./tema-forvalg.js")', 'Promise.reject(new Error("mangler"))');
  const api = new Function("$", "document", "fetch", "HEAD", "MOD", kode + "; return { hentTema, temaValgAnvend, get valg(){ return temaValg; } };")(el, document, fetch, {}, MOD);
  await tick(); await tick();
  return { api, props, lager, kald, els, skift: v => { els.temaValg.value = v; els.temaValg._h.change[0]({}); }, mork: v => { dark = v; lyt.forEach(f => f()); } };
}
let u = await bygg(); await u.api.hentTema();
t("uden valg på enheden bruges serverens farver (som før), og de gemmes", u.props["--paper"] === "#abcdef" && JSON.parse(u.lager["familieoverblik-tema"]).vars["--paper"] === "#abcdef" && u.kald.length === 1 && u.api.valg === "");
u.skift("moerk");
t("et valg af «mørk» sætter Mørk-forvalget (baggrund, kort og tekst), gemmer valget og gemmer farverne, så næste indlæsning ikke blinker", u.props["--paper"] === "#10161b" && u.props["--card"] === "#1a222a" && u.props["--ink"] === "#e8ecef" && u.lager["familieoverblik-tema-valg"] === "moerk" && JSON.parse(u.lager["familieoverblik-tema"]).vars["--paper"] === "#10161b" && u.api.valg === "moerk");
t("og de afledte farver til det mørke panel kommer med (--pk og --pp)", /^#[0-9a-f]{6}$/.test(u.props["--pp-1"]) && /^#[0-9a-f]{6}$/.test(u.props["--pk-1"]));
await u.api.hentTema();
t("mens et tema er valgt på enheden, henter siden ikke serverens farver (og overskriver dem ikke)", u.kald.length === 1 && u.props["--paper"] === "#10161b");
u.skift("varm"); t("«varm»", u.props["--paper"] === "#f7f1e6" && u.lager["familieoverblik-tema-valg"] === "varm");
u.skift("standard"); t("«lys» er Standard-forvalget", u.props["--paper"] === "#fbfaf6" && u.props["--card"] === "#ffffff");
u.skift("hoj"); t("«høj kontrast»", u.props["--paper"] === "#ffffff" && u.props["--ink"] === "#000000" && u.props["--panel"] === "#000000");
u.skift("");
await tick(); await tick();
t("«som opsat» fjerner enhedens valg og henter serverens farver igen med det samme", !("familieoverblik-tema-valg" in u.lager) && u.kald.length === 2 && u.props["--paper"] === "#abcdef" && u.api.valg === "");
// automatisk
let a = await bygg({ moerkt: false }); a.skift("auto");
t("automatisk: lys enhed giver Standard", a.props["--paper"] === "#fbfaf6" && a.lager["familieoverblik-tema-valg"] === "auto" && a.api.valg === "auto");
a.mork(true); t("…og skifter enheden til mørk tilstand, skifter temaet til Mørk af sig selv", a.props["--paper"] === "#10161b");
a.mork(false); t("…og tilbage igen", a.props["--paper"] === "#fbfaf6");
a.skift("varm"); a.mork(true); t("er et fast tema valgt, ignoreres enhedens lys/mørk-skift", a.props["--paper"] === "#f7f1e6");
// ved indlæsning
let g = await bygg({ gemt: { "familieoverblik-tema-valg": "moerk" } });
t("et gemt valg anvendes ved indlæsning, og select viser det", g.props["--paper"] === "#10161b" && g.els.temaValg.value === "moerk" && g.api.valg === "moerk");
await g.api.hentTema(); t("…og serverens farver hentes ikke (ingen blink fra lys til mørk)", g.kald.length === 0 && g.props["--paper"] === "#10161b");
let x = await bygg({ gemt: { "familieoverblik-tema-valg": "findes-ikke" } }); await x.api.hentTema();
t("et ukendt gemt valg ignoreres, og serverens farver bruges", x.api.valg === "" && x.props["--paper"] === "#abcdef");
let y = await bygg({ gemt: { "familieoverblik-tema-valg": "constructor" } });
t("«constructor» og andre objektnavne er ikke gyldige valg", y.api.valg === "");
let m = await bygg({ modul: false, gemt: { "familieoverblik-tema-valg": "moerk" } }); m.skift("varm");
const f0 = console.error; console.error = () => {};
t("mangler forvalgsfilen, går der intet i stykker: valget huskes, men der ændres ingen farver endnu", m.api.valg === "varm" && !("--paper" in m.props)); console.error = f0;
// forvalgene er ens med dem i opsætningen
const ix = fs.readFileSync(ROD + "public_html/index.html", "utf8");
const a1 = ix.indexOf("const TEMA_STD = {"), a2 = ix.indexOf("const TEMA_NOEGLER = Object.keys(TEMA_STD);"), b1 = ix.indexOf("const TEMA_PRESETS = {"), b2 = ix.indexOf("};\nconst TEMA_PERSON", b1) + 2;
const fraIndex = new Function(ix.slice(a1, a2) + ix.slice(b1, b2) + "; return { TEMA_STD, TEMA_PRESETS };")();
t("forvalgene i tema-forvalg.js er ens med TEMA_STD og TEMA_PRESETS i index.html (ingen afvigelse mellem forside og opsætning)", JSON.stringify(fraIndex.TEMA_PRESETS) === JSON.stringify(MOD.TEMA_PRESETS) && JSON.stringify(fraIndex.TEMA_STD) === JSON.stringify(MOD.TEMA_STD) && Object.keys(MOD.TEMA_PRESETS).join() === "Standard,Varm,Mørk,Høj kontrast");
const ov = fs.readFileSync(ROD + "public_html/overblik.html", "utf8");
t("menuen i bunden har valget, og forvalgsfilen hentes dynamisk (en manglende fil vælter ikke siden) og ligger i service workerens skal", /id="temaValg"/.test(ov) && (ov.match(/<option value="(|auto|standard|varm|moerk|hoj)">/g) || []).length === 6 && ov.includes('import("./tema-forvalg.js")') && fs.readFileSync(ROD + "public_html/sw.js", "utf8").includes('"./tema-forvalg.js"'));
process.exit(T.every(Boolean) ? 0 : 1);
