/* Prøve: dynamisk import(). Funktionen kaldes ikke (der er intet at hente); den skal bare kunne læses. BEVIDST ny syntaks. */
window.FO_SYNTAKS["dynamisk-import"] = (typeof (function () { return import("./styr.js"); }) === "function");
