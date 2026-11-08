// Læs en tømmekalender fra en PDF (eller fra tekst, der er kopieret ud af en PDF) og foreslå en tidsplan pr. slags affald.
// Alt sker i browseren: PDF'en forlader aldrig enheden, og der er ingen server-kode. Kun til opsætningen (index.html).
//
// To trin:
//   1. laesPdf(bytes)        → linjer med tekst (en lille PDF-læser: objekter, Flate-pakning, objektstrømme, skrifttyper med ToUnicode, tekst-operatorer)
//   2. tolkKalender(linjer)  → { aar, fraktioner: [{ navn, datoer: [ÅÅÅÅ-MM-DD] }], advarsler }  (datoer og fraktioner genkendes ud fra tekst)
// og tilPlan(datoer) (i affald.js) gør datoerne til start/hver/udgår/ekstra.
// Læseren klarer almindelige PDF'er med tekst. Den klarer IKKE skannede billeder, og en kalender, hvor affaldstypen kun vises med en farve eller et symbol, har ingen tekst at læse.
import { FRAKTIONER, dagNr, isoFraDag } from "./affald.js";

/* ═══ 1. PDF → tekst ═══════════════════════════════════════════════ */
const str = u8 => { let s = ""; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return s; };
const bytes = s => { const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 255; return u; };

async function inflate(u8){
  for (const fmt of ["deflate", "deflate-raw"]){
    try {
      const ds = new DecompressionStream(fmt), w = ds.writable.getWriter();
      const data = fmt === "deflate" ? u8 : u8.subarray(2);
      w.write(data).catch(() => {}); w.close().catch(() => {});
      return new Uint8Array(await new Response(ds.readable).arrayBuffer());
    } catch { /* næste forsøg */ }
  }
  return null;
}
function hexTilBytes(s){ s = s.replace(/[^0-9a-fA-F]/g, ""); if (s.length % 2) s += "0"; const u = new Uint8Array(s.length / 2); for (let i = 0; i < u.length; i++) u[i] = parseInt(s.substr(i * 2, 2), 16); return u; }
function a85(s){
  s = s.replace(/\s+/g, "").replace(/^<~/, "").replace(/~>$/, ""); const ud = [];
  for (let i = 0; i < s.length;){
    if (s[i] === "z"){ ud.push(0, 0, 0, 0); i++; continue; }
    const g = s.substr(i, 5); i += 5; const n = g.length; let v = 0;
    for (let k = 0; k < 5; k++) v = v * 85 + ((g.charCodeAt(k) || 117) - 33);
    for (let k = 0; k < n - 1; k++) ud.push((v >>> (24 - 8 * k)) & 255);
  }
  return Uint8Array.from(ud);
}
async function dekod(dict, data){
  const m = /\/Filter\s*(\[[^\]]*\]|\/\w+)/.exec(dict);
  if (!m) return data;
  let ud = data;
  for (const f of m[1].match(/\/\w+/g) || []){
    if (f === "/FlateDecode" || f === "/Fl") ud = await inflate(ud);
    else if (f === "/ASCIIHexDecode" || f === "/AHx") ud = hexTilBytes(str(ud).replace(/>.*$/s, ""));
    else if (f === "/ASCII85Decode" || f === "/A85") ud = a85(str(ud));
    else return null;                                                       // billeder, LZW m.m.: ikke tekst
    if (!ud) return null;
  }
  return ud;
}

/** Den afbalancerede værdi, der står efter en nøgle i en ordbog: «<< … >>», «[ … ]», «N G R» eller et navn/tal. */
function vaerdi(tekst, noegle){
  const m = new RegExp(`${noegle}(?![A-Za-z])\\s*`).exec(tekst);
  if (!m) return null;
  let i = m.index + m[0].length;
  if (tekst.startsWith("<<", i) || tekst[i] === "["){
    const aaben = tekst[i], dyb0 = 0; let dyb = dyb0, j = i;
    for (; j < tekst.length; j++){
      if (tekst.startsWith("<<", j)){ dyb++; j++; } else if (tekst.startsWith(">>", j)){ dyb--; j++; if (dyb === 0 && aaben === "<") return tekst.slice(i, j + 1); }
      else if (aaben === "[" && tekst[j] === "[") dyb++; else if (aaben === "[" && tekst[j] === "]"){ dyb--; if (dyb === 0) return tekst.slice(i, j + 1); }
    }
    return null;
  }
  const r = /^\d+\s+\d+\s+R/.exec(tekst.slice(i));
  if (r) return r[0];
  const x = /^[^\s/<>\[\]]+|^\/[^\s/<>\[\]]+/.exec(tekst.slice(i));
  return x ? x[0] : null;
}
const refNr = v => { const m = /^(\d+)\s+\d+\s+R/.exec(v || ""); return m ? Number(m[1]) : null; };

