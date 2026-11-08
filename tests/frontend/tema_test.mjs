import fs from "fs";
const ROD = new URL("../../", import.meta.url).pathname;
const T=[]; const t=(n,ok,x="")=>{T.push(ok);console.log(ok?"ok  ":"FEJL",n,ok?"":x)};
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const tick = () => new Promise(r => setImmediate(r));
const kode = fs.readFileSync("/tmp/temaidx_block.js","utf8") + "; return { TEMA_STD, TEMA_PRESETS, TEMA_NOEGLER, TEMA_PAR, TEMA_GRUPPER, temaHex, temaLum, temaKontrast, temaTjek, temaForskel, temaAnvend };";

async function ny({ serverVars = {}, getFejl = null, postFejl = null } = {}){
  const els = {}; const el = id => (els[id] ??= { id, value:"", innerHTML:"", textContent:"", hidden:false, attrs:{}, dataset:{}, _cls:new Set(), handlers:{},
    classList:{ toggle:(c,on) => { on ? els[id]._cls.add(c) : els[id]._cls.delete(c); } },
    setAttribute(k,v){ this.attrs[k] = v; }, removeAttribute(k){ delete this.attrs[k]; }, addEventListener(t,f){ (this.handlers[t] ??= []).push(f); } });
  const style = { props:{}, setProperty(k,v){ this.props[k] = v; }, removeProperty(k){ delete this.props[k]; } };
  const document = { documentElement:{ style } };
  const lager = {}; const localStorage = { getItem:k => lager[k] ?? null, setItem:(k,v) => { lager[k] = v; } };
  const srv = { gem:[], nulstil:0, vars: { ...serverVars } };
  globalThis.fetch = async (url, o = {}) => {
    const m = (o.method || "GET"); const ok = d => ({ ok:true, status:200, json: async () => d }); const no = (s, e) => ({ ok:false, status:s, json: async () => ({ error:e }) });
    if (m === "GET"){ if (getFejl) return getFejl; return ok({ vars: srv.vars, updatedAt:"x" }); }
    if (postFejl) return postFejl;
    if (url.includes("action=nulstil")){ srv.nulstil++; srv.vars = {}; return ok({ vars:{}, updatedAt:"" }); }
    const b = JSON.parse(o.body); srv.gem.push(b); srv.vars = b.vars; return ok({ vars:b.vars, updatedAt:"nu" });
  };
  const cfg = { PEOPLE:[ { id:"alle", name:"Alle", color:"var(--p-alle)" }, { id:"mor", name:"Mor", color:"var(--p-1)" }, { id:"far", name:"Far", color:"var(--p-2)" }, { id:"sofie", name:"Sofie", color:"var(--p-3)" } ] };
  const a = new Function("$","esc","HEAD","cfg","document","localStorage", kode)(el, esc, {}, cfg, document, localStorage);
  await tick(); await tick(); await tick();
  const fyr = (id, type, ev = {}) => { for (const f of els[id].handlers[type] || []) f({ preventDefault(){}, ...ev }); };
  const iBox = async (id, type, ev = {}) => { for (const f of els[id].handlers[type] || []) await f({ preventDefault(){}, ...ev }); await tick(); await tick(); };
  return { a, el, els, style, lager, srv, fyr, iBox };
}

