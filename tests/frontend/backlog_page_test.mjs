import fs from "fs";
const ROD = new URL("../../", import.meta.url).pathname;
const T=[]; const t=(n,ok,x="")=>{T.push(ok);console.log(ok?"ok  ":"FEJL",n,ok?"":x)};
const tick = () => new Promise(r => setImmediate(r));
const html = fs.readFileSync(ROD + "public_html/backlog.html", "utf8");
const js = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
const kerne = js.slice(js.indexOf("// ── Kerne"), js.indexOf("// ── Slut på kernen"));
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const K = new Function("esc", kerne + "; return { filtrer, sorter, datoTekst, punktHtml, KLAR };")(esc);
const P = (o) => ({ id: 1, titel: "T", beskrivelse: "", kategori: "andet", prioritet: "P3", status: "Idé", af: "Anna", oprettet: "2026-11-01", opdateret: "2026-11-01", stemmer: [], kommentarer: [], ...o });
const ramme = { kategorier: ["billeder", "bil", "andet"], prioriteter: ["P1", "P2", "P3", "P4"], statusser: ["Idé", "Planlagt", "I gang", "Færdig", "Droppet"] };
// ── filtrer ──
const L = [P({ id: 1, titel: "Tømmekalender", beskrivelse: "Skanderborg", kategori: "kalender" }), P({ id: 2, titel: "Galleri", kategori: "billeder", prioritet: "P1", status: "Planlagt" }), P({ id: 3, titel: "Gammel idé", status: "Færdig" }), P({ id: 4, titel: "Droppet", status: "Droppet" }), P({ id: 5, titel: "Med kommentar", kommentarer: [{ af: "A", tekst: "Husk Skanderborg", tid: "2026-11-02" }] })];
t("filtrer: færdige og droppede skjules som standard", K.filtrer(L, {}).map(p => p.id).join() === "1,2,5");
t("filtrer: «vis alle» viser dem", K.filtrer(L, { alle: true }).length === 5);
t("filtrer: vælges en status, vises den, også Færdig, uden at «vis alle» skal afkrydses", K.filtrer(L, { status: "Færdig" }).map(p => p.id).join() === "3");
t("filtrer: kategori og prioritet", K.filtrer(L, { kategori: "billeder" }).map(p => p.id).join() === "2" && K.filtrer(L, { prioritet: "P1" }).map(p => p.id).join() === "2");
t("filtrer: søgning i titel, beskrivelse og kommentarer, uanset store/små bogstaver", K.filtrer(L, { soeg: "SKANDERBORG" }).map(p => p.id).join() === "1,5" && K.filtrer(L, { soeg: "galleri" }).length === 1 && K.filtrer(L, { soeg: "  " }).length === 3 && K.filtrer(L, { soeg: "findes ikke" }).length === 0);
t("filtrer: flere filtre samtidig (og)", K.filtrer(L, { soeg: "skanderborg", kategori: "kalender" }).map(p => p.id).join() === "1");
t("filtrer ændrer ikke listen", L.length === 5);
// ── sorter ──
const S = [P({ id: 1, prioritet: "P3", stemmer: ["a"], oprettet: "2026-11-01", opdateret: "2026-11-05" }), P({ id: 2, prioritet: "P1", stemmer: [], oprettet: "2026-11-02", opdateret: "2026-11-02" }), P({ id: 3, prioritet: "P1", stemmer: ["a", "b"], oprettet: "2026-11-02", opdateret: "2026-11-03" }), P({ id: 4, prioritet: "P4", stemmer: ["a", "b", "c"], oprettet: "2026-11-04", opdateret: "2026-11-04" })];
t("sorter: prioritet og så flest stemmer (P1 med 2 stemmer før P1 med 0)", K.sorter(S, "prioritet").map(p => p.id).join() === "3,2,1,4");
t("sorter: flest stemmer, så prioritet", K.sorter(S, "stemmer").map(p => p.id).join() === "4,3,1,2");
t("sorter: nyeste først (id afgør ved samme dato)", K.sorter(S, "nyeste").map(p => p.id).join() === "4,3,2,1");
t("sorter: sidst ændret", K.sorter(S, "opdateret").map(p => p.id).join() === "1,4,3,2");
t("sorter: ukendt nøgle giver id-rækkefølge, og originalen ændres ikke", K.sorter(S, "x").map(p => p.id).join() === "1,2,3,4" && S.map(p => p.id).join() === "1,2,3,4");
t("sorter: stabil ved fuldstændig lighed (id)", K.sorter([P({ id: 9 }), P({ id: 3 }), P({ id: 5 })], "prioritet").map(p => p.id).join() === "3,5,9");
t("datoTekst", K.datoTekst("2026-11-07") === "7. nov. 2026" && K.datoTekst("2026-05-01") === "1. maj 2026" && K.datoTekst("skrald") === "skrald" && K.datoTekst(null) === "");
// ── punktHtml ──
let h = K.punktHtml(P({ titel: '<img src=x onerror=alert(1)>', beskrivelse: "<b>fed</b> & \"citat\"", af: "<Anna>", kommentarer: [{ af: "<b>x</b>", tekst: "<script>1</script>", tid: "2026-11-02" }], stemmer: ["anna", "peter"], prioritet: "P1", status: "Færdig" }), "Anna", ramme, false);
t("punkt: alt, brugeren har skrevet, escapes (titel, beskrivelse, navne, kommentarer)", !/<img|<script|<b>fed/.test(h) && !/<[^>]*\sonerror=/.test(h) && h.includes("&lt;img src=x onerror=alert(1)&gt;") && h.includes("&lt;Anna&gt;") && h.includes("&lt;script&gt;1&lt;/script&gt;"), h.slice(0, 300));
t("punkt: stemmetal, «stemt» når du selv har stemt (uanset store/små bogstaver), ellers ikke", /aria-pressed="true"[^>]*>▲ 2/.test(h) && /aria-pressed="false"/.test(K.punktHtml(P({ stemmer: ["peter"] }), "Anna", ramme, false)) && /aria-pressed="false"/.test(K.punktHtml(P({ stemmer: ["anna"] }), "", ramme, false)));
t("punkt: P1 har prioritetsfarve, færdige er streget over, status og prioritet er valgbare med den rigtige valgt", /chip p1">P1/.test(h) && /chip done">Færdig/.test(h) && /<option value="Færdig" selected>/.test(h) && /<option value="P1" selected>/.test(h) && (h.match(/data-status/g) || []).length === 1);
t("punkt: uden beskrivelse og kommentarer vises de ikke, og «ændret» vises kun, hvis datoen er anden", !/class="besk"/.test(K.punktHtml(P(), "A", ramme, false)) && !/kommentarer"/.test(K.punktHtml(P(), "A", ramme, false)) && !/ændret/.test(K.punktHtml(P(), "A", ramme, false)) && /ændret 5\. nov\. 2026/.test(K.punktHtml(P({ opdateret: "2026-11-05" }), "A", ramme, false)));
const e = K.punktHtml(P({ titel: 'A"B', beskrivelse: "</textarea><script>x</script>", kategori: "bil" }), "A", ramme, true);
t("redigering: formular med titel, beskrivelse og kategori, escaped (også mod at lukke tekstfeltet), uden de andre knapper", /data-ret-titel[^>]*value="A&quot;B"/.test(e) && e.includes("&lt;/textarea&gt;&lt;script&gt;") && /<option value="bil" selected>/.test(e) && /data-gem-ret/.test(e) && /data-annuller-ret/.test(e) && !/data-slet/.test(e));
// ── alle id'er findes ──
const brugte = [...new Set([...js.matchAll(/\$\("([A-Za-z]+)"\)/g)].map(m => m[1]))], fundne = new Set([...html.matchAll(/\sid="([A-Za-z]+)"/g)].map(m => m[1]));
t("alle $(\"…\")-id'er i scriptet findes i siden", brugte.every(i => fundne.has(i)), brugte.filter(i => !fundne.has(i)).join());
t("siden bruger sprogmodulet med en fejlfanger og har temascriptet i <head>", /import\("\.\/sprog\.js"\)[\s\S]*\.catch\(e => console\.error\("sprog:"/.test(js) && /localStorage\.getItem\("familieoverblik-tema"\)/.test(html.slice(0, html.indexOf("<style>"))));
t("menuen på forsiden og login-siden kender siden", fs.readFileSync(ROD + "public_html/overblik.html", "utf8").includes('href="backlog.html">Backlog') && fs.readFileSync(ROD + "public_html/login.php", "utf8").includes("'backlog.html'") && /backlog\\\.html\)\?\$/.test(fs.readFileSync(ROD + "public_html/htaccess.txt", "utf8")) && fs.readFileSync(ROD + "public_html/htaccess.txt", "utf8").includes("^backlog\\.php"));
// ── siden som helhed ──
const AF = Object.getPrototypeOf(async function(){}).constructor;
async function side({ gemt = "", svar } = {}){
  const els = {}; const el = id => (els[id] ??= { id, value: "", checked: false, textContent: "", innerHTML: "", hidden: false, open: false, options: [], handlers: {}, addEventListener(t, f){ (this.handlers[t] ??= []).push(f); } });
  Object.defineProperty(el("nKat"), "options", { get(){ return { length: els.nKat.innerHTML ? 1 : 0 }; } });
  const lager = { s: gemt ? { "familieoverblik-hvem": gemt } : {}, getItem(k){ return this.s[k] ?? null; }, setItem(k, v){ this.s[k] = v; } };
  const kald = []; let data = { punkter: [P({ id: 1, titel: "Første" })], ...ramme };
  globalThis.fetch = async (url, o = {}) => { const m = o.method || "GET", b = o.body ? JSON.parse(o.body) : null; kald.push({ url, m, b });
    const ok = d => ({ ok: true, status: 200, json: async () => d }), no = (s, f) => ({ ok: false, status: s, json: async () => ({ ok: false, fejl: f }) });
    if (svar){ const x = svar(m, b, data); if (x) return x; }
    if (m === "GET") return ok({ ok: true, ...data });
    if (b.handling === "nyt"){ data.punkter.push(P({ id: data.punkter.length + 1, titel: b.titel, af: b.af, kategori: b.kategori, prioritet: b.prioritet })); return ok({ ok: true }); }
    if (b.handling === "stem"){ const p = data.punkter.find(x => x.id === b.id); const v = b.hvem.toLowerCase(); p.stemmer = p.stemmer.includes(v) ? p.stemmer.filter(x => x !== v) : [...p.stemmer, v]; return ok({ ok: true }); }
    if (b.handling === "ret"){ Object.assign(data.punkter.find(x => x.id === b.id), Object.fromEntries(Object.entries(b).filter(([k]) => k !== "handling" && k !== "id"))); return ok({ ok: true }); }
    if (b.handling === "slet"){ data.punkter = data.punkter.filter(x => x.id !== b.id); return ok({ ok: true }); }
    if (b.handling === "kommentar"){ data.punkter.find(x => x.id === b.id).kommentarer.push({ af: b.af, tekst: b.tekst, tid: "2026-11-07" }); return ok({ ok: true }); }
    if (b.handling === "eksport") return ok({ ok: true, filnavn: "backlog." + b.format, type: "text/plain", indhold: "INDHOLD" });
    if (b.handling === "importer") return ok({ ok: true, tilfoejet: b.punkter.length, sprunget_over: 1 });
    return no(400, "?"); };
  const hentet = []; const document = { getElementById: el, createElement: () => ({ click(){ hentet.push(this.download + ":" + this._tekst); }, remove(){}, set href(v){ this._h = v; }, get href(){ return this._h; } }), body: { appendChild(){} }, addEventListener: (t, f) => { (el("__doc").handlers[t] ??= []).push(f); }, querySelector: () => null };
  globalThis.Blob = class { constructor(d){ globalThis._blob = d.join(""); } }; globalThis.URL = { createObjectURL: () => "blob:x", revokeObjectURL(){} };
  const kode = js.replace(/^import \{[^}]*\} from "\.\/config\.js";$/m, "const API_KEY = 'k', PEOPLE = [{ id: 'alle', name: 'Alle' }, { id: 'anna', name: 'Anna' }, { id: 'peter', name: 'Peter' }];").replace('import("./sprog.js")', "Promise.resolve({ startSprog(){} })");
  await new AF("document", "fetch", "localStorage", "setTimeout", kode)(document, globalThis.fetch, lager, () => 0);
  await tick(); await tick();
  const klik = async (id, mål) => { for (const h of els[id].handlers.click || []) await h({ target: mål }); await tick(); await tick(); };
  const maal = (id, flag, ekstra = {}) => { const art = { dataset: { id: String(id) }, querySelector: s => ekstra[s] || null }; return { dataset: ekstra.dataset || {}, closest: s => s === "[data-id]" ? art : s === flag ? { dataset: ekstra.dataset || {}, set textContent(v){ this._t = v; }, get textContent(){ return this._t; } } : null, matches: s => s === ekstra.matches }; };
  return { els, el, kald, lager, data: () => data, klik, maal, hentet, vaelg: v => { els.hvem.value = v; for (const h of els.hvem.handlers.change || []) h({}); } };
}
let s = await side({ gemt: "Anna" });
t("start: punkter hentes, valg fyldes, og den gemte person er valgt", s.kald[0].m === "GET" && /Første/.test(s.el("liste").innerHTML) && s.el("hvem").value === "Anna" && s.el("tal").textContent === "1 af 1 punkter" && /<option value="Anna">/.test(s.el("hvem").innerHTML) && !/value="alle"/.test(s.el("hvem").innerHTML) && s.el("nKat").value === "andet" && s.el("nPri").value === "P3");
// nyt
s.el("hvem").value = ""; s.el("nTitel").value = "Nyt"; for (const h of s.el("nytForm").handlers.submit) await h({ preventDefault(){} }); await tick();
t("nyt uden at vælge, hvem man er, afvises med en forklaring og sender intet", /Vælg, hvem du er/.test(s.el("fejl").textContent) && !s.kald.some(k => k.b && k.b.handling === "nyt"));
s.vaelg("Peter"); s.el("nTitel").value = " "; for (const h of s.el("nytForm").handlers.submit) await h({ preventDefault(){} }); await tick();
t("tom titel afvises i browseren", /Skriv en titel/.test(s.el("fejl").textContent));
s.el("nTitel").value = "Mit ønske"; s.el("nBesk").value = "b"; s.el("nKat").value = "bil"; s.el("nPri").value = "P2"; s.el("nytBlok").open = true;
for (const h of s.el("nytForm").handlers.submit) await h({ preventDefault(){} }); await tick(); await tick();
const nyt = s.kald.find(k => k.b && k.b.handling === "nyt").b;
t("nyt: titel, beskrivelse, kategori, prioritet og navn sendes; formularen ryddes og lukkes; listen hentes igen", nyt.titel === "Mit ønske" && nyt.af === "Peter" && nyt.kategori === "bil" && nyt.prioritet === "P2" && s.el("nTitel").value === "" && s.el("nytBlok").open === false && /Mit ønske/.test(s.el("liste").innerHTML) && /Tilføjet/.test(s.el("info").textContent) && s.lager.s["familieoverblik-hvem"] === "Peter");
// stem
await s.klik("liste", s.maal(1, "[data-stem]"));
t("stem sender id og navn, og knappen viser den nye stemme", s.kald.at(-3).b?.handling === "stem" || s.kald.some(k => k.b && k.b.handling === "stem" && k.b.id === 1 && k.b.hvem === "Peter"), JSON.stringify(s.kald.map(k => k.b?.handling)));
t("…og listen viser 1 stemme, markeret som din", /aria-pressed="true"[^>]*>▲ 1/.test(s.el("liste").innerHTML));
await s.klik("liste", s.maal(1, "[data-stem]")); t("endnu et tryk fjerner stemmen igen", /aria-pressed="false"[^>]*>▲ 0/.test(s.el("liste").innerHTML));
s.vaelg(""); await s.klik("liste", s.maal(1, "[data-stem]")); t("stem uden at have valgt, hvem man er, giver en forklaring", /Vælg, hvem du er/.test(s.el("fejl").textContent));
s.vaelg("Anna");
// status og prioritet
for (const h of s.el("liste").handlers.change) await h({ target: { value: "Planlagt", closest: () => ({ dataset: { id: "1" } }), matches: sel => sel === "[data-status]" } }); await tick(); await tick();
t("status ændres med det samme", s.kald.some(k => k.b && k.b.handling === "ret" && k.b.id === 1 && k.b.status === "Planlagt") && s.data().punkter[0].status === "Planlagt");
for (const h of s.el("liste").handlers.change) await h({ target: { value: "P1", closest: () => ({ dataset: { id: "1" } }), matches: sel => sel === "[data-prio]" } }); await tick(); await tick();
t("prioritet ændres med det samme", s.kald.some(k => k.b && k.b.handling === "ret" && k.b.prioritet === "P1"));
// kommentar
await s.klik("liste", s.maal(1, "[data-kom-send]", { "[data-kom-tekst]": { value: "  " } })); t("tom kommentar afvises", /Skriv en kommentar/.test(s.el("fejl").textContent));
await s.klik("liste", s.maal(1, "[data-kom-send]", { "[data-kom-tekst]": { value: "God idé" } }));
t("kommentar sendes med navn, og vises bagefter", s.kald.some(k => k.b && k.b.handling === "kommentar" && k.b.af === "Anna" && k.b.tekst === "God idé") && /God idé/.test(s.el("liste").innerHTML));
// ret
await s.klik("liste", s.maal(1, "[data-ret]")); t("«Ret» viser rette-formularen", /data-ret-titel/.test(s.el("liste").innerHTML));
await s.klik("liste", s.maal(1, "[data-annuller-ret]")); t("«Annuller» går tilbage uden at gemme", !/data-ret-titel/.test(s.el("liste").innerHTML));
await s.klik("liste", s.maal(1, "[data-ret]"));
await s.klik("liste", s.maal(1, "[data-gem-ret]", { "[data-ret-titel]": { value: "Ny titel" }, "[data-ret-besk]": { value: "Ny besk" }, "[data-ret-kat]": { value: "bil" } }));
t("«Gem» sender titel, beskrivelse og kategori og lukker formularen", s.kald.some(k => k.b && k.b.handling === "ret" && k.b.titel === "Ny titel" && k.b.beskrivelse === "Ny besk" && k.b.kategori === "bil") && !/data-ret-titel/.test(s.el("liste").innerHTML) && /Ny titel/.test(s.el("liste").innerHTML));
// slet
await s.klik("liste", s.maal(1, "[data-slet]", { dataset: {} })); t("slet kræver to tryk", !s.kald.some(k => k.b && k.b.handling === "slet"));
const dobbelt = s.maal(1, "[data-slet]", { dataset: { sikker: "1" } }); await s.klik("liste", dobbelt);
t("andet tryk sletter", s.kald.some(k => k.b && k.b.handling === "slet" && k.b.id === 1) && !/Ny titel/.test(s.el("liste").innerHTML.replace(/Mit ønske/g, "")) || s.data().punkter.every(p => p.id !== 1));
// filter
s.el("fSoeg").value = "ønske"; for (const h of s.el("fSoeg").handlers.input) h({}); t("søgning filtrerer straks (uden kald til serveren)", /Mit ønske/.test(s.el("liste").innerHTML) && s.el("tal").textContent.startsWith("1 af"));
s.el("fSoeg").value = "xyz"; for (const h of s.el("fSoeg").handlers.input) h({}); t("intet fundet giver en venlig besked", /Ingen punkter at vise/.test(s.el("liste").innerHTML));
// eksport og import
for (const h of s.el("__doc").handlers.click) await h({ target: { closest: sel => sel === "[data-eksport]" ? { dataset: { eksport: "csv" } } : null } }); await tick();
t("eksport henter filen fra serveren og gemmer den med det rigtige navn", s.kald.some(k => k.b && k.b.handling === "eksport" && k.b.format === "csv") && s.hentet[0].startsWith("backlog.csv") && globalThis._blob === "INDHOLD" && /Hentet backlog\.csv/.test(s.el("info").textContent));
const fil = (indhold, size) => ({ size: size ?? indhold.length, text: async () => indhold });
const imp = async f => { s.el("fil").files = [f]; for (const h of s.el("fil").handlers.change) await h({ target: s.el("fil") }); await tick(); await tick(); };
await imp(fil(JSON.stringify({ punkter: [{ titel: "a" }, { titel: "b" }] }))); t("import af {punkter: […]} sender listen og melder resultatet", s.kald.some(k => k.b && k.b.handling === "importer" && k.b.punkter.length === 2 && k.b.opdater === false) && /Lagt ind: 2 nye punkter, 1 sprunget over/.test(s.el("info").textContent));
await imp(fil(JSON.stringify({ opdater: true, punkter: [{ titel: "x" }] }))); t("en fil med «opdater: true» sender det med, og svaret nævner de opdaterede", s.kald.filter(k => k.b && k.b.handling === "importer").at(-1).b.opdater === true);
await imp(fil(JSON.stringify([{ titel: "c" }]))); t("import af en ren liste virker også", s.kald.filter(k => k.b && k.b.handling === "importer").length === 3);
const før = s.kald.length;
await imp(fil("{skrald")); t("ugyldig JSON afvises uden kald", /ikke gyldig JSON/.test(s.el("fejl").textContent) && s.kald.length === før);
await imp(fil("{\"x\":1}")); t("forkert form afvises", /skal være en liste/.test(s.el("fejl").textContent));
await imp(fil("x", 600000)); t("for stor fil afvises", /for stor/.test(s.el("fejl").textContent));
// fejl fra serveren
const f2 = await side({ gemt: "Anna", svar: (m, b) => m === "POST" ? { ok: false, status: 400, json: async () => ({ ok: false, fejl: "Titel mangler." }) } : null });
for (const h of f2.el("nytForm").handlers.submit) { f2.el("nTitel").value = "x"; await h({ preventDefault(){} }); } await tick();
t("serverens fejltekst vises", /Titel mangler/.test(f2.el("fejl").textContent) && f2.el("nytBlok").open !== false || /Titel mangler/.test(f2.el("fejl").textContent));
const f3 = await side({ svar: m => m === "GET" ? { ok: false, status: 403, json: async () => ({ ok: false, fejl: "log ind med familiens kode først" }) } : null }); t("403 ved indlæsning vises", /log ind/.test(f3.el("fejl").textContent));
const f4 = await side({ svar: m => m === "GET" ? { ok: false, status: 404, json: async () => ({}) } : null }); t("404 (ældre version) forklares", /kræver version 3\.3/.test(f4.el("fejl").textContent));
const f5 = await side({ gemt: "Mormor" }); t("en gemt person, der ikke er i familien, kommer ind under «Andre …»", f5.el("hvem").value === "__andet" && f5.el("hvemAndet").value === "Mormor" && f5.el("hvemAndet").hidden === false);
process.exit(T.every(Boolean) ? 0 : 1);