/** Alle objekter i filen (også dem, der ligger pakket i objektstrømme): nummer → { dict, data }. */
async function objekter(u8){
  const s = str(u8), ud = new Map(), re = /(\d+)\s+(\d+)\s+obj\b/g; let m;
  const strømme = [];
  while ((m = re.exec(s))){
    const nr = Number(m[1]), start = m.index + m[0].length, slut = s.indexOf("endobj", start);
    if (slut < 0) break;
    let krop = s.slice(start, slut), data = null;
    const si = krop.search(/>>\s*stream\r?\n?/);
    if (si >= 0){
      const kv = /stream\r?\n?/.exec(krop.slice(si)), dstart = si + kv.index + kv[0].length;
      const dict = krop.slice(0, si + 2);
      const len = /\/Length\s+(\d+)(?!\s+\d+\s+R)/.exec(dict);
      let dslut = len && krop.startsWith("endstream", dstart + Number(len[1]) + (/^\r?\n/.exec(krop.slice(dstart + Number(len[1])))?.[0].length || 0)) ? dstart + Number(len[1]) : krop.lastIndexOf("endstream");
      if (dslut < dstart) dslut = krop.length;
      data = bytes(krop.slice(dstart, dslut).replace(/\r?\n$/, ""));
      krop = dict;
    }
    ud.set(nr, { dict: krop, data });
    if (/\/Type\s*\/ObjStm/.test(krop)) strømme.push(nr);
    re.lastIndex = slut;
  }
  for (const nr of strømme){                                                // objekter pakket i en objektstrøm
    const o = ud.get(nr), d = o.data && await dekod(o.dict, o.data);
    if (!d) continue;
    const n = Number(/\/N\s+(\d+)/.exec(o.dict)?.[1] || 0), foerste = Number(/\/First\s+(\d+)/.exec(o.dict)?.[1] || 0), t = str(d);
    const par = t.slice(0, foerste).trim().split(/\s+/).map(Number);
    for (let i = 0; i < n; i++){
      const onr = par[i * 2], off = par[i * 2 + 1], neste = i + 1 < n ? par[i * 2 + 3] : t.length - foerste;
      if (Number.isFinite(onr) && !ud.has(onr)) ud.set(onr, { dict: t.slice(foerste + off, foerste + neste), data: null });
    }
  }
  return ud;
}

