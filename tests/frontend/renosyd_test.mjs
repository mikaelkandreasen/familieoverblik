import fs from "fs";
import * as AFFREAL from "../../public_html/affald.js";
import * as PDFMOD from "../../public_html/pdfaffald.js";
import { bygPdf, simpelSide } from "./pdfbyg_hjaelp.mjs";
const T=[]; const t=(n,ok,x="")=>{T.push(ok);console.log(ok?"ok  ":"FEJL",n,ok?"":x)};
const tick = () => new Promise(r => setImmediate(r));
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
// Datoerne i en Renosyd-tømmekalender (2026 og 2027), hvor affaldet kun vises som symboler: mandag hver 2. uge, onsdag hver 6., fredag hver 3. Ingen navne i teksten.
const MAND = ["2026-11-09","2026-11-23","2026-12-07","2026-12-21","2027-01-04","2027-01-18","2027-02-01","2027-02-15","2027-03-01","2027-03-15","2027-03-29","2027-04-12","2027-04-26","2027-05-10","2027-05-24","2027-06-07","2027-06-21","2027-07-05","2027-07-19","2027-08-02","2027-08-16","2027-08-30","2027-09-13","2027-09-27","2027-10-11","2027-10-25"];
const FRE = ["2026-11-13","2026-12-04","2026-12-25","2027-01-15","2027-02-05","2027-02-26","2027-03-19","2027-04-09","2027-04-30","2027-05-21","2027-06-11","2027-07-02","2027-07-23","2027-08-13","2027-09-03","2027-09-24","2027-10-15"];
const ONS = ["2026-12-09","2027-01-20","2027-03-03","2027-04-14","2027-05-26","2027-07-07","2027-08-18","2027-09-29"];
const ALLE = [...MAND, ...FRE, ...ONS].sort();
const UGEDAG = ["Søndag", "Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag"], MAANEDER = ["JANUAR", "FEBRUAR", "MARTS", "APRIL", "MAJ", "JUNI", "JULI", "AUGUST", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DECEMBER"];
const dagTekst = iso => `${UGEDAG[new Date(iso + "T12:00:00Z").getUTCDay()]} ${+iso.slice(8)}.`;
const adr = "Eksempelvej 1, 8000 Eksempelby";
// side 1 (2026): alle måneder, men kun november og december har datoer, og månedsnavnene har intet år (som i PDF'en)
const side1 = ["Tømmekalender 2026", adr]; MAANEDER.forEach((m, i) => { side1.push(m); for (const d of ALLE.filter(x => x.startsWith("2026-" + String(i + 1).padStart(2, "0")))) side1.push(dagTekst(d)); });
// side 2 (2027): månedsnavn MED år
const side2 = ["Tømmekalender 2027", adr]; MAANEDER.forEach((m, i) => { side2.push(`${m} 2027`); for (const d of ALLE.filter(x => x.startsWith("2027-" + String(i + 1).padStart(2, "0")))) side2.push(dagTekst(d)); });
const R = PDFMOD.tolkKalender([...side1, ...side2]);
const pr = Object.fromEntries(R.fraktioner.map(f => [f.navn, f]));
t("symbol-kalenderen giver tre grupper uden navne, samlet pr. ugedag: Mandag, Onsdag og Fredag (i ugens orden)", R.fraktioner.map(f => f.navn).join() === "Mandag,Onsdag,Fredag" && R.fraktioner.every(f => f.ukendt === true) && R.layout === "uden navne", R.fraktioner.map(f => f.navn));
t("alle datoer er med, og år er rigtige: november og december står i 2026 (månedsnavne uden år får året fra overskriften «Tømmekalender 2026»), resten i 2027", JSON.stringify(pr.Mandag.datoer) === JSON.stringify(MAND) && JSON.stringify(pr.Fredag.datoer) === JSON.stringify(FRE) && JSON.stringify(pr.Onsdag.datoer) === JSON.stringify(ONS), [pr.Mandag?.datoer.length, pr.Fredag?.datoer.length, pr.Onsdag?.datoer.length]);
t("advarslen siger, at kalenderen kun viser symboler, at datoerne er samlet pr. ugedag, og at man selv skriver, hvad det er", R.advarsler.some(a => /symboler eller farver/.test(a) && /pr\. ugedag/.test(a) && /hvilke slags affald/.test(a)), R.advarsler);
const s = Object.fromEntries(R.fraktioner.map(f => [f.navn, AFFREAL.tilSerie(f.datoer)]));
t("tidsplanerne: mandag hver 2. uge fra 9. nov. 2026, fredag hver 3. uge fra 13. nov. 2026, onsdag hver 6. uge fra 9. dec. 2026, uden udgår eller ekstra", s.Mandag.start === "2026-11-09" && s.Mandag.hver === 2 && s.Fredag.start === "2026-11-13" && s.Fredag.hver === 3 && s.Onsdag.start === "2026-12-09" && s.Onsdag.hver === 6 && Object.values(s).every(x => !x.springes.length && !x.ekstra.length && x.regelmaessige === x.ialt), s);
const gen = (x, d) => AFFREAL.naeste({ start: x.start, hver: x.hver, springes: [], ekstra: [] }, d[0], 100, 400).filter(i => i <= d.at(-1));
t("tidsplanerne genskaber PRÆCIS alle 51 datoer i kalenderen (26 mandage, 17 fredage, 8 onsdage), og de fortsætter derefter (næste mandag efter 25. okt. 2027 er 8. nov.)", JSON.stringify(gen(s.Mandag, MAND)) === JSON.stringify(MAND) && JSON.stringify(gen(s.Fredag, FRE)) === JSON.stringify(FRE) && JSON.stringify(gen(s.Onsdag, ONS)) === JSON.stringify(ONS) && AFFREAL.naeste({ start: s.Mandag.start, hver: 2, springes: [], ekstra: [] }, "2027-10-26", 1)[0] === "2027-11-08" && ALLE.length === 51);
const R1 = PDFMOD.tolkKalender(side1);
t("kun 2026-siden: kun november og december, og de er i 2026", R1.fraktioner.every(f => f.datoer.every(d => d.startsWith("2026"))) && R1.fraktioner.map(f => f.datoer.length).join() === "4,1,3", R1.fraktioner.map(f => f.datoer));
t("en kalender MED navne er upåvirket (Restaffald og Papir findes, og ingen er «ukendt»)", (r => r.fraktioner.length === 2 && r.fraktioner.every(f => !f.ukendt))(PDFMOD.tolkKalender(["Tømmekalender 2026", "Restaffald: 6/1, 20/1, 3/2", "Papir: 12/1, 9/2, 9/3"])));
t("kun én dato uden navne er ikke nok til at gætte på grupper: en advarsel, ingen grupper", (r => r.fraktioner.length === 0 && /hvilken slags affald/.test(r.advarsler[0]))(PDFMOD.tolkKalender(["Tømmekalender 2026", "6/1"])));
t("året i en overskrift uden måned gælder kun månedsnavne uden eget år (en dato med eget år beholder det)", (r => r.fraktioner.length === 1 && r.fraktioner[0].datoer.join() === "2026-12-14,2027-01-11")(PDFMOD.tolkKalender(["Tømmekalender 2026", "DECEMBER", "Mandag 14.", "JANUAR 2027", "Mandag 11."])));
// hele vejen fra en rigtig PDF (to sider)
const pdf = bygPdf({ sider: [{ ind: simpelSide(side1) }, { ind: simpelSide(side2) }] });
const { linjer, sider } = await PDFMOD.laesPdf(pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength));
const RP = PDFMOD.tolkKalender(linjer);
t("en rigtig PDF med to sider læses til de samme tre grupper og alle datoer", sider === 2 && RP.fraktioner.length === 3 && JSON.stringify(RP.fraktioner.map(f => f.datoer.length)) === JSON.stringify([26, 8, 17]), [sider, RP.fraktioner.map(f => f.datoer.length)]);
// opsætningssiden
const AFF = { ...AFFREAL, dagIDag: () => "2026-11-11" };
const kode = fs.readFileSync("/tmp/aff_idx_block.js", "utf8").replace('import("./affald.js")', "Promise.resolve(AFFMOD)").replace('import("./pdfaffald.js")', "Promise.resolve(PDFMOD)").replace('import("./vaelgerlister.js")', "Promise.resolve({ rens: () => ({ lister: [], skjulStandard: false }), listeTilTekst: () => '', MAX_LISTER: 30 })");
function byg(){
  const els = {}; const el = id => (els[id] ??= { id, value: "", innerHTML: "", textContent: "", disabled: false, files: null, _h: {}, addEventListener(t, f){ (this._h[t] ??= []).push(f); } });
  const api = new Function("$", "esc", "save", "AFFMOD", "PDFMOD", kode + "; return { affTegn, affSynk, affLaesFil, affBrugForslag, affFraStat, get stat(){ return affStat; }, set stat(v){ affStat = v; }, get forslag(){ return affForslag; }, set affald(v){ affData = v; } };")(el, esc, async () => {}, AFF, PDFMOD);
  return { api, els };
}
const fil = (navn, b) => ({ name: navn, size: b.length, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) });
const U = byg(); await tick(); await tick();
U.api.affald = { adresser: [{ id: "a1", navn: "Hjemme", fraktioner: [] }] }; U.api.affSynk(true);
await U.api.affLaesFil(fil("tomme.pdf", pdf));
const H = U.els.affPdfForslag.innerHTML;
t("forslaget viser de tre grupper med et felt til navnene hver, en liste med kendte navne, og en hjælpetekst om symbolerne", (H.match(/data-post-navne="\d"/g) || []).length === 3 && /<datalist id="affNavneListe">/.test(H) && /<option value="Mad- og restaffald">/.test(H) && /sort pose = restaffald/.test(H) && /Hvilke slags affald hentes mandag\?/.test(H) && /hver 2\. uge/.test(H) && /hver 3\. uge/.test(H) && /hver 6\. uge/.test(H), H.slice(0, 300));
U.els.affPdfForslag._h.click[0]({ target: { closest: s => (s === "#affPdfBrug" ? {} : null) } });
t("uden navne kan de ikke lægges ind: en forklaring nævner alle tre grupper, og intet er lagt ind", /Skriv, hvilke slags affald «Mandag» og «Onsdag» og «Fredag» er/.test(U.els.affPdfFejl.textContent) && U.api.stat.adresser[0].fraktioner.length === 0, U.els.affPdfFejl.textContent);
const skriv = (i, v) => U.els.affPdfForslag._h.input[0]({ target: { dataset: { postNavne: String(i) }, value: v } });
skriv(0, "Mad- og restaffald"); skriv(1, " Papir og pap ; Tekstiler "); skriv(2, "Glas og metal, Plast og mad- og drikkekartoner, glas og metal");
U.els.affPdfForslag._h.click[0]({ target: { closest: s => (s === "#affPdfBrug" ? {} : null) } });
const fr = U.api.stat.adresser[0].fraktioner, af = n => fr.find(f => f.navn === n);
t("med navne lægges de ind: mandag = Mad- og restaffald, onsdag = Papir og pap + Tekstiler, fredag = Glas og metal + Plast og mad- og drikkekartoner (en dublet fjernes), i alt 5 rækker", fr.length === 5 && af("Mad- og restaffald") && af("Papir og pap") && af("Tekstiler") && af("Glas og metal") && af("Plast og mad- og drikkekartoner"), fr.map(f => f.navn));
t("hvert navn får gruppens tidsplan: samme første dato og samme hyppighed", [["Mad- og restaffald", "2026-11-09", 2], ["Papir og pap", "2026-12-09", 6], ["Tekstiler", "2026-12-09", 6], ["Glas og metal", "2026-11-13", 3], ["Plast og mad- og drikkekartoner", "2026-11-13", 3]].every(([n, st, h]) => af(n).start === st && af(n).hver === h && af(n).springes === "" && af(n).ekstra === ""));
const ud = U.api.affFraStat(U.api.stat);
t("det kan gemmes: affFraStat giver ingen fejl, og tidsplanerne giver de rigtige kommende datoer (næste mandag fra 11. nov. er 23. nov.)", ud.fejl.length === 0 && ud.payload.adresser[0].fraktioner.length === 5 && AFFREAL.naeste(ud.payload.adresser[0].fraktioner.find(f => f.navn === "Mad- og restaffald"), "2026-11-11", 2).join() === "2026-11-23,2026-12-07", ud.fejl);
t("beskeden siger, at 5 slags affald er lagt ind", /5 slags affald lagt ind under «Hjemme»/.test(U.els.affPdfInfo.textContent), U.els.affPdfInfo.textContent);
process.exit(T.every(Boolean) ? 0 : 1);
