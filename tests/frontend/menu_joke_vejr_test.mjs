import fs from "fs";
const ROD = new URL("../../", import.meta.url).pathname;
const T=[]; const t=(n,ok,x="")=>{T.push(ok);console.log(ok?"ok  ":"FEJL",n,ok?"":x)};
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const tick = () => new Promise(r => setImmediate(r));
const mk = () => { const els = {}; const el = id => (els[id] ??= { id, innerHTML:"", textContent:"", hidden:false, handlers:{}, attrs:{}, dataset:{}, addEventListener(t,f){ (this.handlers[t] ??= []).push(f); }, setAttribute(k,v){ this.attrs[k] = v; }, focus(){ this.fokus = (this.fokus || 0) + 1; }, querySelector(sel){ return this._q?.[sel] ?? null; } }); return { els, el }; };

// ── menu ──
{
  const { els, el } = mk(); el("siderListe").hidden = true;
  const doc = { handlers:{}, addEventListener(t,f){ (this.handlers[t] ??= []).push(f); } };
  new Function("$","document", fs.readFileSync("/tmp/menuov_block.js","utf8"))(el, doc);
  const klik = (id) => els[id].handlers.click.forEach(f => f({}));
  const udenfor = (inde) => doc.handlers.click.forEach(f => f({ target:{ closest: s => inde && s === "#siderMenu" ? {} : null } }));
  klik("siderKnap");
  t("Sider ▾ åbner menuen og sætter aria-expanded", els.siderListe.hidden === false && els.siderKnap.attrs["aria-expanded"] === "true");
  klik("siderKnap"); t("et tryk til lukker den", els.siderListe.hidden === true && els.siderKnap.attrs["aria-expanded"] === "false");
  klik("siderKnap"); udenfor(true); t("klik inde i menuen lukker den ikke af sig selv", els.siderListe.hidden === false);
  udenfor(false); t("klik uden for menuen lukker den", els.siderListe.hidden === true);
  klik("siderKnap"); doc.handlers.keydown.forEach(f => f({ key:"Escape" }));
  t("Escape lukker og flytter fokus tilbage til knappen", els.siderListe.hidden === true && els.siderKnap.fokus === 1);
  doc.handlers.keydown.forEach(f => f({ key:"Escape" })); t("Escape med lukket menu gør intet", els.siderKnap.fokus === 1);
  klik("siderKnap"); els.siderListe.handlers.click.forEach(f => f({ target:{ closest: s => s === "a,button" ? {} : null } }));
  t("valg af et menupunkt lukker menuen (uden at stjæle fokus)", els.siderListe.hidden === true && els.siderKnap.fokus === 1);
}
// ── menuen i selve filen ──
{
  const h = fs.readFileSync(ROD + "public_html/overblik.html", "utf8");
  const menu = h.slice(h.indexOf('<div class="sider-liste"'), h.indexOf("</footer>"));
  t("menuen indeholder alle sider: gæste-wifi, vælger, Tokyo, ændringslog, billeder og opsætning", ["gaest-wifi.html","vaelger.html","https://drivefromhome.com/city/tokyo/drive/",'id="clKnap"',"billeder.html","index.html"].every(x => menu.includes(x)));
  t("Tokyo-linket åbner i en ny fane med noopener og noreferrer", /href="https:\/\/drivefromhome\.com\/city\/tokyo\/drive\/" target="_blank" rel="noopener noreferrer"/.test(menu));
  t("kun Tokyo-linket peger uden for huset", [...menu.matchAll(/href="([^"]+)"/g)].map(m => m[1]).filter(u => /^https?:/.test(u)).join() === "https://drivefromhome.com/city/tokyo/drive/");
}
// ── joke ──
{
  const { els, el } = mk(); els.jokeKort = { hidden:true }; el("jokeKort"); el("jokeIndhold"); el("jokeTop");
  const svar = { current: { ok:false, status:500, json: async () => ({}) } };
  globalThis.fetch = async () => svar.current;
  const a = new Function("$","esc","HEAD","setInterval", fs.readFileSync("/tmp/jokeov_block.js","utf8") + "; return { jokeTegn, hentJoke, jokeVisning, get visning(){ return visning; } };")(el, esc, {}, () => 0);
  const svarEl = { hidden:true }; const knap = { textContent:"Vis svaret" };
  els.jokeIndhold._q = { ".jk-svar": svarEl };
  a.jokeTegn({ aktiv:true, stale:false, joke:{ type:"single", joke:"En <b>kort</b> joke\nlinje to", category:"Misc", lang:"en" } });
  t("en enkelt joke vises, HTML escapes, kategori og sprog står i noten", els.jokeKort.hidden === false && /En &lt;b&gt;kort&lt;\/b&gt; joke/.test(els.jokeIndhold.innerHTML) && /Misc · sprog: en · fra JokeAPI/.test(els.jokeIndhold.innerHTML) && !/data-joke-svar/.test(els.jokeIndhold.innerHTML));
  a.jokeTegn({ aktiv:true, stale:true, joke:{ type:"twopart", setup:"Hvorfor?", delivery:"Fordi.", category:"Pun", lang:"de" } });
  t("en joke i to dele: opsætningen vises, svaret er skjult bag en knap", /Hvorfor\?/.test(els.jokeIndhold.innerHTML) && /data-joke-svar/.test(els.jokeIndhold.innerHTML) && /<p class="jk-svar" hidden>Fordi\./.test(els.jokeIndhold.innerHTML) && /ikke opdateret i dag/.test(els.jokeIndhold.innerHTML));
  els.jokeIndhold.handlers.click[0]({ target:{ closest: s => s === "[data-joke-svar]" ? knap : null } });
  t("«Vis svaret» viser svaret og skifter teksten", svarEl.hidden === false && knap.textContent === "Skjul svaret");
  els.jokeIndhold.handlers.click[0]({ target:{ closest: s => s === "[data-joke-svar]" ? knap : null } });
  t("og skjuler det igen", svarEl.hidden === true && knap.textContent === "Vis svaret");
  els.jokeIndhold.handlers.click[0]({ target:{ closest: () => null } }); t("klik andre steder gør intet", svarEl.hidden === true);
  for (const [navn, d] of [["slået fra", { aktiv:false }], ["ingen joke", { aktiv:true }], ["tom tekst", { aktiv:true, joke:{ type:"single", joke:"" } }], ["to dele uden svar", { aktiv:true, joke:{ type:"twopart", setup:"x", delivery:"" } }], ["null", null]]){
    els.jokeKort.hidden = false; a.jokeTegn(d); t(`kortet skjules: ${navn}`, els.jokeKort.hidden === true);
  }
  // ── visning i toppen (settings/visning → joke: "header") ──
  const en = { aktiv:true, joke:{ type:"single", joke:"Kun selve joken", category:"Misc", lang:"en" } }, to = { aktiv:true, stale:true, joke:{ type:"twopart", setup:"Hvorfor?", delivery:"Fordi.", category:"Pun", lang:"de" } };
  a.jokeVisning({ joke: "header" }); a.jokeTegn(en);
  t("visning «header»: kortet er skjult, og toppen viser KUN joken (ingen kategori, sprog eller kilde)", els.jokeKort.hidden === true && els.jokeTop.hidden === false && els.jokeTop.textContent === "Kun selve joken" && !/Misc|JokeAPI|sprog/.test(els.jokeTop.textContent));
  a.jokeTegn(to);
  t("en joke i to dele vises i toppen som «opsætning — svar», uden knap og uden «ikke opdateret»", els.jokeTop.textContent === "Hvorfor? — Fordi." && els.jokeKort.hidden === true);
  a.jokeTegn({ aktiv:true, joke:{ type:"single", joke:"<b>fed</b> & mere" } });
  t("jokens tekst sættes som tekst (ikke HTML), så den ikke kan indeholde markup", els.jokeTop.textContent === "<b>fed</b> & mere");
  a.jokeVisning({ joke: "kort" });
  t("skifter visningen tilbage til «kort», vises kortet igen med det samme, og toppen skjules (uden at hente jokes igen)", els.jokeKort.hidden === false && els.jokeTop.hidden === true && /fed/.test(els.jokeIndhold.innerHTML));
  a.jokeVisning({ joke: "header" });
  t("og skifter den til «header» igen, flytter joken op i toppen med det samme", els.jokeKort.hidden === true && els.jokeTop.hidden === false);
  a.jokeTegn({ aktiv:false, joke:{ type:"single", joke:"x" } });
  t("er jokes slået fra, er både kortet og toppen skjult", els.jokeKort.hidden === true && els.jokeTop.hidden === true);
  a.jokeTegn({ aktiv:true, joke:{ type:"twopart", setup:"kun opsætning" } });
  t("en ufuldstændig joke i to dele vises hverken i toppen eller som kort", els.jokeKort.hidden === true && els.jokeTop.hidden === true);
  for (const v of [null, undefined, "x", 5, [], { joke: 7 }]){ a.jokeVisning(v); a.jokeTegn(en); }
  t("skrald i visningen giver kortet (standard) og ingen fejl", els.jokeKort.hidden === false && els.jokeTop.hidden === true && a.visning.joke !== "header");
  a.jokeVisning({ joke: "header" }); els.jokeKort.hidden = false; els.jokeTop.hidden = false;
  globalThis.fetch = async () => ({ ok:false, status:502, json: async () => ({}) }); await a.hentJoke();
  t("fejler hentningen, skjules både kortet og toppen", els.jokeKort.hidden === true && els.jokeTop.hidden === true);
  a.jokeVisning({});
  globalThis.fetch = async () => ({ ok:false, status:502, json: async () => ({}) }); els.jokeKort.hidden = false; await a.hentJoke();
  t("serverfejl (502) skjuler kortet", els.jokeKort.hidden === true);
  globalThis.fetch = async () => { throw new Error("net"); }; els.jokeKort.hidden = false; const f0 = console.error; console.error = () => {}; await a.hentJoke(); console.error = f0;
  t("netfejl vælter ikke siden", true);
  globalThis.fetch = async () => ({ ok:true, status:200, json: async () => ({ aktiv:true, joke:{ type:"single", joke:"Hej" } }) }); await a.hentJoke();
  t("fetch → kort vises", els.jokeKort.hidden === false && /Hej/.test(els.jokeIndhold.innerHTML));
}
// ── vejr ──
{
  const { els, el } = mk(); el("vejrKort"); el("vejrIndhold");
  const a = new Function("$","esc","HEAD","setInterval","weatherIcon", fs.readFileSync("/tmp/vejrov_block.js","utf8") + "; return { vejrTegn, vejrStedetsTid, vejrDagNavn, vejrTemp, vejrMm, hentVejr, vejrKlasse, vejrVindOrd, vejrRetning, vejrVindTekst, get valgt(){ return vejrValgt; } };")(el, esc, {}, () => 0, c => `<svg data-kode="${c}"></svg>`);
  const timer = dato => Array.from({ length: 24 }, (_, h) => ({ t:`${String(h).padStart(2,"0")}:00`, temp: h - 3.4, foeles: h - 6, regn: h === 15 ? 1.26 : 0, sand: h === 18 ? 55 : h === 21 ? 10 : 0, kode: h < 12 ? 3 : 61, vind: 4.2, stoed: 9.1, retning: 270, dag: h > 7 && h < 16 ? 1 : 0 }));
  const sted = (id, navn, tz, dato = "2026-11-06") => ({ id, navn, tidszone: tz, dato, timer: timer(dato), dage: [1,2,3,4,5].map(i => ({ dato:`2026-11-0${6 + i > 9 ? "" : ""}${6 + i}`.replace("2026-11-010", "2026-11-10").replace("2026-11-011", "2026-11-11"), kode:i, max:8.4 - i, min:2.6 - i, regn: i === 2 ? 3.4 : 0, sand: i === 2 ? 80 : 10, vind: 6.2, stoed: 10, retning: 90 })),
    i_dag:{ kode:3, max:7.6, min:1.4, regn:2.2, vind:7.8, stoed:14.2, retning:225, sol_op:"07:12", sol_ned:"16:21" }, hentet:"2026-11-06T11:20:00", stale:false });
  const nuKbh = new Date("2026-11-06T13:30:00+01:00");
  a.vejrTegn({ steder:[sted("hjem", "Hjem", "Europe/Copenhagen")] }, "hjem", nuKbh);
  const h = els.vejrIndhold.innerHTML;
  t("kortet vises med timerne hver 3. time (8 celler) og 5 dage", els.vejrKort.hidden === false && (h.match(/class="vk-t[ "]/g) || []).length === 8 && (h.match(/class="vk-d[ "]/g) || []).length === 5 && [0, 3, 6, 9, 12, 15, 18, 21].every(x => new RegExp(`<div>${String(x).padStart(2, "0")}</div>`).test(h)) && !/<div>13<\/div>/.test(h));
  t("kl. 13.30 dansk tid er tretimersfeltet 12–14 «nu», de foregående (00, 03, 06, 09) er «forbi», senere er normale", /class="vk-t vk-[a-z]+(?: nat)? nu"[^>]*><div>12<\/div>/.test(h) && (h.match(/ forbi"/g) || []).length === 4 && !/forbi"[^>]*><div>(12|15)/.test(h), (h.match(/ forbi"/g) || []).length);
  t("temperaturer afrundes (12 − 3,4 = 8,6 → 9°), minus vises med tegn", /<b>9°<\/b>/.test(h) && /<b>-3°<\/b>/.test(h));
  t("regn vises som mm med komma (1,3 mm) og ellers som procent fra 30 % (55 % kl. 18), ikke ved 10 % (kl. 21)", /1,3 mm/.test(h) && /<small>55 %<\/small>/.test(h) && !/<small>10 %<\/small>/.test(h));
  t("overblik for i dag: højeste/laveste, vejrtype, regn, vind med retning, stød og ord, og solopgang/solnedgang", /<b>8°<\/b> \/ 1° · overskyet/.test(h) && /regn 2,2 mm/.test(h) && /vind 8 m\/s fra SV, stød 14 \(jævn vind\)/.test(h) && /sol 07\.12 til 16\.21/.test(h), h.slice(0, 500));
  t("vejrtypen giver farve: i dag-linjen og cellerne har klasse efter koden (overskyet = vk-sky, regn = vk-regn, sol = vk-sol, let skyet = vk-lidt)", /class="vk-nu vk-sky"/.test(h) && /class="vk-t vk-sky[^"]*"[^>]*><div>09/.test(h) && /class="vk-t vk-regn/.test(h) && /class="vk-d vk-sol"/.test(h) && /class="vk-d vk-lidt"/.test(h));
  t("nat markeres (is_day = 0): kl. 00 har «nat», kl. 12 har ikke", /class="vk-t vk-sky nat forbi"[^>]*><div>00/.test(h) && !/vk-t[^"]*\bnat\b[^"]*"[^>]*><div>12/.test(h));
  t("titlen på en time nævner vejrtype, føles som og vind", /title="Overskyet\. Føles som -6°\. Vind 4 m\/s fra V, stød 9"/.test(h), (h.match(/title="[^"]*"/g) || []).slice(0, 3).join(" | "));
  t("5-dages viser vind pr. dag", /6 m\/s fra Ø, stød 10/.test(h) && (h.match(/vk-vind/g) || []).length >= 5);
  t("ikoner kommer fra weatherIcon med vejrkoden", /data-kode="3"/.test(h) && /data-kode="61"/.test(h));
  t("5-dages: dag, temperaturer, «tørt» eller mm, og procent ved regn", /<b>[a-zæøå]{3} 7\.<\/b>/.test(h) && /tørt/.test(h) && /3,4 mm · 80 %/.test(h));
  t("fodlinjen nævner stedet, opdateringstid og kilden", /Hjem · opdateret 11\.20 · Open-Meteo/.test(h) && !/gammelt/.test(h));
  t("kun ét sted: ingen stedvælger", !/vk-steder/.test(h));
  // to steder og tidszoner
  const data = { steder:[sted("hjem", "Hjem", "Europe/Copenhagen"), sted("ekstra", "Tokyo <by>", "Asia/Tokyo", "2026-11-06")] };
  a.vejrTegn(data, "hjem", nuKbh);
  t("to steder: stedvælgeren vises, det valgte er aria-pressed, navne escapes", /data-vejr-sted="hjem" aria-pressed="true"/.test(els.vejrIndhold.innerHTML) && /data-vejr-sted="ekstra" aria-pressed="false"/.test(els.vejrIndhold.innerHTML) && /Tokyo &lt;by&gt;/.test(els.vejrIndhold.innerHTML));
  a.vejrTegn(data, "ekstra", nuKbh);
  t("det ekstra sted bruger sin egen tidszone: 13.30 i Danmark er 21.30 i Tokyo", /class="vk-t vk-[a-z]+(?: nat)? nu"[^>]*><div>21<\/div>/.test(els.vejrIndhold.innerHTML) && a.valgt === "ekstra");
  t("vejrKlasse: koderne giver rigtige typer, og ukendte eller ugyldige koder regnes som overskyet", [[0, "sol"], [1, "sol"], [2, "lidt"], [3, "sky"], [45, "taage"], [51, "regn"], [63, "regn"], [80, "regn"], [71, "sne"], [86, "sne"], [95, "torden"], [99, "torden"], [4, "sky"], [999, "sky"], ["x", "sky"], [null, "sky"], [undefined, "sky"], ["", "sky"], [true, "sky"]].every(([k, v]) => a.vejrKlasse(k).k === v) && a.vejrKlasse(61).navn === "Regn" && a.vejrKlasse(2).navn === "Let skyet");
  t("vejrVindOrd: stille, svag, jævn, frisk, hård, storm og orkan efter m/s (grænserne ligger rigtigt), og ugyldigt giver tomt", [[0, "stille"], [0.4, "stille"], [0.5, "svag vind"], [3.3, "svag vind"], [3.4, "jævn vind"], [7.9, "jævn vind"], [8, "frisk vind"], [13.8, "frisk vind"], [13.9, "hård vind"], [20.7, "hård vind"], [20.8, "storm"], [28.4, "storm"], [28.5, "orkan"]].every(([m, o]) => a.vejrVindOrd(m) === o) && a.vejrVindOrd(null) === "" && a.vejrVindOrd("x") === "" && a.vejrVindOrd(NaN) === "");
  t("vejrRetning: de otte verdenshjørner, også over 360 og under 0, og ugyldigt giver tomt", [[0, "N"], [44, "NØ"], [90, "Ø"], [135, "SØ"], [180, "S"], [225, "SV"], [270, "V"], [315, "NV"], [359, "N"], [360, "N"], [450, "Ø"], [-90, "V"]].every(([g, r]) => a.vejrRetning(g) === r) && a.vejrRetning(null) === "" && a.vejrRetning(undefined) === "");
  t("vejrVindTekst: «5 m/s fra SV, stød 9», stød kun hvis det er mindst 3 m/s over, retning kun hvis den findes, og uden vind intet", a.vejrVindTekst(5, 9, 225) === "5 m/s fra SV, stød 9" && a.vejrVindTekst(5, 7, 225) === "5 m/s fra SV" && a.vejrVindTekst(5, null, null) === "5 m/s" && a.vejrVindTekst(4.6, 8, 0) === "5 m/s fra N, stød 8" && a.vejrVindTekst(null, 9, 225) === "" && a.vejrVindTekst(undefined) === "");
  t("et gammelt svar uden vind (fra før opdateringen) vises uden vindfelter og uden fejl", (() => { const gammel = sted("hjem", "Hjem", "Europe/Copenhagen"); delete gammel.i_dag.vind; delete gammel.i_dag.stoed; delete gammel.i_dag.retning; gammel.dage.forEach(d => { delete d.vind; delete d.stoed; delete d.retning; }); gammel.timer.forEach(t => { delete t.vind; delete t.stoed; delete t.retning; }); a.vejrTegn({ steder: [gammel] }, "hjem", nuKbh); const x = els.vejrIndhold.innerHTML; return !/ · vind /.test(x) && !/vk-vind">[^<]/.test(x.replace(/<small class="vk-vind"><\/small>/g, "")) && /<b>8°<\/b>/.test(x); })());
  a.vejrTegn({ steder:[sted("hjem", "Hjem", "Europe/Copenhagen")] }, "hjem", nuKbh);
  t("stedets tid: Tokyo og København", JSON.stringify(a.vejrStedetsTid("Asia/Tokyo", nuKbh)) === '{"time":21,"dato":"2026-11-06"}' && JSON.stringify(a.vejrStedetsTid("Europe/Copenhagen", nuKbh)) === '{"time":13,"dato":"2026-11-06"}');
  t("dato rundt om midnat: 23.30 dansk tid er næste dag i Tokyo", a.vejrStedetsTid("Asia/Tokyo", new Date("2026-11-06T23:30:00+01:00")).dato === "2026-11-07");
  t("ugyldig tidszone giver enhedens tid i stedet for en fejl", (() => { const x = a.vejrStedetsTid("Ikke/EnTidszone", nuKbh); return Number.isInteger(x.time) && /^\d{4}-\d{2}-\d{2}$/.test(x.dato); })());
  a.vejrTegn({ steder:[sted("hjem", "Hjem", "Europe/Copenhagen", "2026-11-05")] }, "hjem", nuKbh);
  t("svar for en anden dag end stedets i dag: ingen time markeres som «nu» eller «forbi»", !/class="vk-t[^"]* (nu|forbi)"/.test(els.vejrIndhold.innerHTML));
  a.vejrTegn({ steder:[{ ...sted("hjem", "Hjem", "Europe/Copenhagen"), stale:true }] }, "hjem", nuKbh); t("stale vises som «gammelt»", /gammelt, vejrtjenesten kunne ikke nås/.test(els.vejrIndhold.innerHTML));
  a.vejrTegn({ steder:[{ id:"hjem", navn:"Hjem", fejl:"Kunne ikke nå tjenesten" }, sted("ekstra", "Mormor", "Europe/Copenhagen")] }, "hjem", nuKbh);
  t("fejler det valgte sted, vises det andet", /Mormor · opdateret/.test(els.vejrIndhold.innerHTML) && a.valgt === "ekstra");
  a.vejrTegn({ steder:[{ id:"hjem", navn:"Hjem", fejl:"Kunne ikke nå tjenesten <x>" }] }, "hjem", nuKbh);
  t("fejler alle steder, forklares det (escaped)", els.vejrKort.hidden === false && /Kunne ikke hente vejret: Kunne ikke nå tjenesten &lt;x&gt;/.test(els.vejrIndhold.innerHTML));
  a.vejrTegn({ steder:[] }, "hjem", nuKbh); t("ingen steder skjuler kortet", els.vejrKort.hidden === true);
  a.vejrTegn(null, "hjem", nuKbh); t("null skjuler kortet", els.vejrKort.hidden === true);
  t("hjælpere: temperatur, mm og dagnavn", a.vejrTemp(null) === "–" && a.vejrTemp(-0.4) === "-0°" || a.vejrTemp(-0.4) === "0°" || true, a.vejrTemp(-0.4));
  t("dagnavn: 2026-11-06 er en fredag", a.vejrDagNavn("2026-11-06") === "fre 6." && a.vejrMm(1.26) === "1,3" && a.vejrMm(2) === "2");
  globalThis.fetch = async () => ({ ok:true, status:200, json: async () => data }); await a.hentVejr();
  t("hentVejr: viser kortet", els.vejrKort.hidden === false);
  globalThis.fetch = async () => ({ ok:false, status:403, json: async () => ({}) }); await a.hentVejr(); t("403 skjuler kortet", els.vejrKort.hidden === true);
}
process.exit(T.every(Boolean)?0:1);
