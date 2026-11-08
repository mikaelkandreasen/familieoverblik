import fs from "fs";
// ───── Del 1: dialogen i index.html ─────
{
const code = fs.readFileSync("/tmp/st_block.js","utf8");
const els = {};
function el(id){ return els[id] ??= { id, value:"", innerHTML:"", textContent:"", hidden:false, handlers:{}, dataset:{}, classList:{toggle(){}},
  addEventListener(t,f){ (this.handlers[t] ??= []).push(f); }, showModal(){}, close(){}, querySelectorAll(){ return []; } }; }
const $ = id => el(id);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const PEOPLE = [
  { id:"alle", name:"Alle", color:"var(--p-alle)" }, { id:"voksen1", name:"Anna", color:"var(--p-1)" },
  { id:"voksen2", name:"Peter", color:"var(--p-2)" }, { id:"barn1", name:"Sofie", color:"var(--p-3)" } ];
const srv = { configured:false, clientId:"", antal:3, personer:[], forbundet:{}, calls:[] };
globalThis.fetch = async (url, opt={}) => {
  const action = new URL(url,"http://x/").searchParams.get("action") || "";
  const body = opt.body ? JSON.parse(opt.body) : null;
  srv.calls.push({ action, body });
  const ok = d => ({ ok:true, status:200, json: async () => d });
  const fail = (st,m,kind="") => ({ ok:false, status:st, json: async () => ({ error:m, kind }) });
  const status = () => ({ configured:srv.configured, clientId:srv.clientId, antal:srv.antal, personer:srv.personer.slice(), forbundet:{...srv.forbundet} });
  if (!action) return ok(status());
  if (action === "app"){ if (!/^\d+$/.test(body.clientId)) return fail(400,"Client ID er et tal"); srv.configured = true; srv.clientId = body.clientId; return ok(status()); }
  if (action === "login") return ok({ authUrl:"https://www.strava.com/oauth/authorize?client_id=1&state=abc&scope=activity%3Aread" });
  if (action === "connect"){ if (!body.redirect.includes("code=")) return fail(400,"ingen kode"); srv.forbundet.voksen1 = { navn:"Anna" }; srv.personer.push("voksen1"); return ok(status()); }
  if (action === "disconnect"){ delete srv.forbundet[body.person]; srv.personer = srv.personer.filter(x=>x!==body.person); return ok(status()); }
  if (action === "settings"){ srv.antal = body.antal; srv.personer = body.personer; return ok(status()); }
  return fail(400,"?");
};
new Function("$","esc","PEOPLE","HEAD", code)($, esc, PEOPLE, {});
const tick = () => new Promise(r => setTimeout(r, 5));
const fire = async (id, type, ev={}) => { for (const f of el(id).handlers[type] || []) await f(ev); };
const tgt = m => ({ id:"", closest: sel => m[sel] ?? null });
const T=[]; const t=(n,ok,x="")=>{T.push(ok);console.log(ok?"ok  ":"FEJL","[dialog]",n,ok?"":x)};

await fire("stKnap","click"); await tick();
t("opsætning vises først", /Authorization Callback Domain/.test(el("stBody").innerHTML) && /Client Secret/.test(el("stBody").innerHTML));
el("stCid").value = "abc"; el("stSec").value = "x";
await fire("stBody","click",{ target: tgt({"[data-st]":{dataset:{st:"app-gem"}}}) }); await tick();
t("fejl fra serveren vises", /Client ID er et tal/.test(el("stMsg").textContent));
el("stCid").value = "123456"; el("stSec").value = "a".repeat(40);
await fire("stBody","click",{ target: tgt({"[data-st]":{dataset:{st:"app-gem"}}}) }); await tick();
const html1 = el("stBody").innerHTML;
t("personliste efter gem (uden Alle)", /Anna/.test(html1) && /Peter/.test(html1) && /Sofie/.test(html1) && !/<b>Alle<\/b>/.test(html1));
t("secret sendes ikke tilbage i siden", !html1.includes("a".repeat(40)));
t("antal-valg 1-10 med 3 valgt", (html1.match(/<option/g)||[]).length === 10 && /value="3" selected/.test(html1));
t("advarsel om Stravas vilkår", /kun, at en persons aktiviteter vises for personen selv/.test(html1));

await fire("stBody","click",{ target: tgt({"[data-st-forbind]":{dataset:{stForbind:"voksen1"}}}) }); await tick();
const html2 = el("stBody").innerHTML;
t("login-link og indsæt-felt vises", /Åbn Strava/.test(html2) && /id="stRed"/.test(html2) && /state=abc&amp;scope/.test(html2));
el("stRed").value = "";
await fire("stBody","click",{ target: tgt({"[data-st]":{dataset:{st:"connect"}}}) }); await tick();
t("tom adresse giver besked", /Sæt adressen/.test(el("stMsg").textContent));
el("stRed").value = "http://localhost/?state=abc&code=XYZ&scope=read,activity:read";
await fire("stBody","click",{ target: tgt({"[data-st]":{dataset:{st:"connect"}}}) }); await tick();
const html3 = el("stBody").innerHTML;
t("Anna er forbundet og vises", /Forbundet som Anna/.test(html3) && /data-st-vis="voksen1" checked/.test(html3));
t("Sofie har stadig Forbind-knap", /data-st-forbind="barn1"/.test(html3));

// slå Vis fra
await fire("stBody","change",{ target:{ closest: s => s==="[data-st-vis]" ? { dataset:{stVis:"voksen1"}, checked:false } : null, id:"" } }); await tick(); await tick();
const sidste = srv.calls.filter(c=>c.action==="settings").at(-1);
t("Vis fra sender tom liste", sidste && sidste.body.personer.length===0 && sidste.body.antal===3, JSON.stringify(sidste));
// ændr antal
el("stAntalSel").value = "5";
await fire("stBody","change",{ target:{ id:"stAntalSel", value:"5", closest: () => null } }); await tick(); await tick();
const s2 = srv.calls.filter(c=>c.action==="settings").at(-1);
t("antal 5 gemmes", s2.body.antal===5, JSON.stringify(s2));

// afbryd kræver to tryk
const knap = { dataset:{ stAfbryd:"voksen1" }, textContent:"Afbryd" };
await fire("stBody","click",{ target: tgt({"[data-st-afbryd]":knap}) }); await tick();
t("første tryk afbryder ikke", srv.forbundet.voksen1 !== undefined && knap.textContent==="Tryk igen");
await fire("stBody","click",{ target: tgt({"[data-st-afbryd]":knap}) }); await tick(); await tick();
t("andet tryk afbryder", srv.forbundet.voksen1 === undefined);
process.exitCode = T.every(Boolean) ? 0 : 1;
}

