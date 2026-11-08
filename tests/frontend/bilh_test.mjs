import fs from "fs";
const T=[]; const t=(n,ok,x="")=>{T.push(ok);console.log(ok?"ok  ":"FEJL",n,ok?"":x)};
const tick = () => new Promise(r => setImmediate(r));
const F = (name, size = 1000, type = "image/jpeg", lm = 1) => ({ name, size, type, lastModified: lm });

// ───────────── kernen ─────────────
{
  const kode = fs.readFileSync("/tmp/bilh_kerne.js", "utf8") + "; return { biNoegle, biErBillede, biBytes, biFiltrer, biFejltekst, biForbered, biKoer, BI_MAX_BYTES };";
  const k = new Function(kode)();
  t("biBytes", k.biBytes(512) === "512 B" && k.biBytes(2000) === "2 kB" && k.biBytes(3_500_000) === "3,5 MB" && k.biBytes(15_000_000) === "15,0 MB", [k.biBytes(512), k.biBytes(2000), k.biBytes(3_500_000)].join(" | "));
  t("biErBillede: type eller endelse, ikke pdf/tekst", k.biErBillede(F("a.jpg")) && k.biErBillede(F("IMG_1.HEIC", 5, "")) && k.biErBillede(F("x", 5, "image/avif")) && !k.biErBillede(F("a.pdf", 5, "application/pdf")) && !k.biErBillede(F("note.txt", 5, "text/plain")) && !k.biErBillede(null));
  const { nye, sprunget } = k.biFiltrer([F("a.jpg"), F("b.png", 5, "image/png"), F("c.pdf", 5, "application/pdf"), F("a.jpg"), F("a.jpg", 1000, "image/jpeg", 2)], []);
  t("biFiltrer: 3 nye (samme navn med anden ændringstid tæller som ny), pdf og dublet springes over", nye.length === 3 && sprunget.length === 2 && /pdf: ikke et billede/.test(sprunget[0]) && /står allerede/.test(sprunget[1]), JSON.stringify(sprunget));
  const igen = k.biFiltrer([F("a.jpg"), F("ny.jpg")], nye);
  t("biFiltrer mod eksisterende kø", igen.nye.length === 1 && igen.nye[0].fil.name === "ny.jpg" && igen.nye[0].status === "venter");
  t("biFejltekst", k.biFejltekst(415, { error: "Kun jpg, png og webp kan bruges." }) === "Kun jpg, png og webp kan bruges." && /Log ind igen/.test(k.biFejltekst(403, null)) && /ikke på serveren/.test(k.biFejltekst(404, null)) && /for stort/.test(k.biFejltekst(413, null)) && k.biFejltekst(500, null) === "HTTP 500");
  // forbered
  const kald = []; const form = async (f, m) => { kald.push(m); return { size: 5, type: "image/jpeg", fra: f.name }; };
  const a = F("a.jpg", 1e6, "image/jpeg");
  t("original: jpg slippes uændret igennem", (await k.biForbered(a, "original", form)) === a && kald.length === 0);
  let fejl = null; try { await k.biForbered(F("stor.png", 16e6, "image/png"), "original", form); } catch (e) { fejl = e.message; }
  t("original: over 15 MB afvises med størrelsen", /Højst 15,0 MB/.test(fejl || "") && /16,0 MB/.test(fejl), fejl);
  const h = await k.biForbered(F("x.heic", 5e6, ""), "original", form);
  t("original: HEIC må konverteres (4096)", h.type === "image/jpeg" && kald.at(-1) === 4096);
  await k.biForbered(a, "1920", form); await k.biForbered(a, "2560", form); await k.biForbered(a, "sludder", form);
  t("formindskelse: 1920, 2560, ugyldigt giver 1920", kald.slice(-3).join() === "1920,2560,1920", kald.join());
  // køen
  const mk = n => Array.from({ length: n }, (_, i) => ({ fil: F(`f${i}.jpg`, 10 + i), status: "venter", besked: "" }));
  let samtidig = 0, maks = 0; const sendt = [];
  const send = async b => { samtidig++; maks = Math.max(maks, samtidig); await tick(); await tick(); samtidig--; sendt.push(b.fra); };
  let opd = 0;
  let q = mk(6);
  const r = await k.biKoer(q, { valg: "1920", formindsk: form, sendFn: send, onOpdater: () => opd++ });
  t("kø: alle 6 sendt, aldrig mere end 2 ad gangen", r.ok === 6 && r.fejl === 0 && maks === 2 && sendt.length === 6 && q.every(x => x.status === "faerdig" && x.besked === "Sendt ✓"), `ok=${r.ok} maks=${maks}`);
  t("kø: onOpdater kaldes undervejs", opd >= 12, opd);
  q = mk(5);
  const send2 = async b => { await tick(); if (b.fra === "f1.jpg") throw new Error("Kun jpg, png og webp kan bruges."); if (b.fra === "f3.jpg") throw new Error("Kunne ikke nå serveren."); };
  const r2 = await k.biKoer(q, { valg: "1920", formindsk: form, sendFn: send2 });
  t("kø: to fejler, de andre tre går igennem", r2.ok === 3 && r2.fejl === 2 && q[1].status === "fejl" && q[1].besked === "Kun jpg, png og webp kan bruges." && q[3].besked === "Kunne ikke nå serveren." && q[0].status === "faerdig" && q[4].status === "faerdig");
  const formFejl = async (f) => { if (f.name === "f2.jpg") throw new Error("Kunne ikke læse billedet."); return { type: "image/jpeg", fra: f.name }; };
  q = mk(4); const r3 = await k.biKoer(q, { valg: "1920", formindsk: formFejl, sendFn: send });
  t("kø: fejl ved formindskelse gør kun det ene billede mislykket", r3.fejl === 1 && q[2].status === "fejl" && /Kunne ikke læse/.test(q[2].besked) && r3.ok === 3);
  // prøv igen
  q[2].status = "venter"; const r4 = await k.biKoer(q, { valg: "1920", formindsk: form, sendFn: send });
  t("prøv igen: kun det mislykkede sendes, de færdige røres ikke", r4.ok === 1 && r4.fejl === 0 && q.every(x => x.status === "faerdig"));
  const r5 = await k.biKoer([], { valg: "1920", formindsk: form, sendFn: send });
  t("tom kø giver 0/0", r5.ok === 0 && r5.fejl === 0);
  q = mk(1); const r6 = await k.biKoer(q, { valg: "1920", formindsk: form, sendFn: send, samtidige: 5 });
  t("ét billede med mange arbejdere", r6.ok === 1);
}

