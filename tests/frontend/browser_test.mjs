import fs from "fs";
const T=[]; const t=(n,ok,x="")=>{T.push(ok);console.log(ok?"ok  ":"FEJL",n,ok?"":x)};
const ROD = import.meta.dirname + "/../../public_html/";
const kilde = fs.readFileSync(ROD + "gamlebrowser.js", "utf8");
function laes(w, auto = false){ if (!auto) w.FO_BROWSER_STILLE = true; new Function("window", kilde)(w); return w.FO_BROWSER; }
// et falsk dokument: nok til de prøver, scriptet laver
function fakeDok({ moduler = true, flexGap = true, fuld = true, bodyFindes = true } = {}){
  const lyt = {}, born = [];
  const el = tag => { const e = { tag, style: {}, children: [], attrs: {}, appendChild(c){ this.children.push(c); return c; }, setAttribute(k, v){ this.attrs[k] = v; }, scrollHeight: 0 };
    if (tag === "script" && moduler) e.noModule = false; return e; };
  const d = { createElement: el, createTextNode: tx => ({ tekst: tx }), getElementById: id => born.find(x => x.id === id) || null, addEventListener(t, f){ (lyt[t] ??= []).push(f); },
    documentElement: fuld ? { requestFullscreen(){} } : {}, _lyt: lyt, _born: born };
  if (bodyFindes) d.body = { children: [], appendChild(c){ c.scrollHeight = c.style.cssText && flexGap ? 1 : 0; return c; }, removeChild(){}, insertBefore(c, foer){ born.push(c); this.children.unshift(c); }, firstChild: null };
  return d;
}
function env({ chrome = 95, moduler = true, nyt = "alt", fetchOk = true, css = true, flexGap = true, fuld = true, lager = true, tz = true, sw = true } = {}){
  const d = fakeDok({ moduler, flexGap, fuld });
  const Fn = function(kode){ if ((nyt === "intet" && /\?\.|\?\?|import\(|async/.test(kode)) || (nyt === "uden-tildeling" && /\?\?=/.test(kode)) || (nyt === "70" && /\?\.|\?\?/.test(kode))) throw new SyntaxError("gammel motor"); return new Function(kode); };
  const w = { document: d, Function: Fn, FO_BROWSER_STILLE: true, navigator: { userAgent: `Mozilla/5.0 (Linux; Android 5.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chrome}.0.0.0 Safari/537.36`, ...(sw ? { serviceWorker: {} } : {}) },
    ...(fetchOk ? { fetch(){}, Promise } : {}), ...(css ? { CSS: { supports: (a, b) => !(a === "inset" && css === "uden-inset") && !(a === "aspect-ratio" && css === "uden-ratio") } } : {}),
    localStorage: lager ? { setItem(){}, removeItem(){} } : { setItem(){ throw new Error("privat"); }, removeItem(){} }, Intl: tz ? { DateTimeFormat: class { format(){ return "9.11.2026"; } } } : { DateTimeFormat: class { constructor(){ throw new RangeError("tz"); } } } };
  return { w, d, Fn };
}
const B = laes({});
t("en nyere browser (alt findes): alle kritiske prøver består, intet mangler, intet «pænere med», og scriptet viser ingen besked", (r => r.ok && !r.mangler.length && !r.tilbage.length && r.resultater.length === B.proever.length)(B.koer(env())));
let r = B.koer(env({ chrome: 49, moduler: false, nyt: "intet", fetchOk: false, css: false, flexGap: false, fuld: false, sw: false }));
t("en gammel browser (Chrome 49: ingen moduler, ny syntaks, fetch, CSS-variabler, grid): ok er falsk, og alle de kritiske mangler nævnes ved navn", !r.ok && ["JavaScript-moduler", "Valgfri kæde (a?.b)", "Nullish (a ?? b)", "Logisk tildeling (a ??= b)", "Dynamisk import()", "async / await", "fetch og Promise", "CSS-variabler", "CSS grid"].every(n => r.mangler.includes(n)), r.mangler);
r = B.koer(env({ chrome: 70, nyt: "70" }));
t("Chrome 70 (moduler og import() ja, men ingen ?. og ??): netop de tre syntaksfunktioner mangler (valgfri kæde, nullish og ??=)", !r.ok && r.mangler.join("|") === "Valgfri kæde (a?.b)|Nullish (a ?? b)|Logisk tildeling (a ??= b)", r.mangler);
r = B.koer(env({ chrome: 82, nyt: "uden-tildeling" }));
t("Chrome 82 (alt undtagen ??=): kun «??=» mangler", !r.ok && r.mangler.join() === "Logisk tildeling (a ??= b)", r.mangler);
r = B.koer(env({ flexGap: false, css: "uden-inset" }));
t("mangler kun det, der er «pænere med» (gap, inset), kan siderne køre: ok er sand, og de to står under «tilbage»", r.ok && r.tilbage.join("|") === "Mellemrum i fleksible rækker (gap)|CSS inset", r.tilbage);
r = B.koer(env({ fuld: false, sw: false }));
t("manglende fuld skærm og service worker (valgfri) er hverken en fejl eller en «pænere med»", r.ok && !r.tilbage.length && r.resultater.filter(x => !x.ok).every(x => x.valgfri), r.resultater.filter(x => !x.ok).map(x => x.id));
r = B.koer(env({ lager: false, tz: false }));
t("en privat fane uden lager og en browser uden tidszoner: ikke kritisk, men nævnt som «pænere med»", r.ok && r.tilbage.join("|") === "Lager i browseren (localStorage)|Tidszoner (Intl)", r.tilbage);
const e2 = env(); e2.w.CSS = { supports(){ throw new Error("uventet"); } };
t("en prøve, der selv kaster en fejl, tæller som «mangler», og fejlen forplanter sig ikke", (() => { try { const x = B.koer(e2); return !x.ok && x.mangler.includes("CSS-variabler"); } catch (e) { return false; } })());
// version
const V = B.version;
t("browser og version: Chrome 95 på Android 5.1, Firefox, Edge, Samsung Internet, Safari 14.1, og iPhone-browsere (Brave, Chrome og Firefox bruger Safari-motoren)", [
  [e => V("Mozilla/5.0 (Linux; Android 5.1; Tablet) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.74 Safari/537.36"), "Chrome", 95], [e => V("Mozilla/5.0 (Android 9; Mobile; rv:109.0) Gecko/109.0 Firefox/109.0"), "Firefox", 109],
  [e => V("Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36 Edg/120.0.2210.91"), "Edge", 120], [e => V("Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/16.0 Chrome/92.0 Mobile Safari/537.36"), "Samsung Internet", 16],
  [e => V("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1 Safari/605.1.15"), "Safari", 14.1], [e => V("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0 Mobile/15E148 Safari/604.1"), "iPhone-browser (Safari-motor)", 120],
].every(([f, navn, nr]) => { const x = f(); return x && x.navn === navn && x.nr === nr; }) && V("") === null && V(null) === null && V("NoName/1.0") === null);
const tk = B.tekst({ mangler: ["JavaScript-moduler", "CSS grid"] }, "Mozilla/5.0 (Linux; Android 5.1) AppleWebKit/537.36 Chrome/49.0.2623 Safari/537.36");
t("beskeden nævner browseren og versionen, hvad der mangler, og hvad der kræves (Chrome 85, Safari 14, Firefox 79)", /^Din browser \(Chrome 49\) er for gammel til Familieoverblik\. Det mangler: JavaScript-moduler, CSS grid\. Opdatér browseren \(Chrome 85, Safari 14 eller Firefox 79 og nyere\)/.test(tk), tk);
// besked
let E = env({ chrome: 49, moduler: false, nyt: "intet" }), res = B.koer(E);
B.visBesked(res, { w: E.w, d: E.d });
const bs = E.d._born[0];
t("beskeden sættes øverst på siden: en rød bjælke med role=alert, teksten, og et link til browser.html", E.d._born.length === 1 && bs.id === "fo-gammel-browser" && bs.attrs.role === "alert" && /b3261e/.test(bs.style.cssText) && /position:fixed/.test(bs.style.cssText) && bs.children[0].tekst.includes("er for gammel") && bs.children[1].href === "browser.html" && bs.children[1].children[0].tekst === "Se hvad der mangler");
B.visBesked(res, { w: E.w, d: E.d });
t("beskeden vises kun én gang, selv om scriptet kører igen", E.d._born.length === 1);
E = env({ chrome: 49, nyt: "intet" }); E.d.body = null; delete E.d.body;
B.visBesked(B.koer(E), { w: E.w, d: E.d });
t("findes body endnu ikke (scriptet står i hovedet), venter den på DOMContentLoaded og viser så beskeden", E.d._lyt.DOMContentLoaded && E.d._lyt.DOMContentLoaded.length === 1 && E.d._born.length === 0);
// selvstart
E = env({ chrome: 49, moduler: false, nyt: "intet" }); const w1 = { ...E.w }; delete w1.FO_BROWSER_STILLE; w1.document = E.d; w1.Function = E.Fn;
laes(w1, true);
t("selvstart: i en gammel browser vises beskeden af sig selv, når siden indlæser scriptet", E.d._born.length === 1);
E = env(); const w2 = { ...E.w }; delete w2.FO_BROWSER_STILLE; w2.document = E.d; w2.Function = E.Fn;
laes(w2, true);
t("selvstart: i en browser, der kan det hele, sker der ingenting (ingen besked, ingen ændring af siden)", E.d._born.length === 0);
const w3 = { document: null, Function: () => { throw new Error("alt går galt"); }, navigator: {} }; delete w3.FO_BROWSER_STILLE;
t("selvstart i en helt ødelagt browser kaster ingen fejl (en kontrol må aldrig ødelægge siden)", (() => { try { laes(w3, true); return true; } catch (e) { return false; } })());
// kilden er gammel syntaks
const uden = kilde.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "").replace(/"(?:[^"\\\n]|\\.)*"/g, '""').replace(/'(?:[^'\\\n]|\\.)*'/g, "''").replace(/\/(?![*/])(?:[^/\\\n]|\\.)+\/[gimsuy]*/g, "/re/");
const forbudt = [[/=>/, "pilefunktion"], [/\blet\b/, "let"], [/\bconst\b/, "const"], [/`/, "skabelonstreng"], [/\bclass\b/, "class"], [/\basync\b|\bawait\b/, "async/await"], [/\?\./, "valgfri kæde"], [/\?\?/, "nullish"], [/\.\.\./, "spredning"], [/\*\*/, "potens"], [/\bof\b/, "for…of"]].filter(([rx]) => rx.test(uden)).map(x => x[1]);
t("gamlebrowser.js er skrevet i gammel JavaScript (ingen pile, let/const, skabelonstrenge, class, async, ?., ??, spredning eller for…of), ellers kan det ikke køre i de browsere, det skal advare", !forbudt.length, forbudt);
t("scriptet er et klassisk script: det starter med en funktion, der får window, og bruger «use strict» (ikke import/export)", /^\(function \(w\) \{\s*"use strict";/m.test(kilde.replace(/\/\*[\s\S]*?\*\//, "")) && !/^\s*(import|export)\b/m.test(kilde));
// siderne
const sider = ["overblik", "index", "backlog", "vaelger", "billeder", "gaest-wifi", "start"];
t("alle syv sider henter vagten som et klassisk script FØR deres første modul-script (så den kører, også når modulet ikke kan)", sider.every(s => { const h = fs.readFileSync(ROD + s + ".html", "utf8"), g = h.indexOf('<script src="gamlebrowser.js"></script>'), m = h.indexOf('<script type="module">'); return g > 0 && g < m && h.split("gamlebrowser.js").length === 2; }), sider.filter(s => !fs.readFileSync(ROD + s + ".html", "utf8").includes("gamlebrowser.js")));
const bh = fs.readFileSync(ROD + "browser.html", "utf8"), sw = fs.readFileSync(ROD + "sw.js", "utf8");
t("browser.html er en almindelig side uden moduler, der slår vagtens selvstart fra og viser tabellen og en dom (god, halv eller dårlig)", !bh.includes('type="module"') && bh.indexOf("FO_BROWSER_STILLE = true") < bh.indexOf('<script src="gamlebrowser.js">') && /class="dom/.test(bh) && bh.includes("Siderne kan ikke køre i denne browser") && bh.includes("Alt, siderne bruger, findes i denne browser"));
t("service workeren har begge filer i sin skal og en cache-version fra v3 eller nyere, fordi skallen er ændret", sw.includes('"./gamlebrowser.js"') && sw.includes('"./browser.html"') && sw.match(/familieoverblik-shell-v([3-9]|\d\d)/) !== null);
const ht = fs.readFileSync(ROD + "htaccess.txt", "utf8");
t("browser.html kan hentes uden PIN (den står ikke i adgangsreglerne for sider, der kræver login), så den kan åbnes på en gammel tablet før opsætningen", !ht.includes("browser.html") && !ht.includes("browser\\.html"));
process.exit(T.every(Boolean) ? 0 : 1);
