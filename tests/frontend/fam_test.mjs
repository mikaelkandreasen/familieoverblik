import fs from "fs";
const T=[]; const t=(n,ok,x="")=>{T.push(ok);console.log(ok?"ok  ":"FEJL",n,ok?"":x)};
const tick = () => new Promise(r => setImmediate(r));
const kode = fs.readFileSync("/tmp/fam_block.js","utf8");
const mk = () => { const els = {}; const el = id => (els[id] ??= { id, value:"", checked:false, textContent:"", placeholder:"", hidden:false, disabled:false, dataset:{}, handlers:{}, files:null, addEventListener(t,f){ (this.handlers[t] ??= []).push(f); } }); return { els, el }; };
const fyr = async (e, type, ev = {}) => { for (const f of e.handlers[type] || []) await f({ preventDefault(){}, target: e, ...ev }); await tick(); await tick(); };
const visning = { opsat: true, sv: { voksne: [{ navn: "Anna", foedselsdag: "14.03.1985" }, { navn: "Peter", foedselsdag: "" }], boern: [{ navn: "Sofie", calendar_id: 12345, foedselsdag: "09.06.2015" }, { navn: "Emil", calendar_id: 0, foedselsdag: "" }], fodselsdagstema: true }, sted: { lat: 55.4, lon: 10.4, tidszone: "Europe/Copenhagen" },
  hemmeligheder: { mitid_brugernavn: "anna-mitid", anthropic_noegle: null, aula_model: "claude-opus-5-5", hyundai_bruger: "mig@x.dk", hyundai_kode: null, hyundai_pin: null, hyundai_vin: "" },
  sat: { anthropic_noegle: true, hyundai_kode: true, hyundai_pin: false, mitid_brugernavn: true, aula_model: true, hyundai_bruger: true, hyundai_vin: false }, pin_laengde: 6 };
