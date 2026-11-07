<?php
/**
 * kalendere.php — Kalendere-dialogen i index.html taler med denne fil.
 *
 *   GET  kalendere.php                    -> listen, uden adresser
 *   POST kalendere.php?action=test        {"url":…} eller {"id":…}
 *                                         -> kalenderens navn og de næste begivenheder
 *   POST kalendere.php?action=save        {"base":rev, "feeds":[…]}
 *                                         -> den nye liste
 *   POST kalendere.php?action=sync        -> kører ICS-jobbet nu i stedet for om en time
 *
 * ── Adgang ────────────────────────────────────────────────────────────
 * Adresserne er adgangskoder (se feeds.php), så læsenøglen alene er ikke nok:
 * den står i klartekst i config.js. Der kræves en af de to nøgler OG
 * PIN-cookien fra login.php. .htaccess tjekker cookien også, før PHP
 * overhovedet kører — to låse, så en fejl i den ene ikke åbner.
 *
 * Nøglen skal stå i headeren X-Ugeplan-Key, som i api.php. En header kan en
 * fremmed side ikke sætte uden at browseren spørger først, så det lukker
 * også for, at et link udefra kan få en indlogget telefon til at gemme noget.
 *
 * Adresserne sendes aldrig tilbage — kun værten og et kort mærke fra id'et.
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

function kal_fail(int $code, string $msg): never
{
    http_response_code($code);
    echo json_encode(['error' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($lib === null || !is_file("$lib/gate.php")) {
    kal_fail(500, 'ugeplan-lib/feeds.php eller gate.php mangler på webhotellet');
}
require_once "$lib/feeds.php";
require_once "$lib/gate.php";

// ─── Adgang ────────────────────────────────────────────────────────
$key = (string)($_SERVER['HTTP_X_UGEPLAN_KEY'] ?? '');
$role = null;
if ($key !== '' && WRITE_TOKEN !== 'UDFYLD' && hash_equals(WRITE_TOKEN, $key)) $role = 'write';
elseif ($key !== '' && READ_TOKEN !== 'UDFYLD' && hash_equals(READ_TOKEN, $key)) $role = 'read';

if ($role === null) kal_fail(401, 'ukendt eller manglende nøgle');
if (!gate_ok())     kal_fail(403, 'log ind med familiens kode først');

// hent.php giver os http_get(), ics_events() og job_ics(). Den kører ingen
// jobs og kræver ingen cron-nøgle, når den inkluderes — se toppen af filen.
$hent = __DIR__ . '/hent.php';
if (!is_file($hent)) kal_fail(500, 'hent.php mangler ved siden af kalendere.php');
ob_start();
require_once $hent;
ob_end_clean();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = (string)($_GET['action'] ?? '');

/** Højst $n tegn (ikke bytes). Uden mbstring, som ikke er bevist på webhotellet. */
function kal_cut(string $s, int $from, int $n): string
{
    return preg_match('/^.{0,' . $n . '}/us', $s, $m) ? $m[0] : substr($s, 0, $n);
}

function kal_out(array $data): never
{
    // Et feed i Latin-1 må ikke give et tomt svar: ugyldig UTF-8 erstattes.
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function kal_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') kal_fail(400, 'tom krop');
    if (strlen($raw) > 100_000)       kal_fail(413, 'kroppen er for stor');
    $b = json_decode($raw, true);
    if (!is_array($b))                 kal_fail(400, 'kroppen skal være JSON');
    return $b;
}

function kal_load(): array
{
    try { return feeds_load(); }
    catch (Throwable $e) { kal_fail(500, $e->getMessage()); }
}

/** Én linje fra ICS-filen, uanset parametre: X-WR-CALNAME;VALUE=TEXT:Navn */
function kal_ics_prop(string $text, string $name): string
{
    foreach (ics_unfold($text) as $line) {
        if (preg_match('/^' . preg_quote($name, '/') . '(;[^:]*)?:(.*)$/i', $line, $m)) {
            return trim(preg_replace('/\s+/u', ' ', ics_unescape($m[2])) ?? '');
        }
        if ($line === 'BEGIN:VEVENT') break;   // kalenderens egne felter står før første begivenhed
    }
    return '';
}

// ─── GET: listen ───────────────────────────────────────────────────
if ($method === 'GET') {
    kal_out(feeds_public(kal_load()));
}

if ($method !== 'POST') kal_fail(405, 'kun GET og POST');

