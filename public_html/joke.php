<?php
/**
 * joke.php — dagens joke fra JokeAPI (https://v2.jokeapi.dev) til kortet «Dagens joke» i overblik.html.
 *
 *   GET  joke.php                      -> {aktiv, dato, joke: {type, joke|setup+delivery, category, id, lang}, stale}
 *   GET  joke.php?action=indstillinger -> {aktiv, kategori, sprog, kategorier, sprogliste}
 *   POST joke.php                      {"aktiv":true,"kategori":"Any","sprog":"en"}   gem
 *
 * Serveren henter ÉN joke om dagen (højst en gang pr. dag og indstilling) og gemmer den, så hele familien ser den samme hele dagen.
 * Safe mode og alle blacklist-flag er ALTID slået til, og kategorien «Dark» tilbydes ikke. Børn ser skærmen.
 * JokeAPI har ikke danske jokes. Sproglisten kommer fra tjenesten selv. Grænsen er 120 kald i minuttet pr. adresse; vi bruger ét om dagen.
 * Tjenesten oplyser at den indsamler anonymiserede data (https://sv443.net/privacypolicy/en). Kun NUC'ens adresse kontaktes, ingen enheder i huset.
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

function joke_out(array $data, int $code = 200): never
{
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}
function joke_fail(int $code, string $msg): never { joke_out(['error' => $msg], $code); }

if ($lib === null || !is_file("$lib/gate.php") || !is_file("$lib/eksternt.php")) joke_fail(500, 'ugeplan-lib/feeds.php, gate.php eller eksternt.php mangler');
require_once "$lib/feeds.php";
require_once "$lib/gate.php";
require_once "$lib/eksternt.php";
$key = (string)($_SERVER['HTTP_X_UGEPLAN_KEY'] ?? '');
$ok  = ($key !== '' && WRITE_TOKEN !== 'UDFYLD' && hash_equals(WRITE_TOKEN, $key))
    || ($key !== '' && READ_TOKEN  !== 'UDFYLD' && hash_equals(READ_TOKEN,  $key));
if (!$ok)       joke_fail(401, 'ukendt eller manglende nøgle');
if (!gate_ok()) joke_fail(403, 'log ind med familiens kode først');
date_default_timezone_set(TIMEZONE);

const JOKE_FILE        = DATA_DIR . '/private/joke.json';
const JOKE_VAERT       = 'v2.jokeapi.dev';
const JOKE_KATEGORIER  = ['Any', 'Misc', 'Programming', 'Pun', 'Spooky', 'Christmas'];   // «Dark» er ikke med, med vilje
const JOKE_FLAG        = 'nsfw,religious,political,racist,sexist,explicit';
const JOKE_SPROG_TTL   = 604800;
const JOKE_MAX_TEKST   = 600;

function joke_settings(): array
{
    $s = ['aktiv' => true, 'kategori' => 'Any', 'sprog' => 'en'];
    $d = is_file(JOKE_FILE) ? json_decode((string)@file_get_contents(JOKE_FILE), true) : null;
    if (is_array($d)) {
        if (isset($d['aktiv'])) $s['aktiv'] = (bool)$d['aktiv'];
        if (is_string($d['kategori'] ?? null) && in_array($d['kategori'], JOKE_KATEGORIER, true)) $s['kategori'] = $d['kategori'];
        if (is_string($d['sprog'] ?? null) && preg_match('/^[a-z]{2}\z/', $d['sprog']) === 1) $s['sprog'] = $d['sprog'];
    }
    return $s;
}

/** Sprogene, jokes findes på (fra tjenesten, gemt i 7 døgn). Uden svar: engelsk og tysk. @return list<string> */
function joke_sprogliste(): array
{
    $fil = DATA_DIR . '/cache/joke-sprog.json';
    $c = is_file($fil) ? json_decode((string)@file_get_contents($fil), true) : null;
    if (is_array($c) && isset($c['at'], $c['sprog']) && time() - (int)$c['at'] <= JOKE_SPROG_TTL && is_array($c['sprog'])) return array_values($c['sprog']);
    try {
        $d = ekstern_json('https://' . JOKE_VAERT . '/languages', [JOKE_VAERT], 10);
        $l = array_values(array_filter((array)($d['jokeLanguages'] ?? []), fn($x) => is_string($x) && preg_match('/^[a-z]{2}\z/', $x) === 1));
        if ($l) { feeds_write_json($fil, ['at' => time(), 'sprog' => $l]); return $l; }
    } catch (Throwable $e) { /* brug det gemte eller standarden */ }
    return is_array($c) && is_array($c['sprog'] ?? null) && $c['sprog'] ? array_values($c['sprog']) : ['en', 'de'];
}

