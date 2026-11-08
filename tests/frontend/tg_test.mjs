import fs from "fs";
const T=[]; const t=(n,ok,x="")=>{T.push(ok);console.log(ok?"ok  ":"FEJL",n,ok?"":x)};
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const tick = () => new Promise(r => setTimeout(r, 5));
const mkEls = () => { const els = {}; const el = id => (els[id] ??= { id, value:"", checked:true, innerHTML:"", textContent:"", hidden:false, disabled:false, dataset:{}, handlers:{}, opened:false,
  addEventListener(t,f){ (this.handlers[t] ??= []).push(f); }, showModal(){ this.opened = true; }, close(){ this.opened = false; },
  querySelector(sel){ return sel.startsWith("button") ? el("knap") : (this._img ??= { addEventListener(){}, parentElement:{} }); } }); return { els, el }; };
const fire = async (el, id, type, ev={}) => { for (const f of el(id).handlers[type] || []) await f({ preventDefault(){}, ...ev }); };

const strip = (slug, dato="2026-11-05") => ({ slug, titel:`${slug} by X for ${dato}`, imageUrl:`https://featureassets.gocomics.com/assets/${slug}-${dato}`, pageUrl:`https://www.gocomics.com/${slug}/${dato.replaceAll("-","/")}` });
const hist = { calvinandhobbes: ["2026-11-05","2026-11-04","2026-11-02","2026-10-30"], garfield: ["2026-11-05"] };
// De seneste 90 dage fra i går (2026-11-05), som serveren sender dem. Hentede dage har billede og adresser.
const dageListe = slug => Array.from({ length: 90 }, (_, k) => { const d = new Date(Date.UTC(2026, 10, 5 - k)); const dato = d.toISOString().slice(0, 10);
  return (hist[slug] || []).includes(dato) ? { dato, gemt: true, ...strip(slug, dato) } : { dato, gemt: false }; });

