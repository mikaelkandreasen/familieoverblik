/* sidemenu.js: menuen «Sider ▾» på alle sider (forsiden har sin egen i bundlinjen).
 * Et klassisk script, der sætter en knap med en rullemenu ind i sidens overskrift (header, eller .bar-r1 på opsætningssiden).
 * Punkterne ligger her ét sted. Ændringslog og Tokyo-linket står kun på forsiden (en dialog og et link ud af huset).
 * Prøvet i tests/frontend/sidemenu_test.mjs. */
(function (w) {
  "use strict";
  var PUNKTER = [
    ["overblik.html", "Oversigt"],
    ["index.html#mad", "Madplan"],
    ["index.html#ops", "Opsætning"],
    ["gaest-wifi.html", "Gæste-wifi (QR-kode)"],
    ["vaelger.html", "Tilfældig vælger (spinner)"],
    ["backlog.html", "Backlog (idéer og ønsker)"],
    ["billeder.html", "Tilføj billeder"],
    ["browser.html", "Browser-tjek"]
  ];
  var CSS = ".fo-sider{position:relative;margin-left:auto;flex:none}" +
    ".fo-sider-knap{font:inherit;font-size:13px;min-height:36px;padding:0 12px;border:1px solid var(--rule,#d8d6cc);border-radius:var(--radius,8px);background:var(--card,#fff);color:var(--ink,#1c2b2a);cursor:pointer}" +
    ".fo-sider-liste{position:absolute;top:calc(100% + 6px);right:0;z-index:2500;min-width:240px;background:var(--card,#fff);color:var(--ink,#1c2b2a);border:1px solid var(--rule,#d8d6cc);border-radius:var(--radius,8px);box-shadow:0 8px 24px rgba(0,0,0,.18);padding:4px}" +
    ".fo-sider-liste[hidden]{display:none}" +
    ".fo-sider-liste a{display:block;min-height:44px;padding:11px 12px;color:inherit;text-decoration:none;font-size:14px;border-radius:6px}" +
    ".fo-sider-liste a:hover,.fo-sider-liste a:focus-visible{background:var(--tint-blue,#e8eef6);outline:none}" +
    ".fo-sider-liste a[aria-current=page]{font-weight:700}";
  /* Filnavnet på en adresse uden mappe og anker: «/a/backlog.html#x» → «backlog.html». */
  function fil(sti) { var s = String(sti || "").split("#")[0].split("?")[0].split("/").pop(); return s || "index.html"; }
  /* Sætter menuen ind. env = { d: document, sti: location.pathname } (så prøver kan bytte dem ud). Returnerer menuens element, eller null hvis siden ingen overskrift har. */
  function monter(env) {
    env = env || { d: w.document, sti: w.location && w.location.pathname };
    var d = env.d;
    if (!d || d.getElementById("fo-sider")) return null;
    var vaert = d.querySelector(".bar-r1") || d.querySelector("header");
    if (!vaert) return null;
    if (!d.getElementById("fo-sider-css")) {
      var st = d.createElement("style"); st.id = "fo-sider-css"; st.appendChild(d.createTextNode(CSS));
      (d.head || d.documentElement).appendChild(st);
    }
    var boks = d.createElement("div"); boks.className = "fo-sider"; boks.id = "fo-sider";
    var knap = d.createElement("button"); knap.type = "button"; knap.className = "fo-sider-knap"; knap.id = "fo-sider-knap";
    knap.setAttribute("aria-haspopup", "menu"); knap.setAttribute("aria-expanded", "false"); knap.setAttribute("aria-controls", "fo-sider-liste");
    knap.appendChild(d.createTextNode("Sider ▾"));
    var liste = d.createElement("div"); liste.className = "fo-sider-liste"; liste.id = "fo-sider-liste"; liste.setAttribute("role", "menu"); liste.hidden = true;
    var her = fil(env.sti), erIndex = her === "index.html";
    for (var i = 0; i < PUNKTER.length; i++) {
      var a = d.createElement("a"); a.href = PUNKTER[i][0]; a.setAttribute("role", "menuitem");
      if (!erIndex && fil(PUNKTER[i][0]) === her) a.setAttribute("aria-current", "page");
      a.appendChild(d.createTextNode(PUNKTER[i][1]));
      liste.appendChild(a);
    }
    function luk(fokus) { liste.hidden = true; knap.setAttribute("aria-expanded", "false"); if (fokus && knap.focus) knap.focus(); }
    knap.addEventListener("click", function () { var aaben = liste.hidden; liste.hidden = !aaben; knap.setAttribute("aria-expanded", aaben ? "true" : "false"); });
    d.addEventListener("click", function (e) { if (!liste.hidden && !(e.target && e.target.closest && e.target.closest("#fo-sider"))) luk(false); });
    d.addEventListener("keydown", function (e) { if (e.key === "Escape" && !liste.hidden) luk(true); });
    boks.appendChild(knap); boks.appendChild(liste);
    vaert.appendChild(boks);
    return boks;
  }
  w.FO_SIDEMENU = { PUNKTER: PUNKTER, monter: monter, fil: fil };
  if (!w.FO_SIDEMENU_STILLE) {
    try { monter(); } catch (x) { /* en menu, der fejler, må aldrig ødelægge siden */ }
  }
})(window);
