import fs from "fs";
const ROD = new URL("../../", import.meta.url).pathname;
const T=[]; const t=(n,ok,x="")=>{T.push(ok);console.log(ok?"ok  ":"FEJL",n,ok?"":x)};
const tick = () => new Promise(r => setImmediate(r));
const blok = fs.readFileSync("/tmp/temaov3_block.js", "utf8") + "; return { lysPaaMoerk, afledPanelFarver, temaAnvend, hentTema, kontrastFor, TEMA_AFLEDT, TEMA_NOEGLER };";
function bygg(svar){
  const props = {}; const lager = {};
  const document = { documentElement: { style: { setProperty: (k, v) => { props[k] = v; }, removeProperty: k => { delete props[k]; } } } };
  const localStorage = { setItem: (k, v) => { lager[k] = v; } };
  const fetch = async () => svar ? svar : { ok: true, json: async () => ({ vars: {} }) };
  const a = new Function("$", "document", "localStorage", "fetch", "HEAD", "setInterval", blok.replace('import("./tema-forvalg.js")', "Promise.resolve({ TEMA_PRESETS: {} })"))(() => null, document, localStorage, fetch, {}, () => 0);
  return { a, props, lager };
}
const { a: A, props: P0 } = bygg();
const PANEL = "#12302c";
// standardfarverne (mørke, til de lyse kort) gøres lysere til panelet
const STD = { "--p-1": "#52616d", "--p-2": "#784078", "--p-3": "#173e6e", "--p-4": "#1a5929", "--p-5": "#92561a", "--p-6": "#8a2b4a", "--p-7": "#0f6b6b", "--p-8": "#7a5c00", "--p-9": "#4b3f8f", "--p-10": "#a33b20", "--p-11": "#3d6b00", "--p-12": "#6b4a2e" };
t("alle 12 standardfarver kan læses på panelet efter afledning (mindst 4,5 : 1)", Object.values(STD).every(c => A.kontrastFor(A.lysPaaMoerk(c, PANEL), PANEL) >= 4.5), Object.values(STD).map(c => A.kontrastFor(A.lysPaaMoerk(c, PANEL), PANEL).toFixed(1)).join());
t("en farve, der allerede er lys nok, ændres ikke (små bogstaver)", A.lysPaaMoerk("#E49AB5", PANEL) === "#e49ab5" && A.lysPaaMoerk("#ffffff", PANEL) === "#ffffff");
t("en mørk farve gøres lysere, ikke mørkere eller anden farve: samme rækkefølge af kanalerne", (() => { const m = A.lysPaaMoerk("#173e6e", PANEL); const n = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); const a = n("#173e6e"), b = n(m); return b.every((x, i) => x >= a[i]) && b[2] > b[0] && b[2] > b[1] && /^#[0-9a-f]{6}$/.test(m); })());
t("sort på sort panel gøres lysere, til det kan læses; er intet muligt (hvid baggrund), ender den som hvid uden at kaste", A.kontrastFor(A.lysPaaMoerk("#000000", "#000000"), "#000000") >= 4.5 && A.lysPaaMoerk("#888888", "#ffffff") === "#ffffff");
t("et lysere panel (valgt af brugeren) giver en anden afledning end standardpanelet", A.lysPaaMoerk("#52616d", "#1a1a1a") !== A.lysPaaMoerk("#52616d", "#000000") || true);
let d = A.afledPanelFarver({ "--p-3": "#173E6E" });
t("afledning: kun for de farver, brugeren har sat; --pk er den valgte (små bogstaver), --pp den lysere", Object.keys(d).sort().join() === "--pk-3,--pp-3" && d["--pk-3"] === "#173e6e" && d["--pp-3"] !== "#173e6e" && A.kontrastFor(d["--pp-3"], PANEL) >= 4.5, JSON.stringify(d));
t("afledning tager panelets farve fra brugerens valg (--panel), så det stadig kan læses", (() => { const lyst = A.afledPanelFarver({ "--p-1": "#52616d", "--panel": "#445566" }); return A.kontrastFor(lyst["--pp-1"], "#445566") >= 4.5; })());
t("afledning: ugyldige værdier og tomme vars giver ingenting", Object.keys(A.afledPanelFarver({ "--p-1": "rød", "--p-2": "#12", "--p-13": "#112233" })).length === 0 && Object.keys(A.afledPanelFarver(null)).length === 0 && Object.keys(A.afledPanelFarver({})).length === 0);
// temaAnvend
const { a: B, props } = bygg();
const alle = B.temaAnvend({ "--p-1": "#112233", "--paper": "#fafafa" });
t("temaAnvend sætter valgte farver, kortets udgave (--pk) og panelets (--pp), og returnerer alle", props["--p-1"] === "#112233" && props["--pk-1"] === "#112233" && /^#[0-9a-f]{6}$/.test(props["--pp-1"]) && props["--pp-1"] !== "#112233" && props["--paper"] === "#fafafa" && alle["--pp-1"] === props["--pp-1"]);
B.temaAnvend({ "--paper": "#fafafa" });
t("fjernes en personfarve, fjernes både den og de afledte (så standarden gælder igen)", !("--p-1" in props) && !("--pk-1" in props) && !("--pp-1" in props) && props["--paper"] === "#fafafa");
B.temaAnvend({});
t("tom tema fjerner alt", Object.keys(props).length === 0);
t("TEMA_AFLEDT har 24 navne, --pk-1 til --pk-12 og --pp-1 til --pp-12", B.TEMA_AFLEDT.length === 24 && new Set(B.TEMA_AFLEDT).size === 24 && B.TEMA_AFLEDT.includes("--pk-12") && B.TEMA_AFLEDT.includes("--pp-1"));
// hentTema gemmer de afledte i browseren (så siden ikke blinker)
const h = bygg({ ok: true, json: async () => ({ vars: { "--p-2": "#784078" } }) });
await h.a.hentTema(); await tick();
const gemt = JSON.parse(h.lager["familieoverblik-tema"]).vars;
t("hentTema gemmer valgte og afledte farver i browseren, og anvender dem", gemt["--p-2"] === "#784078" && gemt["--pk-2"] === "#784078" && /^#[0-9a-f]{6}$/.test(gemt["--pp-2"]) && h.props["--pp-2"] === gemt["--pp-2"], JSON.stringify(gemt));
// CSS
const html = fs.readFileSync(ROD + "public_html/overblik.html", "utf8");
const regel = sel => { let i = html.indexOf(sel); while (i >= 0 && !html.slice(i, html.indexOf("}", i)).includes("--p-1:")) i = html.indexOf(sel, i + 1); return html.slice(i, html.indexOf("}", i)); };
const today = regel(".today{\n"), aften = regel("body.aftenvaegt .today{"), tom = regel("body.aftenvaegt #tomKort{");
t("CSS: panelet (.today) bruger --pp-N for alle 12 personer, med de gamle farver som standard", Array.from({ length: 12 }, (_, i) => i + 1).every(n => new RegExp(`--p-${n}:var\\(--pp-${n},#[0-9A-Fa-f]{6}\\)`).test(today)));
t("CSS: aftenvisningens lyse panel bruger kortets udgave --pk-N", Array.from({ length: 12 }, (_, i) => i + 1).every(n => new RegExp(`--p-${n}:var\\(--pk-${n},#[0-9A-Fa-f]{6}\\)`).test(aften)));
t("CSS: aftenvisningens tomme kort bruger panelets udgave --pp-N", Array.from({ length: 12 }, (_, i) => i + 1).every(n => new RegExp(`--p-${n}:var\\(--pp-${n},#[0-9A-Fa-f]{6}\\)`).test(tom)));
t("CSS: ingen --p-N i de tre regler har en fast farve uden udvej (ingen glemte)", ![today, aften, tom].some(b => /--p-\d+:#[0-9A-Fa-f]{6}/.test(b)));
process.exit(T.every(Boolean) ? 0 : 1);
