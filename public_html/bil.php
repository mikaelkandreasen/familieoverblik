<?php
/**
 * bil.php — kortet "Bil" i overblik.html og indstillingerne i index.html.
 *
 *   GET  bil.php               -> {aktiv, tider, status, iDag, maxFriske}
 *   POST bil.php?action=gem    {"aktiv":true,"tider":[{"tid":"06:15","frisk":false}, …]}
 *   POST bil.php?action=nu     (bed om en aflæsning fra det gemte med det samme)
 *
 * Selve aflæsningen laves af Docker-servicen "bil" (lokal/bil/bil_sync.py), der logger ind
 * hos Hyundai. Den fil her logger aldrig ind og kender ingen adgangskoder: den læser det,
 * servicen har skrevet i DATA_DIR/bil/, og skriver tidspunkterne i DATA_DIR/private/bil.json,
 * som servicen læser igen.
 *
 *   gemt  = læser det, Hyundais server allerede ved. Vækker ikke bilen.
 *   frisk = beder bilen om en ny status. Vækker den og belaster 12 V-batteriet. Højst 2 om dagen.
 *
 * Adgang som indkob.php: en af nøglerne i X-Ugeplan-Key OG PIN-cookien.
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

function bil_out(array $data, int $code = 200): never
{
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function bil_fail(int $code, string $msg): never
{
    bil_out(['error' => $msg], $code);
}

if ($lib === null || !is_file("$lib/gate.php")) bil_fail(500, 'ugeplan-lib/feeds.php eller gate.php mangler');
require_once "$lib/feeds.php";   // DATA_DIR og feeds_write_json()
require_once "$lib/gate.php";

$key = (string)($_SERVER['HTTP_X_UGEPLAN_KEY'] ?? '');
$ok  = ($key !== '' && WRITE_TOKEN !== 'UDFYLD' && hash_equals(WRITE_TOKEN, $key))
    || ($key !== '' && READ_TOKEN  !== 'UDFYLD' && hash_equals(READ_TOKEN,  $key));
if (!$ok)       bil_fail(401, 'ukendt eller manglende nøgle');
if (!gate_ok()) bil_fail(403, 'log ind med familiens kode først');

date_default_timezone_set(TIMEZONE);

const BIL_FILE      = DATA_DIR . '/private/bil.json';
const BIL_DIR       = DATA_DIR . '/bil';
const BIL_MAX_FRISKE = 2;
const BIL_MIN_MELLEMRUM = 10;     // minutter mellem to tider
const BIL_MAX_TIDER = 6;
const BIL_TID_RE    = '/^(?:[01]\d|2[0-3]):[0-5]\d\z/';

/** Standarden, før noget er gemt: 06:15, 12:00, 18:00 (frisk) og 22:00. */
function bil_standard(): array
{
    return ['aktiv' => true, 'tider' => [
        ['tid' => '06:15', 'frisk' => false], ['tid' => '12:00', 'frisk' => false],
        ['tid' => '18:00', 'frisk' => true],  ['tid' => '22:00', 'frisk' => false],
    ]];
}

/** @return list<array{tid:string, frisk:bool}> */
function bil_rens_tider(mixed $raa): array
{
    $ud = [];
    foreach (is_array($raa) ? $raa : [] as $e) {
        if (!is_array($e) || !is_string($e['tid'] ?? null) || preg_match(BIL_TID_RE, $e['tid']) !== 1) continue;
        if (isset($ud[$e['tid']])) continue;
        $ud[$e['tid']] = ['tid' => $e['tid'], 'frisk' => (bool)($e['frisk'] ?? false)];
    }
    ksort($ud);
    return array_values($ud);
}

function bil_settings(): array
{
    $s = bil_standard();
    if (is_file(BIL_FILE)) {
        $d = json_decode((string)@file_get_contents(BIL_FILE), true);
        if (is_array($d)) {
            if (isset($d['aktiv'])) $s['aktiv'] = (bool)$d['aktiv'];
            $t = bil_rens_tider($d['tider'] ?? null);
            if ($t) $s['tider'] = $t;
        }
    }
    return $s;
}

function bil_min(string $tid): int
{
    return (int)substr($tid, 0, 2) * 60 + (int)substr($tid, 3, 2);
}

