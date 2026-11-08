"""Prøver docker/aula/brev.py: ugebrevets HTML → brødtekst og skema (med en opdigtet kopi af brevets opbygning; ingen rigtige navne eller skoledata)."""
import os, sys
_R = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); sys.path.insert(0, os.path.join(_R, "docker", "aula")); sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import brev as B
ok_all = True
def t(n, c, x=""):
    global ok_all; ok_all &= bool(c); print("ok  " if c else "FEJL", n, "" if c else x)
from brevfix import cell, raekke, PAUSE, BREV, BREV2, c2, TOM
tab, lin = B.laes_html(BREV)
t("én tabel med 7 rækker (overskrift, 5 timer, pause, …) og brevets tekst uden for tabellen som linjer", len(tab) == 1 and len(tab[0]) == 7 and lin[:3] == ["Barn 4A", "uge 46", "Kære forældre,"] and lin[-1] == "Team 4.", (len(tab), [len(r) for r in tab[0]], lin[:4]))
t("hver celle er en liste af linjer, og en tom celle er tom (men der)", tab[0][1][1] == ["Billedkunst (AA, BB)", "Linoleumstryk."] and tab[0][4][4] == [] and len(tab[0][4]) == 6)
plan = B.find_plan(tab)
t("skemaet findes: 5 dage, 6 rækker med klokkeslæt, og tiderne er rigtige (start/slut som HH.MM)", plan and plan["dage"] == [1, 2, 3, 4, 5] and len(plan["raekker"]) == 6 and plan["raekker"][0]["tid"] == "7:45-8:30" and plan["raekker"][0]["start"] == "07.45" and plan["raekker"][0]["slut"] == "08.30", plan and plan["raekker"][0])
t("en tom celle beholder pladsen: torsdag i 9:35-rækken findes ikke, men fredag er fredag (ikke rykket frem)", "4" not in plan["raekker"][3]["celler"] and plan["raekker"][3]["celler"]["5"][0].startswith("N/T") and plan["raekker"][3]["celler"]["1"][0].startswith("HDS"))
les = B.plan_til_lektioner(plan, "Barn")
mon = les["1"]
t("«DO.» forlænger timen før: billedkunst mandag er én lektion 07.45–09.15, og pausen er ingen lektion", [(x["start"], x["end"], x["title"]) for x in mon][:2] == [("07.45", "09.15", "Billedkunst"), ("09.35", "11.15", "HDS")] and not any("ause" in x["title"] for d in les.values() for x in d), mon)
t("lærernes forbogstaver er væk overalt (titel og note), men fagets navn og noten er der", all("(" not in x["title"] and "(" not in x.get("note", "") for d in les.values() for x in d) and mon[0]["note"] == "Linoleumstryk." and les["2"][1]["title"] == "Svømning" and les["2"][1]["note"] == "Husk svømmetøj")
t("to hold i samme time (A:/B:) står sammen i titlen, og en ekstra linje bliver note", les["3"][1]["title"] == "A: Engelsk / B: Matematik" and les["3"][1]["note"] == "Værksted." and les["3"][1]["end"] == "11.15")
t("et fag med A:/B:-linjer UNDER sig beholder faget som titel og lægger holdene i noten", [x for x in les["1"] if x["start"] == "12.30"][0]["title"] == "Dansk" and "A: Bibliotek" in [x for x in les["1"] if x["start"] == "12.30"][0]["note"])
t("en tom celle midt i dagen giver ingen lektion (torsdag 9:35–11:15), og en lektion efter en «DO.» lægges ikke ved den forkerte dag", [x["title"] for x in les["4"]] == ["Fortælletime", "N/T", "Bibliotek"], [x["title"] for x in les["4"]])
t("fredag er sin egen: Dansk, så N/T, ingen sidste time (tom celle)", [(x["start"], x["title"]) for x in les["5"]] == [("07.45", "Dansk"), ("09.35", "N/T")] and [x["end"] for x in les["5"]] == ["09.15", "11.15"], les["5"])
t("lektionerne har barnets navn og samme felter som lektioner fra kalenderen (child, start, end, title, room, sub)", all(x["child"] == "Barn" and set(["child", "start", "end", "title", "room", "sub"]) <= set(x) and x["room"] == "" and x["sub"] is False for d in les.values() for x in d))
sk = B.plan_til_skole(plan, "Barn")
t("skolelinjen pr. dag er første start til sidste slut, og Idræt-flaget kommer, hvor der er svømning", sk["1"][0]["hours"] == "07.45-13.15" and sk["2"][0]["flags"] == ["Idræt"] and sk["1"][0]["flags"] == [] and sk["6"] == [] and sk["4"][0]["hours"].startswith("07.45"), sk["2"])
brod, p2 = B.laes_brev(BREV)
t("brødteksten starter ved hilsenen: overskriftslinjerne («Barn 4A», «uge 46») og alt i tabellen er væk, og afsnittene er bevaret", brod.split("\n")[0] == "Kære forældre," and "Billedkunst" not in brod and "Barn 4A" not in brod and "Ugen der gik:" in brod and brod.endswith("Team 4.") and p2 is not None, brod[:80])
# uden skema
ren = '<p>Kære forældre,</p><p>Husk tøj til tur.</p><ul><li>Madpakke</li><li>Drikkedunk</li></ul><p>Hilsen&nbsp;Team</p>'
b3, p3 = B.laes_brev(ren)
t("et brev uden tabel er bare brødtekst (punkter med •, uden skjulte mellemrum) og har intet skema", p3 is None and b3 == "Kære forældre,\nHusk tøj til tur.\n• Madpakke\n• Drikkedunk\nHilsen Team", b3)
t("en tabel uden klokkeslæt (fx en indkøbsliste) er ikke et skema og røres ikke: teksten i den forsvinder ikke ved et uheld", (lambda r: r[1] is None)(B.laes_brev("<p>Hej</p><table><tr><td>Mælk</td><td>2 L</td></tr><tr><td>Brød</td><td>1</td></tr></table>")))
t("en tabel med kun ÉN tidsrække er ikke et skema", B.find_plan(B.laes_html("<table><tr><td>8:00-9:00</td><td>x</td></tr></table>")[0]) is None)
# uden overskriftsrække: kolonnerne efter tiden er mandag, tirsdag, …
u = '<table>' + raekke("8:00-8:45", cell("Dansk"), cell("Mat"), cell("Eng")) + raekke("8:45-9:30", cell("Mat"), cell("Dansk"), cell("Eng")) + '</table>'
pu = B.find_plan(B.laes_html(u)[0])
t("uden overskriftsrække: første kolonne efter tiden er mandag, og så fremdeles", pu and pu["raekker"][0]["celler"] == {"1": ["Dansk"], "2": ["Mat"], "3": ["Eng"]} and pu["dage"] == [1, 2, 3])
# colspan, manglende sluttags, indre tabeller, <br>
m = ('<table><tr><th>Tid</th><th>Mandag</th><th>Tirsdag</th><th>Onsdag</th></tr>'
     '<tr><td>8:00-8:45<td>Dansk<br>Læsning<td colspan=2>Tur til skoven'
     '<tr><td>8:45-9:30<td>Mat<td><table><tr><td>Eng</td></tr></table><td>Idræt</table>')
