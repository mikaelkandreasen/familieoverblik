import fs from "fs";
const T=[]; const t=(n,ok,x="")=>{T.push(ok);console.log(ok?"ok  ":"FEJL",n,ok?"":x)};
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const tick = () => new Promise(r => setImmediate(r));

// ───── kortet i overblik.html ─────
{
const els = {}; const $ = id => (els[id] ??= { hidden:true, innerHTML:"", textContent:"" });
const f = new Function("$","esc","HEAD", fs.readFileSync("/tmp/bilov_block.js","utf8") + "; return { bilTegn, bilDag };")($, esc, {});
const nu = new Date(2026,10,5,12,30);
const iso = (d,h,m) => new Date(2026,10,d,h,m,10).toISOString();
const base = { aktiv:true, maxFriske:2, status:{ soc:63, plugged:true, charging:false, rangeKm:280, bil12v:88, navn:"IONIQ 6",
  opdateret: iso(5,12,0), kilde:"frisk", tidspunkt:"12:00", note:null, fejl:null, bilTid: iso(4,22,41) },
  iDag:[ {t:iso(5,6,15),soc:62,kilde:"gemt"}, {t:iso(5,12,0),soc:63,kilde:"frisk"} ] };
f.bilTegn(base, nu);
const h = els.bilKrop.innerHTML;
t("kortet vises", els.bilKort.hidden === false);
t("batteri 63 %", /<b>63 %<\/b>/.test(h) && /width:63%/.test(h));
t("sat til, rækkevidde og 12 V", /Sat til/.test(h) && /Rækkevidde <b>280 km<\/b>/.test(h) && /12 V <b>88 %<\/b>/.test(h));
t("hentet i dag 12.00, frisk", /Hentet i dag 12\.00 · frisk fra bilen/.test(h), h.match(/Hentet[^<]*/));
t("bilen meldte sidst i går 22.41", /bilen meldte sidst i går 22\.41/.test(h), h.match(/bilen meldte[^<]*/));
t("dagens aflæsninger", /I dag: 06\.15 62 % · 12\.00 63 % \(frisk\)/.test(h), h.match(/I dag:[^<]*/));
t("ikke gammel", els.bilPill.hidden === true);
t("ingen fejl", !/bil-fejl/.test(h));

f.bilTegn({ ...base, status:{ ...base.status, soc:15, charging:true, kilde:"gemt" } }, nu);
t("lavt batteri markeres, lader", /class="lav"/.test(els.bilKrop.innerHTML) && /<b>Lader<\/b>/.test(els.bilKrop.innerHTML) && /gemt hos Hyundai/.test(els.bilKrop.innerHTML));
f.bilTegn({ ...base, status:{ ...base.status, plugged:false } }, nu);
t("ikke sat til", /Ikke sat til/.test(els.bilKrop.innerHTML));
f.bilTegn({ ...base, status:{ ...base.status, plugged:null, rangeKm:null, bil12v:null, bilTid:null } }, nu);
t("manglende felter udelades uden fejl", !/Rækkevidde|12 V|meldte sidst/.test(els.bilKrop.innerHTML) && /63 %/.test(els.bilKrop.innerHTML));
f.bilTegn({ ...base, status:{ ...base.status, opdateret: iso(4,18,0) } }, nu);
t("over 14 timer gammel: pille 'gammel'", els.bilPill.hidden === false && els.bilPill.textContent === "gammel");
f.bilTegn({ ...base, status:{ ...base.status, fejl:{ tid: iso(5,12,0), tidspunkt:"18:00", besked:"RuntimeError: Login mislykkedes" } } }, nu);
t("fejl vises sammen med seneste gode værdi", /Kunne ikke hente kl\. 18:00: RuntimeError: Login mislykkedes Viser den seneste gode værdi\./.test(els.bilKrop.innerHTML) && /63 %/.test(els.bilKrop.innerHTML), els.bilKrop.innerHTML.match(/bil-fejl[^<]*/));
f.bilTegn({ aktiv:true, iDag:[], status:{ fejl:{ tid: iso(5,12,0), tidspunkt:"start", besked:"Mangler HYUNDAI_USERNAME" } } }, nu);
t("kun fejl (aldrig hentet): kortet vises med fejlen", els.bilKort.hidden === false && /Mangler HYUNDAI_USERNAME/.test(els.bilKrop.innerHTML) && !/Viser den seneste/.test(els.bilKrop.innerHTML) && !/<b>\d+ %<\/b>/.test(els.bilKrop.innerHTML));
f.bilTegn({ ...base, status:{ ...base.status, fejl:{ tid: iso(5,12,0), tidspunkt:"nu", besked:"<img src=x onerror=1>" } } }, nu);
t("fejltekst escapes", !/<img src=x/.test(els.bilKrop.innerHTML) && /&lt;img src=x/.test(els.bilKrop.innerHTML) && !/kl\. nu/.test(els.bilKrop.innerHTML));
f.bilTegn({ ...base, aktiv:false }, nu);        t("slået fra skjuler kortet", els.bilKort.hidden === true);
f.bilTegn({ ...base, status:null }, nu);         t("ingen status skjuler kortet", els.bilKort.hidden === true);
f.bilTegn({ aktiv:true, status:{ soc:null, fejl:null } }, nu); t("tomt svar skjuler kortet", els.bilKort.hidden === true);
f.bilTegn(null, nu);                             t("null skjuler kortet", els.bilKort.hidden === true);
f.bilTegn({ ...base, iDag:[ {t:iso(5,6,15),soc:62,kilde:"gemt"} ] }, nu);
t("én aflæsning i dag viser ikke listen", !/I dag:/.test(els.bilKrop.innerHTML));
t("bilDag: i går / ældre", f.bilDag(iso(4,9,5), nu) === "i går 09.05" && f.bilDag(iso(1,7,0), nu) === "søn 1. nov 07.00", f.bilDag(iso(1,7,0), nu));
}

