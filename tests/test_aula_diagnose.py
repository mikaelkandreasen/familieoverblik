"""Prøver den nye diagnose og omdirigeringen i aula_login_forms.py (med den falske httpx, ikke det rigtige bibliotek eller Aula)."""
import asyncio, contextlib, io, os, sys
_R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(_R, "tests", "fakehttpx")); sys.path.insert(0, os.path.join(_R, "docker", "aula", "patch"))
os.environ["AULA_LOGIN_BEKRAEFT"] = "send"                # de ældre prøver tester forløbet, hvor tilføjelsen selv sender bekræftelsen (se test_aula_overdrag.py for standarden)
import httpx
import aula_login_forms as F
ok_all = True
def t(n, c, x=""):
    global ok_all; ok_all &= bool(c); print("ok  " if c else "FEJL", n, "" if c else x)
B = "https://broker.unilogin.dk/auth/realms/broker/login-actions/"
BEKR = '<html><head><title>Unilogin</title></head><body><h1>Uni login</h1><form action="/auth/realms/broker/login-actions/post-broker-login?session_code=HEMMELIG1&amp;execution=EX" method="post"><input type="hidden" name="tab_id" value="HEMMELIG2"><button name="accept" value="ACCEPT" type="submit">Næste</button></form></body></html>'
SAML = '<html><body onload="document.forms[0].submit()"><form method="post" action="https://login.aula.dk/simplesaml/module.php/saml/sp/saml2-acs.php/default-sp"><input type="hidden" name="SAMLResponse" value="X"></form></body></html>'
def meta(url): return f'<html><head><meta http-equiv="refresh" content="0; url={url}"></head><body>Videresender …</body></html>'
def js(url): return f'<html><body><script>window.location.href = "{url}";</script>Vent</body></html>'
log = []
def koer(pages, url=B + "post-broker-login?x=1", sync=False):
    httpx.SERVER = lambda req, kw: (log.append((req.method, str(req.url), dict(req.data) if req.data else None)), pages(req, kw))[1]; log.clear()
    c = httpx.Client() if sync else httpx.AsyncClient(); r = c.build_request("GET", url); err = io.StringIO()
    with contextlib.redirect_stderr(err): resp = c.send(r) if sync else asyncio.run(c.send(r))
    return resp, err.getvalue()
