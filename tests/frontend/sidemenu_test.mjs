import fs from "fs";
const T=[]; const t=(n,ok,x="")=>{T.push(ok);console.log(ok?"ok  ":"FEJL",n,ok?"":x)};
const ROD = import.meta.dirname + "/../../public_html/";
const kilde = fs.readFileSync(ROD + "sidemenu.js", "utf8");
function laes(w){ w.FO_SIDEMENU_STILLE = true; new Function("window", kilde)(w); return w.FO_SIDEMENU; }
// et lille falsk dokument
function dok({ header = true, bar = false } = {}){
  const lyt = {}, alle = [];
  const el = tag => { const e = { tag, children: [], attrs: {}, style: {}, className: "", id: "", hidden: false, tekst: "", href: "", type: "", _lyt: {},
    appendChild(c){ this.children.push(c); c.foraeldre = this; return c; }, setAttribute(k, v){ this.attrs[k] = String(v); }, addEventListener(t, f){ (this._lyt[t] ??= []).push(f); }, focus(){ dok.fokus = this; } };
    alle.push(e); return e; };
  const dok = { createElement: el, createTextNode: tx => ({ tekst: tx }), head: el("head"), documentElement: el("html"), fokus: null, lyt, alle,
    addEventListener(t, f){ (lyt[t] ??= []).push(f); }, getElementById(id){ return alle.find(x => x.id === id && x.foraeldre) || null; },
    querySelector(sel){ return sel === ".bar-r1" ? (bar ? this._bar : null) : sel === "header" ? (header ? this._header : null) : null; } };
  dok._header = el("header"); dok._bar = el("div"); dok._bar.className = "bar-r1";
  return dok;
}
const S = laes({});
const menuLinks = boks => boks.children[1].children.map(a => [a.href, a.children[0].tekst]);
let d = dok(); let boks = S.monter({ d, sti: "/backlog.html" });
t("menuen sættes ind som sidste barn i sidens overskrift: en knap «Sider ▾» og en skjult liste", boks && d._header.children.at(-1) === boks && boks.id === "fo-sider" && boks.children[0].children[0].tekst === "Sider ▾" && boks.children[1].hidden === true && boks.children[1].attrs.role === "menu");
t("listen har otte punkter i den rigtige rækkefølge og med de rigtige adresser (Oversigt, Madplan, Opsætning, Gæste-wifi, Tilfældig vælger, Backlog, Tilføj billeder, Browser-tjek)", JSON.stringify(menuLinks(boks)) === JSON.stringify([["overblik.html", "Oversigt"], ["index.html#mad", "Madplan"], ["index.html#ops", "Opsætning"], ["gaest-wifi.html", "Gæste-wifi (QR-kode)"], ["vaelger.html", "Tilfældig vælger (spinner)"], ["backlog.html", "Backlog (idéer og ønsker)"], ["billeder.html", "Tilføj billeder"], ["browser.html", "Browser-tjek"]]), menuLinks(boks));
t("siden, man står på (backlog.html), er markeret med aria-current=page, og ingen andre", boks.children[1].children.filter(a => a.attrs["aria-current"] === "page").map(a => a.href).join() === "backlog.html");
const aI = S.monter({ d: dok(), sti: "/index.html" }); 
t("på opsætningssiden (index.html, hvor Madplan og Opsætning begge peger) markeres intet, for fanen vises ikke i adressen", aI.children[1].children.every(a => a.attrs["aria-current"] === undefined));
t("filnavnet findes ud af en sti med mappe, anker og søgning, og en tom sti er index.html", S.fil("/a/b/backlog.html#x?y=1") === "backlog.html" && S.fil("") === "index.html" && S.fil("/") === "index.html" && S.fil(null) === "index.html");
const knap = boks.children[0], liste = boks.children[1];
t("knappen har de rigtige aria-egenskaber, og et tryk åbner (aria-expanded=true) og et tryk mere lukker", knap.attrs["aria-haspopup"] === "menu" && knap.attrs["aria-controls"] === "fo-sider-liste" && knap.attrs["aria-expanded"] === "false" && (knap._lyt.click[0](), !liste.hidden && knap.attrs["aria-expanded"] === "true") && (knap._lyt.click[0](), liste.hidden && knap.attrs["aria-expanded"] === "false"));
knap._lyt.click[0]();
d.lyt.click[0]({ target: { closest: () => null } });
t("et klik uden for menuen lukker den (uden at flytte fokus)", liste.hidden && d.fokus === null);
knap._lyt.click[0](); d.lyt.click[0]({ target: { closest: s => (s === "#fo-sider" ? {} : null) } });
t("et klik inde i menuen lukker den ikke (så et link kan nå at åbne)", !liste.hidden);
d.lyt.keydown[0]({ key: "Enter" }); t("andre taster end Escape lukker ikke menuen", !liste.hidden);
d.lyt.keydown[0]({ key: "Escape" });
t("Escape lukker menuen og sætter fokus tilbage på knappen", liste.hidden && d.fokus === knap);
d.lyt.keydown[0]({ key: "Escape" }); t("Escape, når menuen allerede er lukket, gør intet", d.fokus === knap && liste.hidden);
t("menuen sættes kun ind én gang, selv om scriptet kører igen, og stilen også kun én gang", (() => { const x = dok(); S.monter({ d: x, sti: "/a.html" }); const a = S.monter({ d: x, sti: "/a.html" }); return a === null && x._header.children.length === 1 && x.head.children.length === 1; })());
t("stilen indeholder pladsen under knappen (top: 100%), at listen holder sig i skærmen (right: 0), og at den ligger over indholdet (z-index)", /\.fo-sider-liste\{position:absolute;top:calc\(100% \+ 6px\);right:0;z-index:2500/.test(kilde) && /\.fo-sider-liste\[hidden\]\{display:none\}/.test(kilde) && /min-height:44px/.test(kilde));
d = dok({ bar: true }); S.monter({ d, sti: "/index.html" });
t("på opsætningssiden sættes menuen i den øverste række (.bar-r1) og ikke i selve overskriften", d._bar.children.length === 1 && d._header.children.length === 0);
t("en side uden overskrift (fx guiden) får ingen menu og ingen fejl", S.monter({ d: dok({ header: false }), sti: "/start.html" }) === null);
t("uden dokument (ødelagt omgivelse) gives null uden fejl", S.monter({ d: null }) === null);
// selvstart og pagerne
const w2 = { document: dok(), location: { pathname: "/vaelger.html" } }; new Function("window", kilde)(w2);
t("selvstart: scriptet sætter selv menuen ind, når siden indlæser det", w2.document._header.children.length === 1 && w2.document._header.children[0].children[1].children.find(a => a.attrs["aria-current"]).href === "vaelger.html");
const w3 = { document: { querySelector(){ throw new Error("fejl"); }, getElementById(){ return null; } }, location: {} };
t("selvstart i en omgivelse, hvor noget fejler, kaster ingen fejl (en menu må aldrig ødelægge siden)", (() => { try { new Function("window", kilde)(w3); return true; } catch (e) { return false; } })());
const med = ["index", "backlog", "vaelger", "billeder", "gaest-wifi"], uden = ["overblik", "start", "browser"];
const ret = s => fs.readFileSync(ROD + s + ".html", "utf8");
t("de fem sider med overskrift henter menuen lige efter vagten og før deres første modul-script, én gang hver", med.every(s => { const h = ret(s), g = h.indexOf('<script src="gamlebrowser.js"></script>\n<script src="sidemenu.js"></script>'), m = h.indexOf('<script type="module">'); return g > 0 && g < m && h.split("sidemenu.js").length === 2; }), med.filter(s => !ret(s).includes("sidemenu.js")));
t("forsiden (har sin egen menu), guiden (før opsætning) og browser-tjekket får ikke menuen", uden.every(s => !ret(s).includes("sidemenu.js")));
t("alle punkter i menuen peger på filer, der findes", S.PUNKTER.every(([h]) => fs.existsSync(ROD + h.split("#")[0])), S.PUNKTER.filter(([h]) => !fs.existsSync(ROD + h.split("#")[0])));
t("forsidens egen menu har de samme sider (Madplan, Gæste-wifi, Tilfældig vælger, Backlog, Tilføj billeder, Opsætning), så de to ikke driver fra hinanden", (() => { const o = ret("overblik"); return S.PUNKTER.filter(([h]) => h !== "overblik.html" && h !== "browser.html").every(([h]) => o.includes(`href="${h}"`)); })());
const sw = fs.readFileSync(ROD + "sw.js", "utf8"), ht = fs.readFileSync(ROD + "htaccess.txt", "utf8");
t("service workeren har filen i sin skal, med en ny cache-version (v4 eller nyere)", sw.includes('"./sidemenu.js"') && sw.match(/familieoverblik-shell-v([4-9]|\d\d)/) !== null);
const sp = JSON.parse(fs.readFileSync(import.meta.dirname + "/../../sprog/sprog.json", "utf8")).sprog;
t("alle punkter i menuen og knappen har oversættelse til engelsk og tysk (så menuen følger sidens sprog)", S.PUNKTER.map(p => p[1]).concat(["Sider ▾"]).every(x => sp.en.tekster[x] && sp.de.tekster[x]), S.PUNKTER.map(p => p[1]).concat(["Sider ▾"]).filter(x => !sp.en.tekster[x] || !sp.de.tekster[x]));
process.exit(T.every(Boolean) ? 0 : 1);
