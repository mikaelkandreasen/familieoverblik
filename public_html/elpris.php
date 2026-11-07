<?php
/**
 * elpris.php — elprisen til Elpris-kortet i overblik.html og indstillingerne i index.html.
 *
 *   GET  elpris.php                  -> priser: kvarter for kvarter (børs) + prognose time for time
 *   GET  elpris.php?action=settings  -> moms, fast tillæg og selskabets tillæg
 *   POST elpris.php?action=save      {"momsPct":25,"fastOre":0,"selskabOre":0}
 *
 * ── Kilder ─────────────────────────────────────────────────────────────
 * Børspris:  Energinets åbne data (Energi Data Service), DayAheadPrices, gratis uden nøgle.
 * Prognose:  elpriser.org's åbne API, /api/forecast. Faktiske børspriser, hvor de er
 *            offentliggjort, og ellers en maskinlæringsmodel (op til 9 døgn frem).
 *            Prognosen er ikke en garanti, og jo længere frem, jo mere usikker.
 *
 * ── Hvad prisen består af ──────────────────────────────────────────────
 *   (børspris + fast tillæg + selskabets tillæg + evt. tarif for timen) × (1 + moms)
 * Moms, fast tillæg og selskabets tillæg rettes i index.html (Opsætning → Elpris) og
 * gemmes i DATA_DIR/private/elpris.json. Findes den fil ikke, bruges standarden fra
 * ugeplan-lib/config.php (ELPRIS_MOMS, ELPRIS_TILLAEG). ELPRIS_TARIF_TIMER kan kun
 * sættes i config.php: 24 tal, ét pr. klokketime, i kr./kWh uden moms.
 * Det gemte svar fra kilderne er børsprisen uden tillæg, så en ændring virker med det samme.
 *
 * ── Adgang ─────────────────────────────────────────────────────────────
 * Som indkob.php: en af nøglerne i X-Ugeplan-Key OG PIN-cookien.
 */

declare(strict_types=1);

$lib = null;
for ($d = __DIR__, $i = 0; $i < 5; $i++, $d = dirname($d)) {
    if (is_file($d . '/ugeplan-lib/feeds.php')) { $lib = $d . '/ugeplan-lib'; break; }
    if ($d === dirname($d)) break;
}
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');