F.install(httpx); os.environ.pop("AULA_LOGIN_DETALJER", None)
# ── find_omdirigering ──
fo = lambda h, u="https://broker.unilogin.dk/a/b": F.find_omdirigering(h, u)
t("meta refresh: relativ adresse, med og uden citationstegn, store og små bogstaver", fo(meta("/ny/vej")) == "https://broker.unilogin.dk/ny/vej" and fo('<meta http-equiv="Refresh" content="3;URL=\'https://login.aula.dk/x\'">') == "https://login.aula.dk/x" and fo('<meta http-equiv="refresh" content="0;url=c">') == "https://broker.unilogin.dk/a/c")
t("JavaScript: location.href =, window.location =, location.replace(…), document.location =, location.assign(…)", all(fo(f'<script>{x}</script>') == "https://login.aula.dk/y" for x in ('window.location.href = "https://login.aula.dk/y"', "location.replace('https://login.aula.dk/y')", 'document.location="https://login.aula.dk/y"', "window.location = 'https://login.aula.dk/y';", "location.assign('https://login.aula.dk/y')")))
t("ingen omdirigering, #-anker og javascript: giver None", fo("<p>hej</p>") is None and fo('<meta http-equiv="refresh" content="30">') is None and fo("<script>location.href='#top'</script>") is None and fo("<script>location.href='javascript:void(0)'</script>") is None)
t("en <meta> uden refresh og tekst om «location» er ikke en omdirigering", fo('<meta name="viewport" content="width=device-width"><p>Hvor er din location?</p>') is None)
# ── beskriv_svar ──
r = httpx.Response(B + "post-broker-login?session_code=HEMMELIG1", text=BEKR)
b = F.beskriv_svar(r)
t("beskrivelsen: status, adresse UDEN query, titel, tekst, formularens felter og knappens tekst", b.startswith("svar: HTTP 200 broker.unilogin.dk/auth/realms/broker/login-actions/post-broker-login ") and "titel «Unilogin»" in b and "Uni login Næste" in b and "POST broker.unilogin.dk/auth/realms/broker/login-actions/post-broker-login felter: accept,tab_id; knapper: Næste" in b, b)
t("beskrivelsen indeholder ALDRIG værdier eller koder (hverken fra felter, query eller formularens adresse)", "HEMMELIG" not in b and "session_code" not in b and "execution" not in b, b)
t("en side uden formular siges med STORT («INGEN formularer»), og links og omdirigering vises", (lambda x: "INGEN formularer" in x and "Fortsæt→broker.unilogin.dk/fortsaet" in x and "omdirigering til login.aula.dk/y" in x)(F.beskriv_svar(httpx.Response(B + "x", text='<a href="/fortsaet?code=SECRET">Fortsæt</a><script>location.href="https://login.aula.dk/y?token=SECRET"</script>'))))
t("links og omdirigering: heller ingen query, og SECRET kommer ikke med", "SECRET" not in F.beskriv_svar(httpx.Response(B + "x", text='<a href="/fortsaet?code=SECRET">Fortsæt</a><script>location.href="https://login.aula.dk/y?token=SECRET"</script>')))
t("omdirigerings-svar (302) viser hvor de peger hen, uden query", "HTTP 302" in F.beskriv_svar(httpx.Response(B + "x", status=302, text="", location="https://login.aula.dk/a?code=SECRET")) and "→ login.aula.dk/a" in F.beskriv_svar(httpx.Response(B + "x", status=302, text="", location="https://login.aula.dk/a?code=SECRET")) and "SECRET" not in F.beskriv_svar(httpx.Response(B + "x", status=302, text="", location="https://login.aula.dk/a?code=SECRET")))
t("JSON og andre typer beskrives kort uden indhold", F.beskriv_svar(httpx.Response(B + "x", text='{"token":"SECRET"}', ctype="application/json")) == "svar: HTTP 200 broker.unilogin.dk/auth/realms/broker/login-actions/x · (application/json)")
t("flere formularer og mange links begrænses (højst 6 links)", F.beskriv_svar(httpx.Response(B + "x", text="<form action='a'><input name='x'></form><form action='b' method='post'><input name='y'></form>" + "".join(f"<a href='/l{i}'>L{i}</a>" for i in range(20)))).count("→broker") == 6)
# ── hele kæden med omdirigering ──
def kæde(slut_side):
    def pages(req, kw):
        u = str(req.url)
        if req.method == "GET" and "post-broker-login" in u: return httpx.Response(u, text=BEKR)
        if req.method == "POST": return httpx.Response(B + "efter", text=slut_side)
        return httpx.Response("https://login.aula.dk/ud", text=SAML)
    return pages
for sync in (False, True):
    navn = "synkron" if sync else "asynkron"
    r, err = koer(kæde(meta("https://login.aula.dk/videre?x=1")), sync=sync)
    t(f"[{navn}] bekræftelse → svar uden formular med meta refresh → omdirigering følges → SAML-siden kommer retur", "SAMLResponse" in r.text and [l[0] for l in log] == ["GET", "POST", "GET"] and log[2][1] == "https://login.aula.dk/videre?x=1", log)
    t(f"[{navn}] loggen siger, at den følger omdirigeringen, og beskriver både siden, svaret og det, der kom efter", "bekraeftelse-siden: " in err and "efter afsendelse: HTTP 200" in err and "INGEN formularer" in err and "Følger den" in err and "efter omdirigering: HTTP 200" in err, err)
    t(f"[{navn}] loggen viser feltnavnet «accept», men ikke koderne", "felter: accept,tab_id; knapper: Næste" in err and "HEMMELIG" not in err and "SAMLResponse" in err, err)
    r, err = koer(kæde(js("https://login.aula.dk/js-videre")), sync=sync)
    t(f"[{navn}] samme med en JavaScript-omdirigering", "SAMLResponse" in r.text and log[-1][1] == "https://login.aula.dk/js-videre")
r, err = koer(kæde(meta("https://ond.example.com/stjaal")))
t("en omdirigering til en ANDEN vært følges ikke, og siden gives uændret tilbage til biblioteket", len(log) == 2 and "Følges ikke" in err and "Videresender" in r.text, (log, err))
r, err = koer(kæde(meta("http://login.aula.dk/uden-https")))
t("en omdirigering til http (ikke https) følges ikke", len(log) == 2 and "Følges ikke" in err)
def evig(req, kw):
    u = str(req.url)
    if req.method == "GET" and "post-broker-login" in u: return httpx.Response(u, text=BEKR)
    return httpx.Response("https://login.aula.dk/evig", text=meta("https://login.aula.dk/evig"))
