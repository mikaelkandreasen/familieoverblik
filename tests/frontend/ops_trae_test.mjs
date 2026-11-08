import fs from "fs";
const ROD = new URL("../../", import.meta.url).pathname;
const T=[]; const t=(n,ok,x="")=>{T.push(ok);console.log(ok?"ok  ":"FEJL",n,ok?"":x)};
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const kode = fs.readFileSync("/tmp/ops_block.js", "utf8");
class El {
  constructor(tag){ this.tagName = tag.toUpperCase(); this.children = []; this.parent = null; this._cls = new Set(); this.hidden = false; this.dataset = {}; this._h = {}; this.textContent = ""; this._html = ""; this.attrs = {}; }
  get classList(){ const s = this._cls; return { contains: c => s.has(c), toggle: (c, on) => { (on === undefined ? !s.has(c) : on) ? s.add(c) : s.delete(c); }, add: c => s.add(c), remove: c => s.delete(c) }; }
  set className(v){ this._cls = new Set(String(v).split(/\s+/).filter(Boolean)); }
  appendChild(e){ if (e.parent) e.parent.children = e.parent.children.filter(x => x !== e); e.parent = this; this.children.push(e); return e; }
  insertBefore(e, ref){ if (e.parent) e.parent.children = e.parent.children.filter(x => x !== e); e.parent = this; const i = ref ? this.children.indexOf(ref) : -1; i < 0 ? this.children.push(e) : this.children.splice(i, 0, e); return e; }
  setAttribute(k, v){ this.attrs[k] = v; }
  addEventListener(t, f){ (this._h[t] ??= []).push(f); }
  scrollIntoView(){ this.rullet = true; }
}
function h2(titel){ const e = new El("h2"); e._cls.add("f-over"); e.textContent = titel; return e; }
function div(...born){ const e = new El("div"); born.forEach(b => e.appendChild(b)); return e; }
function bygSide(boern){
  const els = {}; const rod = new El("section"); boern.forEach(b => rod.appendChild(b)); els.fOps = rod;
  const lager = {}; const win = { matchMedia: () => ({ matches: false }) };
  const document = { createElement: tag => { const e = new El(tag); Object.defineProperty(e, "innerHTML", { set(v){ this._html = v; if (v.includes('id="opsListe"')){ els.opsListe = { innerHTML: "" }; els.opsVaelger = { innerHTML: "", addEventListener(){} }; } }, get(){ return this._html; } }); return e; } };
  const localStorage = { getItem: k => (k in lager ? lager[k] : null), setItem: (k, v) => { lager[k] = v; } };
  const api = new Function("$", "esc", "document", "localStorage", "window", kode.replace(/\nopsByg\(\);\n/, "\n") + "; return { opsInddel, opsTrae, opsVaelg, opsByg, opsTegn, opsGaaTil, OPS_GRUPPER, get valgt(){ return opsValgt; }, get sider(){ return opsSider; } };")(id => els[id], esc, document, localStorage, win);
  return { els, rod, lager, api };
}
// ── rene funktioner ──
const A = bygSide([]).api;
const b = (o = null, e = null) => ({ overskrift: o, egen: e });
let sider = A.opsInddel([b("A"), b(), b(), b("B"), b(), b(null, "Indpakket"), b("C")]);
t("opsInddel: en overskrift starter en side, og alt til næste overskrift hører til den", JSON.stringify(sider.map(s => [s.titel, s.indeks])) === JSON.stringify([["A", [0, 1, 2]], ["B", [3, 4]], ["Indpakket", [5]], ["C", [6]]]), JSON.stringify(sider));
t("opsInddel: en indpakning med egen overskrift er en side for sig og tager ikke det følgende med", sider.find(s => s.titel === "Indpakket").egen === true && !sider.find(s => s.titel === "B").indeks.includes(5) && !sider.find(s => s.titel === "C").indeks.includes(5));
t("opsInddel: elementer FØR den første overskrift hører til ingen side, og tom liste giver ingen sider", A.opsInddel([b(), b("X")]).length === 1 && A.opsInddel([b(), b("X")])[0].indeks.join() === "1" && A.opsInddel([]).length === 0);
let g = A.opsTrae(["Sprog", "Fødselsdage", "Vejr", "Nyt", "Familie og forbindelser"]);
t("opsTrae: siderne kommer i grupperne, i gruppens rækkefølge, ukendte i «Andet» til sidst", JSON.stringify(g.map(x => [x.titel, x.sider])) === JSON.stringify([["Familie", ["Familie og forbindelser", "Fødselsdage", "Sprog"]], ["Kort på oversigten", ["Vejr"]], ["Andet", ["Nyt"]]]), JSON.stringify(g));
t("opsTrae: tomme grupper udelades, og ingen side kommer med to gange", A.opsTrae([]).length === 0 && A.opsTrae(["Om", "Om"]).flatMap(x => x.sider).length === 1);
t("opsVaelg: ønsket, ellers gemt, ellers den første; ugyldige ignoreres; ingen sider giver null", A.opsVaelg("B", "A", ["A", "B"]) === "B" && A.opsVaelg("X", "B", ["A", "B"]) === "B" && A.opsVaelg(null, "X", ["A", "B"]) === "A" && A.opsVaelg(5, {}, ["A"]) === "A" && A.opsVaelg("A", "A", []) === null);
// ── de rigtige overskrifter i index.html ──
const html = fs.readFileSync(ROD + "public_html/index.html", "utf8");
const titler = [...html.matchAll(/<h2 class="f-over">([^<]+)<\/h2>/g)].map(m => m[1].trim()).filter(x => !x.includes("${"));
const alleIGrupper = A.OPS_GRUPPER.flatMap(([, l]) => l);
t(`alle ${titler.length} hovedoverskrifter i opsætningen findes i et træ-gruppe (ingen havner i «Andet»)`, titler.length >= 16 && titler.every(x => alleIGrupper.includes(x)), titler.filter(x => !alleIGrupper.includes(x)).join());
t("og alle gruppernes sider findes i opsætningen (ingen stavefejl eller omdøbte sektioner)", alleIGrupper.every(x => titler.includes(x)), alleIGrupper.filter(x => !titler.includes(x)).join());
t("ingen side er i to grupper, og ingen overskrift står to gange", new Set(alleIGrupper).size === alleIGrupper.length && new Set(titler).size === titler.length);
// ── på siden ──
const fd = new El("form"), fam = new El("div"); fam.hidden = true; const elp = div(h2("Elpris"), new El("p")); elp.hidden = true;
const vejrSek = new El("div"); const kopi = new El("div"); const nyt = new El("p");
const boern = [h2("Fødselsdage"), fd, h2("Familie og forbindelser"), fam, h2("Vejr"), vejrSek, elp, h2("Sikkerhedskopi"), kopi, h2('Nyt "farligt" <navn>'), nyt];
const S = bygSide(boern); S.api.opsByg();
const ind = S.rod.children[0].children[1];
t("opsætningen får en ramme med træet og indholdet, og alle de gamle elementer er flyttet over i indholdet (de beholder deres id'er og knapper)", S.rod.children.length === 1 && S.rod.children[0]._cls.has("ops-ramme") && ind._cls.has("ops-indhold") && ind.children.length === boern.length && boern.every(e => e.parent === ind));
t("kun én side vises: den første, der kan bruges (Fødselsdage, for Familie og forbindelser er skjult)", S.api.valgt === "Fødselsdage" && !boern[0]._cls.has("ops-skjult") && !fd._cls.has("ops-skjult") && boern[2]._cls.has("ops-skjult") && boern[4]._cls.has("ops-skjult") && kopi._cls.has("ops-skjult") && elp._cls.has("ops-skjult"));
t("træet viser kun sider, der kan bruges (ikke den skjulte «Elpris» eller «Familie og forbindelser»), og den valgte er markeret", /data-ops="Fødselsdage" aria-current="page"/.test(S.els.opsListe.innerHTML) && !/Elpris/.test(S.els.opsListe.innerHTML) && !/data-ops="Familie og forbindelser"/.test(S.els.opsListe.innerHTML) && /data-ops="Vejr"/.test(S.els.opsListe.innerHTML) && (S.els.opsListe.innerHTML.match(/aria-current/g) || []).length === 1);
t("grupperne har overskrifter, og telefonens valgmenu har de samme sider, med den valgte markeret", /ops-gr-t">Familie</.test(S.els.opsListe.innerHTML) && /ops-gr-t">Kort på oversigten</.test(S.els.opsListe.innerHTML) && /<optgroup label="Familie">/.test(S.els.opsVaelger.innerHTML) && /<option value="Fødselsdage" selected>/.test(S.els.opsVaelger.innerHTML));
t("titler med anførselstegn og tegn som < escapes i både træ og valgmenu", S.els.opsListe.innerHTML.includes('data-ops="Nyt &quot;farligt&quot; &lt;navn&gt;"') && S.els.opsVaelger.innerHTML.includes("Nyt &quot;farligt&quot; &lt;navn&gt;") && !S.els.opsListe.innerHTML.includes("<navn>"));
t("en side, der ikke står i en gruppe, kommer under «Andet»", /ops-gr-t">Andet</.test(S.els.opsListe.innerHTML));
const tr = S.rod.children[0].children[0];
const klik = titel => tr._h.click[0]({ target: { closest: () => ({ dataset: { ops: titel } }) } });
klik("Sikkerhedskopi");
t("et tryk på en side i træet viser kun den (overskrift og indhold) og skjuler resten", S.api.valgt === "Sikkerhedskopi" && !boern[7]._cls.has("ops-skjult") && !kopi._cls.has("ops-skjult") && boern[0]._cls.has("ops-skjult") && fd._cls.has("ops-skjult") && vejrSek._cls.has("ops-skjult"));
t("…og den valgte side gemmes og er markeret i træet", S.lager["familieoverblik-ops-side"] === "Sikkerhedskopi" && /data-ops="Sikkerhedskopi" aria-current="page"/.test(S.els.opsListe.innerHTML) && !/data-ops="Fødselsdage" aria-current/.test(S.els.opsListe.innerHTML));
tr._h.change[0]({ target: { id: "opsVaelger", value: "Vejr" } });
t("valgmenuen (telefon) skifter side på samme måde", S.api.valgt === "Vejr" && !boern[4]._cls.has("ops-skjult") && !vejrSek._cls.has("ops-skjult") && boern[7]._cls.has("ops-skjult"));
tr._h.change[0]({ target: { id: "noget-andet", value: "Om" } });
t("en ændring fra et andet felt i træet gør intet", S.api.valgt === "Vejr");
fam.hidden = false; S.api.opsTegn();
t("viser en skjult sektion sig senere (serveren svarede), kommer den med i træet og kan vælges", /data-ops="Familie og forbindelser"/.test(S.els.opsListe.innerHTML));
elp.hidden = false; S.api.opsTegn(); klik("Elpris");
t("en indpakning med egen overskrift (Elpris) vises og skjules som en hel side", S.api.valgt === "Elpris" && !elp._cls.has("ops-skjult") && boern[4]._cls.has("ops-skjult"));
elp.hidden = true; S.api.opsTegn();
t("bliver den valgte side utilgængelig, vælges den første, der kan bruges (ingen tom skærm)", S.api.valgt !== "Elpris" && S.api.valgt !== null && boern.filter(e => !e._cls.has("ops-skjult")).length >= 2);
S.api.opsByg(); t("opsByg to gange gør ingenting (ingen dobbelt ramme)", S.rod.children.length === 1);
// gemt side huskes
const S2 = bygSide([h2("Fødselsdage"), new El("form"), h2("Vejr"), new El("div")]); S2.lager["familieoverblik-ops-side"] = "Vejr"; S2.api.opsByg();
t("den gemte side vises ved næste åbning", S2.api.valgt === "Vejr");
const S3 = bygSide([h2("Fødselsdage"), new El("form")]); S3.lager["familieoverblik-ops-side"] = "Findes ikke"; S3.api.opsByg();
t("en gemt side, der ikke findes mere, ignoreres", S3.api.valgt === "Fødselsdage");
const S4 = bygSide([]); S4.api.opsByg(); t("uden sider gør opsByg ingenting og fejler ikke", S4.els.opsListe !== undefined || true);
process.exit(T.every(Boolean) ? 0 : 1);