// ───────────── siden som helhed (falsk DOM) ─────────────
{
  const js = fs.readFileSync("/tmp/bil_html.mjs", "utf8")
    .replace('import { API_KEY } from "./config.js";', 'const API_KEY = "testnoegle";');
  const els = {};
  const el = id => (els[id] ??= { id, innerHTML: "", textContent: "", hidden: false, value: "", dataset: {}, style: {}, _h: {}, _cls: new Set(),
    classList: { add: c => els[id]._cls.add(c), remove: c => els[id]._cls.delete(c) },
    addEventListener(t, f){ (this._h[t] ??= []).push(f); }, setAttribute(k, v){ this[k] = v; }, click(){ (this._h.click || []).forEach(f => f({})); },
    get parentElement(){ return el("bar_forælder"); } });
  el("stoerrelse").value = "original";
  const document = { getElementById: el, createElement: () => ({ getContext: () => ({ drawImage(){} }), toBlob: cb => cb({ size: 5, type: "image/jpeg", fra: "canvas" }) }) };
  const srv = { filer: [{ id: "1-a.jpg" }, { id: "2-b.png" }], uploads: [], slettet: [], afvis: null };
  const fetch = async (url, o = {}) => {
    const u = new URL(url, "http://x/"); const a = u.searchParams.get("action");
    const ok = d => ({ ok: true, status: 200, json: async () => d }), no = (s, m) => ({ ok: false, status: s, json: async () => ({ error: m }) });
    if (a === "liste") return ok({ filer: srv.filer, maxFiler: 1000 });
    if (a === "upload"){ if (srv.afvis) return no(415, "Kun jpg, png og webp kan bruges."); srv.uploads.push({ type: o.headers["Content-Type"], key: o.headers["X-Ugeplan-Key"] }); srv.filer.unshift({ id: `ny${srv.uploads.length}.jpg` }); return ok({ id: "x" }); }
    if (a === "slet"){ srv.slettet.push(JSON.parse(o.body).id); srv.filer = srv.filer.filter(f => f.id !== JSON.parse(o.body).id); return ok({ ok: true }); }
    if (u.pathname.endsWith("info.php")) return ok({ version: "2.0.0" });
    return no(400, "?");
  };
  const win = { _h: {}, addEventListener(t, f){ (this._h[t] ??= []).push(f); } };
  new Function("document", "fetch", "window", "URL", "createImageBitmap", js)(document, fetch, win,
    { createObjectURL: () => "blob:x", revokeObjectURL(){} }, undefined);
  await tick(); await tick();
  t("siden henter listen ved start: 2 billeder og miniaturer med hent-adressen", /2 billeder \(højst 1000\)/.test(el("antal").textContent) && (el("grid").innerHTML.match(/class="tile"/g) || []).length === 2 && /billeder\.php\?action=hent&amp;id=1-a\.jpg/.test(el("grid").innerHTML), el("antal").textContent);
  t("versionen vises nederst", el("ver").textContent === "Familieoverblik v2.0.0");
  // slip 3 filer: 2 billeder + 1 pdf
  el("drop")._h.drop.forEach(f => f({ dataTransfer: { files: [F("a.jpg"), F("b.png", 2000, "image/png"), F("c.pdf", 5, "application/pdf")] } }));
  await tick(); await tick(); await tick(); await tick(); await tick();
  t("slip: kun de to billeder sendes (pdf springes over), som image/jpeg og image/png, med nøglen", srv.uploads.length === 2 && srv.uploads.map(u => u.type).sort().join() === "image/jpeg,image/png" && srv.uploads.every(u => u.key === "testnoegle"), JSON.stringify(srv.uploads));
  t("slip: pdf'en nævnes som sprunget over", /Sprang 1 over: c\.pdf: ikke et billede/.test(el("note").textContent), el("note").textContent);
  t("oversigt: 2 af 2 sendt, bjælken står på 100 %", el("resumeTekst").textContent.startsWith("2 af 2 sendt") && el("bar").style.width === "100%" && el("resume").hidden === false, el("resumeTekst").textContent);
  t("listen over billeder på serveren opdateres bagefter (4)", /4 billeder/.test(el("antal").textContent), el("antal").textContent);
  t("køen viser hvert billede som Sendt ✓", (el("kø").innerHTML.match(/status faerdig/g) || []).length === 2 && /Sendt ✓/.test(el("kø").innerHTML));
  // dublet
  el("fil")._h.change[0]({ target: { files: [F("a.jpg")], value: "x" } }); await tick(); await tick();
  t("samme billede igen sendes ikke to gange, og du får at vide hvorfor", srv.uploads.length === 2 && /Sprang 1 over: a\.jpg: står allerede på listen/.test(el("note").textContent), el("note").textContent);
  // fejl fra server
  srv.afvis = true;
  el("fil")._h.change[0]({ target: { files: [F("d.jpg", 900)], value: "" } });
  for (let i = 0; i < 6; i++) await tick();
  t("serverafvisning vises ved billedet, og 'Prøv igen' dukker op", /mislykkedes/.test(el("resumeTekst").textContent) && /Kun jpg, png og webp/.test(el("kø").innerHTML) && el("igen").hidden === false, el("resumeTekst").textContent);
  srv.afvis = null; el("igen").click();
  for (let i = 0; i < 8; i++) await tick();
  t("«Prøv de mislykkede igen» sender det mislykkede", srv.uploads.length === 3 && el("igen").hidden === true, srv.uploads.length);
  el("ryd").click();
  t("«Ryd listen» tømmer køen og skjuler oversigten", el("kø").innerHTML === "" && el("resume").hidden === true);
  // slet to tryk
  const knap = { dataset: { slet: "ny1.jpg" }, textContent: "×" };
  const ev = { target: { closest: s => s === "[data-slet]" ? knap : null } };
  await el("grid")._h.click[0](ev);
  t("sletning kræver to tryk", knap.textContent === "Slet?" && srv.slettet.length === 0);
  await el("grid")._h.click[0](ev); await tick(); await tick();
  t("andet tryk sletter og opdaterer listen", srv.slettet.join() === "ny1.jpg" && !/ny1\.jpg/.test(el("grid").innerHTML));
}
process.exit(T.every(Boolean) ? 0 : 1);
