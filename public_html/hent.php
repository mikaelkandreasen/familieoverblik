<?php
/**
 * hent.php — cronjobbet på webhotellet.
 *
 * Henter det, der ikke kræver login: vejrudsigt, aktieindeks og ICS-feeds.
 * Netop derfor hører de tre til her og ikke på din PC — de virker også,
 * når maskinen er slukket.
 *
 * Kør enten som rigtig crontab over SSH (ingen nøgle nødvendig):
 *   0 * * * * /usr/bin/php ~/public_html/hent.php --job=all >/dev/null 2>&1
 *
 * eller over HTTP fra kontrolpanelets cron-system:
 *   https://dit-domæne.dk/hent.php?key=DIN_CRON_TOKEN&job=all
 *
 * Hvert job har sit eget try. En død Yahoo-endpoint må aldrig kunne
 * forhindre vejrudsigten i at blive opdateret.
 */

declare(strict_types=1);

// Find ugeplan-lib ved at gå opad — samme fremgangsmåde som i api.php
$lib = null;
for ($d = __DIR__, $i = 0; $i < 5; $i++, $d = dirname($d)) {
    if (is_file($d . '/ugeplan-lib/store.php')) { $lib = $d . '/ugeplan-lib/store.php'; break; }
    if ($d === dirname($d)) break;
}
if ($lib === null) {
    http_response_code(500);
    exit("ugeplan-lib blev ikke fundet — den skal ligge i en mappe over hent.php\n");
}
require_once $lib;

// Kalenderlisten ligger fra 26. sept som data (feeds.php), ikke i config.php.
// Mangler filen — fx hvis hent.php er uploadet før ugeplan-lib — kører jobbet
// videre på ICS_FEEDS som før, i stedet for at vælte vejret og alt det andet.
if (is_file(dirname($lib) . '/feeds.php')) require_once dirname($lib) . '/feeds.php';

const HENT_LOG       = DATA_DIR . '/hent.log';
const HENT_CACHE_DIR = DATA_DIR . '/cache';
const ICS_CACHE_HOURS = 0.5;       // en halv time: cron henter hver time, så hver kørsel henter kalenderne på ny (før 6 timer: en ny aftale kunne vente længe). ?frisk=1 ignorerer cachen

$isCli = PHP_SAPI === 'cli';

// Inkluderes filen af kalendere.php ("Hent nu" og "Test"), har den sin egen
// adgangskontrol, og cron-nøglen skal ikke kræves. Jobbene går alligevel kun
// i gang, når filen kaldes direkte — se vagten nederst.
$hentDirekte = realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__;

if (!$isCli && $hentDirekte) {
    header('Content-Type: text/plain; charset=utf-8');
    header('Cache-Control: no-store');
    // Nøglen kan sendes i headeren X-Cron-Key (cron-containeren gør det, så den ikke står i Apaches log) eller som ?key= (som før).
$cronKey = (string)($_SERVER['HTTP_X_CRON_KEY'] ?? ($_GET['key'] ?? ''));
if (CRON_TOKEN === 'UDFYLD' || !hash_equals(CRON_TOKEN, $cronKey)) {
        http_response_code(403);
        echo "forkert eller manglende key\n";
        exit;
    }
}

// Kontrolpanelets cron er underlagt samme timeout som et browserkald.
// Tre feeds plus tre indeks kan nå at tage et halvt minut.
@set_time_limit(300);
date_default_timezone_set(TIMEZONE);

$job = $isCli
    ? (preg_match('/--job=(\w+)/', implode(' ', $argv), $m) ? $m[1] : 'all')
    : (string)($_GET['job'] ?? 'all');

// ─── Hjælpere ──────────────────────────────────────────────────────
function hlog(string $msg): void
{
    $line = date('Y-m-d H:i:s') . '  ' . $msg;
    echo $line, "\n";
    @file_put_contents(HENT_LOG, $line . "\n", FILE_APPEND | LOCK_EX);
}