// ─── Test et link ──────────────────────────────────────────────────
if ($action === 'test') {
    $b = kal_body();
    try {
        if (!empty($b['url'])) {
            $url = feeds_normalize_url((string)$b['url']);
        } else {
            $url = null;
            foreach (kal_load()['feeds'] as $f) if ($f['id'] === (string)($b['id'] ?? '')) $url = $f['url'];
            if ($url === null) kal_fail(404, 'kalenderen findes ikke længere');
        }
    } catch (InvalidArgumentException $e) {
        kal_out(['ok' => false, 'error' => $e->getMessage()]);
    }

    try {
        $text = feeds_fetch($url, 20);
    } catch (Throwable $e) {
        $msg = $e->getMessage();
        $hint = match (true) {
            str_contains($msg, 'HTTP 401'), str_contains($msg, 'HTTP 403') => ' Linket er måske udløbet eller lavet om — hent et nyt.',
            str_contains($msg, 'HTTP 404')                                  => ' Linket findes ikke (længere). Hent et nyt i tjenesten.',
            default                                                         => '',
        };
        kal_out(['ok' => false, 'error' => "Kunne ikke hente kalenderen: $msg.$hint"]);
    }

    if (!str_contains(substr($text, 0, 2000), 'BEGIN:VCALENDAR')) {
        $looksHtml = stripos(substr($text, 0, 500), '<html') !== false || stripos(substr($text, 0, 500), '<!doctype') !== false;
        kal_out(['ok' => false, 'error' => $looksHtml
            ? 'Linket gav en webside, ikke en kalender. Brug abonnements- eller iCal-linket, ikke adressen på siden.'
            : 'Linket gav ikke en kalender (ingen BEGIN:VCALENDAR).']);
    }

    $now   = new DateTimeImmutable('now');
    $from  = new DateTimeImmutable('today 00:00:00');
    $until = (new DateTimeImmutable('monday this week 00:00:00'))->modify('+' . ICS_WEEKS_AHEAD . ' weeks');
    $events = ics_events($text, $from, $until);
    usort($events, fn($a, $b) => $a['start'] <=> $b['start']);

    $next = [];
    foreach ($events as $e) {
        if (!$e['allDay'] && $e['start'] < $now && ($e['end'] ?? $e['start']) < $now) continue;
        $next[] = [
            'date'    => $e['start']->format('Y-m-d'),
            'time'    => $e['allDay'] ? '' : $e['start']->format('H:i'),
            'summary' => kal_cut($e['summary'], 0, 120),
        ];
        if (count($next) === 3) break;
    }

    kal_out([
        'ok'      => true,
        'name'    => kal_cut(kal_ics_prop($text, 'X-WR-CALNAME'), 0, 80),
        'service' => feeds_service($url),
        'total'   => count($events),
        'weeks'   => ICS_WEEKS_AHEAD,
        'next'    => $next,
    ]);
}

// ─── Gem listen ────────────────────────────────────────────────────
if ($action === 'save') {
    $b = kal_body();

    // Lås rundt om læs–tjek–skriv, så to gem i samme øjeblik ikke begge
    // består rev-tjekket. Låsen slippes, når scriptet slutter.
    if (!is_dir(dirname(FEEDS_LOCK_FILE))) @mkdir(dirname(FEEDS_LOCK_FILE), 0770, true);
    $lock = @fopen(FEEDS_LOCK_FILE, 'c');
    if (!$lock || !flock($lock, LOCK_EX)) kal_fail(500, 'kan ikke låse kalenderlisten');

    $cur = kal_load();

    // To telefoner med dialogen åben: den sidste må ikke stille overskrive
    // den første. Klienten sender den rev, den selv har set (null = listen
    // kommer stadig fra config.php).
    if (($b['base'] ?? null) !== $cur['rev']) {
        kal_fail(409, 'Listen er ændret et andet sted imens. Luk og åbn dialogen igen.');
    }
    if (!isset($b['feeds']) || !is_array($b['feeds'])) kal_fail(400, 'feeds mangler');
    if (count($b['feeds']) > FEEDS_MAX)               kal_fail(400, 'højst ' . FEEDS_MAX . ' kalendere');

    $known = [];
    foreach ($cur['feeds'] as $f) $known[$f['id']] = $f;

    $out = []; $seen = [];
    foreach (array_values($b['feeds']) as $n => $in) {
        if (!is_array($in)) kal_fail(400, 'ugyldigt element');
        $nr = $n + 1;

        // Nyt link, eller et kendt id der beholder sit gamle link
        if (!empty($in['url'])) {
            try { $url = feeds_normalize_url((string)$in['url']); }
            catch (InvalidArgumentException $e) { kal_fail(400, "Kalender $nr: " . $e->getMessage()); }
        } elseif (isset($in['id'], $known[(string)$in['id']])) {
            $url = $known[(string)$in['id']]['url'];
        } else {
            kal_fail(400, "Kalender $nr: mangler et link");
        }

        $id = feeds_id($url);
        if (isset($seen[$id])) kal_fail(400, "Kalender $nr: det link er der allerede");
        $seen[$id] = true;

        $person = strtolower(trim((string)($in['person'] ?? '')));
        if (!preg_match('/^[a-z0-9æøå_-]{1,20}$/u', $person)) kal_fail(400, "Kalender $nr: vælg hvem den hører til");

        $icon = trim((string)($in['icon'] ?? ''));
        if (strlen($icon) > 32 || preg_match('/[<>&"\'\\\\]|[\x00-\x1F]/', $icon)) kal_fail(400, "Kalender $nr: ugyldigt ikon");

        $label = trim(preg_replace('/\s+/u', ' ', (string)($in['label'] ?? '')) ?? '');
        $label = kal_cut(strip_tags($label), 0, 60);

        $out[] = [
            'url'     => $url,
            'person'  => $person,
            'icon'    => $icon,
            // tag kan ikke sættes fra dialogen, men et gammelt fra config.php følger med
            'tag'     => $known[$id]['tag'] ?? '',
            'label'   => $label,
            'enabled' => !array_key_exists('enabled', $in) || (bool)$in['enabled'],
        ];
    }

    try { feeds_save($out); }
    catch (Throwable $e) { error_log('ugeplan kalendere: ' . $e->getMessage()); kal_fail(500, $e->getMessage()); }

    kal_out(feeds_public(kal_load()));
}

// ─── Hent nu ───────────────────────────────────────────────────────
if ($action === 'sync') {
    @set_time_limit(120);
    ob_start();
    try {
        $summary = job_ics();
        hlog("ics (fra Kalendere-dialogen): $summary");
    } catch (Throwable $e) {
        ob_end_clean();
        kal_fail(500, 'Hentningen fejlede: ' . $e->getMessage());
    }
    ob_end_clean();
    kal_out(['summary' => $summary] + feeds_public(kal_load()));
}

kal_fail(400, 'ukendt action');