r, err = koer(evig)
t("endeløse omdirigeringer: højst 3 følges, og så gives siden tilbage til biblioteket", len([l for l in log if l[0] == "GET"]) == 1 + F.MAX_FOELG and len(log) == 2 + F.MAX_FOELG and "Videresender" in r.text, [l[:2] for l in log])
t("endeløse omdirigeringer: højst 3 følges, og så gives siden tilbage", len([l for l in log if l[0] == "GET"]) <= 1 + F.MAX_FOELG and len(log) <= 2 + F.MAX_FOELG, len(log))
r, err = koer(kæde(SAML))
t("svaret er allerede SAML-siden: ingen omdirigering, ingen ekstra kald", len(log) == 2 and "SAMLResponse" in r.text and "Følger den" not in err)
r, err = koer(lambda req, kw: httpx.Response(str(req.url), text=meta("https://login.aula.dk/x")))
t("en side, tilføjelsen ikke har sendt noget til, bliver ikke omdirigeret (ingen ændring i andres flow)", len(log) == 1 and "Videresender" in r.text and err == "")
# ── billeder ──
fb = lambda h, u="https://broker.unilogin.dk/a/b": F.find_billeder(h, u)
t("billeder: <img src> med dobbelte, enkelte og ingen citationstegn, relative adresser og store bogstaver", fb('<img src="/a.gif"><IMG alt=x SRC=\'https://login.aula.dk/p.gif?x=1\'><img src=c.png>') == ["https://broker.unilogin.dk/a.gif", "https://login.aula.dk/p.gif?x=1", "https://broker.unilogin.dk/a/c.png"])
t("billeder: JavaScript-billeder (new Image().src = …) findes, og data:-adresser, tomme og dubletter udelades", fb('<script>var i = new Image(); i.onload = function(){ location.href = "/x"; }; i.src = "https://login.aula.dk/px";</script><img src="data:image/gif;base64,AAA"><img src=""><img src="/a.gif"><img src="/a.gif">') == ["https://broker.unilogin.dk/a.gif", "https://login.aula.dk/px"])
t("billeder: ingen billeder giver tom liste", fb("<p>hej</p>") == [] and fb("") == [])
def pixel_kæde(side, pixel_fejl=False, forkert_svar_efter=None):
    def pages(req, kw):
        u = str(req.url)
        if req.method == "GET" and "post-broker-login" in u: return httpx.Response(u, text=BEKR)
        if req.method == "POST": return httpx.Response(B + "efter", text=side)
        if u.endswith("/pixel.gif"):
            if pixel_fejl: raise ConnectionError("nede")
            return httpx.Response(u, text="GIF89a", ctype="image/gif")
        return httpx.Response("https://login.aula.dk/ud", text=SAML)
    return pages
PX = '<html><body><img src="https://login.aula.dk/pixel.gif" onload="window.location.href=\'https://login.aula.dk/videre\'">Indlæser …</body></html>'
for sync in (False, True):
    navn = "synkron" if sync else "asynkron"
    r, err = koer(pixel_kæde(PX), sync=sync)
    t(f"[{navn}] billedet hentes FØR omdirigeringen, og SAML-siden kommer retur", "SAMLResponse" in r.text and [(l[0], l[1].split("/")[-1]) for l in log][-2:] == [("GET", "pixel.gif"), ("GET", "videre")], [l[:2] for l in log])
    t(f"[{navn}] loggen viser billedet i svarbeskrivelsen, at det blev hentet, og omdirigeringen", "billeder: login.aula.dk/pixel.gif" in err and "billede hentet: login.aula.dk/pixel.gif (HTTP 200)" in err and "Følger den" in err, err)
httpx_log_headers = []
def med_headers(req, kw):
    if str(req.url).endswith("/pixel.gif"): httpx_log_headers.append(dict(req.headers))
    return pixel_kæde(PX)(req, kw)