/** Hent en URL. Returnerer kroppen, eller kaster med en brugbar besked. */
function http_get(string $url, int $timeout = 30): string
{
    $ua = 'Mozilla/5.0 (compatible; Ugeplan/2)';

    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS      => 3,
            CURLOPT_TIMEOUT        => $timeout,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_USERAGENT      => $ua,
            CURLOPT_ENCODING       => '',        // accepterer gzip, feeds er store
            // Kalenderlinks kan nu tastes ind i en dialog. Så må intet andet
            // end http(s) kunne hentes — heller ikke via en omdirigering.
            CURLOPT_PROTOCOLS      => CURLPROTO_HTTP | CURLPROTO_HTTPS,
            CURLOPT_REDIR_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
        ]);
        $body = curl_exec($ch);
        $err  = curl_error($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);

        if ($body === false)   throw new RuntimeException("curl: $err");
        if ($code >= 400)      throw new RuntimeException("HTTP $code");
        return (string)$body;
    }

    if (!ini_get('allow_url_fopen')) {
        throw new RuntimeException('hverken curl eller allow_url_fopen er tilgængelig — '
            . 'webhotellet tillader ikke udgående HTTP fra PHP');
    }

    $ctx = stream_context_create(['http' => [
        'timeout' => $timeout, 'user_agent' => $ua, 'ignore_errors' => true,
    ]]);
    $body = @file_get_contents($url, false, $ctx);
    if ($body === false) throw new RuntimeException('file_get_contents fejlede');
    return $body;
}

/** Hent med lokal cache, så et stort feed ikke trækkes hver time. */
function http_get_cached(string $url, string $cacheName, float $hours): string
{
    if (!is_dir(HENT_CACHE_DIR)) @mkdir(HENT_CACHE_DIR, 0770, true);
    $f = HENT_CACHE_DIR . '/' . $cacheName;

    if (is_file($f) && (time() - filemtime($f)) < $hours * 3600) {
        $c = @file_get_contents($f);
        if ($c !== false && $c !== '') return $c;
    }

    try {
        // Kalenderlinks kan tastes ind i Kalendere-dialogen; feeds_fetch()
        // tjekker hvert omdirigerings-hop. Mangler feeds.php, som før.
        $body = function_exists('feeds_fetch') ? feeds_fetch($url, 60) : http_get($url, 60);
        @file_put_contents($f, $body, LOCK_EX);
        return $body;
    } catch (Throwable $e) {
        // Et gammelt feed er bedre end intet feed
        if (is_file($f)) {
            $c = @file_get_contents($f);
            if ($c !== false && $c !== '') {
                hlog("  advarsel: hentning fejlede ({$e->getMessage()}) — bruger cache");
                return $c;
            }
        }
        throw $e;
    }
}

function week_id(DateTimeInterface $d): string { return $d->format('o-\WW'); }

// ═══ 1. Vejrudsigt ═════════════════════════════════════════════════
/**
 * Timerne pr. dag, pakket som parallelle talraekker frem for et objekt pr.
 * time. Et objekt med syv navngivne felter × 24 timer × 14 dage ville fylde
 * omkring 60 KB; raekkerne goer det til under 10. Det betyder noget, fordi
 * settings/weather ligger paa den varme sti: begge sider henter dokumentet.
 *
 * Enheder: t og f i hele grader, p i mm, pp i procent, w og g i METER PR.
 * SEKUND — Open-Meteo leverer km/t, og omregningen sker her, ét sted, saa
 * visningen ikke skal huske det. c er WMO-koden for den enkelte time.
 *
 * Ren funktion med vilje: den kan proeves mod et gemt svar uden netvaerk.
 * Se Tjek/test-vejr.php.
 */
const WEATHER_HOURLY_DAYS = 14;   // daglig prognose gaar 16 dage; timer saa langt
                                  // frem er ikke vaerd at planlaegge en cykeltur efter

