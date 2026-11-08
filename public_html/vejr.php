<?php
/**
 * vejr.php — vejrkortet i overblik.html: timevejr for i dag og 5 dages prognose, for hjemmet og højst ÉN ekstra lokation.
 *
 *   GET  vejr.php                       -> {steder: [{id, navn, timer, dage, i_dag, hentet, stale?, fejl?}]}
 *   GET  vejr.php?action=indstillinger  -> {hjemNavn, ekstra: {navn, lat, lon}|null}
 *   GET  vejr.php?action=sog&q=aarhus   -> {resultater: [{navn, omraade, land, lat, lon}]}   (opslag af stednavne)
 *   POST vejr.php                       {"hjemNavn":"Hjem","ekstra":{"navn":"Mormor","lat":55.4,"lon":10.4}|null}   gem
 *
 * Data kommer fra Open-Meteo (gratis, uden nøgle), hentet af serveren og gemt i 30 minutter. Hjemmets sted er LATITUDE/LONGITUDE i config.php.
 * Den ekstra lokation bruger stedets egen tidszone, så «i dag» er stedets dag. Adgang som de andre endpoints: nøgle OG PIN-cookie.
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

function vejr_out(array $data, int $code = 200): never
{
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE | JSON_PRESERVE_ZERO_FRACTION);
    exit;
}
function vejr_fail(int $code, string $msg): never { vejr_out(['error' => $msg], $code); }

if ($lib === null || !is_file("$lib/gate.php") || !is_file("$lib/eksternt.php")) vejr_fail(500, 'ugeplan-lib/feeds.php, gate.php eller eksternt.php mangler');
require_once "$lib/feeds.php";
require_once "$lib/gate.php";
require_once "$lib/eksternt.php";
$key = (string)($_SERVER['HTTP_X_UGEPLAN_KEY'] ?? '');
$ok  = ($key !== '' && WRITE_TOKEN !== 'UDFYLD' && hash_equals(WRITE_TOKEN, $key))
    || ($key !== '' && READ_TOKEN  !== 'UDFYLD' && hash_equals(READ_TOKEN,  $key));
if (!$ok)       vejr_fail(401, 'ukendt eller manglende nøgle');
if (!gate_ok()) vejr_fail(403, 'log ind med familiens kode først');
date_default_timezone_set(TIMEZONE);

const VEJR_FILE   = DATA_DIR . '/private/vejr.json';
const VEJR_TTL    = 1800;
const VEJR_VAERTER = ['api.open-meteo.com', 'geocoding-api.open-meteo.com'];

function vejr_settings(): array
{
    $s = ['hjemNavn' => 'Hjem', 'ekstra' => null];
    $d = is_file(VEJR_FILE) ? json_decode((string)@file_get_contents(VEJR_FILE), true) : null;
    if (is_array($d)) {
        if (is_string($d['hjemNavn'] ?? null) && trim($d['hjemNavn']) !== '') $s['hjemNavn'] = mb_substr(trim($d['hjemNavn']), 0, 40, 'UTF-8');
        $e = vejr_ekstra($d['ekstra'] ?? null);
        if ($e !== null) $s['ekstra'] = $e;
    }
    return $s;
}

/** Gyldig ekstra lokation eller null. @return array{navn:string,lat:float,lon:float}|null */
function vejr_ekstra(mixed $e): ?array
{
    if (!is_array($e) || !is_string($e['navn'] ?? null) || trim($e['navn']) === '' || !is_numeric($e['lat'] ?? null) || !is_numeric($e['lon'] ?? null)) return null;
    $lat = (float)$e['lat']; $lon = (float)$e['lon'];
    if ($lat < -90 || $lat > 90 || $lon < -180 || $lon > 180) return null;
    return ['navn' => mb_substr(trim($e['navn']), 0, 80, 'UTF-8'), 'lat' => round($lat, 4), 'lon' => round($lon, 4)];
}

function vejr_url(float $lat, float $lon, string $tz): string
{
    return 'https://api.open-meteo.com/v1/forecast?latitude=' . rawurlencode((string)$lat) . '&longitude=' . rawurlencode((string)$lon)
        . '&hourly=temperature_2m,apparent_temperature,precipitation,precipitation_probability,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m,is_day'
        . '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,sunrise,sunset,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant'
        . '&wind_speed_unit=ms&forecast_days=6&timezone=' . rawurlencode($tz);
}