/* Skrifttyper: kode → tegn (ToUnicode, ellers Differences, ellers Latin-1) */
const GLYF = { space: " ", period: ".", comma: ",", slash: "/", hyphen: "-", minus: "-", endash: "–", emdash: "—", colon: ":", semicolon: ";", parenleft: "(", parenright: ")", ampersand: "&", percent: "%", plus: "+",
  zero: "0", one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9", AE: "Æ", ae: "æ", Oslash: "Ø", oslash: "ø", Aring: "Å", aring: "å", eacute: "é", Eacute: "É", quotesingle: "'", fi: "fi", fl: "fl" };
const uni = hex => { let s = ""; for (let i = 0; i + 3 < hex.length + 1; i += 4) s += String.fromCharCode(parseInt(hex.substr(i, 4), 16)); return s; };
function laesCMap(tekst){
  const kort = new Map(); let bredde = 0;
  for (const b of tekst.matchAll(/begincodespacerange([\s\S]*?)endcodespacerange/g)){ const h = /<([0-9a-fA-F]+)>/.exec(b[1]); if (h) bredde = Math.max(bredde, h[1].length / 2); }
  for (const b of tekst.matchAll(/beginbfchar([\s\S]*?)endbfchar/g))
    for (const p of b[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)){ kort.set(parseInt(p[1], 16), uni(p[2])); bredde = bredde || p[1].length / 2; }
  for (const b of tekst.matchAll(/beginbfrange([\s\S]*?)endbfrange/g))
    for (const p of b[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(<[0-9a-fA-F]+>|\[[^\]]*\])/g)){
      const lo = parseInt(p[1], 16), hi = Math.min(parseInt(p[2], 16), lo + 65535); bredde = bredde || p[1].length / 2;
      if (p[3][0] === "["){ const liste = [...p[3].matchAll(/<([0-9a-fA-F]+)>/g)].map(x => uni(x[1])); liste.forEach((u, i) => kort.set(lo + i, u)); }
      else { const base = parseInt(p[3].slice(1, -1), 16), baseLen = p[3].length - 2; for (let c = lo; c <= hi; c++) kort.set(c, uni((base + c - lo).toString(16).padStart(baseLen, "0"))); }
    }
  return { kort, bredde: bredde || 1 };
}
async function skrifttype(o, objs){
  const f = { kort: null, bredde: 1, diff: null };
  const tu = refNr(vaerdi(o.dict, "/ToUnicode"));
  if (tu && objs.get(tu) && objs.get(tu).data){ const d = await dekod(objs.get(tu).dict, objs.get(tu).data); if (d){ const c = laesCMap(str(d)); f.kort = c.kort; f.bredde = c.bredde; } }
  if (/\/Subtype\s*\/Type0/.test(o.dict) && !f.kort) f.bredde = 2;
  const enc = vaerdi(o.dict, "/Encoding"); const encTekst = enc && refNr(enc) && objs.get(refNr(enc)) ? objs.get(refNr(enc)).dict : enc || "";
  const dif = /\/Differences\s*\[([^\]]*)\]/.exec(encTekst);
  if (dif){ f.diff = new Map(); let kode = 0; for (const t of dif[1].match(/\/[^\s/]+|\d+/g) || []){ if (/^\d+$/.test(t)) kode = Number(t); else { const n = t.slice(1); f.diff.set(kode++, GLYF[n] ?? (n.length === 1 ? n : "")); } } }
  return f;
}
function afkod(f, s){
  let ud = "";
  if (f && f.bredde === 2){ for (let i = 0; i + 1 < s.length; i += 2){ const k = (s.charCodeAt(i) << 8) | s.charCodeAt(i + 1); ud += f.kort && f.kort.has(k) ? f.kort.get(k) : (f.kort ? "" : ""); } return ud; }
  for (let i = 0; i < s.length; i++){ const k = s.charCodeAt(i); ud += f && f.kort && f.kort.has(k) ? f.kort.get(k) : f && f.diff && f.diff.has(k) ? f.diff.get(k) : String.fromCharCode(k); }
  return ud;
}

/* Indholdsstrøm: tegnsæt, tekstoperatorer og positioner */
function* symboler(t){
  let i = 0; const n = t.length;
  while (i < n){
    const c = t[i];
    if (/\s/.test(c)){ i++; continue; }
    if (c === "%"){ while (i < n && t[i] !== "\n" && t[i] !== "\r") i++; continue; }
    if (c === "("){
      let dyb = 1, s = ""; i++;
      while (i < n && dyb){
        const d = t[i];
        if (d === "\\"){ const e = t[i + 1]; i += 2;
          if (e === "n") s += "\n"; else if (e === "r") s += "\r"; else if (e === "t") s += "\t"; else if (e === "b") s += "\b"; else if (e === "f") s += "\f";
          else if (/[0-7]/.test(e)){ let o = e; while (o.length < 3 && /[0-7]/.test(t[i] || "")){ o += t[i]; i++; } s += String.fromCharCode(parseInt(o, 8) & 255); }
          else if (e === "\n" || e === "\r"){ if (e === "\r" && t[i] === "\n") i++; } else s += e;
          continue; }
        if (d === "(") dyb++; else if (d === ")"){ dyb--; if (!dyb){ i++; break; } }
        s += d; i++;
      }
      yield { t: "s", v: s }; continue;
    }
    if (c === "<" && t[i + 1] === "<"){ i += 2; yield { t: "dict+" }; continue; }
    if (c === ">" && t[i + 1] === ">"){ i += 2; yield { t: "dict-" }; continue; }
    if (c === "<"){ const e = t.indexOf(">", i); const h = t.slice(i + 1, e < 0 ? n : e); i = e < 0 ? n : e + 1; yield { t: "s", v: str(hexTilBytes(h)) }; continue; }
    if (c === "["){ i++; yield { t: "[" }; continue; }
    if (c === "]"){ i++; yield { t: "]" }; continue; }
    if (c === "/"){ let j = i + 1; while (j < n && !/[\s/<>\[\]()%]/.test(t[j])) j++; yield { t: "n", v: t.slice(i + 1, j) }; i = j; continue; }
    let j = i; while (j < n && !/[\s/<>\[\]()%]/.test(t[j])) j++; if (j === i) j = i + 1;
    const w = t.slice(i, j); i = j;
    yield /^[+-]?(\d+\.?\d*|\.\d+)$/.test(w) ? { t: "d", v: parseFloat(w) } : { t: "o", v: w };
  }
}
const gang = (a, b) => [a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3], a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3], a[4] * b[0] + a[5] * b[2] + b[4], a[4] * b[1] + a[5] * b[3] + b[5]];
const I = () => [1, 0, 0, 1, 0, 0];

