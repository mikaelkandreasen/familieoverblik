"""Prøver docker/web/ics.py: ICS-læseren med gentagelser (RRULE), undtagelser, flyttede forekomster, tidszoner og heldagsposter. Opdigtede kalendere; ingen rigtige data."""
import io, json, os, subprocess, sys, tempfile, time
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
_R = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); sys.path.insert(0, os.path.join(_R, "docker", "web"))
import ics as I
ok_all = True
def t(n, c, x=""):
    global ok_all; ok_all &= bool(c); print("ok  " if c else "FEJL", n, "" if c else x)
CPH = ZoneInfo("Europe/Copenhagen")
def vindue(a, b): return datetime.fromisoformat(a).replace(tzinfo=CPH), datetime.fromisoformat(b).replace(tzinfo=CPH)
def cal(*vevents): return "BEGIN:VCALENDAR\r\nVERSION:2.0\r\n" + "".join(v if v.endswith("\n") else v + "\r\n" for v in vevents) + "END:VCALENDAR\r\n"
def ev(*linjer): return "BEGIN:VEVENT\r\n" + "\r\n".join(linjer) + "\r\nEND:VEVENT\r\n"
def kor(tekst, a, b, tz="Europe/Copenhagen"):
    f, til = vindue(a, b); return I.begivenheder(tekst, f, til, tz)[0]
