<?php
/**
 * api.php — det eneste, skærmen og de to sync-scripts taler med.
 *
 *   GET  api.php?get=planner/2026-W35,aula/2026-W35
 *        -> {"planner/2026-W35":{"payload":…,"updatedAt":…,"rev":…}, …}
 *
 *   GET  api.php?revs=planner/2026-W35,aula/2026-W35
 *        -> {"planner/2026-W35":"a1b2c3d4e5f6", …}      (null hvis dokumentet ikke findes)
 *
 *   POST api.php?path=planner/2026-W35
 *        krop: {"payload":{…},"merge":true}
 *        -> {"rev":…,"updatedAt":…}
 *
 * Godkendelse sker med headeren  X-Ugeplan-Key.  Ikke i URL'en: forespørgsels-
 * strenge havner i webhotellets adgangslog, og nøglen ville så ligge i klartekst
 * i en fil, du ikke selv rydder op i.
 *
 * To nøgler med hver sin rækkevidde:
 *   READ_TOKEN   ligger i config.js og kan læses af enhver med adressen.
 *                Må hente alt, men kun skrive det skærmen selv redigerer.
 *   WRITE_TOKEN  ligger kun på din PC. Må skrive alt.
 */

declare(strict_types=1);

// Find ugeplan-lib ved at gå opad. Så virker det både når filen ligger i
// webroot og når den ligger i en undermappe — uden at nogen skal rette stier.
$lib = null;
for ($d = __DIR__, $i = 0; $i < 5; $i++, $d = dirname($d)) {
    if (is_file($d . '/ugeplan-lib/store.php')) { $lib = $d . '/ugeplan-lib/store.php'; break; }
    if ($d === dirname($d)) break;
}
if ($lib === null) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    exit('{"error":"ugeplan-lib blev ikke fundet — den skal ligge i en mappe over api.php"}');
}
require_once $lib;

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');

const API_MAX_PATHS = 40;

/** Stier, READ_TOKEN også må skrive til — præcis det, skærmens dialoger gemmer. */
function api_read_token_may_write(string $path): bool
{
    return str_starts_with($path, 'planner/')
        || $path === 'settings/recurring'
        || $path === 'settings/birthdays'
        || $path === 'settings/notes';   // opslagstavlen: telefonen skriver direkte
}

function api_fail(int $code, string $msg): never
{
    http_response_code($code);
    echo json_encode(['error' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}

/** Returnerer 'write', 'read' eller null. */
function api_role(): ?string
{
    $key = $_SERVER['HTTP_X_UGEPLAN_KEY'] ?? '';
    if ($key === '') return null;

    // hash_equals sammenligner i konstant tid, så svartiden ikke røber
    // hvor mange tegn af nøglen der var rigtige.
    if (hash_equals(WRITE_TOKEN, $key)) return 'write';
    if (hash_equals(READ_TOKEN,  $key)) return 'read';
    return null;
}

/** Del en kommasepareret liste af stier op og valider hver enkelt. */
function api_paths(string $raw): array
{
    $paths = array_values(array_filter(array_map('trim', explode(',', $raw)), 'strlen'));
    if (!$paths)                          api_fail(400, 'ingen stier angivet');
    if (count($paths) > API_MAX_PATHS)    api_fail(400, 'for mange stier på én gang');
    foreach ($paths as $p) {
        if (!store_valid_path($p))        api_fail(400, "ugyldig sti: $p");
    }
    return array_unique($paths);
}

// ─── Fejl-fra-start ────────────────────────────────────────────────
// Bedre at sige det højt end at lade en uudfyldt installation svare 200
// på alting, fordi nøglen tilfældigvis matcher strengen "UDFYLD".
if (READ_TOKEN === 'UDFYLD' || WRITE_TOKEN === 'UDFYLD' || READ_TOKEN === WRITE_TOKEN) {
    api_fail(500, 'ugeplan-lib/config.php er ikke udfyldt: READ_TOKEN og WRITE_TOKEN skal være sat og forskellige');
}

$role = api_role();
if ($role === null) {
    header('WWW-Authenticate: Ugeplan');
    api_fail(401, 'ukendt eller manglende nøgle');
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// ─── Læsning ───────────────────────────────────────────────────────
if ($method === 'GET') {

    if (isset($_GET['revs'])) {
        $out = [];
        foreach (api_paths((string)$_GET['revs']) as $p) $out[$p] = store_rev($p);
        echo json_encode($out, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    if (isset($_GET['get'])) {
        $out = [];
        foreach (api_paths((string)$_GET['get']) as $p) {
            $doc = store_read($p);
            if ($doc === null) { $out[$p] = null; continue; }
            $doc->rev = store_rev($p);
            $out[$p] = $doc;
        }
        echo json_encode($out, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    api_fail(400, 'brug ?get= eller ?revs=');
}

// ─── Skrivning ─────────────────────────────────────────────────────
if ($method === 'POST') {

    $path = (string)($_GET['path'] ?? '');
    if (!store_valid_path($path))                       api_fail(400, "ugyldig sti: $path");
    if ($role === 'read' && !api_read_token_may_write($path)) {
        api_fail(403, "læsenøglen må ikke skrive til $path");
    }

    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '')                  api_fail(400, 'tom krop');
    if (strlen($raw) > STORE_MAX_BYTES)                 api_fail(413, 'kroppen er for stor');

    $body = json_decode($raw, false);
    if (!is_object($body) || !property_exists($body, 'payload')) {
        api_fail(400, 'kroppen skal være {"payload":…} — ' . json_last_error_msg());
    }

    try {
        $doc = store_write($path, $body->payload, !empty($body->merge));
    } catch (Throwable $e) {
        error_log('ugeplan api: ' . $e->getMessage());
        api_fail(500, $e->getMessage());
    }

    echo json_encode(['rev' => $doc->rev, 'updatedAt' => $doc->updatedAt]);
    exit;
}

api_fail(405, 'kun GET og POST');