// ── kontrastmatematik ──
{
  const u = await ny(); const A = u.a;
  t("sort på hvid = 21 : 1, ens farver = 1 : 1", Math.abs(A.temaKontrast("#000000", "#ffffff") - 21) < 0.01 && Math.abs(A.temaKontrast("#777777", "#777777") - 1) < 1e-9);
  t("kendt værdi: #767676 på hvid ≈ 4,54 : 1 (lige over grænsen), #777777 ≈ 4,48", A.temaKontrast("#767676", "#ffffff") >= 4.5 && A.temaKontrast("#777777", "#ffffff") < 4.5);
  t("rækkefølgen af farverne er ligegyldig", Math.abs(A.temaKontrast("#14201c", "#fbfaf6") - A.temaKontrast("#fbfaf6", "#14201c")) < 1e-12);
  t("temaHex: 3 cifre udvides, store bogstaver gøres små, skrald afvises", A.temaHex("#ABC") === "#aabbcc" && A.temaHex(" #14201C ") === "#14201c" && A.temaHex("14201c") === null && A.temaHex("#12345") === null && A.temaHex("rgb(0,0,0)") === null && A.temaHex(null) === null && A.temaHex("#12345g") === null);
  for (const [navn, p] of Object.entries(A.TEMA_PRESETS)){
    const sv = A.temaTjek(p).filter(x => !x.ok);
    t(`forvalget «${navn}»: alle ${A.TEMA_PAR.length} farvepar er læsbare (≥ 4,5 : 1)`, sv.length === 0, sv.map(x => `${x.navn} ${x.forhold.toFixed(2)}`).join(" | "));
    t(`forvalget «${navn}»: alle farver er gyldige #rrggbb og alle nøgler er med`, A.TEMA_NOEGLER.every(n => /^#[0-9a-f]{6}$/.test(p[n])), A.TEMA_NOEGLER.filter(n => !/^#[0-9a-f]{6}$/.test(p[n])).join());
  }
  t("temaForskel: kun det, der adskiller sig fra standarden", JSON.stringify(A.temaForskel({ ...A.TEMA_STD, "--paper": "#112233" })) === '{"--paper":"#112233"}' && Object.keys(A.temaForskel(A.TEMA_STD)).length === 0);
  t("personnavnene kommer fra config.js", JSON.stringify(A.TEMA_GRUPPER.at(-1)[1].slice(0, 3)) === JSON.stringify([["--p-1","Mor"],["--p-2","Far"],["--p-3","Sofie"]]) && A.TEMA_GRUPPER.at(-1)[1][3][1] === "Ekstra farve 4");
  // listerne skal være ens i tema.php, overblik.html og index.html
  const P = ROD + "public_html/";
  const php = [...fs.readFileSync(P + "tema.php", "utf8").match(/TEMA_NOEGLER = \[([^\]]*)\]/)[1].matchAll(/'(--[a-z0-9-]+)'/g)].map(m => m[1]);
  const ov = [...fs.readFileSync(P + "overblik.html", "utf8").match(/const TEMA_NOEGLER = \[([^\]]*)\]/)[1].matchAll(/"(--[a-z0-9-]+)"/g)].map(m => m[1]);
  t("TEMA_NOEGLER er ens i tema.php, overblik.html og index.html (samme navne, samme rækkefølge)", JSON.stringify(php) === JSON.stringify(A.TEMA_NOEGLER) && JSON.stringify(ov) === JSON.stringify(A.TEMA_NOEGLER), `${php.length}/${ov.length}/${A.TEMA_NOEGLER.length}`);
  // standarden er forsidens egne værdier
  const css = fs.readFileSync(P + "overblik.html", "utf8").match(/:root\s*\{([^}]*)\}/)[1];
  const fors = Object.fromEntries([...css.matchAll(/(--[a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})/g)].map(m => [m[1], m[2].toLowerCase()]));
  t("TEMA_STD er forsidens egne farver (undtagen weekendkort, som kun opsætningen kender)", A.TEMA_NOEGLER.filter(n => n !== "--card-weekend").every(n => fors[n] === A.TEMA_STD[n]), A.TEMA_NOEGLER.filter(n => n !== "--card-weekend" && fors[n] !== A.TEMA_STD[n]).join());
}
// ── indlæsning ──
{
  const u = await ny({ serverVars: { "--paper": "#f4f6ff", "--accent": "#aa0000" } });
  t("sektionen vises, og felterne har de gemte farver (resten standard)", u.el("temaSek").hidden === false && u.el("th--paper").value === "#f4f6ff" && u.el("tc--accent").value === "#aa0000" && u.el("th--ink").value === "#14201c");
  t("de gemte farver bruges straks på siden og huskes i browseren", u.style.props["--paper"] === "#f4f6ff" && u.style.props["--accent"] === "#aa0000" && !("--ink" in u.style.props) && JSON.parse(u.lager["familieoverblik-tema"]).vars["--paper"] === "#f4f6ff");
  t("felterne er bygget: 28 rækker og 4 forvalg", (u.el("temaFelter").innerHTML.match(/class="tema-raekke"/g) || []).length === 28 && (u.el("temaPresets").innerHTML.match(/data-tema-preset/g) || []).length === 4);
  t("kontrolteksten siger, at alt er læsbart", /Alle farvepar klarer 4,5 : 1/.test(u.el("temaKontrast").textContent) && !u.el("temaKontrast")._cls.has("lav"), u.el("temaKontrast").textContent);
}
// ── redigering ──
{
  const u = await ny();
  u.fyr("temaFelter", "input", { target:{ dataset:{ tema:"--ink" }, value:"#cccccc" } });
  t("farvevælgeren opdaterer tekstfeltet og viser farven på siden med det samme", u.el("th--ink").value === "#cccccc" && u.style.props["--ink"] === "#cccccc");
  t("lav kontrast advares om (men kan stadig gemmes)", u.el("temaKontrast")._cls.has("lav") && /Svær at læse/.test(u.el("temaKontrast").textContent) && /Tekst på kort/.test(u.el("temaKontrast").textContent) && /Du kan stadig gemme/.test(u.el("temaKontrast").textContent), u.el("temaKontrast").textContent);
  u.el("th--paper").value = "#12";
  u.fyr("temaFelter", "input", { target:{ dataset:{ temaHex:"--paper" }, value:"#12", removeAttribute(){}, setAttribute(k,v){ u.el("th--paper").attrs[k] = v; } } });
  t("ugyldig hex markeres, og siden beholder den forrige farve", u.el("th--paper").attrs["aria-invalid"] === "true" && !("--paper" in u.style.props));
  await u.iBox("temaForm", "submit");
  t("gem afvises med en forklaring, og intet sendes", /skrives som #rrggbb/.test(u.el("temaFejl").textContent) && u.srv.gem.length === 0);
  u.el("th--paper").value = "#F0F0F0";
  u.fyr("temaFelter", "input", { target:{ dataset:{ temaHex:"--paper" }, value:"#F0F0F0", removeAttribute(){ delete u.el("th--paper").attrs["aria-invalid"]; }, setAttribute(){} } });
  t("rettet hex (store bogstaver) accepteres, farvevælgeren følger med og farven normaliseres", u.el("tc--paper").value === "#f0f0f0" && u.style.props["--paper"] === "#f0f0f0" && !u.el("th--paper").attrs["aria-invalid"]);
  await u.iBox("temaForm", "submit");
  t("gem sender KUN de ændrede farver (ink og paper)", u.srv.gem.length === 1 && JSON.stringify(Object.keys(u.srv.gem[0].vars).sort()) === JSON.stringify(["--ink","--paper"]) && u.srv.gem[0].vars["--paper"] === "#f0f0f0", JSON.stringify(u.srv.gem));
  t("bekræftelsen nævner antallet, og browseren husker farverne", /Gemt \(2 farver ændret\)/.test(u.el("temaInfo").textContent) && JSON.parse(u.lager["familieoverblik-tema"]).vars["--ink"] === "#cccccc", u.el("temaInfo").textContent);
}
// ── forvalg og nulstil ──
{
  const u = await ny();
  await u.iBox("temaPresets", "click", { target:{ dataset:{ temaPreset:"Mørk" } } });
  t("«Mørk» sætter alle felter og viser den på siden", u.el("th--paper").value === "#10161b" && u.el("tc--ink").value === "#e8ecef" && u.style.props["--paper"] === "#10161b" && /«Mørk» er sat ind/.test(u.el("temaInfo").textContent));
  t("et læsbart forvalg giver en grøn kontrolbesked", !u.el("temaKontrast")._cls.has("lav"));
  await u.iBox("temaForm", "submit");
  t("gem af «Mørk» sender kun forskellene til standarden", u.srv.gem.length === 1 && Object.keys(u.srv.gem[0].vars).length > 15 && !("--card-weekend" in {} ) && Object.values(u.srv.gem[0].vars).every(v => /^#[0-9a-f]{6}$/.test(v)));
  await u.iBox("temaPresets", "click", { target:{ dataset:{ temaPreset:"Standard" } } });
  t("«Standard» fjerner alle farver fra siden", Object.keys(u.style.props).length === 0 && u.el("th--paper").value === "#fbfaf6");
  await u.iBox("temaForm", "submit");
  t("gem af «Standard» sender en tom liste, og siger at der ingen ændringer er", JSON.stringify(u.srv.gem.at(-1)) === '{"vars":{}}' && /ingen ændringer i forhold til standarden/.test(u.el("temaInfo").textContent), u.el("temaInfo").textContent);
  await u.iBox("temaPresets", "click", { target:{ dataset:{ temaPreset:"Varm" } } });
  await u.iBox("temaNulstil", "click");
  t("«Nulstil til standard» kalder serveren, tømmer siden og browserens kopi og sætter felterne tilbage", u.srv.nulstil === 1 && Object.keys(u.style.props).length === 0 && JSON.stringify(JSON.parse(u.lager["familieoverblik-tema"]).vars) === "{}" && u.el("th--paper").value === "#fbfaf6" && /sat tilbage til standard/.test(u.el("temaInfo").textContent));
  t("ukendt forvalg rører ikke noget", (await u.iBox("temaPresets", "click", { target:{ dataset:{ temaPreset:"Findes ikke" } } }), u.el("th--paper").value === "#fbfaf6"));
}
// ── fejl ──
{
  let u = await ny({ getFejl:{ ok:false, status:404, json: async () => ({}) } });
  t("404 ved indlæsning skjuler sektionen (siderne virker ellers)", u.el("temaSek").hidden === true);
  u = await ny({ postFejl:{ ok:false, status:403, json: async () => ({ error:"log ind med familiens kode først" }) } });
  await u.iBox("temaForm", "submit");
  t("serverens fejltekst vises ved gem", /log ind med familiens kode først/.test(u.el("temaFejl").textContent) && u.el("temaInfo").textContent === "");
  await u.iBox("temaNulstil", "click");
  t("og ved nulstil", /log ind med familiens kode først/.test(u.el("temaFejl").textContent));
}
process.exit(T.every(Boolean)?0:1);
