import fs from "fs";
const T=[]; const t=(n,ok,x="")=>{T.push(ok);console.log(ok?"ok  ":"FEJL",n,ok?"":x)};
const src = fs.readFileSync("/tmp/vaelger_page.mjs","utf8").replace(/^import .*$/mg, 'const API_KEY = "k";').replace('import("./sprog.js")', "Promise.resolve({ startSprog(){} })");
const kerne = src.slice(src.indexOf("// ── Kerne"), src.indexOf("// ── Slut på kernen"));
const K = new Function("crypto", "const TAU = Math.PI * 2;" + kerne + "; return { parseListe, tilfaeldigt, traekFlere, bland, slutVinkel, vinderUnderPil, easeOut, hjulFarver, TAU, FARVER, MAX_VALG, MAX_TEKST, EKSEMPLER };")(globalThis.crypto);
const TAU = K.TAU;

// ── liste ──
t("parseListe: trimmer, dropper tomme linjer, tåler \\r\\n", JSON.stringify(K.parseListe("  a \r\n\n b\n   \nc")) === '["a","b","c"]');
t("parseListe: højst 200 valg og 60 tegn pr. valg (tæller tegn, ikke bytes)", K.parseListe(Array.from({ length: 300 }, (_, i) => "v" + i).join("\n")).length === 200 && K.parseListe("æ".repeat(100))[0].length === 60 && K.parseListe("😀".repeat(70))[0] === "😀".repeat(60));
t("parseListe: dubletter bevares (de giver større chance)", K.parseListe("a\na\nb").length === 3);
t("parseListe: tom og null", K.parseListe("").length === 0 && K.parseListe(null).length === 0);
// ── tilfældighed med en kendt generator ──
const fast = vals => { let i = 0; return { getRandomValues(a){ a[0] = vals[i++ % vals.length]; return a; } }; };
t("tilfaeldigt: ét valg giver 0 uden at bruge generatoren", K.tilfaeldigt(1, { getRandomValues(){ throw new Error("skal ikke kaldes"); } }) === 0);
t("tilfaeldigt: værdier fra og med grænsen afvises (ingen modulo-skævhed), den første under den bruges", (() => { const n = 7, graense = Math.floor(0x100000000 / n) * n; return graense === 4294967292 && K.tilfaeldigt(n, fast([0xFFFFFFFF, graense, graense + 1, graense - 1])) === (graense - 1) % 7; })());
t("tilfaeldigt: ugyldigt antal giver fejl", (() => { try { K.tilfaeldigt(0); return false; } catch { return true; } })() && (() => { try { K.tilfaeldigt(2.5); return false; } catch { return true; } })());
{ const n = 7, tael = new Array(n).fill(0), N = 70000; for (let i = 0; i < N; i++) tael[K.tilfaeldigt(n)]++;
  const chi = tael.reduce((s, x) => s + (x - N / n) ** 2 / (N / n), 0);
  t("tilfaeldigt: jævn fordeling (χ² for 7 valg under 22,5, p>0,001)", chi < 22.5, chi.toFixed(2) + " " + tael.join()); }
t("traekFlere: forskellige indeks, rigtigt antal, aldrig mere end der findes", (() => { const a = K.traekFlere(10, 4); return a.length === 4 && new Set(a).size === 4 && a.every(i => i >= 0 && i < 10) && K.traekFlere(3, 9).length === 3 && new Set(K.traekFlere(3, 9)).size === 3; })());
t("bland: samme elementer, ændrer ikke originalen", (() => { const o = ["a","b","c","d","e"]; const b = K.bland(o); return b.length === 5 && [...b].sort().join() === "a,b,c,d,e" && o.join() === "a,b,c,d,e"; })());
{ let alt = true; const n = 5, p = {}; for (let i = 0; i < 30000; i++){ const k = K.bland([0,1,2]).join(); p[k] = (p[k] || 0) + 1; } const v = Object.values(p); alt = v.length === 6 && Math.min(...v) > 4400 && Math.max(...v) < 5600;
  t("bland: alle seks rækkefølger af tre elementer forekommer jævnt", alt, JSON.stringify(p)); }
// ── geometri ──
{ let fejl = [];
  for (const n of [2, 3, 4, 5, 7, 8, 10, 13, 24, 60, 100, 200]) for (let i = 0; i < n; i++) for (const u of [0.01, 0.15, 0.5, 0.85, 0.99]) for (const r of [5, 6, 7]){
    const th = K.slutVinkel(i, n, u, r); if (K.vinderUnderPil(th, n) !== i) fejl.push(`n=${n} i=${i} u=${u}`); if (th < r * TAU - 1e-9 || th >= (r + 1) * TAU + 1e-9) fejl.push("omgange " + n); }
  t("slutVinkel/vinderUnderPil: pilen står under det valgte udsnit for alle n, i, placeringer og omgange", fejl.length === 0, fejl.slice(0, 3).join(" | ")); }
