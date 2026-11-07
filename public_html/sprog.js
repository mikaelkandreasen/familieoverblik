// sprog.js — sprogvalg og oversættelse til hele siden.
//
// To lag, der arbejder sammen:
//  1. SPROGFILEN (sprog-pakker.js, lavet ud fra sprog/sprog.json, og evt. en fil lagt ind under Opsætning → Sprog). Den danske tekst er nøglen, så siderne
//     er skrevet på dansk som altid, og et sprog er blot en liste «dansk tekst → oversat tekst». Motoren oversætter tekst, attributter (placeholder, title,
//     aria-label, alt) og hele afsnit med <b>/<i>/<code>, også når siden selv bygger ny tekst bagefter. Det, der ikke står i filen, forbliver dansk.
//  2. KNAPPEN «Oversæt siden». Den maskinoversætter alt det, sprogfilen ikke dækker (skolebreve, aftaler, noter, jokes, stednavne …):
//     først i browseren, hvis den kan (Chrome/Edge på computer, på enheden og uden at sende noget), ellers via serveren (oversaet.php, Claude).
//
// Filen her har ingen afhængigheder uden for sprog-pakker.js, og siderne indlæser den med import(), så en fejl her aldrig vælter siden.

import { PAKKER } from "./sprog-pakker.js";

export const KILDESPROG = "da";
/** Sprog, der kan vælges til maskinoversættelse, også uden sprogfil. */
export const MASKINSPROG = {
  en: "English", de: "Deutsch", sv: "Svenska", no: "Norsk", fi: "Suomi", nl: "Nederlands", fr: "Français", es: "Español", it: "Italiano", pt: "Português",
  pl: "Polski", cs: "Čeština", sk: "Slovenčina", hu: "Magyar", ro: "Română", bg: "Български", el: "Ελληνικά", hr: "Hrvatski", sl: "Slovenščina", lt: "Lietuvių",
  uk: "Українська", ru: "Русский", tr: "Türkçe", ar: "العربية", he: "עברית", hi: "हिन्दी", th: "ไทย", vi: "Tiếng Việt", id: "Indonesia", ja: "日本語", ko: "한국어", zh: "中文",
};
const RTL = new Set(["ar", "he", "fa", "ur"]);
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "SVG", "CANVAS", "CODE", "KBD", "PRE"]);
const INLINE_TAGS = new Set(["B", "I", "EM", "STRONG", "CODE", "BR", "A", "SPAN", "SMALL", "KBD"]);
const ATTR = ["placeholder", "title", "aria-label", "alt"];
const NOEGLE_SPROG = "familieoverblik-sprog", NOEGLE_OVERSAET = "familieoverblik-oversaet", NOEGLE_CACHE = "familieoverblik-oversat-";
export const TILLADTE_TAGS = new Set(["b", "i", "em", "strong", "code", "br"]);

// ── Ordbog ───────────────────────────────────────────────────────────
export const norm = s => String(s ?? "").replace(/\s+/g, " ").trim();
const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** {dansk: oversat} → {exact, moenstre}. Nøgler med {0}, {1} … er mønstre, hvor pladsholderne er tal eller navne, der sættes ind igen. */
export function byggOrdbog(tekster){
  const exact = new Map(), moenstre = [];
  for (const [k, v] of Object.entries(tekster || {})){
    if (typeof v !== "string" || !v.trim()) continue;
    const nk = norm(k);
    if (/\{\d+\}/.test(nk)){
      let re = "^"; const idx = [];
      for (const d of nk.split(/(\{\d+\})/)){
        const m = /^\{(\d+)\}$/.exec(d);
        if (m){ re += "(.+?)"; idx.push(Number(m[1])); } else re += escRe(d);
      }
      moenstre.push({ re: new RegExp(re + "$"), til: v, idx, laengde: nk.length });
    } else exact.set(nk, v);
  }
  moenstre.sort((a, b) => b.laengde - a.laengde);
  return { exact, moenstre };
}
/** Oversættelsen af en streng, eller null, hvis ordbogen ikke kender den. */
export function oversaetStreng(s, ordbog){
  const n = norm(s);
  if (!n || !ordbog) return null;
  const e = ordbog.exact.get(n);
  if (e !== undefined) return e;
  for (const m of ordbog.moenstre){
    const r = m.re.exec(n);
    if (r) return m.til.replace(/\{(\d+)\}/g, (_, i) => { const p = m.idx.indexOf(Number(i)); return p >= 0 ? r[p + 1] : ""; });
  }
  return null;
}

