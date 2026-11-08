"""
aula_login_forms.py — de to sider, Unilogin-broker'en kan vise EFTER MitID-godkendelsen.

Efter MitID kan login-kæden lande på en side med en formular, som en browser ville udfylde:

  1. Rolle:        formularen har et felt  selected-aktoer.  For en forælder skal det være  KONTAKT.
  2. Bekræftelse:  formularen har knappen  #confirmation-button  (værdien ACCEPT). Den skal sendes for at komme videre.

aula-biblioteket kender ikke nødvendigvis de to sider. Det her lægger sig i httpx (som biblioteket bruger),
og når et svar fra broker.unilogin.dk eller login.aula.dk er en af de to formularer, sender det formularen
og giver biblioteket svaret på selve afsendelsen, som om siden aldrig havde været der. Alt andet røres ikke.
SAML-sider (med SAMLResponse) har hverken selected-aktoer eller en bekræftelsesknap og lades urørt.

Billeder: Aulas login loader et billede (typisk et lille sporingsbillede, der sætter en cookie), og først bagefter sendes man videre. En browser gør det af sig selv;
aula-biblioteket gør det ikke. Efter en formular, tilføjelsen har sendt, hentes derfor billederne på svarsiden (<img src> og JavaScript-billeder: new Image().src = …)
FØR omdirigeringen følges og siden gives til biblioteket. Kun https og kun værter hos Aula og Unilogin; højst 6 pr. side.

Efter hver formular, tilføjelsen har sendt, skrives en linje om SVARET (adresse uden query, titel, tekst, formularernes feltnavne og knapper, links og
omdirigeringer, aldrig værdier), så man kan se, hvor login-kæden stopper. Svarer broker'en med en HTTP-omdirigering (302) eller en side UDEN formular, men med en omdirigering (meta refresh eller
JavaScript) til broker.unilogin.dk eller login.aula.dk, følges den (højst 3 gange), så biblioteket får den side, det venter (SAML-formularen).

Aktiveres af sitecustomize.py ved Pythons start. Indstillinger (miljøvariabler):
  AULA_LOGIN_PATCH   1 (standard) eller 0 for at slå det helt fra
  AULA_AKTOER        værdien til selected-aktoer. Standard KONTAKT
  AULA_ACCEPT_FELT   «navn=værdi» til bekræftelsen, hvis knappen ikke selv har et navn. Standard: intet
  AULA_LOGIN_DETALJER  1 (standard) skriver siderne og svarene ned (se ovenfor), 0 gør det stille
Hvad der gøres, skrives til stderr med forstavelsen «aula-login:». Bekræftelsessidens tekst skrives, så du kan se, hvad der accepteres.
"""
import os
import re
import sys
from html.parser import HTMLParser
from urllib.parse import urljoin, urlsplit

HOSTE = {"broker.unilogin.dk", "login.aula.dk"}
MAX_HOP = 4
MAX_FOELG = 6
HTTP_OMDIRIGERING = (301, 302, 303)          # følges med GET (som en browser gør efter en POST). 307 og 308 skal gentage POST'en og følges ikke.
MAX_BILLEDER = 6
ROLLE_FELT = "selected-aktoer"


def _log(tekst):
    print(f"aula-login: {tekst}", file=sys.stderr, flush=True)


# ─── HTML → formularer ────────────────────────────────────────────
class _Parser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.forms, self.form, self.select, self.knap = [], None, None, None
        self.tekst, self._skjul = [], 0
        self.titel, self._i_titel, self.links, self._link, self.meta_refresh = "", False, [], None, ""

    def handle_starttag(self, tag, attrs):
        a = {k: (v if v is not None else "") for k, v in attrs}
        if tag in ("script", "style"):
            self._skjul += 1
        if tag == "title":
            self._i_titel = True
        elif tag == "meta" and a.get("http-equiv", "").lower() == "refresh":
            self.meta_refresh = a.get("content", "")
        elif tag == "a" and a.get("href"):
            self._link = {"href": a["href"], "tekst": ""}
            self.links.append(self._link)
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
        if tag == "title":
            self._i_titel = False
        elif tag == "a":
            self._link = None
        if tag == "form":
            self.form = self.select = self.knap = None
        elif tag == "select":
            self.select = None
        elif tag == "button":
            self.knap = None

    def handle_data(self, data):
        if not self._skjul:
            self.tekst.append(data)
        if self._i_titel:
            self.titel += data
        if self._link is not None:
            self._link["tekst"] += data
        if self.knap is not None:
            self.knap["tekst"] += data
        if self.select is not None and self.select["valg"]:
            self.select["valg"][-1]["tekst"] += data