function weather_payload(object $d): stdClass
{
    if (!isset($d->daily->time) || !is_array($d->daily->time)) {
        throw new RuntimeException('uventet svar fra Open-Meteo: daily mangler');
    }

    $out = new stdClass();
    foreach ($d->daily->time as $i => $date) {
        $code = $d->daily->weather_code[$i]        ?? null;
        $max  = $d->daily->temperature_2m_max[$i]  ?? null;
        $min  = $d->daily->temperature_2m_min[$i]  ?? null;
        if ($code === null || $max === null || $min === null) continue;
        $out->$date = (object)[
            'code' => (int)$code,
            'max'  => (int)round((float)$max),
            'min'  => (int)round((float)$min),
        ];
    }

    // Timerne fordeles ud paa de dage, der allerede staar i $out. En time paa
    // en dag uden daglig prognose smides vaek — saa kan de to aldrig komme
    // til at modsige hinanden.
    $h = $d->hourly ?? null;
    if ($h && isset($h->time) && is_array($h->time)) {
        $tilladt = array_slice(array_keys(get_object_vars($out)), 0, WEATHER_HOURLY_DAYS);
        $tilladt = array_flip($tilladt);

        foreach ($h->time as $i => $stempel) {
            $dato = substr((string)$stempel, 0, 10);
            $time = (int)substr((string)$stempel, 11, 2);
            if (!isset($tilladt[$dato]) || !isset($out->$dato)) continue;

            $t  = $h->temperature_2m[$i]             ?? null;
            $f  = $h->apparent_temperature[$i]       ?? null;
            $pr = $h->precipitation[$i]              ?? null;
            $pp = $h->precipitation_probability[$i]  ?? null;
            $w  = $h->wind_speed_10m[$i]             ?? null;
            $g  = $h->wind_gusts_10m[$i]             ?? null;
            $c  = $h->weather_code[$i]               ?? null;

            $dag = $out->$dato;
            foreach (['t','f','p','pp','w','g','c'] as $felt) {
                if (!isset($dag->$felt)) $dag->$felt = array_fill(0, 24, null);
            }
            // null bevares som null. Et hul i prognosen skal SES som et hul,
            // ikke udfyldes med nul grader og toervejr.
            $dag->t[$time]  = $t  === null ? null : (int)round((float)$t);
            $dag->f[$time]  = $f  === null ? null : (int)round((float)$f);
            $dag->p[$time]  = $pr === null ? null : round((float)$pr, 1);
            $dag->pp[$time] = $pp === null ? null : (int)$pp;
            $dag->w[$time]  = $w  === null ? null : round((float)$w / 3.6, 1);
            $dag->g[$time]  = $g  === null ? null : round((float)$g / 3.6, 1);
            $dag->c[$time]  = $c  === null ? null : (int)$c;
        }
    }

    if (count(get_object_vars($out)) === 0) throw new RuntimeException('ingen dage i svaret');
    return $out;
}

function job_weather(): string
{
    $url = 'https://api.open-meteo.com/v1/forecast'
         . '?latitude='  . rawurlencode((string)LATITUDE)
         . '&longitude=' . rawurlencode((string)LONGITUDE)
         . '&daily=weather_code,temperature_2m_max,temperature_2m_min'
         . '&hourly=temperature_2m,apparent_temperature,precipitation,'
         . 'precipitation_probability,weather_code,wind_speed_10m,wind_gusts_10m'
         . '&timezone='  . rawurlencode(TIMEZONE)
         . '&forecast_days=16';

    $out   = weather_payload(json_decode(http_get($url), false));
    $dage  = count(get_object_vars($out));
    $timer = 0;
    foreach ($out as $dag) if (isset($dag->t)) $timer += count(array_filter($dag->t, fn($x) => $x !== null));

    store_write('settings/weather', $out);
    return "$dage dage, $timer timer";
}

