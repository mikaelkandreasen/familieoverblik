"""
aula_login_forms.py — de to sider, Unilogin-broker'en kan vise EFTER MitID-godkendelsen.

Efter MitID kan login-kæden lande på en side med en formular, som en browser ville udfylde:

  1. Rolle:        formularen har et felt  selected-aktoer.  For en forælder skal det være  KONTAKT.
  2. Bekræftelse:  formularen har knappen  #confirmation-button  (værdien ACCEPT). Den skal sendes for at komme videre.

aula-biblioteket kender ikke nødvendigvis de to sider. Det her lægger sig i httpx (som biblioteket bruger),
og når et svar fra broker.unilogin.dk eller login.aula.dk er en af de to formularer, sender det formularen
og giver biblioteket svaret på selve afsendelsen, som om siden aldrig havde været der. Alt andet røres ikke.
SAML-sider (med SAMLResponse) har hverken selected-aktoer eller en bekræftelsesknap og lades urørt.

Aktiveres af sitecustomize.py ved Pythons start. Indstillinger (miljøvariabler):
  AULA_LOGIN_PATCH   1 (standard) eller 0 for at slå det helt fra
  AULA_AKTOER        værdien til selected-aktoer. Standard KONTAKT
  AULA_ACCEPT_FELT   «navn=værdi» til bekræftelsen, hvis knappen ikke selv har et navn. Standard: intet
Hvad der gøres, skrives til stderr med forstavelsen «aula-login:». Bekræftelsessidens tekst skrives, så du kan se, hvad der accepteres.
"""
import os
import re
import sys
from html.parser import HTMLParser
from urllib.parse import urljoin, urlsplit

HOSTE = {"broker.unilogin.dk", "login.aula.dk"}
MAX_HOP = 4
ROLLE_FELT = "selected-aktoer"


def _log(tekst):
    print(f"aula-login: {tekst}", file=sys.stderr, flush=True)


# ─── HTML → formularer ────────────────────────────────────────────
class _Parser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.forms, self.form, self.select, self.knap = [], None, None, None
        self.tekst, self._skjul = [], 0

    def handle_starttag(self, tag, attrs):
        a = {k: (v if v is not None else "") for k, v in attrs}
        if tag in ("script", "style"):
            self._skjul += 1
        if tag == "form":
            self.form = {"action": a.get("action", ""), "method": a.get("method", "get").lower(), "kontroller": []}
            self.forms.append(self.form)
        elif self.form is None:
            return
        elif tag == "input":
            self.form["kontroller"].append({"tag": "input", "type": a.get("type", "text").lower(), "name": a.get("name", ""),
                                            "value": a.get("value", ""), "id": a.get("id", ""),
                                            "checked": "checked" in a, "disabled": "disabled" in a})
        elif tag == "button":
            self.knap = {"tag": "button", "type": a.get("type", "submit").lower(), "name": a.get("name", ""), "value": a.get("value", ""),
                         "id": a.get("id", ""), "checked": False, "disabled": "disabled" in a, "tekst": ""}
            self.form["kontroller"].append(self.knap)
        elif tag == "select":
            self.select = {"tag": "select", "type": "select", "name": a.get("name", ""), "value": "", "id": a.get("id", ""),
                           "checked": False, "disabled": "disabled" in a, "valg": []}
            self.form["kontroller"].append(self.select)
        elif tag == "option" and self.select is not None:
            self.select["valg"].append({"value": a.get("value", None), "valgt": "selected" in a, "tekst": ""})
        elif tag == "textarea":
            self.form["kontroller"].append({"tag": "textarea", "type": "textarea", "name": a.get("name", ""), "value": "",
                                            "id": a.get("id", ""), "checked": False, "disabled": "disabled" in a})

    def handle_endtag(self, tag):
        if tag in ("script", "style") and self._skjul:
            self._skjul -= 1
        if tag == "form":
            self.form = self.select = self.knap = None
        elif tag == "select":
            self.select = None
        elif tag == "button":
            self.knap = None

    def handle_data(self, data):
        if not self._skjul:
            self.tekst.append(data)
        if self.knap is not None:
            self.knap["tekst"] += data
        if self.select is not None and self.select["valg"]:
            self.select["valg"][-1]["tekst"] += data