def laes_formularer(html):
    p = _Parser()
    p.feed(html)
    p.close()
    return p.forms, re.sub(r"\s+", " ", " ".join(p.tekst)).strip()


def laes_side(html):
    """Alt, der er værd at vide om en side, til loggen og til at finde en omdirigering. Aldrig feltværdier."""
    p = _Parser()
    p.feed(html)
    p.close()
    return {"forms": p.forms, "tekst": re.sub(r"\s+", " ", " ".join(p.tekst)).strip(), "titel": re.sub(r"\s+", " ", p.titel).strip(),
            "links": p.links, "meta_refresh": p.meta_refresh}


_META = re.compile(r"url\s*=\s*['\"]?([^'\";]+)", re.I)
_JS = re.compile(r"""(?:window\.|document\.|top\.|self\.)?location(?:\.href|\.assign|\.replace)?\s*(?:=|\()\s*["']([^"']+)["']""")


def find_omdirigering(html, url, side=None):
    """Hvor en side sender videre uden en formular: meta refresh eller JavaScript. Returnerer en fuld adresse eller None."""
    side = side or laes_side(html)
    m = _META.search(side["meta_refresh"] or "")
    mal = m.group(1).strip() if m else None
    if not mal:
        m = _JS.search(html)
        mal = m.group(1).strip() if m else None
    if not mal or mal.startswith(("#", "javascript:")):
        return None
    return urljoin(url, mal)


_IMG_TAG = re.compile(r"<img\b[^>]*>", re.I)
_IMG_SRC = re.compile(r"""\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))""", re.I)
_JS_SRC = re.compile(r"""\.src\s*=\s*["']([^"']+)["']""")


def find_billeder(html, url):
    """Adresserne på billeder, en browser ville hente: <img src> og JavaScript-billeder (…src = "…"). Fulde adresser, uden dubletter og uden data:-adresser."""
    kilder = []
    for tag in _IMG_TAG.findall(html):
        m = _IMG_SRC.search(tag)
        if m:
            kilder.append((m.group(1) or m.group(2) or m.group(3) or "").strip())
    kilder += [m.group(1).strip() for m in _JS_SRC.finditer(html)]
    ud = []
    for k in kilder:
        if not k or k.lower().startswith(("data:", "javascript:", "blob:")):
            continue
        a = urljoin(url, k)
        if a not in ud:
            ud.append(a)
    return ud


def _tilladt_billedvaert(host):
    h = (host or "").lower()
    return h in HOSTE or h in ("aula.dk", "unilogin.dk") or h.endswith((".aula.dk", ".unilogin.dk"))


def _sti(u):
    sp = urlsplit(u)
    return f"{sp.netloc}{sp.path}"                                   # uden query og #: de kan indeholde koder


