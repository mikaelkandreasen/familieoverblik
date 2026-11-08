import fs from "fs";
const T=[]; const t=(n,ok,x="")=>{T.push(ok);console.log(ok?"ok  ":"FEJL",n,ok?"":x)};
const tick = () => new Promise(r => setImmediate(r));
const src = fs.readFileSync("/tmp/start_page.mjs","utf8");
const kerne = src.slice(src.indexOf("// ── Kerne"), src.indexOf("// ── Slut på kernen"));
const K = new Function("crypto", kerne + "; return { bygPayload, tilfaeldigPin, fdNorm, raekkerHtml, tomPerson, MAX_VOKSNE, MAX_BOERN };")(globalThis.crypto);
const ok = { kode: " k7m2-x9pq ", voksne: [{ navn: "Anna", fd: "14.3.1985" }, { navn: "", fd: "" }], boern: [{ navn: "Sofie", fd: "09.06.2015", cid: "12345" }, { navn: "", fd: "", cid: "" }], tema: true, pin: "4711", lat: "56,1629", lon: "10.2039", tz: "", mitid: "", anthropic: "" };
let r = K.bygPayload(ok);
t("gyldige felter: trimmet kode, tomme rækker droppes, fødselsdag normaliseres, calendar_id er tal, komma som decimaltegn, standardtidszone", !r.fejl && r.payload.kode === "k7m2-x9pq" && JSON.stringify(r.payload.sv) === '{"voksne":[{"navn":"Anna","foedselsdag":"14.03.1985"}],"boern":[{"navn":"Sofie","foedselsdag":"09.06.2015","calendar_id":12345}],"fodselsdagstema":true}' && r.payload.sted.lat === 56.1629 && r.payload.sted.tidszone === "Europe/Copenhagen", JSON.stringify(r));
t("tema slået fra sendes som false", K.bygPayload({ ...ok, tema: false }).payload.sv.fodselsdagstema === false);
t("tomme forbindelser sendes ikke med", !("hemmeligheder" in r.payload));
r = K.bygPayload({ ...ok, mitid: " mig ", anthropic: "sk-ant-x" }); t("udfyldte forbindelser sendes med, trimmet", r.payload.hemmeligheder.mitid_brugernavn === "mig" && r.payload.hemmeligheder.anthropic_noegle === "sk-ant-x");
const mange = (n, barn) => Array.from({ length: n }, (_, i) => barn ? { navn: `B${i}`, fd: "", cid: "" } : { navn: `V${i}`, fd: "" });
t("4 voksne og 8 børn er tilladt", !K.bygPayload({ ...ok, voksne: mange(4), boern: mange(8, true) }).fejl);
t("5 voksne eller 9 børn afvises", /Højst 4 voksne/.test(K.bygPayload({ ...ok, voksne: mange(5) }).fejl) && /Højst 8 børn/.test(K.bygPayload({ ...ok, boern: mange(9, true) }).fejl));
const fejl = (andet, tekst) => { const x = K.bygPayload({ ...ok, ...andet }); return !!x.fejl && (!tekst || x.fejl.includes(tekst)); };
t("fejl: ingen voksen, intet barn, rækker uden navn men med data", fejl({ voksne: [{ navn: " ", fd: "" }] }, "mindst én voksen") && fejl({ boern: [{ navn: "", fd: "", cid: "" }] }, "mindst ét barn") && fejl({ boern: [{ navn: "", fd: "", cid: "55" }] }, "intet navn") && fejl({ voksne: [{ navn: "", fd: "14.03" }] }, "intet navn"));
t("fejl: calendar_id ikke et tal", fejl({ boern: [{ navn: "Sofie", fd: "", cid: "abc" }] }, "helt tal") && fejl({ boern: [{ navn: "Sofie", fd: "", cid: "-1" }] }, "helt tal"));
t("fejl: samme navn (også store/små bogstaver) og «Alle»", fejl({ voksne: [{ navn: "Anna", fd: "" }], boern: [{ navn: "anna", fd: "", cid: "" }] }, "samme navn") && fejl({ voksne: [{ navn: "ALLE", fd: "" }] }, "Alle"));
t("fejl: PIN", fejl({ pin: "123" }, "4 til 8") && fejl({ pin: "123456789" }, "4 til 8") && fejl({ pin: "12a4" }, "4 til 8") && !fejl({ pin: "12345678" }));
t("fejl: sted", fejl({ lat: "91" }, "Breddegrad") && fejl({ lon: "181" }, "længdegrad") && fejl({ lat: "x" }, "tal") && fejl({ lat: "" }, "tal") && !fejl({ lat: "-90", lon: "-180" }));
t("fejl: opsætningskode mangler", fejl({ kode: "  " }, "opsætningskoden"));
// fødselsdage
for (const [x, v] of [["14.03", "14.03"], ["1.3", "01.03"], ["14-03-1985", "14.03.1985"], ["14/3/1985", "14.03.1985"], ["29.02", "29.02"], ["29.02.2000", "29.02.2000"], ["", ""], ["  ", ""], [null, ""]]) t(`fødselsdag ${JSON.stringify(x)} → ${JSON.stringify(v)}`, K.fdNorm(x).v === v, JSON.stringify(K.fdNorm(x)));
for (const [x, tekst] of [["31.02", "findes ikke"], ["29.02.2001", "findes ikke"], ["32.01", "findes ikke"], ["14.13", "findes ikke"], ["14.03.1850", "1900"], ["14.03.2999", "fremtiden"], ["i går", "dd.mm"], ["14.03.85", "dd.mm"], ["1985-03-14", "dd.mm"]]) t(`ugyldig fødselsdag ${JSON.stringify(x)}`, (K.fdNorm(x).fejl || "").includes(tekst), JSON.stringify(K.fdNorm(x)));
t("fødselsdag i dag eller tidligere i år er gyldig, senere i år afvises", (() => { const n = new Date(), d = new Date(n.getFullYear(), n.getMonth(), n.getDate()); const f = `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${n.getFullYear()}`; const imorgen = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1); const g = `${String(imorgen.getDate()).padStart(2, "0")}.${String(imorgen.getMonth() + 1).padStart(2, "0")}.${imorgen.getFullYear()}`; return !K.fdNorm(f).fejl && (imorgen.getFullYear() > n.getFullYear() || !!K.fdNorm(g).fejl); })());
t("fejl i en fødselsdag nævner personen", /Fødselsdag for Sofie: den dato findes ikke/.test(K.bygPayload({ ...ok, boern: [{ navn: "Sofie", fd: "31.02", cid: "" }] }).fejl));
// række-HTML
const h = K.raekkerHtml([{ navn: 'A"<b>', fd: "1&2", cid: "" }], "boern");
t("rækker: navne og datoer escapes, børn har calendar_id, og en enlig række har ingen fjern-knap", h.includes('value="A&quot;&lt;b&gt;"') && h.includes('value="1&amp;2"') && /data-f="cid"/.test(h) && !/data-fjern/.test(h));
const h2 = K.raekkerHtml([{ navn: "A", fd: "" }, { navn: "B", fd: "" }], "voksne");
t("rækker: voksne har ikke calendar_id, flere rækker giver fjern-knapper, og placeholder viser nummer og «valgfri»", !/data-f="cid"/.test(h2) && (h2.match(/data-fjern/g) || []).length === 2 && /placeholder="Voksen 2 \(valgfri\)"/.test(h2) && /placeholder="Voksen 1"/.test(h2) && /data-lst="voksne" data-i="1"/.test(h2));
{ const p = K.tilfaeldigPin(6); t("tilfældig PIN: 6 cifre", /^\d{6}$/.test(p)); const set = new Set(Array.from({ length: 50 }, () => K.tilfaeldigPin(6))); t("…og den er ikke den samme hver gang", set.size > 40);
  const fast = vals => { let i = 0; return { getRandomValues(a){ a[0] = vals[i++ % vals.length]; } }; };
  t("tilfældig PIN: værdier fra og med grænsen afvises (ingen skævhed)", K.tilfaeldigPin(2, fast([4294967295, 4294967290, 7, 3])) === "73"); }