function indhold(tekst, skrifter){
  const ud = [], stak = []; let ctm = I(), tm = I(), tlm = I(), font = null, str_ = 12, tl = 0, tz = 1;
  let operanter = [], arr = null, dyb = 0;
  const vis = (s, afstand = null) => {
    const t = afkod(font, s); if (!t) return;
    const m = gang(tm, ctm), stoerrelse = Math.abs(str_ * Math.hypot(m[2], m[3]) || str_), op = m[3] >= 0;
    ud.push({ x: m[4], y: op ? m[5] : -m[5], s: stoerrelse, t, bredde: t.length * 0.5 * stoerrelse });
    tm = [tm[0], tm[1], tm[2], tm[3], tm[4] + t.length * 0.5 * str_ * tz, tm[5]];
  };
  const flyt = (tx, ty) => { tlm = gang([1, 0, 0, 1, tx, ty], tlm); tm = tlm.slice(); };
  for (const x of symboler(tekst)){
    if (x.t === "[" ){ arr = []; continue; }
    if (x.t === "]"){ operanter.push({ t: "arr", v: arr || [] }); arr = null; continue; }
    if (x.t === "dict+"){ dyb++; continue; } if (x.t === "dict-"){ dyb--; continue; }
    if (dyb) continue;
    if (x.t !== "o"){ (arr ? arr : operanter).push(x); continue; }
    const o = x.v, a = operanter; operanter = [];
    const tal = a.filter(v => v.t === "d").map(v => v.v);
    if (o === "q") stak.push(ctm.slice());
    else if (o === "Q") ctm = stak.pop() || I();
    else if (o === "cm" && tal.length === 6) ctm = gang(tal, ctm);
    else if (o === "BT"){ tm = I(); tlm = I(); }
    else if (o === "Tf"){ const nm = a.find(v => v.t === "n"); font = nm ? skrifter.get(nm.v) || null : null; if (tal.length) str_ = tal[tal.length - 1]; }
    else if (o === "Tm" && tal.length === 6){ tm = tal.slice(); tlm = tal.slice(); }
    else if (o === "Td" && tal.length >= 2) flyt(tal[0], tal[1]);
    else if (o === "TD" && tal.length >= 2){ tl = -tal[1]; flyt(tal[0], tal[1]); }
    else if (o === "TL" && tal.length) tl = tal[0];
    else if (o === "Tz" && tal.length) tz = tal[0] / 100;
    else if (o === "T*") flyt(0, -tl);
    else if (o === "Tj"){ const s = a.find(v => v.t === "s"); if (s) vis(s.v); }
    else if (o === "'" || o === '"'){ flyt(0, -tl); const s = a.filter(v => v.t === "s").pop(); if (s) vis(s.v); }
    else if (o === "TJ"){
      const l = a.find(v => v.t === "arr"); if (!l) continue;
      let samlet = "", x0 = null, y0 = null, kerning = 0;
      for (const e of l.v){
        if (e.t === "s"){ const t = afkod(font, e.v); samlet += t; }
        else if (e.t === "d"){ if (e.v < -250 && samlet && !samlet.endsWith(" ")) samlet += " "; }
      }
      if (samlet){ const m = gang(tm, ctm), stoerrelse = Math.abs(str_ * Math.hypot(m[2], m[3]) || str_), op = m[3] >= 0;
        ud.push({ x: m[4], y: op ? m[5] : -m[5], s: stoerrelse, t: samlet, bredde: samlet.length * 0.5 * stoerrelse });
        tm = [tm[0], tm[1], tm[2], tm[3], tm[4] + samlet.length * 0.5 * str_ * tz, tm[5]]; }
    }
  }
  return ud;
}