// ═══ 2. Aktieindeks ════════════════════════════════════════════════
/**
 * Yahoos chart-endpoint er uofficiel, men den eneste gratis kilde uden nøgle,
 * der dækker både de amerikanske indeks og C25. Ændringen regnes per dag mod
 * forrige handelsdags luk, og datoen bestemmes af børsens egen tidszone —
 * ellers lander amerikanske luk på den forkerte dag.
 */
function fetch_index(string $symbol, string $label): object
{
    $url = 'https://query1.finance.yahoo.com/v8/finance/chart/'
         . rawurlencode($symbol) . '?interval=1d&range=1mo';

    $r   = json_decode(http_get($url, 25), false);
    $res = $r->chart->result[0] ?? null;
    if (!$res) throw new RuntimeException('tomt svar');

    $stamps = $res->timestamp ?? [];
    $closes = $res->indicators->quote[0]->close ?? [];
    $offset = (int)($res->meta->gmtoffset ?? 0);

    $days = new stdClass();
    for ($i = 1; $i < count($stamps); $i++) {
        $c = $closes[$i] ?? null; $p = $closes[$i - 1] ?? null;
        if ($c === null || $p === null || (float)$p == 0.0) continue;
        $date = gmdate('Y-m-d', (int)$stamps[$i] + $offset);
        $days->$date = round(((float)$c - (float)$p) / (float)$p * 100, 2);
    }

    if (!count(get_object_vars($days))) throw new RuntimeException('ingen kurser');
    return (object)['label' => $label, 'days' => $days];
}

function job_markets(): string
{
    if (!TICKERS) { return 'slået fra'; }

    $items = [];
    foreach (TICKERS as $t) {
        try {
            $items[] = fetch_index($t['symbol'], $t['label']);
        } catch (Throwable $e) {
            hlog("  indeks {$t['label']}: {$e->getMessage()}");
        }
    }
    if (!$items) throw new RuntimeException('ingen indeks kunne hentes');

    store_write('settings/markets', (object)['items' => $items]);
    return count($items) . ' af ' . count(TICKERS) . ' indeks';
}

// ═══ 3. ICS-feeds ══════════════════════════════════════════════════
/** Fold sammenklappede linjer ud. Fortsættelseslinjer starter med mellemrum eller tab. */
function ics_unfold(string $text): array
{
    $text = str_replace(["\r\n", "\r"], "\n", $text);
    $text = preg_replace("/\n[ \t]/", '', $text) ?? $text;
    return explode("\n", $text);
}

function ics_unescape(string $v): string
{
    return trim(str_replace(['\\n', '\\N', '\\,', '\\;', '\\\\'], ["\n", "\n", ',', ';', '\\'], $v));
}

/**
 * Fortolk en DTSTART/DTEND-værdi.
 * Returnerer [DateTimeImmutable, erHeldag] eller null.
 */
function ics_date(string $params, string $value): ?array
{
    $value = trim($value);
    $tz    = null;
    if (preg_match('/TZID=([^;:]+)/i', $params, $m)) {
        try { $tz = new DateTimeZone(trim($m[1])); } catch (Throwable) { $tz = null; }
    }
    $local = $tz ?? new DateTimeZone(TIMEZONE);

    try {
        // 20260824  — heldagsbegivenhed, ingen klokkeslæt
        if (preg_match('/^\d{8}$/', $value)) {
            return [new DateTimeImmutable($value . ' 00:00:00', new DateTimeZone(TIMEZONE)), true];
        }
        // 20260826T153000Z — UTC
        if (preg_match('/^(\d{8})T(\d{6})Z$/', $value, $m)) {
            return [(new DateTimeImmutable("{$m[1]}T{$m[2]}", new DateTimeZone('UTC')))
                        ->setTimezone(new DateTimeZone(TIMEZONE)), false];
        }
        // 20260826T173000 — lokal tid, evt. i feedets egen TZID
        if (preg_match('/^(\d{8})T(\d{6})$/', $value, $m)) {
            return [(new DateTimeImmutable("{$m[1]}T{$m[2]}", $local))
                        ->setTimezone(new DateTimeZone(TIMEZONE)), false];
        }
    } catch (Throwable) {
        return null;
    }
    return null;
}

