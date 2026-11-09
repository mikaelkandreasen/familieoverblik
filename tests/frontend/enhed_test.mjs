import fs from "fs";
const T=[]; const t=(n,ok,x="")=>{T.push(ok);console.log(ok?"ok  ":"FEJL",n,ok?"":x)};
const ROD = import.meta.dirname + "/../../public_html/";
const K = new Function(fs.readFileSync("/tmp/enhed_block.js", "utf8") + "; return { enhedInit, ENHED_FS_NOEGLE, enhedFuldLaes, enhedFuldSkriv };")();
function bygDom(){ const lyt = {}, felt = { checked: false, disabled: false, addEventListener(t, f){ (lyt[t] ??= []).push(f); } }, note = { textContent: "" }; return { felt, note, lyt, $: id => (id === "enhedFuld" ? felt : note) }; }
let D = bygDom(), lager = "1";
const api = K.enhedInit({ $: D.$, laes: () => lager === "1", skriv: til => { lager = til ? "1" : "0"; return true; }, mulig: () => true });
t("er automatisk fuld skærm slået til på enheden (nøglen er «1»), er feltet afkrydset, og forklaringen siger, at første tryk går i fuld skærm", D.felt.checked === true && D.felt.disabled === false && /første tryk et vilkårligt sted på forsiden går i fuld skærm/.test(D.note.textContent), D.note.textContent);
D.felt.checked = false; D.lyt.change[0]();
t("fjernes hakket, gemmes «0», og forklaringen siger, at kun knappen går i fuld skærm", lager === "0" && /kun i fuld skærm, når du trykker på knappen/.test(D.note.textContent));
D.felt.checked = true; D.lyt.change[0]();
t("sættes hakket, gemmes «1»", lager === "1" && D.felt.checked === true);
D = bygDom(); lager = "0";
K.enhedInit({ $: D.$, laes: () => lager === "1", skriv: til => { lager = til ? "1" : "0"; return true; }, mulig: () => true });
t("er det slået fra (eller aldrig sat), er feltet tomt og klar til at blive krydset af", D.felt.checked === false && D.felt.disabled === false);
D = bygDom();
K.enhedInit({ $: D.$, laes: () => true, skriv: () => true, mulig: () => false });
t("kan browseren ikke gå i fuld skærm (iPhone), er feltet slået fra, og forklaringen peger på hjemmeskærmen", D.felt.disabled === true && /iPhone/.test(D.note.textContent) && /hjemmeskærmen/.test(D.note.textContent));
D = bygDom();
K.enhedInit({ $: D.$, laes: () => false, skriv: () => false, mulig: () => true });
D.felt.checked = true; D.lyt.change[0]();
t("kan valget ikke gemmes (privat fane), rulles hakket tilbage, og der står en forklaring", D.felt.checked === false && /kunne ikke gemmes/.test(D.note.textContent));
// den rigtige lagring
const lag = {}; globalThis.localStorage = { getItem: k => (k in lag ? lag[k] : null), setItem: (k, v) => { lag[k] = String(v); }, removeItem: k => { delete lag[k]; } };
t("læs og skriv bruger nøglen «familieoverblik-fuldskaerm» med «1» og «0» og læser det samme tilbage", K.ENHED_FS_NOEGLE === "familieoverblik-fuldskaerm" && K.enhedFuldLaes() === false && K.enhedFuldSkriv(true) === true && lag["familieoverblik-fuldskaerm"] === "1" && K.enhedFuldLaes() === true && K.enhedFuldSkriv(false) === true && lag["familieoverblik-fuldskaerm"] === "0" && K.enhedFuldLaes() === false);
globalThis.localStorage = { getItem(){ throw new Error("blokeret"); }, setItem(){ throw new Error("blokeret"); } };
t("blokeret lager (privat fane, fejl) giver «slået fra» og «kunne ikke gemme» uden at kaste en fejl", K.enhedFuldLaes() === false && K.enhedFuldSkriv(true) === false);
delete globalThis.localStorage;
// siderne
const ix = fs.readFileSync(ROD + "index.html", "utf8"), ov = fs.readFileSync(ROD + "overblik.html", "utf8");
t("nøglen er den samme på opsætningssiden og på forsiden (ellers virker valget ikke)", /const FS_NOEGLE = "familieoverblik-fuldskaerm";/.test(ov) && /const ENHED_FS_NOEGLE = "familieoverblik-fuldskaerm";/.test(ix));
t("forsiden bruger valget: står nøglen på «1», lytter den efter første tryk og går i fuld skærm (den eksisterende «igen»-lytter), også uden at knappen har været brugt", ov.includes("if (fsMulig() && !fsElement() && fsHuskes()){") && ov.includes('document.addEventListener("pointerdown", igen, true);') && ov.includes("const fsHuskes = () =>"));
t("siden «Denne enhed» findes med afkrydsningsfeltet og en forklaring, og den står i gruppen «System» (før «Login og sikkerhed»)", /<h2 class="f-over">Denne enhed<\/h2>[\s\S]*?<input type="checkbox" id="enhedFuld"> Gå automatisk i fuld skærm på forsiden[\s\S]*?id="enhedFuldNote"/.test(ix) && ix.includes('["System", ["Denne enhed", "Login og sikkerhed", "Sikkerhedskopi", "Om"]]'));
t("opsætningen starter funktionen (enhedInit kaldes med lagrings- og browserfunktionerne)", ix.includes("enhedInit({ $, laes: enhedFuldLaes, skriv: enhedFuldSkriv, mulig: enhedFuldMulig });"));
t("siden forklarer, at valget kun gælder enheden, og at det gemmes i browseren og ikke på serveren", /gemmes i browseren og ikke på serveren, så hver enhed har sit eget valg/.test(ix));
process.exit(T.every(Boolean) ? 0 : 1);
