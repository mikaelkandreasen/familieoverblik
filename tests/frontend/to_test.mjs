import fs from "fs";
const T=[]; const t=(n,ok,x="")=>{T.push(ok);console.log(ok?"ok  ":"FEJL",n,ok?"":x)};
const tick = () => new Promise(r => setImmediate(r));
const kode = fs.readFileSync("/tmp/to_block.js","utf8").replace('(await import("./qr.js")).qrSvg(d.uri, { ecl: "M", titel: "QR-kode til totrinsbekræftelse" })', "QR(d.uri)");
const mk = () => { const els = {}; const el = id => (els[id] ??= { id, value: "", textContent: "", innerHTML: "", hidden: false, dataset: {}, handlers: {}, addEventListener(t, f){ (this.handlers[t] ??= []).push(f); } }); return { els, el }; };
const fyr = async (e, type) => { for (const f of e.handlers[type] || []) await f({}); await tick(); await tick(); };
async function side({ status = { aktiv: false, gendannelse_tilbage: 0, husk_dage: 90 }, svar } = {}){
  const { els, el } = mk(); const kald = []; const tilst = { ...status };
  ["toSek", "toOpsaet", "toKoder", "toTil"].forEach(i => { el(i).hidden = true; });          // som i HTML-en
  globalThis.fetch = async (url, o = {}) => { const m = o.method || "GET", b = o.body ? JSON.parse(o.body) : null; kald.push({ url, m, b });
    const ok = d => ({ ok: true, status: 200, json: async () => d }), no = (s, f) => ({ ok: false, status: s, json: async () => ({ ok: false, fejl: f }) });
    if (svar){ const x = svar(m, b); if (x) return x; }
    if (m === "GET") return ok(tilst);
    if (b.handling === "start") return ok({ ok: true, secret: "ABCDEFGHIJKLMNOP", uri: "otpauth://totp/Familieoverblik?secret=ABCDEFGHIJKLMNOP&issuer=Familieoverblik" });
    if (b.handling === "bekraeft"){ if (b.kode !== "123456") return no(400, "Koden passer ikke."); tilst.aktiv = true; tilst.gendannelse_tilbage = 8; return ok({ ok: true, gendannelseskoder: ["abcd-efgh", "jkmn-pqrs"] }); }
    if (b.handling === "koder"){ if (!b.kode) return no(400, "Koden passer ikke."); return ok({ ok: true, gendannelseskoder: ["nyaa-nyaa"] }); }
    if (b.handling === "fra"){ if (b.kode !== "123456") return no(400, "Koden passer ikke."); tilst.aktiv = false; tilst.gendannelse_tilbage = 0; return ok({ ok: true }); }
    if (b.handling === "husk"){ tilst.husk_dage = b.dage; return ok({ ok: true, husk_dage: b.dage }); }
    if (b.handling === "alle-ud") return ok({ ok: true });
    return no(400, "?"); };
  Object.defineProperty(globalThis, "navigator", { value: { clipboard: { writeText: async v => { els._kopi = v; } } }, configurable: true });
  new Function("$", "HEAD", "QR", kode)(el, { "X-Ugeplan-Key": "k" }, uri => `<svg data-uri="${uri}"></svg>`);
  await tick(); await tick(); await tick();
  return { els, el, kald, tilst };
}
let s = await side();
t("slået fra: sektionen vises med status og «Slå til»-knappen, de andre blokke er skjult", s.els.toSek.hidden === false && /slået fra: kun PIN/.test(s.el("toStatus").textContent) && s.el("toFraBlok").hidden === false && s.el("toTil").hidden === true && s.el("toOpsaet").hidden === true);
await fyr(s.els.toStart, "click");
t("start: QR-koden tegnes ud fra otpauth-adressen, hemmeligheden vises i grupper à fire, og trinnet med koden vises", /data-uri="otpauth:\/\/totp\/Familieoverblik\?secret=ABCDEFGHIJKLMNOP/.test(s.el("toQr").innerHTML) && s.el("toSecret").textContent === "ABCD EFGH IJKL MNOP" && s.el("toOpsaet").hidden === false && s.el("toFraBlok").hidden === true && s.kald.at(-1).b.handling === "start");
await fyr(s.els.toAnnuller, "click"); t("annuller rydder QR og hemmelighed og viser knappen igen", s.el("toQr").innerHTML === "" && s.el("toSecret").textContent === "" && s.el("toFraBlok").hidden === false && s.el("toOpsaet").hidden === true);
await fyr(s.els.toStart, "click"); s.el("toBekraeftKode").value = "000000"; await fyr(s.els.toBekraeft, "click");
t("forkert kode: forklaring, og intet slås til", /Koden passer ikke/.test(s.el("toFejl").textContent) && s.tilst.aktiv === false && s.el("toKoder").hidden !== false);
s.el("toBekraeftKode").value = " 123456 "; await fyr(s.els.toBekraeft, "click");
const b = s.kald.find(k => k.b && k.b.handling === "bekraeft" && k.b.kode === "123456");
t("…kode «123456» sendt trimmet", !!b);
t("…koderne vises, status er «slået TIL … 8 af 8», QR og hemmelighed er væk, og brugeren får at vide, at alle andre skal logge ind igen", s.el("toKoder").hidden === false && s.el("toKoderListe").textContent === "abcd-efgh\njkmn-pqrs" && /slået TIL/.test(s.el("toStatus").textContent) && /8 af 8/.test(s.el("toStatus").textContent) && s.el("toQr").innerHTML === "" && s.el("toSecret").textContent === "" && /alle andre enheder skal logge ind igen/i.test(s.el("toInfo").textContent) && s.el("toTil").hidden === false && s.el("toFraBlok").hidden === true);
await fyr(s.els.toKopier, "click"); t("«Kopiér» lægger koderne på udklipsholderen", s.els._kopi === "abcd-efgh\njkmn-pqrs" && /Kopieret/.test(s.el("toInfo").textContent));
await fyr(s.els.toKoderLuk, "click"); t("«Jeg har gemt dem» fjerner koderne fra siden", s.el("toKoder").hidden === true && s.el("toKoderListe").textContent === "");
s.el("toHusk").value = "30"; await fyr(s.els.toHusk, "change"); t("husk-enhed: dage sendes som tal", s.kald.at(-1).b.handling === "husk" && s.kald.at(-1).b.dage === 30 && /Gemt/.test(s.el("toInfo").textContent));
s.el("toKodeFelt").value = ""; await fyr(s.els.toNyeKoder, "click"); t("nye gendannelseskoder uden kode afvises af serveren, og fejlen vises", /Koden passer ikke/.test(s.el("toFejl").textContent) && s.el("toKoder").hidden === true);
s.el("toKodeFelt").value = " 123456 "; await fyr(s.els.toNyeKoder, "click");
t("med en kode vises de nye koder, og feltet ryddes", s.el("toKoderListe").textContent === "nyaa-nyaa" && s.el("toKodeFelt").value === "" && s.kald.some(k => k.b && k.b.handling === "koder" && k.b.kode === "123456"));
await fyr(s.els.toFraKnap, "click"); t("slå fra kræver to tryk", /Tryk igen/.test(s.el("toFraKnap").textContent) && !s.kald.some(k => k.b && k.b.handling === "fra"));
s.el("toKodeFelt").value = "000000"; await fyr(s.els.toFraKnap, "click"); t("forkert kode ved «slå fra» giver en fejl, og det er stadig slået til", /Koden passer ikke/.test(s.el("toFejl").textContent) && s.tilst.aktiv === true);
await fyr(s.els.toFraKnap, "click"); await fyr(s.els.toFraKnap, "click");
s.el("toKodeFelt").value = "123456"; await fyr(s.els.toFraKnap, "click"); await fyr(s.els.toFraKnap, "click");
t("slå fra med rigtig kode: status er fra, koderne er skjult, og der står, at andre enheder skal logge ind igen", s.tilst.aktiv === false && /slået fra/.test(s.el("toStatus").textContent) && s.el("toTil").hidden === true && s.el("toFraBlok").hidden === false && /logge ind igen med PIN/.test(s.el("toInfo").textContent), s.el("toInfo").textContent + s.el("toFejl").textContent);
s = await side({ status: { aktiv: true, gendannelse_tilbage: 3, husk_dage: 180 } });
t("slået til ved åbning: «3 af 8», husk-valget er 180, og der er ingen «Slå til»-knap", s.el("toTil").hidden === false && s.el("toFraBlok").hidden === true && /3 af 8/.test(s.el("toStatus").textContent) && s.el("toHusk").value === "180");
await fyr(s.els.toAlleUd, "click"); t("«Log alle enheder ud» kræver to tryk", /Tryk igen/.test(s.el("toAlleUd").textContent) && !s.kald.some(k => k.b && k.b.handling === "alle-ud"));
await fyr(s.els.toAlleUd, "click"); t("andet tryk logger alle andre ud og siger, at man selv bliver", s.kald.some(k => k.b && k.b.handling === "alle-ud") && /stadig logget ind her/.test(s.el("toInfo").textContent) && s.el("toAlleUd").textContent === "Log alle enheder ud");
const s2 = await side({ svar: m => m === "GET" ? { ok: false, status: 404, json: async () => ({}) } : null }); t("404 (ældre version) skjuler sektionen", s2.els.toSek.hidden === true);
const s3 = await side({ svar: m => m === "GET" ? { ok: false, status: 403, json: async () => ({ ok: false, fejl: "log ind med familiens kode først" }) } : null }); t("403 skjuler sektionen", s3.els.toSek.hidden === true);
process.exit(T.every(Boolean) ? 0 : 1);
