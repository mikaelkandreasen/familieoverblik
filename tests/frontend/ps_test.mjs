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
const mk = id => ({ id, hidden:false, textContent:"", src:"", complete:false, naturalWidth:0, cls:new Set(), attrs:{},
  classList:{ add(c){ this._e.cls.add(c); }, remove(c){ this._e.cls.delete(c); }, toggle(c,on){ on ? this._e.cls.add(c) : this._e.cls.delete(c); } },
  removeAttribute(a){ if (a === "src") this.src = ""; }, addEventListener(t, f){ (this._h ??= {})[t] = f; } });
const el = id => { if (!els[id]){ const e = mk(id); e.classList._e = e; els[id] = e; } return els[id]; };
const $ = id => el(id);
const handlers = {}; let dialogOpen = false;
const htmlKlasser = new Set();
const document = { documentElement: { classList: { toggle: (c, on) => { on ? htmlKlasser.add(c) : htmlKlasser.delete(c); } } }, addEventListener(t, f, o){ (handlers[t] ??= []).push({ f, o }); }, querySelector(){ return dialogOpen ? {} : null; } };
const fyr = (type, ev={}) => { for (const h of handlers[type] || []) h.f({ type, stopPropagation(){ this.stopped = true; }, preventDefault(){ this.prevented = true; }, ...ev }); };

const filer = [ { id:"a-nyeste.jpg", tid:300 }, { id:"b-midt.jpg", tid:200 }, { id:"c-ældst.jpg", tid:100 } ];
let cfg = { aktiv:true, inaktivMin:5, sekunder:15, raekkefolge:"nyeste", tilpasning:"udfyld", ur:true, startVedAabning:false };
let svar = () => ({ ok:true, status:200, json: async () => ({ indstillinger:cfg, filer }) });
globalThis.fetch = async () => svar();

const code = fs.readFileSync("/tmp/ps_block.js","utf8");
const f = new Function("$","esc","HEAD","document", code + "; return { ps, psLaes, psStart, psStop, psNaeste, psOrden, psBland };")($, esc, {}, document);
const { ps } = f;
const synlig = () => ["psA","psB"].filter(i => el(i).cls.has("synlig"));
const visSrc = () => { const a = el("psA").src, b = el("psB").src; return { a, b }; };

await f.psLaes(); await tick();
t("liste hentet, ingen pauseskærm endnu", ps.filer.length === 3 && ps.vis === false && el("psOverlay").hidden === false /* aldrig sat */);
advance(5*60000 - 1000);
t("ikke vist efter 4:59", ps.vis === false);
advance(1000);
t("vist efter 5 minutter", ps.vis === true && el("psOverlay").hidden === false);
t("nyeste først: første billede", /id=a-nyeste\.jpg/.test(el("psA").src), visSrc().a);
t("ur vist", el("psUr").hidden === false && /\d\d[.:]\d\d/.test(el("psTid").textContent) && el("psDato").textContent.length > 3, el("psTid").textContent);
t("udfyld: ingen 'hele'", !el("psA").cls.has("hele"));
el("psA").onload();
t("billedet fades ind", synlig().join() === "psA");
advance(15000);
t("efter 15 s: næste billede på det andet lag", /id=b-midt\.jpg/.test(el("psB").src), visSrc().b);
el("psB").onload();
t("krydsfade: B synlig, A skjult", synlig().join() === "psB");
advance(15000); el("psA").onload && el("psA").onload();
t("tredje billede", /id=c-.*dst\.jpg/.test(el("psA").src) || /id=c-/.test(el("psA").src), visSrc().a);
advance(15000);
t("ny runde starter forfra (nyeste)", /id=a-nyeste\.jpg/.test(el("psB").src), visSrc().b);

