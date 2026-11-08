import fs from "fs";
const ROD = new URL("../../", import.meta.url).pathname;
const T=[]; const t=(n,ok,x="")=>{T.push(ok);console.log(ok?"ok  ":"FEJL",n,ok?"":x)};
const kode = fs.readFileSync("/tmp/fd_block.js","utf8") + "; return { fdParse, erFdIDag, familieFd, alleFd, fodselsdageIDag, fdTekst, fdGirlande, fdKonfetti, fdOpdater, DANNEBROG, erSkudaar, intervaller };";
const mk = () => { const els = {}; const el = id => (els[id] ??= { id, innerHTML: "", textContent: "" }); return { els, el }; };
function bygg({ people, tema = true } = {}){
  const { els, el } = mk(); const klasser = new Set(); const intervaller = [];
  const document = { body: { classList: { toggle: (c, on) => { on ? klasser.add(c) : klasser.delete(c); } } } };
  const PEOPLE = people || [{ id: "alle", name: "Alle", color: "var(--p-alle)" }, { id: "anna", name: "Anna", color: "var(--p-1)", birthday: "14.03.1985" }, { id: "peter", name: "Peter", color: "var(--p-2)" },
    { id: "sofie", name: "Sofie", color: "var(--p-3)", birthday: "09.06.2015" }, { id: "emil", name: "Emil", color: "var(--p-4)", birthday: "29.02.2016" }, { id: "lise", name: "Lise", color: "var(--p-5)", birthday: "14.03" }];
  const cfg = tema ? { BIRTHDAY_THEME: true } : { BIRTHDAY_THEME: false };
  const a = new Function("$", "document", "cfg", "PEOPLE", "setInterval", kode.replace("intervaller }", "intervaller: () => 0 }"))(el, document, cfg, PEOPLE, (f, ms) => { intervaller.push(ms); return 0; });
  return { a, els, el, klasser, intervaller, PEOPLE };
}
const D = (y, m, d) => new Date(y, m - 1, d, 12);
let x = bygg(); const A = x.a;
t("fdParse: dd.mm og dd.mm.åååå, enkelte cifre og mellemrum", JSON.stringify(A.fdParse("14.03")) === '{"day":14,"month":3,"year":null}' && JSON.stringify(A.fdParse(" 9.6.2015 ")) === '{"day":9,"month":6,"year":2015}');
t("fdParse: ugyldigt giver null", ["", null, "32.01", "14.13", "14.03.85", "i går", "1985-03-14", "0.5", "14"].every(v => A.fdParse(v) === null));
t("erFdIDag: samme dag og måned, ikke dagen før eller efter, ikke samme dag i anden måned", A.erFdIDag({ day: 14, month: 3 }, D(2026, 3, 14)) && !A.erFdIDag({ day: 14, month: 3 }, D(2026, 3, 13)) && !A.erFdIDag({ day: 14, month: 3 }, D(2026, 3, 15)) && !A.erFdIDag({ day: 14, month: 3 }, D(2026, 4, 14)));
t("erFdIDag: 29. februar fejres 29. i skudår, og 28. februar i andre år (ikke 1. marts)", A.erFdIDag({ day: 29, month: 2 }, D(2028, 2, 29)) && !A.erFdIDag({ day: 29, month: 2 }, D(2028, 2, 28)) && A.erFdIDag({ day: 29, month: 2 }, D(2026, 2, 28)) && !A.erFdIDag({ day: 29, month: 2 }, D(2026, 3, 1)) && !A.erFdIDag({ day: 29, month: 2 }, D(2100, 3, 1)) && A.erFdIDag({ day: 29, month: 2 }, D(2100, 2, 28)) && A.erFdIDag({ day: 29, month: 2 }, D(2000, 2, 29)));
t("erSkudaar: 2000 ja, 1900 og 2100 nej, 2024 ja", A.erSkudaar(2000) && !A.erSkudaar(1900) && !A.erSkudaar(2100) && A.erSkudaar(2024) && !A.erSkudaar(2026));
t("familieFd: kun personer med gyldig fødselsdag, ikke «Alle»", A.familieFd(x.PEOPLE).map(f => f.name).join() === "Anna,Sofie,Emil,Lise" && A.familieFd(x.PEOPLE).every(f => f.familie === true) && A.familieFd([{ id: "x", name: "X", birthday: "ugyldig" }]).length === 0);
const egne = [{ name: "anna", day: 14, month: 3, year: 1985 }, { name: "Mormor", day: 1, month: 1, year: 1950 }, { name: "Peter", day: 2, month: 2 }];
const alle = A.alleFd(egne, A.familieFd(x.PEOPLE));
t("alleFd: egne + familiens, men ikke en dublet (samme navn uanset store/små og samme dato)", alle.filter(b => b.name.toLowerCase() === "anna").length === 1 && alle.some(b => b.name === "Mormor") && alle.some(b => b.name === "Sofie") && alle.length === 6, alle.map(b => b.name).join());
t("alleFd: samme navn på en anden dato er to forskellige fødselsdage", A.alleFd([{ name: "Anna", day: 1, month: 1 }], A.familieFd(x.PEOPLE)).filter(b => b.name === "Anna").length === 2);
t("alleFd uden egne giver familiens", A.alleFd(null, A.familieFd(x.PEOPLE)).length === 4 && A.alleFd([], []).length === 0);
let l = A.fodselsdageIDag(D(2026, 3, 14), x.PEOPLE);
t("fødselsdage i dag: to på samme dag (Anna fylder 41, Lise uden årstal)", JSON.stringify(l) === '[{"id":"anna","navn":"Anna","alder":41},{"id":"lise","navn":"Lise","alder":null}]', JSON.stringify(l));
t("ingen fødselsdag en tilfældig dag", A.fodselsdageIDag(D(2026, 5, 5), x.PEOPLE).length === 0);
t("29. februar-barn (født 2016) fylder 10 den 28. februar 2026", JSON.stringify(A.fodselsdageIDag(D(2026, 2, 28), x.PEOPLE)) === '[{"id":"emil","navn":"Emil","alder":10}]');
t("tekst: ét navn med alder", JSON.stringify(A.fdTekst([{ navn: "Anna", alder: 41 }])) === '{"tit":"Tillykke med fødselsdagen, Anna!","sub":"Anna fylder 41 i dag"}');
t("tekst: uden alder er der ingen undertekst", A.fdTekst([{ navn: "Lise", alder: null }]).sub === "" && A.fdTekst([{ navn: "Baby", alder: 0 }]).sub === "");
t("tekst: to og tre navne med «og» og komma", A.fdTekst([{ navn: "Anna", alder: 41 }, { navn: "Lise", alder: null }]).tit === "Tillykke med fødselsdagen, Anna og Lise!" && A.fdTekst([{ navn: "A", alder: 1 }, { navn: "B", alder: 2 }, { navn: "C", alder: null }]).tit === "Tillykke med fødselsdagen, A, B og C!" && A.fdTekst([{ navn: "A", alder: 1 }, { navn: "B", alder: 2 }]).sub === "A fylder 1 · B fylder 2");
t("tekst: ingen giver tomme tekster", JSON.stringify(A.fdTekst([])) === '{"tit":"","sub":""}');
t("Dannebrog: rød 37×28 med hvidt kors (lodret stribe fra x=12, vandret fra y=12, begge 4 brede)", /viewBox="0 0 37 28"/.test(A.DANNEBROG) && /<rect width="37" height="28" fill="#C8102E"\/>/.test(A.DANNEBROG) && /<rect x="12" width="4" height="28" fill="#fff"\/>/.test(A.DANNEBROG) && /<rect y="12" width="37" height="4" fill="#fff"\/>/.test(A.DANNEBROG) && /aria-label="Dannebrog"/.test(A.DANNEBROG));
t("guirlande: 28 flag, tre-kantede, i flere farver, inden for visningsfeltet", (() => { const g = A.fdGirlande(); const p = [...g.matchAll(/<polygon points="([^"]+)" fill="([^"]+)"/g)]; return p.length === 28 && new Set(p.map(m => m[2])).size === 3 && p.every(m => m[1].split(" ").length === 3) && A.fdGirlande(10).match(/<polygon/g).length === 10 && /viewBox="0 0 1200 34"/.test(g); })());
t("konfetti: 26 stykker, ens hver gang, og farver og tider er sat", A.fdKonfetti() === A.fdKonfetti() && (A.fdKonfetti().match(/<i /g) || []).length === 26 && /animation-duration:\d\.\ds/.test(A.fdKonfetti()) && A.fdKonfetti(5).match(/<i /g).length === 5);
// siden
x = bygg(); let r = x.a.fdOpdater(D(2026, 3, 14));
t("på en fødselsdag: klassen fd-dag sættes, teksten står i båndet, flag og guirlande tegnes", x.klasser.has("fd-dag") && r.length === 2 && x.el("fdTit").textContent === "Tillykke med fødselsdagen, Anna og Lise!" && /Anna fylder 41/.test(x.el("fdSub").textContent) && x.el("fdFlagV").innerHTML.includes("Dannebrog") && x.el("fdFlagH").innerHTML.includes("Dannebrog") && x.el("fdGirlande").innerHTML.includes("<polygon") && x.el("fdKonfetti").innerHTML.includes("<i "));
const guirlande1 = x.el("fdGirlande").innerHTML; x.a.fdOpdater(D(2026, 3, 14)); t("gentagne kald genbygger ikke guirlanden (ingen flimmer)", x.el("fdGirlande").innerHTML === guirlande1);
x.a.fdOpdater(D(2026, 3, 15));
t("dagen efter: klassen er væk, og alt i båndet er ryddet", !x.klasser.has("fd-dag") && x.el("fdTit").textContent === "" && x.el("fdGirlande").innerHTML === "" && x.el("fdKonfetti").innerHTML === "" && x.el("fdFlagV").innerHTML === "");
x.a.fdOpdater(D(2026, 6, 9)); t("og tilbage næste fødselsdag (Sofie fylder 11)", x.klasser.has("fd-dag") && /Sofie fylder 11/.test(x.el("fdSub").textContent));
x = bygg({ tema: false }); x.a.fdOpdater(D(2026, 3, 14)); t("tema slået fra (BIRTHDAY_THEME = false): ingen klasse, intet bånd", !x.klasser.has("fd-dag") && x.el("fdTit").textContent === "");
x = bygg({ people: [{ id: "alle", name: "Alle", color: "x" }, { id: "a", name: "A", color: "x" }] }); x.a.fdOpdater(D(2026, 3, 14)); t("ingen fødselsdage registreret: intet sker (også for installationer uden fødselsdage)", !x.klasser.has("fd-dag"));
t("opdateres hvert 5. minut (så temaet skifter ved midnat)", x.intervaller.includes(300000));
// statisk: siden
const h = fs.readFileSync(ROD + "public_html/overblik.html", "utf8");
t("båndet er første element i <body>", /<body>\s*<div class="fd-band" id="fdBand" role="status" aria-live="polite">/.test(h));
t("bevægelse slås fra ved «reducer bevægelse»", /prefers-reduced-motion:reduce\)\{\.fd-konfetti i,\.fd-flag svg\{animation:none\}\}/.test(h));
t("båndet er skjult, til klassen sættes (ingen flimmer ved indlæsning)", /\.fd-band\{display:none\}/.test(h) && /body\.fd-dag \.fd-band\{display:block/.test(h));
t("kommende fødselsdage i «Vigtigt snart» bruger egne + familiens, med kilden «Familie»", h.includes("for (const b of alleFd(birthdays))") && h.includes('kilde: b.familie ? "Familie" : "Egne fødselsdage"'));
process.exit(T.every(Boolean) ? 0 : 1);