// ───── indstillinger i index.html ─────
{
const els = {};
const el = id => (els[id] ??= { id, value:"", checked:false, textContent:"", hidden:false, handlers:{}, addEventListener(t,f){ (this.handlers[t] ??= []).push(f); } });
const $ = id => el(id);
const fire = async (id, type, ev={}) => { for (const f of el(id).handlers[type] || []) await f({ preventDefault(){}, ...ev }); };
const srv = { aktiv:true, tider:[{tid:"06:15",frisk:false},{tid:"12:00",frisk:false},{tid:"18:00",frisk:true},{tid:"22:00",frisk:false}], calls:[], nuFejl:null,
  status:{ soc:63, kilde:"gemt", opdateret:new Date(2026,10,5,12,0).toISOString(), fejl:null } };
globalThis.fetch = async (url, opt={}) => {
  const action = new URL(url,"http://x/").searchParams.get("action") || "";
  const body = opt.body ? JSON.parse(opt.body) : null;
  srv.calls.push({ action, method:opt.method, body });
  const ok = d => ({ ok:true, status:200, json: async () => d });
  const fail = (st,m) => ({ ok:false, status:st, json: async () => ({ error:m }) });
  if (!action) return ok({ aktiv:srv.aktiv, tider:srv.tider, status:srv.status, iDag:[], maxFriske:2 });
  if (action === "gem"){ srv.aktiv = body.aktiv; srv.tider = body.tider; return ok({ aktiv:srv.aktiv, tider:srv.tider, maxFriske:2 }); }
  if (action === "nu"){ if (srv.nuFejl) return fail(429, srv.nuFejl); return ok({ ok:true }); }
  return fail(400,"?");
};
const realST = globalThis.setTimeout; let planlagt = [];
globalThis.setTimeout = (fn, ms) => { planlagt.push(ms); return 1; };
new Function("$","esc","HEAD", fs.readFileSync("/tmp/bilidx_block.js","utf8"))($, esc, {});
await tick(); await tick();
const sæt = (rk) => { for (let i=0;i<4;i++){ el(`bilT${i}`).value = rk[i]?.[0] ?? ""; el(`bilF${i}`).checked = !!rk[i]?.[1]; } };
const sendt = () => srv.calls.filter(c => c.action === "gem").at(-1);

t("sektion vist med dine tider", el("bilSek").hidden === false && el("bilT0").value === "06:15" && el("bilT1").value === "12:00" && el("bilT2").value === "18:00" && el("bilF2").checked === true && el("bilF0").checked === false && el("bilT3").value === "22:00");
t("status vises", /Seneste aflæsning .*: 63 % \(gemt\)/.test(el("bilStatus").textContent), el("bilStatus").textContent);
await fire("bilForm","submit"); await tick();
t("gem uden ændring sender de fire tider", sendt().body.tider.length === 4 && sendt().body.tider[2].frisk === true && sendt().body.aktiv === true, JSON.stringify(sendt()));
t("bekræftelse", /Gemt/.test(el("bilInfo").textContent));

const før = srv.calls.length;
sæt([["06:15"],["06:20"]]); await fire("bilForm","submit"); await tick();
t("under 10 minutter mellem tiderne afvises", srv.calls.length === før && /mindst 10 minutter mellem 06:15 og 06:20/.test(el("bilFejl").textContent), el("bilFejl").textContent);
sæt([["06:15",true],["12:00",true],["18:00",true]]); await fire("bilForm","submit"); await tick();
t("tre friske afvises", srv.calls.length === før && /Højst 2 friske/.test(el("bilFejl").textContent));
sæt([["06:15"],["06:15"]]); await fire("bilForm","submit"); await tick();
t("samme tid to gange afvises", srv.calls.length === før && /står to gange/.test(el("bilFejl").textContent));
sæt([["6:15"]]); await fire("bilForm","submit"); await tick();
t("ugyldigt tidspunkt afvises", srv.calls.length === før && /ikke et tidspunkt/.test(el("bilFejl").textContent));
sæt([]); await fire("bilForm","submit"); await tick();
t("ingen tider afvises", srv.calls.length === før && /mindst ét tidspunkt/.test(el("bilFejl").textContent));

sæt([["22:00"],["",true],["06:15",true],["12:00"]]); el("bilAktiv").checked = false;
await fire("bilForm","submit"); await tick();
const s = sendt().body;
t("tomme rækker springes over, tiderne sorteres, aktiv sendes", s.aktiv === false && s.tider.map(x=>x.tid).join() === "06:15,12:00,22:00" && s.tider[0].frisk === true && el("bilFejl").textContent === "", JSON.stringify(s));
t("felterne udfyldes fra svaret (fjerde række tom)", el("bilT3").value === "" && el("bilT0").value === "06:15");

// hent nu
await fire("bilNu","click"); await tick();
t("«Hent nu» sender action=nu og planlægger genlæsning", srv.calls.at(-1).action === "nu" && srv.calls.at(-1).method === "POST" && planlagt.includes(45000) && /Bedt om en aflæsning/.test(el("bilInfo").textContent));
srv.nuFejl = "Der er lige hentet. Vent fem minutter, før du beder om en ny.";
await fire("bilNu","click"); await tick();
t("serverens afvisning vises", /Vent fem minutter/.test(el("bilFejl").textContent) && el("bilInfo").textContent === "");
globalThis.setTimeout = realST;
}
process.exit(T.every(Boolean)?0:1);
