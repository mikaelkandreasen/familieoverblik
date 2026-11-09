import fs from "fs";
const T=[]; const t=(n,ok,x="")=>{T.push(ok);console.log(ok?"ok  ":"FEJL",n,ok?"":x)};
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const tick = () => new Promise(r => setImmediate(r));
// ── falsk tid ──
let nu = 0, nextId = 1; const timers = new Map();
const realST = globalThis.setTimeout, realCT = globalThis.clearTimeout;
globalThis.setTimeout = (fn, ms) => { const id = nextId++; timers.set(id, { fn, at: nu + ms }); return id; };
globalThis.clearTimeout = id => { timers.delete(id); };
const advance = ms => { const slut = nu + ms; for(;;){ let n = null; for (const [id,tm] of timers) if (tm.at <= slut && (!n || tm.at < n.tm.at)) n = { id, tm }; if (!n) break; timers.delete(n.id); nu = n.tm.at; n.tm.fn(); } nu = slut; };
// ── falsk DOM ──
const els = {};
const mk = id => ({ id, hidden:false, textContent:"", src:"", complete:false, naturalWidth:0, cls:new Set(), _h:{},
  classList:{ add(c){ this._e.cls.add(c); }, remove(c){ this._e.cls.delete(c); }, toggle(c,on){ on ? this._e.cls.add(c) : this._e.cls.delete(c); } },
  removeAttribute(a){ if (a === "src") this.src = ""; }, addEventListener(t, f){ this._h[t] = f; } });
