<?php
/**
 * instans.php — opsætningsguiden og indstillingerne for familien, stedet og forbindelserne (version 3).
 *
 *   POST instans.php?action=start    guiden (start.html). Kræver opsætningskoden fra containerens log og virker KUN, før opsætningen er gennemført.
 *   GET  instans.php                 nuværende indstillinger (hemmeligheder vises kun som «sat»)       — kræver nøgle OG PIN-cookie
 *   POST instans.php                 ret navne, sted, PIN og forbindelser                              — kræver nøgle OG PIN-cookie
 *
 * Al logik og validering ligger i bootstrap.py (én implementering, afprøvet). Her sendes kun forespørgslen videre, uden en shell.
 * Indstillingerne gemmes i ugeplan-data/private/instans.json og skrives ud i siderne og configfilerne med det samme.
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

function in_out(array $data, int $code = 200): never
{
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}
function in_fail(int $code, string $msg): never { in_out(['ok' => false, 'fejl' => $msg], $code); }

if ($lib === null || !is_file("$lib/gate.php")) in_fail(500, 'ugeplan-lib/feeds.php eller gate.php mangler');
require_once "$lib/feeds.php";
require_once "$lib/gate.php";

const IN_BOOTSTRAP = '/opt/familieoverblik/bootstrap.py';

/** Kør bootstrap.py uden shell. @return array{int,string} */
function in_py(array $args, ?string $stdin = null): array
{
    if (!is_file(IN_BOOTSTRAP)) return [127, json_encode(['ok' => false, 'fejl' => 'bootstrap.py findes ikke. Kører du webbilledet fra version 3?'])];
    $p = @proc_open(array_merge(['python3', IN_BOOTSTRAP], $args), [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
    if (!is_resource($p)) return [126, json_encode(['ok' => false, 'fejl' => 'Kunne ikke starte opsætningsprogrammet.'])];
    if ($stdin !== null) fwrite($pipes[0], $stdin);
    fclose($pipes[0]);
    $ud = (string)stream_get_contents($pipes[1]); fclose($pipes[1]); fclose($pipes[2]);
    return [proc_close($p), $ud];
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = (string)($_GET['action'] ?? '');
$raw = $method === 'POST' ? file_get_contents('php://input') : '';
if ($method === 'POST' && ($raw === false || $raw === '' || strlen($raw) > 20000)) in_fail(400, 'Forespørgslen er tom eller for stor.');

if ($action === 'start') {                                    // guiden: ingen login endnu. bootstrap.py tjekker koden, og at der ikke er sat op
    if ($method !== 'POST') in_fail(405, 'kun POST');
    [$kode, $svar] = in_py(['anvend', '--foerste'], $raw);
    $j = json_decode($svar, true);
    in_out(is_array($j) ? $j : ['ok' => false, 'fejl' => 'Uventet svar fra opsætningsprogrammet.'], $kode === 0 ? 200 : 400);
}

$key = (string)($_SERVER['HTTP_X_UGEPLAN_KEY'] ?? '');
$ok  = ($key !== '' && WRITE_TOKEN !== 'UDFYLD' && hash_equals(WRITE_TOKEN, $key))
    || ($key !== '' && READ_TOKEN  !== 'UDFYLD' && hash_equals(READ_TOKEN,  $key));
if (!$ok)       in_fail(401, 'ukendt eller manglende nøgle');
if (!gate_ok()) in_fail(403, 'log ind med familiens kode først');
if ($action !== '') in_fail(400, 'ukendt handling');

if ($method === 'GET') {
    [$kode, $svar] = in_py(['laes']);
    $j = json_decode($svar, true);
    in_out(is_array($j) ? $j : ['ok' => false, 'fejl' => 'Uventet svar fra opsætningsprogrammet.'], $kode === 0 ? 200 : 500);
}
if ($method !== 'POST') in_fail(405, 'kun GET og POST');
[$kode, $svar] = in_py(['anvend'], $raw);
$j = json_decode($svar, true);
in_out(is_array($j) ? $j : ['ok' => false, 'fejl' => 'Uventet svar fra opsætningsprogrammet.'], $kode === 0 ? 200 : 400);