// ── siden ──
const AF = Object.getPrototypeOf(async function(){}).constructor;
async function side(svar){
  const els = {}; const el = id => (els[id] ??= { id, value: "", checked: id === "fdTema", textContent: "", innerHTML: "", hidden: false, disabled: false, handlers: {}, addEventListener(t, f){ (this.handlers[t] ??= []).push(f); } });
  ["faerdig"].forEach(i => { el(i).hidden = true; });
  const kald = []; let adresse = "";
  globalThis.location = { set href(v){ adresse = v; } };
  const fetch = async (url, o) => { kald.push({ url, m: o.method, b: JSON.parse(o.body) }); const x = svar(url); return { ok: x.status < 400, status: x.status, json: async () => x.data }; };
  await new AF("document", "fetch", "crypto", src.replace(/^import .*$/mg, ""))({ getElementById: el }, fetch, globalThis.crypto);
  const udfyld = (v) => { for (const [k, x] of Object.entries(v)) el(k).value = x; };
  const send = async () => { for (const h of els.form.handlers.submit) await h({ preventDefault(){} }); await tick(); };
  // skriv i rækken: simulér at brugeren taster i inputfeltet (delegeret input-hændelse)
  const skriv = (lst, i, felt, v) => { const r = { dataset: { lst, i: String(i) } }; for (const h of els[lst].handlers.input) h({ target: { dataset: { f: felt }, value: v, closest: () => r } }); };
  const fjern = (lst, i) => { const r = { dataset: { lst, i: String(i) } }; for (const h of els[lst].handlers.click) h({ target: { closest: s => s === "[data-fjern]" ? { closest: () => r } : null } }); };
  return { el, kald, udfyld, send, skriv, fjern, adresse: () => adresse, klik: async id => { for (const h of els[id].handlers.click) await h({}); await tick(); } };
}
const felter = { kode: "K7M2X9PQ", pin: "4711", lat: "56.16", lon: "10.2", tz: "Europe/Copenhagen", mitid: "", anthropic: "" };
let s = await side(() => ({ status: 200, data: { ok: true, foerste: true, pin: "4711" } }));
t("ved start: én række voksen og ét barn, tilføj-knapperne er slået til", (s.el("voksne").innerHTML.match(/class="pers/g) || []).length === 1 && (s.el("boern").innerHTML.match(/class="pers/g) || []).length === 1 && s.el("tilfoejVoksen").disabled === false);
await s.klik("tilfoejVoksen"); await s.klik("tilfoejVoksen"); await s.klik("tilfoejVoksen");
t("tilføj voksen: op til 4, og så slås knappen fra", (s.el("voksne").innerHTML.match(/class="pers/g) || []).length === 4 && s.el("tilfoejVoksen").disabled === true);
await s.klik("tilfoejVoksen"); t("en femte voksen kan ikke tilføjes", (s.el("voksne").innerHTML.match(/class="pers/g) || []).length === 4);
for (let i = 0; i < 7; i++) await s.klik("tilfoejBarn");
t("tilføj barn: op til 8, og så slås knappen fra", (s.el("boern").innerHTML.match(/class="pers/g) || []).length === 8 && s.el("tilfoejBarn").disabled === true);
s.fjern("voksne", 3); s.fjern("voksne", 2); s.fjern("voksne", 1);
t("fjern: rækkerne forsvinder, og tilføj-knappen er slået til igen; den sidste række kan ikke fjernes", (s.el("voksne").innerHTML.match(/class="pers/g) || []).length === 1 && !/data-fjern/.test(s.el("voksne").innerHTML) && s.el("tilfoejVoksen").disabled === false);
s = await side(() => ({ status: 200, data: { ok: true, foerste: true, pin: "4711" } }));
s.udfyld(felter); await s.klik("tilfoejVoksen"); await s.klik("tilfoejBarn");
s.skriv("voksne", 0, "navn", "Anna"); s.skriv("voksne", 0, "fd", "14.03.1985"); s.skriv("voksne", 1, "navn", "Peter");
s.skriv("boern", 0, "navn", "Sofie"); s.skriv("boern", 0, "fd", "9.6.2015"); s.skriv("boern", 0, "cid", "123"); s.skriv("boern", 1, "navn", "Emil");
await s.send();
t("guiden sender til instans.php?action=start som POST med personer, fødselsdage og tema", s.kald.length === 1 && s.kald[0].url === "instans.php?action=start" && s.kald[0].m === "POST" && JSON.stringify(s.kald[0].b.sv) === '{"voksne":[{"navn":"Anna","foedselsdag":"14.03.1985"},{"navn":"Peter","foedselsdag":""}],"boern":[{"navn":"Sofie","foedselsdag":"09.06.2015","calendar_id":123},{"navn":"Emil","foedselsdag":"","calendar_id":0}],"fodselsdagstema":true}', JSON.stringify(s.kald[0]?.b?.sv));
t("færdig: formularen skjules og PIN vises", s.el("form").hidden === true && s.el("faerdig").hidden === false && s.el("visPin").textContent === "4711");
await s.klik("gaa"); t("«Åbn oversigten» sender til overblik.html", s.adresse() === "overblik.html");
s = await side(() => ({ status: 200, data: { ok: true } })); s.udfyld(felter); s.skriv("voksne", 0, "navn", "Anna"); s.skriv("boern", 0, "navn", "Sofie"); s.el("fdTema").checked = false; await s.send();
t("tema fravalgt sendes som false, og indtastet PIN vises, hvis serveren ikke sender den", s.kald[0].b.sv.fodselsdagstema === false && s.el("visPin").textContent === "4711");
s = await side(() => ({ status: 200, data: { ok: true } })); s.udfyld(felter); s.skriv("voksne", 0, "navn", "Anna"); s.skriv("voksne", 0, "fd", "31.02"); s.skriv("boern", 0, "navn", "Sofie"); await s.send();
t("ugyldig fødselsdag stopper, før noget sendes, og nævner personen", s.kald.length === 0 && /Fødselsdag for Anna/.test(s.el("fejl").textContent), s.el("fejl").textContent);
s = await side(() => ({ status: 400, data: { ok: false, fejl: "Opsætningskoden er forkert. Den står i containerens log." } })); s.udfyld(felter); s.skriv("voksne", 0, "navn", "Anna"); s.skriv("boern", 0, "navn", "Sofie"); await s.send();
t("serverens fejl vises, og formularen bliver stående", /Opsætningskoden er forkert/.test(s.el("fejl").textContent) && s.el("form").hidden !== true && s.el("faerdig").hidden === true);
s = await side(() => ({ status: 404, data: null })); s.udfyld(felter); s.skriv("voksne", 0, "navn", "Anna"); s.skriv("boern", 0, "navn", "Sofie"); await s.send(); t("404 = serveren er ikke klar", /ikke klar endnu/.test(s.el("fejl").textContent));
s = await side(() => ({ status: 200, data: { ok: true } })); await s.klik("pinLav"); t("«Lav en tilfældig» fylder PIN-feltet", /^\d{6}$/.test(s.el("pin").value));
process.exit(T.every(Boolean) ? 0 : 1);
