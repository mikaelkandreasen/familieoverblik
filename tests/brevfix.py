"""Et opdigtet ugebrev med samme opbygning som et rigtigt (skema i en tabel, brev bagefter). Ingen rigtige navne eller skoledata."""
def cell(*linjer): return "<td>" + "".join(f"<p>{l}</p>" for l in linjer) + "</td>"
def raekke(tid, *celler): return f"<tr><td>{tid}</td>" + "".join(celler) + "</tr>"
PAUSE = cell("Pause")
BREV = ('<div><h2>Barn 4A</h2><span>uge 46</span></div>'
  '<table><tr><th>Uge 46</th><th>Mandag</th><th>Tirsdag</th><th>Onsdag</th><th>Torsdag</th><th>Fredag</th></tr>'
  + raekke("7:45-8:30", cell("Billedkunst (AA, BB)", "Linoleumstryk."), cell("Matematik (AA, BB)", "Grundbog s. 30."), cell("Historie (AA, BB)", "Sundhed.", "Gentaget læsning."), cell("Fortælletime (AA, BB)"), cell("Dansk (AA, BB)", "Fantasy."))
  + raekke("8:30-9:15", cell("Billedkunst (AA, BB)", "DO."), cell("Matematik (AA, BB)", "DO."), cell("Historie (AA, BB)", "DO."), cell("N/T (CC, DD)"), cell("Dansk (AA, BB)", "DO."))
  + raekke("9:15-9:35", *[PAUSE] * 5)
  + raekke("9:35-10:20", cell("HDS (EE, AA)", "Symaskiner."), cell("Svømning", "Husk svømmetøj"), cell("A: Engelsk (KS)", "B: Matematik (AA)", "Værksted."), "<td></td>", cell("N/T (CC, DD)"))
  + raekke("10:20-11:15", cell("HDS (EE, AA)", "DO."), cell("Svømning", "DO."), cell("A: Engelsk (KS)", "B: Matematik (AA)", "DO."), "<td></td>", cell("N/T (CC, DD)", "DO."))
  + raekke("12:30-13:15", cell("Dansk (AA, BB)", "A: Bibliotek", "B: Tid til læseforståelse"), cell("Dansk (AA, BB, CC)", "DO."), cell("A: Musik (TV)", "B: Dansk (AA)"), cell("Bibliotek"), "<td></td>")
  + '</table>'
  '<p>Kære forældre,</p><p><strong>Ugen der gik:</strong></p><p>Tak for en god skolefest.</p><p>Novemberlæsning: Vi læser højt.</p><p><strong>Ugen der kommer:</strong></p><p>Mere af det samme.</p><p>Med ønsket om en god weekend,</p><p>Team 4.</p>')


# ── en anden klasse: sammenflettede celler (rowspan), «samme» som ditto, ingen hilsen, overskrifter uden kolon ──
def c2(*linjer, rs=1, cs=1):
    ret = "<td" + (f' rowspan="{rs}"' if rs > 1 else "") + (f' colspan="{cs}"' if cs > 1 else "") + ">"
    return ret + "".join(f"<p>{l}</p>" for l in linjer) + "</td>"
TOM = "<td></td>"
BREV2 = ('<div>Barn 1Buge 46</div>'
  '<table><tr><th>Ugeplan for uge 46</th><th>Mandag</th><th>Tirsdag</th><th>Onsdag</th><th>Torsdag</th><th>Fredag</th></tr>'
  + raekke("7:45 - 8:00", c2("Morgenbånd"), c2("Morgenbånd"), c2("Morgenbånd"), c2("Fortælletime"), c2("Morgenbånd"))
  + raekke("8:00 - 8:30", c2("Dansk", "Skriv om din weekend"), c2("Matematik", "SuperMatematik"), c2("I er sammen med 0. klasse hele dagen", rs=5), c2("Idræt", rs=2), c2("SuperMatematik"))
  + raekke("8:30 - 9:15", c2("Dansk", "Arbejdsbogen s.15"), c2("Musik"), c2("Dansk", "bibliotekstime"))
  + raekke("9:15 - 9:35", TOM, TOM, TOM, TOM)
  + raekke("9:35 – 10:20", c2("Dansk", "stationer"), c2("UUV", "Vi arbejder med materialet", "Denne uge: PYT"), c2("Dansk", "stationer"), c2("Matematik", "Stationer"))
  + raekke("10:20 – 11:05", c2("Dansk", "samme"), c2("UUV", "Samme"), c2("Dansk", "samme"), c2("Matematik"))
  + raekke("11:05 – 11:45", TOM, TOM, TOM, TOM, TOM)
  + raekke("11:45 – 12:30", c2("Natur og Teknik", "Årstider"), c2("Kristendom", "En fortælling"), c2("Kristendom", "Tegneopgave"), c2("Dansk", "Anna og Peter/ PC"), TOM)
  + raekke("12:30 – 13:15", TOM, TOM, TOM, TOM, TOM)
  + raekke("13:25 – 14:10", TOM, TOM, TOM, TOM, TOM)
  + "<tr><td>HUSK!</td>" + c2("Have genlæst s.24-25") + c2("Biblioteksbøger") + c2("Have genlæst s.26-27") + c2("Idrætstøj, sko og håndklæde") + TOM + "</tr>"
  + '</table>'
  '<p>Ugen der gik</p><p>Tak for en hyggelig skolefest.</p><p>Ugen der kommer</p><p>Onsdag er vi sammen med 0. klasse.</p><p>Der er varslet brandøvelse i 5. lektion.</p><p>Ekstra</p><p>En vikar overtager i januar.</p><p>Venlig hilsen</p><p>Team 1.</p>')