/** Samme regler som lokal/sprog.py og sprog.php. Returnerer en liste af fejl (tom = i orden). */
export function validerFil(d){
  const fejl = [];
  if (!d || typeof d !== "object" || d.format !== 1) return ["«format» skal være 1"];
  if (d.kildesprog !== KILDESPROG) fejl.push("«kildesprog» skal være «da»");
  if (!d.sprog || typeof d.sprog !== "object" || Array.isArray(d.sprog) || !Object.keys(d.sprog).length) return fejl.concat("«sprog» mangler");
  for (const [kode, p] of Object.entries(d.sprog)){
    if (!/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(kode) || kode === KILDESPROG){ fejl.push(`${kode}: ugyldig sprogkode`); continue; }
    if (!p || typeof p !== "object" || Array.isArray(p) || typeof p.navn !== "string" || !p.navn.trim() || p.navn.length > 40){ fejl.push(`${kode}: «navn» mangler eller er for langt`); continue; }
    if (!p.tekster || typeof p.tekster !== "object" || Array.isArray(p.tekster)){ fejl.push(`${kode}: «tekster» mangler`); continue; }
    for (const [k, v] of Object.entries(p.tekster)){
      if (typeof v !== "string" || !v.trim()) continue;
      if (k.length > 600 || v.length > 1200) fejl.push(`${kode}: for lang tekst: ${k.slice(0, 40)}`);
      for (const t of [k, v]){
        for (const m of t.matchAll(/<\s*\/?\s*([A-Za-z0-9]+)[^>]*>/g)) if (!TILLADTE_TAGS.has(m[1].toLowerCase())) fejl.push(`${kode}: tagget <${m[1]}> er ikke tilladt`);
        if (/<[^>]*\s(?:on\w+|style|href|src)\s*=/i.test(t)) fejl.push(`${kode}: attributter er ikke tilladt`);
      }
      const a = (k.match(/\{\d+\}/g) || []).sort().join(), b = (v.match(/\{\d+\}/g) || []).sort().join();
      if (a !== b) fejl.push(`${kode}: pladsholdere passer ikke i «${k.slice(0, 40)}»`);
    }
  }
  return fejl;
}

