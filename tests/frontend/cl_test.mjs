import fs from "fs";
const ROD = new URL("../../", import.meta.url).pathname;
const T=[]; const t=(n,ok,x="")=>{T.push(ok);console.log(ok?"ok  ":"FEJL",n,ok?"":x)};
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const tick = () => new Promise(r => setImmediate(r));
const mk = () => { const els = {}; const el = id => (els[id] ??= { id, innerHTML:"", value:"", hidden:false, opened:false, handlers:{}, addEventListener(t,f){ (this.handlers[t] ??= []).push(f); }, showModal(){ this.opened = true; }, close(){ this.opened = false; } }); return { els, el }; };
const md = fs.readFileSync(ROD + "CHANGELOG.md", "utf8");
const kode = fs.readFileSync("/tmp/clov_block.js", "utf8") + "; return { clParse, clVis, clInline, clAabn, clTegn, setInst(v){ clInstalleret = v; }, get sek(){ return clSektioner; } };";

{ // ren parsing af den rigtige fil
  const { el } = mk();
  const a = new Function("$","esc","HEAD", kode)(el, esc, {});
  const s = a.clParse(md);
  const antal = (md.match(/^## \[/gm) || []).length;
  t("alle udgaver i CHANGELOG.md findes", s.length === antal && antal >= 10, `${s.length} af ${antal}`);
  t("nyeste først og versionerne er semver", /^\d+\.\d+\.\d+$/.test(s[0].version) && s.every(x => /^\d+\.\d+\.\d+$/.test(x.version)) && s.at(-1).version === "1.0.0", s.map(x => x.version).join());
  t("dato læses efter tankestreg", /^\d{4}-\d{2}-\d{2}$/.test(s[0].dato) || /november 2026/.test(s[0].dato), s[0].dato);
  const v2 = s.find(x => x.version === "2.0.0");
  t("2.0.0 har Tilføjet, Ændret og Rettet", ["Tilføjet","Ændret","Rettet"].every(tt => v2.blokke.some(b => b.titel === tt)), v2.blokke.map(b => b.titel).join());
  const tilf = v2.blokke.find(b => b.titel === "Tilføjet");
  t("punkter med fortsættelseslinjer er slået sammen til ét punkt", tilf.punkter.some(p => /Dockhand-version/.test(p) && /hjaelp\.sh/.test(p)) && tilf.punkter.every(p => !/^\s/.test(p)), tilf.punkter[0].slice(0, 120));
  t("nummereret liste (Opdatering fra …) giver punkter", v2.blokke.find(b => /^Opdatering fra/.test(b.titel)).punkter.length >= 3);
  t("kun overskrifter og punkter bliver til tekst: ingen rå markdown-tegn i punkterne", s.every(x => x.blokke.every(b => b.punkter.every(p => !/^#+ /.test(p)))));
}
{ // visning
  const { el } = mk();
  const a = new Function("$","esc","HEAD", kode)(el, esc, {});
  t("inline: kode og fed, og HTML i teksten escapes først", a.clInline("brug `a<b` og **fed** <img onerror=1>") === "brug <code>a&lt;b</code> og <b>fed</b> &lt;img onerror=1&gt;", a.clInline("brug `a<b` og **fed** <img onerror=1>"));
  const h = a.clVis({ version:"9.9.9", dato:"2026-01-01", blokke:[{ titel:"Rettet", punkter:["Én **rettelse** i `x.php`"], tekst:["Intro"] }] });
  t("visning: dato, overskrift, tekst og punkt", /Udgivet 2026-01-01/.test(h) && /<h3>Rettet<\/h3>/.test(h) && /<p>Intro<\/p>/.test(h) && /<li>Én <b>rettelse<\/b> i <code>x\.php<\/code><\/li>/.test(h), h);
  t("tom sektion giver en besked", /Ingen ændringer/.test(a.clVis(null)));
}
{ // dialogen
  const { el } = mk(); let kald = 0, svar = null;
  globalThis.fetch = async (url, opt) => { kald++; if (svar) return svar; return { ok:true, status:200, json: async () => ({ markdown: md }) }; };
  const a = new Function("$","esc","HEAD", kode)(el, esc, { "X-Ugeplan-Key": "k" });
  a.setInst("2.0.0");
  await a.clAabn(); await tick();
  t("dialogen åbnes og viser ændringsloggen", el("clDlg").opened === true && /<h3>/.test(el("clKrop").innerHTML) && kald === 1);
  t("versionsvalget (dropdown) har alle udgaver, og den installerede er valgt og markeret", el("clValg").hidden === false && (el("clValg").innerHTML.match(/<option/g) || []).length === a.sek.length && /<option value="2\.0\.0" selected>2\.0\.0 \([^)]*\) · installeret<\/option>/.test(el("clValg").innerHTML), el("clValg").innerHTML.slice(0, 300));
  t("den installerede version vises først (2.0.0)", /Udgivet 2026-11-06/.test(el("clKrop").innerHTML) && /Dockhand-version/.test(el("clKrop").innerHTML));
  await el("clValg").handlers.change[0]({ target:{ value:"1.8.0" } });
  t("valg af en anden version viser den", /Kortet <b>Bil<\/b>|Kortet \*\*Bil\*\*|Bil<\/b>/.test(el("clKrop").innerHTML) || /Hyundai/.test(el("clKrop").innerHTML), el("clKrop").innerHTML.slice(0, 200));
  el("clDlg").opened = false; await el("clKnap").handlers.click[0]({}); await tick();
  t("åbnes den igen, hentes der ikke igen", kald === 1 && el("clDlg").opened === true);
  el("clLuk").handlers.click[0]({});
  t("kryds lukker", el("clDlg").opened === false);
}
{ // fejl
  const mk2 = async (svar, inst = "") => { const { el } = mk(); globalThis.fetch = async () => svar; const a = new Function("$","esc","HEAD", kode)(el, esc, {}); a.setInst(inst); await a.clAabn(); await tick(); return el; };
  let el = await mk2({ ok:false, status:404, json: async () => ({}) });
  t("404 forklares", /info\.php findes ikke på serveren endnu/.test(el("clKrop").innerHTML) && el("clDlg").opened === true);
  el = await mk2({ ok:false, status:404, json: async () => ({ error:"CHANGELOG.md findes ikke her. Kør ./lokal/opdater.sh for at få den med." }) });
  t("serverens fejltekst vises", /Kør .\/lokal\/opdater\.sh/.test(el("clKrop").innerHTML));
  el = await mk2({ ok:true, status:200, json: async () => ({ markdown: "ingen overskrifter her" }) });
  t("en fil uden udgaver giver «tom»", /Ændringsloggen er tom/.test(el("clKrop").innerHTML));
  el = await mk2({ ok:true, status:200, json: async () => ({ forkert:true }) });
  t("uventet svar giver en fejl, ikke et nedbrud", /HTTP 200|findes ikke|fejl/i.test(el("clKrop").innerHTML) || el("clKrop").innerHTML.length > 0);
  el = await mk2({ ok:true, status:200, json: async () => ({ markdown: "## [1.0.0] – 2026-01-01\n### Tilføjet\n- ét\n" }) });
  t("kun én version: dropdown skjules", el("clValg").hidden === true && /<li>ét<\/li>/.test(el("clKrop").innerHTML));
}
process.exit(T.every(Boolean)?0:1);