function bil_json(string $fil): ?array
{
    if (!is_file($fil)) return null;
    $d = json_decode((string)@file_get_contents($fil), true);
    return is_array($d) ? $d : null;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = (string)($_GET['action'] ?? '');

try {
    if ($method === 'GET' && $action === '') {
        $s = bil_settings();
        $st = bil_json(BIL_DIR . '/status.json');
        // kun de felter, kortet skal bruge
        $status = null;
        if ($st) {
            $status = array_intersect_key($st, array_flip(['soc', 'plugged', 'charging', 'rangeKm', 'bil12v', 'bilTid', 'navn', 'opdateret', 'kilde', 'tidspunkt', 'note', 'fejl']));
            if (isset($status['fejl']) && is_array($status['fejl'])) $status['fejl'] = array_intersect_key($status['fejl'], array_flip(['tid', 'tidspunkt', 'besked']));
        }
        $idag = date('Y-m-d');
        $iDag = [];
        foreach ((bil_json(BIL_DIR . '/historik.json')['dage'] ?? []) as $h) {
            if (is_array($h) && str_starts_with((string)($h['t'] ?? ''), $idag)) {
                $iDag[] = ['t' => (string)$h['t'], 'soc' => $h['soc'] ?? null, 'kilde' => (string)($h['kilde'] ?? '')];
            }
        }
        bil_out($s + ['status' => $status, 'iDag' => $iDag, 'maxFriske' => BIL_MAX_FRISKE]);
    }
    if ($method !== 'POST') bil_fail(405, 'kun GET og POST');

    $raw = file_get_contents('php://input');
    $b = ($raw !== false && $raw !== '' && strlen($raw) < 4000) ? json_decode($raw, true) : (($action === 'nu') ? [] : null);
    if (!is_array($b)) bil_fail(400, 'kroppen skal være JSON');

    if ($action === 'gem') {
        $tider = bil_rens_tider($b['tider'] ?? null);
        if (count($tider) < 1)                bil_fail(400, 'Der skal være mindst ét gyldigt tidspunkt (tt:mm, fx 06:15).');
        if (count($tider) > BIL_MAX_TIDER)    bil_fail(400, 'Højst ' . BIL_MAX_TIDER . ' tidspunkter.');
        $friske = count(array_filter($tider, fn($t) => $t['frisk']));
        if ($friske > BIL_MAX_FRISKE) bil_fail(400, 'Højst ' . BIL_MAX_FRISKE . ' friske aflæsninger om dagen. De vækker bilen og belaster 12 V-batteriet.');
        for ($i = 1; $i < count($tider); $i++) {
            if (bil_min($tider[$i]['tid']) - bil_min($tider[$i - 1]['tid']) < BIL_MIN_MELLEMRUM) {
                bil_fail(400, 'Der skal være mindst ' . BIL_MIN_MELLEMRUM . ' minutter mellem tidspunkterne (' . $tider[$i - 1]['tid'] . ' og ' . $tider[$i]['tid'] . ').');
            }
        }
        try { feeds_write_json(BIL_FILE, ['aktiv' => (bool)($b['aktiv'] ?? false), 'tider' => $tider, 'updatedAt' => date('c')]); }
        catch (Throwable $e) { bil_fail(500, $e->getMessage()); }
        bil_out(bil_settings() + ['maxFriske' => BIL_MAX_FRISKE]);
    }

    if ($action === 'nu') {
        $anm = BIL_DIR . '/anmodning.json';
        $st = bil_json(BIL_DIR . '/status.json');
        $sidste = isset($st['opdateret']) ? strtotime((string)$st['opdateret']) : false;
        if (is_file($anm) && time() - (int)filemtime($anm) < 300) bil_fail(429, 'Der er allerede bedt om en aflæsning. Vent et par minutter.');
        if ($sidste !== false && time() - $sidste < 300)        bil_fail(429, 'Der er lige hentet. Vent fem minutter, før du beder om en ny.');
        if (!is_dir(BIL_DIR) && !@mkdir(BIL_DIR, 0770, true) && !is_dir(BIL_DIR)) bil_fail(500, 'Kunne ikke oprette mappen til bildata.');
        if (@file_put_contents($anm, json_encode(['t' => date('c')]), LOCK_EX) === false) bil_fail(500, 'Kunne ikke bede om en aflæsning.');
        bil_out(['ok' => true]);
    }
    bil_fail(400, 'ukendt handling');

} catch (Throwable $e) {
    bil_fail(500, $e->getMessage());
}