// ── Oversætter af siden ──────────────────────────────────────────────
export class Oversaetter {
  constructor(doc = globalThis.document, Observer = globalThis.MutationObserver){
    this.doc = doc; this.Obs = Observer; this.ordbog = null; this.obs = null; this.travl = false;
    this.orig = new Map();       // tekstnode → dansk tekst
    this.attrOrig = new Map();   // element → {attribut: dansk tekst}
    this.htmlOrig = new Map();   // element → dansk innerHTML
    this.maskinNoder = new Set(); this.maskin = null; this._timer = null;
  }
  skal_springes_over(el){
    if (SKIP_TAGS.has(String(el.tagName).toUpperCase())) return true;
    const t = el.getAttribute && el.getAttribute("translate");
    return t === "no" || (el.classList && el.classList.contains && el.classList.contains("no-translate"));
  }
  /** Sæt en ordbog (eller null for dansk) og oversæt hele siden. */
  saet(ordbog){
    this.gendan();
    this.ordbog = ordbog;
    if (!ordbog) return;
    this._skriv(() => this.besog(this.doc.body));
    this.start();
  }
  start(){
    if (this.obs || !this.Obs || !this.doc.body) return;
    this.obs = new this.Obs(poster => this.paaMutation(poster));
    this.obs.observe(this.doc.body, { childList: true, subtree: true, characterData: true });
  }
  stop(){ if (this.obs){ this.obs.disconnect(); this.obs = null; } }
  _skriv(f){ this.travl = true; try { f(); } finally { this.travl = false; if (this.obs) this.obs.takeRecords(); } }
  paaMutation(poster){
    if (this.travl) return;
    this._skriv(() => {
      for (const p of poster){
        if (p.type === "characterData") this.tekstnode(p.target);
        else for (const n of p.addedNodes || []) this.besog(n);
      }
    });
    if (this.maskin) this.planlaeg();
  }
  besog(node){
    if (!node) return;
    if (node.nodeType === 3){ this.tekstnode(node); return; }
    if (node.nodeType !== 1 || this.skal_springes_over(node)) return;
    this.attributter(node);
    if (this.elementTekst(node)) return;
    for (const b of Array.from(node.childNodes || [])) this.besog(b);
  }
  tekstnode(n){
    if (!this.ordbog || (n.parentNode && n.parentNode.nodeType === 1 && this.skal_springes_over(n.parentNode))) return;
    const v = n.nodeValue, m = /^(\s*)([\s\S]*?)(\s*)$/.exec(v);
    if (!m[2]) return;
    const t = oversaetStreng(m[2], this.ordbog);
    if (t !== null && t !== m[2]){ if (!this.orig.has(n)) this.orig.set(n, v); n.nodeValue = m[1] + t + m[3]; }
  }
  attributter(el){
    if (!el.getAttribute) return;
    for (const a of ATTR){
      const v = el.getAttribute(a);
      if (!v) continue;
      const t = oversaetStreng(v, this.ordbog);
      if (t !== null && t !== v){
        const o = this.attrOrig.get(el) || {}; if (!(a in o)) o[a] = v; this.attrOrig.set(el, o);
        el.setAttribute(a, t);
      }
    }
  }
  /** Afsnit med indlejrede <b>/<i>/<code>: hele indholdet slås op som én tekst. */
  elementTekst(el){
    const born = Array.from(el.childNodes || []);
    const harEl = born.some(b => b.nodeType === 1);
    if (!harEl) return false;
    const alleInline = el => Array.from(el.childNodes || []).every(b => b.nodeType !== 1 || (INLINE_TAGS.has(String(b.tagName).toUpperCase()) && alleInline(b)));
    if (!alleInline(el)) return false;
    const html = el.innerHTML;
    if (typeof html !== "string" || html.length > 800) return false;
    const t = oversaetStreng(html, this.ordbog);
    if (t === null || t === norm(html)) return false;
    if (!this.htmlOrig.has(el)) this.htmlOrig.set(el, html);
    el.innerHTML = t;
    return true;
  }
  /** Tilbage til dansk: alt, hvad både ordbogen og maskinoversættelsen har ændret. */
  gendan(){
    this.stop();
    this._skriv(() => {
      for (const [n, v] of this.orig) n.nodeValue = v;
      for (const [el, o] of this.attrOrig) for (const [a, v] of Object.entries(o)) el.setAttribute(a, v);
      for (const [el, h] of this.htmlOrig) el.innerHTML = h;
    });
    this.orig.clear(); this.attrOrig.clear(); this.htmlOrig.clear(); this.maskinNoder.clear();
    this.ordbog = null; this.maskin = null;
    clearTimeout(this._timer);
  }

