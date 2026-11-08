// Egne lister til den tilfældige vælger (vaelger.html). Gemmes for alle enheder i settings/vaelger og redigeres under Opsætning → Tilfældig vælger.
// Data: { lister: [ { navn, valg: [tekst] } ], skjulStandard: true|false }
export const MAX_LISTER = 30, MAX_VALG = 200, MAX_TEKST = 60, MAX_NAVN = 40;

const ren = (x, maks) => (typeof x === "string" ? [...x.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim()].slice(0, maks).join("") : "");

/** Én linje pr. valg: trimmet, uden tomme, højst MAX_VALG og MAX_TEKST tegn hver. Samme regler som vælgerens eget tekstfelt. */
export function parseListe(tekst){
  return String(tekst || "").split(/\r?\n/).map(l => l.trim()).filter(Boolean).slice(0, MAX_VALG).map(l => [...l].slice(0, MAX_TEKST).join(""));
}
export const listeTilTekst = valg => (Array.isArray(valg) ? valg : []).join("\n");

/** Gør data fra serveren brugbare: kun lister med et navn og mindst ét valg, ingen dubletter af navne (store/små bogstaver), med grænser. Aldrig en fejl. */
export function rens(x){
  const ud = { lister: [], skjulStandard: !!(x && x.skjulStandard === true) }, set = new Set();
  for (const l of (x && Array.isArray(x.lister) ? x.lister : [])){
    if (!l || typeof l !== "object") continue;
    const navn = ren(l.navn, MAX_NAVN), nogle = navn.toLowerCase();
    const valg = (Array.isArray(l.valg) ? l.valg : []).filter(v => typeof v === "string").map(v => ren(v, MAX_TEKST)).filter(Boolean).slice(0, MAX_VALG);
    if (!navn || !valg.length || set.has(nogle)) continue;
    set.add(nogle); ud.lister.push({ navn, valg });
    if (ud.lister.length >= MAX_LISTER) break;
  }
  return ud;
}

/** Sæt en liste ind (en med samme navn erstattes, ellers lægges den til). Returnerer de nye data, eller {fejl}. */
export function medListe(data, navn, valg){
  const d = rens(data), n = ren(navn, MAX_NAVN);
  if (!n) return { fejl: "Skriv et navn til listen." };
  const v = (Array.isArray(valg) ? valg : []).map(x => ren(x, MAX_TEKST)).filter(Boolean).slice(0, MAX_VALG);
  if (!v.length) return { fejl: "Listen er tom. Skriv mindst ét valg." };
  const i = d.lister.findIndex(l => l.navn.toLowerCase() === n.toLowerCase());
  if (i >= 0) d.lister[i] = { navn: n, valg: v };
  else if (d.lister.length >= MAX_LISTER) return { fejl: `Der kan højst være ${MAX_LISTER} lister. Slet en under Opsætning.` };
  else d.lister.push({ navn: n, valg: v });
  return { data: d, erstattet: i >= 0 };
}
