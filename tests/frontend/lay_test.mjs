import fs from "fs";
const T=[]; const t=(n,ok,x="")=>{T.push(ok);console.log(ok?"ok  ":"FEJL",n,ok?"":x)};
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

// ── minimal DOM med træ ──
class El {
  constructor(tag, attrs = {}){ this.tag = tag; this.children = []; this.parent = null; this.dataset = {}; this._cls = new Set(); this.attrs = {}; this.hidden = false; this.draggable = false; this._h = {};
    Object.assign(this.dataset, attrs.data || {}); (attrs.cls || []).forEach(c => this._cls.add(c)); this.id = attrs.id || ""; this.textContent = attrs.text || ""; }
  get classList(){ const s = this._cls, self = this; return { add: (...cs) => cs.forEach(c => s.add(c)), remove: (...cs) => cs.forEach(c => s.delete(c)), contains: c => s.has(c), toggle: (c, on) => { (on === undefined ? !s.has(c) : on) ? s.add(c) : s.delete(c); } }; }
  appendChild(e){ if (e.parent){ e.parent.children = e.parent.children.filter(x => x !== e); } e.parent = this; this.children.push(e); return e; }
  insertBefore(e, ref){ if (e.parent){ e.parent.children = e.parent.children.filter(x => x !== e); } e.parent = this; const i = ref ? this.children.indexOf(ref) : -1; if (i < 0) this.children.push(e); else this.children.splice(i, 0, e); return e; }
  setAttribute(k, v){ this.attrs[k] = v; }
  addEventListener(t, f){ (this._h[t] ??= []).push(f); }
  all(){ return this.children.flatMap(c => [c, ...c.all()]); }
  remove(){ if (this.parent){ this.parent.children = this.parent.children.filter(x => x !== this); this.parent = null; } }
  querySelector(sel){ return this.all().find(e => e.matches(sel)) || null; }
  matches(sel){ if (sel.startsWith(".")) return this._cls.has(sel.slice(1)); if (sel === "h2") return this.tag === "h2"; return false; }
  get firstChild(){ return this.children[0]; }
  set className(v){ this._cls = new Set(String(v).split(/\s+/).filter(Boolean)); }
  set innerHTML(h){ this._html = h; this.children = []; for (const m of h.matchAll(/<button[^>]*data-lay="([^"]+)"[^>]*data-lay-id="([^"]+)"/g)){ const b = new El("button"); b.dataset.lay = m[1]; b.dataset.layId = m[2]; b.parent = this; this.children.push(b); }
    for (const m of h.matchAll(/<button[^>]*data-lay-vis="([^"]+)"/g)){ const b = new El("button"); b.dataset.layVis = m[1]; b.parent = this; this.children.push(b); } }
  closest(sel){ let e = this; while (e){ if (sel === "[data-kort]" && e.dataset.kort) return e; if (sel === "[data-lay-klap]" && e.dataset.layKlap) return e; if (sel === "[data-lay]" && e.dataset.lay) return e; if (sel === "[data-lay-vis]" && e.dataset.layVis) return e; e = e.parent; } return null; }
}
const kort = (id, navn, hidden = false) => { const k = new El("section", { data: { kort: id }, cls: ["card"] }); k.hidden = hidden; const h = new El("div", { cls: ["card-head"] }); const h2 = new El("h2", { text: navn }); h.appendChild(h2); k.appendChild(h); k.appendChild(new El("div", { cls: ["indhold"] })); return k; };
function bygDom(ekstra = []){
  const app = new El("main", { id: "app" }), stak = new El("div", { id: "stak" });
  app.appendChild(new El("section", { cls: ["today"] })); app.appendChild(stak);
  for (const [id, n, h] of [["tom","Klar til i morgen"],["vigtigt","Vigtigt snart"],["todo","To-do"],["indkob","Indkøb",true],["elpris","Elpris"],["traening","Træning"],["bil","Bil"]]) stak.appendChild(kort(id, n, h));
  for (const [id, n] of [["dage5","De næste 5 dage"],["svar","Kræver svar"],["lektier","Lektier"],["ugebrev","Ugebrev"],["tegneserie","Dagens tegneserie"]]){ const k = kort(id, n); k._cls.add("wide"); app.appendChild(k); }
  for (const [id, n] of ekstra) stak.appendChild(kort(id, n));
  return { app, stak };
}
const ids = c => c.children.flatMap(e => e.dataset.kort ? [e.dataset.kort] : e._cls.has("halv-raekke") ? e.children.filter(x => x.dataset.kort).map(x => x.dataset.kort) : []);

async function nyUdgave(lager, ekstra = []){
  const { app, stak } = bygDom(ekstra);
  const els = { app, stak, layBar: new El("div", { id: "layBar" }), layoutKnap: new El("button"), layFaerdig: new El("button"), layNulstil: new El("button"), verTekst: new El("span"), laySkjulteBlok: new El("span"), laySkjulteListe: new El("span") };
  els.layBar.hidden = true; els.laySkjulteBlok.hidden = true;
  const $ = id => els[id];
  const lyt = {};
  const document = { addEventListener(t, f){ (lyt[t] ??= []).push(f); }, querySelectorAll: () => [...app.all()].filter(e => e.dataset.kort), createElement: tag => new El(tag) };
  const localStorage = { getItem: k => (k in lager ? lager[k] : null), setItem: (k, v) => { lager[k] = v; }, removeItem: k => { delete lager[k]; } };
  globalThis.MutationObserver = undefined;
  const kode = fs.readFileSync("/tmp/lay_block.js", "utf8") + "; return { layRens, layFlyt, layStorrelse, laySkjul, layStr, layFlytFoer, layKlap, layFraDom, layBygKnapper, layRediger, get nu(){ return layNu; }, get std(){ return layStandard; } };";
  const api = new Function("$", "esc", "document", "localStorage", kode)($, esc, document, localStorage);
  const fyr = (t, ev) => (lyt[t] || []).forEach(f => f(ev));
  const klik = (el) => fyr("click", { target: el });
  return { app, stak, els, api, fyr, klik, document, lager };
}
const knap = (u, sel) => u.app.all().find(e => (sel.lay && e.dataset.lay === sel.lay && e.dataset.layId === sel.id) || (sel.klap && e.dataset.layKlap === sel.klap));

// ── 1. rene funktioner ──
{
  const u = await nyUdgave({});
  const A = u.api;
  const L = () => ({ stak: ["a","b","c","d"], bred: ["x","y"], halve: [], lukket: [], skjult: [] });
  let l = L(); t("layFlyt op/ned bytter plads", A.layFlyt(l, "b", "op") && l.stak.join() === "b,a,c,d" && A.layFlyt(l, "b", "ned") && l.stak.join() === "a,b,c,d");
  l = L(); t("layFlyt over kanten gør intet", !A.layFlyt(l, "a", "op") && !A.layFlyt(l, "d", "ned") && l.stak.join() === "a,b,c,d");
  l = L(); A.layFlyt(l, "a", "ned", new Set(["b"])); t("layFlyt springer skjulte kort over", l.stak.join() === "c,b,a,d", l.stak.join());
  l = L(); t("layFlyt: alle naboer skjulte → intet sker", !A.layFlyt(l, "a", "ned", new Set(["b","c","d"])) && l.stak.join() === "a,b,c,d");
  l = L(); t("layFlyt rører ikke den anden gruppe", (A.layFlyt(l, "x", "ned"), l.stak.join() === "a,b,c,d" && l.bred.join() === "y,x"));
  l = L(); t("layFlyt: ukendt kort", !A.layFlyt(l, "z", "op"));
  l = L(); t("layStr: smal i kolonnen, bred som standard i den brede række, halv hvis den er valgt", A.layStr(l, "a") === "Smal" && A.layStr(l, "x") === "Bred" && (l.halve.push("y"), A.layStr(l, "y")) === "Halv" && A.layStr(l, "z") === null);
  l = L(); A.layStorrelse(l, "b"); t("layStorrelse: smal → halv (forrest i den brede række)", l.stak.join() === "a,c,d" && l.bred.join() === "b,x,y" && l.halve.join() === "b" && A.layStr(l, "b") === "Halv");
  A.layStorrelse(l, "b"); t("layStorrelse: halv → bred (samme plads, ikke længere halv)", l.bred.join() === "b,x,y" && l.halve.length === 0 && A.layStr(l, "b") === "Bred");
  A.layStorrelse(l, "b"); t("layStorrelse: bred → smal (bagerst i kolonnen)", l.stak.join() === "a,c,d,b" && l.bred.join() === "x,y" && l.halve.length === 0);
  l = L(); A.layStorrelse(l, "x"); t("layStorrelse på et bredt kort: bred → smal", l.stak.join() === "a,b,c,d,x" && l.bred.join() === "y");
  l = L(); t("layStorrelse: ukendt kort", !A.layStorrelse(l, "z"));
  l = L(); t("laySkjul skjuler og viser (true = nu skjult), og kortet bevarer sin plads i gruppen", A.laySkjul(l, "b") === true && l.skjult.join() === "b" && l.stak.join() === "a,b,c,d" && A.laySkjul(l, "b") === false && l.skjult.length === 0);
  l = L(); A.layFlytFoer(l, "d", "a"); t("layFlytFoer i samme gruppe", l.stak.join() === "d,a,b,c");
  l = L(); A.layFlytFoer(l, "c", "y"); t("layFlytFoer på tværs af grupper", l.stak.join() === "a,b,d" && l.bred.join() === "x,c,y");
  l = L(); t("layFlytFoer samme kort/ukendt", !A.layFlytFoer(l, "a", "a") && !A.layFlytFoer(l, "a", "z") && !A.layFlytFoer(l, "z", "a"));
  l = L(); t("layKlap toggler", A.layKlap(l, "a") === true && l.lukket.join() === "a" && A.layKlap(l, "a") === false && l.lukket.length === 0);
  const r = A.layRens({ stak: ["b","ukendt","a","a"], bred: ["x","b"], lukket: ["x","ukendt","x"] }, ["a","b","x","ny"], { stak: ["a","b","ny"], bred: ["x"] });
  t("layRens: dubletter og ukendte fjernes, nye kort kommer i standardgruppen, lukket renses", r.stak.join() === "b,a,ny" && r.bred.join() === "x" && r.lukket.join() === "x", JSON.stringify(r));
  t("layRens med skrald giver standard", JSON.stringify(A.layRens("tekst", ["a"], { stak: ["a"], bred: [] })) === JSON.stringify({ stak: ["a"], bred: [], halve: [], lukket: [], skjult: [] }) && A.layRens(null, ["a"], { stak: ["a"], bred: [] }).stak[0] === "a");
  const r2 = A.layRens({ stak: ["a"], bred: ["x", "y"], halve: ["x", "a", "ukendt", "x", "q"], skjult: ["y", "ukendt", "a", "y"] }, ["a", "x", "y"], { stak: ["a"], bred: ["x", "y"] });
  t("layRens: halve kun for kort i den brede række (ingen dubletter, ingen fremmede), skjult kun for kendte kort", r2.halve.join() === "x" && r2.skjult.join() === "y,a", JSON.stringify(r2));
  t("layRens: en gemt udgave fra før halve og skjult (kun stak, bred, lukket) virker uændret", (() => { const g = A.layRens({ stak: ["a"], bred: ["x"], lukket: ["a"] }, ["a", "x"], { stak: ["a"], bred: ["x"] }); return g.halve.length === 0 && g.skjult.length === 0 && g.lukket.join() === "a"; })());
  t("layRens: halve/skjult, der ikke er lister, ignoreres", A.layRens({ halve: "x", skjult: { a: 1 } }, ["a", "x"], { stak: ["a"], bred: ["x"] }).halve.length === 0);
}

// ── 2. DOM ──
{
  const lager = {};
  const u = await nyUdgave(lager);
  t("standard hentes fra siden", u.api.std.stak.join() === "tom,vigtigt,todo,indkob,elpris,traening,bil" && u.api.std.bred.join() === "dage5,svar,lektier,ugebrev,tegneserie");
  const k0 = u.stak.children.find(e => e.dataset.kort === "todo");
  t("hvert kort fik en sammenklap-knap i titellinjen og en flytte-linje", u.app.all().filter(e => e.dataset.layKlap).length === 12 && u.app.all().filter(e => e._cls.has("lay-bar")).length === 12 && k0.children[0]._cls.has("lay-bar"));
  u.api.layBygKnapper();
  t("knapperne sættes ikke på to gange", u.app.all().filter(e => e.dataset.layKlap).length === 12 && u.app.all().filter(e => e._cls.has("lay-bar")).length === 12);

  // flyt op
  u.klik(knap(u, { lay: "op", id: "todo" }));
  t("▲ flytter kortet i DOM'en og gemmer", ids(u.stak).slice(0, 3).join() === "tom,todo,vigtigt" && JSON.parse(lager["familieoverblik-layout-v1"]).stak[1] === "todo");
  // ned springer skjult (indkob) over
  u.klik(knap(u, { lay: "ned", id: "vigtigt" }));
  u.klik(knap(u, { lay: "ned", id: "vigtigt" }));
  t("▼ springer det skjulte kort (indkob) over", ids(u.stak).join() === "tom,todo,elpris,indkob,traening,vigtigt,bil", ids(u.stak).join());
  // størrelse: smal → halv → bred → smal
  u.klik(knap(u, { lay: "storrelse", id: "bil" }));
  const bil = u.app.all().find(e => e.dataset.kort === "bil");
  t("Størrelse (1. tryk): Bil bliver halv, med klassen half, i en halv-række i den brede række (forrest)", bil._cls.has("half") && !bil._cls.has("wide") && bil.parent._cls.has("halv-raekke") && bil.parent.parent === u.app && ids(u.app).slice(0, 3).join() === "bil,dage5,svar", ids(u.app).join());
  u.klik(knap(u, { lay: "storrelse", id: "tegneserie" }));
  const tg = u.app.all().find(e => e.dataset.kort === "tegneserie");
  t("Størrelse: tegneserie (bred) → smal i kolonnen (wide og half fjernet)", !tg._cls.has("wide") && !tg._cls.has("half") && tg.parent === u.stak, ids(u.stak).join());
  u.klik(knap(u, { lay: "storrelse", id: "bil" }));
  t("Størrelse (2. tryk): Bil bliver bred (wide, direkte under #app, ikke i en række)", bil._cls.has("wide") && !bil._cls.has("half") && bil.parent === u.app && u.app.children.filter(e => e._cls.has("halv-raekke")).length === 0);
  u.klik(knap(u, { lay: "storrelse", id: "bil" }));
  t("Størrelse (3. tryk): Bil er tilbage i kolonnen, og der er ingen tomme halv-rækker", bil.parent === u.stak && !bil._cls.has("wide") && !bil._cls.has("half") && u.app.children.filter(e => e._cls.has("halv-raekke")).length === 0);
  u.klik(knap(u, { lay: "storrelse", id: "bil" })); u.klik(knap(u, { lay: "storrelse", id: "elpris" }));
  const rk = () => u.app.children.filter(e => e._cls.has("halv-raekke"));
  t("to halve kort lægges i SAMME række (to side om side)", rk().length === 1 && rk()[0].children.map(e => e.dataset.kort).join() === "elpris,bil", rk().map(r => r.children.map(e => e.dataset.kort).join()).join("|"));
  const g1 = JSON.parse(lager["familieoverblik-layout-v1"]);
  t("halve gemmes i browseren", g1.halve.includes("bil") && g1.halve.includes("elpris") && g1.halve.length === 2, JSON.stringify(g1.halve));
  const u7 = await nyUdgave(lager);
  t("halve kort huskes efter genindlæsning (stadig to side om side)", u7.app.children.filter(e => e._cls.has("halv-raekke"))[0].children.map(e => e.dataset.kort).join() === "elpris,bil");
  for (const id of ["bil", "bil", "elpris", "elpris"]) u.klik(knap(u, { lay: "storrelse", id }));
  t("tilbage til kolonnen igen: ingen halv-rækker og kortene er smalle", rk().length === 0 && ids(u.stak).includes("bil") && ids(u.stak).includes("elpris"));
  const barTekst = navn => u.app.all().find(e => e._cls.has("lay-bar") && e.dataset.navn === navn)._html;
  t("størrelsesknappen viser den nuværende størrelse og har en forklarende aria-label", />Smal<\/button>/.test(barTekst("To-do")) && /aria-label="Skift størrelse på To-do \(nu smal\)"/.test(barTekst("To-do")), barTekst("To-do"));
  u.klik(knap(u, { lay: "storrelse", id: "todo" }));
  t("…og skifter til «Halv» efter et tryk", />Halv<\/button>/.test(barTekst("To-do")) && /nu halv/.test(barTekst("To-do")));
  u.klik(knap(u, { lay: "storrelse", id: "todo" })); u.klik(knap(u, { lay: "storrelse", id: "todo" }));
  // skjul kort helt
  u.klik(knap(u, { lay: "skjul", id: "vigtigt" }));
  const vg = u.app.all().find(e => e.dataset.kort === "vigtigt");
  t("✕ skjuler kortet helt (klassen er-skjult), og det gemmes", vg._cls.has("er-skjult") && JSON.parse(lager["familieoverblik-layout-v1"]).skjult.join() === "vigtigt");
  t("panelet viser de skjulte kort som knapper, og blokken er synlig", u.els.laySkjulteBlok.hidden === false && /data-lay-vis="vigtigt"/.test(u.els.laySkjulteListe._html) && /＋ Vigtigt snart/.test(u.els.laySkjulteListe._html) && /aria-label="Vis Vigtigt snart igen"/.test(u.els.laySkjulteListe._html), u.els.laySkjulteListe._html);
  t("kortet bevarer sin plads i kolonnen, selvom det er skjult", ids(u.stak).includes("vigtigt"));
  { const v = await nyUdgave({}); v.klik(knap(v, { lay: "skjul", id: "todo" })); v.klik(knap(v, { lay: "ned", id: "vigtigt" }));
    t("▼ springer både et skjult kort (To-do, skjult med ✕) og et kort, der ikke er på siden (Indkøb), over", ids(v.stak).join() === "tom,elpris,todo,indkob,vigtigt,traening,bil", ids(v.stak).join()); }
  u.klik(u.els.laySkjulteListe.children[0]);
  t("et tryk på knappen i panelet viser kortet igen, og blokken skjules", !vg._cls.has("er-skjult") && u.els.laySkjulteBlok.hidden === true && u.els.laySkjulteListe._html === "" && JSON.parse(lager["familieoverblik-layout-v1"]).skjult.length === 0);
  u.klik(knap(u, { lay: "skjul", id: "vigtigt" })); u.klik(knap(u, { lay: "skjul", id: "dage5" }));
  const u6 = await nyUdgave(lager);
  t("skjulte kort huskes efter genindlæsning", u6.app.all().find(e => e.dataset.kort === "vigtigt")._cls.has("er-skjult") && u6.app.all().find(e => e.dataset.kort === "dage5")._cls.has("er-skjult") && u6.els.laySkjulteBlok.hidden === false);
  u.klik(knap(u, { lay: "skjul", id: "vigtigt" })); u.klik(knap(u, { lay: "skjul", id: "dage5" }));
  // klap
  u.klik(knap(u, { klap: "elpris" }));
  const ep = u.app.all().find(e => e.dataset.kort === "elpris");
  t("pilen klapper et kort sammen (klasse + aria-expanded)", ep._cls.has("er-lukket") && ep.querySelector(".kort-klap").attrs["aria-expanded"] === "false" && JSON.parse(lager["familieoverblik-layout-v1"]).lukket.join() === "elpris");
  u.klik(knap(u, { klap: "elpris" }));
  t("…og ud igen", !ep._cls.has("er-lukket") && ep.querySelector(".kort-klap").attrs["aria-expanded"] === "true");
  u.klik(knap(u, { klap: "elpris" }));

  // genindlæs med gemt layout
  const u2 = await nyUdgave(lager);
  t("layoutet huskes efter genindlæsning (rækkefølge, bred/kolonne, sammenklappet)", ids(u2.stak).join() === ids(u.stak).join() && ids(u2.app).join() === ids(u.app).join() && u2.app.all().find(e => e.dataset.kort === "elpris")._cls.has("er-lukket"), `${ids(u2.stak)} | ${ids(u2.app)}`);
  // nyt kort i en nyere udgave
  const u3 = await nyUdgave(lager, [["nyt", "Nyt kort"]]);
  t("et nyt kort, som det gemte layout ikke kender, havner i kolonnen", ids(u3.stak).includes("nyt") && ids(u3.stak).at(-1) === "nyt" || ids(u3.stak).includes("nyt"));
  // kort der er forsvundet
  lager["familieoverblik-layout-v1"] = JSON.stringify({ stak: ["findesikke", "todo"], bred: ["ugebrev"], lukket: ["findesikke"] });
  const u4 = await nyUdgave(lager);
  t("kort, der ikke længere findes, ignoreres; resten får sin plads", ids(u4.stak)[0] === "todo" && ids(u4.app).includes("ugebrev") && ids(u4.stak).length + ids(u4.app).length === 12 && JSON.stringify(u4.api.nu.lukket) === "[]");
  // ødelagt lager
  const u5 = await nyUdgave({ "familieoverblik-layout-v1": "{ikke json" });
  t("ødelagt gemt layout giver standarden uden fejl", ids(u5.stak).join() === "tom,vigtigt,todo,indkob,elpris,traening,bil");

  // nulstil
  u.klik(knap(u, { klap: "todo" }));
  u.els.layNulstil._h.click[0]({});
  t("Nulstil giver standarden, sletter det gemte og åbner alle kort", ids(u.stak).join() === "tom,vigtigt,todo,indkob,elpris,traening,bil" && ids(u.app).join() === "dage5,svar,lektier,ugebrev,tegneserie" && !("familieoverblik-layout-v1" in lager) && !u.app.all().some(e => e._cls.has("er-lukket")) && !u.app.all().find(e => e.dataset.kort === "bil")._cls.has("wide"));

  // redigeringstilstand
  u.els.layoutKnap._h.click[0]({});
  t("«Tilpas layout» åbner redigering: markering, panel, træk slået til, knappen skjult", u.app._cls.has("lay-redigerer") && u.els.layBar.hidden === false && u.els.layoutKnap.hidden === true && u.app.all().filter(e => e.dataset.kort).every(e => e.draggable === true));
  // træk og slip (mus)
  const todoEl = u.app.all().find(e => e.dataset.kort === "todo"), bilEl = u.app.all().find(e => e.dataset.kort === "bil"), ugEl = u.app.all().find(e => e.dataset.kort === "ugebrev");
  u.fyr("dragstart", { target: bilEl, dataTransfer: { setData(){}, } });
  u.fyr("dragover", { target: todoEl, preventDefault(){} });
  t("træk: målet markeres", todoEl._cls.has("lay-over") && bilEl._cls.has("lay-traek"));
  u.fyr("drop", { target: todoEl, preventDefault(){} });
  t("slip på et kort i samme gruppe sætter det foran", ids(u.stak).join() === "tom,vigtigt,bil,todo,indkob,elpris,traening", ids(u.stak).join());
  u.fyr("dragstart", { target: bilEl, dataTransfer: { setData(){} } }); u.fyr("drop", { target: ugEl, preventDefault(){} });
  t("slip på et bredt kort flytter kortet til den brede række foran det", ids(u.app).join() === "dage5,svar,lektier,bil,ugebrev,tegneserie" && bilEl._cls.has("wide"), ids(u.app).join());
  u.fyr("dragend", {});
  t("efter træk ryddes markeringerne", !u.app.all().some(e => e._cls.has("lay-over") || e._cls.has("lay-traek")));
  u.els.layFaerdig._h.click[0]({});
  t("«Færdig» lukker redigering", !u.app._cls.has("lay-redigerer") && u.els.layBar.hidden === true && u.els.layoutKnap.hidden === false && u.app.all().filter(e => e.dataset.kort).every(e => e.draggable === false));
  // træk uden redigeringstilstand
  const k = u.app.all().find(e => e.dataset.kort === "todo");
  const foer = ids(u.stak).join() + "|" + ids(u.app).join();
  u.fyr("dragstart", { target: k, dataTransfer: null }); u.fyr("drop", { target: bilEl, preventDefault(){} });
  t("træk virker ikke uden redigering", ids(u.stak).join() + "|" + ids(u.app).join() === foer, ids(u.stak).join());
}
process.exit(T.every(Boolean) ? 0 : 1);