  // ── maskinoversættelse af resten ──
  /** Tekst, der skal maskinoversættes: danske tekstnoder (og placeholder/title), som ordbogen ikke har ændret. */
  kandidater(rod = this.doc.body){
    const ud = [];
    const gaa = node => {
      if (node.nodeType === 3){
        if (this.orig.has(node) || this.maskinNoder.has(node)) return;
        const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(node.nodeValue);
        if (m[2] && gyldigTilMaskine(m[2])) ud.push({ type: "tekst", node, kerne: m[2], foer: m[1], efter: m[3] });
        return;
      }
      if (node.nodeType !== 1 || this.skal_springes_over(node)) return;
      for (const a of ["placeholder", "title"]){
        const v = node.getAttribute && node.getAttribute(a);
        if (v && gyldigTilMaskine(v) && !(this.attrOrig.get(node) || {})[a]) ud.push({ type: "attr", node, attr: a, kerne: v });
      }
      for (const b of Array.from(node.childNodes || [])) gaa(b);
    };
    gaa(rod);
    return ud;
  }
  /** Oversæt alle kandidater med motoren. cache: Map(dansk → oversat). Returnerer antal ændrede steder. */
  async oversaetMaskinelt(motor, maal, cache = new Map(), status = () => {}){
    this.maskin = { motor, maal, cache, status };
    return this._koerMaskine();
  }
  async _koerMaskine(){
    const { motor, maal, cache, status } = this.maskin;
    const kand = this.kandidater();
    const mangler = [...new Set(kand.map(k => norm(k.kerne)))].filter(s => !cache.has(s));
    for (let i = 0; i < mangler.length; i += BATCH){
      const del = mangler.slice(i, i + BATCH);
      status(`Oversætter … ${Math.min(mangler.length, i + BATCH)} af ${mangler.length}`);
      const svar = await motor.oversaet(del, maal, KILDESPROG);
      if (!Array.isArray(svar) || svar.length !== del.length) throw new Error("Oversættelsen kom tilbage i en forkert form.");
      del.forEach((s, j) => { if (typeof svar[j] === "string" && svar[j].trim()) cache.set(s, svar[j]); });
    }
    let n = 0;
    this._skriv(() => {
      for (const k of kand){
        const t = cache.get(norm(k.kerne));
        if (!t || t === norm(k.kerne)) continue;
        if (k.type === "tekst"){ this.orig.set(k.node, k.foer + k.kerne + k.efter); this.maskinNoder.add(k.node); k.node.nodeValue = k.foer + t + k.efter; n++; }
        else {
          const o = this.attrOrig.get(k.node) || {}; if (!(k.attr in o)) o[k.attr] = k.kerne; this.attrOrig.set(k.node, o);
          k.node.setAttribute(k.attr, t); n++;
        }
      }
    });
    this.start();
    return n;
  }
  /** «Vis original»: kun maskinoversættelsen fortrydes; ordbogens sprog bliver stående. */
  gendanMaskin(){
    this._skriv(() => {
      for (const n of this.maskinNoder){ if (this.orig.has(n)){ n.nodeValue = this.orig.get(n); this.orig.delete(n); } }
    });
    this.maskinNoder.clear(); this.maskin = null; clearTimeout(this._timer);
  }
  /** Ny tekst, mens oversættelsen er slået til, samles og oversættes lidt senere (og højst MAX_AUTO gange pr. besøg). */
  planlaeg(){
    clearTimeout(this._timer);
    if (!this.maskin || this.autoKald >= MAX_AUTO) return;
    this._timer = setTimeout(async () => {
      if (!this.maskin) return;
      this.autoKald = (this.autoKald || 0) + 1;
      try { await this._koerMaskine(); } catch (e){ this.maskin && this.maskin.status(`Oversættelsen stoppede: ${e.message}`); }
    }, 900);
  }
}
const BATCH = 40, MAX_AUTO = 40;
/** Tekst, der giver mening at oversætte: mindst to bogstaver, ikke en adresse eller et filnavn, ikke for lang. */
export function gyldigTilMaskine(s){
  s = norm(s);
  if (s.length < 2 || s.length > 1200 || !/\p{L}{2}/u.test(s)) return false;
  if (/^(https?:\/\/|www\.)\S+$/i.test(s) || /^[\w.-]+\.(php|js|json|html|md|ics|env|sh|py|txt|yaml|yml)$/i.test(s) || /^[\w/.-]+\/$/.test(s)) return false;
  return true;
}

// ── Motorer til maskinoversættelse ───────────────────────────────────
/** Browserens indbyggede oversætter (Chrome 138+ og Edge 148+ på computer, ikke mobil, Firefox eller Safari). Kører på enheden. */
export function browserMotor(Translator = globalThis.Translator){
  return {
    navn: "browser",
    async klar(maal, kilde = KILDESPROG){
      if (!Translator) return null;
      try { const a = await Translator.availability({ sourceLanguage: kilde, targetLanguage: maal }); return a === "unavailable" ? null : a; } catch { return null; }
    },
    async opret(maal, kilde = KILDESPROG, status = () => {}){
      this.t = await Translator.create({ sourceLanguage: kilde, targetLanguage: maal,
        monitor(m){ m.addEventListener("downloadprogress", e => status(`Henter sprogpakke … ${Math.round((e.loaded || 0) * 100)} %`)); } });
    },
    async oversaet(strenge){ const ud = []; for (const s of strenge) ud.push(await this.t.translate(s)); return ud; },
  };
}
/** Serveren (oversaet.php, Claude). Sender teksten på siden til Anthropic. */
export function serverMotor(HEAD, fetchFn = globalThis.fetch){
  return {
    navn: "server",
    async klar(){ return "available"; },
    async opret(){},
    async oversaet(strenge, maal, kilde = KILDESPROG){
      const ud = [];
      for (let i = 0; i < strenge.length;){
        let n = 0, tegn = 0;
        while (i + n < strenge.length && n < 50 && tegn + strenge[i + n].length <= 9000){ tegn += strenge[i + n].length; n++; }
        if (!n){ n = 1; }
        const r = await fetchFn("oversaet.php", { method: "POST", headers: { ...HEAD, "Content-Type": "application/json" }, cache: "no-store", credentials: "same-origin",
          body: JSON.stringify({ maal, kilde, tekster: strenge.slice(i, i + n) }) });
        let d = null; try { d = await r.json(); } catch {}
        if (!r.ok || !d || !Array.isArray(d.tekster)) throw new Error((d && d.error) || (r.status === 404 ? "oversaet.php findes ikke på serveren endnu." : r.status === 403 ? "Log ind igen (åbn siden på ny)." : `HTTP ${r.status}`));
        ud.push(...d.tekster); i += n;
      }
      return ud;
    },
  };
}
/** Browserens egen oversætter, hvis den kan klare sprogparret, ellers serveren. */
export async function vaelgMotor(maal, HEAD, { Translator = globalThis.Translator, fetchFn } = {}){
  const b = browserMotor(Translator), a = await b.klar(maal);
  if (a) return { motor: b, tilstand: a };
  return { motor: serverMotor(HEAD, fetchFn), tilstand: "available" };
}
export function laesCache(maal, lager = globalThis.localStorage){
  try { return new Map(Object.entries(JSON.parse(lager.getItem(NOEGLE_CACHE + maal) || "{}"))); } catch { return new Map(); }
}
export function gemCache(maal, cache, lager = globalThis.localStorage){
  try {
    let e = [...cache.entries()]; if (e.length > 1500) e = e.slice(-1000);
    lager.setItem(NOEGLE_CACHE + maal, JSON.stringify(Object.fromEntries(e)));
  } catch { /* fuld lagerplads: oversættelsen virker stadig */ }
}

