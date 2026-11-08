<?php
/**
 * totp.php — totrinsbekræftelse (TOTP) til login: slå til og fra, gendannelseskoder, husk enheder, log alle ud.
 *
 *   GET  totp.php                    status: {aktiv, gendannelse_tilbage, husk_dage}
 *   POST totp.php                    {"handling": "start" | "bekraeft" | "fra" | "koder" | "husk" | "alle-ud", ...}
 *
 * Al logik (RFC 6238, gendannelseskoder, rotation af adgangscookien) ligger i bootstrap.py og er afprøvet. Her videresendes kun forespørgslen uden en shell.
 * Kræver nøgle OG PIN-cookie (og dermed totrinsbekræftelsen, hvis den er slået til). Skifter adgangscookien (ved til/fra og «Log alle enheder ud»),
 * får DEN, der trykkede, en ny cookie med det samme, så vedkommende ikke bliver smidt ud midt i det.
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

function to_out(array $data, int $code = 200): never
{
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}
function to_fail(int $code, string $msg): never { to_out(['ok' => false, 'fejl' => $msg], $code); }

if ($lib === null || !is_file("$lib/gate.php")) to_fail(500, 'ugeplan-lib/feeds.php eller gate.php mangler');
require_once "$lib/feeds.php";
require_once "$lib/gate.php";
$key = (string)($_SERVER['HTTP_X_UGEPLAN_KEY'] ?? '');
$ok  = ($key !== '' && WRITE_TOKEN !== 'UDFYLD' && hash_equals(WRITE_TOKEN, $key))
    || ($key !== '' && READ_TOKEN  !== 'UDFYLD' && hash_equals(READ_TOKEN,  $key));
if (!$ok)       to_fail(401, 'ukendt eller manglende nøgle');
if (!gate_ok()) to_fail(403, 'log ind med familiens kode først');

const TO_BOOTSTRAP = '/opt/familieoverblik/bootstrap.py';
const TO_HANDLINGER = ['start', 'bekraeft', 'fra', 'koder', 'husk', 'alle-ud'];

/** @return array{int,string} */
function to_py(array $args, ?string $stdin = null): array
{
    if (!is_file(TO_BOOTSTRAP)) return [127, json_encode(['ok' => false, 'fejl' => 'bootstrap.py findes ikke. Kører du webbilledet fra version 3?'])];
    $p = @proc_open(array_merge(['python3', TO_BOOTSTRAP], $args), [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
    if (!is_resource($p)) return [126, json_encode(['ok' => false, 'fejl' => 'Kunne ikke starte opsætningsprogrammet.'])];
    if ($stdin !== null) fwrite($pipes[0], $stdin);
    fclose($pipes[0]);
    $ud = (string)stream_get_contents($pipes[1]); fclose($pipes[1]); fclose($pipes[2]);
    return [proc_close($p), $ud];
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'GET') {
    [$kode, $svar] = to_py(['totp', 'status']);
    $j = json_decode($svar, true);
    to_out(is_array($j) ? $j : ['ok' => false, 'fejl' => 'Uventet svar fra opsætningsprogrammet.'], $kode === 0 ? 200 : 500);
}
if ($method !== 'POST') to_fail(405, 'kun GET og POST');
$raw = file_get_contents('php://input');
$b = ($raw !== false && $raw !== '' && strlen($raw) < 2000) ? json_decode($raw, true) : null;
if (!is_array($b) || !in_array($b['handling'] ?? null, TO_HANDLINGER, true)) to_fail(400, 'Ukendt handling.');
$handling = (string)$b['handling'];
unset($b['handling']);
// Er «handling» det eneste felt, er $b nu et TOMT array, og json_encode giver da [] (en liste), ikke {} (et objekt). Python afviser en liste: «Forespørgslen skal være JSON».
[$kode, $svar] = to_py(['totp', $handling], json_encode($b === [] ? new stdClass() : $b));
$j = json_decode($svar, true);
if (!is_array($j)) to_fail(500, 'Uventet svar fra opsætningsprogrammet.');
if (isset($j['ny_gate']) && is_string($j['ny_gate']) && strlen($j['ny_gate']) >= 32) {
    setcookie('ugeplan_ok', $j['ny_gate'], ['expires' => time() + 60 * 60 * 24 * 180, 'path' => '/', 'secure' => (($_SERVER['HTTPS'] ?? '') === 'on'), 'httponly' => true, 'samesite' => 'Lax']);
}
unset($j['ny_gate']);                              // den nye adgangscookie skal aldrig stå i svaret
to_out($j, $kode === 0 ? 200 : 400);