/** En joke gjort ren: kun kendte felter, afkortet. @return array<string,mixed> */
function joke_rens(array $j): array
{
    $cut = fn($v) => mb_substr(trim((string)$v), 0, JOKE_MAX_TEKST, 'UTF-8');
    $ud = ['type' => ($j['type'] ?? '') === 'twopart' ? 'twopart' : 'single', 'category' => $cut($j['category'] ?? ''), 'id' => (int)($j['id'] ?? 0), 'lang' => $cut($j['lang'] ?? '')];
    if ($ud['type'] === 'twopart') { $ud['setup'] = $cut($j['setup'] ?? ''); $ud['delivery'] = $cut($j['delivery'] ?? ''); if ($ud['setup'] === '' || $ud['delivery'] === '') throw new RuntimeException('Jokes uden tekst.'); }
    else { $ud['joke'] = $cut($j['joke'] ?? ''); if ($ud['joke'] === '') throw new RuntimeException('Jokes uden tekst.'); }
    return $ud;
}

function joke_url(string $kat, string $sprog): string
{
    return 'https://' . JOKE_VAERT . '/joke/' . $kat . '?safe-mode&blacklistFlags=' . JOKE_FLAG . '&type=single,twopart&lang=' . $sprog;
}

/** Dagens joke. Gemt pr. dato og indstilling; kan tjenesten ikke nås, bruges den seneste gemte (stale). @return array{joke:array, stale:bool, dato:string} */
function joke_idag(array $s): array
{
    $dato = date('Y-m-d');
    $fil = DATA_DIR . '/cache/joke-' . $dato . '-' . substr(md5($s['kategori'] . '|' . $s['sprog']), 0, 8) . '.json';
    if (is_file($fil)) {
        $c = json_decode((string)@file_get_contents($fil), true);
        if (is_array($c) && is_array($c['joke'] ?? null)) return ['joke' => $c['joke'], 'stale' => false, 'dato' => $dato];
    }
    try {
        $d = ekstern_json(joke_url($s['kategori'], $s['sprog']), [JOKE_VAERT]);
        if (($d['error'] ?? false) === true) throw new RuntimeException((string)($d['message'] ?? 'Ingen joke fundet.'));
        $j = joke_rens($d);
        feeds_write_json($fil, ['joke' => $j, 'at' => time()]);
        return ['joke' => $j, 'stale' => false, 'dato' => $dato];
    } catch (Throwable $e) {
        $nyeste = null;
        foreach (glob(DATA_DIR . '/cache/joke-*-*.json') ?: [] as $f) if (!$nyeste || filemtime($f) > filemtime($nyeste)) $nyeste = $f;
        $c = $nyeste ? json_decode((string)@file_get_contents($nyeste), true) : null;
        if (is_array($c) && is_array($c['joke'] ?? null)) return ['joke' => $c['joke'], 'stale' => true, 'dato' => $dato];
        throw $e;
    }
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = (string)($_GET['action'] ?? '');
try {
    if ($method === 'GET' && $action === 'indstillinger') {
        joke_out(joke_settings() + ['kategorier' => JOKE_KATEGORIER, 'sprogliste' => joke_sprogliste()]);
    }
    if ($method === 'GET' && $action === '') {
        $s = joke_settings();
        if (!$s['aktiv']) joke_out(['aktiv' => false]);
        try { $r = joke_idag($s); } catch (Throwable $e) { joke_fail(502, $e->getMessage()); }
        joke_out(['aktiv' => true, 'dato' => $r['dato'], 'joke' => $r['joke'], 'stale' => $r['stale']]);
    }
    if ($method !== 'POST' || $action !== '') joke_fail(400, 'ukendt handling');
    $raw = file_get_contents('php://input');
    $b = ($raw !== false && $raw !== '' && strlen($raw) < 1000) ? json_decode($raw, true) : null;
    if (!is_array($b)) joke_fail(400, 'kroppen skal være JSON');
    $kat = is_string($b['kategori'] ?? null) ? $b['kategori'] : '';
    $sprog = is_string($b['sprog'] ?? null) ? $b['sprog'] : '';
    if (!in_array($kat, JOKE_KATEGORIER, true)) joke_fail(400, 'Ukendt kategori.');
    if (!in_array($sprog, joke_sprogliste(), true)) joke_fail(400, 'Der findes ikke jokes på det sprog.');
    try { feeds_write_json(JOKE_FILE, ['aktiv' => (bool)($b['aktiv'] ?? false), 'kategori' => $kat, 'sprog' => $sprog, 'updatedAt' => date('c')]); }
    catch (Throwable $e) { joke_fail(500, $e->getMessage()); }
    joke_out(joke_settings() + ['kategorier' => JOKE_KATEGORIER, 'sprogliste' => joke_sprogliste()]);
} catch (Throwable $e) {
    joke_fail(500, $e->getMessage());
}
