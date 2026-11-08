import fs from "fs";
const T=[]; const t=(n,ok,x="")=>{T.push(ok);console.log(ok?"ok  ":"FEJL",n,ok?"":x)};
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const tick = () => new Promise(r => setImmediate(r));
const mk = () => { const els = {}; const el = id => (els[id] ??= { id, value:"", checked:true, innerHTML:"", textContent:"", hidden:false, dataset:{}, handlers:{}, addEventListener(t,f){ (this.handlers[t] ??= []).push(f); } }); return { els, el }; };
const fyr = async (e, type, ev = {}) => { for (const f of e.handlers[type] || []) await f({ preventDefault(){}, ...ev }); await tick(); await tick(); };

// ── joke ──
{
  const { els, el } = mk(); const kald = [];
  globalThis.fetch = async (url, o = {}) => { const m = o.method || "GET"; kald.push({ url, m, b: o.body ? JSON.parse(o.body) : null });
    const ok = d => ({ ok:true, status:200, json: async () => d }), no = (s, e) => ({ ok:false, status:s, json: async () => ({ error:e }) });
    if (url.includes("indstillinger")) return ok({ aktiv:true, kategori:"Pun", sprog:"de", kategorier:["Any","Misc","Programming","Pun","Spooky","Christmas"], sprogliste:["cs","de","en","es","fr","pt","xx"] });
    if (m === "POST"){ if (el("jokeKat").value === "Programming" && el("jokeSprog").value === "xx") return no(400, "Der findes ikke jokes på det sprog."); return ok({ aktiv:JSON.parse(o.body).aktiv, kategori:JSON.parse(o.body).kategori, sprog:JSON.parse(o.body).sprog, kategorier:["Any","Misc","Programming","Pun","Spooky","Christmas"], sprogliste:["cs","de","en","es","fr","pt","xx"] }); }
    return no(404, "?"); };
  new Function("$","esc","HEAD", fs.readFileSync("/tmp/jokeidx_block.js","utf8"))(el, esc, {});
  await tick(); await tick();
  t("sektionen vises, kategorier og sprog på dansk/eget navn, de gemte valg er valgt", els.jokeSek.hidden === false && /value="Pun" selected>Ordspil/.test(els.jokeKat.innerHTML) && /value="de" selected>Deutsch/.test(els.jokeSprog.innerHTML) && /Programmering/.test(els.jokeKat.innerHTML) && (els.jokeKat.innerHTML.match(/<option/g) || []).length === 6);
  t("kategorien Dark tilbydes ikke (kun hvad serveren sender)", !/Dark/.test(els.jokeKat.innerHTML));
  t("ukendt sprogkode vises som koden", /<option value="xx">xx<\/option>/.test(els.jokeSprog.innerHTML));
  els.jokeAktiv.checked = false; els.jokeKat.value = "Misc"; els.jokeSprog.value = "en";
  await fyr(els.jokeForm, "submit");
  t("gem sender aktiv, kategori og sprog", JSON.stringify(kald.at(-1).b) === '{"aktiv":false,"kategori":"Misc","sprog":"en"}' && /Gemt/.test(els.jokeInfo.textContent), JSON.stringify(kald.at(-1)));
  els.jokeKat.value = "Programming"; els.jokeSprog.value = "xx"; await fyr(els.jokeForm, "submit");
  t("serverens fejl vises", /ikke jokes på det sprog/.test(els.jokeFejl.textContent) && els.jokeInfo.textContent === "");
  const { els: e2, el: l2 } = mk(); globalThis.fetch = async () => ({ ok:false, status:404, json: async () => ({}) });
  new Function("$","esc","HEAD", fs.readFileSync("/tmp/jokeidx_block.js","utf8"))(l2, esc, {}); const f0 = console.error; console.error = () => {}; await tick(); await tick(); console.error = f0;
  t("404 skjuler sektionen", e2.jokeSek.hidden === true);
}
// ── vejr ──
{
  const { els, el } = mk(); const kald = []; let sogSvar = null;
  globalThis.fetch = async (url, o = {}) => { const m = o.method || "GET"; kald.push({ url, m, b: o.body ? JSON.parse(o.body) : null });
    const ok = d => ({ ok:true, status:200, json: async () => d }), no = (s, e) => ({ ok:false, status:s, json: async () => ({ error:e }) });
    if (url.includes("indstillinger")) return ok({ hjemNavn:"Hjem", ekstra:null });
    if (url.includes("action=sog")) return sogSvar ? sogSvar : ok({ resultater:[{ navn:"Odense <b>", omraade:"Syddanmark", land:"Danmark", lat:55.3959, lon:10.3883 }, { navn:"Odense", omraade:"", land:"USA", lat:12.5, lon:-3.25 }] });
    if (m === "POST"){ const b = JSON.parse(o.body); if (b.hjemNavn === "FEJL") return no(400, "Hjemmets navn skal være 1 til 40 tegn."); return ok({ hjemNavn:b.hjemNavn, ekstra:b.ekstra }); }
    return no(404, "?"); };
  new Function("$","esc","HEAD", fs.readFileSync("/tmp/vejridx_block.js","utf8"))(el, esc, {});
  await tick(); await tick();
  t("sektionen vises med hjemmets navn og «ingen ekstra lokation»", els.vejrSek.hidden === false && els.vejrHjem.value === "Hjem" && /Ingen ekstra lokation/.test(els.vejrValgt.textContent) && els.vejrFjern.hidden === true);
  els.vejrSog.value = "o"; await fyr(els.vejrSogKnap, "click");
  t("for kort søgning afvises uden kald", /mindst to bogstaver/.test(els.vejrFejl.textContent) && !kald.some(k => /action=sog/.test(k.url)));
  els.vejrSog.value = "Odense"; await fyr(els.vejrSogKnap, "click");
  t("søgning: resultater som knapper med navn, område, land og koordinater, navne escapes", /Odense &lt;b&gt;, Syddanmark, Danmark \(55\.3959, 10\.3883\)/.test(els.vejrResultater.innerHTML) && (els.vejrResultater.innerHTML.match(/data-vejr-vaelg/g) || []).length === 2 && !/<b>/.test(els.vejrResultater.innerHTML.replace(/<button[^>]*>/g, "").replace(/<\/button>/g, "")) , els.vejrResultater.innerHTML.slice(0, 200));
  t("søgeordet sendes URL-kodet", kald.some(k => /action=sog&q=Odense$/.test(k.url)));
  await fyr(els.vejrResultater, "click", { target:{ closest: s => s === "[data-vejr-vaelg]" ? { dataset:{ vejrVaelg:"0" } } : null } });
  t("valg af et sted sætter den ekstra lokation, rydder listen og viser Fjern", /Ekstra lokation: Odense <b> \(55\.3959, 10\.3883\)/.test(els.vejrValgt.textContent) && els.vejrResultater.innerHTML === "" && els.vejrFjern.hidden === false && /Tryk Gem/.test(els.vejrInfo.textContent));
  await fyr(els.vejrForm, "submit");
  t("gem sender hjemmets navn og den ekstra lokation (navn, lat, lon)", JSON.stringify(kald.at(-1).b) === '{"hjemNavn":"Hjem","ekstra":{"navn":"Odense <b>","lat":55.3959,"lon":10.3883}}' && /Gemt/.test(els.vejrInfo.textContent), JSON.stringify(kald.at(-1).b));
  await fyr(els.vejrFjern, "click"); await fyr(els.vejrForm, "submit");
  t("Fjern + Gem sender ekstra: null", kald.at(-1).b.ekstra === null && els.vejrFjern.hidden === true && /Ingen ekstra lokation/.test(els.vejrValgt.textContent));
  els.vejrHjem.value = "   "; await fyr(els.vejrForm, "submit");
  t("tomt navn afvises uden kald", /1 til 40 tegn/.test(els.vejrFejl.textContent) && kald.at(-1).m !== "POST" || kald.filter(k => k.m === "POST").length === 2);
  els.vejrHjem.value = "FEJL"; await fyr(els.vejrForm, "submit");
  t("serverens fejl ved gem vises", /Hjemmets navn skal være/.test(els.vejrFejl.textContent));
  sogSvar = { ok:true, status:200, json: async () => ({ resultater:[] }) }; els.vejrSog.value = "Zzzz"; await fyr(els.vejrSogKnap, "click");
  t("ingen fund forklares", /Ingen steder fundet/.test(els.vejrResultater.innerHTML));
  sogSvar = { ok:false, status:502, json: async () => ({ error:"Kunne ikke nå tjenesten: timeout" }) }; await fyr(els.vejrSogKnap, "click");
  t("fejl ved søgning vises", /Kunne ikke nå tjenesten: timeout/.test(els.vejrFejl.textContent));
  const enter = []; await fyr(els.vejrSog, "keydown", { key:"Enter", preventDefault(){ enter.push(1); } });
  t("Enter i søgefeltet søger i stedet for at sende formularen", enter.length === 1);
}
process.exit(T.every(Boolean)?0:1);