pm = B.find_plan(B.laes_html(m)[0])
t("HTML uden sluttags (</td>, </tr>) og med <br> læses stadig; colspan bevarer pladsen (onsdag er tom, når tirsdag spænder over to)", pm and pm["raekker"][0]["celler"] == {"1": ["Dansk", "Læsning"], "2": ["Tur til skoven"]} and pm["raekker"][1]["celler"]["1"] == ["Mat"], pm)
t("en indre tabel i en celle flades ud i cellen", pm["raekker"][1]["celler"]["2"] == ["Eng"] and pm["raekker"][1]["celler"]["3"] == ["Idræt"], pm["raekker"][1])
t("tider med punktum og tankestreg (08.30–09.15) kendes også, og urealistiske klokkeslæt (25:00) gør det ikke", B.find_plan(B.laes_html("<table><tr><td>Mandag</td></tr>" + raekke("08.30–09.15", cell("a")) + raekke("09.15–10.00", cell("b")) + "</table>")[0]) is not None and B.find_plan(B.laes_html("<table>" + raekke("25:00-26:00", cell("a")) + raekke("26:00-27:00", cell("b")) + "</table>")[0]) is None)
t("script, style og skjult hoved bliver ikke til tekst", B.laes_html("<head><title>T</title><style>.x{}</style></head><script>var a=1</script><p>Hej</p>")[1] == ["Hej"])
def _stille(x):
    try:
        r = B.laes_html(x); return isinstance(r, tuple) and isinstance(r[0], list) and isinstance(r[1], list)
    except Exception:
        return False
