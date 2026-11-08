"""Hele Aula-login-forløbet, som aula-biblioteket (1.16) selv kører det, mod en falsk httpx og en falsk broker.
Biblioteket er gengivet efter dets egen kode (mitid_client._process_broker_response og _extract_form_data), som brugeren sendte fra sin container:
  response = get(Location) → første <form> på siden → post(action, alle <input>) → forventer en 302 → get(Location) → første <form> skal findes (SAMLResponse).
Rettelsen i 3.5.6: bekræftelsessiden gives til biblioteket (med knappens felt som skjult felt og en fuld adresse), i stedet for at tilføjelsen sender den selv."""
import asyncio, contextlib, io, os, sys
from html.parser import HTMLParser
_R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(_R, "tests", "fakehttpx")); sys.path.insert(0, os.path.join(_R, "docker", "aula", "patch"))
import httpx
import aula_login_forms as F
ok_all = True
def t(n, c, x=""):
    global ok_all; ok_all &= bool(c); print("ok  " if c else "FEJL", n, "" if c else x)
os.environ.pop("AULA_LOGIN_BEKRAEFT", None); os.environ.pop("AULA_LOGIN_DETALJER", None)
BR = "https://broker.unilogin.dk"; PBL = BR + "/auth/realms/broker/login-actions/post-broker-login"; AFTER = BR + "/auth/realms/broker/broker/after-post-broker-login"
ACS = "https://login.aula.dk/simplesaml/module.php/saml/sp/saml2-acs.php/app-level3-sp"
START = PBL + "?session_code=S0&execution=E0"
ROLLE = '<html><head><title>Unilogin</title></head><body>Unilogin Uni login Log ind som<form action="/auth/realms/broker/login-actions/post-broker-login?session_code=S1&amp;execution=E1" method="post"><label><input type="radio" name="selected-aktoer" value="ELEV"> Elev</label><label><input type="radio" name="selected-aktoer" value="KONTAKT"> Forælder eller kontaktperson</label></form><img src="/auth/resources/x/UVM_STIL_black_min.svg"></body></html>'
def bekr(ekstra_input="", foer=""):
    return f'<html><head><title>Unilogin</title></head><body>Unilogin Uni login Næste{foer}<form action="/auth/realms/broker/login-actions/post-broker-login?session_code=S2&amp;execution=E2" method="post">{ekstra_input}<button type="submit" name="accept" id="confirmation-button" value="ACCEPT">Næste</button></form></body></html>'
SAML = f'<html><body onload="document.forms[0].submit()"><form method="post" action="{ACS}"><input type="hidden" name="SAMLResponse" value="SAMLX"><button>Fortsæt</button></form></body></html>'
# ── biblioteket, som det står i mitid_client.py ──
class SAMLError(Exception): pass
class _Form(HTMLParser):
    def __init__(s): super().__init__(); s.i = False; s.klar = False; s.action = None; s.inputs = {}; s.fundet = False
    def handle_starttag(s, tag, a):
        a = dict(a)
        if tag == "form" and not s.fundet: s.fundet = True; s.i = True; s.action = a.get("action", "")
        elif tag == "input" and s.i and a.get("name"): s.inputs[a["name"]] = a.get("value", "")
    def handle_endtag(s, tag):
        if tag == "form" and s.i: s.i = False
def foerste_formular(html):
    p = _Form(); p.feed(html); return (p.action, p.inputs) if p.fundet else None
def bibliotek(c, sync, start=START):
    """_process_broker_response, linje for linje."""
    def send(req): return c.send(req) if sync else asyncio.run(c.send(req))
    def get(u): return send(c.build_request("GET", u))
    def post(u, data):
        if not u.startswith("https://"): raise SAMLError(f"relativ adresse ({u}): httpx ville afvise den")
        return send(c.build_request("POST", u, data=data))
    response = get(start)                                               # final_request = await self._client.get(action_url)
    f = foerste_formular(response.text)                                 # _extract_form_data(soup)
    if f is None: raise SAMLError("No form found in page")
    action, form_data = f
    if not action: raise SAMLError("Form has no action attribute")
    pb = post(action, form_data)
    if pb.status_code not in (301, 302, 303, 307, 308): raise SAMLError(f"No redirect from post-broker-login (status: {pb.status_code})")
    after = get(pb.headers["location"])
    saml = foerste_formular(after.text)
    if saml is None: raise SAMLError("No SAML form found in broker response")
    if "SAMLResponse" not in saml[1]: raise SAMLError("Could not find SAMLResponse")
    return {"final_saml_response": saml[1]["SAMLResponse"], "final_relay_state": saml[1].get("RelayState", ""), "action": saml[0]}
