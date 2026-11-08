import fs from "fs";
const T=[]; const t=(n,ok,x="")=>{T.push(ok);console.log(ok?"ok  ":"FEJL",n,ok?"":x)};
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const tick = () => new Promise(r => setTimeout(r, 5));
const els = {};
const el = id => (els[id] ??= { id, value:"", checked:false, innerHTML:"", textContent:"", hidden:false, handlers:{},
  addEventListener(t,f){ (this.handlers[t] ??= []).push(f); } });
const $ = id => el(id);
const fire = async (id, type, ev={}) => { for (const f of el(id).handlers[type] || []) await f({ preventDefault(){}, ...ev }); };

const srv = { s:{ aktiv:true, inaktivMin:5, sekunder:15, raekkefolge:"tilfaeldig", tilpasning:"udfyld", ur:true, startVedAabning:false },
  filer:[ {id:"1-a.jpg",tid:3,bytes:10},{id:"1-b.png",tid:2,bytes:10} ], calls:[], afvis:null };
globalThis.fetch = async (url, opt={}) => {
  const action = new URL(url,"http://x/").searchParams.get("action");
  srv.calls.push({ action, method:opt.method, type:opt.headers?.["Content-Type"], body:opt.body });
  const ok = d => ({ ok:true, status:200, json: async () => d });
  const fail = (st,m) => ({ ok:false, status:st, json: async () => ({ error:m }) });
  if (action === "hent"){ if (srv.hentFejl) return fail(404, "findes ikke"); return { ok:true, status:200, blob: async () => ({ size: 12, type: "image/jpeg", id: new URL(url, "http://x/").searchParams.get("id") }) }; }
  if (action === "liste") return ok({ indstillinger:srv.s, filer:srv.filer.slice(), maxFiler:1000 });
  if (action === "gem"){ srv.s = { ...JSON.parse(opt.body) }; return ok({ indstillinger:srv.s }); }
  if (action === "upload"){ if (srv.afvis) return fail(415, "Kun jpg, png og webp kan bruges."); srv.filer.unshift({ id:`n${srv.filer.length}.jpg`, tid:9, bytes:5 }); return ok({ id:"x" }); }
  if (action === "slet"){ const id = JSON.parse(opt.body).id; srv.filer = srv.filer.filter(f => f.id !== id); return ok({ ok:true }); }
  return fail(400,"?");
};
const code = fs.readFileSync("/tmp/bi_block.js","utf8");
const f = new Function("$","esc","HEAD", code + "; return { biUpload, biHel, biRoter, biDrej };")($, esc, {});
await tick(); await tick();

t("sektion vist, felter udfyldt", el("biSek").hidden === false && el("biInaktiv").value === "5" && el("biSekunder").value === "15" && el("biRaekke").value === "tilfaeldig" && el("biAktiv").checked === true && el("biUr").checked === true && el("biStart").checked === false);
t("antal og miniaturer", /2 billeder i pauseskærmen/.test(el("biAntal").textContent) && (el("biGrid").innerHTML.match(/class="bi-tile"/g)||[]).length === 2);
t("miniature bruger hent-adressen", /billeder\.php\?action=hent&amp;id=1-a\.jpg/.test(el("biGrid").innerHTML));
t("biHel: kun hele tal", f.biHel("5") === 5 && Number.isNaN(f.biHel("5,5")) && Number.isNaN(f.biHel("")) && Number.isNaN(f.biHel("abc")) && f.biHel(" 12 ") === 12);

// gem: validering
el("biInaktiv").value = "0";
const før = srv.calls.length;
await fire("biForm","submit"); await tick();
t("0 minutter afvises uden kald", srv.calls.length === før && /mellem 1 og 240/.test(el("biFejl").textContent));
el("biInaktiv").value = "10"; el("biSekunder").value = "2";
await fire("biForm","submit"); await tick();
t("2 sekunder afvises", srv.calls.length === før && /mellem 3 og 600/.test(el("biFejl").textContent));
el("biSekunder").value = "7,5";
await fire("biForm","submit"); await tick();
t("decimaltal afvises", srv.calls.length === før);

// gem: rigtigt
el("biInaktiv").value = "10"; el("biSekunder").value = "30"; el("biRaekke").value = "nyeste"; el("biTilpas").value = "hele";
el("biAktiv").checked = true; el("biUr").checked = false; el("biStart").checked = true;
await fire("biForm","submit"); await tick();
const gem = srv.calls.filter(c => c.action === "gem").at(-1);
const b = gem && JSON.parse(gem.body);
t("gemmer alle indstillinger som JSON", gem && gem.method === "POST" && gem.type === "application/json" && b.inaktivMin === 10 && b.sekunder === 30 && b.raekkefolge === "nyeste" && b.tilpasning === "hele" && b.ur === false && b.startVedAabning === true && b.aktiv === true, JSON.stringify(b));
t("besked om gemt, ingen fejl", /Gemt/.test(el("biInfo").textContent) && el("biFejl").textContent === "");