function el_out(array $data, int $code = 200): never
{
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function el_fail(int $code, string $msg): never
{
    el_out(['error' => $msg], $code);
}

if ($lib === null || !is_file("$lib/gate.php")) el_fail(500, 'ugeplan-lib/feeds.php eller gate.php mangler');
require_once "$lib/feeds.php";   // DATA_DIR og feeds_write_json()
require_once "$lib/gate.php";

$key = (string)($_SERVER['HTTP_X_UGEPLAN_KEY'] ?? '');
$ok  = ($key !== '' && WRITE_TOKEN !== 'UDFYLD' && hash_equals(WRITE_TOKEN, $key))
    || ($key !== '' && READ_TOKEN  !== 'UDFYLD' && hash_equals(READ_TOKEN,  $key));
if (!$ok)       el_fail(401, 'ukendt eller manglende nøgle');
if (!gate_ok()) el_fail(403, 'log ind med familiens kode først');

date_default_timezone_set(TIMEZONE);

const EL_SETTINGS_FILE = DATA_DIR . '/private/elpris.json';

// ─── Indstillinger ─────────────────────────────────────────────────
/** @return array{momsPct:float, fastOre:float, selskabOre:float, source:string} */
function el_settings(): array
{
    $s = [
        'momsPct'    => (defined('ELPRIS_MOMS') ? (bool)ELPRIS_MOMS : true) ? 25.0 : 0.0,
        'fastOre'    => (defined('ELPRIS_TILLAEG') ? (float)ELPRIS_TILLAEG : 0.0) * 100.0,
        'selskabOre' => 0.0,
        'source'     => 'config',
    ];
    if (is_file(EL_SETTINGS_FILE)) {
        $d = json_decode((string)@file_get_contents(EL_SETTINGS_FILE), true);
        if (is_array($d)) {
            foreach (['momsPct', 'fastOre', 'selskabOre'] as $k) {
                if (isset($d[$k]) && is_numeric($d[$k])) $s[$k] = (float)$d[$k];
            }
            $s['source'] = 'file';
        }
    }
    return $s;
}

/** Tal fra browseren: tal eller tekst med komma. */
function el_num(mixed $v, string $navn, float $min, float $max): float
{
    if (is_string($v)) $v = str_replace(',', '.', trim($v));
    if (!is_numeric($v)) el_fail(400, "$navn skal være et tal.");
    $f = (float)$v;
    if ($f < $min || $f > $max) el_fail(400, "$navn skal ligge mellem $min og $max.");
    return round($f, 3);
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = (string)($_GET['action'] ?? '');

if ($action === 'settings' && $method === 'GET') {
    el_out(el_settings() + ['tarifISConfig' => defined('ELPRIS_TARIF_TIMER') && is_array(ELPRIS_TARIF_TIMER) && count(ELPRIS_TARIF_TIMER) > 0]);
}

if ($action === 'save') {
    if ($method !== 'POST') el_fail(405, 'kun POST');
    $raw = file_get_contents('php://input');
    $b = ($raw !== false && $raw !== '' && strlen($raw) < 2000) ? json_decode($raw, true) : null;
    if (!is_array($b)) el_fail(400, 'kroppen skal være JSON');
    $ny = [
        'momsPct'    => el_num($b['momsPct']    ?? null, 'Moms',                0.0, 100.0),
        'fastOre'    => el_num($b['fastOre']    ?? null, 'Fast tillæg',        -100.0, 1000.0),
        'selskabOre' => el_num($b['selskabOre'] ?? null, 'Selskabets tillæg',  -100.0, 1000.0),
    ];
    try { feeds_write_json(EL_SETTINGS_FILE, $ny + ['updatedAt' => date('c')]); }
    catch (Throwable $e) { el_fail(500, $e->getMessage()); }
    el_out(el_settings());
}

if ($action !== '')         el_fail(400, 'ukendt handling');
if ($method !== 'GET')      el_fail(405, 'kun GET');

// ─── Valgfri indstillinger fra config.php ──────────────────────────
$omraade = defined('ELPRIS_OMRADE') ? strtoupper((string)ELPRIS_OMRADE) : 'DK1';
if (!in_array($omraade, ['DK1', 'DK2'], true)) el_fail(500, "ELPRIS_OMRADE skal være 'DK1' eller 'DK2'");
$vindue = defined('ELPRIS_VINDUE_TIMER') ? max(1, min(12, (int)ELPRIS_VINDUE_TIMER)) : 3;

$tarif = array_fill(0, 24, 0.0);
if (defined('ELPRIS_TARIF_TIMER') && is_array(ELPRIS_TARIF_TIMER) && count(ELPRIS_TARIF_TIMER) > 0) {
    if (count(ELPRIS_TARIF_TIMER) !== 24) el_fail(500, 'ELPRIS_TARIF_TIMER skal have præcis 24 tal (time 0 til 23), eller være tom');
    $tarif = array_map('floatval', array_values(ELPRIS_TARIF_TIMER));
}

$st = el_settings();
$tillaegKr = ($st['fastOre'] + $st['selskabOre']) / 100.0;
$momsFaktor = 1.0 + $st['momsPct'] / 100.0;
$harTillaeg = abs($tillaegKr) > 1e-9 || count(array_filter($tarif, fn($x) => abs($x) > 1e-9)) > 0;

// ─── Hent fra kilderne ─────────────────────────────────────────────
/** GET med en rigtig User-Agent (elpriser.org's Cloudflare afviser dem uden). Kun to faste værter. */
function el_get(string $url, int $timeout = 20): string
{
    $host = strtolower((string)parse_url($url, PHP_URL_HOST));
    if (parse_url($url, PHP_URL_SCHEME) !== 'https' || !in_array($host, ['api.energidataservice.dk', 'elpriser.org'], true)) {
        throw new RuntimeException('uventet adresse');
    }
    $headers = ['Accept: application/json', 'User-Agent: familieoverblik/1.0 (hjemmeserver)'];
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true, CURLOPT_HTTPHEADER => $headers,
            CURLOPT_TIMEOUT => $timeout, CURLOPT_CONNECTTIMEOUT => 10, CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_MAXFILESIZE => 5_000_000,
        ]);
        $raw  = curl_exec($ch);
        $err  = curl_error($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);
        if ($raw === false) throw new RuntimeException("kunne ikke nå $host: " . ($err ?: 'ukendt fejl'));
    } else {
        $ctx = stream_context_create(['http' => [
            'method' => 'GET', 'header' => implode("\r\n", $headers),
            'timeout' => $timeout, 'ignore_errors' => true, 'follow_location' => 0,
        ]]);
        $raw = @file_get_contents($url, false, $ctx);
        if ($raw === false) throw new RuntimeException("kunne ikke nå $host");
        $code = 0;
        foreach ($http_response_header ?? [] as $h) {
            if (preg_match('#^HTTP/\S+\s+(\d{3})#', $h, $m)) $code = (int)$m[1];
        }
    }
    if ($code >= 400) throw new RuntimeException("$host svarede HTTP $code");
    return (string)$raw;
}