// ───── Del 2: kortet i overblik.html ─────
{
const code = fs.readFileSync("/tmp/stov_block.js","utf8");
const els = {};
const $ = id => (els[id] ??= { hidden:true, innerHTML:"" });
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const PEOPLE = [ { id:"alle", name:"Alle", color:"c0" }, { id:"voksen1", name:"Anna", color:"var(--p-1)" }, { id:"barn1", name:"Sofie", color:"var(--p-3)" } ];
const whoOf = id => PEOPLE.find(p => p.id === id) || null;
const fns = new Function("$","esc","PEOPLE","whoOf", code + "; return { stTegn, stKm, stTid, stDag };")($, esc, PEOPLE, whoOf);
const T=[]; const t=(n,ok,x="")=>{T.push(ok);console.log(ok?"ok  ":"FEJL","[kort]",n,ok?"":x)};
const nu = new Date(2026,10,5,12,0);
t("km: 5,2 km", fns.stKm(5230) === "5,2 km"); t("km: styrketræning uden afstand", fns.stKm(0) === "");
t("tid: 28 min / 1 t 05 min", fns.stTid(1680) === "28 min" && fns.stTid(3900) === "1 t 05 min", fns.stTid(3900));
t("dag: i dag / i går / ældre", fns.stDag("2026-11-05T07:12:03", nu)==="i dag" && fns.stDag("2026-11-04T19:00:00", nu)==="i går" && fns.stDag("2026-11-01T08:00:00", nu)==="søn 1. nov", fns.stDag("2026-11-01T08:00:00", nu));
const data = { antal:2, fejl:{ barn1:"Forbindelsen til Strava er udløbet. Forbind igen." }, personer:[
  { id:"barn1", athlete:"Sofie", stale:false, items:[ { id:"1", navn:"Fodbold <b>træning</b>", sport:"Soccer", afstand:0, tid:3600, start:"2026-11-04T16:00:00", url:"https://www.strava.com/activities/1" } ] },
  { id:"voksen1", athlete:"Anna", stale:true, items:[
    { id:"2", navn:"Morgentur", sport:"Run", afstand:5230, tid:1680, start:"2026-11-05T07:12:03", url:"https://www.strava.com/activities/2" },
    { id:"3", navn:"Cykeltur", sport:"Ride", afstand:32100, tid:4500, start:"2026-11-03T10:00:00", url:"javascript:alert(1)" } ] } ] };
fns.stTegn(data, nu);
const h = els.stListe.innerHTML;
t("kortet vises", els.stKort.hidden === false);
t("personer i PEOPLE-rækkefølge (Anna før Sofie)", h.indexOf("Anna") < h.indexOf("Sofie"));
t("ikon og meta", /🏃/.test(h) && /5,2 km · 28 min · i dag/.test(h) && /⚽/.test(h) && /1 t 00 min · i går/.test(h), h.slice(0,300));
t("stale markeres", /\(ikke opdateret\)/.test(h));
t("farlig url giver ingen href", !/javascript:/.test(h) && (h.match(/href="https:\/\/www\.strava\.com\/activities\//g)||[]).length === 2);
t("titel escapes", !/<b>træning<\/b>/.test(h) && /&lt;b&gt;træning&lt;\/b&gt;/.test(h));
t("fejl for person vises med navn", /Sofie: Forbindelsen til Strava er udløbet/.test(h));
t("Se på Strava ved hver aktivitet", (h.match(/Se på Strava/g)||[]).length === 3);
fns.stTegn({ personer:[] }, nu);
t("ingen personer skjuler kortet", els.stKort.hidden === true);
fns.stTegn({ personer:[{ id:"voksen1", items:[] }] }, nu);
t("tom aktivitetsliste", els.stKort.hidden === false && /Ingen aktiviteter/.test(els.stListe.innerHTML));
process.exitCode = process.exitCode || (T.every(Boolean) ? 0 : 1);
}
