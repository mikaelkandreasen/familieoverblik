// Tømningskalender: regler og beregning. Bruges af forsiden (kortet «Tømning») og af opsætningen (forhåndsvisning).
// Ingen netværk og ingen skærm her, kun datoer. Alle datoer er «ÅÅÅÅ-MM-DD» og regnes som hele dage i UTC, så sommertid ikke kan flytte en dato.
//
// Data (settings/affald): { adresser: [ { id, navn, fraktioner: [ { navn, farve, start, hver, springes: [dato], ekstra: [dato] } ] } ] }
//   start    en dato, hvor der er tømning (ligger den i fortiden, regnes der frem)
//   hver     antal uger mellem tømninger (1 til 52)
//   springes datoer, hvor tømningen udgår (fx en helligdag)
//   ekstra   datoer med en ekstra tømning (fx storskrald)

export const FRAKTIONER = [
  ["Restaffald", "#5B6770"], ["Madaffald", "#7A4B2A"], ["Mad- og restaffald", "#6B5B4A"], ["Papir", "#2F6DB5"], ["Papir og pap", "#2F6DB5"], ["Pap", "#3E7CC4"],
  ["Glas", "#2E7D4F"], ["Glas og metal", "#2E7D4F"], ["Metal", "#6E7F8D"], ["Plast", "#C9811A"], ["Plast og mad- og drikkekartoner", "#C9811A"], ["Mad- og drikkekartoner", "#D08F2E"], ["Batterier", "#3D5A80"],
  ["Farligt affald", "#B3261E"], ["Haveaffald", "#5B8C2A"], ["Storskrald", "#7A3E9D"], ["Tekstiler", "#B0488A"],
];
// Ikoner: én tegning pr. slags affald (24×24, streg), så man kan se, hvad der hentes, uden at læse. Fraktionens navn bestemmer ikonet (også et navn, man selv har skrevet).
export const IKONER = {
  rest:   '<path d="M5 7h14M9 7V5h6v2M7 7l1 13h8l1-13M10.5 11v6M13.5 11v6"/>',
  mad:    '<path d="M12 8.5C9.5 6.5 5 8 5 13c0 4 3 8 5.2 8 1 0 1-.6 1.8-.6s.8.6 1.8.6C16 21 19 17 19 13c0-5-4.5-6.5-7-4.5zM12 8.5C12 6 13 4 15.5 3"/>',
  papir:  '<path d="M7 3h7l4 4v14H7zM14 3v4h4M9.5 12h6M9.5 16h6"/>',
  pap:    '<path d="M3 8l9-4 9 4-9 4zM3 8v9l9 4 9-4V8M12 12v9M7.5 6l9 4"/>',
  glas:   '<path d="M9.5 3h5v3l2.5 3v10.5a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 19.5V9l2.5-3zM7 12.5h10"/>',
  metal:  '<path d="M7 5c0-1.1 2.2-2 5-2s5 .9 5 2-2.2 2-5 2-5-.9-5-2zM7 5v14c0 1.1 2.2 2 5 2s5-.9 5-2V5M7 10c0 1.1 2.2 2 5 2s5-.9 5-2"/>',
  plast:  '<path d="M10 3h4v3l2 3v10.5a1.5 1.5 0 0 1-1.5 1.5h-5A1.5 1.5 0 0 1 8 19.5V9l2-3zM8 13h8M11 3v-1M13 3v-1"/>',
  karton: '<path d="M6 8l6-5 6 5v13H6zM6 8h12M10 13h4v4h-4z"/>',
  farlig: '<path d="M12 3l10 18H2zM12 10v5M12 17.8v.4"/>',
  have:   '<path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15M5 19l8-8"/>',
  stor:   '<path d="M5 11V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3M3 13a2 2 0 0 1 4 0v2h10v-2a2 2 0 0 1 4 0v5H3zM6 18v2M18 18v2"/>',
  tekstil:'<path d="M8 3L3 6l2 4 3-1v12h8V9l3 1 2-4-5-3c-1 2-2.5 3-4 3S9 5 8 3z"/>',
  batteri:'<path d="M8 6h8v15H8zM10 3h4v3h-4zM12 10v6M9 13h6"/>',
};
/** Ikonets navn ud fra fraktionens navn (små/store bogstaver er lige gyldige). Ukendte navne får skraldespanden. */
export function ikonFor(navn){
  const n = String(navn ?? "").toLowerCase();
  const har = (...ord) => ord.some(o => n.includes(o));
  if (har("farlig")) return "farlig";
  if (har("batteri")) return "batteri";
  if (har("tekstil")) return "tekstil";
  if (har("storskrald", "stor ")) return "stor";
  if (har("have")) return "have";
  if (har("karton", "drikke")) return "karton";
  if (har("plast")) return "plast";
  if (har("glas")) return "glas";
  if (har("metal")) return "metal";
  if (har("papir")) return "papir";
  if (har("pap")) return "pap";
  if (har("mad", "organisk", "bio", "køkken")) return "mad";
  return "rest";
}
const escHtml = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
/** Ikonet som HTML: en farvet rund flade med tegningen i hvid streg, og navnet som titel og skærmlæsertekst. */
export function ikonHtml(navn, farve){
  const f = /^#[0-9a-fA-F]{6}$/.test(farve || "") ? farve : "#5B6770";
  return `<span class="aff-ikon" style="--f:${f}" role="img" aria-label="${escHtml(navn)}" title="${escHtml(navn)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IKONER[ikonFor(navn)]}</svg></span>`;
}
export const MAX_ADRESSER = 4, MAX_FRAKTIONER = 12, MAX_DATOER = 60, MAX_NAVN = 40;
const UGEDAGE = ["søndag", "mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag"];
const MAANEDER = ["jan.", "feb.", "mar.", "apr.", "maj", "jun.", "jul.", "aug.", "sep.", "okt.", "nov.", "dec."];