const skriv = (e, lst, i, felt, v) => { const r = { dataset: { lst, i: String(i) } }; for (const h of e.els[lst === "voksne" ? "famVoksne" : "famBoern"].handlers.input) h({ target: { dataset: { f: felt }, value: v, closest: () => r } }); };
const fjern = (e, lst, i) => { const r = { dataset: { lst, i: String(i) } }; for (const h of e.els[lst === "voksne" ? "famVoksne" : "famBoern"].handlers.click) h({ target: { closest: sel => sel === "[data-fjern]" ? { closest: () => r } : null } }); };
const rk = (html) => (html.match(/class="fam-pers/g) || []).length;
async function side({ svar, hent, gendan } = {}){
  const { els, el } = mk(); const kald = []; const hentet = [];
  globalThis.fetch = async (url, o = {}) => { const m = o.method || "GET"; kald.push({ url, m, b: o.body && typeof o.body === "string" ? JSON.parse(o.body) : o.body });
    const ok = d => ({ ok: true, status: 200, json: async () => d, blob: async () => ({ size: 5 }) }), no = (s, d) => ({ ok: false, status: s, json: async () => d });
    if (url === "instans.php" && m === "GET") return svar ? svar() : ok(visning);
    if (url === "instans.php" && m === "POST") return svar ? svar(true) : ok({ ok: true, foerste: false, pin: null });
    if (url === "sikkerhedskopi.php" && m === "GET") return hent ? hent() : ok({});
    if (url === "sikkerhedskopi.php" && m === "POST") return gendan ? gendan() : ok({ ok: true, filer: 12, sprunget_over: 1, instans_gendannet: false });
    return no(404, {}); };
  globalThis.FormData = class { constructor(){ this.d = []; } append(k, v){ this.d.push([k, v]); } };
  const document = { createElement: () => ({ click(){ hentet.push(this.download); }, remove(){}, set href(v){ this._h = v; }, get href(){ return this._h; } }), body: { appendChild(){} } };
  globalThis.URL = { createObjectURL: () => "blob:x", revokeObjectURL(){} };
  const esc = x => String(x ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  new Function("$", "HEAD", "document", "setTimeout", "esc", kode)(el, { "X-Ugeplan-Key": "k" }, document, () => 0, esc);
  await tick(); await tick(); await tick();
  return { els, el, kald, hentet };
}
let s = await side();
t("sektionen vises med rækker for voksne og børn: navne, fødselsdage og calendar_id (0 vises som tomt)", s.els.famSek.hidden === false && rk(s.el("famVoksne").innerHTML) === 2 && rk(s.el("famBoern").innerHTML) === 2 && /value="Anna"/.test(s.el("famVoksne").innerHTML) && /value="14\.03\.1985"/.test(s.el("famVoksne").innerHTML) && /value="Sofie"/.test(s.el("famBoern").innerHTML) && /value="09\.06\.2015"/.test(s.el("famBoern").innerHTML) && /value="12345"/.test(s.el("famBoern").innerHTML) && (s.el("famBoern").innerHTML.match(/data-f="cid" inputmode="numeric" autocomplete="off" value=""/g) || []).length === 1);
t("sted, åbne forbindelser og tema vises", s.el("famLat").value === "55.4" && s.el("famTz").value === "Europe/Copenhagen" && s.el("famMitid").value === "anna-mitid" && s.el("famHBruger").value === "mig@x.dk" && s.el("famModel").value === "claude-opus-5-5" && s.el("famFdTema").checked === true);
t("nøgler vises ALDRIG i felterne, kun et «gemt»-tegn i placeholder", s.el("famAnth").value === "" && s.el("famAnth").placeholder.includes("gemt") && s.el("famHKode").placeholder.includes("gemt") && s.el("famHPin").placeholder === "");
// ingen ændringer → nøglerne sendes ikke
await fyr(s.els.famForm, "submit");
let p = s.kald.find(k => k.m === "POST").b;
t("gem uden at røre nøglerne sender INGEN nøgler (de beholdes på serveren)", !("anthropic_noegle" in p.hemmeligheder) && !("hyundai_kode" in p.hemmeligheder) && !("hyundai_pin" in p.hemmeligheder) && !("pin" in p), JSON.stringify(p.hemmeligheder));
t("…men personer med fødselsdage, tema, sted og åbne forbindelser sendes som de står", JSON.stringify(p.sv) === '{"voksne":[{"navn":"Anna","foedselsdag":"14.03.1985"},{"navn":"Peter","foedselsdag":""}],"boern":[{"navn":"Sofie","calendar_id":"12345","foedselsdag":"09.06.2015"},{"navn":"Emil","calendar_id":"0","foedselsdag":""}],"fodselsdagstema":true}' && p.sted.lat === "55.4" && p.hemmeligheder.mitid_brugernavn === "anna-mitid" && p.hemmeligheder.hyundai_vin === "", JSON.stringify(p.sv));
t("bekræftelse med påmindelse om at genindlæse", /Gemt\. Genindlæs siderne/.test(s.el("famInfo").textContent) && !/PIN-kode skal/.test(s.el("famInfo").textContent));
// ændringer
s.el("famAnth").value = " sk-ant-NY "; s.el("famHKodeFjern").checked = true; s.el("famPin").value = "9999"; fjern(s, "voksne", 1); s.el("famLat").value = "55,5"; s.el("famMitid").value = ""; s.el("famFdTema").checked = false;
await fyr(s.els.famForm, "submit");
p = s.kald.filter(k => k.m === "POST").at(-1).b;
t("en skrevet nøgle sendes (trimmet), «fjern» sender tom streng, tomme åbne felter ryddes, ny PIN sendes, en fjernet voksen og tema fra", p.hemmeligheder.anthropic_noegle === "sk-ant-NY" && p.hemmeligheder.hyundai_kode === "" && p.hemmeligheder.mitid_brugernavn === "" && p.pin === "9999" && p.sv.voksne.map(v => v.navn).join() === "Anna" && p.sted.lat === "55.5" && p.sv.fodselsdagstema === false);
t("ny PIN: besked om at skrive den på hver enhed", /PIN-kode skal skrives/.test(s.el("famInfo").textContent));
t("efter gem hentes indstillingerne igen, og nøglefelterne er tomme", s.el("famAnth").value === "" && s.el("famPin").value === "");
// personer: tilføj, ret, fjern
s = await side();
t("tilføj-knapperne er slået til ved 2 voksne og 2 børn", s.el("famTilfoejVoksen").disabled === false && s.el("famTilfoejBarn").disabled === false);
for (let i = 0; i < 2; i++) await fyr(s.els.famTilfoejVoksen, "click"); for (let i = 0; i < 6; i++) await fyr(s.els.famTilfoejBarn, "click");
t("op til 4 voksne og 8 børn, og så slås knapperne fra", rk(s.el("famVoksne").innerHTML) === 4 && rk(s.el("famBoern").innerHTML) === 8 && s.el("famTilfoejVoksen").disabled === true && s.el("famTilfoejBarn").disabled === true);
await fyr(s.els.famTilfoejVoksen, "click"); t("en femte voksen kan ikke tilføjes", rk(s.el("famVoksne").innerHTML) === 4);
fjern(s, "boern", 7); t("fjern fjerner rækken, og knappen kan bruges igen", rk(s.el("famBoern").innerHTML) === 7 && s.el("famTilfoejBarn").disabled === false);
skriv(s, "voksne", 2, "navn", " Mormor "); skriv(s, "voksne", 2, "fd", "01.01.1950"); skriv(s, "boern", 2, "navn", "Lise"); skriv(s, "boern", 2, "cid", " 77 "); skriv(s, "boern", 2, "fd", "29.02");
await fyr(s.els.famForm, "submit"); p = s.kald.filter(k => k.m === "POST").at(-1).b;
t("nye personer sendes (tomme rækker droppes, mellemrum trimmes, tomt calendar_id bliver «0»)", p.sv.voksne.length === 3 && p.sv.voksne[2].navn === "Mormor" && p.sv.voksne[2].foedselsdag === "01.01.1950" && p.sv.boern.length === 3 && p.sv.boern[2].calendar_id === "77" && p.sv.boern[2].foedselsdag === "29.02" && p.sv.boern[1].calendar_id === "0", JSON.stringify(p.sv));
t("navne escapes i rækkerne", (() => { skriv(s, "voksne", 0, "navn", 'A"<b>'); return true; })() && !/A"<b>/.test(s.el("famVoksne").innerHTML));
// fejl
const s2 = await side({ svar: post => post ? { ok: false, status: 400, json: async () => ({ ok: false, fejl: "To personer må ikke have samme navn." }) } : { ok: true, status: 200, json: async () => visning } });
await fyr(s2.els.famForm, "submit"); t("serverens fejl vises, og intet «Gemt»", /samme navn/.test(s2.els.famFejl.textContent) && s2.els.famInfo.textContent === "");
const s3 = await side({ svar: () => ({ ok: false, status: 404, json: async () => ({}) }) }); t("404 (version 2) skjuler sektionen", s3.els.famSek.hidden === true);
const s4 = await side({ svar: () => ({ ok: false, status: 403, json: async () => ({ ok: false, fejl: "log ind med familiens kode først" }) }) }); t("403 skjuler sektionen", s4.els.famSek.hidden === true);
// sikkerhedskopi
s = await side();
await fyr(s.els.skHent, "click");
t("Hent sikkerhedskopi: kalder sikkerhedskopi.php med nøglen og gemmer en tar.gz med datoen", s.kald.some(k => k.url === "sikkerhedskopi.php" && k.m === "GET") && /^familieoverblik-sikkerhedskopi-\d{4}-\d{2}-\d{2}\.tar\.gz$/.test(s.hentet[0] || "") && /Hentet/.test(s.el("skInfo").textContent) && s.el("skFejl").textContent === "", s.hentet.join());
s.el("skFil").files = [{ name: "k.zip" }]; await fyr(s.els.skFil, "change"); t("Gendan slås til, når en fil er valgt", s.el("skGendan").disabled === false);
await fyr(s.els.skGendan, "click");
t("Gendan kræver to tryk (det overskriver filer)", /Tryk igen/.test(s.el("skGendan").textContent) && !s.kald.some(k => k.m === "POST" && k.url === "sikkerhedskopi.php"));
await fyr(s.els.skGendan, "click");
const up = s.kald.find(k => k.m === "POST" && k.url === "sikkerhedskopi.php");
t("andet tryk sender filen som formulardata (felt «fil») med nøglen", up && up.b.d[0][0] === "fil" && up.b.d[0][1].name === "k.zip" && /Lagt ind: 12 filer \(1 sprunget over\)/.test(s.el("skInfo").textContent), s.el("skInfo").textContent);
const sf = await side({ hent: () => ({ ok: false, status: 403, json: async () => ({ ok: false, fejl: "log ind med familiens kode først" }) }) }); await fyr(sf.els.skHent, "click");
t("fejl ved hentning vises", /log ind/.test(sf.el("skFejl").textContent) && sf.hentet.length === 0);
const sg = await side({ gendan: () => ({ ok: true, status: 200, json: async () => ({ ok: true, filer: 3, sprunget_over: 0, instans_gendannet: true, advarsel: "x var ugyldig" }) }) });
sg.el("skFil").files = [{ name: "a.tgz" }]; await fyr(sg.els.skFil, "change"); await fyr(sg.els.skGendan, "click"); await fyr(sg.els.skGendan, "click");
t("gendannede indstillinger og en advarsel fra serveren vises", /Indstillinger, nøgler og PIN er gendannet/.test(sg.el("skInfo").textContent) && /x var ugyldig/.test(sg.el("skInfo").textContent), sg.el("skInfo").textContent);
const sh = await side({ gendan: () => ({ ok: false, status: 400, json: async () => ({ ok: false, fejl: "Filen er hverken en zip eller en tar.gz." }) }) });
sh.el("skFil").files = [{ name: "x" }]; await fyr(sh.els.skFil, "change"); await fyr(sh.els.skGendan, "click"); await fyr(sh.els.skGendan, "click");
t("fejl ved gendannelse vises", /hverken en zip/.test(sh.el("skFejl").textContent) && sh.el("skInfo").textContent === "");
// ── Hvem må se forsiden? (åben visning) ──
{
  let adgang = undefined;
  const svar = post => post ? (adgang === "FEJL" ? { ok: false, status: 400, json: async () => ({ ok: false, fejl: "Adgangen skal være «laast» eller «aaben_visning»." }) } : { ok: true, status: 200, json: async () => ({ ok: true }) }) : { ok: true, status: 200, json: async () => ({ ...visning, adgang: adgang === "FEJL" ? "laast" : adgang }) };
  adgang = undefined; let a = await side({ svar });
  t("en server uden «adgang» (ældre svar) giver standarden «laast»: valget er synligt, forklaringen siger, at alt kræver PIN", a.els.adgSek.hidden === false && a.els.adgangValg.value === "laast" && /Alt kræver PIN-koden/.test(a.els.adgangNote.textContent));
  adgang = "aaben_visning"; a = await side({ svar });
  t("står serveren i åben visning, vises det, og forklaringen advarer om, hvad det betyder (alle på netværket, afkrydsninger, læsenøglen, kun et netværk du stoler på)", a.els.adgangValg.value === "aaben_visning" && /Alle på netværket kan se forsiden uden PIN-kode/.test(a.els.adgangNote.textContent) && /læsenøglen står åbent/.test(a.els.adgangNote.textContent) && /netværk, du stoler på/.test(a.els.adgangNote.textContent) && /kræver stadig PIN/.test(a.els.adgangNote.textContent));
  adgang = "laast"; a = await side({ svar }); a.kald.length = 0; adgang = "aaben_visning";
  a.els.adgangValg.value = "aaben_visning"; await fyr(a.els.adgangValg, "change");
  const post = a.kald.find(k => k.m === "POST" && k.url === "instans.php");
  t("et valg sender kun {adgang} (ingen andre indstillinger rører ved), og siden læser den gemte værdi tilbage", post && JSON.stringify(post.b) === '{"adgang":"aaben_visning"}' && a.kald.at(-1).m === "GET" && a.els.adgangValg.value === "aaben_visning");
  t("…og siger det: «Gemt: forsiden kan nu ses uden PIN» efterfulgt af forklaringen", /^Gemt: forsiden kan nu ses uden PIN\. Alle på netværket/.test(a.els.adgangNote.textContent), a.els.adgangNote.textContent.slice(0, 80));
  adgang = "laast"; a.els.adgangValg.value = "laast"; await fyr(a.els.adgangValg, "change");
  t("og tilbage: «alt kræver PIN igen»", /^Gemt: alt kræver PIN igen\./.test(a.els.adgangNote.textContent) && a.els.adgangValg.value === "laast" && a.els.adgangFejl.textContent === "");
  adgang = "FEJL"; a.els.adgangValg.value = "aaben_visning"; await fyr(a.els.adgangValg, "change");
  t("afviser serveren valget, vises fejlen, og valget går tilbage til det, der gælder (siden lover ikke noget, der ikke er gemt)", /Adgangen skal være/.test(a.els.adgangFejl.textContent) && a.els.adgangValg.value === "laast");
  const html = fs.readFileSync(import.meta.dirname + "/../../public_html/index.html", "utf8");           // (URL er byttet ud med en falsk i denne fil)
  t("valget findes i sektionen Login og sikkerhed med de to muligheder", /<label for="adgangValg">Hvem må se forsiden\?<\/label>/.test(html) && /<option value="laast">Kun med PIN-kode \(standard\)<\/option>/.test(html) && /<option value="aaben_visning">Forsiden kan ses uden PIN-kode/.test(html) && html.indexOf('id="adgSek"') < html.indexOf('id="toSek"'));
}
process.exit(T.every(Boolean) ? 0 : 1);