t("slutVinkel giver mindst de ønskede hele omgange", K.slutVinkel(0, 4, 0.5, 5) >= 5 * TAU);
t("vinderUnderPil: vinkel 0 = første udsnit er lige til højre for pilen? (u=0 giver udsnit 0 under pilen)", K.vinderUnderPil(0, 6) === 0 && K.vinderUnderPil(TAU - 1e-6, 6) === 0);
t("easeOut: 0→0, 1→1, vokser, og afgrænses", K.easeOut(0) === 0 && K.easeOut(1) === 1 && K.easeOut(0.5) > K.easeOut(0.25) && K.easeOut(-3) === 0 && K.easeOut(9) === 1);
t("hjulFarver: naboer er aldrig ens, heller ikke sidste og første", [2,3,5,10,11,12,21,31,101].every(n => { const f = K.hjulFarver(n); return f.length === n && f.every((c, i) => i === 0 || c !== f[i - 1]) && (n < 2 || f[n - 1] !== f[0]); }));
t("alle eksempler har mindst to valg", Object.values(K.EKSEMPLER).every(e => K.parseListe(e).length >= 2));

// ── siden som helhed ──
class El { constructor(id){ this.id = id; this.value = ""; this.checked = false; this.textContent = ""; this.hidden = false; this.disabled = false; this.children = []; this.handlers = {}; this._cls = new Set(); this.width = 960; this.height = 960; this.tagName = id === "liste" ? "TEXTAREA" : "DIV"; }
  addEventListener(t, f){ (this.handlers[t] ??= []).push(f); } get classList(){ const s = this._cls; return { toggle: (c, on) => { on ? s.add(c) : s.delete(c); } }; }
  appendChild(e){ this.children.push(e); return e; } insertBefore(e, ref){ this.children.unshift(e); return e; } removeChild(e){ this.children = this.children.filter(x => x !== e); } get firstChild(){ return this.children[0]; } get lastChild(){ return this.children.at(-1); }
  getContext(){ const rec = this._rec = this._rec || { arcs: 0, texts: [], fills: 0 }; return new Proxy({}, { get: (_, p) => p === "arc" ? () => { rec.arcs++; } : p === "fillText" ? (tx) => { rec.texts.push(tx); } : p === "measureText" ? (tx) => ({ width: tx.length * 10 }) : p === "fill" ? () => { rec.fills++; } : () => {}, set: () => true }); } }
function side({ reduce = true, lager = {}, rng = globalThis.crypto } = {}){
  const els = {}; const el = id => (els[id] ??= new El(id));
  const document = { getElementById: el, createElement: () => new El("li"), addEventListener: (t, f) => { (el("__doc").handlers[t] ??= []).push(f); } };
  const localStorage = { getItem: k => lager[k] ?? null, setItem: (k, v) => { lager[k] = v; } };
  let raf = null; const rafStub = f => { raf = f; };
  let nu = 0; const performance = { now: () => nu };
  const matchMedia = () => ({ matches: reduce });
  new Function("document","localStorage","crypto","requestAnimationFrame","performance","matchMedia", src)(document, localStorage, rng, rafStub, performance, matchMedia);
  const klik = id => { for (const h of els[id].handlers.click || []) h({}); };
  return { el, els, lager, klik, tid: ms => { nu = ms; const f = raf; raf = null; if (f) f(nu); return !!f; }, key: (key, tag = "DIV") => { for (const h of els.__doc.handlers.keydown || []) h({ key, target: { tagName: tag } }); }, skriv: v => { els.liste.value = v; for (const h of els.liste.handlers.input || []) h({}); }, aendr: id => { for (const h of els[id].handlers.change || []) h({}); } };
}
let p = side();
t("første åbning: eksemplet «Aftensmad» er indsat, 8 valg og Drej er aktiv", p.el("liste").value.split("\n").length === 8 && p.el("info").textContent === "8 valg" && p.el("drej").disabled === false);
t("hjulet tegner ét udsnit pr. valg", p.el("hjul")._rec.arcs >= 8);
p.skriv("Kun én"); t("under to valg: Drej er slået fra", p.el("drej").disabled === true);
p.klik("drej"); t("…og et klik giver en forklaring", /mindst to valg/.test(p.el("fejl").textContent));
p.skriv("Rød\nGrøn\nBlå"); p.klik("drej");
t("reduceret bevægelse: valget vises med det samme og lander i historikken", ["Rød","Grøn","Blå"].includes(p.el("resultat").textContent) && p.el("historik").children.length === 1 && p.el("tomHistorik").hidden === true, p.el("resultat").textContent);
t("husker liste og valg i browseren", JSON.parse(p.lager["familieoverblik-vaelger"]).liste === "Rød\nGrøn\nBlå");
// bestemt vinder med kendt generator: hjulets slutstilling matcher resultatet
{ let q = side({ reduce: false, rng: fast([1, 500, 1, 2000]) }); q.skriv("A\nB\nC\nD"); q.klik("drej");
  t("animeret: knappen er slået fra og resultatet skjult mens hjulet drejer", q.el("drej").disabled === true && q.el("resultat").textContent === "…");
  let trin = 0; while (q.tid(100 + trin * 700)) { trin++; if (trin > 60) break; }
  const slut = q.el("resultat").textContent;
  t("animeret: hjulet standser, vinderen vises og knappen er aktiv igen", ["A","B","C","D"].includes(slut) && q.el("drej").disabled === false && trin >= 2 && trin < 60, `${slut} efter ${trin} billeder`); }
