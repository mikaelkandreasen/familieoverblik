/* gamlebrowser.js: tjekker, om browseren kan det, siderne bruger, og viser ellers en besked i stedet for en blank side.
 *
 * KLASSISK script med gammel syntaks (ingen pile, let/const, skabelonstrenge, ?. eller async): det skal kunne køre i en browser, der IKKE kan det nye. Ændr det ikke til moderne JavaScript.
 * Ny syntaks prøves IKKE med new Function eller eval: serverens indholdssikkerhedsregel (CSP) forbyder det, og det gav «mangler» i alle moderne browsere (fejl i 3.11.0 til 3.13.0).
 * I stedet hentes små prøvefiler (syntaks/*.js), hver med ét stykke ny syntaks, som almindelige scripts. Kan browseren ikke læse en fil, kører intet i den, og dens flag bliver ikke sat.
 * En kontrolfil (syntaks/styr.js, gammel syntaks) viser, at hentningen virker: sættes dens flag ikke (offline, blokeret), er prøverne «ukendte» og tæller ikke som fejl.
 * Siderne bruger JavaScript-moduler, ?., ?? og ??= (Chrome 85, Safari 14, Firefox 79 eller nyere). Siden browser.html viser hele resultatet. Prøvet i tests/frontend/browser_test.mjs.
 */
