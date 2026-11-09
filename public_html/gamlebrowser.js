/* gamlebrowser.js: tjekker, om browseren kan det, siderne bruger, og viser ellers en besked i stedet for en blank side.
 *
 * KLASSISK script med gammel syntaks (ingen pile, let/const, skabelonstrenge, ?. eller async): det skal kunne køre i en browser, der IKKE kan det nye. Ændr det ikke til moderne JavaScript.
 * Siderne bruger JavaScript-moduler, ?., ?? og ??= (Chrome 85, Safari 14, Firefox 79 eller nyere). En ældre browser ignorerer eller fejler på hele siden uden at sige noget; dette script siger det.
 * Siden browser.html viser hele resultatet. Prøvet i tests/frontend/browser_test.mjs.
 */
(function (w) {
  "use strict";
  var PROEVER = [
    { id: "moduler", navn: "JavaScript-moduler", krav: "Chrome 61, Safari 11, Firefox 60", kritisk: true,
      test: function (e) { return "noModule" in e.d.createElement("script"); } },
    { id: "valgfri-kaede", navn: "Valgfri kæde (a?.b)", krav: "Chrome 80, Safari 13.1, Firefox 74", kritisk: true,
      test: function (e) { return syntaks(e, "var a = {}; return a?.b;"); } },
    { id: "nullish", navn: "Nullish (a ?? b)", krav: "Chrome 80, Safari 13.1, Firefox 72", kritisk: true,
      test: function (e) { return syntaks(e, "return null ?? 1;"); } },
    { id: "logisk-tildeling", navn: "Logisk tildeling (a ??= b)", krav: "Chrome 85, Safari 14, Firefox 79", kritisk: true,
      test: function (e) { return syntaks(e, "var a; a ??= 1; return a;"); } },
    { id: "dynamisk-import", navn: "Dynamisk import()", krav: "Chrome 63, Safari 11.1, Firefox 67", kritisk: true,
      test: function (e) { return syntaks(e, "return import('x');"); } },
    { id: "async", navn: "async / await", krav: "Chrome 55, Safari 11, Firefox 52", kritisk: true,
      test: function (e) { return syntaks(e, "return (async function () { await 1; });"); } },
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
  function syntaks(e, kode) { try { new e.Fn(kode); return true; } catch (x) { return false; } }
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
  /* Kører alle prøver. e = { w: window, d: document, Fn: Function } (så prøver kan bytte dem ud). */
  function koer(e) {
    e = e || { w: w, d: w.document, Fn: w.Function };
    var res = [], mangler = [], i, ok;
    for (i = 0; i < PROEVER.length; i++) {
      try { ok = !!PROEVER[i].test(e); } catch (x) { ok = false; }
      res.push({ id: PROEVER[i].id, navn: PROEVER[i].navn, krav: PROEVER[i].krav, ok: ok, kritisk: !!PROEVER[i].kritisk, valgfri: !!PROEVER[i].valgfri });
      if (!ok && PROEVER[i].kritisk) mangler.push(PROEVER[i].navn);
    }
    return { resultater: res, mangler: mangler, ok: mangler.length === 0, tilbage: res.filter(function (r) { return !r.ok && !r.kritisk && !r.valgfri; }).map(function (r) { return r.navn; }) };
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
    var v = version(ua), s = "Din browser" + (v ? " (" + v.navn + " " + v.nr + ")" : "") + " er for gammel til Familieoverblik. Det mangler: " + res.mangler.join(", ") + ". Opdatér browseren (Chrome 85, Safari 14 eller Firefox 79 og nyere) eller brug en anden.";
    return s;
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
    try { var r = koer(); if (!r.ok) visBesked(r); } catch (x) { /* en kontrol, der selv fejler, må aldrig ødelægge siden */ }
  }
})(window);