// fjern vinderen
p = side(); p.skriv("a\nb\nc"); p.el("fjern").checked = true; p.klik("drej");
t("«Fjern vinderen» fjerner netop den linje og opdaterer hjulet", p.el("liste").value.split("\n").length === 2 && p.el("info").textContent === "2 valg" && !p.el("liste").value.split("\n").includes(p.el("resultat").textContent), p.el("liste").value + " | " + p.el("resultat").textContent);
// hurtigt valg
p = side(); p.skriv("a\nb\nc\nd\ne\nf"); p.el("hurtig").checked = true; p.aendr("hurtig");
t("hurtigt valg: antal-feltet vises og knappen hedder Vælg", p.el("antalBlok").hidden === false && p.el("drej").textContent === "Vælg");
p.el("antal").value = "3"; p.klik("drej");
const vinder = p.el("resultat").textContent.match(/\d\. \w/g) || [];
t("hurtigt valg: tre forskellige vindere, nummereret, i historikken", vinder.length === 3 && new Set(vinder.map(x => x.slice(3))).size === 3 && p.el("historik").children[0].textContent.split(", ").length === 3, p.el("resultat").textContent);
p.el("fjern").checked = true; p.klik("drej");
t("hurtigt valg med «Fjern»: alle tre vindere fjernes fra listen", p.el("liste").value.split("\n").filter(Boolean).length === 3, p.el("liste").value);
p.el("antal").value = "99"; p.skriv("a\nb"); p.klik("drej");
t("flere vindere end valg: alle valg trækkes, aldrig fejl", /1\. \w\s+2\. \w/.test(p.el("resultat").textContent), p.el("resultat").textContent);
// bland / ryd / eksempler / Enter
p = side(); p.skriv("1\n2\n3\n4\n5\n6\n7\n8\n9"); p.klik("bland");
t("Bland beholder de samme valg", p.el("liste").value.split("\n").sort().join() === "1,2,3,4,5,6,7,8,9");
p.klik("ryd"); t("Ryd tømmer listen og nulstiller resultatet", p.el("liste").value === "" && /Skriv dine valg/.test(p.el("resultat").textContent) && p.el("drej").disabled === true);
p.el("eksempel").value = "std:Ja eller nej"; p.aendr("eksempel");
t("eksempel indsættes og vælgeren nulstilles", p.el("liste").value === "Ja\nNej" && p.el("eksempel").value === "");
p.klik("ryd"); p.skriv("x\ny"); const før = p.el("historik").children.length; p.key("Enter");
t("Enter vælger (men ikke i tekstfeltet eller på en knap)", p.el("historik").children.length === før + 1);
p.key("Enter", "TEXTAREA"); p.key("Enter", "BUTTON"); t("Enter i tekstfeltet gør intet", p.el("historik").children.length === før + 1);
// historik højst 10
p = side(); p.skriv("a\nb"); for (let i = 0; i < 14; i++) p.klik("drej");
t("historikken holder de seneste 10", p.el("historik").children.length === 10);
// genåbning
const l = {}; p = side({ lager: l }); p.skriv("æ\nø\nå"); p.el("fjern").checked = true; p.aendr("fjern");
const q = side({ lager: l });
t("ved genåbning er listen og valgene tilbage", q.el("liste").value === "æ\nø\nå" && q.el("fjern").checked === true);
t("ødelagt gemt tilstand giver eksemplet, ikke en fejl", (() => { try { const z = side({ lager: { "familieoverblik-vaelger": "{ikke json" } }); return z.el("liste").value.includes("Pasta"); } catch { return false; } })());
process.exit(T.every(Boolean)?0:1);
