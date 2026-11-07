<?php
/**
 * billeder.php — billederne til pauseskærmen på overblik.html og valget i index.html.
 *
 *   GET  billeder.php?action=liste            -> {indstillinger, filer:[{id, tid, bytes}], maxFiler}
 *   GET  billeder.php?action=hent&id=<fil>    -> selve billedet (bruges af <img>)
 *   POST billeder.php?action=gem              {"aktiv":true,"inaktivMin":5,"sekunder":15,…}
 *   POST billeder.php?action=upload           billedet som kroppen (image/jpeg, image/png eller image/webp)
 *   POST billeder.php?action=slet             {"id":"…"}
 *
 * ── Hvor billederne ligger ─────────────────────────────────────────────
 * DATA_DIR/billeder/ (ugeplan-data/billeder). Mappen ligger uden for webroden;
 * billederne vises kun gennem denne fil, og kun efter PIN-koden. Alt, der
 * lægges i mappen, vises: upload fra index.html, men også billeder, der
 * synkroniseres dertil med andre værktøjer (fx Syncthing eller frameo-sync).
 * Kun jpg, png og webp med ufarlige filnavne vises.
 *
 * ── Adgang ─────────────────────────────────────────────────────────────
 * Alt undtagen "hent": en af nøglerne i X-Ugeplan-Key OG PIN-cookien (som indkob.php).
 * "hent": kun PIN-cookien, fordi et <img>-tag ikke kan sende en header.
 */

declare(strict_types=1);

$lib = null;
for ($d = __DIR__, $i = 0; $i < 5; $i++, $d = dirname($d)) {
    if (is_file($d . '/ugeplan-lib/feeds.php')) { $lib = $d . '/ugeplan-lib'; break; }
    if ($d === dirname($d)) break;
}
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');

function bi_out(array $data, int $code = 200): never
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function bi_fail(int $code, string $msg): never
{
    bi_out(['error' => $msg], $code);
}

if ($lib === null || !is_file("$lib/gate.php")) bi_fail(500, 'ugeplan-lib/feeds.php eller gate.php mangler');
require_once "$lib/feeds.php";   // DATA_DIR og feeds_write_json()
require_once "$lib/gate.php";

const BI_DIR       = DATA_DIR . '/billeder';
const BI_FILE      = DATA_DIR . '/private/billeder.json';
const BI_MAX_BYTES = 15_000_000;   // pr. billede
const BI_MAX_FILER = 1000;
/** Filnavne: ingen skråstreger, ingen punktum først, kun disse tegn og endelser. */
const BI_ID_RE     = '/^[A-Za-z0-9_-][A-Za-z0-9._-]{0,118}\.(?:jpe?g|png|webp)\z/i';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = (string)($_GET['action'] ?? '');

// ─── Adgang ────────────────────────────────────────────────────────
if ($action !== 'hent') {
    $key = (string)($_SERVER['HTTP_X_UGEPLAN_KEY'] ?? '');
    $ok  = ($key !== '' && WRITE_TOKEN !== 'UDFYLD' && hash_equals(WRITE_TOKEN, $key))
        || ($key !== '' && READ_TOKEN  !== 'UDFYLD' && hash_equals(READ_TOKEN,  $key));
    if (!$ok) bi_fail(401, 'ukendt eller manglende nøgle');
}
if (!gate_ok()) bi_fail(403, 'log ind med familiens kode først');

// ─── Indstillinger ─────────────────────────────────────────────────
/** @return array{aktiv:bool, inaktivMin:int, sekunder:int, raekkefolge:string, tilpasning:string, ur:bool, startVedAabning:bool} */
function bi_settings(): array
{
    $s = ['aktiv' => true, 'inaktivMin' => 5, 'sekunder' => 15, 'raekkefolge' => 'tilfaeldig',
          'tilpasning' => 'udfyld', 'ur' => true, 'startVedAabning' => false];
    if (is_file(BI_FILE)) {
        $d = json_decode((string)@file_get_contents(BI_FILE), true);
        if (is_array($d)) {
            foreach (['aktiv', 'ur', 'startVedAabning'] as $k) if (isset($d[$k])) $s[$k] = (bool)$d[$k];
            if (isset($d['inaktivMin']) && is_numeric($d['inaktivMin'])) $s['inaktivMin'] = max(1, min(240, (int)$d['inaktivMin']));
            if (isset($d['sekunder'])   && is_numeric($d['sekunder']))   $s['sekunder']   = max(3, min(600, (int)$d['sekunder']));
            if (in_array($d['raekkefolge'] ?? '', ['tilfaeldig', 'nyeste'], true)) $s['raekkefolge'] = $d['raekkefolge'];
            if (in_array($d['tilpasning'] ?? '', ['udfyld', 'hele'], true))       $s['tilpasning'] = $d['tilpasning'];
        }
    }
    return $s;
}

function bi_int(mixed $v, string $navn, int $min, int $max): int
{
    if (is_string($v)) $v = str_replace(',', '.', trim($v));
    if (!is_numeric($v) || (float)$v != (int)(float)$v) bi_fail(400, "$navn skal være et helt tal.");
    $n = (int)(float)$v;
    if ($n < $min || $n > $max) bi_fail(400, "$navn skal ligge mellem $min og $max.");
    return $n;
}

