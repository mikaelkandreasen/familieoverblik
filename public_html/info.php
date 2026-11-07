<?php
/**
 * info.php — version og ændringslog til siderne.
 *
 *   GET info.php?del=version     -> {version, dato}           (fra version.json)
 *   GET info.php?del=changelog   -> {markdown}                (fra CHANGELOG.md)
 *
 * Hvorfor en PHP-fil og ikke bare version.json og CHANGELOG.md: .htaccess spærrer alle .json- og .md-filer
 * (en fejlplaceret fil må ikke koste dig nøglerne). Det er med vilje, så filerne læses her i stedet.
 * Adgang som de andre endpoints: en af nøglerne i X-Ugeplan-Key OG PIN-cookien.
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

function info_out(array $data, int $code = 200): never
{
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

if ($lib === null || !is_file("$lib/gate.php")) info_out(['error' => 'ugeplan-lib/feeds.php eller gate.php mangler'], 500);
require_once "$lib/feeds.php";
require_once "$lib/gate.php";

$key = (string)($_SERVER['HTTP_X_UGEPLAN_KEY'] ?? '');
$ok  = ($key !== '' && WRITE_TOKEN !== 'UDFYLD' && hash_equals(WRITE_TOKEN, $key))
    || ($key !== '' && READ_TOKEN  !== 'UDFYLD' && hash_equals(READ_TOKEN,  $key));
if (!$ok)       info_out(['error' => 'ukendt eller manglende nøgle'], 401);
if (!gate_ok()) info_out(['error' => 'log ind med familiens kode først'], 403);
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') info_out(['error' => 'kun GET'], 405);

$del = (string)($_GET['del'] ?? '');
if ($del === 'version') {
    $d = is_file(__DIR__ . '/version.json') ? json_decode((string)@file_get_contents(__DIR__ . '/version.json'), true) : null;
    if (!is_array($d) || !is_string($d['version'] ?? null) || preg_match('/^\d+\.\d+\.\d+\z/', $d['version']) !== 1) {
        info_out(['error' => 'version.json mangler eller er ugyldig'], 404);
    }
    $dato = (string)($d['dato'] ?? '');
    info_out(['version' => $d['version'], 'dato' => preg_match('/^\d{4}-\d{2}-\d{2}\z/', $dato) === 1 ? $dato : '']);
}
if ($del === 'changelog') {
    $fil = __DIR__ . '/CHANGELOG.md';
    if (!is_file($fil)) info_out(['error' => 'CHANGELOG.md findes ikke her. Kør ./lokal/opdater.sh for at få den med.'], 404);
    if (filesize($fil) > 400000) info_out(['error' => 'CHANGELOG.md er for stor'], 413);
    info_out(['markdown' => (string)file_get_contents($fil)]);
}
info_out(['error' => 'brug del=version eller del=changelog'], 400);
