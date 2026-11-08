import fs from "fs";
const T=[]; const t=(n,ok,x="")=>{T.push(ok);console.log(ok?"ok  ":"FEJL",n,ok?"":x)};
const tick = () => new Promise(r => setImmediate(r));
const kode = fs.readFileSync("/tmp/fs_block.js", "utf8");
function bygg({ praefix = false, ingen = false, alleredeFuld = false, aktiveret = true, gemt = {}, laasStart = null, laasSlut = null } = {}){
  const lager = { ...gemt }, haendelser = {}, kald = [], doc = {}; const knap = { hidden: true, textContent: "Fuld skærm", attrs: {}, _h: {}, setAttribute(k, v){ this.attrs[k] = v; }, addEventListener(t, f){ (this._h[t] ??= []).push(f); } };
  const html = {};
  if (!ingen){
    const start = function(){ kald.push("start"); return laasStart ? laasStart() : (doc.fullscreenElement = html, Promise.resolve()); };
    if (praefix) html.webkitRequestFullscreen = function(){ kald.push("start-webkit"); doc.webkitFullscreenElement = html; return undefined; }; else html.requestFullscreen = start;
  }
  Object.assign(doc, { documentElement: html, fullscreenEnabled: aktiveret ? true : false, fullscreenElement: null, webkitFullscreenElement: null,
    exitFullscreen: function(){ kald.push("slut"); doc.fullscreenElement = null; return laasSlut ? laasSlut() : Promise.resolve(); },
    addEventListener(t, f, o){ (haendelser[t] ??= []).push({ f, o }); }, removeEventListener(t, f){ haendelser[t] = (haendelser[t] || []).filter(x => x.f !== f); } });
  if (praefix){ doc.webkitExitFullscreen = function(){ kald.push("slut-webkit"); doc.webkitFullscreenElement = null; }; delete doc.exitFullscreen; }
  const $ = id => id === "fuldKnap" ? knap : null;
  globalThis.localStorage = { getItem: k => (k in lager ? lager[k] : null), setItem: (k, v) => { lager[k] = v; } };
  globalThis.matchMedia = q => ({ matches: alleredeFuld && /fullscreen/.test(q) });
  const api = new Function("$", "document", kode + "; return { fuldskaermSkift, fuldskaermTegn };")($, doc);
  return { knap, doc, kald, lager, haendelser, api, klik: async () => { for (const h of knap._h.click || []) await h({}); await tick(); },
    skift: (v) => { doc.fullscreenElement = v ? html : null; doc.webkitFullscreenElement = v ? html : null; for (const nøgle of ["fullscreenchange", "webkitfullscreenchange"]) for (const x of haendelser[nøgle] || []) x.f({}); },
    tryk: async () => { for (const x of [...(haendelser.pointerdown || [])]) x.f({}); await tick(); } };
}
let u = bygg();
t("hvor browseren har Fullscreen API, vises knappen med teksten «Fuld skærm»", u.knap.hidden === false && u.knap.textContent === "Fuld skærm" && u.knap.attrs["aria-pressed"] === "false");
await u.klik();
t("et tryk starter fuld skærm på hele siden, og valget huskes (først efter at browseren har sagt ja)", u.kald.join() === "start" && u.lager["familieoverblik-fuldskaerm"] === "1");
u.skift(true);
t("når browseren melder, at fuld skærm er sat i gang, hedder knappen «Afslut fuld skærm» og er nedtrykket", u.knap.textContent === "Afslut fuld skærm" && u.knap.attrs["aria-pressed"] === "true");
await u.klik();
t("et tryk mere afslutter fuld skærm og slår «huskes» fra (så den ikke starter igen af sig selv)", u.kald.at(-1) === "slut" && u.lager["familieoverblik-fuldskaerm"] === "0");
u.skift(false); t("og knappen siger «Fuld skærm» igen", u.knap.textContent === "Fuld skærm" && u.knap.attrs["aria-pressed"] === "false");
// ældre Chrome (præfiks)
u = bygg({ praefix: true });
t("ældre Chrome (Android 5) med webkit-præfiks: knappen vises, og den præfikserede funktion bruges til at starte", u.knap.hidden === false); await u.klik();
t("…den præfikserede start kaldes, og valget huskes (også selvom den ikke giver et løfte tilbage)", u.kald.join() === "start-webkit" && u.lager["familieoverblik-fuldskaerm"] === "1");
u.skift(true); await u.klik();
t("…og den præfikserede afslutning bruges til at afslutte", u.kald.at(-1) === "slut-webkit" && u.lager["familieoverblik-fuldskaerm"] === "0");
// ikke muligt
t("uden Fullscreen API (fx iPhone) er knappen skjult", bygg({ ingen: true }).knap.hidden === true);
t("hvis siden ikke må gå i fuld skærm (fullscreenEnabled = false) er knappen skjult", bygg({ aktiveret: false }).knap.hidden === true);
t("hvis siden allerede er en installeret app i fuld skærm (display-mode: fullscreen), er knappen skjult, og intet startes af sig selv", (() => { const x = bygg({ alleredeFuld: true, gemt: { "familieoverblik-fuldskaerm": "1" } }); return x.knap.hidden === true && !(x.haendelser.pointerdown || []).length; })());
// afslag
const f0 = console.error; console.error = () => {};
u = bygg({ laasStart: () => Promise.reject(new Error("Permissions check failed")) }); await u.klik();
console.error = f0;
t("afviser browseren fuld skærm (fx uden et tryk), går der intet i stykker, og valget huskes IKKE", u.lager["familieoverblik-fuldskaerm"] === undefined && u.knap.textContent === "Fuld skærm");
t("lukkes fuld skærm ved et fejl i afslutningen, går der heller intet i stykker", await (async () => { const x = bygg({ laasSlut: () => Promise.reject(new Error("x")) }); x.skift(true); const f = console.error; console.error = () => {}; await x.klik(); console.error = f; return x.lager["familieoverblik-fuldskaerm"] === "0"; })());
// auto efter genindlæsning
u = bygg({ gemt: { "familieoverblik-fuldskaerm": "1" } });
t("er fuld skærm slået til sidst, lytter siden efter ét tryk (i indfangningsfasen, så det virker uanset hvad der trykkes på)", (u.haendelser.pointerdown || []).length === 1 && u.haendelser.pointerdown[0].o === true && u.kald.length === 0);
await u.tryk();
t("første tryk går i fuld skærm igen, og lytteren fjernes (kun én gang)", u.kald.join() === "start" && (u.haendelser.pointerdown || []).length === 0);
u = bygg({ gemt: { "familieoverblik-fuldskaerm": "0" } }); t("er det slået fra, sker der ikke noget af sig selv", (u.haendelser.pointerdown || []).length === 0);
u = bygg(); t("er det aldrig brugt, sker der ikke noget af sig selv", (u.haendelser.pointerdown || []).length === 0);
u = bygg({ gemt: { "familieoverblik-fuldskaerm": "1" } }); u.doc.fullscreenElement = u.doc.documentElement; await u.tryk();
t("er siden allerede i fuld skærm ved første tryk, startes den ikke igen", u.kald.length === 0);
t("begge hændelser (fullscreenchange og den præfikserede) opdaterer knappen", ["fullscreenchange", "webkitfullscreenchange"].every(h => (u.haendelser[h] || []).length === 1));
t("uden localStorage (privat tilstand) går knappen stadig an", await (async () => { const x = bygg(); delete globalThis.localStorage; globalThis.localStorage = { getItem(){ throw new Error("nej"); }, setItem(){ throw new Error("nej"); } }; await x.klik(); return x.kald.join() === "start"; })());
const ov = fs.readFileSync(new URL("../../public_html/overblik.html", import.meta.url).pathname, "utf8");
t("knappen står i bundlinjen ved siden af Tilpas layout, er skjult som standard, og har en forklarende titel", /id="fuldKnap" aria-pressed="false" hidden title="[^"]*genindlæsning[^"]*">Fuld skærm<\/button>\s*<button type="button" class="fod-knap" id="layoutKnap"/.test(ov));
process.exit(T.every(Boolean) ? 0 : 1);
