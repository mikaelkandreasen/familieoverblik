"""Falsk httpx: kun det, aula_login_forms bruger. Afspejler min antagelse om httpx' API; ikke det rigtige bibliotek."""
__version__ = "0.0-fake"
from urllib.parse import urlsplit
class URL(str): pass
class Request:
    def __init__(self, method, url, data=None, headers=None): self.method, self.url, self.data, self.headers = method, URL(url), data, headers or {}
class Response:
    def __init__(self, url, status=200, text="", ctype="text/html; charset=utf-8", location=None):
        self.url = URL(url); self.status_code = status; self.text = text
        self.headers = {"content-type": ctype}
        if location: self.headers["location"] = location
class _Base:
    def build_request(self, method, url, data=None, headers=None): return Request(method, url, data, headers)
SERVER = None   # sættes af testen: funktion(request, kwargs) -> Response
class AsyncClient(_Base):
    async def send(self, request, *args, **kwargs): return SERVER(request, kwargs)
class Client(_Base):
    def send(self, request, *args, **kwargs): return SERVER(request, kwargs)