/** @return list<array{t:string,dkk:float}>  t = dansk lokaltid "ÅÅÅÅ-MM-DDTTT:MM"; dkk pr. MWh */
function el_hent(string $omraade): array
{
    // Rigeligt vindue: i går til og med i overmorgen. start/end tolkes ikke ens
    // af alle datasæt (dansk tid eller UTC); skærmen skærer selv i det.
    $tz  = new DateTimeZone(TIMEZONE);
    $fra = (new DateTimeImmutable('today', $tz))->modify('-1 day')->format('Y-m-d\T00:00');
    $til = (new DateTimeImmutable('today', $tz))->modify('+3 days')->format('Y-m-d\T00:00');
    $url = 'https://api.energidataservice.dk/dataset/DayAheadPrices?' . http_build_query([
        'start'  => $fra, 'end' => $til,
        'filter' => json_encode(['PriceArea' => [$omraade]]),
        'sort'   => 'TimeDK asc', 'limit' => 1000,
    ], '', '&', PHP_QUERY_RFC3986);

    $j = json_decode(el_get($url), true);
    if (!is_array($j) || !isset($j['records']) || !is_array($j['records'])) {
        throw new RuntimeException('Uventet svar fra Energi Data Service');
    }
    $ud = [];
    foreach ($j['records'] as $r) {
        if (!is_array($r)) continue;
        $t = (string)($r['TimeDK'] ?? $r['HourDK'] ?? '');
        if (!preg_match('/^\d{4}-\d\d-\d\dT\d\d:\d\d/', $t)) continue;
        $dkk = $r['DayAheadPriceDKK'] ?? null;
        if ($dkk === null && isset($r['DayAheadPriceEUR'])) $dkk = (float)$r['DayAheadPriceEUR'] * 7.46;   // kronen er bundet til euroen
        if ($dkk === null) continue;
        $ud[] = ['t' => substr($t, 0, 16), 'dkk' => (float)$dkk];
    }
    return $ud;
}

/**
 * Prognose fra elpriser.org: børspris uden moms (spot_ex) i kr./kWh, time for time,
 * i dag og 9 døgn frem. kind: 'actual' = offentliggjort børspris, 'model' = maskinlæring,
 * 'heuristic' = gennemsnit af samme ugedag og time de seneste fire uger.
 *
 * @return array{generatedAt:string, records:list<array{t:string,spot:float,min:?float,max:?float,kind:string}>}
 */
function el_prognose_hent(string $omraade): array
{
    $url = 'https://elpriser.org/api/forecast?' . http_build_query(['area' => $omraade, 'mode' => 'spot_ex'], '', '&', PHP_QUERY_RFC3986);
    $j = json_decode(el_get($url), true);
    if (!is_array($j) || !isset($j['days']) || !is_array($j['days'])) throw new RuntimeException('Uventet svar fra elpriser.org');

    $ud = [];
    foreach ($j['days'] as $dag) {
        if (!is_array($dag) || !preg_match('/^\d{4}-\d\d-\d\d$/', (string)($dag['date'] ?? '')) || !is_array($dag['prices'] ?? null)) continue;
        $kind = ($dag['type'] ?? '') === 'actual' ? 'actual' : ((($dag['source'] ?? '') === 'heuristic') ? 'heuristic' : 'model');
        foreach ($dag['prices'] as $p) {
            if (!is_array($p) || !isset($p['hour'], $p['price']) || !is_numeric($p['price'])) continue;
            $ud[] = [
                't'    => sprintf('%sT%02d:00', $dag['date'], (int)$p['hour']),
                'spot' => (float)$p['price'],
                'min'  => isset($p['min']) && is_numeric($p['min']) ? (float)$p['min'] : null,
                'max'  => isset($p['max']) && is_numeric($p['max']) ? (float)$p['max'] : null,
                'kind' => $kind,
            ];
        }
    }
    return ['generatedAt' => (string)($j['model']['generatedAt'] ?? ''), 'records' => $ud];
}

