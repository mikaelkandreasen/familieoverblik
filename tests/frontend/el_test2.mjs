import fs from "fs";
const ROD = new URL("../../", import.meta.url).pathname;
const code = fs.readFileSync("/tmp/el_block.js","utf8");
const els = {};
const $ = id => (els[id] ??= { hidden:true, innerHTML:"", textContent:"", attrs:{}, _cls:new Set(), classList:{ toggle(c, on){ on ? els[id]._cls.add(c) : els[id]._cls.delete(c); }, contains(c){ return els[id]._cls.has(c); } }, setAttribute(k, v){ this.attrs[k] = v; }, addEventListener(t, f){ (this.h ??= {})[t] = f; } });
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const fns = new Function("$","esc","HEAD", code + "; return { elBeregn, elDage, elTegn, setData:(d)=>{ elData = d; } };")($, esc, {});
const T=[]; const t=(n,ok,x="")=>{T.push(ok);console.log(ok?"ok  ":"FEJL",n,ok?"":x)};
const pad=n=>String(n).padStart(2,"0");
const L=(d,h,mi=0)=>`2026-11-${pad(d)}T${pad(h)}:${pad(mi)}`;

function pris(h, mi, off){ const x=h+mi/60; let p=2.9; if(x>=15&&x<20)p=4.0; else if(x>=2&&x<5)p=2.45; else if(x>=5&&x<9)p=3.3; else if(x<2)p=2.7; return Math.round((p+off*0.01)*10000)/10000; }
const kvartaler=(dage)=>{const o=[];for(const d of dage)for(let h=0;h<24;h++)for(const mi of [0,15,30,45])o.push({t:L(d,h,mi),p:pris(h,mi,d-5)});return o;};
const timer=(fraDag,tilDag,kindFor)=>{const o=[];for(let d=fraDag;d<=tilDag;d++)for(let h=0;h<24;h++){const k=kindFor(d);const e={t:L(d,h),p:pris(h,0,d-5)+0.003,k};if(k!=="actual"){e.min=e.p-0.3;e.max=e.p+0.3}o.push(e)}return o;};
const nu = new Date(2026,10,5,12,16);