(function (w) {
  "use strict";
  var KONTROL = "syntaks/styr.js";
  var PROEVER = [
    { id: "moduler", navn: "JavaScript-moduler", krav: "Chrome 61, Safari 11, Firefox 60", kritisk: true,
      test: function (e) { return "noModule" in e.d.createElement("script"); } },
    { id: "valgfri-kaede", navn: "Valgfri kæde (a?.b)", krav: "Chrome 80, Safari 13.1, Firefox 74", kritisk: true, fil: "syntaks/valgfri.js" },
    { id: "nullish", navn: "Nullish (a ?? b)", krav: "Chrome 80, Safari 13.1, Firefox 72", kritisk: true, fil: "syntaks/nullish.js" },
    { id: "logisk-tildeling", navn: "Logisk tildeling (a ??= b)", krav: "Chrome 85, Safari 14, Firefox 79", kritisk: true, fil: "syntaks/tildeling.js" },
    { id: "dynamisk-import", navn: "Dynamisk import()", krav: "Chrome 63, Safari 11.1, Firefox 67", kritisk: true, fil: "syntaks/import.js" },
    { id: "async", navn: "async / await", krav: "Chrome 55, Safari 11, Firefox 52", kritisk: true, fil: "syntaks/async.js" },
    { id: "fetch", navn: "fetch og Promise", krav: "Chrome 42, Safari 10.1, Firefox 39", kritisk: true,
      test: function (e) { return typeof e.w.fetch === "function" && typeof e.w.Promise === "function"; } },
    { id: "css-variabler", navn: "CSS-variabler", krav: "Chrome 49, Safari 9.1, Firefox 31", kritisk: true,
      test: function (e) { return !!(e.w.CSS && e.w.CSS.supports && e.w.CSS.supports("--a", "0")); } },
    { id: "grid", navn: "CSS grid", krav: "Chrome 57, Safari 10.1, Firefox 52", kritisk: true,
      test: function (e) { return !!(e.w.CSS && e.w.CSS.supports && e.w.CSS.supports("display", "grid")); } },
    { id: "flex-gap", navn: "Mellemrum i fleksible rækker (gap)", krav: "Chrome 84, Safari 14.1, Firefox 63", kritisk: false,
      test: function (e) { return flexGap(e); } },
    { id: "inset", navn: "CSS inset", krav: "Chrome 87, Safari 14.1, Firefox 66", kritisk: false,
      test: function (e) { return !!(e.w.CSS && e.w.CSS.supports && e.w.CSS.supports("inset", "0")); } },
    { id: "aspect-ratio", navn: "CSS aspect-ratio", krav: "Chrome 88, Safari 15, Firefox 89", kritisk: false,
      test: function (e) { return !!(e.w.CSS && e.w.CSS.supports && e.w.CSS.supports("aspect-ratio", "1 / 1")); } },
    { id: "lager", navn: "Lager i browseren (localStorage)", krav: "alle nyere", kritisk: false,
      test: function (e) { try { e.w.localStorage.setItem("fo-test", "1"); e.w.localStorage.removeItem("fo-test"); return true; } catch (x) { return false; } } },
    { id: "tidszone", navn: "Tidszoner (Intl)", krav: "Chrome 24, Safari 10, Firefox 52", kritisk: false,
      test: function (e) { try { return !!new e.w.Intl.DateTimeFormat("da-DK", { timeZone: "Europe/Copenhagen" }).format(new Date()); } catch (x) { return false; } } },
    { id: "fuldskaerm", navn: "Fuld skærm", krav: "Chrome 71 (eller præfikset), ikke iPhone", kritisk: false, valgfri: true,
      test: function (e) { var h = e.d.documentElement; return !!(h && (h.requestFullscreen || h.webkitRequestFullscreen)); } },
    { id: "serviceworker", navn: "Service worker (virker uden net)", krav: "Chrome 45, Safari 11.1, Firefox 44", kritisk: false, valgfri: true,
      test: function (e) { return !!(e.w.navigator && "serviceWorker" in e.w.navigator); } }
  ];
  /* Fleksibel række med gap: to børn uden højde i en kolonne med 1 px række-mellemrum fylder 1 px, hvis gap virker. */
  function flexGap(e) {
    try {
      var d = e.d, f = d.createElement("div");
      f.style.cssText = "display:flex;flex-direction:column;row-gap:1px;position:absolute;visibility:hidden";
      f.appendChild(d.createElement("div")); f.appendChild(d.createElement("div"));
      d.body.appendChild(f);
      var ok = f.scrollHeight === 1;
      d.body.removeChild(f);
      return ok;
    } catch (x) { return false; }
  }
  /* Henter kontrolfilen og alle syntaksprøverne som scripts. Kalder faerdig(flag), når alle er hentet (eller fejlet): flag er objektet med de sæt flag, eller null, hvis kontrollen ikke kørte (så ved vi intet). */
  function proevSyntaks(e, faerdig) {
    var filer = [KONTROL], i, igen = false, tid = null;
    for (i = 0; i < PROEVER.length; i++) if (PROEVER[i].fil) filer.push(PROEVER[i].fil);
    e.w.FO_SYNTAKS = {};
    var rest = filer.length;
    function slut() {
      if (igen) return;
      igen = true;
      if (tid && e.w.clearTimeout) e.w.clearTimeout(tid);
      faerdig(e.w.FO_SYNTAKS && e.w.FO_SYNTAKS.styr === true ? e.w.FO_SYNTAKS : null);
    }
    function klar() { rest -= 1; if (rest <= 0) slut(); }
    var vaert = e.d.head || e.d.documentElement;
    if (!vaert) { faerdig(null); return; }
    for (i = 0; i < filer.length; i++) {
      var s = e.d.createElement("script");
      s.onload = klar; s.onerror = klar;
      s.src = filer[i];
      vaert.appendChild(s);
    }
    if (e.w.setTimeout) tid = e.w.setTimeout(slut, 8000);               // et net, der hænger, må ikke gøre kontrollen evig
  }
  /* Kører alle prøver. e = { w: window, d: document } (så prøver kan bytte dem ud). faerdig(resultat) kaldes, når alt er prøvet (syntaksprøverne henter filer, så det tager et øjeblik).
   * Hver prøve: ok sand, falsk, eller null (ukendt: prøvefilerne kunne ikke hentes). Kun «falsk» på en kritisk prøve tæller som en mangel. */
  function koer(e, faerdig) {
    e = e || { w: w, d: w.document };
    var res = [], i, p, ok;
    for (i = 0; i < PROEVER.length; i++) {
      p = PROEVER[i];
      if (p.fil) { ok = null; } else { try { ok = !!p.test(e); } catch (x) { ok = false; } }
      res.push({ id: p.id, navn: p.navn, krav: p.krav, ok: ok, kritisk: !!p.kritisk, valgfri: !!p.valgfri });
    }
    function samlet() {
      var mangler = [], ukendt = [], tilbage = [], j;
      for (j = 0; j < res.length; j++) {
        if (res[j].ok === null) ukendt.push(res[j].navn);
        else if (!res[j].ok && res[j].kritisk) mangler.push(res[j].navn);
        else if (!res[j].ok && !res[j].valgfri) tilbage.push(res[j].navn);
      }
      return { resultater: res, mangler: mangler, ukendt: ukendt, tilbage: tilbage, ok: mangler.length === 0 };
    }
    proevSyntaks(e, function (flag) {
      var j;
      for (j = 0; j < res.length; j++) if (PROEVER[j].fil) res[j].ok = flag === null ? null : (flag[PROEVER[j].id] === true);
      faerdig(samlet());
    });
  }
  /* Browser og version ud af user agent: { navn, nr } eller null. Brave og Chrome på iPhone er Safari indeni, så de vises som iPhone-browsere. */
  function version(ua) {
    ua = String(ua || "");
    var m;
    if ((m = /(?:CriOS|FxiOS|EdgiOS)\/(\d+)/.exec(ua))) return { navn: "iPhone-browser (Safari-motor)", nr: parseInt(m[1], 10) };
    if ((m = /SamsungBrowser\/(\d+)/.exec(ua))) return { navn: "Samsung Internet", nr: parseInt(m[1], 10) };
    if ((m = /Edg(?:e|A)?\/(\d+)/.exec(ua))) return { navn: "Edge", nr: parseInt(m[1], 10) };
    if ((m = /Firefox\/(\d+)/.exec(ua))) return { navn: "Firefox", nr: parseInt(m[1], 10) };
    if ((m = /Chrome\/(\d+)/.exec(ua))) return { navn: "Chrome", nr: parseInt(m[1], 10) };
    if ((m = /Version\/(\d+(?:\.\d+)?).*Safari/.exec(ua))) return { navn: "Safari", nr: parseFloat(m[1]) };
    return null;
  }
  function tekst(res, ua) {
    var v = version(ua);
    return "Din browser" + (v ? " (" + v.navn + " " + v.nr + ")" : "") + " er for gammel til Familieoverblik. Det mangler: " + res.mangler.join(", ") + ". Opdatér browseren (Chrome 85, Safari 14 eller Firefox 79 og nyere) eller brug en anden.";
  }
  /* Viser en besked øverst på siden. Rører ikke ved resten af siden. */
  function visBesked(res, e) {
    e = e || { w: w, d: w.document };
    var d = e.d;
    function laeg() {
      if (!d.body || d.getElementById("fo-gammel-browser")) return;
      var b = d.createElement("div");
      b.id = "fo-gammel-browser";
      b.setAttribute("role", "alert");
      b.style.cssText = "position:fixed;left:0;right:0;top:0;z-index:99999;padding:14px 16px;background:#b3261e;color:#fff;font:16px/1.4 sans-serif;text-align:center";
      b.appendChild(d.createTextNode(tekst(res, e.w.navigator && e.w.navigator.userAgent) + " "));
      var a = d.createElement("a");
      a.href = "browser.html"; a.style.color = "#fff"; a.appendChild(d.createTextNode("Se hvad der mangler"));
      b.appendChild(a);
      d.body.insertBefore(b, d.body.firstChild);
    }
    if (d.body) laeg(); else d.addEventListener("DOMContentLoaded", laeg);
  }
  w.FO_BROWSER = { proever: PROEVER, koer: koer, version: version, tekst: tekst, visBesked: visBesked };
  if (!w.FO_BROWSER_STILLE) {
    try { koer(null, function (r) { if (!r.ok) visBesked(r); }); } catch (x) { /* en kontrol, der selv fejler, må aldrig ødelægge siden */ }
  }
})(window);