// luk med tryk
fyr("pointermove");
t("pointermove lukker ikke", ps.vis === true);
fyr("pointerdown");
t("pointerdown lukker", ps.vis === false && el("psOverlay").hidden === true && el("psA").src === "" && el("psB").src === "");
const k = { type:"click" }; for (const h of handlers.click) h.f(Object.assign(k, { stopPropagation(){ k.stopped = true; }, preventDefault(){ k.prevented = true; } }));
t("klik lige efter lukning sluges", k.stopped === true && k.prevented === true);
t("klik-lytteren er i capture-fasen", handlers.click.some(h => h.o === true));
advance(5*60000);
t("starter igen efter 5 min uden berøring", ps.vis === true);
t("mens pauseskærmen er oppe, skjules sidens rullelinje (html får klassen ps-aktiv), så billedet fylder hele skærmen", htmlKlasser.has("ps-aktiv") === true);
fyr("keydown");
t("tastetryk lukker", ps.vis === false);
t("…og rullelinjen kommer tilbage, når pauseskærmen lukkes", htmlKlasser.has("ps-aktiv") === false);

// berøring udsætter
advance(4*60000); fyr("pointerdown"); advance(4*60000);
t("berøring nulstiller tælleren", ps.vis === false);
advance(60000);
t("…og efter 5 min fra berøringen starter den", ps.vis === true);
fyr("wheel");

// dialog åben: ikke ovenpå
dialogOpen = true;
advance(5*60000);
t("starter ikke ovenpå en åben dialog", ps.vis === false);
dialogOpen = false;
advance(5*60000);
t("starter, når dialogen er lukket", ps.vis === true);
fyr("touchstart");

// 'hele' og uden ur
cfg = { ...cfg, tilpasning:"hele", ur:false }; await f.psLaes(); await tick();
advance(5*60000);
t("tilpasning 'hele' og uden ur", ps.vis === true && el("psA").cls.has("hele") && el("psB").cls.has("hele") && el("psUr").hidden === true);

// billede mangler (404): videre, og stop hvis alle fejler
const før = el("psB").src + el("psA").src;
const forrige = ps.idx;
(ps.front ? el("psA") : el("psB")).onerror();
t("manglende billede: springer videre", ps.idx === forrige + 1 || ps.idx === 0, `${forrige} -> ${ps.idx}`);
for (let i = 0; i < 6 && ps.vis; i++) (ps.front ? el("psA") : el("psB")).onerror();
t("stopper, hvis alle billeder fejler", ps.vis === false);

// indstillinger slås fra mens den vises
cfg = { ...cfg, aktiv:true, tilpasning:"udfyld", ur:true }; await f.psLaes(); await tick();
advance(5*60000); t("(vises igen)", ps.vis === true);
cfg = { ...cfg, aktiv:false }; await f.psLaes(); await tick();
t("slås 'aktiv' fra, lukkes den", ps.vis === false);
advance(60*60000); t("og starter ikke igen", ps.vis === false);

// ingen billeder
cfg = { ...cfg, aktiv:true }; const gamle = filer.splice(0); await f.psLaes(); await tick();
advance(60*60000); t("ingen billeder: starter aldrig", ps.vis === false);
filer.push(...gamle);

// start ved åbning
ps.hentet = false; cfg = { ...cfg, aktiv:true, startVedAabning:true }; await f.psLaes(); await tick();
t("startVedAabning: starter med det samme", ps.vis === true);
fyr("pointerdown");

// rækkefølge: tilfældig blander, uden gentagelse over rundeskift
const a = f.psOrden(filer, { raekkefolge:"tilfaeldig" }, () => 0.0, null);
t("tilfældig er en permutation", a.length === 3 && new Set(a.map(x=>x.id)).size === 3);
const b = f.psBland(filer, () => 0.99, a[0].id);   // første ville ellers være det sidst viste
t("samme billede to gange i træk undgås", b[0].id !== a[0].id || filer.length === 1);
t("nyeste først sorterer på tid", f.psOrden(filer, { raekkefolge:"nyeste" }).map(x=>x.id).join() === "a-nyeste.jpg,b-midt.jpg,c-ældst.jpg");
t("ét billede: ingen byt-om-fejl", f.psBland([filer[0]], Math.random, filer[0].id).length === 1);

globalThis.setTimeout = realST; globalThis.clearTimeout = realCT;
process.exit(T.every(Boolean)?0:1);