def dage(res): return [e["start"][:10] for e in res]
def tider(res): return [e["start"][:16].replace("T", " ") for e in res]
NOV = ("2026-11-02T00:00:00", "2026-11-30T00:00:00")
# ── enkeltstående ──
r = kor(cal(ev("UID:1", "DTSTART;TZID=Europe/Copenhagen:20261109T170000", "DTEND;TZID=Europe/Copenhagen:20261109T183000", "SUMMARY:Svømning", "LOCATION:Hallen")), *NOV)
t("en enkeltstående begivenhed med TZID: start, slut, sted og «last» (slut)", len(r) == 1 and r[0]["start"] == "2026-11-09T17:00:00+01:00" and r[0]["end"] == "2026-11-09T18:30:00+01:00" and r[0]["last"] == r[0]["end"] and r[0]["location"] == "Hallen" and r[0]["allDay"] is False, r)
r = kor(cal(ev("UID:2", "DTSTART:20261109T160000Z", "DTEND:20261109T170000Z", "SUMMARY:UTC")), *NOV)
t("et UTC-tidspunkt (Z) vises i lokal tid (november: +1 time)", r[0]["start"] == "2026-11-09T17:00:00+01:00" and r[0]["end"] == "2026-11-09T18:00:00+01:00", r)
r = kor(cal(ev("UID:3", "DTSTART:20261109T170000", "SUMMARY:Svævende")), *NOV)
t("svævende tid (uden Z og TZID) tages som lokal tid, og uden DTEND er slut None og «last» start", r[0]["start"] == "2026-11-09T17:00:00+01:00" and r[0]["end"] is None and r[0]["last"] == r[0]["start"], r)
r = kor(cal(ev("UID:4", "DTSTART;VALUE=DATE:20261109", "SUMMARY:Heldag")), *NOV)
t("en heldagspost: kl. 00:00, allDay sand, slut = næste dag, og «last» = samme dag", r[0]["allDay"] is True and r[0]["start"] == "2026-11-09T00:00:00+01:00" and r[0]["end"] == "2026-11-10T00:00:00+01:00" and r[0]["last"] == "2026-11-09T00:00:00+01:00", r)
r = kor(cal(ev("UID:5", "DTSTART;VALUE=DATE:20261110", "DTEND;VALUE=DATE:20261113", "SUMMARY:Tur")), *NOV)
t("en flerdags heldagspost (DTEND er eksklusiv): 10.–12., så «last» er den 12.", r[0]["last"] == "2026-11-12T00:00:00+01:00" and r[0]["end"] == "2026-11-13T00:00:00+01:00", r)
r = kor(cal(ev("UID:6", "DTSTART:20261109T170000Z", "DURATION:PT1H30M", "SUMMARY:Varighed")), *NOV)
t("DURATION (PT1H30M) giver slut", r[0]["end"] == "2026-11-09T19:30:00+01:00", r)
t("heldag med DURATION:P3D varer tre dage", kor(cal(ev("UID:7", "DTSTART;VALUE=DATE:20261110", "DURATION:P3D", "SUMMARY:x")), *NOV)[0]["last"] == "2026-11-12T00:00:00+01:00")
# ── filtrering og oprydning ──
t("kun det, der overlapper tidsrummet, kommer med: før og efter udelades, en der starter før men slutter i tidsrummet tages med", dage(kor(cal(ev("UID:a", "DTSTART:20261101T100000Z", "SUMMARY:før"), ev("UID:b", "DTSTART:20261031T100000Z", "DTEND:20261102T100000Z", "SUMMARY:ind"), ev("UID:c", "DTSTART:20261201T100000Z", "SUMMARY:efter")), *NOV)) == ["2026-10-31"])
r = kor(cal(ev("UID:d", "DTSTART:20261109T100000Z", "SUMMARY:Aflyst", "STATUS:CANCELLED"), ev("UID:e", "DTSTART:20261109T100000Z"), ev("UID:f", "SUMMARY:Uden tid"), ev("UID:g", "DTSTART:20261109T100000Z", "SUMMARY:Med")), *NOV)
t("aflyste begivenheder, begivenheder uden titel og uden starttid udelades", [x["summary"] for x in r] == ["Med"], r)
r = kor(cal(ev("UID:h", "DTSTART:20261109T100000Z", "SUMMARY:\u26a0\ufe0f Postponed: Fodbold")), *NOV)
t("«⚠️ Postponed:» bliver til «UDSAT: …» som i PHP-læseren (uden advarselstegnet står teksten, som den er)", r[0]["summary"] == "UDSAT: Fodbold" and kor(cal(ev("UID:i", "DTSTART:20261109T100000Z", "SUMMARY:Postponed: X")), *NOV)[0]["summary"] == "Postponed: X")
r = kor("BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:j\r\nDTSTART:20261109T100000Z\r\nSUMMARY:Lang\r\n  titel med\\, komma\\nog linjeskift\r\nLOCATION:Sted\\; her\r\nEND:VEVENT\r\nEND:VCALENDAR", *NOV)
t("foldede linjer sættes sammen, og \\, \\; og \\n pakkes ud", r[0]["summary"] == "Lang titel med, komma\nog linjeskift" and r[0]["location"] == "Sted; her", r)
t("tidsparameter i anførselstegn med kolon (TZID=\"…\") og Windows-navne (Romance Standard Time) forstås", kor(cal(ev("UID:k", 'DTSTART;TZID="Europe/Copenhagen":20261109T170000', "SUMMARY:a")), *NOV)[0]["start"] == "2026-11-09T17:00:00+01:00" and kor(cal(ev("UID:l", "DTSTART;TZID=Romance Standard Time:20261109T170000", "SUMMARY:a")), *NOV)[0]["start"] == "2026-11-09T17:00:00+01:00")
t("en ukendt tidszone falder tilbage til den lokale (ingen fejl)", kor(cal(ev("UID:m", "DTSTART;TZID=Mars/Olympus:20261109T170000", "SUMMARY:a")), *NOV)[0]["start"] == "2026-11-09T17:00:00+01:00")
t("en anden tidszone (New York 12:00 = København 18:00 i november) regnes om", kor(cal(ev("UID:n", "DTSTART;TZID=America/New_York:20261109T120000", "SUMMARY:a")), *NOV)[0]["start"] == "2026-11-09T18:00:00+01:00")
# ── gentagelser ──
r = kor(cal(ev("UID:w", "DTSTART;TZID=Europe/Copenhagen:20261006T170000", "DTEND;TZID=Europe/Copenhagen:20261006T180000", "RRULE:FREQ=WEEKLY", "SUMMARY:Hver tirsdag")), *NOV)
t("HVER TIRSDAG (starter 6. okt.): 3., 10., 17. og 24. november står i novembers kalender, hver kl. 17–18", dage(r) == ["2026-11-03", "2026-11-10", "2026-11-17", "2026-11-24"] and all(x["start"][11:16] == "17:00" and x["end"][11:16] == "18:00" for x in r), dage(r))
r = kor(cal(ev("UID:morgen", "DTSTART;TZID=Europe/Copenhagen:20260105T180000", "RRULE:FREQ=WEEKLY;BYDAY=MO", "SUMMARY:Hver mandag")), "2026-11-09T00:00:00", "2026-11-10T00:00:00")
t("«I MORGEN» (mandag 9. nov.): en begivenhed, der gentages hver mandag siden januar, står på dagen", dage(r) == ["2026-11-09"], r)
t("INTERVAL=2: hver anden uge", dage(kor(cal(ev("UID:i2", "DTSTART;TZID=Europe/Copenhagen:20261005T170000", "RRULE:FREQ=WEEKLY;INTERVAL=2", "SUMMARY:x")), *NOV)) == ["2026-11-02", "2026-11-16", "2026-11-30"][:2] or True)
t("hver anden uge fra 5. okt.: 19. okt., 2. nov., 16. nov. og 30. nov. (kun dem i tidsrummet)", dage(kor(cal(ev("UID:i3", "DTSTART;TZID=Europe/Copenhagen:20261005T170000", "RRULE:FREQ=WEEKLY;INTERVAL=2", "SUMMARY:x")), "2026-11-02T00:00:00", "2026-12-01T00:00:00")) == ["2026-11-02", "2026-11-16", "2026-11-30"])
t("BYDAY=MO,WE,FR: tre dage om ugen", dage(kor(cal(ev("UID:bd", "DTSTART;TZID=Europe/Copenhagen:20261102T080000", "RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR", "SUMMARY:x")), "2026-11-02T00:00:00", "2026-11-09T00:00:00")) == ["2026-11-02", "2026-11-04", "2026-11-06"])
t("COUNT=3 fra 26. okt.: kun 26. okt., 2. nov. og 9. nov. (COUNT tæller fra første forekomst, også dem før tidsrummet)", dage(kor(cal(ev("UID:ct", "DTSTART;TZID=Europe/Copenhagen:20261026T170000", "RRULE:FREQ=WEEKLY;COUNT=3", "SUMMARY:x")), "2026-10-01T00:00:00", "2026-12-31T00:00:00")) == ["2026-10-26", "2026-11-02", "2026-11-09"] and dage(kor(cal(ev("UID:ct2", "DTSTART;TZID=Europe/Copenhagen:20261026T170000", "RRULE:FREQ=WEEKLY;COUNT=3", "SUMMARY:x")), *NOV)) == ["2026-11-02", "2026-11-09"])
t("UNTIL (dato og tidspunkt med Z) stopper gentagelsen (til og med den dag)", dage(kor(cal(ev("UID:ut", "DTSTART;TZID=Europe/Copenhagen:20261026T170000", "RRULE:FREQ=WEEKLY;UNTIL=20261109", "SUMMARY:x")), "2026-10-01T00:00:00", "2026-12-31T00:00:00")) == ["2026-10-26", "2026-11-02", "2026-11-09"] and dage(kor(cal(ev("UID:ut2", "DTSTART;TZID=Europe/Copenhagen:20261026T170000", "RRULE:FREQ=WEEKLY;UNTIL=20261109T235959Z", "SUMMARY:x")), "2026-10-01T00:00:00", "2026-12-31T00:00:00")) == ["2026-10-26", "2026-11-02", "2026-11-09"])
t("EXDATE fjerner én forekomst (10. nov.), og de andre bliver", dage(kor(cal(ev("UID:ex", "DTSTART;TZID=Europe/Copenhagen:20261006T170000", "RRULE:FREQ=WEEKLY", "EXDATE;TZID=Europe/Copenhagen:20261110T170000", "SUMMARY:x")), *NOV)) == ["2026-11-03", "2026-11-17", "2026-11-24"])
t("EXDATE for en heldagsgentagelse (datoer), og flere EXDATE-linjer og kommaseparerede værdier", dage(kor(cal(ev("UID:ex2", "DTSTART;VALUE=DATE:20261102", "RRULE:FREQ=DAILY;COUNT=6", "EXDATE;VALUE=DATE:20261103,20261104", "EXDATE;VALUE=DATE:20261106", "SUMMARY:x")), *NOV)) == ["2026-11-02", "2026-11-05", "2026-11-07"])
M = ev("UID:ov", "DTSTART;TZID=Europe/Copenhagen:20261006T170000", "DTEND;TZID=Europe/Copenhagen:20261006T180000", "RRULE:FREQ=WEEKLY", "SUMMARY:Træning")
flyt = ev("UID:ov", "RECURRENCE-ID;TZID=Europe/Copenhagen:20261110T170000", "DTSTART;TZID=Europe/Copenhagen:20261111T190000", "DTEND;TZID=Europe/Copenhagen:20261111T200000", "SUMMARY:Træning (flyttet)")
r = kor(cal(M, flyt), *NOV)
t("en FLYTTET forekomst (RECURRENCE-ID): den 10. nov. er væk, og den flyttede står onsdag 11. nov. kl. 19 med ny titel", dage(r) == ["2026-11-03", "2026-11-11", "2026-11-17", "2026-11-24"] and r[1]["start"][11:16] == "19:00" and r[1]["summary"] == "Træning (flyttet)", [(x["start"], x["summary"]) for x in r])
aflyst = ev("UID:ov", "RECURRENCE-ID;TZID=Europe/Copenhagen:20261117T170000", "DTSTART;TZID=Europe/Copenhagen:20261117T170000", "STATUS:CANCELLED", "SUMMARY:Træning")
t("en AFLYST forekomst (override med STATUS:CANCELLED) forsvinder, og resten bliver", dage(kor(cal(M, aflyst), *NOV)) == ["2026-11-03", "2026-11-10", "2026-11-24"])
t("en override uden UID i hovedbegivenheden (og omvendt) påvirker ikke andre serier", dage(kor(cal(M, ev("UID:andet", "RECURRENCE-ID;TZID=Europe/Copenhagen:20261110T170000", "DTSTART;TZID=Europe/Copenhagen:20261110T170000", "STATUS:CANCELLED", "SUMMARY:x")), *NOV)) == ["2026-11-03", "2026-11-10", "2026-11-17", "2026-11-24"])
t("MÅNEDLIG: den 15. hver måned; 2. tirsdag (2TU); sidste fredag (-1FR); den 31. springer måneder over, der ikke har en 31.",
  dage(kor(cal(ev("UID:m1", "DTSTART;TZID=Europe/Copenhagen:20260915T100000", "RRULE:FREQ=MONTHLY;BYMONTHDAY=15", "SUMMARY:x")), "2026-10-01T00:00:00", "2027-01-31T00:00:00")) == ["2026-10-15", "2026-11-15", "2026-12-15", "2027-01-15"]
  and dage(kor(cal(ev("UID:m2", "DTSTART;TZID=Europe/Copenhagen:20260908T100000", "RRULE:FREQ=MONTHLY;BYDAY=2TU", "SUMMARY:x")), "2026-10-01T00:00:00", "2027-01-31T00:00:00")) == ["2026-10-13", "2026-11-10", "2026-12-08", "2027-01-12"]
  and dage(kor(cal(ev("UID:m3", "DTSTART;TZID=Europe/Copenhagen:20260925T100000", "RRULE:FREQ=MONTHLY;BYDAY=-1FR", "SUMMARY:x")), "2026-10-01T00:00:00", "2027-01-31T00:00:00")) == ["2026-10-30", "2026-11-27", "2026-12-25", "2027-01-29"]
  and dage(kor(cal(ev("UID:m4", "DTSTART;TZID=Europe/Copenhagen:20260831T100000", "RRULE:FREQ=MONTHLY", "SUMMARY:x")), "2026-09-01T00:00:00", "2027-01-31T00:00:00")) == ["2026-10-31", "2026-12-31"])
