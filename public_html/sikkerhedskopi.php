<?php
/**
 * sikkerhedskopi.php — hent og gendan en sikkerhedskopi af alle data (version 3).
 *
 *   GET  sikkerhedskopi.php   hent en tar.gz med data, billeder, indstillinger og nøgler (ikke cachen)
 *   POST sikkerhedskopi.php   (multipart, felt «fil») gendan fra en tar.gz eller zip, også en zip af version 2's ugeplan-data-mappe
 *
 * Filen indeholder nøgler og PIN-kode (private/instans.json). Behandl den som en adgangskode. Begge kræver nøgle OG PIN-cookie.
 * Selve arbejdet (sikker udpakning, afvisning af farlige stier, validering af indstillinger) ligger i bootstrap.py.
 */

declare(strict_types=1);

$lib = null;
for ($d = __DIR__, $i = 0; $i < 5; $i++, $d = dirname($d)) {
    if (is_file($d . '/ugeplan-lib/feeds.php')) { $lib = $d . '/ugeplan-lib'; break; }
    if ($d === dirname($d)) break;
}
function sk_fail(int $code, string $msg): never
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'fejl' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}
if ($lib === null || !is_file("$lib/gate.php")) sk_fail(500, 'ugeplan-lib/feeds.php eller gate.php mangler');
require_once "$lib/feeds.php";
require_once "$lib/gate.php";
$key = (string)($_SERVER['HTTP_X_UGEPLAN_KEY'] ?? '');
$ok  = ($key !== '' && WRITE_TOKEN !== 'UDFYLD' && hash_equals(WRITE_TOKEN, $key))
    || ($key !== '' && READ_TOKEN  !== 'UDFYLD' && hash_equals(READ_TOKEN,  $key));
if (!$ok)       sk_fail(401, 'ukendt eller manglende nøgle');
if (!gate_ok()) sk_fail(403, 'log ind med familiens kode først');
date_default_timezone_set(TIMEZONE);
const SK_BOOTSTRAP = '/opt/familieoverblik/bootstrap.py';
if (!is_file(SK_BOOTSTRAP)) sk_fail(500, 'bootstrap.py findes ikke. Kører du webbilledet fra version 3?');
@set_time_limit(900);

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'GET') {
    $p = proc_open(['python3', SK_BOOTSTRAP, 'backup'], [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
    if (!is_resource($p)) sk_fail(500, 'Kunne ikke starte sikkerhedskopien.');
    header('Content-Type: application/gzip');
    header('Content-Disposition: attachment; filename="familieoverblik-sikkerhedskopi-' . date('Ymd-Hi') . '.tar.gz"');
    header('Cache-Control: no-store');
    fpassthru($pipes[1]); fclose($pipes[1]); fclose($pipes[2]);
    proc_close($p);
    exit;
}
if ($method !== 'POST') sk_fail(405, 'kun GET og POST');
$f = $_FILES['fil'] ?? null;
if (!is_array($f) || ($f['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK || !is_uploaded_file((string)$f['tmp_name']) || (int)$f['size'] < 1) {
    sk_fail(400, 'Der kom ingen fil med, eller den var for stor (højst ca. 2 GB).');
}
$p = proc_open(['python3', SK_BOOTSTRAP, 'gendan', (string)$f['tmp_name']], [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
if (!is_resource($p)) sk_fail(500, 'Kunne ikke starte gendannelsen.');
$ud = (string)stream_get_contents($pipes[1]); fclose($pipes[1]); fclose($pipes[2]);
$kode = proc_close($p);
$j = json_decode($ud, true);
header('Content-Type: application/json; charset=utf-8');
http_response_code($kode === 0 ? 200 : 400);
echo json_encode(is_array($j) ? $j : ['ok' => false, 'fejl' => 'Uventet svar fra gendannelsen.'], JSON_UNESCAPED_UNICODE);