// ── Sprogvalg og kontrol ─────────────────────────────────────────────
/** Alle pakker: de medfølgende, og de, der er lagt ind under Opsætning → Sprog (de sidste vinder). */
export function samlPakker(tilpasset = {}){
  const ud = {};
  for (const [k, p] of Object.entries(PAKKER)) ud[k] = { navn: p.navn, retning: p.retning || "ltr", tekster: { ...p.tekster } };
  for (const [k, p] of Object.entries(tilpasset || {})){
    if (!p || typeof p.navn !== "string" || typeof p.tekster !== "object") continue;
    ud[k] = { navn: p.navn, retning: RTL.has(k) ? "rtl" : "ltr", tekster: { ...(ud[k] ? ud[k].tekster : {}), ...p.tekster } };
  }
  return ud;
}
/** Hvilket sprog skal vises: det valgte på enheden, ellers serverens standard, ellers dansk. */
export function vaelgSprog({ gemt, standard, pakker }){
  const gyldig = k => typeof k === "string" && (k === KILDESPROG || pakker[k] || MASKINSPROG[k]);
  return gyldig(gemt) ? gemt : gyldig(standard) ? standard : KILDESPROG;
}

/**
 * Sætter sprog og oversættelse på siden og bygger kontrollen (sprogvælger og «Oversæt siden») i container.
 * Returnerer {oversaetter, skift, oversaet, pakker}. Alt kan sendes ind udefra, så det kan afprøves.
 */