/** «2026-11-12» → dagnummer (hele dage siden 1970), eller null hvis det ikke er en rigtig dato. */
export function dagNr(iso){
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(typeof iso === "string" ? iso : "");
  if (!m) return null;
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3]), d = new Date(t);
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] ? Math.floor(t / 864e5) : null;
}
export const isoFraDag = n => new Date(n * 864e5).toISOString().slice(0, 10);
export const ugedag = iso => UGEDAGE[new Date(dagNr(iso) * 864e5).getUTCDay()];
export function datoKort(iso){ const n = dagNr(iso); if (n === null) return String(iso); const d = new Date(n * 864e5); return `${d.getUTCDate()}. ${MAANEDER[d.getUTCMonth()]}`; }
export const dagIDag = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const tekst = (x, maks) => (typeof x === "string" ? x.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maks) : "");
const farveFor = navn => (FRAKTIONER.find(([n]) => n.toLowerCase() === navn.toLowerCase()) || [null, "#5B6770"])[1];
const datoer = x => [...new Set((Array.isArray(x) ? x : []).filter(d => dagNr(d) !== null))].sort().slice(0, MAX_DATOER);

/** Gør data fra serveren (eller formularen) brugbare: kun gyldige felter, med grænser. Aldrig en fejl, hvad end der kommer ind. */
export function rens(x){
  const ud = { adresser: [] };
  for (const a of (x && Array.isArray(x.adresser) ? x.adresser : []).slice(0, MAX_ADRESSER)){
    if (!a || typeof a !== "object") continue;
    const fraktioner = [];
    for (const f of (Array.isArray(a.fraktioner) ? a.fraktioner : []).slice(0, MAX_FRAKTIONER)){
      if (!f || typeof f !== "object") continue;
      const navn = tekst(f.navn, MAX_NAVN), hver = Math.round(Number(f.hver));
      if (!navn || dagNr(f.start) === null || !(hver >= 1 && hver <= 52)) continue;
      fraktioner.push({ navn, farve: /^#[0-9a-fA-F]{6}$/.test(f.farve || "") ? f.farve.toLowerCase() : farveFor(navn).toLowerCase(), start: f.start, hver, springes: datoer(f.springes), ekstra: datoer(f.ekstra) });
    }
    const navn = tekst(a.navn, MAX_NAVN) || "Hjemme";
    if (fraktioner.length) ud.adresser.push({ id: tekst(String(a.id ?? ""), 20) || `a${ud.adresser.length + 1}`, navn, fraktioner });
  }
  return ud;
}

/** De næste tømninger (højst antal) fra og med en dato: de regelmæssige (undtagen dem, der springes over) og de ekstra. */
export function naeste(f, fraIso, antal = 3, maxDage = 400){
  const s = dagNr(f && f.start), fra = dagNr(fraIso), trin = Math.round((f && f.hver) * 7);
  if (s === null || fra === null || !(trin >= 7)) return [];
  const slut = fra + maxDage, spring = new Set((f.springes || []).map(dagNr)), ud = new Set();
  let regel = 0;
  for (let n = fra <= s ? s : s + Math.ceil((fra - s) / trin) * trin; n <= slut && regel < antal; n += trin){
    if (spring.has(n)) continue;
    ud.add(n); regel++;
  }
  for (const e of f.ekstra || []){ const n = dagNr(e); if (n !== null && n >= fra && n <= slut) ud.add(n); }
  return [...ud].sort((a, b) => a - b).slice(0, antal).map(isoFraDag);
}

/** «i dag», «i morgen», «om 5 dage» + ugedag og dato. */
export function beskriv(iso, nuIso){
  const dage = dagNr(iso) - dagNr(nuIso);
  return { dage, relativ: dage === 0 ? "i dag" : dage === 1 ? "i morgen" : `om ${dage} dage`, ugedag: ugedag(iso), dato: datoKort(iso) };
}

/** Til kortet: pr. adresse de fraktioner, der har en kommende tømning, med den nærmeste først. */
export function oversigt(data, nuIso){
  return rens(data).adresser.map(a => ({
    adresse: a.navn, id: a.id,
    raekker: a.fraktioner.map(f => { const n = naeste(f, nuIso, 2); return n.length ? { fraktion: f.navn, farve: f.farve, naeste: n[0], derefter: n[1] || null, ...beskriv(n[0], nuIso) } : null; })
      .filter(Boolean).sort((p, q) => p.dage - q.dage || p.fraktion.localeCompare(q.fraktion, "da")),
  })).filter(a => a.raekker.length);
}

/** Samler de rækker fra oversigt(), der tømmes SAMME dag, til én linje: [{ dato (ÅÅÅÅ-MM-DD), dage, relativ, ugedag, datoKort, fraktioner: [{ fraktion, farve }] }]. Rækkefølgen følger rækkerne (nærmeste først). */
export function gruppeRaekker(raekker){
  const ud = [], pr = new Map();
  for (const r of Array.isArray(raekker) ? raekker : []){
    if (!r || typeof r.naeste !== "string") continue;
    let g = pr.get(r.naeste);
    if (!g){ g = { dato: r.naeste, dage: r.dage, relativ: r.relativ, ugedag: r.ugedag, datoKort: r.dato, fraktioner: [] }; pr.set(r.naeste, g); ud.push(g); }
    g.fraktioner.push({ fraktion: r.fraktion, farve: r.farve });
  }
  return ud;
}

/** Det, der skal mindes om: tømning i dag eller i morgen (så spanden kan sættes ud aftenen før). */
export function paaminde(data, nuIso){
  const ud = [];
  for (const a of oversigt(data, nuIso)) for (const r of a.raekker) if (r.dage <= 1) ud.push({ adresse: a.adresse, fraktion: r.fraktion, farve: r.farve, dage: r.dage, ugedag: r.ugedag });
  return ud;
}

/** Det, der hentes på én bestemt dag (for alle adresser): de regelmæssige tømninger (ikke dem, der udgår) og de ekstra. Til ikonerne på dagene. */
export function paaDag(data, iso){
  const n = dagNr(iso);
  if (n === null) return [];
  const ud = [];
  for (const a of rens(data).adresser) for (const f of a.fraktioner){
    const s = dagNr(f.start), trin = f.hver * 7;
    const regel = n >= s && (n - s) % trin === 0 && !(f.springes || []).some(d => dagNr(d) === n);
    if (regel || (f.ekstra || []).some(d => dagNr(d) === n)) ud.push({ adresse: a.navn, fraktion: f.navn, farve: f.farve });
  }
  return ud;
}

/** Datoer, som de står i en kalender (ÅÅÅÅ-MM-DD), → en tidsplan i modellen: start, hver (uger), springes (udgår) og ekstra.
 *  Der vælges den regelmæssighed, der passer til flest af datoerne: hver 1., 2., 3. … uge, med hver af de første datoer som udgangspunkt.
 *  Dem, der ligger i rækken, men ikke står i kalenderen, bliver «springes» (udgår), og dem, der står i kalenderen, men ikke i rækken, bliver «ekstra». */
export function tilSerie(datoer){
  const d = [...new Set((Array.isArray(datoer) ? datoer : []).map(dagNr).filter(n => n !== null))].sort((a, b) => a - b);
  if (!d.length) return null;
  const sæt = new Set(d), slut = d[d.length - 1];
  if (d.length === 1) return { start: isoFraDag(d[0]), hver: 52, springes: [], ekstra: [], ialt: 1, regelmaessige: 1, afkortet: false };
  let bedst = null;
  for (const hver of [1, 2, 3, 4, 5, 6, 8, 13, 26, 52]){
    const trin = hver * 7;
    for (const anker of d.slice(0, 6)){
      const n0 = anker - Math.floor((anker - d[0]) / trin) * trin;
      let ramt = 0; const mangler = [];
      for (let n = n0; n <= slut; n += trin) (sæt.has(n) ? ramt++ : mangler.push(n));
      const ekstra = d.filter(n => n < n0 || (n - n0) % trin !== 0);
      const score = ramt - mangler.length - 0.7 * ekstra.length;
      if (!bedst || score > bedst.score + 1e-9 || (Math.abs(score - bedst.score) < 1e-9 && hver > bedst.hver)) bedst = { score, hver, n0, mangler, ekstra, ramt };
    }
  }
  const afkortet = bedst.mangler.length > MAX_DATOER || bedst.ekstra.length > MAX_DATOER;
  return { start: isoFraDag(bedst.n0), hver: bedst.hver, springes: bedst.mangler.slice(0, MAX_DATOER).map(isoFraDag), ekstra: bedst.ekstra.slice(0, MAX_DATOER).map(isoFraDag), ialt: d.length, regelmaessige: bedst.ramt, afkortet };
}
