<?php
// ═══════════════════════════════════════════════════════════════════
//  Udfyld én gang. Denne fil skal ALDRIG overskrives, når du henter
//  en ny version — den er det eneste sted, dine egne værdier står.
//
//  Filen ligger UDEN FOR webroot, så den aldrig kan hentes over HTTP.
// ═══════════════════════════════════════════════════════════════════

// ── Nøgler ──────────────────────────────────────────────────────────
// Lav tre forskellige, lange, tilfældige strenge. Fx i PowerShell:
//   -join ((48..57)+(97..122) | Get-Random -Count 40 | % {[char]$_})

// Ligger i public_html/config.js og kan læses af enhver med adressen.
// Må hente alt, men kun skrive til det skærmen selv redigerer.
const READ_TOKEN  = '__READ_TOKEN__';

// Ligger kun i pc/config.py og pc/config.ps1. Kommer aldrig i en browser.
// Må skrive alt.
const WRITE_TOKEN = '__WRITE_TOKEN__';

// Bruges kun hvis du kalder hent.php over HTTP (kontrolpanelets cron).
// Kører du via rigtig crontab over SSH, er den ligegyldig.
const CRON_TOKEN  = '__CRON_TOKEN__';

// ── Hvor data ligger ────────────────────────────────────────────────
// Standard er en mappe ved siden af denne fil, altså uden for webroot.
// Kan dit webhotel ikke skrive der, så peg på 'public_html/data' —
// den medfølgende .htaccess spærrer den for HTTP.
const DATA_DIR = __DIR__ . '/../ugeplan-data';

// ── Vejr ────────────────────────────────────────────────────────────
// Standard er København.
const LATITUDE  = 55.6761;
const LONGITUDE = 12.5683;
const TIMEZONE  = 'Europe/Copenhagen';

// ── Indeks til Marked-feltet ────────────────────────────────────────
// Symbolerne følger Yahoo Finance. Tom liste slår visningen fra.
// label skal matche MARKET_ORDER i config.js, hvis du bruger den.
const TICKERS = [
    ['symbol' => '^OMXC25', 'label' => 'C25'],
    ['symbol' => '^GSPC',   'label' => 'S&P 500'],
    ['symbol' => '^IXIC',   'label' => 'Nasdaq'],
];

// ── ICS-feeds (kampprogrammer, ferieplaner m.m.) ────────────────────
// Tom liste slår det fra. Eksemplet henter et fodboldholds kampprogram.
// tag vises som et lille mærke i Kalender-feltet.
const ICS_FEEDS = [
    // Eksempler — fjern // og indsæt dit eget link. 'person' skal være en id fra config.js.
    // ['url' => 'https://calendar.google.com/calendar/ical/DIN-MAIL/private-NØGLE/basic.ics', 'person' => 'voksen1'],
    // ['url' => 'https://ics.fixtur.es/v2/DIT-HOLD.ics', 'person' => 'barn1', 'icon' => '⚽'],
];

// Hvor mange uger frem hent.php holder ICS-data for.
const ICS_WEEKS_AHEAD = 4;

// ── Elpris (Elpris-kortet i overblik.html) ──────────────────────────
// Alt herunder er valgfrit. Børsprisen hentes gratis fra Energinet.
// Skal kortet vise din samlede pris, så læg dit tillæg og din tarif ind.
const ELPRIS_OMRADE = 'DK1';       // 'DK1' = Jylland og Fyn, 'DK2' = Sjælland m.fl.
const ELPRIS_MOMS   = true;        // læg 25 % moms på
const ELPRIS_TILLAEG = 0.0;        // fast tillæg i kr./kWh uden moms (elselskab m.m.)
// Netselskabets tarif pr. klokketime 0-23, kr./kWh uden moms. Tom liste = ingen.
// Eksempel (sæt dine egne tal ind): array_merge(array_fill(0, 17, 0.25), array_fill(17, 4, 0.75), array_fill(21, 3, 0.25))
const ELPRIS_TARIF_TIMER = [];
const ELPRIS_VINDUE_TIMER = 3;     // "billigste periode" = så mange sammenhængende timer