# ── brokeren ──
log = []
def broker(bekraeftelse=None, rolle=ROLLE):
    bk = bekraeftelse if bekraeftelse is not None else bekr()
    def server(req, kw):
        u = str(req.url); d = dict(req.data or {}); log.append((req.method, u, d))
        if req.method == "GET" and u == START: return httpx.Response(u, text=rolle)
        if req.method == "POST" and u.startswith(PBL) and "selected-aktoer" in d: return httpx.Response(PBL, text=bk)
        if req.method == "POST" and u.startswith(PBL) and d.get("accept") == "ACCEPT": return httpx.Response(PBL, status=302, text="", location=AFTER)
        if req.method == "POST" and u.startswith(PBL): return httpx.Response(PBL, text=bk)            # uden «accept»: siden kommer igen (200)
        if req.method == "GET" and u == AFTER: return httpx.Response(AFTER, text=SAML)
        if req.method == "POST" and u == ACS: return httpx.Response(ACS, status=302, text="", location="https://www.aula.dk/portal")
        if req.method == "GET" and u == "https://www.aula.dk/portal": return httpx.Response(u, text="<html><body>Aula</body></html>")
        return httpx.Response(u, status=404, text="")
    return server
def koer(sync=False, **kw):
    httpx.SERVER = broker(**kw); log.clear()
    c = httpx.Client() if sync else httpx.AsyncClient(); err = io.StringIO()
    with contextlib.redirect_stderr(err):
        try: ud = bibliotek(c, sync)
        except SAMLError as e: ud = e
    return ud, err.getvalue()
F.install(httpx)
rolle_post = lambda l: l[0] == "POST" and "selected-aktoer" in (l[2] or {})
for sync in (False, True):
    navn = "synkron" if sync else "asynkron"
    ud, err = koer(sync)
    t(f"[{navn}] standard: biblioteket kommer hele vejen igennem og får Aula-formularen (SAMLResponse), som i den rigtige log", isinstance(ud, dict) and ud["final_saml_response"] == "SAMLX" and ud["action"] == ACS and ud["final_relay_state"] == "", (ud, [l[:2] for l in log]))
    rolle_ind = [i for i, l in enumerate(log) if rolle_post(l)]; acc_ind = [i for i, l in enumerate(log) if l[0] == "POST" and (l[2] or {}).get("accept")]
    t(f"[{navn}] forløbet er: biblioteket henter siden (GET), tilføjelsen vælger rollen (POST), BIBLIOTEKET sender bekræftelsen med accept (POST) og henter siden efter (GET), og intet andet", [l[0] for l in log] == ["GET", "POST", "POST", "GET"] and rolle_ind == [1] and acc_ind == [2] and log[3][1] == AFTER, [(l[0], l[1][-30:], l[2]) for l in log])
    t(f"[{navn}] biblioteket sendte bekræftelsen med knappens felt (accept=ACCEPT) til en FULD adresse (ikke en relativ)", log[2][1].startswith(PBL + "?") and log[2][2] == {"accept": "ACCEPT"}, log[2])
    t(f"[{navn}] tilføjelsen sendte KUN rollen selv (KONTAKT) og ikke bekræftelsen", sum(1 for l in log if rolle_post(l)) == 1 and [l for l in log if rolle_post(l)][0][2]["selected-aktoer"] == "KONTAKT")
    t(f"[{navn}] loggen siger, at bekræftelsessiden gøres klar til biblioteket, og indeholder ingen koder", "gør bekræftelsessiden klar til biblioteket" in err and "Felter: accept" in err and "S2" not in err and "session_code" not in err and "execution" not in err and "accepterer bekræftelsessiden" not in err, err)
    ud, err = koer(sync, bekraeftelse=bekr('<input type="hidden" name="tab_id" value="T&amp;1">'))
    t(f"[{navn}] en bekræftelsesside med egne skjulte felter beholder dem, og accept kommer til", isinstance(ud, dict) and log[2][2] == {"tab_id": "T&1", "accept": "ACCEPT"}, log[2])
    ud, err = koer(sync, bekraeftelse=bekr('<input type="hidden" name="accept" value="ACCEPT">'))
    t(f"[{navn}] findes accept allerede som input, tilføjes det ikke to gange", isinstance(ud, dict) and log[2][2] == {"accept": "ACCEPT"})