// ─── Billeder ──────────────────────────────────────────────────────
/** Jpeg, png eller webp efter filens første bytes (ikke efter hvad browseren påstår). @return ?array{string,string} */
function bi_type(string $b): ?array
{
    if (str_starts_with($b, "\xFF\xD8\xFF"))              return ['jpg', 'image/jpeg'];
    if (str_starts_with($b, "\x89PNG\r\n\x1a\n"))         return ['png', 'image/png'];
    if (strlen($b) > 12 && substr($b, 0, 4) === 'RIFF' && substr($b, 8, 4) === 'WEBP') return ['webp', 'image/webp'];
    return null;
}

function bi_mime(string $id): string
{
    return match (strtolower(pathinfo($id, PATHINFO_EXTENSION))) {
        'png'  => 'image/png',
        'webp' => 'image/webp',
        default => 'image/jpeg',
    };
}

function bi_id(mixed $v): string
{
    $s = (string)$v;
    if (preg_match(BI_ID_RE, $s) !== 1) bi_fail(400, 'ugyldigt filnavn');
    return $s;
}

/** @return list<array{id:string, tid:int, bytes:int}>  nyeste først */
function bi_filer(): array
{
    $ud = [];
    foreach (@scandir(BI_DIR) ?: [] as $f) {
        if (preg_match(BI_ID_RE, $f) !== 1) continue;
        $p = BI_DIR . '/' . $f;
        if (!is_file($p) || is_link($p)) continue;
        $ud[] = ['id' => $f, 'tid' => (int)@filemtime($p), 'bytes' => (int)@filesize($p)];
    }
    usort($ud, fn($a, $b) => $b['tid'] <=> $a['tid'] ?: strcmp($a['id'], $b['id']));
    return $ud;
}

// ─── Forespørgsler ─────────────────────────────────────────────────
try {
    if ($method === 'GET' && $action === 'hent') {
        $id = bi_id($_GET['id'] ?? '');
        $p = BI_DIR . '/' . $id;
        if (!is_file($p) || is_link($p)) { http_response_code(404); exit; }
        header('Content-Type: ' . bi_mime($id));
        header('Content-Length: ' . (string)filesize($p));
        header('Cache-Control: private, max-age=86400');
        readfile($p);
        exit;
    }

    if ($method === 'GET' && $action === 'liste') {
        bi_out(['indstillinger' => bi_settings(), 'filer' => bi_filer(), 'maxFiler' => BI_MAX_FILER]);
    }
    if ($method !== 'POST') bi_fail(405, 'kun GET og POST');

    switch ($action) {
        case 'gem': {
            $raw = file_get_contents('php://input');
            $b = ($raw !== false && $raw !== '' && strlen($raw) < 4000) ? json_decode($raw, true) : null;
            if (!is_array($b)) bi_fail(400, 'kroppen skal være JSON');
            $ny = [
                'aktiv'           => (bool)($b['aktiv'] ?? false),
                'inaktivMin'      => bi_int($b['inaktivMin'] ?? null, 'Start efter (minutter)', 1, 240),
                'sekunder'        => bi_int($b['sekunder'] ?? null, 'Vis hvert billede (sekunder)', 3, 600),
                'raekkefolge'     => in_array($b['raekkefolge'] ?? '', ['tilfaeldig', 'nyeste'], true) ? $b['raekkefolge'] : bi_fail(400, 'ukendt rækkefølge'),
                'tilpasning'      => in_array($b['tilpasning'] ?? '', ['udfyld', 'hele'], true) ? $b['tilpasning'] : bi_fail(400, 'ukendt tilpasning'),
                'ur'              => (bool)($b['ur'] ?? false),
                'startVedAabning' => (bool)($b['startVedAabning'] ?? false),
            ];
            try { feeds_write_json(BI_FILE, $ny + ['updatedAt' => date('c')]); }
            catch (Throwable $e) { bi_fail(500, $e->getMessage()); }
            bi_out(['indstillinger' => bi_settings()]);
        }

        case 'upload': {
            $data = file_get_contents('php://input');
            if ($data === false || $data === '') bi_fail(400, 'tom krop');
            if (strlen($data) > BI_MAX_BYTES) bi_fail(413, 'Billedet er for stort (højst ' . (int)(BI_MAX_BYTES / 1_000_000) . ' MB).');
            $t = bi_type($data);
            if ($t === null) bi_fail(415, 'Kun jpg, png og webp kan bruges.');
            if (!is_dir(BI_DIR) && !@mkdir(BI_DIR, 0770, true) && !is_dir(BI_DIR)) bi_fail(500, 'Kunne ikke oprette mappen til billeder.');
            if (count(bi_filer()) >= BI_MAX_FILER) bi_fail(409, 'Der er allerede ' . BI_MAX_FILER . ' billeder. Slet nogle først.');
            $id = time() . '-' . bin2hex(random_bytes(4)) . '.' . $t[0];
            if (@file_put_contents(BI_DIR . '/' . $id, $data, LOCK_EX) === false) bi_fail(500, 'Kunne ikke gemme billedet.');
            @chmod(BI_DIR . '/' . $id, 0660);
            bi_out(['id' => $id, 'bytes' => strlen($data)]);
        }

        case 'slet': {
            $raw = file_get_contents('php://input');
            $b = ($raw !== false && $raw !== '' && strlen($raw) < 2000) ? json_decode($raw, true) : null;
            $id = bi_id(is_array($b) ? ($b['id'] ?? '') : '');
            $p = BI_DIR . '/' . $id;
            if (is_file($p) && !is_link($p) && !@unlink($p)) bi_fail(500, 'Kunne ikke slette billedet.');
            bi_out(['ok' => true, 'id' => $id]);
        }
    }
    bi_fail(400, 'ukendt handling');

} catch (Throwable $e) {
    bi_fail(500, $e->getMessage());
}