/** Hent med disk-cache. Kan kilden ikke nås, bruges det gemte (stale = true). */
function el_cached(string $fil, int $ttl, callable $hent): array
{
    $cache = null;
    if (is_file($fil)) {
        $c = json_decode((string)@file_get_contents($fil), true);
        if (is_array($c) && isset($c['fetchedAt'], $c['data'])) $cache = $c;
    }
    if ($cache && (time() - (int)$cache['fetchedAt']) <= $ttl) {
        return ['data' => $cache['data'], 'stale' => false, 'at' => (int)$cache['fetchedAt'], 'fejl' => null];
    }
    try {
        $ny = $hent();
        feeds_write_json($fil, ['fetchedAt' => time(), 'data' => $ny]);
        return ['data' => $ny, 'stale' => false, 'at' => time(), 'fejl' => null];
    } catch (Throwable $e) {
        if ($cache) return ['data' => $cache['data'], 'stale' => true, 'at' => (int)$cache['fetchedAt'], 'fejl' => $e->getMessage()];
        return ['data' => null, 'stale' => true, 'at' => 0, 'fejl' => $e->getMessage()];
    }
}

$idag = date('Y-m-d');

// Børs: kvarter for kvarter. Morgendagens priser udkommer ca. kl. 13; mangler de efter det, spørges oftere.
$boersFil = DATA_DIR . '/cache/elpris-' . $omraade . '.json';
$boersTtl = 900;
if (is_file($boersFil)) {
    $c = json_decode((string)@file_get_contents($boersFil), true);
    $harMorgen = false;
    foreach (($c['data'] ?? []) as $r) if (is_array($r) && substr((string)($r['t'] ?? ''), 0, 10) > $idag) { $harMorgen = true; break; }
    if (!$harMorgen && (int)date('G') >= 13) $boersTtl = 300;
}
$boers = el_cached($boersFil, $boersTtl, fn() => el_hent($omraade));
if ($boers['data'] === null) el_fail(502, 'Kunne ikke hente elprisen: ' . $boers['fejl']);

// Prognose: modellen kører dagligt, så en time er rigeligt. Fejler den, virker resten stadig.
$prog = el_cached(DATA_DIR . '/cache/elpris-prognose-' . $omraade . '.json', 3600, fn() => el_prognose_hent($omraade));

// ─── Læg moms og tillæg på ─────────────────────────────────────────
$pris = static function (float $spotKr, int $time) use ($tillaegKr, $tarif, $momsFaktor): float {
    return round(($spotKr + $tillaegKr + $tarif[$time]) * $momsFaktor, 4);
};

$points = [];
foreach ($boers['data'] as $r) {
    if (substr($r['t'], 0, 10) < $idag) continue;
    $points[] = ['t' => $r['t'], 'p' => $pris((float)$r['dkk'] / 1000.0, (int)substr($r['t'], 11, 2))];
}

$forecast = null;
if ($prog['data'] !== null) {
    $fp = [];
    foreach ($prog['data']['records'] as $r) {
        if (substr($r['t'], 0, 10) < $idag) continue;
        $time = (int)substr($r['t'], 11, 2);
        $e = ['t' => $r['t'], 'p' => $pris($r['spot'], $time), 'k' => $r['kind']];
        if ($r['min'] !== null) $e['min'] = $pris($r['min'], $time);
        if ($r['max'] !== null) $e['max'] = $pris($r['max'], $time);
        $fp[] = $e;
    }
    $forecast = ['generatedAt' => $prog['data']['generatedAt'], 'stale' => $prog['stale'], 'points' => $fp];
}

$momsTekst = $st['momsPct'] > 0
    ? ', inkl. ' . rtrim(rtrim(number_format($st['momsPct'], 1, ',', ''), '0'), ',') . ' % moms'
    : ', uden moms';

el_out([
    'area'        => $omraade,
    'unit'        => 'kr./kWh',
    'beskrivelse' => 'Børspris' . ($harTillaeg ? ' + tillæg' : '') . $momsTekst,
    'vindueTimer' => $vindue,
    'points'      => $points,
    'stale'       => $boers['stale'],
    'hentet'      => date('c', $boers['at'] ?: time()),
    'forecast'    => $forecast,
    'forecastFejl' => $prog['data'] === null ? $prog['fejl'] : null,
]);