def laes_formularer(html):
    p = _Parser()
    p.feed(html)
    p.close()
    return p.forms, re.sub(r"\s+", " ", " ".join(p.tekst)).strip()


# ─── Hvilken formular er det? ─────────────────────────────────────
def _mulige_roller(form):
    """Alle værdier, selected-aktoer kan få på siden: radioknapper, valgmuligheder og knapper med det navn."""
    ud = []
    for c in form["kontroller"]:
        if c["name"] != ROLLE_FELT:
            continue
        if c["type"] == "select":
            ud += [(v["value"] if v["value"] is not None else v["tekst"].strip()) for v in c["valg"]]
        elif c["type"] in ("radio", "submit", "button", "checkbox") or c["tag"] == "button":
            ud.append(c["value"])
    return [x for x in ud if x != ""]


def er_rolleformular(form):
    return any(c["name"] == ROLLE_FELT for c in form["kontroller"])


def _er_sendeknap(c):
    return (c["tag"] == "button" and c["type"] != "button") or c["type"] in ("submit", "image")


def er_bekraeftelse(form):
    for c in form["kontroller"]:
        if c["id"] == "confirmation-button":
            return True
        if _er_sendeknap(c) and c["value"].strip().upper() == "ACCEPT":
            return True
    return False


def _basisfelter(form):
    """Det en browser ville sende med: alle aktive felter, undtagen afkrydsninger der ikke er sat og sendeknapper."""
    felter = {}
    for c in form["kontroller"]:
        n = c["name"]
        if not n or c["disabled"] or n == ROLLE_FELT:
            continue
        t = c["type"]
        if t in ("submit", "button", "image", "reset", "file") or c["tag"] == "button":
            continue
        if t in ("checkbox", "radio"):
            if c["checked"]:
                felter[n] = c["value"] or "on"
            continue
        if t == "select":
            valg = c["valg"]
            valgt = next((v for v in valg if v["valgt"]), valg[0] if valg else None)
            if valgt is not None:
                felter[n] = valgt["value"] if valgt["value"] is not None else valgt["tekst"].strip()
            continue
        felter[n] = c["value"]
    return felter


def byg_rolle(form, oensket):
    """Felterne til rolleformularen. Findes den ønskede rolle ikke, stoppes med en liste over dem, der findes."""
    mulige = _mulige_roller(form)
    valgt = None
    for m in mulige:
        if m.strip().upper() == oensket.strip().upper():
            valgt = m
            break
    if mulige and valgt is None:
        raise RuntimeError(f"Login-siden tilbyder rollerne {', '.join(sorted(set(mulige)))}, men ikke {oensket}. "
                           f"Sæt AULA_AKTOER i lokal/.env til den rolle, du skal bruge (eller AULA_LOGIN_PATCH=0 for at slå det her fra).")
    felter = _basisfelter(form)
    felter[ROLLE_FELT] = valgt if valgt is not None else oensket
    # én navngiven sendeknap (som ikke selv er rollevalget) ville en browser også have sendt
    knapper = [c for c in form["kontroller"] if _er_sendeknap(c) and c["name"] and c["name"] != ROLLE_FELT and not c["disabled"]]
    if len(knapper) == 1:
        felter[knapper[0]["name"]] = knapper[0]["value"]
    return felter