export async function startSprog({ HEAD = {}, container = null, doc = globalThis.document, lager = globalThis.localStorage, fetchFn = globalThis.fetch,
  Observer = globalThis.MutationObserver, Translator = globalThis.Translator } = {}){
  let server = {};
  try { const r = await fetchFn("sprog.php", { headers: HEAD, cache: "no-store", credentials: "same-origin" }); if (r.ok) server = await r.json(); } catch { /* standard: dansk */ }
  const pakker = samlPakker(server.tilpasset);
  const o = new Oversaetter(doc, Observer);
  let kode = vaelgSprog({ gemt: lager.getItem(NOEGLE_SPROG), standard: server.standard, pakker });
  const els = {};

  const navnFor = k => k === KILDESPROG ? "Dansk" : (pakker[k] && pakker[k].navn) || MASKINSPROG[k] || k;
  const status = t => { if (els.status) els.status.textContent = t || ""; };
  function anvend(k){
    kode = k;
    doc.documentElement.lang = k;
    doc.documentElement.dir = RTL.has(k) ? "rtl" : "ltr";
    o.saet(pakker[k] ? byggOrdbog(pakker[k].tekster) : null);
    if (els.knap) opdaterKnap();
  }
  function opdaterKnap(){
    const oversat = !!o.maskin;
    els.knap.disabled = kode === KILDESPROG;
    els.knap.textContent = oversat ? "Vis original" : "Oversæt siden";
    els.knap.setAttribute("aria-pressed", String(oversat));
    if (!oversat && kode === KILDESPROG) status("");
  }
  async function oversaet(brugerKlik = true){
    if (kode === KILDESPROG) return 0;
    if (o.maskin){ o.gendanMaskin(); try { lager.setItem(NOEGLE_OVERSAET, JSON.stringify({ aktiv: false })); } catch {} status(""); opdaterKnap(); return 0; }
    const cache = laesCache(kode, lager);
    const { motor, tilstand } = await vaelgMotor(kode, HEAD, { Translator, fetchFn });
    if (tilstand !== "available" && !brugerKlik){ status("Tryk på «Oversæt siden» for at hente sprogpakken."); return 0; }   // download kræver et tryk
    status(motor.navn === "browser" ? "Oversætter i din browser (intet forlader enheden) …" : "Oversætter via serveren (teksten sendes til Claude) …");
    try {
      await motor.opret(kode, KILDESPROG, status);
      const n = await o.oversaetMaskinelt(motor, kode, cache, status);
      gemCache(kode, cache, lager);
      try { lager.setItem(NOEGLE_OVERSAET, JSON.stringify({ aktiv: true, maal: kode })); } catch {}
      status(n ? `Oversat ${n} steder ${motor.navn === "browser" ? "i din browser" : "af Claude via serveren"}.` : "Intet mere at oversætte.");
      opdaterKnap();
      return n;
    } catch (e){ o.maskin = null; status(`Kunne ikke oversætte: ${e.message}`); opdaterKnap(); return 0; }
  }
  async function skiftSprog(k){
    const var_oversat = !!o.maskin;
    try { lager.setItem(NOEGLE_SPROG, k); } catch {}
    if (els.vaelger) els.vaelger.value = k;
    anvend(k);
    status("");
    if (var_oversat && k !== KILDESPROG) await oversaet(true);
  }
  function byg(){
    if (!container) return;
    const lav = (tag, tekst) => { const e = doc.createElement(tag); if (tekst !== undefined) e.textContent = tekst; return e; };
    if (doc.head && !(doc.getElementById && doc.getElementById("sprog-css"))){
      const css = lav("style", ".sprog-kontrol{display:flex;flex-direction:column;gap:6px;padding:8px 12px;font-size:14px}.sprog-kontrol label{display:flex;flex-direction:column;gap:3px}.sprog-kontrol select,.sprog-kontrol button{font:inherit;min-height:40px;padding:0 10px;border:1px solid rgba(127,127,127,.5);border-radius:4px;background:transparent;color:inherit}.sprog-kontrol button[disabled]{opacity:.5}.sprog-status{font-size:12px;opacity:.8;min-height:1.2em}");
      css.id = "sprog-css"; doc.head.appendChild(css);
    }
    const d = lav("div"); d.className = "sprog-kontrol";
    const label = lav("label", "Sprog"); els.vaelger = lav("select"); els.vaelger.setAttribute("aria-label", "Sprog");
    els.knap = lav("button", "Oversæt siden"); els.knap.type = "button"; els.knap.className = "sprog-knap";
    els.status = lav("span"); els.status.className = "sprog-status"; els.status.setAttribute("aria-live", "polite");
    const med = [KILDESPROG, ...Object.keys(pakker)], uden = Object.keys(MASKINSPROG).filter(k => !med.includes(k));
    const opt = (k, tekst) => { const x = lav("option", tekst); x.value = k; x.setAttribute("translate", "no"); return x; };
    for (const k of med) els.vaelger.appendChild(opt(k, navnFor(k)));
    for (const k of uden) els.vaelger.appendChild(opt(k, `${MASKINSPROG[k]} (maskinoversat)`));
    els.vaelger.value = kode;
    label.appendChild(els.vaelger);
    [label, els.knap, els.status].forEach(x => d.appendChild(x));
    container.appendChild(d);
    els.vaelger.addEventListener("change", () => skiftSprog(els.vaelger.value));
    els.knap.addEventListener("click", () => oversaet(true));
  }
  byg();
  anvend(kode);
  // oversættelsen husker, at den var slået til for dette sprog
  try {
    const s = JSON.parse(lager.getItem(NOEGLE_OVERSAET) || "null");
    if (s && s.aktiv && s.maal === kode && kode !== KILDESPROG) await oversaet(false);
  } catch { /* ingen */ }
  return { oversaetter: o, skift: skiftSprog, oversaet, pakker, get kode(){ return kode; }, els };
}
