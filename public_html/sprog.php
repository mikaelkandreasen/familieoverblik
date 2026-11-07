<?php
/**
 * sprog.php — sprogvalget for alle enheder og sprogfiler lagt ind under Opsætning → Sprog.
 *
 *   GET  sprog.php                    -> {standard, tilpasset: {kode: {navn, tekster}}}
 *   POST sprog.php                    {"standard":"en"}                      standardsprog for alle enheder (hver enhed kan vælge sit eget)
 *   POST sprog.php?action=upload      en sprogfil (format 1, se lokal/sprog.py)  lægges ind og slås sammen med de eksisterende
 *   POST sprog.php?action=slet        {"kode":"sv"}                          fjern et sprog, der er lagt ind
 *
 * De medfølgende sprog (en, de) ligger i sprog-pakker.js. Det her er det, brugeren selv har lagt til eller rettet. Filen valideres hårdt:
 * kun <b>, <i>, <em>, <strong>, <code> og <br> uden attributter i oversættelserne, så en sprogfil aldrig kan sætte script ind på siderne.
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

function sp_out(array $data, int $code = 200): never
{
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE | JSON_FORCE_OBJECT);
    exit;
}
function sp_fail(int $code, string $msg): never { http_response_code($code); echo json_encode(['error' => $msg], JSON_UNESCAPED_UNICODE); exit; }

if ($lib === null || !is_file("$lib/gate.php")) sp_fail(500, 'ugeplan-lib/feeds.php eller gate.php mangler');
require_once "$lib/feeds.php";
require_once "$lib/gate.php";
$key = (string)($_SERVER['HTTP_X_UGEPLAN_KEY'] ?? '');
$ok  = ($key !== '' && WRITE_TOKEN !== 'UDFYLD' && hash_equals(WRITE_TOKEN, $key))
    || ($key !== '' && READ_TOKEN  !== 'UDFYLD' && hash_equals(READ_TOKEN,  $key));
if (!$ok)       sp_fail(401, 'ukendt eller manglende nøgle');
if (!gate_ok()) sp_fail(403, 'log ind med familiens kode først');

const SP_FILE_STD  = DATA_DIR . '/private/sprog.json';
const SP_FILE_PAK  = DATA_DIR . '/private/sprog-tilpasset.json';
const SP_KODE_RE   = '/^[a-z]{2,3}(?:-[A-Za-z]{2,4})?\z/';
const SP_TAGS      = ['b', 'i', 'em', 'strong', 'code', 'br'];
const SP_MAX_BODY  = 1_500_000;
const SP_MAX_SPROG = 20;
const SP_MAX_TEKSTER = 8000;

/** Fejl i en sprogfil. Samme regler som validerFil() i sprog.js og valider() i lokal/sprog.py. @return list<string> */
function sp_valider(mixed $d): array
{
    $fejl = [];
    if (!is_array($d) || ($d['format'] ?? null) !== 1) return ['«format» skal være 1'];
    if (($d['kildesprog'] ?? null) !== 'da') $fejl[] = '«kildesprog» skal være «da»';
    $sp = $d['sprog'] ?? null;
    if (!is_array($sp) || !$sp) return array_merge($fejl, ['«sprog» mangler']);
    if (count($sp) > SP_MAX_SPROG) return array_merge($fejl, ['For mange sprog i én fil (højst ' . SP_MAX_SPROG . ')']);
    foreach ($sp as $kode => $p) {
        $kode = (string)$kode;
        if (preg_match(SP_KODE_RE, $kode) !== 1 || $kode === 'da') { $fejl[] = "$kode: ugyldig sprogkode"; continue; }
        if (!is_array($p) || !is_string($p['navn'] ?? null) || trim($p['navn']) === '' || mb_strlen($p['navn'], 'UTF-8') > 40) { $fejl[] = "$kode: «navn» mangler eller er for langt"; continue; }
        if (!is_array($p['tekster'] ?? null)) { $fejl[] = "$kode: «tekster» mangler"; continue; }
        if (count($p['tekster']) > SP_MAX_TEKSTER) { $fejl[] = "$kode: for mange tekster (højst " . SP_MAX_TEKSTER . ')'; continue; }
        foreach ($p['tekster'] as $k => $v) {
            $k = (string)$k;
            if (!is_string($v) || trim($v) === '') continue;
            if (mb_strlen($k, 'UTF-8') > 600 || mb_strlen($v, 'UTF-8') > 1200) $fejl[] = "$kode: for lang tekst: " . mb_substr($k, 0, 40, 'UTF-8');
            foreach ([$k, $v] as $t) {
                if (preg_match_all('~<\s*/?\s*([A-Za-z0-9]+)[^>]*>~', $t, $m)) foreach ($m[1] as $tag) if (!in_array(strtolower($tag), SP_TAGS, true)) $fejl[] = "$kode: tagget <$tag> er ikke tilladt";
                if (preg_match('~<[^>]*\s(?:on\w+|style|href|src)\s*=~i', $t) === 1) $fejl[] = "$kode: attributter er ikke tilladt";
            }
            preg_match_all('/\{\d+\}/', $k, $a); preg_match_all('/\{\d+\}/', $v, $b2);
            $a = $a[0]; $b2 = $b2[0]; sort($a); sort($b2);
            if ($a !== $b2) $fejl[] = "$kode: pladsholdere passer ikke i «" . mb_substr($k, 0, 40, 'UTF-8') . '»';
        }
        if (count($fejl) > 25) { $fejl[] = '… og flere'; break; }
    }
    return $fejl;
}