// upload
const resize = async fil => { if (fil.name === "kaput.heic") throw new Error("kunne ikke læse billedet"); return { size: 100, type:"image/jpeg" }; };
await f.biUpload([{ name:"a.jpg" }, { name:"kaput.heic" }, { name:"b.jpg" }], resize); await tick();
const ups = srv.calls.filter(c => c.action === "upload");
t("2 af 3 billeder sendt som image/jpeg", ups.length === 2 && ups.every(u => u.method === "POST" && u.type === "image/jpeg"));
t("resultat nævner det, der fejlede", /2 billeder tilføjet/.test(el("biUploadInfo").textContent) && /kaput\.heic: kunne ikke læse billedet/.test(el("biUploadInfo").textContent), el("biUploadInfo").textContent);
t("listen opdateres efter upload", /4 billeder i pauseskærmen/.test(el("biAntal").textContent), el("biAntal").textContent);

// serverfejl ved upload
srv.afvis = true;
await f.biUpload([{ name:"x.gif" }], resize); await tick();
t("serverens afvisning vises", /0 billeder tilføjet/.test(el("biUploadInfo").textContent) && /Kun jpg, png og webp/.test(el("biUploadInfo").textContent));
srv.afvis = null;

// file-input
const nu0 = srv.calls.length;
await fire("biFiler","change",{ target:{ files:[], value:"x" } }); await tick();
t("tomt valg gør intet", srv.calls.length === nu0 || srv.calls.slice(nu0).every(c => c.action !== "upload"));

// slet: to tryk
const knap = { dataset:{ biSlet:"1-b.png" }, textContent:"×" };
const tgt = { closest: s => s === "[data-bi-slet]" ? knap : null };
const antal = srv.filer.length;
await fire("biGrid","click",{ target:tgt }); await tick();
t("første tryk spørger", knap.textContent === "Slet?" && srv.filer.length === antal);
await fire("biGrid","click",{ target:tgt }); await tick(); await tick();
t("andet tryk sletter", srv.filer.length === antal - 1 && !srv.filer.some(x => x.id === "1-b.png"));
t("miniaturer opdateret", !/1-b\.png/.test(el("biGrid").innerHTML));

