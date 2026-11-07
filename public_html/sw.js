// Meget simpel service worker til Familieoverblik.
// Formål: appen skal kunne AABNE selv med daarligt/intet netvaerk (viser sidste
// kendte skema), IKKE at data skal virke offline — api.php kraever jo altid net.
// ⚠️ Version-strengen skal IKKE bumpes, bare fordi overblik.html aendrer sig.
// Denne kommentar sagde det modsatte og fik os til at planlaegge et unoedigt
// skridt. Skallet hentes NETVAERK FOERST (se fetch-handleren nederst): en ny
// overblik.html slaar igennem, saa snart telefonen har net, og cachen bruges
// kun naar nettet svigter. Bump foerst CACHE, naar SHELL-LISTEN selv aendrer
// sig — altsaa naar en fil kommer til eller falder fra — saa de gamle
// noegler bliver ryddet af activate-handleren.
const CACHE = "familieoverblik-shell-v1";
const SHELL = [
  "./overblik.html",
  "./config.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // api.php og hent.php skal ALTID hentes friskt — det er selve dataet.
  // Vi rammer kun netvaerket her og lader browseren fejle normalt offline,
  // saa siden viser sin egen "kan ikke hente"-tilstand i stedet for gamle tal.
  if (url.pathname.endsWith("api.php") || url.pathname.endsWith("hent.php")) {
    event.respondWith(fetch(req));
    return;
  }

  // Selve app-skallet: net foerst (saa I altid faar nyeste version, naar der er
  // forbindelse), men fald tilbage til cache hvis nettet svigter.
  if (SHELL.some((p) => url.pathname.endsWith(p.replace("./", "")))) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }
  // Alt andet (fonte mv.): normal netvaerkshentning, ingen indblanding.
});