t("skrald giver tomt eller tekst og aldrig en fejl (None, tom tekst, halve tags, bare tekst, en tabel der aldrig lukkes)", all(_stille(x) for x in (None, "", "<<<>>>", "bare tekst", "<table><tr><td>x", "</td></tr></table>", "<td>løs celle</td>")) and B.laes_brev("<table><tr><td>x") == ("", None) and B.laes_html(None) == ([], []))
t("krop uden hilsen: korte «uge nn»-linjer foran springes over, resten er brevet", B.krop(["Barn 4A uge 46", "Uge 46", "Husk tøj."], True) == "Husk tøj." and B.krop(["Barn 4A uge 46", "Husk tøj."], False) == "Barn 4A uge 46\nHusk tøj.")
# skelettet viser opbygningen uden tekst
sk = B.skelet(BREV)
t("skelettet viser tags og tekstmængde, men ingen tekst fra brevet (hverken fag, navne eller brødtekst)", "<table>" in sk and "<td>" in sk and "[tekst" in sk and not any(x in sk for x in ("Billedkunst", "Kære", "Barn", "Svømning", "skolefest")), sk[:300])
t("skelettet afkortes, så det er til at sende", len(B.skelet(BREV * 20, maks=500)) < 600)
# ═══ anden klasse: sammenflettede celler, «samme», ingen hilsen, overskrifter uden kolon ═══
tab2, lin2 = B.laes_html(BREV2)
p2 = B.find_plan(tab2)
t("rowspan: rækken efter en sammenflettet celle har stadig fem dagspladser; onsdag og torsdag er dækket (ikke tomme), og fredag står på fredags plads", p2 and len(tab2[0][3]) == 6 and tab2[0][3][5] == ["Dansk", "bibliotekstime"] and (3, 3) in tab2[0].daekket and (3, 4) in tab2[0].daekket and tab2[0].spaend == {(2, 3): 5, (2, 4): 2}, (tab2[0][3], tab2[0].spaend, tab2[0].daekket))
t("find_plan holder rede på dækkede dage og spænd pr. række", p2["raekker"][1]["spaend"] == {"3": 5, "4": 2} and p2["raekker"][2]["daekket"] == ["3", "4"] and p2["raekker"][2]["celler"]["5"] == ["Dansk", "bibliotekstime"] and p2["raekker"][4]["daekket"] == ["3"], [(r["tid"], r["daekket"]) for r in p2["raekker"]][:5])
t("tider med mellemrum omkring bindestregen (7:45 - 8:00) og tankestreg (9:35 – 10:20) kendes, og rækken «HUSK!» er ikke en time", [r["tid"] for r in p2["raekker"]][:3] == ["7:45 - 8:00", "8:00 - 8:30", "8:30 - 9:15"] and all(r["tid"] != "HUSK!" for r in p2["raekker"]) and len(p2["raekker"]) == 10, [r["tid"] for r in p2["raekker"]])
l2 = B.plan_til_lektioner(p2, "Barn")
t("en celle, der strækker sig over fem rækker (onsdag), er én lektion fra 08.00 til 11.05, med hele teksten som titel", ("08.00", "11.05", "I er sammen med 0. klasse hele dagen") in [(x["start"], x["end"], x["title"]) for x in l2["3"]] and len([x for x in l2["3"] if x["start"] < "11.05" and x["end"] > "08.00" and x["title"] != "Morgenbånd"]) == 1, l2["3"])
t("torsdag: Idræt over to rækker er 08.00–09.15, og den efterfølgende time står på torsdag (ikke rykket)", [(x["start"], x["end"], x["title"]) for x in l2["4"]][:3] == [("07.45", "08.00", "Fortælletime"), ("08.00", "09.15", "Idræt"), ("09.35", "10.20", "Dansk")] or [(x["start"], x["end"], x["title"]) for x in l2["4"]], [(x["start"], x["end"], x["title"]) for x in l2["4"]])
t("fredag: biblioteksdansk kl. 8.30 står på fredag, og matematik efter pausen også (kolonnerne rykker ikke mod venstre efter de sammenflettede celler)", ("08.30", "09.15", "Dansk") in [(x["start"], x["end"], x["title"]) for x in l2["5"]] and ("09.35", "10.20", "Matematik") in [(x["start"], x["end"], x["title"]) for x in l2["5"]], [(x["start"], x["end"], x["title"]) for x in l2["5"]])
t("«samme» (og «Samme») er ditto og forlænger timen før: mandags dansk 9.35 varer til 11.05, tirsdags UUV også, og noten «samme» bliver ikke en note", [(x["start"], x["end"]) for x in l2["1"] if x["title"] == "Dansk" and x["start"] == "09.35"] == [("09.35", "11.05")] and [(x["start"], x["end"]) for x in l2["2"] if x["title"] == "UUV"] == [("09.35", "11.05")] and all(x.get("note", "") != "samme" for d in l2.values() for x in d), l2["1"])
t("tomme rækker (pauser og fridage uden tekst) giver ingen lektioner, og «HUSK!»-rækken heller ikke", all(x["start"] not in ("09.15", "11.05", "12.30", "13.25") for d in l2.values() for x in d))
t("note og titel: «Dansk / Skriv om din weekend» → titel Dansk, note «Skriv om din weekend»; tre linjer samles i noten med ·", [x for x in l2["1"] if x["start"] == "08.00"][0]["note"] == "Skriv om din weekend" and [x for x in l2["2"] if x["title"] == "UUV"][0]["note"] == "Vi arbejder med materialet · Denne uge: PYT", [x for x in l2["2"] if x["title"] == "UUV"])
brod2, plan2 = B.laes_brev(BREV2)
t("et brev UDEN hilsen begynder ved «Ugen der gik»: «Barn 1Buge 46» (uden ordgrænse før «uge») og alt i tabellen er væk, og afslutningen er med", brod2.split("\n")[0] == "Ugen der gik" and "1Buge" not in brod2 and "Morgenbånd" not in brod2 and brod2.endswith("Venlig hilsen\nTeam 1.") and plan2 is not None, brod2[:80])
t("krop: uden hilsen og uden «Ugen der» fjernes korte overskriftslinjer, der ender på «uge nn» eller starter med «Ugeplan», også «1Buge 46»", B.krop(["Barn 1Buge 46", "Ugeplan for uge 46", "Husk tøj."], True) == "Husk tøj." and B.krop(["Barn 1Buge 46", "Husk tøj."], True) == "Husk tøj.")
t("«samme» og «Ditto» er ditto, men «samme som mandag» og «samme tid» er almindelig tekst", all(B.DO.match(x) for x in ("samme", "Samme", "DO.", "do", "ditto", "Samme.")) and not any(B.DO.match(x) for x in ("samme som mandag", "samme tid", "sammen", "Dokumentar")))
# rowspan og colspan sammen, i en lille tabel
lille = '<table><tr><td>Tid</td><td>Mandag</td><td>Tirsdag</td><td>Onsdag</td></tr><tr><td>8:00-9:00</td><td rowspan=2>A</td><td colspan=2>B</td></tr><tr><td>9:00-10:00</td><td>C</td><td>D</td></tr><tr><td>10:00-11:00</td><td>E</td><td>F</td><td>G</td></tr></table>'
tl = B.laes_html(lille)[0][0]; pl = B.find_plan([tl])
t("rowspan og colspan sammen: B dækker tirsdag og onsdag, A dækker mandag i to rækker, så C og D rykker til tirsdag og onsdag", pl["raekker"][0]["celler"] == {"1": ["A"], "2": ["B"]} and pl["raekker"][1]["celler"] == {"2": ["C"], "3": ["D"]} and pl["raekker"][1]["daekket"] == ["1"] and pl["raekker"][2]["celler"] == {"1": ["E"], "2": ["F"], "3": ["G"]}, [r["celler"] for r in pl["raekker"]])
t("A varer over to rækker (08.00–10.00), og E starter kl. 10", (lambda l: [(x["title"], x["start"], x["end"]) for x in l["1"]] == [("A", "08.00", "10.00"), ("E", "10.00", "11.00")])(B.plan_til_lektioner(pl, "Barn")))
t("en rowspan, der går ud over tabellens sidste række, giver ingen fejl og slutter ved den sidste række", (lambda p: B.plan_til_lektioner(p, "Barn")["1"][0]["end"] == "10.00")(B.find_plan(B.laes_html('<table><tr><td>Tid</td><td>Mandag</td></tr><tr><td>8:00-9:00</td><td rowspan=9>X</td></tr><tr><td>9:00-10:00</td></tr></table>')[0])))
t("tvivlsomme rowspan/colspan-værdier (0, tekst, negative, enorme) giver ingen fejl", B.laes_html('<table><tr><td rowspan="x">a</td><td colspan="0">b</td><td rowspan="-3">c</td><td colspan="99999">d</td></tr></table>')[0] is not None)
sys.exit(0 if ok_all else 1)