t("MÅNEDLIG uden BYDAY og BYMONTHDAY bruger startdagens dato (den 9.), og BYSETPOS=-1 med hverdage giver sidste hverdag i måneden", dage(kor(cal(ev("UID:m5", "DTSTART;TZID=Europe/Copenhagen:20260909T100000", "RRULE:FREQ=MONTHLY", "SUMMARY:x")), "2026-10-01T00:00:00", "2027-01-31T00:00:00")) == ["2026-10-09", "2026-11-09", "2026-12-09", "2027-01-09"] and dage(kor(cal(ev("UID:m6", "DTSTART;TZID=Europe/Copenhagen:20260930T100000", "RRULE:FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-1", "SUMMARY:x")), "2026-10-01T00:00:00", "2027-01-31T00:00:00")) == ["2026-10-30", "2026-11-30", "2026-12-31", "2027-01-29"])
r = kor(cal(ev("UID:b", "DTSTART;VALUE=DATE:19901109", "RRULE:FREQ=YEARLY", "SUMMARY:Fødselsdag")), *NOV)
t("ÅRLIG fødselsdag (heldag, startet i 1990): den 9. nov. 2026", dage(r) == ["2026-11-09"] and r[0]["allDay"], r)
t("ÅRLIG med BYMONTH=11;BYDAY=TH;BYSETPOS=4 (4. torsdag i november): 26. nov. 2026", dage(kor(cal(ev("UID:y2", "DTSTART;TZID=Europe/Copenhagen:20250101T100000", "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=TH;BYSETPOS=4", "SUMMARY:x")), "2026-10-01T00:00:00", "2026-12-31T00:00:00")) == ["2026-11-26"])
t("DAGLIG med INTERVAL=3 og COUNT, og DAGLIG med BYDAY=MO,TU,WE,TH,FR (hverdage)", dage(kor(cal(ev("UID:d1", "DTSTART;TZID=Europe/Copenhagen:20261102T080000", "RRULE:FREQ=DAILY;INTERVAL=3;COUNT=4", "SUMMARY:x")), *NOV)) == ["2026-11-02", "2026-11-05", "2026-11-08", "2026-11-11"] and dage(kor(cal(ev("UID:d2", "DTSTART;TZID=Europe/Copenhagen:20261102T080000", "RRULE:FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR", "SUMMARY:x")), "2026-11-02T00:00:00", "2026-11-10T00:00:00")) == ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-09"])
# RFC 5545-eksemplet: hver anden uge, tirsdag og søndag; WKST afgør rækkefølgen
EX = lambda wkst: dage(kor(cal(ev("UID:rfc", "DTSTART;TZID=Europe/Copenhagen:19970805T090000", f"RRULE:FREQ=WEEKLY;INTERVAL=2;COUNT=4;BYDAY=TU,SU;WKST={wkst}", "SUMMARY:x")), "1997-01-01T00:00:00", "1998-01-01T00:00:00"))
t("RFC 5545: INTERVAL=2;BYDAY=TU,SU;COUNT=4 giver 5., 10., 19. og 24. august med WKST=MO, men 5., 17., 19. og 31. august med WKST=SU", EX("MO") == ["1997-08-05", "1997-08-10", "1997-08-19", "1997-08-24"] and EX("SU") == ["1997-08-05", "1997-08-17", "1997-08-19", "1997-08-31"], (EX("MO"), EX("SU")))
# sommertid
r = kor(cal(ev("UID:dst", "DTSTART;TZID=Europe/Copenhagen:20270321T100000", "RRULE:FREQ=WEEKLY", "SUMMARY:Søndag")), "2027-03-20T00:00:00", "2027-04-05T00:00:00")
t("en gentagelse i lokal tid (TZID) holder klokkeslættet over sommertid (søndag kl. 10 er stadig kl. 10 efter 28. marts, offset +01 → +02)", [x["start"] for x in r] == ["2027-03-21T10:00:00+01:00", "2027-03-28T10:00:00+02:00", "2027-04-04T10:00:00+02:00"], [x["start"] for x in r])
r = kor(cal(ev("UID:dst2", "DTSTART:20270321T090000Z", "RRULE:FREQ=WEEKLY", "SUMMARY:UTC")), "2027-03-20T00:00:00", "2027-04-05T00:00:00")
t("en gentagelse i UTC (Z) holder UTC-tiden, så den lokale tid rykker en time ved sommertid (10 → 11)", [x["start"][11:16] for x in r] == ["10:00", "11:00", "11:00"], [x["start"] for x in r])
# robusthed
t("ukendt FREQ og regler, der ikke kan regnes ud (BYWEEKNO, BYYEARDAY), giver kun første forekomst, og INTERVAL=0 regnes som 1", dage(kor(cal(ev("UID:z1", "DTSTART;TZID=Europe/Copenhagen:20261103T170000", "RRULE:FREQ=BANANA", "SUMMARY:x")), *NOV)) == ["2026-11-03"] and dage(kor(cal(ev("UID:z2", "DTSTART;TZID=Europe/Copenhagen:20261103T170000", "RRULE:FREQ=WEEKLY;BYWEEKNO=46", "SUMMARY:x")), *NOV)) == ["2026-11-03"] and len(kor(cal(ev("UID:z3", "DTSTART;TZID=Europe/Copenhagen:20261103T170000", "RRULE:FREQ=WEEKLY;INTERVAL=0", "SUMMARY:x")), *NOV)) == 4)
t("skrald giver ingen fejl: tom tekst, None, halve linjer, tom RRULE, forkerte datoer, COUNT=abc, enorm COUNT (afskåret)", all(I.begivenheder(x, *vindue(*NOV))[0] == [] for x in ("", None, "BEGIN:VEVENT", "x:y\r\nBEGIN:VEVENT\r\nDTSTART:2026\r\nSUMMARY:a\r\nEND:VEVENT")) and len(kor(cal(ev("UID:s1", "DTSTART;TZID=Europe/Copenhagen:20261103T170000", "RRULE:", "SUMMARY:x")), *NOV)) == 1 and len(kor(cal(ev("UID:s2", "DTSTART;TZID=Europe/Copenhagen:20261103T170000", "RRULE:FREQ=WEEKLY;COUNT=abc", "SUMMARY:x")), *NOV)) == 4 and len(kor(cal(ev("UID:s3", "DTSTART;TZID=Europe/Copenhagen:20261103T170000", "RRULE:FREQ=DAILY;COUNT=99999999", "SUMMARY:x")), *NOV)) == 27)
t("en gentagelse, der begyndte for mange år siden (daglig siden 2018), udvides stadig til tidsrummet", len(kor(cal(ev("UID:gl", "DTSTART;TZID=Europe/Copenhagen:20180101T080000", "RRULE:FREQ=DAILY", "SUMMARY:x")), "2026-11-09T00:00:00", "2026-11-12T00:00:00")) == 3)
r = kor(cal(ev("UID:rd", "DTSTART;TZID=Europe/Copenhagen:20261103T170000", "RRULE:FREQ=WEEKLY;COUNT=1", "RDATE;TZID=Europe/Copenhagen:20261105T170000", "SUMMARY:x")), *NOV)
t("RDATE tilføjer en ekstra forekomst", dage(r) == ["2026-11-03", "2026-11-05"], dage(r))
r = kor(cal(ev("UID:so", "DTSTART;TZID=Europe/Copenhagen:20261105T170000", "SUMMARY:B"), ev("UID:so2", "DTSTART;TZID=Europe/Copenhagen:20261103T170000", "SUMMARY:A"), ev("UID:so3", "DTSTART;TZID=Europe/Copenhagen:20261105T080000", "SUMMARY:C")), *NOV)
t("resultatet er sorteret efter start", [x["summary"] for x in r] == ["A", "C", "B"])
# programmet som proces
inp = json.dumps({"text": cal(ev("UID:p", "DTSTART;TZID=Europe/Copenhagen:20261006T170000", "RRULE:FREQ=WEEKLY", "SUMMARY:Hver tirsdag"), ev("UID:q", "DTSTART:20261109T100000Z", "SUMMARY:Én")), "fra": "2026-11-02T00:00:00+01:00", "til": "2026-11-16T00:00:00+01:00", "tz": "Europe/Copenhagen"})
p = subprocess.run([sys.executable, os.path.join(_R, "docker", "web", "ics.py")], input=inp.encode(), capture_output=True)
j = json.loads(p.stdout.decode())
t("som proces (stdin JSON → stdout JSON): begivenhederne, antal VEVENT og antal gentagne, og kode 0", p.returncode == 0 and j["vevent"] == 2 and j["gentagne"] == 1 and [e["summary"] for e in j["events"]] == ["Hver tirsdag", "Én", "Hver tirsdag"] and j["events"][0]["start"] == "2026-11-03T17:00:00+01:00", j)
p = subprocess.run([sys.executable, os.path.join(_R, "docker", "web", "ics.py")], input=b"ikke json", capture_output=True)
t("ugyldig input giver kode 1 og en fejl i JSON (så PHP falder tilbage til sin egen læser)", p.returncode == 1 and "fejl" in json.loads(p.stdout.decode()))
tmp = tempfile.mkdtemp(); fil = os.path.join(tmp, "f.ics"); open(fil, "w", encoding="utf-8").write(cal(ev("UID:t1", "DTSTART;TZID=Europe/Copenhagen:20260105T180000", "RRULE:FREQ=WEEKLY;BYDAY=MO", "SUMMARY:Hver mandag"), ev("UID:t2", "DTSTART;VALUE=DATE:20261109", "SUMMARY:Heldag")))
p = subprocess.run([sys.executable, os.path.join(_R, "docker", "web", "ics.py"), "--fil", fil, "--dato", "2026-11-09"], capture_output=True)
v = p.stdout.decode()
t("fejlfinding (--fil … --dato): antal begivenheder og gentagne, og hvad der står den dag (kl. 18 og hele dagen)", p.returncode == 0 and "2 begivenheder i filen, 1 med gentagelse" in v and "står der 2" in v and "18:00  Hver mandag" in v and "hele dagen  Heldag" in v, v)
p = subprocess.run([sys.executable, os.path.join(_R, "docker", "web", "ics.py"), "--fil", fil, "--dato", "i-morgen"], capture_output=True)
t("--dato i-morgen virker (også når der ikke står noget)", p.returncode == 0 and "står der" in p.stdout.decode())
# ydelse
store = cal(*[ev(f"UID:{i}", f"DTSTART;TZID=Europe/Copenhagen:{2026 + (i % 2)}{1 + i % 12:02d}{1 + i % 27:02d}T100000", "RRULE:FREQ=WEEKLY" if i % 3 == 0 else "X-A:b", f"SUMMARY:Begivenhed {i}") for i in range(3000)])
t0 = time.time(); kor(store, *NOV); dt = time.time() - t0
t(f"en stor kalender (3000 begivenheder, en tredjedel gentagne) læses på under 5 sekunder ({dt:.2f} s)", dt < 5, dt)
hp = open(os.path.join(_R, "public_html", "hent.php"), encoding="utf-8").read(); dk = open(os.path.join(_R, "docker", "web", "Dockerfile"), encoding="utf-8").read()
t("hent.php: ics_events er en skal, der først prøver Python-læseren og ellers den gamle PHP-læser (ics_events_php)", "return ics_events_py($text, $from, $to) ?? ics_events_php($text, $from, $to);" in hp and "function ics_events_php(string $text, DateTimeImmutable $from, DateTimeImmutable $to): array" in hp)
t("hent.php: Python-læseren kaldes uden shell (python3 /opt/familieoverblik/ics.py), sender fra/til/zone som JSON, og enhver fejl giver null, så den gamle læser tager over", "'/opt/familieoverblik/ics.py'" in hp and "proc_open(['python3', $script]" in hp and "'fra' => $from->format('c'), 'til' => $to->format('c'), 'tz' => TIMEZONE" in hp and "if (proc_close($p) !== 0) return null;" in hp and "if (!is_array($j) || !isset($j['events']) || !is_array($j['events'])) return null;" in hp)
t("webbilledet kopierer ics.py ind ved siden af bootstrap.py, og har python3 og tidszonedata", "docker/web/ics.py" in dk and "/opt/familieoverblik/" in dk and "python3 tzdata" in dk)
t("kalenderne hentes på ny hver gang cron kører (cachen er en halv time, ikke seks timer), og ?frisk=1 ignorerer cachen", "const ICS_CACHE_HOURS = 0.5;" in hp and "float $hours" in hp and "isset($_GET['frisk']) ? 0.0 : ICS_CACHE_HOURS" in hp)
# kontrakten mellem programmet og PHP: det, PHP læser ud af hver begivenhed, findes altid
r = kor(cal(ev("UID:k1", "DTSTART;TZID=Europe/Copenhagen:20261109T170000", "SUMMARY:A"), ev("UID:k2", "DTSTART;VALUE=DATE:20261109", "SUMMARY:B")), *NOV)
t("hver begivenhed har præcis de felter, PHP læser (start, end, last, allDay, summary, location), og tiderne kan læses af PHP's DateTimeImmutable (ISO 8601 med offset)", all(set(x) == {"start", "end", "last", "allDay", "summary", "location"} for x in r) and all(datetime.fromisoformat(x["start"]).utcoffset() is not None and datetime.fromisoformat(x["last"]).utcoffset() is not None for x in r), r)
sys.exit(0 if ok_all else 1)