def byg_bekraeftelse(form, accept_felt=""):
    felter = _basisfelter(form)
    knap = next((c for c in form["kontroller"] if c["id"] == "confirmation-button"), None) \
        or next((c for c in form["kontroller"] if _er_sendeknap(c) and c["value"].strip().upper() == "ACCEPT"), None)
    if knap is not None and knap["name"]:
        felter[knap["name"]] = knap["value"] if knap["value"] != "" else "ACCEPT"
    elif accept_felt and "=" in accept_felt:
        n, v = accept_felt.split("=", 1)
        felter[n.strip()] = v.strip()
    return felter


def planlaeg(html, url, oensket="KONTAKT", accept_felt=""):
    """Returnerer None (intet at gøre) eller {type, url, felter, tekst}."""
    forms, tekst = laes_formularer(html)
    for form in forms:
        if er_rolleformular(form):
            return {"type": "rolle", "url": urljoin(url, form["action"] or url), "felter": byg_rolle(form, oensket), "tekst": tekst}
    for form in forms:
        if er_bekraeftelse(form):
            return {"type": "bekraeftelse", "url": urljoin(url, form["action"] or url), "felter": byg_bekraeftelse(form, accept_felt), "tekst": tekst}
    return None


# ─── Kobling til httpx ────────────────────────────────────────────
def _skal_roeres(resp, kwargs):
    if kwargs.get("stream"):
        return False
    if getattr(resp, "status_code", 0) != 200:
        return False
    if "html" not in (resp.headers.get("content-type") or "").lower():
        return False
    return (urlsplit(str(resp.url)).hostname or "").lower() in HOSTE


def _indstillinger():
    return os.environ.get("AULA_AKTOER", "").strip() or "KONTAKT", os.environ.get("AULA_ACCEPT_FELT", "").strip()


def _plan(resp, kwargs, set_):
    if not _skal_roeres(resp, kwargs):
        return None
    aktoer, accept = _indstillinger()
    p = planlaeg(resp.text, str(resp.url), aktoer, accept)
    if p is None:
        return None
    noegle = (p["type"], p["url"])
    if noegle in set_:                                     # samme formular to gange: noget er galt, lad biblioteket fejle tydeligt
        _log(f"{p['type']}-siden kom igen efter afsendelse. Stopper (se -vv).")
        return None
    set_.add(noegle)
    if p["type"] == "rolle":
        _log(f"vælger rollen {p['felter'][ROLLE_FELT]} ({ROLLE_FELT})")
    else:
        _log(f"accepterer bekræftelsessiden. Siden siger: «{p['tekst'][:300]}». Felter sendt: {', '.join(sorted(p['felter'])) or 'ingen'}")
    return p


def _headers(resp):
    sp = urlsplit(str(resp.url))
    return {"Referer": str(resp.url), "Origin": f"{sp.scheme}://{sp.netloc}"}


def install(httpx=None):
    """Lægger sig i httpx.AsyncClient.send og httpx.Client.send. Kan kaldes flere gange."""
    if httpx is None:
        import httpx  # noqa: PLC0415
    if getattr(httpx, "_familieoverblik_aula_forms", False):
        return False
    orig_async, orig_sync = httpx.AsyncClient.send, httpx.Client.send

    async def send_async(self, request, *args, **kwargs):
        resp = await orig_async(self, request, *args, **kwargs)
        set_ = set()
        for _ in range(MAX_HOP):
            p = _plan(resp, kwargs, set_)
            if p is None:
                break
            req = self.build_request("POST", p["url"], data=p["felter"], headers=_headers(resp))
            resp = await orig_async(self, req, *args, **kwargs)
        return resp

    def send_sync(self, request, *args, **kwargs):
        resp = orig_sync(self, request, *args, **kwargs)
        set_ = set()
        for _ in range(MAX_HOP):
            p = _plan(resp, kwargs, set_)
            if p is None:
                break
            req = self.build_request("POST", p["url"], data=p["felter"], headers=_headers(resp))
            resp = orig_sync(self, req, *args, **kwargs)
        return resp

    httpx.AsyncClient.send = send_async
    httpx.Client.send = send_sync
    httpx._familieoverblik_aula_forms = True
    return True
