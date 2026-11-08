import fs from "fs";
const code = fs.readFileSync("/tmp/elp_block.js","utf8");
const els = {};
function el(id){ return els[id] ??= { id, value:"", textContent:"", hidden:true, handlers:{}, addEventListener(t,f){ (this.handlers[t] ??= []).push(f); } }; }
const $ = id => el(id);
const calls = [];
let serverFejl = null;
const store = { momsPct:25, fastOre:0, selskabOre:0, source:"config", tarifISConfig:true };
globalThis.fetch = async (url, opt={}) => {
  const action = new URL(url,"http://x/").searchParams.get("action");
  const body = opt.body ? JSON.parse(opt.body) : null;
  calls.push({ action, method: opt.method, body });
  if (serverFejl) return { ok:false, status:serverFejl, json: async () => ({ error:"nej" }) };
  if (action === "settings") return { ok:true, status:200, json: async () => ({ ...store }) };
  if (action === "save"){ Object.assign(store, body, { source:"file" }); return { ok:true, status:200, json: async () => ({ ...store }) }; }
  return { ok:false, status:400, json: async () => ({ error:"?" }) };
};
const HEAD = { "X-Ugeplan-Key":"k" };
new Function("$","HEAD", code)($, HEAD);
const tick = () => new Promise(r => setTimeout(r, 5));
const fire = async (id, type, ev={}) => { for (const f of el(id).handlers[type] || []) await f({ preventDefault(){}, ...ev }); };
const T=[]; const t=(n,ok,x="")=>{T.push(ok);console.log(ok?"ok  ":"FEJL",n,ok?"":x)};

await tick();
t("sektionen vises og felterne udfyldes", el("elpSek").hidden === false && el("elpMoms").value === "25" && el("elpFast").value === "0" && el("elpSelskab").value === "0");
t("info om config og tarif", /standarden fra config\.php/.test(el("elpInfo").textContent) && /ELPRIS_TARIF_TIMER/.test(el("elpInfo").textContent));
t("eksempel regnes: 1,00 → 1,25", /1,25 kr\./.test(el("elpEks").textContent), el("elpEks").textContent);

// live eksempel
el("elpFast").value = "10"; el("elpSelskab").value = "7,5";
await fire("elpFast","input");
t("eksempel med tillæg: (1+0,175)*1,25 = 1,47", /1,47 kr\./.test(el("elpEks").textContent), el("elpEks").textContent);

// gem
await fire("elpForm","submit"); await tick();
const gem = calls.filter(c=>c.action==="save");
t("sender POST med tal (komma → punktum)", gem.length===1 && gem[0].method==="POST" && gem[0].body.momsPct===25 && gem[0].body.fastOre===10 && gem[0].body.selskabOre===7.5, JSON.stringify(gem));
t("viser Gemt", /Gemt/.test(el("elpInfo").textContent) && el("elpFejl").textContent === "");
t("felter vises med komma", el("elpSelskab").value === "7,5");

// ugyldigt input stoppes i browseren
const før = calls.length;
el("elpMoms").value = "abc";
await fire("elpForm","submit"); await tick();
t("tekst i moms afvises uden kald", calls.length === før && /Skriv tal/.test(el("elpFejl").textContent));
el("elpMoms").value = "150";
await fire("elpForm","submit"); await tick();
t("moms over 100 afvises", calls.length === før && /mellem 0 og 100/.test(el("elpFejl").textContent));
el("elpMoms").value = "25"; el("elpFast").value = "5000";
await fire("elpForm","submit"); await tick();
t("tillæg uden for grænse afvises", calls.length === før && /mellem -100 og 1000/.test(el("elpFejl").textContent));
el("elpFast").value = ""; el("elpSelskab").value = "";
await fire("elpForm","submit"); await tick();
t("tomme tillæg tæller som 0", calls.length === før + 1 && calls.at(-1).body.fastOre === 0 && calls.at(-1).body.selskabOre === 0);

// serverfejl vises
serverFejl = 400;
await fire("elpForm","submit"); await tick();
t("serverfejl vises", el("elpFejl").textContent === "nej");
process.exit(T.every(Boolean)?0:1);
