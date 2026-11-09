import fs from "fs";
const T=[]; const t=(n,ok,x="")=>{T.push(ok);console.log(ok?"ok  ":"FEJL",n,ok?"":x)};
const tick = () => new Promise(r => setImmediate(r));
const K = new Function(fs.readFileSync("/tmp/dag_block.js", "utf8") + "; return { dagForsk, dagTekster, dagInit, DAG_ORD, DAG_NULSTIL_MS, DAG_MIN, DAG_MAX };")();
const DAGE = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"], MD = ["januar", "februar", "marts", "april", "maj", "juni", "juli", "august", "september", "oktober", "november", "december"];
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
t("forskydningen holdes mellem −2 og +2: 0, 1, −1, 2, −2 uændret; 9 og −9 klippes; 1,7 og −1,7 rundes mod nul; tekst, uendelig og skrald giver 0", [[0, 0], [1, 1], [-1, -1], [2, 2], [-2, -2], [9, 2], [-9, -2], [1.7, 1], [-1.7, -1], ["1", 1], ["-2", -2], ["abc", 0], [null, 0], [undefined, 0], [NaN, 0], [Infinity, 0], [-Infinity, 0], [{}, 0]].every(([i, u]) => K.dagForsk(i) === u), [[null, K.dagForsk(null)], [Infinity, K.dagForsk(Infinity)]]);
t("grænserne er to dage tilbage og to frem", K.DAG_MIN === -2 && K.DAG_MAX === 2);
const onsdag = new Date(2026, 10, 11);                    // onsdag 11. november 2026
t("overskrifterne: I forgårs, I går, I dag, I morgen, I overmorgen", [-2, -1, 0, 1, 2].map(f => K.dagTekster(f, onsdag, DAGE, MD).titel).join("|") === "I forgårs|I går|I dag|I morgen|I overmorgen");
const dtx = (f, d) => K.dagTekster(f, d, DAGE, MD).dato;
t("datolinjen er ugedag og dato for den valgte dag: den, der vises, er forskudt fra i dag (her: kortet viser onsdag 11. nov., så «I morgen» skal sendes med torsdag 12. nov.)", dtx(1, new Date(2026, 10, 12)) === "Torsdag 12. november" && dtx(-2, new Date(2026, 10, 9)) === "Mandag 9. november" && dtx(2, new Date(2027, 0, 1)) === "Fredag 1. januar" && dtx(0, onsdag) === "");
// opstarten med falske elementer
function bygDom(){
  const lyt = {}, els = { dagValg: { addEventListener(t, f){ (lyt[t] ??= []).push(f); } } }, stat = { fors: 0 }, kald = { tegn: 0, sikr: [], timere: [], ryddet: 0 };
  const sikrSvar = { v: true };
  const api = K.dagInit({ $: id => els[id], stat, tegn: () => { kald.tegn++; }, sikr: d => { kald.sikr.push(d); return sikrSvar.v instanceof Error ? Promise.reject(sikrSvar.v) : Promise.resolve(sikrSvar.v); }, idag: () => new Date(2026, 10, 9), addDays,
    setT: (f, ms) => { kald.timere.push({ f, ms }); return kald.timere.length; }, clearT: () => { kald.ryddet++; } });
  const klik = v => lyt.click[0]({ target: { closest: s => (s === "[data-dagfors]" && v !== null ? { dataset: { dagfors: v } } : null) } });
  return { stat, kald, klik, sikrSvar, api };
}
let D = bygDom();
D.klik("-1"); await tick();
t("et tryk på «I går» sætter forskydningen til −1, tegner med det samme, og beder om data for den dag (mandag 9. nov. − 1 = søndag 8. nov.)", D.stat.fors === -1 && D.kald.tegn >= 1 && D.kald.sikr.length === 1 && D.kald.sikr[0].getDate() === 8 && D.kald.sikr[0].getMonth() === 10, D.kald.sikr);
t("kommer der nye data (sikr giver sand), tegnes der igen; ellers ikke", D.kald.tegn === 2 && (() => { D.sikrSvar.v = false; return true; })());
D.klik("2"); await tick();
t("kommer der ingen nye data (sikr giver falsk), tegnes der kun én gang pr. tryk", D.stat.fors === 2 && D.kald.tegn === 3, D.kald.tegn);
t("en anden dag end i dag starter en tidsgrænse på to minutter, og den gamle ryddes, når man trykker igen", D.kald.timere.length === 2 && D.kald.timere.every(x => x.ms === 120000) && D.kald.ryddet === 2);
D.kald.timere.at(-1).f(); await tick();
t("når tidsgrænsen udløber, nulstilles kortet til i dag (forskydning 0), og det tegnes", D.stat.fors === 0 && D.kald.tegn === 4 && D.kald.timere.length === 2);
D.klik("0"); await tick();
t("et tryk på «I dag» sætter ingen tidsgrænse (der er intet at nulstille)", D.stat.fors === 0 && D.kald.timere.length === 2);
for (const [v, forv] of [["abc", 0], ["9", 2], ["-9", -2], ["", 0]]) { D.klik(v); await tick(); t(`en ugyldig værdi («${v}») bliver ${forv}, aldrig noget andet`, D.stat.fors === forv, D.stat.fors); }
const n1 = D.kald.tegn; D.klik(null);
t("et klik uden for knapperne gør ingenting", D.kald.tegn === n1);
D = bygDom(); D.sikrSvar.v = new Error("net nede");
t("svigter hentningen (nettet er nede), går det ikke galt: kortet er tegnet, og der kommer ingen fejl", await (async () => { try { D.klik("-2"); await tick(); await tick(); return D.stat.fors === -2 && D.kald.tegn === 1; } catch (e) { return false; } })());
// siden
const ov = fs.readFileSync(import.meta.dirname + "/../../public_html/overblik.html", "utf8");
t("kortet har fem knapper (Forgårs, I går, I dag, I morgen, Overmorgen) i den rigtige rækkefølge, en overskrift og en datolinje, og «I dag» er valgt som standard", /<section class="today" id="idagKort">\s*<h2 class="serif" id="idagTitel">I dag<\/h2>\s*<div class="dag-dato" id="idagDato" hidden><\/div>\s*<div class="dag-valg" id="dagValg" role="group" aria-label="Vælg dag">\s*<button type="button" data-dagfors="-2" aria-pressed="false">Forgårs<\/button>\s*<button type="button" data-dagfors="-1" aria-pressed="false">I går<\/button>\s*<button type="button" data-dagfors="0" aria-pressed="true">I dag<\/button>\s*<button type="button" data-dagfors="1" aria-pressed="false">I morgen<\/button>\s*<button type="button" data-dagfors="2" aria-pressed="false">Overmorgen<\/button>/.test(ov));
const a = ov.indexOf("const idagDato = addDays(today, DAGSTAT.fors);"), b = ov.indexOf("  // I morgen\n", a), blok = ov.slice(a, b);
t("hele «I dag»-kortet bruger den valgte dag: kalender, skole, fritid og huskepunkter læser fra idagDato og ikke fra today", a > 0 && b > a && ["apptsOn(idagDato)", "aulaOf(idagDato).school[dayIdx(idagDato)]", "skemaDag(aulaOf(idagDato), dayIdx(idagDato), s.child)", "leisureOn(idagDato)", 'remindersOn(idagDato, "husk")'].every(x => blok.includes(x)) && !/(apptsOn|aulaOf|dayIdx|leisureOn|remindersOn)\(today\b/.test(blok), blok.match(/(apptsOn|aulaOf|dayIdx|leisureOn|remindersOn)\(today\b/g));
t("«Vigtigt snart» og resten af siden er stadig udregnet fra i dag (vigt bruger today, soon er days > 0), og dagen i kortet bruger en egen udregning for andre dage", blok.includes("const vigt = vigtigtListe({ fd: alleFd(birthdays), affald: affaldPaaminde(), important, today, soonDays: SOON_DAYS,") && ov.includes("const soon = vigt.filter(x => x.days > 0);") && blok.includes("today: idagDato") && blok.includes("AFF.paaDag(affald, ymd(idagDato))") && blok.includes("dagOrd: DAG_ORD[DAGSTAT.fors]"));
t("knapperne viser, hvilken dag der er valgt (aria-pressed), kortet får en stiplet kant på en anden dag end i dag, og overskriften og datoen skrives", blok.includes('setAttribute("aria-pressed", String(Number(b.dataset.dagfors) === DAGSTAT.fors))') && blok.includes('classList.toggle("anden-dag", DAGSTAT.fors !== 0)') && blok.includes('$("idagTitel").textContent = dt.titel;') && /\.today\.anden-dag\{outline:2px dashed/.test(ov));
t("en tom fritid på en anden dag siger «Ingen fritidsaktiviteter» (ikke «næste …» ud fra i dag)", blok.includes('DAGSTAT.fors === 0 ? naesteFritid() : "Ingen fritidsaktiviteter"'));
t("et nyt døgn sætter kortet tilbage til i dag og rydder de hentede uger; ugeskifte rydder gamle uger, men bevarer forrige uge", ov.includes("DAGSTAT.fors = 0;                                // et nyt døgn: tilbage til i dag") && ov.includes("forrigeHentet.clear(); ryddGamleUger();") && ov.includes("isoWeek(addDays(monday, -7)).id]);"));
t("data for en uge uden for de tre faste (forrige uge) hentes, første gang man trykker sig dertil: planner, aula og ics, kun én gang, og en fejl giver ikke en blivende markering", ov.includes("if (id === wk.id || id === nextWk.id || id === nextWk2.id || forrigeHentet.has(id)) return false;") && ov.includes("const liste = [`planner/${id}`, `aula/${id}`, `ics/${id}`];") && ov.includes("forrigeHentet.delete(id);") && ov.includes("dagInit({ $, stat: DAGSTAT, tegn: () => { if (redigerer === null) draw(); }, sikr: sikrUge, idag: () => today, addDays });"));
t("serverens stier er allerede tilladt for en vilkårlig uge (store.php), så en hentning af forrige uge ikke afvises (400)", /ics|aula|planner/.test(fs.readFileSync(import.meta.dirname + "/../../ugeplan-lib/store.php", "utf8")) && fs.readFileSync(import.meta.dirname + "/../../ugeplan-lib/store.php", "utf8").includes("\\d{4}-W\\d{2}"));
process.exit(T.every(Boolean) ? 0 : 1);