const el = id => { if (!els[id]){ const e = mk(id); e.classList._e = e; els[id] = e; } return els[id]; };
const $ = id => el(id);
const handlers = {};
const document = { documentElement: { classList: { toggle(){} } }, addEventListener(t, f, o){ (handlers[t] ??= []).push({ f, o }); }, querySelector(){ return null; } };
const fyr = (type, ev = {}) => { for (const h of handlers[type] || []) h.f({ type, ...ev }); };
const filer = [{ id: "a.jpg", tid: 300 }, { id: "b.jpg", tid: 200 }, { id: "c.jpg", tid: 100 }];
const cfg = { aktiv: true, inaktivMin: 5, sekunder: 15, raekkefolge: "nyeste", tilpasning: "udfyld", ur: true, startVedAabning: false };
globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ indstillinger: cfg, filer }) });
const code = fs.readFileSync("/tmp/ps_block.js", "utf8");
const f = new Function("$", "esc", "HEAD", "document", code + "; return { ps, psLaes, psStart, psStop, psNaeste, psForrige, psSpring };")($, esc, {}, document);
const { ps } = f;
const visId = () => { const s = ps.front ? el("psA").src : el("psB").src; const m = /id=([^&]+)/.exec(s); return m ? decodeURIComponent(m[1]) : ""; };
await f.psLaes(); await tick();
advance(5 * 60000);
t("pauseskærmen er oppe og viser det første billede (nyeste først: a.jpg)", ps.vis === true && ps.idx === 0 && visId() === "a.jpg", [ps.vis, ps.idx, visId()]);
f.psSpring(1);
t("næste (›): b.jpg, og tælleren står på 1", visId() === "b.jpg" && ps.idx === 1);
f.psSpring(1);
t("næste igen: c.jpg", visId() === "c.jpg" && ps.idx === 2);
f.psSpring(-1);
t("forrige (‹): tilbage til b.jpg", visId() === "b.jpg" && ps.idx === 1);
f.psSpring(-1); f.psSpring(-1);
t("forrige fra det første billede springer til det sidste (c.jpg), så man kan bladre baglæns rundt", visId() === "c.jpg" && ps.idx === 2);
f.psSpring(1);
t("næste fra det sidste: en ny runde starter forfra (a.jpg, nyeste først)", visId() === "a.jpg" && ps.idx === 0);
// tidsstyringen
f.psSpring(1);                                                       // b.jpg
advance(14000);
t("efter et tryk bliver billedet stående et helt interval (14 s senere er det stadig b.jpg)", visId() === "b.jpg");
advance(1500);
t("…og så går diasshowet videre af sig selv (til c.jpg)", visId() === "c.jpg");
f.psSpring(-1); advance(15000);
t("efter ‹ går diasshowet videre fra der, hvor man er: b.jpg → c.jpg (ikke tilbage til start)", visId() === "c.jpg" && ps.idx === 2);
t("der er kun ét ur kørende ad gangen (hurtige tryk giver ikke dobbelt tempo)", (() => { f.psSpring(1); f.psSpring(1); f.psSpring(-1); f.psSpring(1); const n = timers.size; return n >= 1 && [...timers.values()].filter(x => x.at - nu === 15000).length === 1; })());
// ét billede og ingen billeder
ps.orden = [filer[0]]; ps.idx = 0; f.psSpring(-1);
t("med ét billede viser ‹ det samme billede igen uden fejl", ps.vis === true && visId() === "a.jpg");
ps.orden = []; ps.idx = 0; f.psSpring(-1);
t("uden billeder lukkes pauseskærmen i stedet for at fejle", ps.vis === false);
f.psStart(); advance(0);
// tastaturet
ps.vis || (ps.orden = filer.slice(), ps.idx = 0);
if (!ps.vis){ ps.cfg = cfg; ps.filer = filer.slice(); f.psStart(); }
const foer = ps.idx;
fyr("keydown", { key: "ArrowRight" });
t("højre piletast bladrer fremad og lukker ikke pauseskærmen", ps.vis === true && ps.idx === (foer + 1) % 3);
fyr("keydown", { key: "ArrowLeft" });
t("venstre piletast bladrer tilbage og lukker ikke", ps.vis === true && ps.idx === foer);
fyr("keydown", { key: "ArrowUp" });
t("andre taster lukker stadig pauseskærmen (op-piletasten er ikke bladring)", ps.vis === false);
f.psStart();
fyr("keydown", { key: " " });
t("mellemrum lukker også", ps.vis === false);
f.psStart();
fyr("pointerdown", { target: { closest: s => (s === ".ps-knapper" ? {} : null) } }); fyr("touchstart", { target: { closest: s => (s === ".ps-knapper" ? {} : null) } });
t("tryk på knapperne (også berøring) lukker ikke pauseskærmen", ps.vis === true);
fyr("pointerdown", { target: { closest: () => null } });
t("tryk et andet sted lukker den som før", ps.vis === false);
f.psStart(); ps.vis && (el("psForrige")._h.click(), 0);
const i1 = ps.idx; el("psNaeste")._h.click();
t("knapperne er koblet til: «›» (psNaeste) går ét billede frem, «‹» (psForrige) ét tilbage", ps.idx === (i1 + 1) % 3 && (el("psForrige")._h.click(), ps.idx === i1));
const ov = fs.readFileSync(import.meta.dirname + "/../../public_html/overblik.html", "utf8");
t("overlayet har knapperne «Forrige billede» (‹) og «Næste billede» (›) yderst i knaprækken, med drejeknapperne imellem", /<div class="ps-knapper" id="psKnapper">\s*<button type="button" id="psForrige" aria-label="Forrige billede">&#8249;<\/button>\s*<button type="button" id="psVenstre"[\s\S]*?<button type="button" id="psHoejre"[\s\S]*?<\/button>\s*<button type="button" id="psNaeste" aria-label="Næste billede">&#8250;<\/button>/.test(ov));
t("piletasterne er med i pauseskærmens aktivitet, og knapperne er koblet på siden", ov.includes('e.type === "keydown" && (e.key === "ArrowLeft" || e.key === "ArrowRight")') && ov.includes('$("psForrige").addEventListener("click", () => psSpring(-1));') && ov.includes('$("psNaeste").addEventListener("click", () => psSpring(1));'));
globalThis.setTimeout = realST; globalThis.clearTimeout = realCT;
process.exit(T.every(Boolean) ? 0 : 1);