/** @return array{standard:string, tilpasset: array<string,array{navn:string,tekster:array<string,string>}>} */
function sp_laes(): array
{
    $s = is_file(SP_FILE_STD) ? json_decode((string)@file_get_contents(SP_FILE_STD), true) : null;
    $standard = is_array($s) && is_string($s['standard'] ?? null) && (preg_match(SP_KODE_RE, $s['standard']) === 1 || $s['standard'] === 'da') ? $s['standard'] : 'da';
    $p = is_file(SP_FILE_PAK) ? json_decode((string)@file_get_contents(SP_FILE_PAK), true) : null;
    $tilp = [];
    if (is_array($p)) foreach ($p as $kode => $x) {
        if (preg_match(SP_KODE_RE, (string)$kode) !== 1 || !is_array($x) || !is_string($x['navn'] ?? null) || !is_array($x['tekster'] ?? null)) continue;
        $t = [];
        foreach ($x['tekster'] as $k => $v) if (is_string($v) && trim($v) !== '') $t[(string)$k] = $v;
        $tilp[(string)$kode] = ['navn' => $x['navn'], 'tekster' => $t];
    }
    return ['standard' => $standard, 'tilpasset' => $tilp];
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = (string)($_GET['action'] ?? '');
try {
    if ($method === 'GET' && $action === '') sp_out(sp_laes());
    if ($method !== 'POST') sp_fail(405, 'kun GET og POST');
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '' || strlen($raw) > SP_MAX_BODY) sp_fail(400, 'Kroppen er tom eller for stor (højst 1,5 MB).');
    $b = json_decode($raw, true);
    if (!is_array($b)) sp_fail(400, 'kroppen skal være JSON');
    $nu = sp_laes();

    if ($action === 'upload') {
        $f = sp_valider($b);
        if ($f) sp_fail(400, 'Sprogfilen kan ikke bruges: ' . implode(' · ', array_slice($f, 0, 6)));
        $tilp = $nu['tilpasset'];
        foreach ($b['sprog'] as $kode => $p) {
            $t = [];
            foreach ($p['tekster'] as $k => $v) if (is_string($v) && trim($v) !== '') $t[(string)$k] = $v;
            $samlet = ($tilp[$kode]['tekster'] ?? []) + [];
            foreach ($t as $k => $v) $samlet[$k] = $v;                       // den nye fil vinder, resten bliver
            if (count($samlet) > SP_MAX_TEKSTER) sp_fail(400, "$kode: for mange tekster i alt (højst " . SP_MAX_TEKSTER . ').');
            $tilp[(string)$kode] = ['navn' => trim($p['navn']), 'tekster' => $samlet];
        }
        if (count($tilp) > SP_MAX_SPROG) sp_fail(400, 'For mange sprog (højst ' . SP_MAX_SPROG . ').');
        try { feeds_write_json(SP_FILE_PAK, $tilp); } catch (Throwable $e) { sp_fail(500, $e->getMessage()); }
        sp_out(sp_laes());
    }
    if ($action === 'slet') {
        $kode = is_string($b['kode'] ?? null) ? $b['kode'] : '';
        $tilp = $nu['tilpasset'];
        if (!isset($tilp[$kode])) sp_fail(404, 'Det sprog er ikke lagt ind.');
        unset($tilp[$kode]);
        try { if ($tilp) feeds_write_json(SP_FILE_PAK, $tilp); elseif (is_file(SP_FILE_PAK)) @unlink(SP_FILE_PAK); } catch (Throwable $e) { sp_fail(500, $e->getMessage()); }
        sp_out(sp_laes());
    }
    if ($action === '') {
        $std = is_string($b['standard'] ?? null) ? $b['standard'] : '';
        if ($std !== 'da' && preg_match(SP_KODE_RE, $std) !== 1) sp_fail(400, 'Ugyldig sprogkode.');
        try { feeds_write_json(SP_FILE_STD, ['standard' => $std, 'updatedAt' => date('c')]); } catch (Throwable $e) { sp_fail(500, $e->getMessage()); }
        sp_out(sp_laes());
    }
    sp_fail(400, 'ukendt handling');
} catch (Throwable $e) {
    sp_fail(500, $e->getMessage());
}
