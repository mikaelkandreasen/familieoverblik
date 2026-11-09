import fs from "fs";
import vm from "vm";
const T=[]; const t=(n,ok,x="")=>{T.push(ok);console.log(ok?"ok  ":"FEJL",n,ok?"":x)};
const ROD = import.meta.dirname + "/../../public_html/";
const kilde = fs.readFileSync(ROD + "gamlebrowser.js", "utf8");
const tick = () => new Promise(r => setImmediate(r));
function laes(w, auto = false){ if (!auto) w.FO_BROWSER_STILLE = true; new Function("window", kilde)(w); return w.FO_BROWSER; }
const FIL = { "syntaks/valgfri.js": "valgfri-kaede", "syntaks/nullish.js": "nullish", "syntaks/tildeling.js": "logisk-tildeling", "syntaks/import.js": "dynamisk-import", "syntaks/async.js": "async" };
const ALLE = Object.values(FIL);
// et falsk dokument: scripts «hentes» ved at sætte src, og kører (sætter deres flag), hvis browseren kan læse deres syntaks
function fakeDok(w, { syntaks, net, moduler, flexGap, fuld, bodyFindes, hang }){
  const lyt = {}, born = [], hentet = [];
  const el = tag => { const e = { tag, style: {}, children: [], attrs: {}, className: "", id: "", _lyt: {}, scrollHeight: 0,
    appendChild(c){ this.children.push(c); c.foraeldre = this; return c; }, setAttribute(k, v){ this.attrs[k] = String(v); }, addEventListener(t, f){ (this._lyt[t] ??= []).push(f); } };
    if (tag === "script"){ if (moduler) e.noModule = false;
      Object.defineProperty(e, "src", { set(v){ hentet.push(v); if (hang) return; setImmediate(() => { if (!net) return e.onerror && e.onerror();
        if (v === "syntaks/styr.js") w.FO_SYNTAKS.styr = true; else if (FIL[v] && syntaks.has(FIL[v])) w.FO_SYNTAKS[FIL[v]] = true;
        e.onload && e.onload(); }); }, get(){ return ""; } }); }
    return e; };
  const d = { createElement: el, createTextNode: tx => ({ tekst: tx }), getElementById: id => born.find(x => x.id === id) || null, addEventListener(t, f){ (lyt[t] ??= []).push(f); },
    documentElement: fuld ? { requestFullscreen(){}, appendChild(){} } : { appendChild(){} }, _lyt: lyt, _born: born, hentet };
  d.head = { children: [], appendChild(c){ this.children.push(c); } };
  if (bodyFindes) d.body = { children: [], appendChild(c){ c.scrollHeight = c.style.cssText && flexGap ? 1 : 0; return c; }, removeChild(){}, insertBefore(c){ born.push(c); this.children.unshift(c); }, firstChild: null };
  return d;
}
function env({ chrome = 95, moduler = true, syntaks = ALLE, net = true, fetchOk = true, css = true, flexGap = true, fuld = true, lager = true, tz = true, sw = true, bodyFindes = true, hang = false } = {}){
  const timere = [];
  const w = { FO_BROWSER_STILLE: true, navigator: { userAgent: `Mozilla/5.0 (Linux; Android 5.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chrome}.0.0.0 Safari/537.36`, ...(sw ? { serviceWorker: {} } : {}) },
    ...(fetchOk ? { fetch(){}, Promise } : {}), ...(css ? { CSS: { supports: (a, b) => !(a === "inset" && css === "uden-inset") } } : {}),
    localStorage: lager ? { setItem(){}, removeItem(){} } : { setItem(){ throw new Error("privat"); }, removeItem(){} },
    Intl: tz ? { DateTimeFormat: class { format(){ return "9.11.2026"; } } } : { DateTimeFormat: class { constructor(){ throw new RangeError("tz"); } } },
    setTimeout(f, ms){ timere.push({ f, ms }); return timere.length; }, clearTimeout(){ w._ryddet = (w._ryddet || 0) + 1; }, timere };
  w.document = fakeDok(w, { syntaks: new Set(syntaks), net, moduler, flexGap, fuld, bodyFindes, hang });
  return { w, d: w.document };
}
const B = laes({});
const koer = (e) => new Promise(r => B.koer(e, r));
// ── prøverne mod forskellige browsere ──
let E = env(), r = await koer(E);
t("en nyere browser (alt findes): alle prøver består, intet mangler, intet er ukendt eller «pænere med», og alle seks prøvefiler blev hentet (kontrol og fem syntaksprøver)", r.ok && !r.mangler.length && !r.ukendt.length && !r.tilbage.length && r.resultater.length === B.proever.length && r.resultater.every(x => x.ok === true) && E.d.hentet.length === 6 && E.d.hentet[0] === "syntaks/styr.js", [r.mangler, E.d.hentet]);
r = await koer(env({ chrome: 49, moduler: false, syntaks: [], fetchOk: false, css: false, flexGap: false, fuld: false, sw: false }));
t("en gammel browser (Chrome 49: ingen moduler, ingen ny syntaks, ingen fetch, CSS-variabler eller grid): ok er falsk, og de kritiske mangler nævnes ved navn", !r.ok && ["JavaScript-moduler", "Valgfri kæde (a?.b)", "Nullish (a ?? b)", "Logisk tildeling (a ??= b)", "Dynamisk import()", "async / await", "fetch og Promise", "CSS-variabler", "CSS grid"].every(n => r.mangler.includes(n)) && !r.ukendt.length, r.mangler);
r = await koer(env({ chrome: 70, syntaks: ["dynamisk-import", "async"] }));
t("Chrome 70 (moduler, import() og async, men ingen ?. og ??): netop de tre syntaksfunktioner mangler", !r.ok && r.mangler.join("|") === "Valgfri kæde (a?.b)|Nullish (a ?? b)|Logisk tildeling (a ??= b)", r.mangler);
r = await koer(env({ chrome: 82, syntaks: ["valgfri-kaede", "nullish", "dynamisk-import", "async"] }));
t("Chrome 82 (alt undtagen ??=): kun «??=» mangler", !r.ok && r.mangler.join() === "Logisk tildeling (a ??= b)", r.mangler);
r = await koer(env({ net: false }));
t("SELVE FEJLEN (3.11.0 til 3.13.0): kan prøvefilerne ikke hentes (offline, blokeret), er syntaksen «ukendt» og tæller IKKE som en mangel, så der ikke vises en besked i en fin browser", r.ok && r.mangler.length === 0 && r.ukendt.length === 5 && r.resultater.filter(x => x.ok === null).map(x => x.id).join() === ALLE.join(), [r.mangler, r.ukendt]);
r = await koer(env({ net: false, syntaks: [], moduler: false }));
t("men en gammel browser uden moduler får stadig besked, selv om netværket svigter (de synkrone prøver gælder altid)", !r.ok && r.mangler.join() === "JavaScript-moduler" && r.ukendt.length === 5, r.mangler);
E = env({ syntaks: [] }); r = await koer(E);
t("er kontrolfilen hentet, men ingen syntaksflag sat, er syntaksen KENDT som mangelfuld (ikke ukendt): netop sådan ser en gammel browser ud", r.mangler.length === 5 && !r.ukendt.length);
r = await koer(env({ flexGap: false, css: "uden-inset" }));
t("mangler kun det, der er «pænere med» (gap, inset), kan siderne køre: ok er sand, og de to står under «tilbage»", r.ok && r.tilbage.join("|") === "Mellemrum i fleksible rækker (gap)|CSS inset", r.tilbage);
r = await koer(env({ fuld: false, sw: false }));
t("manglende fuld skærm og service worker (valgfri) er hverken en fejl eller en «pænere med»", r.ok && !r.tilbage.length && r.resultater.filter(x => x.ok === false).every(x => x.valgfri), r.resultater.filter(x => x.ok === false).map(x => x.id));
r = await koer(env({ lager: false, tz: false }));
t("en privat fane uden lager og en browser uden tidszoner: ikke kritisk, men nævnt som «pænere med»", r.ok && r.tilbage.join("|") === "Lager i browseren (localStorage)|Tidszoner (Intl)", r.tilbage);
const e2 = env(); e2.w.CSS = { supports(){ throw new Error("uventet"); } };
t("en prøve, der selv kaster en fejl, tæller som «mangler», og fejlen forplanter sig ikke", await (async () => { try { const x = await koer(e2); return !x.ok && x.mangler.includes("CSS-variabler"); } catch (e) { return false; } })());
E = env({ hang: true }); let faerdig = null; B.koer(E, x => { faerdig = x; });
await tick();
t("hænger hentningen (ingen af filerne svarer), sættes en tidsgrænse på 8 sekunder, og når den udløber, er syntaksen «ukendt» og siden i fred", faerdig === null && E.w.timere.length === 1 && E.w.timere[0].ms === 8000 && (E.w.timere[0].f(), faerdig && faerdig.ok && faerdig.ukendt.length === 5));
E = env(); await koer(E);
t("når alle filer er hentet, ryddes tidsgrænsen (så den ikke udløber bagefter)", E.w._ryddet === 1);
// ── de rigtige prøvefiler ──
function koerFil(fil){ const w = { FO_SYNTAKS: {} }; vm.createContext({ window: w }); vm.runInContext(fs.readFileSync(ROD + fil, "utf8"), vm.createContext({ window: w })); return w.FO_SYNTAKS; }
t("de seks prøvefiler sætter hver deres flag til sand, når de kører: kontrol (styr), ?., ??, ??=, import() og async", (() => { const fl = {}; for (const f of ["styr", "valgfri", "nullish", "tildeling", "import", "async"]) Object.assign(fl, koerFil(`syntaks/${f}.js`)); return fl.styr === true && ALLE.every(id => fl[id] === true); })());
const sx = f => fs.readFileSync(ROD + `syntaks/${f}.js`, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
t("hver prøvefil indeholder netop den syntaks, den skal prøve (så en gammel browser ikke kan læse den og derfor ikke sætter flaget)", /\?\./.test(sx("valgfri")) && /\?\?/.test(sx("nullish")) && /\?\?=/.test(sx("tildeling")) && /\bimport\(/.test(sx("import")) && /\basync\b/.test(sx("async")) && /\bawait\b/.test(sx("async")));
t("kontrolfilen er i gammel syntaks (ellers kunne en gammel browser heller ikke læse den, og alt blev «ukendt»)", !/=>|\blet\b|\bconst\b|`|\?\.|\?\?|\basync\b|\bclass\b/.test(sx("styr")));
t("import()-prøven KALDER ikke import (funktionen oprettes kun), så der ikke hentes noget af sig selv", /typeof \(function \(\) \{ return import\(/.test(sx("import")) && !/\(\s*\)\s*\)\s*\(\s*\)/.test(sx("import")));
// ── ingen eval (CSP) ──
const uden = kilde.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "").replace(/"(?:[^"\\\n]|\\.)*"/g, '""').replace(/'(?:[^'\\\n]|\\.)*'/g, "''").replace(/\/(?![*/])(?:[^/\\\n]|\\.)+\/[gimsuy]*/g, "/re/");
const ht = fs.readFileSync(ROD + "htaccess.txt", "utf8");
t("REGLEN: serverens CSP har ikke 'unsafe-eval', og derfor bruger gamlebrowser.js hverken new Function, eval, Function() eller setTimeout med tekst (det gav «mangler» i alle moderne browsere)", !/'unsafe-eval'/.test(ht) && !/\bnew\s+[\w.]*Function\b|\beval\s*\(|\bFunction\s*\(|\.Fn\b/.test(uden), uden.match(/new\s+[\w.]*Function|eval\s*\(|Function\s*\(|\.Fn\b/g));
const alleJs = fs.readdirSync(ROD).filter(f => f.endsWith(".js") && !f.startsWith("sprog-pakker")).concat(fs.readdirSync(ROD).filter(f => f.endsWith(".html")));
const evalSteder = alleJs.filter(f => /\bnew\s+Function\s*\(|\beval\s*\(|setTimeout\s*\(\s*["'`]|setInterval\s*\(\s*["'`]/.test(fs.readFileSync(ROD + f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "")));
t("ingen side eller script i public_html bruger new Function, eval eller tekst i setTimeout (CSP'en ville blokere dem)", !evalSteder.length, evalSteder);
// ── version, besked, selvstart ──
const V = B.version;
t("browser og version: Chrome 95 på Android 5.1, Firefox, Edge, Samsung Internet, Safari 14.1 og iPhone-browsere (Brave, Chrome og Firefox bruger Safari-motoren)", [
  [() => V("Mozilla/5.0 (Linux; Android 5.1; Tablet) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.74 Safari/537.36"), "Chrome", 95], [() => V("Mozilla/5.0 (Android 9; Mobile; rv:109.0) Gecko/109.0 Firefox/109.0"), "Firefox", 109],
  [() => V("Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36 Edg/120.0.2210.91"), "Edge", 120], [() => V("Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/16.0 Chrome/92.0 Mobile Safari/537.36"), "Samsung Internet", 16],
  [() => V("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1 Safari/605.1.15"), "Safari", 14.1], [() => V("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0 Mobile/15E148 Safari/604.1"), "iPhone-browser (Safari-motor)", 120],
].every(([f, navn, nr]) => { const x = f(); return x && x.navn === navn && x.nr === nr; }) && V("") === null && V(null) === null && V("NoName/1.0") === null);
const tk = B.tekst({ mangler: ["JavaScript-moduler", "CSS grid"] }, "Mozilla/5.0 (Linux; Android 5.1) AppleWebKit/537.36 Chrome/49.0.2623 Safari/537.36");
t("beskeden nævner browseren og versionen, hvad der mangler, og hvad der kræves (Chrome 85, Safari 14, Firefox 79)", /^Din browser \(Chrome 49\) er for gammel til Familieoverblik\. Det mangler: JavaScript-moduler, CSS grid\. Opdatér browseren \(Chrome 85, Safari 14 eller Firefox 79 og nyere\)/.test(tk), tk);
E = env({ chrome: 49, moduler: false, syntaks: [] }); r = await koer(E);
B.visBesked(r, { w: E.w, d: E.d });
const bs = E.d._born[0];
t("beskeden sættes øverst på siden: en rød bjælke med role=alert, teksten og et link til browser.html, og kun én gang selv om scriptet kører igen", E.d._born.length === 1 && bs.id === "fo-gammel-browser" && bs.attrs.role === "alert" && /b3261e/.test(bs.style.cssText) && /position:fixed/.test(bs.style.cssText) && bs.children[0].tekst.includes("er for gammel") && bs.children[1].href === "browser.html" && (B.visBesked(r, { w: E.w, d: E.d }), E.d._born.length === 1));
E = env({ chrome: 49, syntaks: [], bodyFindes: false }); r = await koer(E);
B.visBesked(r, { w: E.w, d: E.d });
t("findes body endnu ikke (scriptet står i hovedet), venter beskeden på DOMContentLoaded", E.d._lyt.DOMContentLoaded && E.d._lyt.DOMContentLoaded.length === 1 && E.d._born.length === 0);
// selvstart
E = env({ chrome: 49, moduler: false, syntaks: [] }); const w1 = E.w; delete w1.FO_BROWSER_STILLE; laes(w1, true); await tick(); await tick();
t("selvstart: i en gammel browser vises beskeden af sig selv, når siden har hentet prøvefilerne", E.d._born.length === 1);
E = env(); const w2 = E.w; delete w2.FO_BROWSER_STILLE; laes(w2, true); await tick(); await tick();
t("selvstart: i en browser, der kan det hele, sker der ingenting (ingen besked)", E.d._born.length === 0 && E.d.hentet.length === 6);
E = env({ net: false }); const w4 = E.w; delete w4.FO_BROWSER_STILLE; laes(w4, true); await tick(); await tick();
t("selvstart: uden forbindelse til prøvefilerne (offline) vises INGEN besked i en fin browser", E.d._born.length === 0);
const w3 = { document: null, navigator: {} };
t("selvstart i en helt ødelagt browser kaster ingen fejl (en kontrol må aldrig ødelægge siden)", (() => { try { laes(w3, true); return true; } catch (e) { return false; } })());
// gammel syntaks
const forbudt = [[/=>/, "pilefunktion"], [/\blet\b/, "let"], [/\bconst\b/, "const"], [/`/, "skabelonstreng"], [/\bclass\b/, "class"], [/\basync\b|\bawait\b/, "async/await"], [/\?\./, "valgfri kæde"], [/\?\?/, "nullish"], [/\.\.\./, "spredning"], [/\*\*/, "potens"], [/\bof\b/, "for…of"]].filter(([rx]) => rx.test(uden)).map(x => x[1]);
t("gamlebrowser.js er skrevet i gammel JavaScript (ingen pile, let/const, skabelonstrenge, class, async, ?., ??, spredning eller for…of), ellers kan det ikke køre i de browsere, det skal advare", !forbudt.length, forbudt);
t("scriptet er et klassisk script: starter med en funktion, der får window, og bruger «use strict» (ikke import/export)", /^\(function \(w\) \{\s*"use strict";/m.test(kilde.replace(/\/\*[\s\S]*?\*\//, "")) && !/^\s*(import|export)\b/m.test(kilde));
// siderne
const sider = ["overblik", "index", "backlog", "vaelger", "billeder", "gaest-wifi", "start"];
t("alle syv sider henter vagten som et klassisk script FØR deres første modul-script", sider.every(s => { const h = fs.readFileSync(ROD + s + ".html", "utf8"), g = h.indexOf('<script src="gamlebrowser.js"></script>'), m = h.indexOf('<script type="module">'); return g > 0 && g < m && h.split("gamlebrowser.js").length === 2; }));
const bh = fs.readFileSync(ROD + "browser.html", "utf8"), sw = fs.readFileSync(ROD + "sw.js", "utf8");
t("browser.html er en almindelig side uden moduler, slår vagtens selvstart fra, bruger den asynkrone prøve (B.koer(null, function (r) …)) og kan vise «Kunne ikke tjekkes»", !bh.includes('type="module"') && bh.indexOf("FO_BROWSER_STILLE = true") < bh.indexOf('<script src="gamlebrowser.js">') && bh.includes("B.koer(null, function (r) {") && bh.includes("Kunne ikke tjekkes") && bh.includes("Siderne kan ikke køre i denne browser") && bh.includes("Alt, siderne bruger, findes i denne browser"));
t("service workeren har gamlebrowser.js, browser.html og alle seks prøvefiler i sin skal (så prøverne findes offline), med cache-version v5 eller nyere", ["./gamlebrowser.js", "./browser.html", "./syntaks/styr.js", "./syntaks/valgfri.js", "./syntaks/nullish.js", "./syntaks/tildeling.js", "./syntaks/import.js", "./syntaks/async.js"].every(f => sw.includes(`"${f}"`)) && sw.match(/familieoverblik-shell-v([5-9]|\d\d)/) !== null);
t("browser.html kan hentes uden PIN (den står ikke i adgangsreglerne for sider, der kræver login)", !ht.includes("browser.html") && !ht.includes("browser\\.html"));
process.exit(T.every(Boolean) ? 0 : 1);
