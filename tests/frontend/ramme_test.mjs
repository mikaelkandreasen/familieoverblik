import fs from "fs";
const T=[]; const t=(n,ok,x="")=>{T.push(ok);console.log(ok?"ok  ":"FEJL",n,ok?"":x)};
const kode = fs.readFileSync("/tmp/ramme_block.js", "utf8").replace(/\nrammeInit\(\{ \$, doc: document[^\n]*\n/, "\n");     // selve opstarten (med forsidens egne funktioner) udelades; prøven starter den med falske
const R = new Function(kode + "; return { rammeMaal, rammeInit, erForsideLink, RAMME_SIDE, RAMME_LUK_MS };")();
const a = (href, extra = {}) => ({ getAttribute: n => (n === "href" ? href : null), target: "", ...extra });
const e = (extra = {}) => ({ defaultPrevented: false, button: 0, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...extra });
t("i fuld skærm åbnes en side i samme mappe i rammen (også med #-anker)", R.rammeMaal(a("backlog.html"), e(), true) === "backlog.html" && R.rammeMaal(a("index.html#mad"), e(), true) === "index.html#mad" && R.rammeMaal(a("gaest-wifi.html"), e(), true) === "gaest-wifi.html");
t("uden fuld skærm gøres intet (linket virker som før)", R.rammeMaal(a("backlog.html"), e(), false) === null);
t("forsiden selv (overblik.html, med ./ og anker) åbnes aldrig i rammen", ["overblik.html", "./overblik.html", "overblik.html#x", "OVERBLIK.HTML"].every(h => R.rammeMaal(a(h), e(), true) === null));
t("andet end sider i samme mappe åbnes ikke i rammen: andre sites, stier, JavaScript, e-mail, tomme links og bare ankre", ["https://drivefromhome.com/city/tokyo/drive/", "//ond.example.com/x.html", "../x.html", "/index.html", "sub/x.html", "javascript:alert(1)", "mailto:a@b.dk", "", "#top", "billede.png", "x.php", "backlog.html?x=1"].every(h => R.rammeMaal(a(h), e(), true) === null));
t("nye faner og vinduer (target=_blank), midterklik, ctrl/cmd/shift/alt-klik og klik, der allerede er håndteret, røres ikke", [a("backlog.html", { target: "_blank" }), a("backlog.html", { target: "_top" })].every(x => R.rammeMaal(x, e(), true) === null) && [e({ button: 1 }), e({ ctrlKey: true }), e({ metaKey: true }), e({ shiftKey: true }), e({ altKey: true }), e({ defaultPrevented: true })].every(x => R.rammeMaal(a("backlog.html"), x, true) === null) && R.rammeMaal(a("backlog.html", { target: "_self" }), e(), true) === "backlog.html");
t("skrald giver null uden fejl (intet link, ingen hændelse)", R.rammeMaal(null, e(), true) === null && R.rammeMaal(a("backlog.html"), null, true) === null && R.rammeMaal({ getAttribute: () => null }, e(), true) === null);
t("erForsideLink genkender links tilbage til forsiden, og kun dem", ["overblik.html", "./overblik.html", "overblik.html#a"].every(R.erForsideLink) && !["index.html", "overblik.html.bak", "xoverblik.html", "", null, undefined].some(R.erForsideLink));
// opstarten med falske elementer
function bygDom(){
  const els = {}, lyt = {}, kald = { genopfrisk: 0, timere: [], ryddet: 0 };
  const el = id => (els[id] ??= { id, hidden: true, src: "", textContent: "", contentDocument: null, _h: {}, addEventListener(t, f){ (this._h[t] ??= []).push(f); } });
  for (const id of ["rammeLag", "rammeIframe", "rammeTitel", "rammeLuk"]) el(id);
  const doc = { addEventListener(t, f, c){ (lyt[t] ??= []).push({ f, c }); } };
  let fuld = false;
  const api = R.rammeInit({ $: el, doc, fsElement: () => fuld, genopfrisk: () => { kald.genopfrisk++; }, setT: (f, ms) => { kald.timere.push({ f, ms }); return kald.timere.length; }, clearT: () => { kald.ryddet++; } });
  const klik = (href, extra = {}) => { let stoppet = false; const ev = e({ target: { closest: s => (s === "a[href]" ? a(href) : null) }, preventDefault(){ stoppet = true; }, ...extra }); for (const l of lyt.click || []) l.f(ev); return stoppet; };
  return { els, el, lyt, kald, klik, api, saet: v => { fuld = v; } };
}
let D = bygDom();
t("lytteren på forsiden sidder i indfangningsfasen, så den kommer før de andre klik-håndterere", D.lyt.click.length === 1 && D.lyt.click[0].c === true);
t("ikke i fuld skærm: klikket stoppes ikke, og rammen forbliver lukket", D.klik("backlog.html") === false && D.els.rammeLag.hidden === true && D.els.rammeIframe.src === "");
D.saet(true);
t("i fuld skærm: klikket stoppes (siden skifter ikke), rammen åbnes med siden, og en timer til automatisk lukning startes (10 minutter)", D.klik("index.html#mad") === true && D.els.rammeLag.hidden === false && D.els.rammeIframe.src === "index.html#mad" && D.kald.timere.at(-1).ms === 600000, D.els.rammeIframe.src);
t("et klik på forsiden i fuld skærm stoppes ikke, hvis linket peger på forsiden eller et andet sted", D.klik("overblik.html") === false && D.klik("https://x.dk/a.html") === false);
t("«← Forsiden» lukker: rammen skjules, siden sættes til tom (stopper timere og netværk i den), titlen ryddes, og forsiden genopfriskes (noget kan være rettet i opsætningen)", (() => { D.els.rammeLuk._h.click[0](); return D.els.rammeLag.hidden === true && D.els.rammeIframe.src === "about:blank" && D.kald.genopfrisk === 1; })());
// sidens indhold
D = bygDom(); D.saet(true); D.klik("backlog.html");
const indre = { lyt: {}, title: "Backlog", location: { href: "http://x/backlog.html" }, addEventListener(t, f, c){ (this.lyt[t] ??= []).push({ f, c }); } };
D.els.rammeIframe.contentDocument = indre; D.els.rammeIframe._h.load[0]();
t("når siden i rammen er indlæst, vises dens titel, og der lyttes efter klik, tryk og tastetryk (til timeren) i den", D.els.rammeTitel.textContent === "Backlog" && indre.lyt.click.length === 1 && indre.lyt.click[0].c === true && ["pointerdown", "keydown", "touchstart"].every(h => indre.lyt[h]?.length === 1));
let stoppet = false;
indre.lyt.click[0].f({ target: { closest: () => a("overblik.html") }, preventDefault(){ stoppet = true; } });
t("et link til forsiden inde i rammen (← Oversigten, ‹ Overblik) lukker rammen i stedet for at åbne forsiden i rammen", stoppet && D.els.rammeLag.hidden === true && D.kald.genopfrisk === 1);
D.klik("backlog.html"); const antal = D.kald.timere.length; stoppet = false;
indre.lyt.click[0].f({ target: { closest: () => a("index.html") }, preventDefault(){ stoppet = true; } });
t("andre links i rammen virker som de plejer (siderne skifter inde i rammen), og aktiviteten nulstiller timeren", !stoppet && D.els.rammeLag.hidden === false && D.kald.timere.length === antal + 1);
indre.lyt.keydown[0].f(); t("tastetryk i rammen nulstiller også timeren", D.kald.timere.length === antal + 2 && D.kald.ryddet >= 2);
D.kald.timere.at(-1).f();
t("når ingen har rørt ved rammen i 10 minutter, lukker den af sig selv og forsiden genopfriskes", D.els.rammeLag.hidden === true && D.els.rammeIframe.src === "about:blank");
D = bygDom(); D.els.rammeIframe.contentDocument = null;
t("en side i rammen, der ikke kan læses (anden oprindelse, tom side), vælter ikke noget", (() => { D.els.rammeIframe._h.load[0](); D.els.rammeIframe.contentDocument = { location: { href: "about:blank" } }; D.els.rammeIframe._h.load[0](); Object.defineProperty(D.els.rammeIframe, "contentDocument", { get(){ throw new Error("SecurityError"); } }); D.els.rammeIframe._h.load[0](); return true; })());
// siden og serverens regler
const ov = fs.readFileSync(import.meta.dirname + "/../../public_html/overblik.html", "utf8"), ht = fs.readFileSync(import.meta.dirname + "/../../public_html/htaccess.txt", "utf8");
t("rammen findes på siden (skjult, med knap, titel og iframe) og har en stil, der lægger den over det hele", /<div class="ramme-lag" id="rammeLag" hidden>[\s\S]*?id="rammeLuk">← Forsiden<\/button>[\s\S]*?id="rammeTitel"[\s\S]*?<iframe id="rammeIframe"/.test(ov) && /\.ramme-lag\{position:fixed;inset:0;z-index:3000;/.test(ov) && /\.ramme-lag\[hidden\]\{display:none\}/.test(ov));
t("opstarten bruger forsidens egne funktioner til at genopfriske (poll og tema) og springer temaet over, hvis enheden har valgt et eget", /rammeInit\(\{ \$, doc: document, fsElement, genopfrisk: \(\) => \{ Promise\.resolve\(poll\(\)\)\.catch\(\(\) => \{\}\); if \(!temaValg\) hentTema\(\); \} \}\);/.test(ov));
t("serveren tillader egne sider i en ramme (frame-ancestors 'self'), men ikke andres (ikke «*» og ikke andre værter)", /frame-ancestors 'self'(?:;|")/.test(ht) && !/frame-ancestors 'none'/.test(ht) && !/frame-ancestors[^;"]*\*/.test(ht) && /default-src 'self'/.test(ht) && !/frame-src/.test(ht));
process.exit(T.every(Boolean) ? 0 : 1);