/**
 * ICS-læseren i Python (ics.py): kender gentagelser (RRULE), undtagelser (EXDATE) og flyttede eller aflyste forekomster (RECURRENCE-ID), som den gamle læser herunder ikke kender.
 * Returnerer null, hvis scriptet ikke findes eller fejler; så bruges den gamle læser.
 * @return array<int,array<string,mixed>>|null
 */
function ics_events_py(string $text, DateTimeImmutable $from, DateTimeImmutable $to): ?array
{
    $script = '/opt/familieoverblik/ics.py';
    if (!is_file($script) || !function_exists('proc_open')) return null;
    $in = json_encode(['text' => $text, 'fra' => $from->format('c'), 'til' => $to->format('c'), 'tz' => TIMEZONE], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    if (!is_string($in)) return null;
    $p = @proc_open(['python3', $script], [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
    if (!is_resource($p)) return null;
    fwrite($pipes[0], $in);
    fclose($pipes[0]);
    $ud = (string)stream_get_contents($pipes[1]);
    fclose($pipes[1]);
    fclose($pipes[2]);
    if (proc_close($p) !== 0) return null;
    $j = json_decode($ud, true);
    if (!is_array($j) || !isset($j['events']) || !is_array($j['events'])) return null;

    $tz  = new DateTimeZone(TIMEZONE);
    $out = [];
    foreach ($j['events'] as $e) {
        try {
            $start = (new DateTimeImmutable((string)$e['start']))->setTimezone($tz);
            $end   = isset($e['end']) ? (new DateTimeImmutable((string)$e['end']))->setTimezone($tz) : null;
            $last  = (new DateTimeImmutable((string)$e['last']))->setTimezone($tz);
        } catch (Throwable) {
            continue;
        }
        $out[] = [
            'start'    => $start,
            'end'      => $end,
            'last'     => $last,
            'allDay'   => (bool)($e['allDay'] ?? false),
            'summary'  => (string)($e['summary'] ?? ''),
            'location' => (string)($e['location'] ?? ''),
        ];
    }
    return $out;
}

/** Begivenhederne, der overlapper [$from, $to), også de gentagne: Python-læseren, ellers den gamle. */
function ics_events(string $text, DateTimeImmutable $from, DateTimeImmutable $to): array
{
    return ics_events_py($text, $from, $to) ?? ics_events_php($text, $from, $to);
}

/** Træk VEVENTs ud, der overlapper [$from, $to). Den gamle læser: kun enkeltstående begivenheder (ingen gentagelser). */
function ics_events_php(string $text, DateTimeImmutable $from, DateTimeImmutable $to): array
{
    $out = [];
    $cur = null;

    foreach (ics_unfold($text) as $line) {
        if ($line === 'BEGIN:VEVENT') { $cur = ['allDay' => false]; continue; }
        if ($cur === null)            { continue; }

        if ($line === 'END:VEVENT') {
            if (isset($cur['start'], $cur['summary']) && empty($cur['cancelled'])) {
                // DTEND er eksklusiv. For heldagsposter betyder 24.→29. altså
                // til og med den 28., så der trækkes et døgn fra.
                $end = $cur['end'] ?? null;
                $last = $cur['allDay']
                    ? ($end ? $end->modify('-1 day') : $cur['start'])
                    : ($end ?? $cur['start']);
                if ($last < $cur['start']) $last = $cur['start'];

                if ($cur['start'] < $to && $last >= $from) {
                    $out[] = [
                        'start'    => $cur['start'],
                        'end'      => $end,
                        'last'     => $last,
                        'allDay'   => $cur['allDay'],
                        'summary'  => $cur['summary'],
                        'location' => $cur['location'] ?? '',
                    ];
                }
            }
            $cur = null;
            continue;
        }

        $c = strpos($line, ':');
        if ($c === false) continue;
        $head = substr($line, 0, $c);
        $val  = substr($line, $c + 1);
        $name = strtoupper(strtok($head, ';'));
        $params = $head;

        switch ($name) {
            case 'DTSTART':
                if ($d = ics_date($params, $val)) { $cur['start'] = $d[0]; $cur['allDay'] = $d[1]; }
                break;
            case 'DTEND':
                if ($d = ics_date($params, $val)) { $cur['end'] = $d[0]; }
                break;
            case 'SUMMARY':
                // Udsatte kampe får dansk mærkat, som i den gamle PowerShell-version
                $s = preg_replace('/^\s*\x{26A0}\x{FE0F}?\s*Postponed:\s*/u', 'UDSAT: ', ics_unescape($val));
                $cur['summary'] = $s !== '' ? $s : null;
                if ($cur['summary'] === null) unset($cur['summary']);
                break;
            case 'STATUS':
                if (strtoupper(trim($val)) === 'CANCELLED') $cur['cancelled'] = true;
                break;
            case 'LOCATION':
                $loc = ics_unescape($val);
                if ($loc !== '') $cur['location'] = $loc;
                break;
        }
    }
    return $out;
}

/** Listen der skal hentes: fra feeds.php, eller ICS_FEEDS hvis den ikke er uploadet. */
function ics_feed_list(): array
{
    if (function_exists('feeds_active')) return feeds_active();
    $out = [];
    foreach (ICS_FEEDS as $f) { $f['id'] = substr(hash('sha256', $f['url']), 0, 10); $out[] = $f; }
    return $out;
}

function job_ics(): string
{
    // Ikke $list: det navn bruges længere nede af sorteringsløkken.
    $feedList = ics_feed_list();
    if (!$feedList) return 'slået fra';

    $monday = new DateTimeImmutable('monday this week 00:00:00');
    $until  = $monday->modify('+' . ICS_WEEKS_AHEAD . ' weeks');

    // Alle uger i vinduet nulstilles, så en aflyst kamp faktisk forsvinder igen
    $weeks = [];
    for ($w = 0; $w < ICS_WEEKS_AHEAD; $w++) {
        $m = $monday->modify("+$w weeks");
        $weeks[week_id($m)] = ['monday' => $m, 'days' => array_fill_keys(range(1, 7), [])];
    }

    $total = 0; $feeds = 0;
    $status = [];
    foreach ($feedList as $i => $feed) {
        $before = $total;
        try {
            $cacheName = 'feed-' . substr(hash('sha256', $feed['url']), 0, 12) . '.ics';
            $text = http_get_cached($feed['url'], $cacheName, isset($_GET['frisk']) ? 0.0 : ICS_CACHE_HOURS);

            foreach (ics_events($text, $monday, $until) as $e) {
                // En flerdags heldagspost skal stå på hver af sine dage,
                // præcis som Outlook-aftaler gør det.
                $d = $e['allDay'] ? $e['start']->setTime(0, 0) : $e['start'];
                $lastDay = $e['allDay'] ? $e['last']->setTime(0, 0) : $e['start'];

                for (; $d <= $lastDay; $d = $d->modify('+1 day')) {
                    $wid = week_id($d);
                    if (!isset($weeks[$wid])) continue;
                    $idx = (int)$d->format('N');

                    $weeks[$wid]['days'][$idx][] = (object)[
                        'subject'  => $e['summary'],
                        'start'    => $e['allDay'] ? '' : $e['start']->format('H:i'),
                        'end'      => (!$e['allDay'] && $e['end']) ? $e['end']->format('H:i') : '',
                        'allDay'   => $e['allDay'],
                        'tag'      => $feed['tag'] ?? '',
                        'who'      => $feed['person'] ?? '',
                        'icon'     => $feed['icon'] ?? '',
                        'kilde'    => (string)($feed['label'] ?? ''),         // teksten fra feltet «Navn» i kalenderdialogen: vises som kilde på forsiden
                        'src'      => function_exists('feeds_service') ? feeds_service((string)($feed['url'] ?? '')) : '',
                        'location' => $e['location'] ?? '',
                    ];
                    $total++;
                }
            }
            $feeds++;
            $status[$feed['id']] = ['ok' => true, 'at' => date('c'), 'events' => $total - $before];
        } catch (Throwable $e) {
            hlog("  feed " . ($feed['person'] ?? $feed['tag'] ?? $i) . " sprunget over: {$e->getMessage()}");
            $status[$feed['id']] = ['ok' => false, 'at' => date('c'), 'error' => $e->getMessage()];
        }
    }
    if (function_exists('feeds_status_write')) feeds_status_write($status);

    foreach ($weeks as $wid => $w) {
        // Heldagsposter først, derefter efter klokkeslæt
        foreach ($w['days'] as $k => $list) {
            usort($list, fn($a, $b) => ($a->allDay ? '' : $a->start) <=> ($b->allDay ? '' : $b->start));
            $w['days'][$k] = $list;
        }
        $days = new stdClass();
        foreach ($w['days'] as $k => $list) { $kk = (string)$k; $days->$kk = $list; }
        store_write("ics/$wid", $days);
    }

    return "$total poster fra $feeds af " . count($feedList) . ' feeds';
}

/** Gårsdagens tegneserie fra GoComics (kortet i overblik.html), hentet fra datosiden. Hentes højst én gang pr. dato, og gemmes i historikken. */
function job_tegneserie(): string
{
    $fil = dirname((string)$GLOBALS['lib']) . '/tegneserie.php';
    if (!is_file($fil) || !function_exists('feeds_write_json')) return 'sprunget over (ugeplan-lib/tegneserie.php mangler)';
    require_once $fil;
    $s = tg_settings();
    if (!$s['enabled']) return 'slukket i indstillingerne';
    $r = tg_cached($s['slug']);
    return $s['slug'] . ': ' . (($r['data']['dato'] ?? '') ?: 'ukendt dato') . ($r['stale'] ? ' (kunne ikke opdateres, bruger det gemte)' : '');
}

// ═══ Kør ═══════════════════════════════════════════════════════════
// Filen kan inkluderes fra en test uden at jobbene går i gang
if (!$hentDirekte) return;

$jobs = [
    'weather' => 'job_weather',
    'markets' => 'job_markets',
    'ics'     => 'job_ics',
    'tegneserie' => 'job_tegneserie',
];

$run    = $job === 'all' ? array_keys($jobs) : (isset($jobs[$job]) ? [$job] : []);
$failed = 0;

if (!$run && $job !== 'prune') {
    hlog("ukendt job '$job' — brug weather, markets, ics, tegneserie, prune eller all");
    exit(2);
}

foreach ($run as $name) {
    try {
        hlog("$name: " . $jobs[$name]());
    } catch (Throwable $e) {
        $failed++;
        hlog("$name FEJLEDE: {$e->getMessage()}");
    }
}

if ($job === 'all' || $job === 'prune') {
    try {
        $n = store_prune(8);
        if ($n) hlog("prune: $n gamle ugefiler slettet");
    } catch (Throwable $e) {
        hlog("prune fejlede: {$e->getMessage()}");
    }
}

// Exit-kode ≠ 0 når alt fejlede, så crontab kan sende dig en mail om det
if ($isCli) exit($run && $failed === count($run) ? 1 : 0);
if ($run && $failed === count($run)) http_response_code(500);