os.environ["AULA_LOGIN_BEKRAEFT"] = "send"
ud, err = koer(False)
t("TILSTAND «send» (3.3.3 til 3.5.5) giver præcis fejlen fra den rigtige log: biblioteket får Aula-siden for tidligt, sender den, får en 302 til portalen og finder ingen ny formular", isinstance(ud, SAMLError) and str(ud) == "No SAML form found in broker response", ud)
os.environ.pop("AULA_LOGIN_BEKRAEFT")
# første formular er ikke bekræftelsen → biblioteket ville tage den forkerte; tilføjelsen sender selv
ud, err = koer(False, bekraeftelse=bekr(foer='<form action="/soeg" method="get"><input name="q"></form>'))
t("er bekræftelsen ikke den FØRSTE formular på siden (biblioteket tager altid den første), sender tilføjelsen selv i stedet, og det siges", "Sender den selv i stedet" in err and sum(1 for l in log if l[0] == "POST") >= 2, err)
# omskriv_formular
om = F.omskriv_formular
h = '<p>x</p><FORM  ACTION=\'/a?b=1&amp;c=2\' method=post class="k"><button name="accept" value="ACCEPT">Næste</button></FORM>'
n = om(h, 0, "https://broker.unilogin.dk/ny?x=1&y=2", {"accept": "ACCEPT", "a": 'v"<'}, set())
t("omskriv_formular: gammel action fjernes (også med store bogstaver og uden citationstegn), ny action sættes (escapet), skjulte felter sættes ind lige efter åbningen, resten er uændret", n.startswith('<p>x</p><FORM method=post class="k" action="https://broker.unilogin.dk/ny?x=1&amp;y=2"><input type="hidden" name="accept" value="ACCEPT"><input type="hidden" name="a" value="v&quot;&lt;"><button name="accept"') and n.endswith("Næste</button></FORM>"), n)
t("omskriv_formular: uden action-attribut tilføjes en, og felter, formularen allerede har, springes over", om('<form method="post"></form>', 0, "https://x/y", {"a": "1", "b": "2"}, {"a"}) == '<form method="post" action="https://x/y"><input type="hidden" name="b" value="2"></form>')
t("omskriv_formular: findes formular nr. n ikke, gives None", om("<p>ingen</p>", 0, "https://x", {}, set()) is None and om("<form></form>", 1, "https://x", {}, set()) is None)
t("omskriv_formular: formular nr. 2 ændres, ikke nr. 1", (lambda r: r.count('action="https://x/y"') == 1 and r.index("første") < r.index("https://x/y"))(om('<form action="/a">første</form><form action="/b">anden</form>', 1, "https://x/y", {}, set())))
# _skift_tekst mod en klasse, der opfører sig som httpx.Response (text er en egenskab, afledt af _content, og cachet)
class EgtResponse:
    def __init__(self, status_code=200, headers=None, content=b"", request=None):
        self.status_code = status_code; self.headers = headers or {}; self._content = content; self.request = request
    @property
    def text(self):
        if not hasattr(self, "_text"): self._text = self._content.decode(getattr(self, "_encoding", "latin-1"))
        return self._text
r = EgtResponse(headers={"content-type": "text/html; charset=iso-8859-1"}, content="gammel æ".encode("latin-1")); _ = r.text
res = F._skift_tekst(r, "ny æøå €")
t("_skift_tekst på en httpx-lignende klasse (text er en cachet egenskab): ændres på stedet, og æøå og € bevares (utf-8, selvom svaret sagde latin-1)", res is r and r.text == "ny æøå €" and r._content == "ny æøå €".encode("utf-8"), r.text)
class LaasResponse(EgtResponse):
    def __init__(self, status_code=200, headers=None, content=b"", request=None):
        for k, v in (("status_code", status_code), ("headers", headers or {}), ("_content", content), ("request", request)): object.__setattr__(self, k, v)
    def __setattr__(self, k, v):
        if k in ("_content", "_encoding"): raise AttributeError("skrivebeskyttet")
        object.__setattr__(self, k, v)
r2 = LaasResponse(content=b"gammel", headers={"content-encoding": "gzip", "content-length": "6", "x-a": "b"})
with contextlib.redirect_stderr(io.StringIO()): res2 = F._skift_tekst(r2, "ny")
t("kan svaret ikke ændres på stedet, laves et nyt med de samme overskrifter, men uden content-encoding og content-length (ellers ville httpx pakke den nye tekst ud som gzip)", getattr(res2, "text", None) == "ny" and res2 is not r2 and res2.headers == {"x-a": "b"} and res2.status_code == 200, res2)
r3 = EgtResponse(content=b"x")
class Haard(EgtResponse):
    def __setattr__(self, k, v):
        if k in ("_content", "_encoding"): raise AttributeError("nej")
        object.__setattr__(self, k, v)
    def __init__(self, *a, **k): raise TypeError("kan ikke laves igen")
h3 = Haard.__new__(Haard); object.__setattr__(h3, "headers", {}); object.__setattr__(h3, "status_code", 200); object.__setattr__(h3, "_content", b"x")
err = io.StringIO()
with contextlib.redirect_stderr(err): res3 = F._skift_tekst(h3, "ny")
t("kan hverken svaret ændres eller et nyt laves, giver _skift_tekst None (så tilføjelsen sender selv), og det logges, uden at noget vælter", res3 is None and "kunne ikke lave et nyt svar" in err.getvalue(), err.getvalue())
sys.exit(0 if ok_all else 1)
