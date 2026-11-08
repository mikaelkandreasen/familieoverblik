import fs from "fs";
import { qrMatrix } from "../../public_html/qr.js";
const T=[]; const t=(n,ok,x="")=>{T.push(ok);console.log(ok?"ok  ":"FEJL",n,ok?"":x)};
const tick = () => new Promise(r => setImmediate(r));
const src = fs.readFileSync("/tmp/wifi_page.mjs","utf8");
const kerne = src.slice(src.indexOf("// ── Kerne"), src.indexOf("// ── Slut på kernen"));
const K = new Function(kerne + "; return { wifiEsk, wifiTekst, wifiFejl };")();

// ── tekst ──
t("standard WPA", K.wifiTekst({ ssid:"Gaest", kode:"hemmelig123", sikkerhed:"WPA", skjult:false }) === "WIFI:T:WPA;S:Gaest;P:hemmelig123;H:false;;");
t("skjult netværk", K.wifiTekst({ ssid:"X", kode:"abcdefgh", sikkerhed:"WPA", skjult:true }).endsWith("H:true;;"));
t("åbent netværk har ingen P:-del", K.wifiTekst({ ssid:"Cafe", kode:"ignoreres", sikkerhed:"nopass", skjult:false }) === "WIFI:T:nopass;S:Cafe;H:false;;");
t("tegnene \\ ; , \" : escapes med omvendt skråstreg", K.wifiTekst({ ssid:'A;B,C:"D"', kode:"p\\a;ss", sikkerhed:"WPA", skjult:false }) === 'WIFI:T:WPA;S:A\\;B\\,C\\:\\"D\\";P:p\\\\a\\;ss;H:false;;', K.wifiTekst({ ssid:'A;B,C:"D"', kode:"p\\a;ss", sikkerhed:"WPA", skjult:false }));
t("ukendt sikkerhed giver WPA (ikke et hul i teksten)", K.wifiTekst({ ssid:"a", kode:"abcdefgh", sikkerhed:"<script>", skjult:false }).startsWith("WIFI:T:WPA;"));
t("danske bogstaver bevares", /S:Gæst;P:blåbær123/.test(K.wifiTekst({ ssid:"Gæst", kode:"blåbær123", sikkerhed:"WPA", skjult:false })));
// ── regler (samme som wifi.php) ──
t("regler: tomt navn, for langt navn (byte, ikke tegn)", K.wifiFejl({ ssid:"", kode:"abcdefgh", sikkerhed:"WPA" }).includes("1 og 32") && K.wifiFejl({ ssid:"æ".repeat(17), kode:"abcdefgh", sikkerhed:"WPA" }).includes("1 og 32") && K.wifiFejl({ ssid:"æ".repeat(16), kode:"abcdefgh", sikkerhed:"WPA" }) === "");
t("regler: WPA 8 til 63 tegn", K.wifiFejl({ ssid:"a", kode:"1234567", sikkerhed:"WPA" }).includes("8 og 63") && K.wifiFejl({ ssid:"a", kode:"x".repeat(64), sikkerhed:"WPA" }).includes("8 og 63") && K.wifiFejl({ ssid:"a", kode:"x".repeat(63), sikkerhed:"WPA" }) === "");
t("regler: WEP 5/13 tegn eller 10/26 hex", K.wifiFejl({ ssid:"a", kode:"abcde", sikkerhed:"WEP" }) === "" && K.wifiFejl({ ssid:"a", kode:"abcdef", sikkerhed:"WEP" }) !== "" && K.wifiFejl({ ssid:"a", kode:"0123456789", sikkerhed:"WEP" }) === "" && K.wifiFejl({ ssid:"a", kode:"x".repeat(13), sikkerhed:"WEP" }) === "");
t("regler: åbent netværk kræver ingen kode, styretegn afvises", K.wifiFejl({ ssid:"a", kode:"", sikkerhed:"nopass" }) === "" && K.wifiFejl({ ssid:"a\nb", kode:"abcdefgh", sikkerhed:"WPA" }).includes("styretegn"));

// ── gem tekster og matricer til afkodning med OpenCV ──
const tekster = [
  K.wifiTekst({ ssid:"Gaest", kode:"hemmelig123", sikkerhed:"WPA", skjult:false }),
  K.wifiTekst({ ssid:'A;B,C:"D"', kode:"p\\a;ss", sikkerhed:"WPA", skjult:true }),
  K.wifiTekst({ ssid:"Gæstenet ÆØÅ", kode:"blåbærsyltetøj-2026!", sikkerhed:"WPA", skjult:false }),
  K.wifiTekst({ ssid:"Cafe", kode:"", sikkerhed:"nopass", skjult:false }),
  K.wifiTekst({ ssid:"x".repeat(32), kode:"y".repeat(63), sikkerhed:"WPA", skjult:true }),
];
fs.writeFileSync("/tmp/wifi_qr.json", JSON.stringify(tekster.map(x => { const q = qrMatrix(x, "M"); return { tekst:x, size:q.size, version:q.version, rows:q.modules.map(r => r.map(v => v ? 1 : 0).join("")) }; })));

