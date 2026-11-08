import fs from "fs";
const M = await import("../../public_html/sprog.js");
const T=[]; const t=(n,ok,x="")=>{T.push(ok);console.log(ok?"ok  ":"FEJL",n,ok?"":x)};
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const tick = () => new Promise(r => setImmediate(r));
const kode = fs.readFileSync("/tmp/sprogidx_block.js","utf8").replace('import("./sprog.js")', "Promise.resolve(M)");
const mk = () => { const els = {}; const el = id => (els[id] ??= { id, value:"", innerHTML:"", textContent:"", hidden:false, dataset:{}, handlers:{}, files:null, addEventListener(t,f){ (this.handlers[t] ??= []).push(f); } }); return { els, el }; };
const fyr = async (e, type, ev = {}) => { for (const f of e.handlers[type] || []) await f({ preventDefault(){}, target: e, ...ev }); await tick(); await tick(); };

async function side({ server, upload } = {}){
  const { els, el } = mk(); const kald = []; const filer = []; const startet = [];
  const srv = { standard: "da", tilpasset: {}, ...(server || {}) };
  globalThis.fetch = async (url, o = {}) => { const m = o.method || "GET", b = o.body ? JSON.parse(o.body) : null; kald.push({ url, m, b });
    const ok = d => ({ ok: true, status: 200, json: async () => d }), no = (s, e) => ({ ok: false, status: s, json: async () => ({ error: e }) });
    if (srv.fejl) return no(srv.fejl, "fejl");
    if (url === "sprog.php" && m === "GET") return ok({ standard: srv.standard, tilpasset: srv.tilpasset });
    if (url === "sprog.php" && m === "POST"){ srv.standard = b.standard; return ok({ standard: srv.standard, tilpasset: srv.tilpasset }); }
    if (url === "sprog.php?action=upload"){ if (upload) return no(400, upload); for (const [k, p] of Object.entries(b.sprog)) srv.tilpasset[k] = { navn: p.navn, tekster: { ...(srv.tilpasset[k]?.tekster || {}), ...Object.fromEntries(Object.entries(p.tekster).filter(([, v]) => v)) } }; return ok({ standard: srv.standard, tilpasset: srv.tilpasset }); }
    if (url === "sprog.php?action=slet"){ delete srv.tilpasset[b.kode]; return ok({ standard: srv.standard, tilpasset: srv.tilpasset }); }
    return no(404, "?"); };
  const document = { createElement: () => ({ click(){ filer.push(this.download + "|" + this._tekst); }, remove(){}, set href(v){ this._h = v; }, get href(){ return this._h; } }), body: { appendChild(){} } };
  globalThis.Blob = class { constructor(d){ this.tekst = d.join(""); } };
  globalThis.URL = { createObjectURL: b => { globalThis._sidsteBlob = b.tekst; return "blob:x"; }, revokeObjectURL(){} };
  const a = new Function("$", "esc", "HEAD", "document", "M", "setTimeout", kode.replace(/startSprog\(\{ HEAD, container: \$\("sprogKontrol"\) \}\)/, "startSprog({ HEAD, container: $('sprogKontrol') })") )(el, esc, {}, document, { ...M, startSprog: async o => { startet.push(o.container.id); } }, f => 0);
  await tick(); await tick(); await tick();
  return { els, kald, filer, el, startet, srv };
}
let s = await side();
t("sektionen vises, og sprogkontrollen startes i sin beholder", s.els.sprogSek.hidden === false && s.startet.join() === "sprogKontrol");
t("standardvælgeren: dansk, de medfølgende, så maskinsprog uden fil (ikke dubletter)", /<option value="da">Dansk/.test(s.els.sprogStd.innerHTML) && /value="en">English/.test(s.els.sprogStd.innerHTML) && /value="de">Deutsch/.test(s.els.sprogStd.innerHTML) && /value="fr">Français \(maskinoversat\)/.test(s.els.sprogStd.innerHTML) && (s.els.sprogStd.innerHTML.match(/value="en"/g) || []).length === 1 && s.els.sprogStd.value === "da");
t("ingen lagt-ind sprog: ingen liste", s.els.sprogListe.innerHTML === "");
s = await side({ server: { standard: "sv", tilpasset: { sv: { navn: "Svenska <b>", tekster: { A: "a", B: "b" } } } } });
t("lagt-ind sprog vises med navn (escaped), kode og antal, og kan vælges som standard", /Svenska &lt;b&gt; \(sv\) · 2 tekster/.test(s.els.sprogListe.innerHTML) && /value="sv">Svenska &lt;b&gt;/.test(s.els.sprogStd.innerHTML) && s.els.sprogStd.value === "sv");
s = await side({ server: { fejl: 404 } });
t("serverfejl skjuler sektionen", s.els.sprogSek.hidden === true);
s = await side();
s.els.sprogStd.value = "en"; await fyr(s.els.sprogForm, "submit");
t("gem standardsprog sender koden og melder det", s.kald.at(-1).b.standard === "en" && /Gemt/.test(s.els.sprogInfo.textContent) && s.els.sprogFejl.textContent === "");
// hent alle
await fyr(s.els.sprogHent, "click");
const alle = JSON.parse(globalThis._sidsteBlob);
t("«Hent alle sprog som fil»: gyldig sprogfil med de medfølgende sprog", alle.format === 1 && alle.kildesprog === "da" && alle.sprog.en.navn === "English" && alle.sprog.de.tekster["Gem"] === "Speichern" && M.validerFil(alle).length === 0, JSON.stringify(Object.keys(alle.sprog || {})));
// skabelon
s.el("sprogNyKode").value = "da"; s.el("sprogNyNavn").value = "X"; await fyr(s.els.sprogSkabelon, "click");
t("skabelon: «da» og ugyldige koder afvises uden fil", /to eller tre små bogstaver/.test(s.els.sprogFejl.textContent));
s.el("sprogNyKode").value = "sv"; s.el("sprogNyNavn").value = " "; await fyr(s.els.sprogSkabelon, "click"); t("skabelon: navn kræves", /navn/.test(s.els.sprogFejl.textContent));
s.el("sprogNyKode").value = "SV"; s.el("sprogNyNavn").value = "Svenska"; await fyr(s.els.sprogSkabelon, "click");
const sk = JSON.parse(globalThis._sidsteBlob), nøgler = Object.keys(sk.sprog.sv.tekster);
t("skabelon: alle kendte danske tekster, sorteret, med tomme værdier, og selv gyldig", sk.sprog.sv.navn === "Svenska" && nøgler.length > 250 && nøgler.every(k => sk.sprog.sv.tekster[k] === "") && M.validerFil(sk).length === 0 && /\d+ danske tekster/.test(s.els.sprogInfo.textContent), `${nøgler.length}`);
s.el("sprogNyKode").value = "en"; s.el("sprogNyNavn").value = "English"; await fyr(s.els.sprogSkabelon, "click");
t("skabelon for et sprog, der findes: eksisterende oversættelser er med forud", JSON.parse(globalThis._sidsteBlob).sprog.en.tekster["Gem"] === "Save");
// upload
const fil = (indhold, size) => ({ size: size ?? indhold.length, text: async () => indhold });
const gyldig = { format: 1, kildesprog: "da", sprog: { sv: { navn: "Svenska", tekster: { "Gem": "Spara", "Annuller": "Avbryt", "Tom": "" } } } };
s.els.sprogFil.files = [fil(JSON.stringify(gyldig))]; await fyr(s.els.sprogFil, "change");
t("upload af en gyldig fil: sendt, lagt ind og meldt med antal oversatte tekster", s.kald.at(-1).url === "sprog.php?action=upload" && /Lagt ind: Svenska \(sv, 2 tekster\)/.test(s.els.sprogInfo.textContent) && /Svenska \(sv\) · 2 tekster/.test(s.els.sprogListe.innerHTML), s.els.sprogInfo.textContent + s.els.sprogFejl.textContent);
const før = s.kald.length;
s.els.sprogFil.files = [fil("{ikke json")]; await fyr(s.els.sprogFil, "change"); t("ugyldig JSON afvises uden kald", /ikke gyldig JSON/.test(s.els.sprogFejl.textContent) && s.kald.length === før);
s.els.sprogFil.files = [fil(JSON.stringify({ ...gyldig, sprog: { sv: { navn: "S", tekster: { A: "<script>x</script>" } } } }))]; await fyr(s.els.sprogFil, "change");
t("farlige tags afvises i browseren, før noget sendes", /kan ikke bruges.*tagget <script>/.test(s.els.sprogFejl.textContent) && s.kald.length === før, s.els.sprogFejl.textContent);
s.els.sprogFil.files = [fil("x", 2_000_000)]; await fyr(s.els.sprogFil, "change"); t("for stor fil afvises", /for stor/.test(s.els.sprogFejl.textContent) && s.kald.length === før);
s.els.sprogFil.files = []; await fyr(s.els.sprogFil, "change"); t("ingen fil valgt gør intet", s.kald.length === før);
// serverens afvisning
const s2 = await side({ upload: "Sprogfilen kan ikke bruges: sv: ugyldig sprogkode" });
s2.els.sprogFil.files = [fil(JSON.stringify(gyldig))]; await fyr(s2.els.sprogFil, "change");
t("serverens afvisning vises", /ugyldig sprogkode/.test(s2.els.sprogFejl.textContent) && s2.els.sprogInfo.textContent === "");
// slet
const s3 = await side({ server: { tilpasset: { sv: { navn: "Svenska", tekster: { A: "a" } } } } });
const knap = { dataset: { sprogSlet: "sv" }, textContent: "Fjern" }; const ev = { target: { closest: sel => sel === "[data-sprog-slet]" ? knap : null } };
await fyr(s3.els.sprogListe, "click", ev);
t("Fjern kræver to tryk", knap.textContent === "Tryk igen" && !s3.kald.some(k => /slet/.test(k.url)));
await fyr(s3.els.sprogListe, "click", ev);
t("andet tryk fjerner sproget og opdaterer listen", s3.kald.some(k => /action=slet/.test(k.url) && k.b.kode === "sv") && s3.els.sprogListe.innerHTML === "" && /Fjernet/.test(s3.els.sprogInfo.textContent));
process.exit(T.every(Boolean) ? 0 : 1);