// kun de 48 nyeste vises
srv.filer = Array.from({ length: 60 }, (_, i) => ({ id:`f${i}.jpg`, tid:100-i, bytes:1 }));
await f.biUpload([], resize);
await fire("biFiler","change",{ target:{ files:[{name:"z.jpg"}], value:"" } }).catch(()=>{});
await tick(); await tick();
t("højst 48 miniaturer, og det siges", (el("biGrid").innerHTML.match(/class="bi-tile"/g)||[]).length === 48 && /de 48 nyeste/.test(el("biAntal").textContent), el("biAntal").textContent);
// ── rotering ──
{
  const kald = [];
  const lav = (b, h = 300, bredde = 400) => ({ bitmap: async blob => { kald.push(["bitmap", blob.id]); return { width: bredde, height: h, close(){ kald.push(["luk"]); } }; },
    canvas: () => { const c = { width: 0, height: 0, ops: [], getContext: () => ({ translate: (x, y) => c.ops.push(["translate", x, y]), rotate: g => c.ops.push(["rotate", g]), drawImage: (b, x, y) => c.ops.push(["draw", x, y]) }), toBlob: (cb, type, q) => { c.type = type; c.q = q; cb({ size: 9, type, c }); } }; kald.push(["canvas", c]); return c; } });
  const L = lav();
  let ud = await f.biRoter({ id: "a" }, 90, L); let c = kald.find(k => k[0] === "canvas")[1];
  t("90° med uret: lærredet byttes om (400×300 bliver 300×400), billedet tegnes midt i, og det gemmes som jpeg", c.width === 300 && c.height === 400 && JSON.stringify(c.ops) === JSON.stringify([["translate", 150, 200], ["rotate", Math.PI / 2], ["draw", -200, -150]]) && ud.type === "image/jpeg" && ud.c.q === 0.9, JSON.stringify(c.ops));
  kald.length = 0; await f.biRoter({ id: "a" }, 270, L); c = kald.find(k => k[0] === "canvas")[1];
  t("270° (mod uret): også byttet om, vinklen er 3π/2", c.width === 300 && c.height === 400 && Math.abs(c.ops[1][1] - 3 * Math.PI / 2) < 1e-9);
  kald.length = 0; await f.biRoter({ id: "a" }, 180, L); c = kald.find(k => k[0] === "canvas")[1];
  t("180°: lærredet har samme mål", c.width === 400 && c.height === 300 && Math.abs(c.ops[1][1] - Math.PI) < 1e-9);
  t("-90 og 450 regnes som 270 og 90 (modulo)", await (async () => { kald.length = 0; await f.biRoter({}, -90, L); const a = kald.find(k => k[0] === "canvas")[1]; kald.length = 0; await f.biRoter({}, 450, L); const b = kald.find(k => k[0] === "canvas")[1]; return Math.abs(a.ops[1][1] - 3 * Math.PI / 2) < 1e-9 && Math.abs(b.ops[1][1] - Math.PI / 2) < 1e-9; })());
  t("ugyldige vinkler (0, 45, tekst) afvises, og bitmappen læses ikke", await (async () => { kald.length = 0; let n = 0; for (const g of [0, 45, "x", NaN, 360]) { try { await f.biRoter({}, g, L); } catch (e) { if (/Ugyldig/.test(e.message)) n++; } } return n === 5 && !kald.some(k => k[0] === "bitmap"); })());
  t("bitmappen lukkes efter brug (hukommelsen frigives)", (kald.length = 0, await f.biRoter({}, 90, L), kald.some(k => k[0] === "luk")));
  let fejl = null; try { await f.biRoter({}, 90, { bitmap: async () => ({ width: 2, height: 2 }), canvas: () => ({ getContext: () => ({ translate(){}, rotate(){}, drawImage(){} }), toBlob: cb => cb(null) }) }); } catch (e) { fejl = e.message; }
  t("kan lærredet ikke gemmes (toBlob giver null), er det en forståelig fejl", /kunne ikke gemme/.test(fejl || ""));
  // hele forløbet mod serveren
  srv.calls.length = 0; srv.filer = [{ id: "g.jpg", tid: 1, bytes: 1 }, { id: "h.jpg", tid: 2, bytes: 1 }]; srv.hentFejl = false;
  await f.biDrej("g.jpg", 90, async (blob, grader) => ({ size: 5, type: "image/jpeg", fra: blob.id, grader }));
  const handlinger = srv.calls.map(k => k.action);
  t("drejning: hent → læg det drejede ind → slet det gamle → hent listen igen (i den rækkefølge, så intet kan gå tabt)", handlinger.slice(0, 3).join() === "hent,upload,slet" && handlinger.at(-1) === "liste", handlinger.join());
  t("det gamle billede er væk, og det nye er der (listen har stadig to billeder)", srv.filer.length === 2 && !srv.filer.some(x => x.id === "g.jpg") && srv.filer.some(x => /^n/.test(x.id)));
  t("det rigtige billede og den rigtige vinkel sendes til drejningen, og uploaden er jpeg", srv.calls.find(k => k.action === "upload").type === "image/jpeg" && JSON.parse(srv.calls.find(k => k.action === "slet").body).id === "g.jpg" && /Billedet er drejet|Drejer/.test(el("biUploadInfo").textContent) === true);
  srv.calls.length = 0; srv.hentFejl = true; srv.filer = [{ id: "x.jpg", tid: 1, bytes: 1 }];
  await f.biDrej("x.jpg", 90, async () => ({}));
  t("kan billedet ikke hentes, sker der ingen upload og ingen sletning, og det forklares", !srv.calls.some(k => ["upload", "slet"].includes(k.action)) && /Kunne ikke dreje billedet: kunne ikke hente/.test(el("biUploadInfo").textContent) && srv.filer.length === 1);
  srv.hentFejl = false; srv.calls.length = 0; srv.afvis = true; srv.filer = [{ id: "y.jpg", tid: 1, bytes: 1 }];
  await f.biDrej("y.jpg", 270, async () => ({ size: 5 }));
  t("afviser serveren det drejede billede, slettes det gamle IKKE", !srv.calls.some(k => k.action === "slet") && srv.filer.some(x => x.id === "y.jpg") && /Kunne ikke dreje billedet: Kun jpg/.test(el("biUploadInfo").textContent));
  srv.afvis = null;
  t("er systemet i gang med noget andet (upload), gør en ny drejning intet", await (async () => { srv.calls.length = 0; const mine = new Function("$", "esc", "HEAD", code + "; bi.travl = true; return biDrej('z.jpg', 90, async () => ({}));")($, esc, {}); await mine; return srv.calls.filter(k => k.action === "hent").length === 0; })());
  // knapperne i miniaturerne
  const html = el("biGrid").innerHTML;
  t("hver miniature har to drej-knapper (mod uret = 270, med uret = 90) med forklarende tekster og billedets id", (html.match(/data-bi-drej="270"/g) || []).length === (html.match(/class="bi-tile"/g) || []).length && (html.match(/data-bi-drej="90"/g) || []).length === (html.match(/class="bi-tile"/g) || []).length && /aria-label="Drej billedet mod uret"/.test(html) && /aria-label="Drej billedet med uret"/.test(html) && /data-bi-id="/.test(html));
  srv.calls.length = 0; srv.filer = [{ id: "k.jpg", tid: 1, bytes: 1 }];
  await fire("biGrid", "click", { target: { closest: sel => sel === "[data-bi-drej]" ? { dataset: { biDrej: "90", biId: "k.jpg" } } : null } });
  t("et tryk på en drej-knap i gitteret starter drejningen af det billede (hentes først)", srv.calls[0] && srv.calls[0].action === "hent");
}
process.exit(T.every(Boolean)?0:1);