/** Tekstsegmenter → linjer: samme højde = samme linje, venstre mod højre; et stort hul bliver til en tabulator (kolonner), et lille til et mellemrum. */
function linjerAf(segmenter){
  const ud = [], rest = segmenter.slice().sort((a, b) => b.y - a.y || a.x - b.x);
  let aktuel = null;
  for (const sg of rest){
    if (aktuel && Math.abs(aktuel.y - sg.y) <= Math.max(1, 0.45 * Math.min(aktuel.s, sg.s))) aktuel.dele.push(sg);
    else { aktuel = { y: sg.y, s: sg.s, dele: [sg] }; ud.push(aktuel); }
  }
  return ud.map(l => {
    l.dele.sort((a, b) => a.x - b.x); let t = "";
    l.dele.forEach((d, i) => { if (i){ const p = l.dele[i - 1], hul = d.x - (p.x + p.bredde); t += hul > 2.5 * l.s ? "\t" : (/\s$/.test(p.t) || /^\s/.test(d.t) ? "" : (p.t.length === 1 && d.t.length === 1 && hul < 0.3 * l.s ? "" : " ")); } t += d.t; });
    return t.replace(/[ ]{2,}/g, " ").trim();
  }).filter(Boolean);
}

/** PDF (bytes) → { linjer, sider }. Kaster en fejl med en forklaring, hvis filen ikke er en PDF eller ikke har tekst. */
export async function laesPdf(input){
  const u8 = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (str(u8.subarray(0, 1024)).indexOf("%PDF-") < 0) throw new Error("Filen er ikke en PDF.");
  if (/\/Encrypt\b/.test(str(u8.subarray(Math.max(0, u8.length - 2048))))) throw new Error("PDF'en er krypteret og kan ikke læses her. Markér teksten i PDF'en, kopiér den, og indsæt den i feltet nedenfor.");
  const objs = await objekter(u8), skrifter = new Map(), sideTekst = [];
  const fontCache = new Map();
  const font = async nr => { if (!fontCache.has(nr)){ const o = objs.get(nr); fontCache.set(nr, o ? await skrifttype(o, objs) : null); } return fontCache.get(nr); };
  const sider = [];
  const gaaTræ = (nr, set = new Set()) => {                                  // siderne i rækkefølge via /Kids
    if (set.has(nr) || !objs.get(nr)) return; set.add(nr);
    const d = objs.get(nr).dict, kids = vaerdi(d, "/Kids");
    if (kids && /\/Type\s*\/Pages/.test(d)) for (const k of kids.matchAll(/(\d+)\s+\d+\s+R/g)) gaaTræ(Number(k[1]), set); else if (/\/Type\s*\/Page(?![sA-Za-z])/.test(d)) sider.push(nr);
  };
  for (const [nr, o] of objs) if (/\/Type\s*\/Catalog/.test(o.dict)){ const p = refNr(vaerdi(o.dict, "/Pages")); if (p) gaaTræ(p); }
  if (!sider.length) for (const [nr, o] of objs) if (/\/Type\s*\/Page(?![sA-Za-z])/.test(o.dict)) sider.push(nr);
  const arv = (nr, noegle, dyb = 0) => { const o = objs.get(nr); if (!o || dyb > 8) return null; return vaerdi(o.dict, noegle) ?? arv(refNr(vaerdi(o.dict, "/Parent")), noegle, dyb + 1); };
  const opslag = v => { const r = refNr(v); return r && objs.get(r) ? objs.get(r).dict : v; };
  let alle = [];
  for (const sn of sider){
    const res = opslag(arv(sn, "/Resources")), fonts = res && opslag(vaerdi(res, "/Font")), nm = new Map();
    if (fonts) for (const p of fonts.matchAll(/\/([^\s/<>\[\]()]+)\s+(\d+)\s+\d+\s+R/g)) nm.set(p[1], await font(Number(p[2])));
    const c = vaerdi(objs.get(sn).dict, "/Contents"); let tekst = "";
    for (const r of (c || "").matchAll(/(\d+)\s+\d+\s+R/g)){ const o = objs.get(Number(r[1])); if (o && o.data){ const d = await dekod(o.dict, o.data); if (d) tekst += str(d) + "\n"; } }
    const sg = indhold(tekst, nm); if (sg.length) sideTekst.push(...linjerAf(sg));
  }
  if (!sider.length) throw new Error("Kunne ikke finde nogen sider i PDF'en.");
  if (!sideTekst.length) throw new Error("PDF'en har ingen tekst, der kan læses (den er måske et skannet billede, eller teksten er tegnet som billeder). Markér teksten i PDF'en, hvis det kan lade sig gøre, kopiér den, og indsæt den i feltet nedenfor.");
  return { linjer: sideTekst, sider: sider.length };
}

