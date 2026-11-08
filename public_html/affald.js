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
  ["Glas", "#2E7D4F"], ["Glas og metal", "#2E7D4F"], ["Metal", "#6E7F8D"], ["Plast", "#C9811A"], ["Plast og mad- og drikkekartoner", "#C9811A"],
  ["Farligt affald", "#B3261E"], ["Haveaffald", "#5B8C2A"], ["Storskrald", "#7A3E9D"], ["Tekstiler", "#B0488A"],
];
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

/** Det, der skal mindes om: tømning i dag eller i morgen (så spanden kan sættes ud aftenen før). */
export function paaminde(data, nuIso){
  const ud = [];
  for (const a of oversigt(data, nuIso)) for (const r of a.raekker) if (r.dage <= 1) ud.push({ adresse: a.adresse, fraktion: r.fraktion, farve: r.farve, dage: r.dage, ugedag: r.ugedag });
  return ud;
}
