<?php
/**
 * tema.php — farverne i Familieoverblik (forsiden, opsætningen og uploadsiden).
 *
 *   GET  tema.php                 -> {vars: {"--paper": "#fbfaf6", …}, updatedAt}   (kun de farver, der er ændret)
 *   POST tema.php                 {"vars": {"--paper": "#fbfaf6", …}}               gem (tomt = standard)
 *   POST tema.php?action=nulstil  tilbage til standard
 *
 * Kun de navne i TEMA_NOEGLER og kun farver på formen #rrggbb tages imod, så en fejl kan ikke sætte andet i siderne.
 * Farverne gælder for alle enheder. Siderne husker dem i browseren, så de ikke blinker i standardfarver ved åbning.
 * Adgang som de andre endpoints, både til at læse og gemme: en af nøglerne i X-Ugeplan-Key OG PIN-cookien.
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

function tema_out(array $data, int $code = 200): never
{
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE | JSON_FORCE_OBJECT);
    exit;
}

function tema_fail(int $code, string $msg): never
{
    http_response_code($code);
    echo json_encode(['error' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($lib === null || !is_file("$lib/gate.php")) tema_fail(500, 'ugeplan-lib/feeds.php eller gate.php mangler');
require_once "$lib/feeds.php";
require_once "$lib/gate.php";

$key = (string)($_SERVER['HTTP_X_UGEPLAN_KEY'] ?? '');
$ok  = ($key !== '' && WRITE_TOKEN !== 'UDFYLD' && hash_equals(WRITE_TOKEN, $key))
    || ($key !== '' && READ_TOKEN  !== 'UDFYLD' && hash_equals(READ_TOKEN,  $key));
if (!$ok)       tema_fail(401, 'ukendt eller manglende nøgle');
if (!gate_ok()) tema_fail(403, 'log ind med familiens kode først');

const TEMA_FILE = DATA_DIR . '/private/tema.json';
const TEMA_NOEGLER = ['--paper', '--card', '--card-weekend', '--ink', '--ink-soft', '--ink-faint', '--rule', '--rule-soft',
    '--panel', '--panel-ink', '--panel-soft', '--panel-rule', '--tint-blue', '--tint-pink', '--tint-yellow', '--accent',
    '--p-1', '--p-2', '--p-3', '--p-4', '--p-5',
    '--p-6', '--p-7', '--p-8', '--p-9', '--p-10', '--p-11', '--p-12'];

/** Kun kendte navne med en farve på formen #rrggbb. Små bogstaver. @return array<string,string> */
function tema_rens(mixed $v): array
{
    $ud = [];
    if (!is_array($v)) return $ud;
    foreach (TEMA_NOEGLER as $n) {
        $c = $v[$n] ?? null;
        if (is_string($c) && preg_match('/^#[0-9a-fA-F]{6}\z/', $c) === 1) $ud[$n] = strtolower($c);
    }
    return $ud;
}

function tema_laes(): array
{
    if (!is_file(TEMA_FILE)) return ['vars' => [], 'updatedAt' => ''];
    $d = json_decode((string)@file_get_contents(TEMA_FILE), true);
    return ['vars' => is_array($d) ? tema_rens($d['vars'] ?? null) : [], 'updatedAt' => is_array($d) ? (string)($d['updatedAt'] ?? '') : ''];
}

date_default_timezone_set(TIMEZONE);
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
try {
    if ($method === 'GET') tema_out(tema_laes());
    if ($method !== 'POST') tema_fail(405, 'kun GET og POST');

    if (($_GET['action'] ?? '') === 'nulstil') {
        if (is_file(TEMA_FILE) && !@unlink(TEMA_FILE)) tema_fail(500, 'Kunne ikke slette de gemte farver.');
        tema_out(['vars' => [], 'updatedAt' => '']);
    }
    $raw = file_get_contents('php://input');
    $b = ($raw !== false && $raw !== '' && strlen($raw) < 4000) ? json_decode($raw, true) : null;
    if (!is_array($b) || !array_key_exists('vars', $b) || !is_array($b['vars'])) tema_fail(400, 'kroppen skal være {"vars": {…}}');
    $vars = tema_rens($b['vars']);
    if (!$vars) {                                                         // intet at gemme = standard
        if (is_file(TEMA_FILE)) @unlink(TEMA_FILE);
        tema_out(['vars' => [], 'updatedAt' => '']);
    }
    $nu = date('c');
    try { feeds_write_json(TEMA_FILE, ['vars' => $vars, 'updatedAt' => $nu]); }
    catch (Throwable $e) { tema_fail(500, $e->getMessage()); }
    tema_out(['vars' => $vars, 'updatedAt' => $nu]);
} catch (Throwable $e) {
    tema_fail(500, $e->getMessage());
}
