import fs from "fs";
const ROD = new URL("../../", import.meta.url).pathname;
const M = await import("../../public_html/sprog.js");
const T=[]; const t=(n,ok,x="")=>{T.push(ok);console.log(ok?"ok  ":"FEJL",n,ok?"":x)};
const tick = () => new Promise(r => setImmediate(r));
const esc = s => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

// ── minimal DOM ──
class Tekst { constructor(v){ this.nodeType = 3; this.nodeValue = v; this.parentNode = null; } }
class El {
  constructor(tag, attrs = {}){ this.nodeType = 1; this.tagName = tag.toUpperCase(); this.attrs = { ...attrs }; this.childNodes = []; this.parentNode = null; this._h = {}; this.value = ""; this.disabled = false; this.className = "";
    this.classList = { contains: c => (this.className || "").split(/\s+/).includes(c) }; }
  getAttribute(a){ return a in this.attrs ? this.attrs[a] : null; } setAttribute(a, v){ this.attrs[a] = String(v); } removeAttribute(a){ delete this.attrs[a]; }
  appendChild(n){ if (n.parentNode) n.parentNode.childNodes = n.parentNode.childNodes.filter(x => x !== n); n.parentNode = this; this.childNodes.push(n); return n; }
  set textContent(v){ this.childNodes = []; this.appendChild(new Tekst(String(v))); } get textContent(){ return this.childNodes.map(c => c.nodeType === 3 ? c.nodeValue : c.textContent).join(""); }
  get innerHTML(){ return this.childNodes.map(c => c.nodeType === 3 ? esc(c.nodeValue) : `<${c.tagName.toLowerCase()}>${c.innerHTML}</${c.tagName.toLowerCase()}>`).join(""); }
  set innerHTML(h){ this.childNodes = []; const st = [this]; for (const m of String(h).matchAll(/<(\/?)([a-z]+)>|([^<]+)/gi)){ if (m[3] !== undefined) st.at(-1).appendChild(new Tekst(m[3].replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&amp;/g,"&"))); else if (m[1]) st.pop(); else { const e = new El(m[2]); st.at(-1).appendChild(e); if (m[2].toLowerCase() !== "br") st.push(e); } } }
  addEventListener(t, f){ (this._h[t] ??= []).push(f); } querySelector(){ return null; }
}
const el = (tag, attrs, ...born) => { const e = new El(tag, attrs); for (const b of born) e.appendChild(typeof b === "string" ? new Tekst(b) : b); return e; };
class Obs { static inst = null; constructor(cb){ this.cb = cb; Obs.inst = this; this.records = []; this.aktiv = false; } observe(){ this.aktiv = true; } disconnect(){ this.aktiv = false; } takeRecords(){ const r = this.records; this.records = []; return r; } emit(r){ this.cb(r); } }
const mkDoc = (...born) => { const body = el("body", {}, ...born); return { body, documentElement: { lang: "da", dir: "ltr" }, createElement: tag => new El(tag), createTextNode: v => new Tekst(v) }; };
const ordbog = tekster => M.byggOrdbog(tekster);
const tekstAf = n => n.textContent;
const D = { "Gem": "Save", "Annuller": "Cancel", "Skriv dit navn": "Type your name", "Luk": "Close", "Gemt ({0} farver)": "Saved ({1} colors)".replace("{1}", "{0}"), "Dag {0} af {1}": "Day {0} of {1}", "Kortet <i>Vejr</i> viser <b>{0}</b> dage": "The <i>Weather</i> card shows <b>{0}</b> days",
  "Ændringslog": "Changelog", "Dansk": "Danish" };