// ── siden som helhed ──
const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
async function side(svar){
  const els = {}; const el = id => (els[id] ??= { id, value:"", checked:false, innerHTML:"", textContent:"", hidden:false, dataset:{}, handlers:{}, addEventListener(t,f){ (this.handlers[t] ??= []).push(f); } });
  ["visKort","redigerKort","kode","vis","annuller","slet","kodeBlok"].forEach(i => { el(i).hidden = true; });
  const kald = []; let printet = 0;
  globalThis.window = { print(){ printet++; } };
  const fetch = async (url, o = {}) => { const b = o.body ? JSON.parse(o.body) : null; kald.push({ url, m:o.method || "GET", b });
    const r = svar(url, o.method || "GET", b); return { ok:r.status < 400, status:r.status, json: async () => r.data }; };
  const kode = src.replace(/^import .*$/mg, "");
  const f = new AsyncFunction("document","fetch","API_KEY","qrSvg","window", kode);
  await f({ getElementById: el }, fetch, "k", (tx) => `<svg data-tekst="${tx}"></svg>`, globalThis.window);
  await tick();
  return { el, kald, printet: () => printet, klik: async id => { for (const h of els[id].handlers.click || []) await h({}); await tick(); }, send: async () => { for (const h of els.form.handlers.submit || []) await h({ preventDefault(){} }); await tick(); } };
}
let s = await side((u, m, b) => m === "GET" ? { status:200, data:{ gemt:true, ssid:"Gaest", kode:"hemmelig123", sikkerhed:"WPA", skjult:false } } : { status:200, data:{ gemt:true, ...b } });
t("gemt netværk: QR vises med den rigtige tekst, redigering er skjult", s.el("visKort").hidden === false && s.el("redigerKort").hidden === true && /data-tekst="WIFI:T:WPA;S:Gaest;P:hemmelig123;H:false;;"/.test(s.el("qr").innerHTML), s.el("qr").innerHTML);
t("navn og sikkerhed vises, koden er skjult fra start", s.el("navn").textContent === "Gaest" && s.el("sik").textContent === "WPA" && s.el("kode").hidden === true);
await s.klik("vis");
t("«Vis adgangskoden» viser den og skifter knappens tekst", s.el("kode").hidden === false && s.el("kode").textContent === "hemmelig123" && /Skjul/.test(s.el("vis").textContent));
await s.klik("vis"); t("og skjuler den igen", s.el("kode").hidden === true);
await s.klik("print"); t("Udskriv kalder window.print", s.printet() === 1);
await s.klik("rediger");
t("«Skift netværk» åbner formularen med de gemte værdier og Annuller/Glem", s.el("redigerKort").hidden === false && s.el("ssid").value === "Gaest" && s.el("kodeFelt").value === "hemmelig123" && s.el("annuller").hidden === false && s.el("slet").hidden === false);
s.el("ssid").value = ""; await s.send();
t("ugyldig formular sendes ikke og forklares", /1 og 32/.test(s.el("fejl").textContent) && s.kald.filter(k => k.m === "POST").length === 0);
s.el("ssid").value = "Nyt"; s.el("kodeFelt").value = "kortkode"; s.el("sikkerhed").value = "WPA"; await s.send();
t("8 tegn er nok, og der gemmes", s.kald.filter(k => k.m === "POST").length === 1 && s.kald.at(-1).b.ssid === "Nyt" && s.el("visKort").hidden === false);
s.el("sikkerhed").value = "nopass"; s.el("kodeFelt").value = "ignoreres";
for (const h of s.el("sikkerhed").handlers.change || []) h({});
t("«Åbent» skjuler kodefeltet", s.el("kodeBlok").hidden === true);
await s.klik("rediger"); await s.klik("annuller");
t("Annuller viser koden igen uden at gemme", s.el("visKort").hidden === false && s.kald.filter(k => k.m === "POST").length === 1);
await s.klik("rediger"); await s.klik("slet");
t("Glem kræver to tryk", s.kald.filter(k => /slet/.test(k.url)).length === 0 && /Tryk igen/.test(s.el("slet").textContent));
await s.klik("slet");
t("andet tryk glemmer netværket og viser tom formular uden Annuller", s.kald.some(k => /action=slet/.test(k.url)) && s.el("redigerKort").hidden === false && s.el("annuller").hidden === true && s.el("ssid").value === "");
s = await side(() => ({ status:200, data:{ gemt:false, ssid:"", kode:"", sikkerhed:"WPA", skjult:false } }));
t("intet gemt: formularen vises straks", s.el("redigerKort").hidden === false && s.el("visKort").hidden === true && s.el("annuller").hidden === true);
s = await side(() => ({ status:403, data:{ error:"log ind med familiens kode først" } }));
t("403: fejlen vises i formularen", /log ind med familiens kode først/.test(s.el("fejl").textContent) && s.el("redigerKort").hidden === false);
s = await side(() => ({ status:404, data:{} }));
t("404 forklares", /wifi\.php findes ikke/.test(s.el("fejl").textContent));
process.exit(T.every(Boolean)?0:1);