koer(med_headers); t("billedet hentes med Referer og Accept: image/*", httpx_log_headers and httpx_log_headers[0]["Referer"].startswith(B) and httpx_log_headers[0]["Accept"].startswith("image/"), httpx_log_headers)
r, err = koer(pixel_kæde(PX, pixel_fejl=True)); t("et billede, der ikke kan hentes, vælter ikke login: det logges, og kæden fortsætter", "SAMLResponse" in r.text and "kunne ikke hentes (ConnectionError)" in err, err)
r, err = koer(pixel_kæde('<img src="https://ond.example.com/spor.gif"><img src="http://login.aula.dk/uden-https.gif"><meta http-equiv="refresh" content="0;url=https://login.aula.dk/videre">'))
t("billeder fra andre værter eller over http hentes ikke (men siges i loggen)", not any("spor.gif" in l[1] or "uden-https" in l[1] for l in log) and err.count("hentes ikke") == 2 and "SAMLResponse" in r.text, (log, err))
mange = "".join(f'<img src="https://login.aula.dk/b{i}.gif">' for i in range(10)) + '<meta http-equiv="refresh" content="0;url=https://login.aula.dk/videre">'
r, err = koer(lambda req, kw: httpx.Response(B + "efter", text=mange) if req.method == "POST" else httpx.Response(str(req.url), text=BEKR) if "post-broker-login" in str(req.url) else httpx.Response(str(req.url), text=SAML))
t(f"højst {F.MAX_BILLEDER} billeder pr. side, og det siges", len([l for l in log if l[1].endswith(".gif")]) == F.MAX_BILLEDER and "Henter kun de første" in err, (len(log), err[-200:]))
SAMLPX = SAML.replace("<form", '<img src="https://login.aula.dk/pixel.gif"><form', 1)
r, err = koer(pixel_kæde(SAMLPX)); t("en SAML-side med et billede: billedet hentes, og siden (med formularen) gives til biblioteket uden omdirigering", "SAMLResponse" in r.text and [l[1].split("/")[-1] for l in log][-1] == "pixel.gif" and "Følger den" not in err, [l[:2] for l in log])
r, err = koer(lambda req, kw: httpx.Response(str(req.url), text=PX)); t("en side, tilføjelsen ikke har sendt noget til, får ingen billeder hentet (andres flow røres ikke)", len(log) == 1 and err == "")
httpx_log_headers.clear()
# ── HTTP-omdirigeringer (302), som i den rigtige Aula-log ──
def red_kæde(*trin, slut=SAML):
    """bekræftelsessiden → POST → en kæde af 302'er (Location-værdier) → slutsiden."""
    kaldt = []
    def pages(req, kw):
        u = str(req.url)
        if req.method == "GET" and "post-broker-login" in u and not kaldt: return httpx.Response(u, text=BEKR)
        if req.method == "POST": kaldt.append(1); return httpx.Response(B + "post-broker-login", status=302, text="", location=trin[0]) if trin else httpx.Response(u, text=slut)
        for k, lok in enumerate(trin):
            if u.endswith(lok.rsplit("/", 1)[-1]) or lok in u:
                return httpx.Response(u, status=302, text="", location=trin[k + 1]) if k + 1 < len(trin) else httpx.Response(u, text=slut)
        return httpx.Response(u, text=slut)
    return pages
for sync in (False, True):
    navn = "synkron" if sync else "asynkron"
    r, err = koer(red_kæde("/auth/realms/broker/broker/after-post-broker-login"), sync=sync)
    t(f"[{navn}] POST af «Næste» giver en tom 302 til after-post-broker-login: den følges med GET, og SAML-siden gives til biblioteket (præcis fejlen fra den rigtige log)", "SAMLResponse" in r.text and [l[0] for l in log] == ["GET", "POST", "GET"] and log[2][1] == "https://broker.unilogin.dk/auth/realms/broker/broker/after-post-broker-login", [l[:2] for l in log])
    t(f"[{navn}] loggen siger, at svaret er en omdirigering (HTTP 302) og at den følges", "omdirigering (HTTP 302) til broker.unilogin.dk/auth/realms/broker/broker/after-post-broker-login. Følger den." in err, err)