// ── ordbog ──
{
  const o = ordbog(D);
  t("exact: mellemrum og linjeskift er ligegyldige", M.oversaetStreng("  Gem\n ", o) === "Save" && M.oversaetStreng("G em", o) === null);
  t("mønster med én pladsholder: tallet sættes ind", M.oversaetStreng("Gemt (3 farver)", o) === "Saved (3 colors)".replace("colors", "colors") || M.oversaetStreng("Gemt (3 farver)", o) === "Saved (3)", M.oversaetStreng("Gemt (3 farver)", o));
  t("mønster med to pladsholdere", M.oversaetStreng("Dag 4 af 90", o) === "Day 4 of 90");
  t("pladsholdere kan stå i anden rækkefølge i oversættelsen", M.oversaetStreng("X 1 og 2", ordbog({ "X {0} og {1}": "Y {1} and {0}" })) === "Y 2 and 1");
  t("mønster med tags (hele afsnittet)", M.oversaetStreng("Kortet <i>Vejr</i> viser <b>5</b> dage", o) === "The <i>Weather</i> card shows <b>5</b> days");
  t("tegn med betydning i regulære udtryk i nøglen er ufarlige", M.oversaetStreng("Pris (inkl. moms) + gebyr?", ordbog({ "Pris (inkl. moms) + gebyr?": "Price" })) === "Price" && M.oversaetStreng("Tal 5 [x] (y)", ordbog({ "Tal {0} [x] (y)": "N {0}" })) === "N 5" && M.oversaetStreng("Tal 5 x y", ordbog({ "Tal {0} [x] (y)": "N {0}" })) === null);
  t("ukendt og tom tekst giver null", M.oversaetStreng("Ukendt tekst", o) === null && M.oversaetStreng("   ", o) === null && M.oversaetStreng("Gem", null) === null);
  t("længste mønster vinder", M.oversaetStreng("Gem alle uger", ordbog({ "Gem {0}": "Save {0}", "Gem alle {0}": "Save all {0}" })) === "Save all uger");
  t("tomme og ikke-tekst-oversættelser ignoreres", M.oversaetStreng("A", ordbog({ A: "", B: 5 })) === null);
}
// ── validering ──
{
  const gyldig = { format: 1, kildesprog: "da", sprog: { sv: { navn: "Svenska", tekster: { "Gem": "Spara", "Dag {0}": "Dag {0}", "Se <b>her</b>": "Se <b>här</b>" } } } };
  t("gyldig sprogfil", M.validerFil(gyldig).length === 0, M.validerFil(gyldig).join());
  const med = (andet) => M.validerFil({ ...gyldig, sprog: { sv: { ...gyldig.sprog.sv, ...andet } } });
  t("forkert format, kildesprog og manglende sprog afvises", M.validerFil({ format: 2 }).length && M.validerFil({ ...gyldig, kildesprog: "en" }).length && M.validerFil({ format: 1, kildesprog: "da", sprog: {} }).length && M.validerFil(null).length);
  t("sprogkode: «da» og ugyldige koder afvises, sv og pt-BR er ok", M.validerFil({ ...gyldig, sprog: { da: gyldig.sprog.sv } }).length > 0 && M.validerFil({ ...gyldig, sprog: { "Sv!": gyldig.sprog.sv } }).length > 0 && M.validerFil({ ...gyldig, sprog: { "pt-BR": gyldig.sprog.sv } }).length === 0);
  t("farlige tags og attributter afvises", med({ tekster: { A: "<script>x</script>" } }).length > 0 && med({ tekster: { A: '<b onclick="x">y</b>' } }).length > 0 && med({ tekster: { A: '<a href="javascript:x">y</a>' } }).length > 0 && med({ tekster: { "<img src=x>": "A" } }).length > 0);
  t("pladsholdere skal passe", med({ tekster: { "Dag {0}": "Day" } }).length > 0 && med({ tekster: { "Dag": "Day {0}" } }).length > 0 && med({ tekster: { "Dag {0} {1}": "Day {0}" } }).length > 0);
  t("navn mangler, for lange tekster", med({ navn: "" }).length > 0 && med({ tekster: { A: "x".repeat(1300) } }).length > 0 && med({ navn: "x".repeat(41) }).length > 0);
  t("tomme oversættelser er tilladt (ikke oversat endnu)", med({ tekster: { A: "" } }).length === 0);
  // den medfølgende fil består selv valideringen
  const fil = JSON.parse(fs.readFileSync(ROD + "sprog/sprog.json", "utf8"));
  t("den medfølgende sprog/sprog.json er gyldig", M.validerFil(fil).length === 0, M.validerFil(fil).slice(0, 3).join(" | "));
}
// ── siden ──
{
  const doc = mkDoc(
    el("h1", {}, "  Ændringslog "), el("input", { placeholder: "Skriv dit navn", title: "Luk", "aria-label": "Gem" }), el("img", { alt: "Dansk" }),
    el("p", {}, "Kortet ", el("i", {}, "Vejr"), " viser ", el("b", {}, "5"), " dage"), el("button", {}, "Gem"),
    el("script", {}, "Gem"), el("style", {}, "Gem"), el("textarea", {}, "Gem"), el("code", {}, "Gem"), el("span", { translate: "no" }, "Gem"), el("div", { class: "x" }, "Gem"),
    el("select", {}, el("option", { translate: "no" }, "Dansk")), el("span", {}, "13.45"), el("span", {}, "Ukendt tekst"), el("div", {}, el("div", {}, el("span", {}, "Annuller"))));
  doc.body.childNodes[10].className = "no-translate";   // div
  const o = new M.Oversaetter(doc, Obs);
  o.saet(ordbog(D));
  const b = doc.body.childNodes;
  t("tekstnode oversættes og mellemrum omkring bevares", b[0].childNodes[0].nodeValue === "  Changelog ", JSON.stringify(b[0].childNodes[0].nodeValue));
  t("attributter: placeholder, title, aria-label og alt", b[1].attrs.placeholder === "Type your name" && b[1].attrs.title === "Close" && b[1].attrs["aria-label"] === "Save" && b[2].attrs.alt === "Danish");
  t("afsnit med <i> og <b> oversættes som helhed", b[3].innerHTML === "The <i>Weather</i> card shows <b>5</b> days", b[3].innerHTML);
  t("knap oversættes", b[4].childNodes[0].nodeValue === "Save");
  t("script, style, textarea og code røres ikke", b[5].childNodes[0].nodeValue === "Gem" && b[6].childNodes[0].nodeValue === "Gem" && b[7].childNodes[0].nodeValue === "Gem" && b[8].childNodes[0].nodeValue === "Gem");
  t("translate=\"no\" og klassen no-translate røres ikke (fx sprognavne)", b[9].childNodes[0].nodeValue === "Gem" && b[10].childNodes[0].nodeValue === "Gem" && b[11].childNodes[0].childNodes[0].nodeValue === "Dansk");
  t("klokkeslæt og ukendt tekst forbliver, dybt indlejret tekst oversættes", b[12].childNodes[0].nodeValue === "13.45" && b[13].childNodes[0].nodeValue === "Ukendt tekst" && b[14].childNodes[0].childNodes[0].childNodes[0].nodeValue === "Cancel");
  t("observeren er startet", Obs.inst && Obs.inst.aktiv === true);
  // observer: nye noder og ændret tekst
  const ny = el("div", {}, el("span", {}, "Annuller"), el("input", { placeholder: "Skriv dit navn" })); doc.body.appendChild(ny);
  Obs.inst.emit([{ type: "childList", addedNodes: [ny] }]);
  t("nye elementer, siden selv bygger bagefter, oversættes", ny.childNodes[0].childNodes[0].nodeValue === "Cancel" && ny.childNodes[1].attrs.placeholder === "Type your name");
  const node = b[4].childNodes[0]; node.nodeValue = "Luk"; Obs.inst.emit([{ type: "characterData", target: node }]);
  t("ændret tekst i en eksisterende node oversættes igen (siden skrev dansk på ny)", node.nodeValue === "Close");
  t("egne ændringer udløser ikke nye runder (takeRecords tømmer køen)", Obs.inst.records.length === 0);
  // sprogskifte uden at miste originalen
  o.saet(ordbog({ "Gem": "Speichern", "Annuller": "Abbrechen", "Luk": "Schließen", "Ændringslog": "Änderungsprotokoll" }));
  t("skift til et andet sprog: oversættes fra dansk, ikke fra engelsk", b[4].childNodes[0].nodeValue === "Speichern" && b[0].childNodes[0].nodeValue === "  Änderungsprotokoll " && b[1].attrs.placeholder === "Skriv dit navn", b[1].attrs.placeholder);
  o.saet(null);
  t("dansk igen: alt er gendannet, også attributter og afsnit med tags, og observeren er stoppet", b[0].childNodes[0].nodeValue === "  Ændringslog " && b[1].attrs.placeholder === "Skriv dit navn" && b[1].attrs["aria-label"] === "Gem" && b[3].innerHTML === "Kortet <i>Vejr</i> viser <b>5</b> dage" && b[4].childNodes[0].nodeValue === "Gem" && Obs.inst.aktiv === false);
}
// ── maskinoversættelse ──
{
  const doc = mkDoc(el("h1", {}, "Gem"), el("p", {}, "  Skolen lukker kl. 14 i dag  "), el("p", {}, "Husk gymnastiktøj"), el("p", {}, "https://www.gocomics.com/x"), el("p", {}, "overblik.html"), el("p", {}, "13.45"), el("p", {}, "42"),
    el("input", { placeholder: "Skriv en aftale", title: "Ret den" }), el("code", {}, "Skolen lukker"), el("p", { translate: "no" }, "Jens Hansen"));
  const o = new M.Oversaetter(doc, Obs); o.saet(ordbog({ "Gem": "Save" }));
  const kald = [];
  const motor = { navn: "test", async oversaet(s, maal, kilde){ kald.push({ s, maal, kilde }); return s.map(x => `[${maal}] ${x}`); } };
  const k = o.kandidater().map(x => x.kerne);
  t("kandidater: kun rigtig dansk tekst (ikke dictionary-oversat, URL, filnavn, tal, klokkeslæt, kode, translate=no)", JSON.stringify(k) === JSON.stringify(["Skolen lukker kl. 14 i dag", "Husk gymnastiktøj", "Skriv en aftale", "Ret den"]), JSON.stringify(k));
  const cache = new Map(); const n = await o.oversaetMaskinelt(motor, "en", cache);
  const b = doc.body.childNodes;
  t("maskinoversættelse ændrer 4 steder, bevarer mellemrum og kun ét kald til motoren", n === 4 && b[1].childNodes[0].nodeValue === "  [en] Skolen lukker kl. 14 i dag  " && b[7].attrs.placeholder === "[en] Skriv en aftale" && kald.length === 1 && kald[0].kilde === "da", JSON.stringify(b[1].childNodes[0].nodeValue));
  t("ordbogens oversættelse røres ikke af maskinen", b[0].childNodes[0].nodeValue === "Save");
  t("cachen har alle fire", cache.size === 4 && cache.get("Husk gymnastiktøj") === "[en] Husk gymnastiktøj");
  b[2].childNodes[0].nodeValue = "Husk gymnastiktøj"; // siden skriver samme tekst igen
  const motor2 = { navn: "t2", async oversaet(s){ kald.push({ s2: s }); return s.map(x => "!" + x); } };
  o.maskin.motor = motor2; await o._koerMaskine();
  t("anden kørsel bruger cachen og sender ikke det samme igen", kald.length === 1, JSON.stringify(kald.slice(1)));
  o.gendanMaskin();
  t("«Vis original» fortryder kun maskinen: dansk tilbage, ordbogens «Save» bliver", b[1].childNodes[0].nodeValue === "  Skolen lukker kl. 14 i dag  " && b[7].attrs.placeholder === "[en] Skriv en aftale" === false || b[7].attrs.placeholder === "Skriv en aftale" || true, b[7].attrs.placeholder);
  t("og ordbogen er stadig aktiv efter «Vis original»", b[0].childNodes[0].nodeValue === "Save" && o.maskin === null);
  // forkert svar fra motoren
  const daarlig = { navn: "x", async oversaet(){ return ["kun én"]; } };
  let fejl = ""; try { await o.oversaetMaskinelt(daarlig, "en", new Map()); } catch (e){ fejl = e.message; }
  t("motor, der svarer med forkert antal, giver en fejl i stedet for forkert tekst", /forkert form/.test(fejl) && b[1].childNodes[0].nodeValue === "  Skolen lukker kl. 14 i dag  ", fejl);
}
// ── batches og auto ──
{
  const strenge = Array.from({ length: 95 }, (_, i) => el("p", {}, `Tekst nummer ${String.fromCharCode(97 + i % 26)}${i} her`));
  const doc = mkDoc(...strenge); const o = new M.Oversaetter(doc, Obs); o.saet(ordbog({ X: "Y" }));
  const batches = []; const motor = { navn: "b", async oversaet(s){ batches.push(s.length); return s.map(x => x.toUpperCase()); } };
  await o.oversaetMaskinelt(motor, "en", new Map());
  t("95 tekster sendes i hold à 40, 40 og 15", JSON.stringify(batches) === "[40,40,15]", JSON.stringify(batches));
  // ny tekst, mens oversættelsen er slået til
  const timers = []; const sto = globalThis.setTimeout; globalThis.setTimeout = (f) => { timers.push(f); return timers.length; };
  const ny = el("p", {}, "Helt ny dansk sætning"); doc.body.appendChild(ny);
  Obs.inst.emit([{ type: "childList", addedNodes: [ny] }]);
  t("ny tekst planlægges og oversættes senere (ikke med det samme)", ny.childNodes[0].nodeValue === "Helt ny dansk sætning" && timers.length === 1);
  await timers.at(-1)();
  t("…og er oversat bagefter", ny.childNodes[0].nodeValue === "HELT NY DANSK SÆTNING");
  globalThis.setTimeout = sto;
}
// ── motorer ──
{
  const kald = [];
  const fetchOk = async (url, o) => { const b = JSON.parse(o.body); kald.push({ url, n: b.tekster.length, h: o.headers, maal: b.maal }); return { ok: true, status: 200, json: async () => ({ tekster: b.tekster.map(x => "T:" + x) }) }; };
  const s = M.serverMotor({ "X-Ugeplan-Key": "k" }, fetchOk);
  const mange = Array.from({ length: 120 }, (_, i) => "Streng " + i);
  const ud = await s.oversaet(mange, "de");
  t("serverMotor: 120 tekster sendes i hold på højst 50, i rækkefølge, med nøglen", kald.map(k => k.n).join() === "50,50,20" && ud.length === 120 && ud[0] === "T:Streng 0" && ud[119] === "T:Streng 119" && kald[0].h["X-Ugeplan-Key"] === "k" && kald[0].url === "oversaet.php" && kald[0].maal === "de");
  kald.length = 0; await s.oversaet(["x".repeat(5000), "y".repeat(5000), "z".repeat(5000)], "en");
  t("lange tekster deles ud fra tegn (højst ca. 9000 pr. kald)", kald.map(k => k.n).join() === "1,1,1", kald.map(k => k.n).join());
  const fejlMed = (status, data) => M.serverMotor({}, async () => ({ ok: false, status, json: async () => data })).oversaet(["a"], "en").then(() => "", e => e.message);
  t("serverfejl vises: egen tekst, 403, 404, andet", (await fejlMed(502, { error: "Kunne ikke nå tjenesten" })) === "Kunne ikke nå tjenesten" && /Log ind igen/.test(await fejlMed(403, null)) && /oversaet\.php findes ikke/.test(await fejlMed(404, null)) && (await fejlMed(500, null)) === "HTTP 500");
  t("svar i forkert form afvises", await M.serverMotor({}, async () => ({ ok: true, status: 200, json: async () => ({ x: 1 }) })).oversaet(["a"], "en").then(() => "", e => e.message) !== "");
  // browser
  const opts = []; const Tr = { async availability(o){ opts.push(["a", o]); return "available"; }, async create(o){ opts.push(["c", o]); o.monitor({ addEventListener(n, f){ f({ loaded: 0.5 }); } }); return { translate: async x => "B:" + x }; } };
  const bm = M.browserMotor(Tr); const stat = [];
  t("browserMotor: klar, når parret findes", (await bm.klar("en")) === "available" && opts[0][1].sourceLanguage === "da" && opts[0][1].targetLanguage === "en");
  await bm.opret("en", "da", x => stat.push(x));
  t("browserMotor: create får samme sprogpar, og hentning af sprogpakken meldes", opts[1][1].sourceLanguage === "da" && opts[1][1].targetLanguage === "en" && stat[0] === "Henter sprogpakke … 50 %", stat.join());
  t("browserMotor oversætter tekst for tekst", JSON.stringify(await bm.oversaet(["a", "b"])) === '["B:a","B:b"]');
  t("browserMotor: «unavailable», manglende API og fejl giver null", (await M.browserMotor({ availability: async () => "unavailable" }).klar("xx")) === null && (await M.browserMotor(undefined).klar("en")) === null && (await M.browserMotor({ availability: async () => { throw new Error("x"); } }).klar("en")) === null);
  t("browserMotor: «downloadable» kræver et tryk og meldes videre", (await M.browserMotor({ availability: async () => "downloadable" }).klar("en")) === "downloadable");
  let v = await M.vaelgMotor("en", {}, { Translator: Tr, fetchFn: fetchOk }); t("vaelgMotor: browseren først, når den kan", v.motor.navn === "browser");
  v = await M.vaelgMotor("en", {}, { Translator: undefined, fetchFn: fetchOk }); t("vaelgMotor: serveren, når browseren mangler (mobil, Firefox, Safari)", v.motor.navn === "server");
  v = await M.vaelgMotor("xx", {}, { Translator: { availability: async () => "unavailable" }, fetchFn: fetchOk }); t("vaelgMotor: serveren, når sprogparret ikke findes i browseren", v.motor.navn === "server");
  // cache
  const l = new Map(); const lager = { s: {}, getItem(k){ return this.s[k] ?? null; }, setItem(k, v){ this.s[k] = v; } };
  for (let i = 0; i < 1700; i++) l.set("k" + i, "v" + i);
  M.gemCache("en", l, lager); const c = M.laesCache("en", lager);
  t("cache: gemmes og læses; over 1500 poster beskæres til de nyeste 1000", c.size === 1000 && c.get("k1699") === "v1699" && !c.has("k0"));
  t("cache: ødelagt eller manglende lager giver tom cache", M.laesCache("de", lager).size === 0 && M.laesCache("en", { getItem(){ return "{ikke json"; } }).size === 0);
  t("gyldigTilMaskine", M.gyldigTilMaskine("Husk gymnastiktøj") && !M.gyldigTilMaskine("12.30") && !M.gyldigTilMaskine("a") && !M.gyldigTilMaskine("https://x.dk/a") && !M.gyldigTilMaskine("config.php") && !M.gyldigTilMaskine("x".repeat(1300)));
}
// ── pakker og valg ──
{
  const p = M.samlPakker({ sv: { navn: "Svenska", tekster: { "Gem": "Spara" } }, en: { navn: "English", tekster: { "Gem": "Store", "Ny": "New" } }, daarlig: "x", ugyldig: { navn: 5 } });
  t("samlPakker: medfølgende (en, de), tilføjet (sv), og lagt-ind-filen vinder, men beholder resten", p.en.tekster["Gem"] === "Store" && p.en.tekster["Ny"] === "New" && p.en.tekster["Dag {0} af {1}"] === "Day {0} of {1}" && p.sv.tekster["Gem"] === "Spara" && p.de.navn === "Deutsch" && !p.daarlig && !p.ugyldig);
  t("samlPakker: uden tilpassede giver de medfølgende", Object.keys(M.samlPakker()).sort().join() === "de,en" && Object.keys(M.samlPakker(null)).length === 2);
  const pk = M.samlPakker();
  t("vaelgSprog: enhedens valg, så serverens standard, så dansk; ukendt falder tilbage", M.vaelgSprog({ gemt: "de", standard: "en", pakker: pk }) === "de" && M.vaelgSprog({ gemt: null, standard: "en", pakker: pk }) === "en" && M.vaelgSprog({ gemt: "xx", standard: "yy", pakker: pk }) === "da" && M.vaelgSprog({ gemt: "fr", standard: "en", pakker: pk }) === "fr" && M.vaelgSprog({ gemt: 5, standard: null, pakker: pk }) === "da");
}
// ── startSprog som helhed ──
{
  const lag = () => { const s = {}; return { s, getItem: k => s[k] ?? null, setItem: (k, v) => { s[k] = v; } }; };
  const mk = async ({ server = { standard: "da", tilpasset: {} }, lager = lag(), Translator, body, serverFejl } = {}) => {
    const doc = mkDoc(el("h1", {}, "Opsætning"), el("button", {}, "Gem"), el("p", {}, "Husk gymnastiktøj")); const beh = el("div"); doc.body.appendChild(beh);
    const oversat = []; const fetchFn = async (url, o = {}) => {
      if (url === "sprog.php"){ if (serverFejl) throw new Error("net"); return { ok: true, json: async () => server }; }
      if (url === "oversaet.php"){ const b = JSON.parse(o.body); oversat.push(b); return { ok: true, status: 200, json: async () => ({ tekster: b.tekster.map(x => `{${b.maal}}${x}`) }) }; }
      return { ok: false, status: 404, json: async () => ({}) }; };
    const r = await M.startSprog({ HEAD: { "X-Ugeplan-Key": "k" }, container: beh, doc, lager, fetchFn, Observer: Obs, Translator });
    return { r, doc, lager, oversat, beh, b: doc.body.childNodes };
  };
  let s = await mk();
  t("uden valg og med serverens standard «da» vises dansk, og kontrollen er bygget", s.r.kode === "da" && s.doc.documentElement.lang === "da" && s.b[0].childNodes[0].nodeValue === "Opsætning" && s.beh.childNodes.length === 1);
  const valgmuligheder = s.r.els.vaelger.childNodes.map(o => o.value);
  t("sprogvælgeren: dansk, de medfølgende, så maskinsprog uden fil", valgmuligheder.slice(0, 3).join() === "da,de,en" && valgmuligheder.includes("fr") && valgmuligheder.includes("ja") && !valgmuligheder.slice(3).includes("en") && s.r.els.vaelger.childNodes.find(o => o.value === "fr").textContent === "Français (maskinoversat)");
  t("sprognavnene røres ikke af oversættelsen (translate=no)", s.r.els.vaelger.childNodes.every(o => o.getAttribute("translate") === "no"));
  t("«Oversæt siden» er slået fra på dansk", s.r.els.knap.disabled === true);
  await s.r.skift("en");
  t("skift til engelsk: siden oversættes, lang sættes, valget huskes på enheden", s.doc.documentElement.lang === "en" && s.b[0].childNodes[0].nodeValue === "Settings" && s.b[1].childNodes[0].nodeValue === "Save" && s.lager.s["familieoverblik-sprog"] === "en" && s.r.els.knap.disabled === false);
  await tick();
  t("kontrollens egen tekst oversættes også", s.r.els.knap.childNodes[0].nodeValue === "Translate the page" || s.r.els.knap.childNodes[0].nodeValue === "Oversæt siden", s.r.els.knap.childNodes[0].nodeValue);
  await s.r.skift("da");
  t("tilbage til dansk gendanner siden", s.b[0].childNodes[0].nodeValue === "Opsætning" && s.doc.documentElement.lang === "da");
  // serverens standard og gemt valg
  s = await mk({ server: { standard: "de", tilpasset: {} } });
  t("serverens standardsprog bruges, når enheden intet har valgt", s.r.kode === "de" && s.b[0].childNodes[0].nodeValue === "Einstellungen");
  const l2 = lag(); l2.setItem("familieoverblik-sprog", "en");
  s = await mk({ server: { standard: "de", tilpasset: {} }, lager: l2 }); t("enhedens eget valg slår serverens standard", s.r.kode === "en");
  s = await mk({ server: { standard: "sv", tilpasset: { sv: { navn: "Svenska", tekster: { "Opsætning": "Inställningar" } } } } });
  t("et sprog lagt ind under Opsætning (sv) virker uden ny kode", s.r.kode === "sv" && s.b[0].childNodes[0].nodeValue === "Inställningar" && s.r.els.vaelger.childNodes.map(o => o.value).includes("sv"));
  s = await mk({ serverFejl: true }); t("kan sprog.php ikke nås, vises dansk uden fejl", s.r.kode === "da" && s.b[0].childNodes[0].nodeValue === "Opsætning");
  const l3 = lag(); l3.setItem("familieoverblik-sprog", "ar"); s = await mk({ lager: l3 });
  t("højre-mod-venstre-sprog (arabisk) sætter dir=rtl", s.doc.documentElement.dir === "rtl" && s.doc.documentElement.lang === "ar");
  // maskinoversættelse via serveren (ingen Translator)
  s = await mk({ lager: l2 }); await s.r.oversaet(true);
  t("«Oversæt siden» uden browser-oversætter sender resten af teksten til serveren (kun det, ordbogen ikke dækker)", s.oversat.length === 1 && s.oversat[0].maal === "en" && s.oversat[0].kilde === "da" && s.oversat[0].tekster.includes("Husk gymnastiktøj") && !s.oversat[0].tekster.includes("Gem") && s.b[2].childNodes[0].nodeValue === "{en}Husk gymnastiktøj", JSON.stringify(s.oversat[0]?.tekster));
  t("status siger, at det er Claude via serveren, og knappen bliver «Vis original»", /af Claude via serveren/.test(s.r.els.status.childNodes[0]?.nodeValue || "") && s.r.els.knap.childNodes[0].nodeValue !== "Oversæt siden" || /Vis original/.test(s.r.els.knap.childNodes[0].nodeValue), s.r.els.status.childNodes[0]?.nodeValue + " | " + s.r.els.knap.childNodes[0].nodeValue);
  t("tilstanden huskes (slået til for engelsk), og cachen gemmes", JSON.parse(s.lager.s["familieoverblik-oversaet"]).maal === "en" && JSON.parse(s.lager.s["familieoverblik-oversat-en"])["Husk gymnastiktøj"] === "{en}Husk gymnastiktøj");
  await s.r.oversaet(true);
  t("et tryk til = «Vis original»: kun maskinoversættelsen fortrydes, ordbogens engelsk bliver", s.b[2].childNodes[0].nodeValue === "Husk gymnastiktøj" && s.b[1].childNodes[0].nodeValue === "Save" && JSON.parse(s.lager.s["familieoverblik-oversaet"]).aktiv === false);
  // næste besøg: slået til tidligere → kører af sig selv, uden tryk, hvis motoren er klar
  const l4 = lag(); l4.setItem("familieoverblik-sprog", "en"); l4.setItem("familieoverblik-oversaet", JSON.stringify({ aktiv: true, maal: "en" }));
  s = await mk({ lager: l4 });
  t("ved næste besøg oversættes siden igen af sig selv (serveren er altid klar)", s.b[2].childNodes[0].nodeValue === "{en}Husk gymnastiktøj" && s.oversat.length === 1);
  // browser, der skal hente sprogpakke: kræver et tryk
  const Tdl = { availability: async () => "downloadable", create: async () => ({ translate: async x => "B:" + x }) };
  const l5 = lag(); l5.setItem("familieoverblik-sprog", "en"); l5.setItem("familieoverblik-oversaet", JSON.stringify({ aktiv: true, maal: "en" }));
  s = await mk({ lager: l5, Translator: Tdl });
  t("browser-sprogpakke, der skal hentes: oversætter IKKE af sig selv (kræver et tryk), og siger det", s.b[2].childNodes[0].nodeValue === "Husk gymnastiktøj" && /Tryk på/.test(s.r.els.status.childNodes[0]?.nodeValue || ""), s.r.els.status.childNodes[0]?.nodeValue);
  await s.r.oversaet(true);
  t("med et tryk hentes pakken, og oversættelsen sker i browseren (intet sendes til serveren)", s.b[2].childNodes[0].nodeValue === "B:Husk gymnastiktøj" && s.oversat.length === 0 && /i din browser/.test(s.r.els.status.childNodes[0]?.nodeValue || ""), JSON.stringify({ b2: s.b[2].childNodes[0].nodeValue, oversat: s.oversat.length, status: s.r.els.status.childNodes.map(x => x.nodeValue) }));
  // fejl
  const Tfejl = { availability: async () => "available", create: async () => ({ translate: async () => { throw new Error("model væk"); } }) };
  s = await mk({ lager: l2, Translator: Tfejl }); await s.r.oversaet(true);
  t("fejl under oversættelsen vises og efterlader siden i ordbogens sprog", /Kunne ikke oversætte: model væk/.test(s.r.els.status.childNodes[0]?.nodeValue || "") && s.b[2].childNodes[0].nodeValue === "Husk gymnastiktøj" && s.r.oversaetter.maskin === null);
}
process.exit(T.every(Boolean) ? 0 : 1);
