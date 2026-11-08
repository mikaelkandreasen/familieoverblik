import fs from "fs";
const code = fs.readFileSync("/tmp/ind_block.js","utf8");

// ── minimal DOM ──
const els = {};
function el(id){
  return els[id] ??= { id, value:"", innerHTML:"", textContent:"", hidden:false, handlers:{}, dataset:{},
    classList:{ toggle(){} }, focus(){}, showModal(){ this.open = true; }, close(){ this.open=false; },
    addEventListener(t,f){ (this.handlers[t] ??= []).push(f); },
    querySelectorAll(){ return []; },
    querySelector(sel){ return sel === '[data-ind="add"]' ? { click: () => fire("indBody","click",{ target: tgt({ "[data-ind]": {dataset:{ind:"add"}} }) }) } : null; },
    append(){} };
}
const $ = id => el(id);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const HEAD = { "X-Ugeplan-Key":"k" };
const document = { createElement: () => ({ addEventListener(){}, set className(v){}, }) };
const tgt = map => ({ id:"", closest: sel => map[sel] ?? null });
async function fire(id, type, ev){ for (const f of el(id).handlers[type] || []) await f(ev); }
const tick = () => new Promise(r => setTimeout(r, 5));

// ── falsk server ──
const srv = { configured:false, connected:false, clientId:"", listId:"", listName:"",
  items:[{id:"AAAAAAAA1",title:"Mælk",important:false}], lists:[{id:"LIST0001",name:"Indkøb",isShared:true,isOwner:true}], calls:[] };
globalThis.fetch = async (url, opt={}) => {
  const u = new URL(url, "http://x/"); const action = u.searchParams.get("action") || "";
  const body = opt.body ? JSON.parse(opt.body) : null;
  srv.calls.push((opt.method||"GET")+" "+action);
  const ok = d => ({ ok:true, status:200, json: async () => d });
  const fail = (st,m,kind="") => ({ ok:false, status:st, json: async () => ({error:m, kind}) });
  const status = () => ({configured:srv.configured, connected:srv.connected, clientId:srv.clientId, listId:srv.listId, listName:srv.listName});
  if (!action) return ok(status());
  if (action==="config"){ srv.configured=true; srv.clientId=body.client_id; return ok({authUrl:"https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize?a=1&b=2"}); }
  if (action==="connect"){ if(!body.redirect.includes("code=")) return fail(400,"ingen kode"); srv.connected=true; return ok(status()); }
  if (action==="lists"){ return srv.connected ? ok({lists:srv.lists}) : fail(409,"nej","not_connected"); }
  if (action==="setlist"){ srv.listId=body.id; srv.listName="Indkøb"; return ok(status()); }
  if (action==="items"){ if(!srv.listId) return fail(409,"vælg liste","no_list"); return ok({items:srv.items.slice(), listName:srv.listName}); }
  if (action==="add"){ const it={id:"NEW"+srv.items.length+"00000",title:body.title,important:false}; srv.items.push(it); return ok({item:it}); }
  if (action==="done"){ srv.items = srv.items.filter(x=>x.id!==body.id); return ok({ok:true}); }
  if (action==="disconnect"){ srv.connected=false; return ok(status()); }
  return fail(400,"?");
};

eval(code);   // definerer ind, indApi, ... og binder handlers
const T = [];
const t = (navn, ok) => { T.push(ok); console.log(ok ? "ok  " : "FEJL", navn); };

// 1. åbn → ikke forbundet → opsætning
await fire("indKnap","click"); await tick();
t("opsætning vises", el("indBody").innerHTML.includes("Application (client) ID") && el("indBody").innerHTML.includes("Fortsæt"));
t("hent-knap skjult", el("indHent").hidden === true);

// 2. config → login-link
el("indCid").value = "12345678-1234-1234-1234-123456789abc";
await fire("indBody","click",{ target: tgt({"[data-ind]":{dataset:{ind:"config"}}}) }); await tick();
t("login-link vises", el("indBody").innerHTML.includes("Åbn Microsoft-login") && el("indBody").innerHTML.includes("&amp;b=2"));
t("client-id huskes i feltet", el("indBody").innerHTML.includes('value="12345678-1234-1234-1234-123456789abc"'));

// 3. connect uden adresse → fejl, og med adresse → listevalg
el("indRed").value = "";
await fire("indBody","click",{ target: tgt({"[data-ind]":{dataset:{ind:"connect"}}}) }); await tick();
t("tom adresse giver besked", el("indMsg").textContent.includes("Sæt adressen"));
el("indRed").value = "http://localhost/?code=abc&state=xyz";
await fire("indBody","click",{ target: tgt({"[data-ind]":{dataset:{ind:"connect"}}}) }); await tick(); await tick();
t("listevalg efter forbindelse", el("indBody").innerHTML.includes("Hvilken liste er indkøbssedlen?") && el("indBody").innerHTML.includes("(delt)"));

// 4. vælg liste → varer
await fire("indBody","click",{ target: tgt({"[data-ind-liste]":{dataset:{indListe:"LIST0001"}}}) }); await tick();
t("varer vises", el("indBody").innerHTML.includes("Mælk") && el("indBody").innerHTML.includes('id="indNy"'));
t("hent-knap synlig", el("indHent").hidden === false);

// 5. tilføj
el("indNy").value = "Brød";
await fire("indBody","click",{ target: tgt({"[data-ind]":{dataset:{ind:"add"}}}) }); await tick();
t("ny vare på listen", el("indBody").innerHTML.includes("Brød") && srv.items.some(x=>x.title==="Brød"));

// 6. Enter i feltet tilføjer
el("indNy").value = "Æg";
await fire("indBody","keydown",{ key:"Enter", target:{id:"indNy"}, preventDefault(){} }); await tick(); await tick();
t("Enter tilføjer", srv.items.some(x=>x.title==="Æg"));

// 7. afkryds
const id = srv.items.find(x=>x.title==="Mælk").id;
await fire("indBody","click",{ target: tgt({"[data-ind-done]":{dataset:{indDone:id}}}) }); await tick(); await tick();
t("afkrydset vare væk lokalt og på serveren", !el("indBody").innerHTML.includes(`data-ind-done="${id}"`) && !srv.items.some(x=>x.id===id));
t("besked om afkrydsning", el("indMsg").textContent.includes("Mælk er afkrydset"));

// 8. HTML-escaping
srv.items.push({id:"XSS000001",title:'<img src=x onerror=alert(1)>',important:false});
await fire("indHent","click"); await tick(); await tick();
t("titler escapes", !el("indBody").innerHTML.includes("<img") && el("indBody").innerHTML.includes("&lt;img"));

// 9. afbryd kræver to tryk
const knap = { dataset:{ind:"afbryd"}, textContent:"Afbryd forbindelsen" };
await fire("indBody","click",{ target: tgt({"[data-ind]":knap}) }); await tick();
t("første tryk afbryder ikke", srv.connected === true && knap.textContent.includes("igen"));
await fire("indBody","click",{ target: tgt({"[data-ind]":knap}) }); await tick(); await tick();
t("andet tryk afbryder", srv.connected === false && el("indBody").innerHTML.includes("Application (client) ID"));

process.exit(T.every(Boolean) ? 0 : 1);