r, err = koer(red_kæde("/a/etape1", "https://login.aula.dk/b/etape2", "/c/etape3"))
t("flere 302'er i træk (også til login.aula.dk) følges hele vejen til siden, biblioteket venter", "SAMLResponse" in r.text and [l[0] for l in log] == ["GET", "POST", "GET", "GET", "GET"] and log[3][1] == "https://login.aula.dk/b/etape2", [l[:2] for l in log])
r, err = koer(red_kæde("https://ond.example.com/stjaal"))
t("en 302 til en anden vært følges ikke: biblioteket får 302'en, som den er, og det siges i loggen", r.status_code == 302 and len(log) == 2 and "ikke broker'en eller Aula. Følges ikke" in err, (r.status_code, err))
r, err = koer(red_kæde("http://login.aula.dk/uden-https"))
t("en 302 til http (ikke https) følges ikke", r.status_code == 302 and len(log) == 2)
def p307(req, kw):
    u = str(req.url)
    if req.method == "GET" and "post-broker-login" in u: return httpx.Response(u, text=BEKR)
    return httpx.Response(B + "post-broker-login", status=307, text="", location="/x")
r, err = koer(p307)
t("en 307 (gentag POST) følges ikke, og det forklares", r.status_code == 307 and len(log) == 2 and "skal gentage POST" in err, err)
def p303(req, kw):
    u = str(req.url)
    if req.method == "GET" and "post-broker-login" in u and len(log) == 1: return httpx.Response(u, text=BEKR)
    if req.method == "POST": return httpx.Response(B + "post-broker-login", status=303, text="", location="/auth/realms/broker/broker/efter")
    return httpx.Response(u, text=SAML)
r, err = koer(p303); t("303 følges også (med GET)", "SAMLResponse" in r.text and log[-1][0] == "GET")
def uden_lokation(req, kw):
    u = str(req.url)
    if req.method == "GET" and "post-broker-login" in u: return httpx.Response(u, text=BEKR)
    return httpx.Response(B + "post-broker-login", status=302, text="")
r, err = koer(uden_lokation); t("en 302 uden Location giver ingen fejl: svaret gives uændret tilbage", r.status_code == 302 and len(log) == 2)
def endeløs(req, kw):
    u = str(req.url)
    if req.method == "GET" and "post-broker-login" in u and len(log) == 1: return httpx.Response(u, text=BEKR)
    return httpx.Response(u, status=302, text="", location="https://login.aula.dk/rundt")
r, err = koer(endeløs)
t(f"en endeløs kæde af 302'er stoppes efter højst {F.MAX_FOELG} skridt, og biblioteket får det sidste svar", len([l for l in log if l[0] == "GET"]) == 1 + F.MAX_FOELG and r.status_code == 302, len(log))
r, err = koer(lambda req, kw: httpx.Response(str(req.url), status=302, text="", location="https://login.aula.dk/x"))
t("en 302 på en forespørgsel, tilføjelsen ikke har sendt noget til, røres ikke (biblioteket styrer selv sine egne omdirigeringer)", r.status_code == 302 and len(log) == 1 and err == "")
r, err = koer(red_kæde("/a/etape1"))
t("efter en omdirigering hentes billederne på slutsiden stadig, før siden gives videre (hvis den har nogen)", "SAMLResponse" in r.text)

# ── formular → omdirigering → formular → omdirigering (en ny bekræftelsesside efter en omdirigering) ──
def to_trin(req, kw):
    u = str(req.url); antal_post = len([l for l in log if l[0] == "POST"])
    if req.method == "GET" and "post-broker-login" in u and len(log) == 1: return httpx.Response(u, text=BEKR)
    if req.method == "POST" and antal_post == 1: return httpx.Response(B + "post-broker-login", status=302, text="", location="/auth/realms/broker/broker/mellem")
    if req.method == "GET" and u.endswith("/mellem"): return httpx.Response(u, text=BEKR.replace("post-broker-login?", "post-broker-login-2?"))
    if req.method == "POST" and antal_post == 2: return httpx.Response(B + "post-broker-login-2", status=302, text="", location="https://login.aula.dk/slut")
    return httpx.Response(u, text=SAML)
for sync in (False, True):
    r, err = koer(to_trin, sync=sync)
    t(f"[{'synkron' if sync else 'asynkron'}] en ny bekræftelsesside efter en omdirigering udfyldes også, og kæden ender i SAML-siden", "SAMLResponse" in r.text and [l[0] for l in log] == ["GET", "POST", "GET", "POST", "GET"], [l[:2] for l in log])
