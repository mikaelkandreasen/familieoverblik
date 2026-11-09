import fs from "fs";
const T=[]; const t=(n,ok,x="")=>{T.push(ok);console.log(ok?"ok  ":"FEJL",n,ok?"":x)};
const ROD = import.meta.dirname + "/../../public_html/";
const ov = fs.readFileSync(ROD + "overblik.html", "utf8");
const main = ov.slice(ov.indexOf('<main class="grid" id="app"'), ov.indexOf("</main>"));
const stakStart = main.indexOf('<div class="stack" id="stak">'), idag = main.indexOf('<section class="today" id="idagKort">');
// stakkens slutning: find den </div>, der lukker #stak (tæl div'er)
let dyb = 0, stakSlut = -1;
for (const m of main.slice(stakStart).matchAll(/<(\/?)div\b[^>]*>/g)){ dyb += m[1] ? -1 : 1; if (dyb === 0){ stakSlut = stakStart + m.index; break; } }
const stak = main.slice(stakStart, stakSlut);
t("«I dag» ligger INDE i kolonnebeholderen (#stak) som første barn (efter kommentarer), så den og de smalle kort deler kolonner", stakStart >= 0 && idag > stakStart && idag < stakSlut && /<div class="stack" id="stak">\s*(<!--[\s\S]*?-->\s*)*<section class="today" id="idagKort">/.test(stak));
t("alle de smalle kort (data-kort) ligger efter «I dag» i samme beholder, og de brede kort og halv-rækkerne ligger udenfor, efter den", ["tom", "vigtigt", "todo", "indkob", "elpris", "traening", "bil", "affald", "onsker", "kantine"].every(k => { const i = main.indexOf(`data-kort="${k}"`); return i > idag && i < stakSlut; }) && ["vejr", "dage5", "svar", "lektier", "ugebrev", "tegneserie", "joke"].every(k => main.indexOf(`data-kort="${k}"`) > stakSlut));
t("HTML'en er i balance: lige mange åbne og lukkede section og div i hovedområdet", ["section", "div"].every(tag => (main.match(new RegExp(`<${tag}\\b`, "g")) || []).length === (main.match(new RegExp(`</${tag}>`, "g")) || []).length));
const css = ov.slice(0, ov.indexOf("</style>"));
const blok = /@media \(min-width:901px\)\{([\s\S]*?)\n\}/.exec(css.slice(css.indexOf("── Tæt pakning")));
t("på en bred skærm (≥ 901 px) er kolonnebeholderen to CSS-kolonner med samme mellemrum som resten (--gap), og negativ margin fjerner det sidste kort afstand", !!blok && /\.stack\{display:block;column-count:2;column-gap:var\(--gap\);margin-bottom:calc\(-1 \* var\(--gap\)\)\}/.test(blok[1]));
t("hvert kort (og «I dag») deles aldrig mellem to kolonner (break-inside:avoid) og har afstanden under sig (--gap): samme afstand overalt", !!blok && /\.stack>\.card,\.stack>\.today\{break-inside:avoid;margin-bottom:var\(--gap\)\}/.test(blok[1]));
t("halv-rækkerne er også to kolonner, så to halve kort af forskellig højde ikke efterlader et hul under det korte, og de har samme afstand og negativ margin", !!blok && /\.halv-raekke\{display:block;column-count:2;column-gap:var\(--gap\);margin-bottom:calc\(-1 \* var\(--gap\)\)\}/.test(blok[1]) && /\.halv-raekke>\.card\{break-inside:avoid;margin-bottom:var\(--gap\)\}/.test(blok[1]));
t("på en smal skærm (telefon) er alt som før: kolonnebeholderen er en lodret kolonne med --gap, og halv-rækkerne er én kolonne (reglerne for kolonner står kun i media ≥ 901 px)", /\.stack\{display:flex;flex-direction:column;gap:var\(--gap\);min-width:0;grid-column:1\/-1\}/.test(css) && /@media \(max-width:900px\)\{\.halv-raekke\{grid-template-columns:1fr\}\}/.test(css) && (css.match(/column-count:2/g) || []).length === 2);
t("kortene har ingen egen margen eller afstand, der ville give ulige afstande (.card har kun polstring), og ingen anden regel sætter margin på kort i kolonnerne", /\.card\{background:var\(--card\);border:1px solid var\(--rule\);border-radius:var\(--radius\);\s*padding:14px 16px 15px;min-width:0\}/.test(css) && !/\.stack\s*>?\s*\.card\{[^}]*margin-top/.test(css));
t("de brede kort er stadig hele rækken (grid-column 1 / -1), så en række af dem begynder under den højeste kolonne", /\.wide\{grid-column:1\/-1\}/.test(css));
t("layoutkoden lægger smalle kort bagest i #stak (appendChild), så «I dag» bliver stående forrest, og den læser kun børn med data-kort (I dag har ingen)", ov.includes('$("stak").appendChild(per[id]);') && ov.includes("const ids = c => [...c.children].filter(e => e.dataset && e.dataset.kort)"));
t("«Tilpas layout» forklarer ikke længere to forskellige kolonner: kortene i kolonnen hedder stadig «Smal», men de fylder nu begge kolonner (rækkefølgen er ned ad første kolonne, så ned ad anden)", /Rækkefølgen er derfor ned ad første kolonne, så ned ad anden/.test(css));
process.exit(T.every(Boolean) ? 0 : 1);
