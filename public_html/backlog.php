<?php
/**
 * backlog.php — backlog.html: ønsker og idéer, som familien selv kan logge, stemme på og kommentere.
 *
 *   GET  backlog.php                       -> {punkter, kategorier, prioriteter, statusser}
 *   POST backlog.php                       {"handling": "nyt" | "ret" | "stem" | "kommentar" | "slet" | "importer" | "eksport", …}
 *
 * Al logik og validering ligger i bootstrap.py (afprøvet). Her videresendes kun forespørgslen uden en shell.
 * Kræver nøgle OG PIN-cookie (og dermed totrinsbekræftelse, hvis den er slået til). Gemmes i ugeplan-data/private/backlog.json.
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

function bl_out(array $data, int $code = 200): never
{
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}
function bl_fail(int $code, string $msg): never { bl_out(['ok' => false, 'fejl' => $msg], $code); }

if ($lib === null || !is_file("$lib/gate.php")) bl_fail(500, 'ugeplan-lib/feeds.php eller gate.php mangler');
require_once "$lib/feeds.php";
require_once "$lib/gate.php";
$key = (string)($_SERVER['HTTP_X_UGEPLAN_KEY'] ?? '');
$ok  = ($key !== '' && WRITE_TOKEN !== 'UDFYLD' && hash_equals(WRITE_TOKEN, $key))
    || ($key !== '' && READ_TOKEN  !== 'UDFYLD' && hash_equals(READ_TOKEN,  $key));
if (!$ok)       bl_fail(401, 'ukendt eller manglende nøgle');
if (!gate_ok()) bl_fail(403, 'log ind med familiens kode først');

const BL_BOOTSTRAP = '/opt/familieoverblik/bootstrap.py';
const BL_HANDLINGER = ['nyt', 'ret', 'stem', 'kommentar', 'slet', 'importer', 'eksport'];

/** @return array{int,string} */
function bl_py(string $handling, string $stdin): array
{
    if (!is_file(BL_BOOTSTRAP)) return [127, json_encode(['ok' => false, 'fejl' => 'bootstrap.py findes ikke. Kører du webbilledet fra version 3?'])];
    $p = @proc_open(['python3', BL_BOOTSTRAP, 'backlog', $handling], [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
    if (!is_resource($p)) return [126, json_encode(['ok' => false, 'fejl' => 'Kunne ikke starte programmet.'])];
    fwrite($pipes[0], $stdin);
    fclose($pipes[0]);
    $ud = (string)stream_get_contents($pipes[1]); fclose($pipes[1]); fclose($pipes[2]);
    return [proc_close($p), $ud];
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'GET') {
    [$kode, $svar] = bl_py('liste', '{}');
} elseif ($method === 'POST') {
    $raw = file_get_contents('php://input');
    $b = ($raw !== false && $raw !== '' && strlen($raw) < 600000) ? json_decode($raw, true) : null;
    if (!is_array($b) || !in_array($b['handling'] ?? null, BL_HANDLINGER, true)) bl_fail(400, 'Ukendt handling.');
    $h = (string)$b['handling'];
    unset($b['handling']);
    [$kode, $svar] = bl_py($h, (string)json_encode($b));
} else {
    bl_fail(405, 'kun GET og POST');
}
$j = json_decode($svar, true);
bl_out(is_array($j) ? $j : ['ok' => false, 'fejl' => 'Uventet svar fra programmet.'], $kode === 0 ? 200 : 400);