// ───── indstillinger i index.html ─────
{
const { els, el } = mkEls();
const $ = id => el(id);
const code = fs.readFileSync("/tmp/tg_block.js","utf8");
const srv = { slug:"calvinandhobbes", enabled:true, calls:[], ryddet:[] };
globalThis.fetch = async (url, opt={}) => {
  const u = new URL(url,"http://x/"); const action = u.searchParams.get("action") || "";
  const body = opt.body ? JSON.parse(opt.body) : null;
  srv.calls.push({ action, body, slug:u.searchParams.get("slug") });
  const ok = d => ({ ok:true, status:200, json: async () => d });
  const fail = (st,m) => ({ ok:false, status:st, json: async () => ({ error:m }) });
  if (action === "settings") return ok({ slug:srv.slug, enabled:srv.enabled });
  if (action === "") return ok({ enabled:srv.enabled, ...strip(srv.slug) });
  if (action === "liste"){ srv.listeKald = (srv.listeKald || 0) + 1; if (srv.listeFejl) return fail(502, srv.listeFejl);
    return ok({ stale: !!srv.listeStale, tegneserier:[ { slug:"doonesbury", navn:"Doonesbury" }, { slug:"bignate", navn:"Big Nate" }, { slug:"bc", navn:"B.C." }, { slug:'x"><script', navn:"Ond" }, { slug:"peanuts", navn:"Peanuts <b>" } ] }); }
  if (action === "historik"){ const slug = u.searchParams.get("slug") || srv.slug; return ok({ slug, dageGemt:90, dage:dageListe(slug), tegneserier:[] }); }
  if (action === "ryd"){ srv.ryddet.push(body.slug); hist[body.slug] = []; return ok({ ok:true, slug:body.slug }); }
  if (action === "save"){
    if (body.slug === "findesikke") return fail(422, "Fandt ikke den tegneserie på GoComics.");
    srv.slug = body.slug; srv.enabled = body.enabled;
    return ok({ slug:body.slug, enabled:body.enabled, ...(body.enabled ? { strip: { ...strip(body.slug), ...(srv.fallback ? { fallback:true } : {}) } } : {}) });
  }
  return fail(400,"?");
};
new Function("$","esc","HEAD", code)($, esc, {});
await tick(); await tick(); await tick();

t("sektion vist, C&H valgt", el("tgSek").hidden === false && /value="calvinandhobbes" selected/.test(el("tgValg").innerHTML));
t("13 faste valg + Andet", (el("tgValg").innerHTML.match(/<option/g)||[]).length === 14 && /__andet/.test(el("tgValg").innerHTML));
t("forhåndsvisning med no-referrer", /assets\/calvinandhobbes-2026-11-05/.test(el("tgForhaand").innerHTML) && /referrerpolicy="no-referrer"/.test(el("tgForhaand").innerHTML));
t("historik-info: 4 af 90 dage hentet, 30. okt til 5. nov", /4 af de seneste 90 dage er hentet \(30\. okt til 5\. nov\)/.test(el("tgHistInfo").textContent), el("tgHistInfo").textContent);
t("info siger at resten hentes når de åbnes, og at billeder ikke gemmes", /hentes, første gang de åbnes/.test(el("tgHistInfo").textContent) && /ikke billederne/.test(el("tgHistInfo").textContent));
t("ryd-knap vises", el("tgRyd").hidden === false && el("tgRyd").dataset.slug === "calvinandhobbes");

el("tgValg").value = "garfield";
await fire(el,"tgForm","submit"); await tick(); await tick(); await tick();
const gem = srv.calls.filter(c=>c.action==="save").at(-1);
t("gemmer garfield", gem.body.slug === "garfield" && gem.body.enabled === true);
t("historik-info skifter til garfield (1 af 90)", /1 af de seneste 90 dage er hentet/.test(el("tgHistInfo").textContent) && el("tgRyd").dataset.slug === "garfield", el("tgHistInfo").textContent);

await fire(el,"tgRyd","click");
t("første tryk sletter ikke", srv.ryddet.length === 0 && /Tryk igen/.test(el("tgRyd").textContent));
await fire(el,"tgRyd","click"); await tick(); await tick(); await tick();
t("andet tryk sletter garfield", srv.ryddet.join() === "garfield" && /ryddet/.test(el("tgInfo").textContent));
t("info efter ryd: ingen hentet, knap skjult", /ingen dage hentet endnu/.test(el("tgHistInfo").textContent) && el("tgRyd").hidden === true, el("tgHistInfo").textContent);
t("knaptekst nulstillet", el("tgRyd").textContent === "Ryd historikken for denne tegneserie");

el("tgValg").value = "__andet"; el("tgAndet").value = "findesikke";
await fire(el,"tgForm","submit"); await tick(); await tick();
t("serverfejl vises", /Fandt ikke den tegneserie/.test(el("tgFejl").textContent) && el("tgInfo").textContent === "");
el("tgValg").value = "__andet"; el("tgAndet").value = "  ";
const før = srv.calls.length;
await fire(el,"tgForm","submit"); await tick();
t("tomt navn afvises uden kald", srv.calls.length === før);

// ── listen over alle tegneserier (A–Z-siden) ──
t("listen hentes IKKE ved opstart (kun når feltet bruges)", !srv.listeKald);
srv.listeFejl = "Kunne ikke læse listen over tegneserier fra GoComics (fandt 0). Siden kan have ændret form. Skriv navnet selv.";
await fire(el,"tgAndet","focus"); await tick(); await tick();
t("fejl ved listen: forklares, og man kan skrive selv", /Kunne ikke hente listen \(Kunne ikke læse listen/.test(el("tgListeInfo").textContent) && /Skriv navnet selv/.test(el("tgListeInfo").textContent) && el("tgListe").innerHTML === "", el("tgListeInfo").textContent);
srv.listeFejl = null;
await fire(el,"tgAndet","focus"); await tick(); await tick();
t("næste gang feltet bruges, prøves igen og listen fyldes", srv.listeKald === 2 && /4 tegneserier fra GoComics' A–Z-side/.test(el("tgListeInfo").textContent), el("tgListeInfo").textContent);
t("valgmulighederne er «Navn (slug)», og ugyldige slugs frasorteres", /value="Doonesbury \(doonesbury\)"/.test(el("tgListe").innerHTML) && /value="B\.C\. \(bc\)"/.test(el("tgListe").innerHTML) && !/script/.test(el("tgListe").innerHTML) && (el("tgListe").innerHTML.match(/<option/g) || []).length === 4, el("tgListe").innerHTML);
t("navne escapes i listen", /Peanuts &lt;b&gt; \(peanuts\)/.test(el("tgListe").innerHTML));
await fire(el,"tgAndet","focus"); await tick();
t("listen hentes ikke igen, når den først er hentet", srv.listeKald === 2);

const gemSlug = async v => { el("tgValg").value = "__andet"; el("tgAndet").value = v; const n = srv.calls.length; await fire(el,"tgForm","submit"); await tick(); await tick(); return srv.calls.slice(n).filter(c => c.action === "save").at(-1)?.body.slug; };
t("vælg fra listen: «Big Nate (bignate)» → bignate", await gemSlug("Big Nate (bignate)") === "bignate");
t("skriv kun navnet fra listen: «b.c.» → bc", await gemSlug("b.c.") === "bc");
t("skriv selv navnet efter gocomics.com/ → uændret", await gemSlug("doonesbury") === "doonesbury");
t("hele adressen sendes videre til serveren som den er", await gemSlug("https://www.gocomics.com/calvinandhobbes/2026/11/05") === "https://www.gocomics.com/calvinandhobbes/2026/11/05");
srv.fallback = true;
await gemSlug("Big Nate (bignate)");
t("findes gårsdagens datoside ikke, siger indstillingerne det", /findes ikke for den tegneserie, så kortet viser den seneste strip/.test(el("tgInfo").textContent), el("tgInfo").textContent);
srv.fallback = false;
await gemSlug("Big Nate (bignate)");
t("uden fallback står der ikke noget om det", !/seneste strip/.test(el("tgInfo").textContent));
}

// ───── kort + historik i overblik.html ─────
{
hist.garfield = ["2026-11-05"]; hist.calvinandhobbes = ["2026-11-05","2026-11-04","2026-11-02","2026-10-30"];
const { els, el } = mkEls();
const $ = id => el(id);
const code = fs.readFileSync("/tmp/tgov_block.js","utf8");
let svar = null; const dagKald = []; let dagSvar = null;
globalThis.fetch = async (url) => {
  const u = new URL(url,"http://x/"); const slug = u.searchParams.get("slug") || "calvinandhobbes"; const action = u.searchParams.get("action");
  if (action === "dag"){
    const dato = u.searchParams.get("dato"); dagKald.push({ slug, dato });
    if (dagSvar) return dagSvar(dato);
    const d = strip(slug, dato); (hist[slug] ??= []).push(dato);
    return { ok:true, status:200, json: async () => ({ slug, dag:{ dato, ...d } }) };
  }
  if (svar) return svar;
  return { ok:true, status:200, json: async () => ({ slug, dageGemt:90, dage:dageListe(slug), tegneserier:[{slug:"calvinandhobbes",antal:4},{slug:"garfield",antal:1}] }) };
};
const fns = new Function("$","esc","HEAD", code + "; return { tgTegn, tgHistAabn, tgHistGaa, tgDatoTekst, tgHistHentDag, get h(){ return tgH; } };")($, esc, {});

const ok = { enabled:true, ...strip("calvinandhobbes"), dato:"2026-11-05", stale:false };
fns.tgTegn(ok);
const h = el("tgIndhold").innerHTML;
t("kort vises med billede, link og no-referrer", el("tgKort").hidden === false && /calvinandhobbes-2026-11-05/.test(h) && /Se på GoComics/.test(h) && /referrerpolicy="no-referrer"/.test(h));
t("kortet viser datoen (tor 5. nov) og linket er datosiden", /tor 5\. nov/.test(h) && /href="https:\/\/www\.gocomics\.com\/calvinandhobbes\/2026\/11\/05"/.test(h), h.slice(0, 400));
fns.tgTegn({ ...ok, fallback:true }); t("fallback forklares", /seneste, for gårsdagens findes ikke/.test(el("tgIndhold").innerHTML));
fns.tgTegn({ ...ok, stale:true }); t("ikke opdateret vises", /ikke opdateret/.test(el("tgIndhold").innerHTML));
fns.tgTegn({ ...ok, imageUrl:"https://evil.example/x.png" });
t("billede fra anden vært skjuler kortet", el("tgKort").hidden === true);

await fns.tgHistAabn(); await tick();
const k = () => el("tgHistKrop").innerHTML;
t("dialogen åbnes med i går først, uden at hente noget", el("tgHistDlg").opened === true && /calvinandhobbes-2026-11-05/.test(k()) && dagKald.length === 0, k().slice(0, 100));
t("tæller: Dag 1 af 90", /Dag 1 af 90 \(de seneste 90 dage\)/.test(k()));
t("Nyere deaktiveret, Ældre aktiv", /data-tg-nav="nyere" disabled/.test(k()) && !/data-tg-nav="aeldre" disabled/.test(k()));
t("serievalg vises når flere serier", /id="tgHistSerie"/.test(k()) && /garfield \(1\)/.test(k()));
t("datovalg: alle 90 dage", (k().match(/<option value="\d+"/g)||[]).length === 90);
t("dato-tekst: tor 5. nov", /tor 5\. nov/.test(k()));

await fire(el,"tgHistKrop","click",{ target:{ closest: s => s==="[data-tg-nav]" ? { dataset:{ tgNav:"aeldre" } } : null } });
t("Ældre: 4. nov er hentet i forvejen, så der hentes ikke", /Dag 2 af 90/.test(k()) && /calvinandhobbes-2026-11-04/.test(k()) && dagKald.length === 0);
await fire(el,"tgHistKrop","click",{ target:{ closest: s => s==="[data-tg-nav]" ? { dataset:{ tgNav:"aeldre" } } : null } });
t("Ældre: 3. nov er ikke hentet → «Henter fra GoComics …» og ét kald med den dato", /Dag 3 af 90/.test(k()) && dagKald.length === 1 && dagKald[0].dato === "2026-11-03" && dagKald[0].slug === "calvinandhobbes" && /Henter fra GoComics/.test(k()), JSON.stringify(dagKald) + k().slice(0,200));
await tick(); await tick();
t("svaret ruller ind: billedet for 3. nov vises, datosiden som link", /calvinandhobbes-2026-11-03/.test(k()) && /gocomics\.com\/calvinandhobbes\/2026\/11\/03/.test(k()) && !/Henter fra/.test(k()), k().slice(0, 300));
fns.tgHistGaa("nyere"); fns.tgHistGaa("aeldre"); await tick();
t("frem og tilbage henter ikke igen", dagKald.length === 1);

// datovalg til en ældre dag
await fire(el,"tgHistKrop","change",{ target:{ id:"tgHistDato", value:"10" } }); await tick(); await tick();
t("datovalg hopper til 26. okt og henter den dag", /Dag 11 af 90/.test(k()) && dagKald.at(-1).dato === "2026-10-26" && /calvinandhobbes-2026-10-26/.test(k()), JSON.stringify(dagKald.at(-1)));
// fejl ved en dag: ingen løkke
dagSvar = async () => ({ ok:false, status:422, json: async () => ({ error:"GoComics har ingen strip for 2026-10-25 (siden viste 2026-10-24)." }) });
const før = dagKald.length;
fns.tgHistGaa("aeldre"); await tick(); await tick(); await tick();
t("fejl vises ved den dag, med datosiden som link", /Kunne ikke hente stripen for den dag: GoComics har ingen strip for 2026-10-25/.test(k()) && /gocomics\.com\/calvinandhobbes\/2026\/10\/25/.test(k()), k().slice(0, 400));
t("fejlen giver ét forsøg og ingen løkke", dagKald.length === før + 1);
fns.tgHistGaa("nyere"); fns.tgHistGaa("aeldre"); await tick(); await tick();
t("tilbage til den fejlede dag prøver ikke igen af sig selv", dagKald.length === før + 1 && /Kunne ikke hente/.test(k()));
dagSvar = null;

// kapløb: man går videre, mens en dag hentes
let slip; dagSvar = () => new Promise(r => { slip = () => r({ ok:true, status:200, json: async () => ({ slug:"calvinandhobbes", dag:{ dato:"2026-10-23", ...strip("calvinandhobbes","2026-10-23") } }) }); });
fns.tgHistGaa("aeldre"); await tick();                    // 24. okt starter en hentning, der hænger
const idag = fns.h.i;
await fire(el,"tgHistKrop","change",{ target:{ id:"tgHistDato", value:"0" } });
const nyere = k();
dagSvar = null; slip && slip(); await tick(); await tick();
t("kapløb: et sent svar ændrer ikke den dag, du kigger på nu", fns.h.i === 0 && k() === nyere && /Dag 1 af 90/.test(k()), k().slice(0, 100));

// skift serie
await fire(el,"tgHistKrop","change",{ target:{ id:"tgHistSerie", value:"garfield" } }); await tick();
t("serieskift henter garfields dage", fns.h.slug === "garfield" && fns.h.dage.length === 90 && /Dag 1 af 90/.test(k()) && /garfield-2026-11-05/.test(k()));

// fejl og sikkerhed
svar = { ok:false, status:404, json: async () => ({}) };
await fns.tgHistAabn(); await tick();
t("404 forklares", /findes ikke på serveren endnu/.test(k()));
svar = null;
const orig = globalThis.fetch; let evilKald = 0;
globalThis.fetch = async (url) => { const u = new URL(url,"http://x/");
  if (u.searchParams.get("action") === "dag"){ evilKald++; return { ok:true, status:200, json: async () => ({ slug:"calvinandhobbes", dag:{ dato:"2026-11-05", titel:"<b>x</b>", imageUrl:"https://evil.example/a.png", pageUrl:"javascript:alert(1)" } }) }; }
  return { ok:true, status:200, json: async () => ({ slug:"calvinandhobbes", dageGemt:90, tegneserier:[], dage:[ { dato:"2026-11-05", gemt:true, titel:"<b>x</b>", imageUrl:"https://evil.example/a.png", pageUrl:"javascript:alert(1)" } ] }) }; };
await fns.tgHistAabn(); await tick(); await tick(); await tick();
const hh = k();
t("ukendt billedvært: intet billede, escaped titel, ingen javascript:-link, kun ét forsøg", /Billedet kommer fra en adresse, som ikke bruges/.test(hh) && !/evil\.example/.test(hh) && !/javascript:/.test(hh) && /&lt;b&gt;x&lt;\/b&gt;/.test(hh) && evilKald === 1, hh.slice(0, 300) + evilKald);
t("år vises for strips fra andre år", fns.tgDatoTekst("2025-12-24", new Date(2026,10,5)) === "ons 24. dec 2025", fns.tgDatoTekst("2025-12-24", new Date(2026,10,5)));
}
process.exit(T.every(Boolean)?0:1);