/** Gør Open-Meteos svar kompakt: timerne for stedets dag i dag og de næste 5 dage. */
function vejr_komprimer(array $d): array
{
    $dg = $d['daily'] ?? []; $t = $d['hourly'] ?? [];
    $dage = (array)($dg['time'] ?? []);
    if (!$dage || !is_array($t['time'] ?? null)) throw new RuntimeException('Uventet svar fra vejrtjenesten.');
    $idag = (string)$dage[0];
    $r1 = fn($v) => $v === null ? null : round((float)$v, 1);
    $timer = [];
    foreach ($t['time'] as $i => $tid) {
        if (!is_string($tid) || !str_starts_with($tid, $idag)) continue;
        $timer[] = ['t' => substr($tid, 11, 5), 'temp' => $r1($t['temperature_2m'][$i] ?? null), 'foeles' => $r1($t['apparent_temperature'][$i] ?? null),
            'regn' => $r1($t['precipitation'][$i] ?? null), 'sand' => isset($t['precipitation_probability'][$i]) ? (int)$t['precipitation_probability'][$i] : null,
            'kode' => (int)($t['weather_code'][$i] ?? 0), 'vind' => $r1($t['wind_speed_10m'][$i] ?? null), 'stoed' => $r1($t['wind_gusts_10m'][$i] ?? null),
            'retning' => isset($t['wind_direction_10m'][$i]) ? (int)round((float)$t['wind_direction_10m'][$i]) : null, 'dag' => (int)($t['is_day'][$i] ?? 1)];
    }
    $naeste = [];
    for ($i = 1; $i <= 5 && $i < count($dage); $i++) {
        $naeste[] = ['dato' => (string)$dage[$i], 'kode' => (int)($dg['weather_code'][$i] ?? 0), 'max' => $r1($dg['temperature_2m_max'][$i] ?? null),
            'min' => $r1($dg['temperature_2m_min'][$i] ?? null), 'regn' => $r1($dg['precipitation_sum'][$i] ?? null),
            'sand' => isset($dg['precipitation_probability_max'][$i]) ? (int)$dg['precipitation_probability_max'][$i] : null,
            'vind' => $r1($dg['wind_speed_10m_max'][$i] ?? null), 'stoed' => $r1($dg['wind_gusts_10m_max'][$i] ?? null),
            'retning' => isset($dg['wind_direction_10m_dominant'][$i]) ? (int)round((float)$dg['wind_direction_10m_dominant'][$i]) : null];
    }
    return ['tidszone' => (string)($d['timezone'] ?? ''), 'dato' => $idag, 'timer' => $timer, 'dage' => $naeste,
        'i_dag' => ['kode' => (int)($dg['weather_code'][0] ?? 0), 'max' => $r1($dg['temperature_2m_max'][0] ?? null), 'min' => $r1($dg['temperature_2m_min'][0] ?? null),
            'regn' => $r1($dg['precipitation_sum'][0] ?? null), 'vind' => $r1($dg['wind_speed_10m_max'][0] ?? null), 'stoed' => $r1($dg['wind_gusts_10m_max'][0] ?? null),
            'retning' => isset($dg['wind_direction_10m_dominant'][0]) ? (int)round((float)$dg['wind_direction_10m_dominant'][0]) : null, 'sol_op' => substr((string)($dg['sunrise'][0] ?? ''), 11, 5), 'sol_ned' => substr((string)($dg['sunset'][0] ?? ''), 11, 5)]];
}

/** Dagens dato på stedet, regnet ud fra den tidszone, svaret havde. Bruges til at se, om det gemte svar stadig handler om «i dag». */
function vejr_dato_nu(array $data): string
{
    try { return (new DateTimeImmutable('now', new DateTimeZone((string)($data['tidszone'] ?? '') ?: TIMEZONE)))->format('Y-m-d'); }
    catch (Throwable $e) { return date('Y-m-d'); }
}

