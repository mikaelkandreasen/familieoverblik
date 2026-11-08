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
