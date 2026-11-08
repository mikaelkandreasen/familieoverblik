import { bygPdf, simpelSide, ftekst, cmap } from "./pdfbyg_hjaelp.mjs";
import * as P from "../../public_html/pdfaffald.js";
const T=[]; const t=(n,ok,x="")=>{T.push(ok);console.log(ok?"ok  ":"FEJL",n,ok?"":x)};
const LIN = ["Tømmekalender 2026", "Restaffald: 6/1, 20/1, 3/2", "Papir og pap: 12. januar, 9. februar", "Søren & Åse bor på Østergade", "Farligt affald (miljøkasse)"];
const læs = async (b) => (await P.laesPdf(b)).linjer;
const lige = (a, b) => JSON.stringify(a) === JSON.stringify(b);
let l = await læs(bygPdf({ sider: [{ ind: simpelSide(LIN) }] }));
t("en almindelig PDF (Helvetica, WinAnsi, Flate): linjerne kommer tilbage i rækkefølge, med æøå og tegnsætning", lige(l, LIN), l);
t("uden pakning (ingen Filter) giver det det samme", lige(await læs(bygPdf({ sider: [{ ind: simpelSide(LIN) }], flate: false, filter: "ingen" })), LIN));
t("med ASCIIHex, og med ASCII85 efterfulgt af Flate (en kæde af filtre)", lige(await læs(bygPdf({ sider: [{ ind: simpelSide(LIN) }], filter: "hex" })), LIN) && lige(await læs(bygPdf({ sider: [{ ind: simpelSide(LIN) }], filter: "a85" })), LIN));
t("sider og skrifttyper pakket i en objektstrøm (PDF 1.5) læses også", lige(await læs(bygPdf({ sider: [{ ind: simpelSide(LIN) }], objstm: true })), LIN), await læs(bygPdf({ sider: [{ ind: simpelSide(LIN) }], objstm: true })));
const tegn = [...new Set(LIN.join(""))].join("");
const cid = { F1: { type: "cid", tegn } }, cm = cmap(tegn).kort;
const hexTekst = s => "<" + [...s].map(c => cm.get(c).toString(16).padStart(4, "0")).join("") + ">";
t("en Type0-skrifttype (Identity-H) med ToUnicode: tekst som to-bytes koder bliver til de rigtige tegn, også æøå", lige(await læs(bygPdf({ sider: [{ ind: simpelSide(LIN, { enc: hexTekst }), skrift: cid }] })), LIN), await læs(bygPdf({ sider: [{ ind: simpelSide(LIN, { enc: hexTekst }), skrift: cid }] })));
// ToUnicode med bfrange: koderne 65.. → A..
const brange = "/CIDInit /ProcSet findresource begin\nbegincmap\n1 begincodespacerange\n<00> <FF>\nendcodespacerange\n1 beginbfrange\n<20> <7E> <0020>\nendbfrange\n2 beginbfchar\n<E6> <00E6>\n<F8> <00F8>\nendbfchar\nendcmap";
const rangeFont = await P.laesPdf(bygPdf({ sider: [{ ind: simpelSide(["Rest Ære: 6/1"], { enc: s => "<" + [...s.replace("Æ", "\xe6")].map(c => c.charCodeAt(0).toString(16).padStart(2, "0")).join("") + ">" }), skrift: { F1: { type: "win" } } }] })).catch(e => e);
t("(kontrol) hex-strenge i en enkeltbytes-skrifttype uden ToUnicode læses som Latin-1", rangeFont.linjer && rangeFont.linjer[0].startsWith("Rest"), rangeFont);
const dif = { F1: { type: "diff", diff: "230 /ae 248 /oslash 229 /aring" } };
t("en skrifttype med egen kodning (Differences: ae, oslash, aring) giver æ, ø og å", lige(await læs(bygPdf({ sider: [{ ind: simpelSide(["bl\xe6\xf8\xe5"], { enc: s => "(" + s.replace("\xe6", "\\346").replace("\xf8", "\\370").replace("\xe5", "\\345") + ")" }), skrift: dif }] })), ["blæøå"]));
// TJ med kerning og store huller
const tj = s => "[" + [...s].map(c => ftekst(c)).join(" -20 ") + "] TJ";
t("en TJ-liste med lille kerning bliver ét ord (ingen mellemrum midt i et ord), og et stort negativt tal bliver et mellemrum", lige(await læs(bygPdf({ sider: [{ ind: "BT /F1 11 Tf 1 0 0 1 50 700 Tm [(Rest) -20 (affald) -400 (6/1)] TJ ET" }] })), ["Restaffald 6/1"]), await læs(bygPdf({ sider: [{ ind: "BT /F1 11 Tf 1 0 0 1 50 700 Tm [(Rest) -20 (affald) -400 (6/1)] TJ ET" }] })));
// Td, TD, T*, ' og "
const rel = "BT /F1 11 Tf 14 TL 50 800 Td (Første) Tj T* (Anden) Tj 0 -14 Td (Tredje) Tj (Fjerde) ' ET";
t("relative flyt (Td, T*, ') giver linjerne i den rigtige rækkefølge", lige(await læs(bygPdf({ sider: [{ ind: rel }] })), ["Første", "Anden", "Tredje", "Fjerde"]), await læs(bygPdf({ sider: [{ ind: rel }] })));
// kolonner: store huller i x giver en tabulator, og samme højde = samme linje
const kol = simpelSide([[[50, "Januar"], [200, "6"], [320, "13"], [440, "20"]], [[50, "Februar"], [200, "3"], [320, "10"]]]);
l = await læs(bygPdf({ sider: [{ ind: kol }] }));
t("tekst på samme højde bliver én linje (venstre mod højre), og store huller bliver tabulatorer (til kolonner)", lige(l, ["Januar\t6\t13\t20", "Februar\t3\t10"]), l);
// spejlede koordinater (browserens «Gem som PDF» bruger cm med negativ d, og et Tm der spejler igen)
const flip = "q 1 0 0 -1 0 842 cm\nBT /F1 11 Tf 1 0 0 -1 50 40 Tm (Øverst) Tj ET\nBT /F1 11 Tf 1 0 0 -1 50 60 Tm (Midten) Tj ET\nBT /F1 11 Tf 1 0 0 -1 50 80 Tm (Nederst) Tj ET\nQ";
t("spejlede koordinater (cm med negativ d): rækkefølgen er stadig oppefra og ned", lige(await læs(bygPdf({ sider: [{ ind: flip }] })), ["Øverst", "Midten", "Nederst"]), await læs(bygPdf({ sider: [{ ind: flip }] })));
const flipPaaTm = "BT /F1 11 Tf 1 0 0 -1 50 100 Tm (Nederst) Tj 1 0 0 -1 50 40 Tm (Øverst) Tj ET";
t("det samme, når kun tekstmatricen spejler", lige(await læs(bygPdf({ sider: [{ ind: flipPaaTm }] })), ["Øverst", "Nederst"]), await læs(bygPdf({ sider: [{ ind: flipPaaTm }] })));
// flere sider
const s1 = simpelSide(["Side et"]), s2 = simpelSide(["Side to"]), s3 = simpelSide(["Side tre"]);
t("flere sider læses i sidernes rækkefølge", lige(await læs(bygPdf({ sider: [{ ind: s1 }, { ind: s2 }, { ind: s3 }] })), ["Side et", "Side to", "Side tre"]));
const cm2 = cmap("æ").kort;
t("hver side har sin egen skrifttype under samme navn (F1 betyder noget forskelligt på side 1 og 2)", lige(await læs(bygPdf({ sider: [{ ind: simpelSide(["Rest"]) }, { ind: simpelSide(["æ"], { enc: s => "<" + [...s].map(c => cm2.get(c).toString(16).padStart(4, "0")).join("") + ">" }), skrift: { F1: { type: "cid", tegn: "æ" } } }] })), ["Rest", "æ"]));
// escapes
t("escapes i strenge: \\( \\) \\\\ og oktale koder, og en linjeskiftsfortsættelse", lige(await læs(bygPdf({ sider: [{ ind: "BT /F1 11 Tf 1 0 0 1 50 700 Tm (a\\(b\\)c\\\\d \\346 x\\\ny) Tj ET" }] })), ["a(b)c\\d æ xy"]), await læs(bygPdf({ sider: [{ ind: "BT /F1 11 Tf 1 0 0 1 50 700 Tm (a\\(b\\)c\\\\d \\346 x\\\ny) Tj ET" }] })));
t("indlejrede parenteser i en streng ((a(b)c)) holdes sammen", lige(await læs(bygPdf({ sider: [{ ind: "BT /F1 11 Tf 1 0 0 1 50 700 Tm (a(b)c) Tj ET" }] })), ["a(b)c"]));
// fejl
const f1 = await P.laesPdf(new Uint8Array([1, 2, 3, 4])).catch(e => e.message), f2 = await P.laesPdf(bygPdf({ sider: [{ ind: "q 1 0 0 1 0 0 cm Q" }] })).catch(e => e.message), f3 = await P.laesPdf(bygPdf({ sider: [{ ind: simpelSide(["x"]) }], krypteret: true })).catch(e => e.message);
t("en fil, der ikke er en PDF, får en forklarende fejl", /ikke en PDF/.test(f1), f1);
t("en PDF uden tekst (kun billeder) får en fejl, der siger, hvad man kan gøre (kopiér teksten og indsæt den)", /ingen tekst/.test(f2) && /indsæt/.test(f2), f2);
t("en krypteret PDF får en fejl, der siger det", /krypteret/.test(f3), f3);
// ødelagt indhold giver ikke en uendelig løkke eller et nedbrud
const stump = bygPdf({ sider: [{ ind: simpelSide(LIN) }] }).slice(0, 400);
const f4 = await P.laesPdf(stump).catch(e => e.message);
t("en afkortet PDF giver en fejl og ikke et nedbrud", typeof f4 === "string", f4);
// fra PDF til datoer
const kal = [];
for (const [navn, start, uger] of [["Restaffald", "2026-01-06", 2], ["Papir", "2026-01-13", 4], ["Madaffald", "2026-01-07", 1]]){
  kal.push(navn); const ds = []; for (let d = new Date(start + "T12:00:00Z"); d.getUTCFullYear() === 2026; d = new Date(+d + uger * 7 * 864e5)) ds.push(`${d.getUTCDate()}/${d.getUTCMonth() + 1}`);
  for (let i = 0; i < ds.length; i += 10) kal.push(ds.slice(i, i + 10).join(", "));
}
const pdfKal = bygPdf({ sider: [{ ind: simpelSide(["Tømmekalender 2026 for Eksempelvej 1", ...kal]) }] });
const { linjer } = await P.laesPdf(pdfKal), tk = P.tolkKalender(linjer);
const RS = tk.fraktioner.find(f => f.navn === "Restaffald"), PP = tk.fraktioner.find(f => f.navn === "Papir"), MA = tk.fraktioner.find(f => f.navn === "Madaffald");
t("PDF → tekst → datoer: tre slags affald med 26, 13 og 52 datoer i 2026, og året 2026 fundet i overskriften", tk.aar === 2026 && RS.datoer.length === 26 && PP.datoer.length === 13 && MA.datoer.length === 52 && tk.layout === "overskrift først", [tk.aar, tk.fraktioner.map(f => f.navn + f.datoer.length), tk.layout]);
const AFF = await import("../../public_html/affald.js"), serie = AFF.tilSerie(RS.datoer);
t("…og datoerne bliver til en tidsplan: Restaffald første gang 6. januar, hver 2. uge, uden undtagelser", serie.start === "2026-01-06" && serie.hver === 2 && !serie.springes.length && !serie.ekstra.length, serie);
process.exit(T.every(Boolean) ? 0 : 1);