r, err = koer(to_trin)
t("loggen viser begge afsendelser og begge omdirigeringer", err.count("efter afsendelse") == 2 and err.count("Følger den") == 2, err.count("efter afsendelse"))
def evig_formular(req, kw):
    u = str(req.url)
    if req.method == "GET" and "post-broker-login" in u and len(log) == 1: return httpx.Response(u, text=BEKR)
    n = len([l for l in log if l[0] == "POST"])
    return httpx.Response(B + f"post-broker-login-{n}", text=BEKR.replace("post-broker-login?", f"post-broker-login-{n}?"))
r, err = koer(evig_formular)
t("en endeløs række af nye formularer stoppes af grænsen: højst MAX_HOP afsendelser i alt (ingen uendelig løkke)", len([l for l in log if l[0] == "POST"]) == F.MAX_HOP, len(log))

# ── hele kæden som i den rigtige Aula-log (8. november): rolle → «Næste» → 302 → SAML ──
ROLLE = '<html><head><title>Unilogin</title></head><body><div>Unilogin Uni login Log ind som</div><form action="/auth/realms/broker/login-actions/post-broker-login?session_code=S1&amp;execution=E1" method="post"><label><input type="radio" name="selected-aktoer" value="ELEV"> Elev</label><label><input type="radio" name="selected-aktoer" value="KONTAKT"> Forælder eller kontaktperson</label></form><a href="/auth/realms/broker/login-actions/restart">« Tilbage</a><img src="/auth/resources/kbqcu/login/unilogin/img/UVM_STIL_black_min.svg"></body></html>'
def rigtig_log(req, kw):
    u = str(req.url); n = len([l for l in log if l[0] == "POST"])
    if req.method == "GET" and "post-broker-login" in u and len(log) == 1: return httpx.Response(u, text=ROLLE)
    if req.method == "POST" and n == 1: return httpx.Response(B + "post-broker-login", text=BEKR)
    if req.method == "POST" and n == 2: return httpx.Response(B + "post-broker-login", status=302, text="", location="https://broker.unilogin.dk/auth/realms/broker/broker/after-post-broker-login")
    if u.endswith("after-post-broker-login"): return httpx.Response(u, text=SAML)
    return httpx.Response(u, text="", status=404)
for sync in (False, True):
    r, err = koer(rigtig_log, sync=sync)
    t(f"[{'synkron' if sync else 'asynkron'}] den rigtige kæde: rolle KONTAKT, «Næste» (accept), 302 til after-post-broker-login, og biblioteket får SAML-siden", "SAMLResponse" in r.text and [l[0] for l in log if not l[1].endswith(".svg")] == ["GET", "POST", "POST", "GET"] and log[1][2].get("selected-aktoer") == "KONTAKT" and "accept" in log[2][2] and log[-1][1].endswith("after-post-broker-login"), [(l[0], l[1][-40:], l[2]) for l in log])
t("loggen er den samme slags som den, brugeren sendte, og indeholder ingen koder (session_code, execution)", "vælger rollen KONTAKT" in err and "accepterer bekræftelsessiden" in err and "efter afsendelse: HTTP 302" in err and "S1" not in err and "session_code" not in err and "execution" not in err, err)

# ── tavs tilstand ──
os.environ["AULA_LOGIN_DETALJER"] = "0"
r, err = koer(kæde(meta("https://login.aula.dk/videre")))
t("AULA_LOGIN_DETALJER=0: ingen svarbeskrivelser, men omdirigeringen følges stadig, og valget/accepten logges", "SAMLResponse" in r.text and "efter afsendelse" not in err and "svar:" not in err and "accepterer bekræftelsessiden" in err and "Følger den" in err, err)
os.environ.pop("AULA_LOGIN_DETALJER")
# en fejl i beskrivelsen må aldrig vælte login
orig = F.beskriv_svar; F.beskriv_svar = lambda r: (_ for _ in ()).throw(ValueError("fejl"))
r, err = koer(kæde(meta("https://login.aula.dk/videre")))
t("en fejl i selve beskrivelsen vælter ikke login (den logges og kæden fortsætter)", "SAMLResponse" in r.text and "kunne ikke beskrives" in err, err)
F.beskriv_svar = orig
sys.exit(0 if ok_all else 1)
