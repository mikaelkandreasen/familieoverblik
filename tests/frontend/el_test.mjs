import fs from "fs";
const code = fs.readFileSync("/tmp/el_block.js","utf8");
const els = {};
const $ = id => (els[id] ??= { hidden:true, innerHTML:"", textContent:"", attrs:{}, _cls:new Set(), classList:{ toggle(c, on){ on ? els[id]._cls.add(c) : els[id]._cls.delete(c); }, contains(c){ return els[id]._cls.has(c); } }, setAttribute(k, v){ this.attrs[k] = v; }, addEventListener(t, f){ (this.h ??= {})[t] = f; } });
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const HEAD = {};
const fns = new Function("$","esc","HEAD", code + "; return { elBeregn, elTegn, setData:(d)=>{ elData = d; }, els:()=>els };")($, esc, HEAD);

const T = []; const t = (n, ok, extra="") => { T.push(ok); console.log(ok ? "ok  " : "FEJL", n, ok ? "" : extra); };
const pad = n => String(n).padStart(2,"0");
const lokal = (y,m,d,h,mi) => `${y}-${pad(m)}-${pad(d)}T${pad(h)}:${pad(mi)}`;

// kunstige kvartalspriser 5.-6. nov, form som i skærmbilledet: dyrt 15-20, billigt 02-05
function pris(dagOffset, h, mi){
  const x = h + mi/60;
  let p = 2.9;
  if (x >= 15 && x < 20) p = 4.0 + 0.2*Math.sin((x-15)/5*Math.PI);
  else if (x >= 2 && x < 5) p = 2.45;
  else if (x >= 5 && x < 9) p = 3.3;
  else if (x < 2) p = 2.7;
  return Math.round((p + dagOffset*0.01 + mi*0.0001)*10000)/10000;
}
function bygPunkter(dage){
  const out=[];
  for (let d=0; d<dage; d++) for (let h=0; h<24; h++) for (const mi of [0,15,30,45])
    out.push({ t: lokal(2026,11,5+d,h,mi), p: pris(d,h,mi) });
  return out;
}
const nu = new Date(2026,10,5,12,16);

// ── 1. med morgendagen ──
{
  const d = { area:"DK1", vindueTimer:3, points: bygPunkter(2), beskrivelse:"Børspris, inkl. moms", stale:false };
  const b = fns.elBeregn(d, nu);
  t("24 timer = 96 kvarter", b.serie.length === 96, b.serie.length);
  t("starter ved hel time (12:00)", new Date(b.serie[0].ms).getHours() === 12 && new Date(b.serie[0].ms).getMinutes() === 0);
  t("nuværende kvarter er idx 1", b.idxNu === 1, b.idxNu);
  const ps = b.serie.map(x=>x.p);
  t("min/max/gns passer", Math.abs(b.min.p-Math.min(...ps))<1e-9 && Math.abs(b.max.p-Math.max(...ps))<1e-9 && Math.abs(b.gns-ps.reduce((a,c)=>a+c,0)/ps.length)<1e-9);
  // brute force
  const n = 12; let best=Infinity, bi=-1;
  for (let i=1;i+n<=ps.length;i++){ const s=ps.slice(i,i+n).reduce((a,c)=>a+c,0); if (s<best-1e-9){best=s;bi=i;} }
  t("billigste vindue = brute force", b.vindue.fra === bi && Math.abs(b.vindue.gns-best/n)<1e-9, `${b.vindue.fra} vs ${bi}`);
  const h0 = new Date(b.vindue.fraMs), h1 = new Date(b.vindue.tilMs);
  t("vindue 02.00–05.00 næste dag", h0.getHours()===2 && h0.getDate()===6 && h1.getHours()===5, `${h0} ${h1}`);
  t("har morgendagens priser", b.harMorgen === true);
  fns.setData(d); fns.elTegn(nu);
  const html = els.elKrop.innerHTML;
  t("kortet vises", els.elKort.hidden === false);
  t("tre nøgletal", /Laveste/.test(html) && /Højeste/.test(html) && /Gennemsnit/.test(html));
  t("dansk talformat", /2,4\d kr\./.test(html), html.slice(0,200));
  t("vindue vist", /Billigste 3 timer/.test(html) && /02\.00 – 05\.00/.test(html));
  t("96 søjler", (html.match(/<i[ >]/g)||[]).length === 96);
  t("12 teal-søjler", (html.match(/<i class="[^"]*\bv\b/g)||[]).length === 12);
  t("én aktuel søjle", (html.match(/<i class="[^"]*\bnu\b/g)||[]).length === 1);
  t("akse 12,15,…", /left:0\.00%">12</.test(html) && />15</.test(html) && />00</.test(html));
  t("ingen morgen-note", !/Morgendagens/.test(html));
}

// ── 2. kun i dag (før kl. 13) ──
{
  const d = { area:"DK1", vindueTimer:3, points: bygPunkter(1), stale:true };
  fns.setData(d); fns.elTegn(nu);
  const html = els.elKrop.innerHTML;
  t("note: morgendagens priser kl. 13", /kommer omkring kl\. 13/.test(html));
  t("note: stale", /kunne ikke opdateres/.test(html));
  const b = fns.elBeregn(d, nu);
  t("kun resten af dagen (12 timer)", b.serie.length === 48, b.serie.length);
  t("vindue findes stadig (02-05 ligger ikke i dag)", b.vindue !== null && new Date(b.vindue.fraMs).getHours() !== 2);
  const sen = fns.elBeregn(d, new Date(2026,10,5,15,5));
  fns.elTegn(new Date(2026,10,5,15,5));
  t("efter 13: ikke udkommet endnu", /ikke udkommet endnu/.test(els.elKrop.innerHTML));
}

// ── 3. timepriser og tomme data ──
{
  const pts=[]; for (let h=0;h<48;h++){ const d=5+Math.floor(h/24); pts.push({t:lokal(2026,11,d,h%24,0), p:1+((h*7)%10)/10}); }
  const b = fns.elBeregn({points:pts,vindueTimer:2}, new Date(2026,10,5,9,30));
  t("timepriser: 24 søjler, idx 0", b.serie.length===24 && b.idxNu===0, `${b.serie.length} ${b.idxNu}`);
  t("timepriser: vindue 2 timer = 2 punkter", b.vindue.til-b.vindue.fra===2);
  t("tom liste giver null", fns.elBeregn({points:[]}, nu) === null);
  fns.setData({points:[]}); fns.elTegn(nu);
  t("tom liste skjuler kortet", els.elKort.hidden === true);
  const neg = fns.elBeregn({points:[{t:lokal(2026,11,5,12,0),p:-0.2},{t:lokal(2026,11,5,13,0),p:0.5},{t:lokal(2026,11,5,14,0),p:0.1}],vindueTimer:1}, new Date(2026,10,5,12,10));
  t("negative priser håndteres", neg.min.p === -0.2 && neg.vindue.gns <= 0.5);
}
process.exit(T.every(Boolean)?0:1);