def beskriv_svar(resp):
    """Én linje til loggen om et svar: status, adresse (uden query), titel, tekst, formularernes feltNAVNE og knapper, links og omdirigeringer."""
    url = str(resp.url)
    dele = [f"HTTP {getattr(resp, 'status_code', '?')} {_sti(url)}"]
    loc = resp.headers.get("location") or ""
    if loc:
        dele.append(f"→ {_sti(urljoin(url, loc))}")
    if "html" not in (resp.headers.get("content-type") or "").lower():
        dele.append(f"({(resp.headers.get('content-type') or 'ukendt type').split(';')[0]})")
        return "svar: " + " · ".join(dele)
    side = laes_side(resp.text)
    if side["titel"]:
        dele.append(f"titel «{side['titel'][:80]}»")
    dele.append(f"tekst «{side['tekst'][:200]}»")
    fs = []
    for f in side["forms"]:
        navne = sorted({c["name"] for c in f["kontroller"] if c["name"]})
        knapper = [((c.get("tekst") or "").strip() or c["value"])[:24] for c in f["kontroller"] if _er_sendeknap(c)]
        fs.append(f"{f['method'].upper()} {_sti(urljoin(url, f['action'] or url))} felter: {','.join(navne) or 'ingen'}; knapper: {','.join(k for k in knapper if k) or 'ingen'}")
    dele.append(("formularer: " + " | ".join(fs)) if fs else "INGEN formularer")
    if side["links"]:
        dele.append("links: " + ", ".join(f"{(l['tekst'].strip() or '?')[:20]}→{_sti(urljoin(url, l['href']))}" for l in side["links"][:6]))
    bill = find_billeder(resp.text, url)
    if bill:
        dele.append("billeder: " + ", ".join(_sti(b) for b in bill[:MAX_BILLEDER]) + (f" (+{len(bill) - MAX_BILLEDER})" if len(bill) > MAX_BILLEDER else ""))
    om = find_omdirigering(resp.text, url, side)
    if om:
        dele.append(f"omdirigering til {_sti(om)}")
    return "svar: " + " · ".join(dele)


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
    _log_svar(resp, f"{p['type']}-siden")
    if p["type"] == "rolle":
        _log(f"vælger rollen {p['felter'][ROLLE_FELT]} ({ROLLE_FELT})")
    else:
        _log(f"accepterer bekræftelsessiden. Siden siger: «{p['tekst'][:300]}». Felter sendt: {', '.join(sorted(p['felter'])) or 'ingen'}")
    return p


def _detaljer():
    return os.environ.get("AULA_LOGIN_DETALJER", "1").strip() != "0"


def _log_svar(resp, hvad):
    if _detaljer():
        try:
            _log(f"{hvad}: {beskriv_svar(resp)[len('svar: '):]}")
        except Exception as e:                                            # loggen må aldrig vælte et login
            _log(f"{hvad}: kunne ikke beskrives ({e})")


def _omdirigering_at_foelge(resp, kwargs):
    """Adressen, hvis svaret er en HTML-side uden formular, der sender videre til broker'en eller Aula. Ellers None."""
    if not _skal_roeres(resp, kwargs):
        return None
    side = laes_side(resp.text)
    if side["forms"]:
        return None
    mal = find_omdirigering(resp.text, str(resp.url), side)
    if not mal:
        return None
    if urlsplit(mal).scheme != "https" or (urlsplit(mal).hostname or "").lower() not in HOSTE:
        _log(f"svaret har ingen formular og sender videre til {_sti(mal)}, men det er ikke broker'en eller Aula. Følges ikke.")
        return None
    return mal


def _http_omdirigering(resp, kwargs):
    """Målet, hvis selve svaret er en HTTP-omdirigering (302) til broker'en eller Aula. Biblioteket venter en side med en formular og kan ikke bruge en tom omdirigering
    (det gav «No form found in page», efter at vi havde accepteret bekræftelsessiden: Aula svarede med en 302 til after-post-broker-login). Andre mål følges ikke."""
    if kwargs.get("stream"):
        return None
    status = getattr(resp, "status_code", 0)
    lok = resp.headers.get("location") or ""
    if not lok or status not in HTTP_OMDIRIGERING:
        if lok and status in (307, 308):
            _log(f"svaret er en omdirigering (HTTP {status}) til {_sti(urljoin(str(resp.url), lok))}, men den skal gentage POST'en, og det gør tilføjelsen ikke. Følges ikke.")
        return None
    if (urlsplit(str(resp.url)).hostname or "").lower() not in HOSTE:
        return None
    mal = urljoin(str(resp.url), lok)
    if urlsplit(mal).scheme != "https" or (urlsplit(mal).hostname or "").lower() not in HOSTE:
        _log(f"svaret er en omdirigering (HTTP {status}) til {_sti(mal)}, men det er ikke broker'en eller Aula. Følges ikke.")
        return None
    return mal


