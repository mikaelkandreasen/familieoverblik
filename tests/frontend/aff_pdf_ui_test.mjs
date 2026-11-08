import fs from "fs";
import * as AFFREAL from "../../public_html/affald.js";
import * as PDFMOD from "../../public_html/pdfaffald.js";
import { bygPdf, simpelSide } from "./pdfbyg_hjaelp.mjs";
const T=[]; const t=(n,ok,x="")=>{T.push(ok);console.log(ok?"ok  ":"FEJL",n,ok?"":x)};
const tick = () => new Promise(r => setImmediate(r));
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const AFF = { ...AFFREAL, dagIDag: () => "2026-11-11" };
const kode = fs.readFileSync("/tmp/aff_idx_block.js", "utf8").replace('import("./affald.js")', "Promise.resolve(AFFMOD)").replace('import("./pdfaffald.js")', "Promise.resolve(PDFMOD)");
function byg(data = { adresser: [{ id: "a1", navn: "Hjemme", fraktioner: [{ navn: "Restaffald", start: "2026-01-05", hver: 4 }] }] }){
  const els = {}; const el = id => (els[id] ??= { id, value: "", innerHTML: "", textContent: "", disabled: false, files: null, _h: {}, addEventListener(t, f){ (this._h[t] ??= []).push(f); } });
  const gemt = []; const save = async (path, payload) => { gemt.push({ path, payload }); };
  const api = new Function("$", "esc", "save", "AFFMOD", "PDFMOD", kode + "; return { affTegn, affSynk, affLaesFil, affLaesTekst, affBrugForslag, affFraStat, get stat(){ return affStat; }, set stat(v){ affStat = v; }, get smudsig(){ return affSmudsig; }, get forslag(){ return affForslag; }, set affald(v){ affald = v; } };")(el, esc, save, AFF, PDFMOD);
  api.affald = data;
  return { api, els, gemt };
}
const kalender = (dele) => { const l = ["Tømmekalender 2026 for Eksempelvej 1"]; for (const [navn, start, uger, spring = []] of dele){ l.push(navn); const ds = []; for (let d = new Date(start + "T12:00:00Z"); d.getUTCFullYear() === 2026; d = new Date(+d + uger * 7 * 864e5)){ const iso = d.toISOString().slice(0, 10); if (!spring.includes(iso)) ds.push(`${d.getUTCDate()}/${d.getUTCMonth() + 1}`); } for (let i = 0; i < ds.length; i += 10) l.push(ds.slice(i, i + 10).join(", ")); } return l; };
const fil = (navn, bytes, size) => ({ name: navn, size: size ?? bytes.length, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) });
const pdf = linjer => bygPdf({ sider: [{ ind: simpelSide(linjer) }] });
let U = byg(); await tick(); await tick();
await U.api.affLaesFil(fil("kalender.pdf", pdf(kalender([["Restaffald", "2026-01-06", 2, ["2026-03-17"]], ["Papir", "2026-01-13", 4], ["Madaffald", "2026-01-07", 1]]))));
const F = U.api.forslag, H = U.els.affPdfForslag.innerHTML;
t("en PDF læses til et forslag: tre slags affald, året 2026, og kilden (filnavn og antal sider) står der", F && F.poster.map(p => p.navn).join() === "Restaffald,Madaffald,Papir" && F.aar === 2026 && /«kalender\.pdf» \(1 side\)/.test(H) && /Fandt 3 slags affald i 2026/.test(H), H.slice(0, 300));
t("hver slags affald vises med sit ikon, antal datoer, første dato, hvor tit, og hvor mange der udgår", (H.match(/class="aff-ikon"/g) || []).length === 3 && /26 datoer|25 datoer/.test(H) && /hver 2\. uge/.test(H) && /1 udgår/.test(H) && /hver 4\. uge/.test(H) && /hver uge/.test(H) && /første tir\. 6\. jan\./.test(H), H.slice(0, 600));
t("tidsplanen for Restaffald: første 6. januar, hver 2. uge, 17. marts udgår (helligdagen mangler i kalenderen)", (p => p.serie.start === "2026-01-06" && p.serie.hver === 2 && p.serie.springes.join() === "2026-03-17" && !p.serie.ekstra.length)(F.poster[0]));
t("alle er valgt fra start, der er en knap til at lægge dem ind, og man kan se, hvad der blev læst", (H.match(/data-post="\d" checked/g) || []).length === 3 && /id="affPdfBrug"/.test(H) && /Det, jeg læste/.test(H) && /Tømmekalender 2026 for Eksempelvej 1/.test(H));
t("intet er gemt endnu (kun et forslag)", U.gemt.length === 0 && U.api.smudsig === false);
// fravælg Papir, læg ind
U.els.affPdfForslag._h.change[0]({ target: { dataset: { post: "2" }, checked: false } });
U.els.affPdfForslag._h.click[0]({ target: { closest: s => (s === "#affPdfBrug" ? {} : null) } });
const a = U.api.stat.adresser[0].fraktioner, rs = a.find(f => f.navn === "Restaffald"), ma = a.find(f => f.navn === "Madaffald");
t("de valgte lægges ind under adressen: Restaffald ERSTATTER den, der stod der (hver 4 → hver 2, ny start), Madaffald kommer til, Papir (fravalgt) kommer ikke", a.length === 2 && rs.start === "2026-01-06" && rs.hver === 2 && ma.hver === 1 && !a.some(f => f.navn === "Papir") && U.api.smudsig === true, JSON.stringify(a));
t("udgår og ekstra skrives som dd.mm.åååå (som felterne forventer), og farven er standardfarven", rs.springes === "17.03.2026" && rs.ekstra === "" && /^#/.test(rs.farve));
t("det, der lægges ind, kan gemmes: affFraStat giver ingen fejl, og datoerne bliver ÅÅÅÅ-MM-DD", (r => r.fejl.length === 0 && r.payload.adresser[0].fraktioner.find(f => f.navn === "Restaffald").springes.join() === "2026-03-17")(U.api.affFraStat(U.api.stat)), JSON.stringify(U.api.affFraStat(U.api.stat).fejl));
t("beskeden siger, hvor mange der blev lagt ind, og at man skal kontrollere dem og trykke Gem", /2 slags affald lagt ind under «Hjemme» \(1 erstattede dem, der stod der\)\. Kontrollér dem i listen herunder, og tryk Gem\./.test(U.els.affPdfInfo.textContent), U.els.affPdfInfo.textContent);
// flere adresser
U = byg({ adresser: [{ id: "a1", navn: "Hjemme", fraktioner: [{ navn: "Restaffald", start: "2026-01-05", hver: 4 }] }, { id: "a2", navn: "Mormor", fraktioner: [{ navn: "Papir", start: "2026-01-05", hver: 4 }] }] }); await tick(); await tick();
await U.api.affLaesTekst(kalender([["Restaffald", "2026-01-06", 2]]).join("\n"));
t("flere adresser: man vælger, hvilken de lægges ind under", /<select class="st-in" id="affPdfAdr">/.test(U.els.affPdfForslag.innerHTML) && /<option value="1">Mormor<\/option>/.test(U.els.affPdfForslag.innerHTML));
U.els.affPdfForslag._h.change[0]({ target: { id: "affPdfAdr", value: "1" } });
U.els.affPdfForslag._h.click[0]({ target: { closest: s => (s === "#affPdfBrug" ? {} : null) } });
t("…og de kommer under den valgte adresse (Mormor), ikke den første", U.api.stat.adresser[1].fraktioner.some(f => f.navn === "Restaffald") && U.api.stat.adresser[0].fraktioner.length === 1 && U.api.stat.adresser[0].fraktioner[0].hver === 4);
// indsat tekst
U = byg(); await tick(); await tick();
await U.api.affLaesTekst("Tømmekalender 2026\nRestaffald\n6/1 20/1 3/2 17/2 3/3\nPapir\n13/1 10/2 10/3");
t("indsat tekst giver også et forslag (kilden er «den indsatte tekst»)", U.api.forslag.poster.length === 2 && /i den indsatte tekst/.test(U.els.affPdfForslag.innerHTML));
await U.api.affLaesTekst("   \n ");
t("tom tekst giver en forklaring og ændrer ikke forslaget", /Indsæt teksten fra PDF'en først/.test(U.els.affPdfFejl.textContent) && U.api.forslag.poster.length === 2);
await U.api.affLaesTekst("Hej\nHer er ingenting");
t("tekst uden datoer: et forslag uden slags affald, en forklaring og det, der blev læst, så man kan se hvorfor", U.api.forslag.poster.length === 0 && /ingen slags affald med datoer/.test(U.els.affPdfFejl.textContent) && /Her er ingenting/.test(U.els.affPdfForslag.innerHTML) && !/id="affPdfBrug"/.test(U.els.affPdfForslag.innerHTML));
// fejl ved filer
await U.api.affLaesFil(fil("x.pdf", new Uint8Array([1, 2, 3])));
t("en fil, der ikke er en PDF, giver en forklarende fejl", /ikke en PDF/.test(U.els.affPdfFejl.textContent) && U.els.affPdfInfo.textContent === "", U.els.affPdfFejl.textContent);
await U.api.affLaesFil(fil("stor.pdf", new Uint8Array(3), 16e6));
t("en fil over 15 MB afvises uden at blive læst", /for stor/.test(U.els.affPdfFejl.textContent));
await U.api.affLaesFil(fil("tom.pdf", bygPdf({ sider: [{ ind: "q Q" }] })));
t("en PDF uden tekst forklarer, at man kan kopiere teksten og indsætte den", /ingen tekst/.test(U.els.affPdfFejl.textContent) && /indsæt/.test(U.els.affPdfFejl.textContent));
await U.api.affLaesFil(null);
t("ingen fil valgt (fortrudt) rydder beskederne og gør ikke noget andet", U.els.affPdfFejl.textContent === "" && U.els.affPdfInfo.textContent === "");
// escape og grænser
await U.api.affLaesFil(fil('<img src=x onerror=alert(1)>.pdf', pdf(kalender([["Restaffald", "2026-01-06", 2]]))));
t("filnavnet i kilden escapes (ingen HTML kommer ind)", !/<img/.test(U.els.affPdfForslag.innerHTML) && /&lt;img/.test(U.els.affPdfForslag.innerHTML));
U = byg({ adresser: [{ id: "a1", navn: "Hjemme", fraktioner: ["Restaffald", "Papir", "Glas", "Metal", "Plast", "Pap", "Tekstiler", "Storskrald", "Haveaffald", "Farligt affald", "Batterier", "Madaffald"].map(n => ({ navn: n, start: "2026-01-05", hver: 4 })) }] }); await tick(); await tick();
await U.api.affLaesTekst("Kalender 2026\nMad- og drikkekartoner\n6/1 20/1 3/2\nGlas\n6/1 20/1 3/2");
U.els.affPdfForslag._h.click[0]({ target: { closest: s => (s === "#affPdfBrug" ? {} : null) } });
t("højst 12 slags affald pr. adresse: en ny uden plads lægges ikke ind, og det siges (mens en eksisterende stadig erstattes)", U.api.stat.adresser[0].fraktioner.length === 12 && /højst være 12 slags affald/.test(U.els.affPdfFejl.textContent) && /Mad- og drikkekartoner/.test(U.els.affPdfFejl.textContent) && U.api.stat.adresser[0].fraktioner.find(f => f.navn === "Glas").hver === 2);
U.els.affPdfForslag._h.change[0]({ target: { dataset: { post: "0" }, checked: false } }); U.els.affPdfForslag._h.change[0]({ target: { dataset: { post: "1" }, checked: false } });
U.els.affPdfForslag._h.click[0]({ target: { closest: s => (s === "#affPdfBrug" ? {} : null) } });
t("intet valgt: en forklaring i stedet for at lægge ingenting ind", /Sæt hak ved mindst én/.test(U.els.affPdfFejl.textContent));
// editoren
U = byg(); await tick(); await tick();
t("rækkerne i editoren har et ikon efter fraktionens navn", /data-ikon>\s*<span class="aff-ikon"[^>]*aria-label="Restaffald"/.test(U.els.affEditor.innerHTML), U.els.affEditor.innerHTML.slice(0, 300));
const idx = fs.readFileSync(import.meta.dirname + "/../../public_html/index.html", "utf8");
t("siden har panelet (details#affPdf) med filvalg (kun PDF), tekstfelt og pladser til beskeder og forslag, og pdfaffald.js hentes først, når man bruger det", /<details class="aff-pdf" id="affPdf">[\s\S]*?<input type="file" id="affPdfFil" accept="\.pdf,application\/pdf">[\s\S]*?id="affPdfTekst"[\s\S]*?id="affPdfFejl"[\s\S]*?id="affPdfForslag"/.test(idx) && idx.includes('import("./pdfaffald.js")') && !/^import .*pdfaffald/m.test(idx));
t("pdfaffald.js indlæses ikke, før den bruges (ingen import ved opstart)", /const affPdfModul = \(\) => \(PDFAFF \? Promise\.resolve\(PDFAFF\) : import\("\.\/pdfaffald\.js"\)/.test(idx));
process.exit(T.every(Boolean) ? 0 : 1);
