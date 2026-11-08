"""Prøver docker/aula/brev.py: ugebrevets HTML → brødtekst og skema (med en opdigtet kopi af brevets opbygning; ingen rigtige navne eller skoledata)."""
import os, sys
_R = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); sys.path.insert(0, os.path.join(_R, "docker", "aula")); sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import brev as B
ok_all = True
def t(n, c, x=""):
    global ok_all; ok_all &= bool(c); print("ok  " if c else "FEJL", n, "" if c else x)
from brevfix import cell, raekke, PAUSE, BREV
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
sys.exit(0 if ok_all else 1)