def _billeder_at_hente(resp, kwargs):
    """Billederne på en HTML-svarside fra broker'en eller Aula, som skal hentes, før man går videre. Andre værter og http hentes ikke."""
    if not _skal_roeres(resp, kwargs):
        return []
    ud = []
    for b in find_billeder(resp.text, str(resp.url)):
        sp = urlsplit(b)
        if sp.scheme == "https" and _tilladt_billedvaert(sp.hostname):
            ud.append(b)
        else:
            _log(f"billedet {_sti(b)} hentes ikke (ikke https hos Aula eller Unilogin).")
    if len(ud) > MAX_BILLEDER:
        _log(f"siden har {len(ud)} billeder. Henter kun de første {MAX_BILLEDER}.")
    return ud[:MAX_BILLEDER]


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
        set_, sendt, foelg, poster = set(), False, 0, 0
        for _ in range(MAX_HOP + MAX_FOELG + 2):                  # en side kan være en formular, en omdirigering, en ny formular …: skiftevis, med en fast grænse
            p = _plan(resp, kwargs, set_) if poster < MAX_HOP else None            # højst MAX_HOP formularer i alt
            if p is not None:
                req = self.build_request("POST", p["url"], data=p["felter"], headers=_headers(resp))
                resp = await orig_async(self, req, *args, **kwargs)
                sendt = True
                poster += 1
                _log_svar(resp, "efter afsendelse")
                continue
            if not sendt:
                break
            for b in _billeder_at_hente(resp, kwargs):
                try:
                    br = await orig_async(self, self.build_request("GET", b, headers={**_headers(resp), "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8"}), *args, **{**kwargs, "follow_redirects": True})
                    _log(f"billede hentet: {_sti(b)} (HTTP {getattr(br, 'status_code', '?')})")
                except Exception as e:                                       # et billede, der ikke kan hentes, må ikke vælte login
                    _log(f"billedet {_sti(b)} kunne ikke hentes ({type(e).__name__}). Går videre.")
            if foelg >= MAX_FOELG:
                break
            http = _http_omdirigering(resp, kwargs)
            mal = http or _omdirigering_at_foelge(resp, kwargs)
            if mal is None:
                break
            foelg += 1
            _log(f"svaret er en omdirigering (HTTP {resp.status_code}) til {_sti(mal)}. Følger den." if http else f"svaret har ingen formular, men en omdirigering til {_sti(mal)}. Følger den.")
            resp = await orig_async(self, self.build_request("GET", mal, headers=_headers(resp)), *args, **kwargs)
            _log_svar(resp, "efter omdirigering")
        return resp

    def send_sync(self, request, *args, **kwargs):
        resp = orig_sync(self, request, *args, **kwargs)
        set_, sendt, foelg, poster = set(), False, 0, 0
        for _ in range(MAX_HOP + MAX_FOELG + 2):                  # en side kan være en formular, en omdirigering, en ny formular …: skiftevis, med en fast grænse
            p = _plan(resp, kwargs, set_) if poster < MAX_HOP else None            # højst MAX_HOP formularer i alt
            if p is not None:
                req = self.build_request("POST", p["url"], data=p["felter"], headers=_headers(resp))
                resp = orig_sync(self, req, *args, **kwargs)
                sendt = True
                poster += 1
                _log_svar(resp, "efter afsendelse")
                continue
            if not sendt:
                break
            for b in _billeder_at_hente(resp, kwargs):
                try:
                    br = orig_sync(self, self.build_request("GET", b, headers={**_headers(resp), "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8"}), *args, **{**kwargs, "follow_redirects": True})
                    _log(f"billede hentet: {_sti(b)} (HTTP {getattr(br, 'status_code', '?')})")
                except Exception as e:                                       # et billede, der ikke kan hentes, må ikke vælte login
                    _log(f"billedet {_sti(b)} kunne ikke hentes ({type(e).__name__}). Går videre.")
            if foelg >= MAX_FOELG:
                break
            http = _http_omdirigering(resp, kwargs)
            mal = http or _omdirigering_at_foelge(resp, kwargs)
            if mal is None:
                break
            foelg += 1
            _log(f"svaret er en omdirigering (HTTP {resp.status_code}) til {_sti(mal)}. Følger den." if http else f"svaret har ingen formular, men en omdirigering til {_sti(mal)}. Følger den.")
            resp = orig_sync(self, self.build_request("GET", mal, headers=_headers(resp)), *args, **kwargs)
            _log_svar(resp, "efter omdirigering")
        return resp

    httpx.AsyncClient.send = send_async
    httpx.Client.send = send_sync
    httpx._familieoverblik_aula_forms = True
    return True