/* ═══ 2. Tekst → datoer pr. slags affald ═══════════════════════════ */
const MAANED = { jan: 1, januar: 1, feb: 2, februar: 2, mar: 3, marts: 3, apr: 4, april: 4, maj: 5, jun: 6, juni: 6, jul: 7, juli: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, okt: 10, oktober: 10, nov: 11, november: 11, dec: 12, december: 12 };
const MD = "jan(?:uar)?|feb(?:ruar)?|mar(?:ts)?|apr(?:il)?|maj|jun(?:i)?|jul(?:i)?|aug(?:ust)?|sep(?:t(?:ember)?)?|okt(?:ober)?|nov(?:ember)?|dec(?:ember)?";
// Rækkefølgen betyder noget: det mest specifikke først, og det fundne fjernes, så «Papir og pap» ikke også tæller som «Papir» og «Pap».
const FRAK = [
  [/plast\s*(?:og|&)\s*mad-?\s*og\s*drikke-?\s*kartoner?/i, "Plast og mad- og drikkekartoner"], [/mad-?\s*og\s*drikke-?\s*kartoner?|drikkekartoner|\bmdk\b/i, "Mad- og drikkekartoner"], [/farligt\s*affald|miljøkasse|kemikalier/i, "Farligt affald"], [/storskrald/i, "Storskrald"],
  [/haveaffald|have-?\s*og\s*parkaffald|haveskrald/i, "Haveaffald"], [/tekstil\w*/i, "Tekstiler"], [/batteri\w*/i, "Batterier"],
  [/mad-?\s*og\s*restaffald/i, "Mad- og restaffald"], [/madaffald|bioaffald|organisk\w*|køkkenaffald/i, "Madaffald"],
  [/glas\s*(?:og|&)\s*metal/i, "Glas og metal"], [/papir\s*(?:og|&)\s*pap/i, "Papir og pap"],
  [/\bglas\b/i, "Glas"], [/\bmetal\b/i, "Metal"], [/\bpapir\b/i, "Papir"], [/\bpap\b/i, "Pap"], [/plast\w*/i, "Plast"],
  [/restaffald|\brest\b|dagrenovation|småt\s*brændbart|brændbart/i, "Restaffald"],
];
/** Slags affald i en linje: [{ navn, pos }] i den rækkefølge, de står. */
export function findFraktioner(linje){
  let rest = String(linje), ud = [];
  for (const [re, navn] of FRAK){
    const g = new RegExp(re.source, re.flags.replace("g", "") + "g");
    for (const m of rest.matchAll(g)) ud.push({ navn, pos: m.index });
    rest = rest.replace(g, m => " ".repeat(m.length));
  }
  ud.sort((a, b) => a.pos - b.pos);
  const set = new Set(); return ud.filter(f => !set.has(f.navn) && set.add(f.navn));
}
const gyldig = (d, m, y) => { const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`; return d >= 1 && d <= 31 && m >= 1 && m <= 12 && dagNr(iso) !== null ? iso : null; };
const aar2 = y => (y < 100 ? 2000 + y : y);
/** Datoer i en linje: [{ iso, pos, laengde }]. Kender 24.12.2026, 24/12/26, 24-12, 24. dec, 24 december 2026. Månedsnavne alene (uden dag) er ikke datoer. */
export function findDatoer(linje, aar){
  const t = String(linje), ud = [], brugt = [];
  const ledig = (s, l) => !brugt.some(([a, b]) => s < b && s + l > a);
  const tag = (re, fn) => { for (const m of t.matchAll(re)){ const pre = m[1] || "", s = m.index + pre.length, l = m[0].length - pre.length; if (!ledig(s, l)) continue; const iso = fn(m); if (iso){ ud.push({ iso, pos: s, laengde: l }); brugt.push([s, s + l]); } } };
  tag(/(^|[^\d.\/-])(\d{1,2})[./-](\d{1,2})[./-](\d{4}|\d{2})(?![\d])/g, m => gyldig(+m[2], +m[3], aar2(+m[4])));
  tag(new RegExp(`(^|[^\\d])(\\d{1,2})\\.?\\s*(${MD})\\.?(?:\\s*(\\d{4}))?(?![a-zæøå])`, "gi"), m => gyldig(+m[2], MAANED[m[3].toLowerCase()], m[4] ? +m[4] : aar));
  tag(/(^|[^\d.\/-])(\d{1,2})[./](\d{1,2})(?![\d./-])/g, m => gyldig(+m[2], +m[3], aar));
  tag(/(^|[^\d.\/-])(\d{1,2})-(\d{1,2})(?![\d./-])/g, m => gyldig(+m[2], +m[3], aar));
  return ud.sort((a, b) => a.pos - b.pos);
}
/** Det hyppigste årstal i teksten (20xx), ellers det givne eller i år. */
export function findAar(linjer, standard){
  const tael = {}; for (const l of linjer) for (const m of String(l).matchAll(/(?<!\d)(20\d\d)(?!\d)/g)) tael[m[1]] = (tael[m[1]] || 0) + 1;
  const bedst = Object.entries(tael).sort((a, b) => b[1] - a[1])[0];
  return bedst ? Number(bedst[0]) : (standard || new Date().getFullYear());
}
const MAANED_ALENE = new RegExp(`^\\W*(${MD})\\W*(20\\d\\d)?\\W*$`, "i");
const MAANED_LISTE = new RegExp(`^\\W*(${MD})\\W*[:\\-–]?\\s*((?:\\d{1,2}\\s*(?:,|;|og|/|&)?\\s*)+)\\W*$`, "i");
const TAL_LISTE = /^\W*((?:\d{1,2}\s*(?:,|;|og|\/|&)?\s*)+)\W*$/;
const dageAf = t => [...t.matchAll(/\d{1,2}/g)].map(m => +m[0]);

/** Tekstlinjer → { aar, fraktioner: [{ navn, datoer: [ÅÅÅÅ-MM-DD] }], advarsler }.
 *  Genkender kalendere sorteret efter slags affald (overskrift, så datoer), efter dato (dato, så slags affald), på samme linje (6/1 Restaffald, Papir),
 *  og som månedsrækker med en kolonne pr. slags affald. Det er et FORSLAG: man ser og retter det, før det gemmes. */
export function tolkKalender(linjer, { aar } = {}){
  const L = (Array.isArray(linjer) ? linjer : String(linjer ?? "").split(/\r?\n/)).map(x => String(x).replace(/\u00a0/g, " ")).filter(x => x.trim());
  const Å = aar || findAar(L), advarsler = [], ud = new Map();
  const giv = (navn, iso) => { if (!iso) return; const y = +iso.slice(0, 4); if (y < Å - 1 || y > Å + 1) return; if (!ud.has(navn)) ud.set(navn, new Set()); ud.get(navn).add(iso); };
  // 1) hver linje: slags affald og datoer (et månedsnavn alene sætter en måned; tal alene og «Tirs 6» får den)
  let maaned = null, maanedAar = null; const T = [];
  const UGEDAG = /^\W*(?:man|tirs?|ons|tors?|fre|lør|søn)\w*\.?\s+(\d{1,2})\b\.?(?!\d)/i;
  for (const linje of L){
    const F = findFraktioner(linje); let D = findDatoer(linje, Å).map(d => d.iso), kind = null;
    const ma = MAANED_ALENE.exec(linje), ml = !F.length && !D.length ? MAANED_LISTE.exec(linje) : null, tl = !F.length && !D.length && maaned ? TAL_LISTE.exec(linje) : null;
    const ud_ = !D.length && maaned ? UGEDAG.exec(linje) : null;
    if (ma){ maaned = MAANED[ma[1].toLowerCase()]; maanedAar = ma[2] ? +ma[2] : null; kind = "maaned"; }
    else if (ml){ maaned = MAANED[ml[1].toLowerCase()]; D = dageAf(ml[2]).map(d => gyldig(d, maaned, maanedAar || Å)).filter(Boolean); }
    else if (tl){ const dd = dageAf(tl[1]); if (dd.length <= 8) D = dd.map(d => gyldig(d, maaned, maanedAar || Å)).filter(Boolean); }
    else if (ud_){ const iso = gyldig(+ud_[1], maaned, maanedAar || Å); if (iso) D = [iso]; }
    T.push({ linje, F: F.map(f => f.navn), D, kind, start: F.length && F[0].pos <= (/^\W*/.exec(linje)[0].length) });
  }
  const type = x => (x.kind === "maaned" ? "N" : x.F.length && x.D.length ? "FD" : x.F.length ? "F" : x.D.length ? "D" : "N");
  // 2) kolonner: en overskriftslinje med flere slags affald og så månedsrækker med et felt pr. slags affald
  const hoved = T.findIndex(x => x.F.length >= 2 && !x.D.length && /\t|\s{2,}/.test(x.linje));
  let kolonnePar = 0;
  if (hoved >= 0){
    const kolNavne = T[hoved].linje.split(/\t|\s{2,}/).map(c => findFraktioner(c)[0]?.navn || null);
    for (const x of T.slice(hoved + 1)){
      if (!/\t|\s{2,}/.test(x.linje)) continue;
      const celler = x.linje.split(/\t|\s{2,}/).map(c => c.trim()), md = new RegExp(`^(${MD})\\b`, "i").exec(celler[0] || "");
      if (!md) continue;
      const m = MAANED[md[1].toLowerCase()], data = celler.slice(1), off = kolNavne.length === data.length + 1 ? 1 : 0;
      data.forEach((c, i) => { const navn = kolNavne[i + off]; if (navn) for (const d of dageAf(c)){ const iso = gyldig(d, m, Å); if (iso){ giv(navn, iso); kolonnePar++; } } });
      x.brugt = true;
    }
    if (kolonnePar) T[hoved].brugt = true;
  }
  // 3) parring. Både slags affald og dato på linjen: parres. Ellers afgør størrelsen på løbene, om overskriften står først (A: få overskrifter, mange datoer) eller datoen (B: én dato, så en eller flere slags affald).
  const rest = T.filter(x => !x.brugt), t = rest.map(type);
  const loeb = (k, vaegt) => { const r = []; let n = 0; rest.forEach((x, i) => { if (t[i] === k) n += vaegt(x); else if (t[i] !== "N" && n){ r.push(n); n = 0; } }); if (n) r.push(n); return r; };
  const snit = a => (a.length ? a.reduce((p, q) => p + q, 0) / a.length : 0), dLoeb = snit(loeb("D", x => x.D.length)), fLoeb = snit(loeb("F", x => x.F.length));
  const foerste = t.find(k => k !== "N"), modeA = dLoeb > fLoeb || (dLoeb === fLoeb && foerste !== "D");
  let sidsteF = [], sidsteD = [], parret = 0;
  rest.forEach((x, i) => {
    const k = t[i];
    if (k === "FD"){ for (const n of x.F) for (const d of x.D) { giv(n, d); parret++; } if (x.start) sidsteF = x.F; return; }
    if (k === "F"){ if (modeA) sidsteF = x.F; else { for (const n of x.F) for (const d of sidsteD) { giv(n, d); parret++; } } return; }
    if (k === "D"){ if (modeA){ for (const n of sidsteF) for (const d of x.D) { giv(n, d); parret++; } } else sidsteD = x.D; }
  });
  const fraktioner = [...ud].map(([navn, set]) => ({ navn, datoer: [...set].sort() })).sort((a, b) => (FRAKTIONER.findIndex(f => f[0] === a.navn) + 1 || 99) - (FRAKTIONER.findIndex(f => f[0] === b.navn) + 1 || 99));
  if (!T.some(x => x.D.length)) advarsler.push("Jeg fandt ingen datoer i teksten.");
  else if (!fraktioner.length) advarsler.push("Jeg fandt datoer, men kunne ikke se, hvilken slags affald de hører til (jeg leder efter ord som Restaffald, Papir, Plast, Glas, Madaffald).");
  const faa = fraktioner.filter(f => f.datoer.length < 3);
  if (fraktioner.length && faa.length) advarsler.push(`Kun få datoer for ${faa.map(f => f.navn).join(", ")}. Kontrollér dem.`);
  return { aar: Å, fraktioner, advarsler, layout: kolonnePar ? "kolonner" : parret ? (modeA ? "overskrift først" : "dato først") : "ukendt" };
}
