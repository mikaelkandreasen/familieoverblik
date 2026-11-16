"""kalendere.php: en kalender kan høre til en eller flere personer (to har samme link til holdet). PHP kan ikke køres her, så reglen er skrevet om i Python, prøvet grundigt, og PHP-koden er kontrolleret som tekst."""
import os, re, sys
_R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ok_all = True
def t(n, c, x=""):
    global ok_all; ok_all &= bool(c); print("ok  " if c else "FEJL", n, "" if c else x)
PHP = open(os.path.join(_R, "public_html", "kalendere.php"), encoding="utf-8").read()
def lower_ascii(s): return re.sub(r"[A-Z]", lambda m: m.group(0).lower(), s)       # PHPs strtolower rører kun ASCII
def kal_personer(v):
    """Samme regel som PHP-funktionen kal_personer."""
    if not isinstance(v, str): return ""
    ud = []
    for d in lower_ascii(v).split(","):
        d = d.strip(" \n\r\t\v\x00")                                    # PHPs trim
        if d == "": continue
        if not re.fullmatch(r"[a-z0-9æøå_-]{1,20}", d): return ""
        if d == "alle": return "alle"
        if d not in ud: ud.append(d)
    return ",".join(ud) if 1 <= len(ud) <= 10 else ""
t("én person (som før): «anna» og «Anna» giver «anna»", kal_personer("anna") == "anna" and kal_personer("Anna") == "anna" and kal_personer(" anna ") == "anna")
t("to personer med samme link: «lars,emma» gemmes som den står, og mellemrum, store bogstaver og tomme led rettes", kal_personer("lars,emma") == "lars,emma" and kal_personer(" Lars , EMMA ") == "lars,emma" and kal_personer("lars,,emma,") == "lars,emma")
t("dubletter fjernes (rækkefølgen bevares), og æ, ø og å og tal og streger er tilladt i et id", kal_personer("anna,Anna,peter,anna") == "anna,peter" and kal_personer("søren,åse,sofie_2,a-b") == "søren,åse,sofie_2,a-b")
t("«alle» står alene: er den med blandt andre, bliver det «alle», og «alle» alene er «alle»", kal_personer("alle") == "alle" and kal_personer("lars,alle") == "alle" and kal_personer("alle,lars,emma") == "alle" and kal_personer("ALLE") == "alle")
t("ingen valgt giver tom streng (ugyldigt): tom, kun mellemrum og kun kommaer", [kal_personer(x) for x in ("", "   ", ",", " , , ")] == ["", "", "", ""])
t("et id med ugyldige tegn afviser hele valget (mellemrum, punktum, skråstreg, citationstegn, <, store æøå som PHP ikke gør små), og så gør et for langt id (over 20 tegn)", all(kal_personer(x) == "" for x in ("an na", "a.b", "a/b", 'a"b', "a<b", "a'b", "a;b", "ÆØÅ", "lars,an na", "x" * 21)) and kal_personer("x" * 20) == "x" * 20)
t("højst 10 personer: ti går, elleve afvises", kal_personer(",".join(f"p{i}" for i in range(10))).count(",") == 9 and kal_personer(",".join(f"p{i}" for i in range(11))) == "")
t("noget, der ikke er tekst (liste, tal, tom, sand), afvises i stedet for at blive til «array»", all(kal_personer(x) == "" for x in (["anna"], {"a": 1}, 5, None, True, 1.5)))
t("indsprøjtning i feltet kommer ikke igennem (script, SQL, linjeskift, nul-byte midt i); en nul-byte i enden fjernes som af PHPs trim, så den er harmløs", all(kal_personer(x) == "" for x in ("<script>", "a'; drop table", "anna\nmikael", "an\0na", "anna;lars")) and kal_personer("anna\0") == "anna")
# PHP-koden
t("kalendere.php bruger funktionen i stedet for det gamle ene-id-tjek (det gamle regulære udtryk på hele feltet er væk)", "$person = kal_personer($in['person'] ?? '');" in PHP and "if ($person === '') kal_fail(400, \"Kalender $nr: vælg hvem den hører til\");" in PHP and "if (!preg_match('/^[a-z0-9æøå_-]{1,20}$/u', $person))" not in PHP)
t("PHP-funktionen gør det samme som Python-reglen: kun tekst, små ASCII-bogstaver, tomme led springes over, id'et tjekkes med samme udtryk, «alle» alene, ingen dubletter, 1 til 10", all(x in PHP for x in ("function kal_personer(mixed $v): string", "if (!is_string($v)) return '';", "foreach (explode(',', strtolower($v)) as $d) {", "$d = trim($d);", "if ($d === '') continue;", "if (!preg_match('/^[a-z0-9æøå_-]{1,20}$/u', $d)) return '';", "if ($d === 'alle') return 'alle';", "if (!in_array($d, $ud, true)) $ud[] = $d;", "return count($ud) >= 1 && count($ud) <= 10 ? implode(',', $ud) : '';")))
HENT = open(os.path.join(_R, "public_html", "hent.php"), encoding="utf-8").read()
t("hent.php giver hver kalenderpost personteksten uændret (så «lars,emma» når frem til forsiden), og intet andet sted i serverkoden antager ét id", "'who'      => $feed['person'] ?? ''," in HENT and not re.search(r"\$feed\['person'\]\s*[=!]==?\s*'", HENT))
sys.exit(0 if ok_all else 1)
