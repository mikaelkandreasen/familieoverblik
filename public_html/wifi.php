<?php
/**
 * wifi.php — gæstenetværket til QR-koden på gaest-wifi.html.
 *
 *   GET  wifi.php               -> {gemt, ssid, kode, sikkerhed, skjult}
 *   POST wifi.php               {"ssid":"…","kode":"…","sikkerhed":"WPA"|"WEP"|"nopass","skjult":false}   gem
 *   POST wifi.php?action=slet   glem netværket
 *
 * Adgangskoden ligger i klartekst i ugeplan-data/private/wifi.json (ikke i webmappen), og returneres kun til den, der har
 * både nøglen og PIN-cookien. QR-koden tegnes i browseren (qr.js): ingen tjeneste uden for huset ser nogensinde adgangskoden.
 * Behandl PIN-koden derfor som adgangen til gæste-wifi'en. Brug et GÆSTENETVÆRK, ikke dit eget.
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

function wifi_out(array $data, int $code = 200): never
{
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}
function wifi_fail(int $code, string $msg): never { wifi_out(['error' => $msg], $code); }

if ($lib === null || !is_file("$lib/gate.php")) wifi_fail(500, 'ugeplan-lib/feeds.php eller gate.php mangler');
require_once "$lib/feeds.php";
require_once "$lib/gate.php";
$key = (string)($_SERVER['HTTP_X_UGEPLAN_KEY'] ?? '');
$ok  = ($key !== '' && WRITE_TOKEN !== 'UDFYLD' && hash_equals(WRITE_TOKEN, $key))
    || ($key !== '' && READ_TOKEN  !== 'UDFYLD' && hash_equals(READ_TOKEN,  $key));
if (!$ok)       wifi_fail(401, 'ukendt eller manglende nøgle');
if (!gate_ok()) wifi_fail(403, 'log ind med familiens kode først');

const WIFI_FILE = DATA_DIR . '/private/wifi.json';

/** @return array{ok:bool, fejl:string, v:array{ssid:string,kode:string,sikkerhed:string,skjult:bool}} */
function wifi_valider(mixed $b): array
{
    $v = ['ssid' => '', 'kode' => '', 'sikkerhed' => 'WPA', 'skjult' => false];
    if (!is_array($b)) return ['ok' => false, 'fejl' => 'kroppen skal være JSON', 'v' => $v];
    $ssid = is_string($b['ssid'] ?? null) ? $b['ssid'] : '';
    $kode = is_string($b['kode'] ?? null) ? $b['kode'] : '';
    $sik  = is_string($b['sikkerhed'] ?? null) ? $b['sikkerhed'] : 'WPA';
    if (!in_array($sik, ['WPA', 'WEP', 'nopass'], true)) return ['ok' => false, 'fejl' => 'Sikkerheden skal være WPA, WEP eller nopass.', 'v' => $v];
    $n = mb_strlen($ssid, 'UTF-8');
    if ($n < 1 || strlen($ssid) > 32) return ['ok' => false, 'fejl' => 'Netværkets navn skal være mellem 1 og 32 byte.', 'v' => $v];
    if (preg_match('/[\x00-\x1F\x7F]/', $ssid . $kode) === 1) return ['ok' => false, 'fejl' => 'Navn og adgangskode må ikke indeholde styretegn.', 'v' => $v];
    if ($sik === 'nopass') $kode = '';
    elseif ($sik === 'WPA' && (strlen($kode) < 8 || strlen($kode) > 63)) return ['ok' => false, 'fejl' => 'En WPA-adgangskode skal være mellem 8 og 63 tegn.', 'v' => $v];
    elseif ($sik === 'WEP' && preg_match('/^(?:.{5}|.{13}|[0-9a-fA-F]{10}|[0-9a-fA-F]{26})\z/su', $kode) !== 1) return ['ok' => false, 'fejl' => 'En WEP-nøgle er 5 eller 13 tegn, eller 10 eller 26 hex-cifre.', 'v' => $v];
    return ['ok' => true, 'fejl' => '', 'v' => ['ssid' => $ssid, 'kode' => $kode, 'sikkerhed' => $sik, 'skjult' => (bool)($b['skjult'] ?? false)]];
}

function wifi_laes(): array
{
    $d = is_file(WIFI_FILE) ? json_decode((string)@file_get_contents(WIFI_FILE), true) : null;
    $r = wifi_valider($d);
    return $r['ok'] ? ['gemt' => true] + $r['v'] : ['gemt' => false, 'ssid' => '', 'kode' => '', 'sikkerhed' => 'WPA', 'skjult' => false];
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
try {
    if ($method === 'GET') wifi_out(wifi_laes());
    if ($method !== 'POST') wifi_fail(405, 'kun GET og POST');
    if (($_GET['action'] ?? '') === 'slet') {
        if (is_file(WIFI_FILE) && !@unlink(WIFI_FILE)) wifi_fail(500, 'Kunne ikke slette det gemte netværk.');
        wifi_out(wifi_laes());
    }
    $raw = file_get_contents('php://input');
    $b = ($raw !== false && $raw !== '' && strlen($raw) < 2000) ? json_decode($raw, true) : null;
    $r = wifi_valider($b);
    if (!$r['ok']) wifi_fail(400, $r['fejl']);
    try { feeds_write_json(WIFI_FILE, $r['v'] + ['updatedAt' => date('c')]); }
    catch (Throwable $e) { wifi_fail(500, $e->getMessage()); }
    wifi_out(wifi_laes());
} catch (Throwable $e) {
    wifi_fail(500, $e->getMessage());
}