/** Ét steds vejr med disk-cache (30 min, og kun hvis det handler om stedets dag i dag). Kan tjenesten ikke nås, bruges det gemte (stale). */
function vejr_sted(string $id, float $lat, float $lon, string $tz): array
{
    $fil = DATA_DIR . '/cache/vejr-' . $id . '-' . substr(md5($lat . '|' . $lon), 0, 8) . '.json';
    $c = is_file($fil) ? json_decode((string)@file_get_contents($fil), true) : null;
    $c = is_array($c) && isset($c['at'], $c['data']) && is_array($c['data']) ? $c : null;
    if ($c && time() - (int)$c['at'] <= VEJR_TTL && ($c['data']['dato'] ?? '') === vejr_dato_nu($c['data'])) {
        return $c['data'] + ['hentet' => date('c', (int)$c['at']), 'stale' => false];
    }
    try {
        $ny = vejr_komprimer(ekstern_json(vejr_url($lat, $lon, $tz), VEJR_VAERTER));
        feeds_write_json($fil, ['at' => time(), 'data' => $ny]);
        return $ny + ['hentet' => date('c'), 'stale' => false];
    } catch (Throwable $e) {
        if ($c) return $c['data'] + ['hentet' => date('c', (int)$c['at']), 'stale' => true];
        throw $e;
    }
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = (string)($_GET['action'] ?? '');
try {
    if ($method === 'GET' && $action === 'indstillinger') vejr_out(vejr_settings());
    if ($method === 'GET' && $action === 'sog') {
        $q = trim((string)($_GET['q'] ?? ''));
        if (mb_strlen($q, 'UTF-8') < 2 || mb_strlen($q, 'UTF-8') > 60) vejr_fail(400, 'Skriv mindst to bogstaver (og højst 60).');
        try { $d = ekstern_json('https://geocoding-api.open-meteo.com/v1/search?name=' . rawurlencode($q) . '&count=8&language=da&format=json', VEJR_VAERTER, 10); }
        catch (Throwable $e) { vejr_fail(502, $e->getMessage()); }
        $ud = [];
        foreach ((array)($d['results'] ?? []) as $r) {
            if (!is_array($r) || !is_string($r['name'] ?? null) || !is_numeric($r['latitude'] ?? null) || !is_numeric($r['longitude'] ?? null)) continue;
            $ud[] = ['navn' => mb_substr($r['name'], 0, 80, 'UTF-8'), 'omraade' => mb_substr((string)($r['admin1'] ?? ''), 0, 80, 'UTF-8'),
                'land' => mb_substr((string)($r['country'] ?? ''), 0, 60, 'UTF-8'), 'lat' => round((float)$r['latitude'], 4), 'lon' => round((float)$r['longitude'], 4)];
        }
        vejr_out(['resultater' => $ud]);
    }
    if ($method === 'GET' && $action === '') {
        $s = vejr_settings();
        $steder = [];
        $liste = [['hjem', $s['hjemNavn'], (float)LATITUDE, (float)LONGITUDE, TIMEZONE]];
        if ($s['ekstra']) $liste[] = ['ekstra', $s['ekstra']['navn'], $s['ekstra']['lat'], $s['ekstra']['lon'], 'auto'];
        foreach ($liste as [$id, $navn, $lat, $lon, $tz]) {
            try { $steder[] = ['id' => $id, 'navn' => $navn] + vejr_sted($id, $lat, $lon, $tz); }
            catch (Throwable $e) { $steder[] = ['id' => $id, 'navn' => $navn, 'fejl' => $e->getMessage()]; }
        }
        vejr_out(['steder' => $steder]);
    }
    if ($method !== 'POST' || $action !== '') vejr_fail(400, 'ukendt handling');
    $raw = file_get_contents('php://input');
    $b = ($raw !== false && $raw !== '' && strlen($raw) < 2000) ? json_decode($raw, true) : null;
    if (!is_array($b)) vejr_fail(400, 'kroppen skal være JSON');
    $navn = is_string($b['hjemNavn'] ?? null) ? trim($b['hjemNavn']) : 'Hjem';
    if ($navn === '' || mb_strlen($navn, 'UTF-8') > 40) vejr_fail(400, 'Hjemmets navn skal være 1 til 40 tegn.');
    $e = null;
    if (($b['ekstra'] ?? null) !== null) {
        $e = vejr_ekstra($b['ekstra']);
        if ($e === null) vejr_fail(400, 'Den ekstra lokation skal have et navn og gyldige koordinater.');
    }
    try { feeds_write_json(VEJR_FILE, ['hjemNavn' => $navn, 'ekstra' => $e, 'updatedAt' => date('c')]); }
    catch (Throwable $ex) { vejr_fail(500, $ex->getMessage()); }
    vejr_out(vejr_settings());
} catch (Throwable $e) {
    vejr_fail(500, $e->getMessage());
}