// ── A: i dag faktisk, resten prognose (før kl. 13) ──
{
  const d={area:"DK1",vindueTimer:3,beskrivelse:"Børspris + tillæg, inkl. 25 % moms",points:kvartaler([5]),
    forecast:{generatedAt:"2026-11-04T12:20:00Z",stale:false,points:timer(5,14,dd=>dd===5?"actual":"model")}};
  const b=fns.elBeregn(d,nu);
  t("A: 96 pladser",b.serie.length===96,b.serie.length);
  t("A: første 48 faktiske, resten prognose",b.serie.slice(0,48).every(x=>!x.f)&&b.serie.slice(48).every(x=>x.f));
  t("A: harProgn, ikke harMorgen",b.harProgn===true&&b.harMorgen===false);
  t("A: billigste vindue ligger i prognosen (02-05 i morgen)",b.vindue.prognose===true&&new Date(b.vindue.fraMs).getHours()===2&&new Date(b.vindue.fraMs).getDate()===6);
  fns.setData(d); fns.elTegn(nu);
  const html=els.elKrop.innerHTML;
  t("A: 48 grå søjler",(html.match(/<i class="[^"]*\bf\b/g)||[]).length>=48 && (html.match(/<i class="f"/g)||[]).length+(html.match(/<i class="f v"/g)||[]).length===48,(html.match(/<i class="[^"]*\bf\b/g)||[]).length);
  t("A: note om prognose og kl. 13",/Grå søjler er prognose fra elpriser\.org\. Den kan ændre sig/.test(html));
  t("A: næste dage med 7 rækker",(html.match(/class="el-dag"/g)||[]).length===7,(html.match(/class="el-dag"/g)||[]).length);
  t("A: I morgen og Lør 7.",/I morgen/.test(html)&&/Lør 7\./.test(html),html.match(/el-dnavn">[^<]*/g));
  t("A: alle dage er prognose",(html.match(/el-dtype">Prognose</g)||[]).length===7);
  t("A: prognose lavet-tekst",/Prognosen er lavet/.test(html));
  t("A: beskrivelse med",/Børspris \+ tillæg, inkl\. 25 % moms\./.test(html));
}
// ── B: morgendagen er offentliggjort ──
{
  const d={area:"DK1",vindueTimer:3,points:kvartaler([5,6]),
    forecast:{generatedAt:"",stale:false,points:timer(5,14,dd=>dd<=6?"actual":"model")}};
  const b=fns.elBeregn(d,new Date(2026,10,5,14,5));
  t("B: ingen grå søjler i de 24 timer",b.harProgn===false&&b.harMorgen===true,b.serie.filter(x=>x.f).length);
  fns.setData(d); fns.elTegn(new Date(2026,10,5,14,5));
  const html=els.elKrop.innerHTML;
  t("B: ingen prognose-note",!/Grå søjler/.test(html)&&!/Morgendagens/.test(html));
  const dage=fns.elDage(d,new Date(2026,10,5,14,5));
  t("B: I morgen er Børspris, næste prognose",dage[0].type==="Børspris"&&dage[0].navn==="I morgen"&&dage[1].type==="Prognose"&&dage[2].type==="Prognose",JSON.stringify(dage.map(x=>x.type)));
  t("B: bjælker inden for 0-100 %",dage.every(x=>x.left>=0&&x.left+x.bredde<=100.0001),JSON.stringify(dage.map(x=>[x.left,x.bredde])));
  t("B: billigste time",dage.every(x=>x.billigstTime>=2&&x.billigstTime<5));
}
// ── C: kun prognose (børs mangler) og kind=actual regnes som faktisk ──
{
  const d={area:"DK1",vindueTimer:3,points:[],forecast:{points:timer(5,6,dd=>"actual")}};
  const b=fns.elBeregn(d,nu);
  t("C: kun time-prognose, 24 pladser à 1 time",b.serie.length===24&&b.step===3600000,`${b.serie.length} ${b.step}`);
  t("C: actual-kind er ikke grå",b.harProgn===false);
}
// ── D: ingen prognose-data ──
{
  const d={area:"DK1",vindueTimer:3,points:kvartaler([5]),forecast:null,forecastFejl:"nede"};
  fns.setData(d); fns.elTegn(nu);
  const html=els.elKrop.innerHTML;
  t("D: uden prognose: gammel note og ingen dage-sektion",/kommer omkring kl\. 13/.test(html)&&!/Næste dage/.test(html));
  t("D: 48 pladser (kun i dag)",fns.elBeregn(d,nu).serie.length===48);
}
// ── E: stale prognose ──
{
  const d={area:"DK1",vindueTimer:3,points:kvartaler([5]),forecast:{generatedAt:"",stale:true,points:timer(5,8,dd=>dd===5?"actual":"model")}};
  fns.setData(d); fns.elTegn(nu);
  t("E: stale-note",/Prognosen kunne ikke opdateres/.test(els.elKrop.innerHTML));
}
// ── F: HTML i tekst escapes ──
{
  const d={area:"DK1",vindueTimer:3,beskrivelse:"<b>x</b>",points:kvartaler([5]),forecast:null};
  fns.setData(d); fns.elTegn(nu);
  t("F: beskrivelse escapes",!/<b>x<\/b>/.test(els.elKrop.innerHTML)&&/&lt;b&gt;x&lt;\/b&gt;/.test(els.elKrop.innerHTML));
}
// ── «Kun søjler» ──
{
  const lager = {}; globalThis.localStorage = { getItem: k => (k in lager ? lager[k] : null), setItem: (k, v) => { lager[k] = v; } };
  const kort = els.elKort || $("elKort"), knap = $("elEnkelKnap");
  // koden læste localStorage ved indlæsning (tomt dengang); prøv nu selve skiftet
  knap.h.click();
  t("«Kun søjler»: klassen el-enkel sættes, knappen er nedtrykket og siger «Vis detaljer», og valget gemmes", kort.classList.contains("el-enkel") && knap.attrs["aria-pressed"] === "true" && knap.textContent === "Vis detaljer" && lager["familieoverblik-el-enkel"] === "1");
  knap.h.click();
  t("et tryk mere viser detaljerne igen (klassen væk, «Kun søjler», gemt som 0)", !kort.classList.contains("el-enkel") && knap.attrs["aria-pressed"] === "false" && knap.textContent === "Kun søjler" && lager["familieoverblik-el-enkel"] === "0");
  const src = fs.readFileSync(ROD + "public_html/overblik.html", "utf8");
  t("CSS: i enkel visning skjules alt i kortet undtagen søjlerne og tidsaksen", /#elKort\.el-enkel #elKrop>:not\(\.el-chart\):not\(\.el-akse\)\{display:none\}/.test(src));
  t("knappen sidder i kortets overskriftslinje og har en forklarende titel", /id="elEnkelKnap" aria-pressed="false" title="Skjul alt undtagen søjlediagrammet">Kun søjler</.test(src));
  // gemt valg ved indlæsning
  const lager2 = { "familieoverblik-el-enkel": "1" }; globalThis.localStorage = { getItem: k => lager2[k] ?? null, setItem(){} };
  const els2 = {}; const $2 = id => (els2[id] ??= { hidden: true, innerHTML: "", textContent: "", attrs: {}, _cls: new Set(), classList: { toggle(c, on){ on ? els2[id]._cls.add(c) : els2[id]._cls.delete(c); }, contains(c){ return els2[id]._cls.has(c); } }, setAttribute(k, v){ this.attrs[k] = v; }, addEventListener(){} });
  new Function("$", "esc", "HEAD", code)($2, esc, {});
  t("et gemt valg huskes ved næste indlæsning (kortet er allerede i enkel visning)", els2.elKort._cls.has("el-enkel") && els2.elEnkelKnap.textContent === "Vis detaljer");
  delete globalThis.localStorage;
  const els3 = {}; const $3 = id => (els3[id] ??= { attrs: {}, _cls: new Set(), classList: { toggle(){}, contains(){ return false; } }, setAttribute(){}, addEventListener(){} });
  let fejl = null; try { new Function("$", "esc", "HEAD", code)($3, esc, {}); } catch (e) { fejl = e; }
  t("uden localStorage (privat tilstand) går indlæsningen stadig godt", fejl === null, String(fejl));
}
process.exit(T.every(Boolean)?0:1);
