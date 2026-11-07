<?php
/**
 * tegneserie.php — "Gårsdagens tegneserie" i overblik.html og valget i index.html.
 *
 *   GET  tegneserie.php                  -> gårsdagens strip: {enabled, slug, dato, titel, imageUrl, pageUrl, fallback?, stale?}
 *   GET  tegneserie.php?action=settings  -> {slug, enabled}
 *   POST tegneserie.php?action=save      {"slug":"calvinandhobbes","enabled":true}
 *   GET  tegneserie.php?action=historik[&slug=…]  -> alle de seneste 90 dage: {dato, gemt, titel?, imageUrl?, pageUrl?}
 *   GET  tegneserie.php?action=dag&dato=ÅÅÅÅ-MM-DD[&slug=…]  -> stripen for én dag (hentes fra datosiden, hvis den ikke er hentet)
 *   GET  tegneserie.php?action=liste[&opdater=1]  -> alle tegneserier fra GoComics' A–Z-side: {tegneserier:[{slug, navn}], stale, hentet}
 *   POST tegneserie.php?action=ryd       {"slug":"…"}  -> slet historikken for en tegneserie
 *
 * Den fælles kode (hentning, cache, historik) ligger i ugeplan-lib/tegneserie.php, så
 * hent.php kan hente striben hver time uden en browser.
 *
 * ── Hvordan ────────────────────────────────────────────────────────────
 * GoComics har ingen åben API. Serveren henter datosiden for gårsdagen
 * (https://www.gocomics.com/<navn>/ÅÅÅÅ/MM/DD), som en almindelig besøgende ville, og
 * læser adressen på billedet ud af siden (meta-tagget og:image). Samme adresse bruges til tidligere dage. Billedet
 * hentes ikke og gemmes ikke her: browseren indlæser det direkte fra GoComics'
 * egen server, og kortet linker til striben på GoComics. Stripen for en dato
 * ændrer sig ikke, så den hentes højst en gang pr. dato.
 *
 * ── Vilkår ─────────────────────────────────────────────────────────────
 * Striberne er beskyttet af ophavsret. Kortet er til privat visning hjemme.
 * GoComics lever af annoncer på deres sider, og et kort som dette viser striben
 * uden dem. Jeg har ikke læst GoComics' vilkår. Serveren giver sig ud for det
 * den er (User-Agent "familieoverblik/1.0"), og sender den GoComics en afvisning
 * (fx 403), omgås den ikke: kortet siger, at striben ikke kan hentes.
 *
 * ── Skrøbeligt ─────────────────────────────────────────────────────────
 * Siden læses som tekst. Ændrer GoComics siden, holder kortet op med at virke,
 * og fejlen står i indstillingerne ("Fandt ingen strip på siden").
 *
 * ── Adgang ─────────────────────────────────────────────────────────────
 * Som indkob.php: en af nøglerne i X-Ugeplan-Key OG PIN-cookien.
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

function tg_out(array $data, int $code = 200): never
{
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function tg_fail(int $code, string $msg): never
{
    tg_out(['error' => $msg], $code);
}

if ($lib === null || !is_file("$lib/gate.php")) tg_fail(500, 'ugeplan-lib/feeds.php eller gate.php mangler');
require_once "$lib/feeds.php";   // DATA_DIR og feeds_write_json()
require_once "$lib/gate.php";
if (!is_file("$lib/tegneserie.php")) tg_fail(500, 'ugeplan-lib/tegneserie.php mangler');
require_once "$lib/tegneserie.php";

$key = (string)($_SERVER['HTTP_X_UGEPLAN_KEY'] ?? '');
$ok  = ($key !== '' && WRITE_TOKEN !== 'UDFYLD' && hash_equals(WRITE_TOKEN, $key))
    || ($key !== '' && READ_TOKEN  !== 'UDFYLD' && hash_equals(READ_TOKEN,  $key));
if (!$ok)       tg_fail(401, 'ukendt eller manglende nøgle');
if (!gate_ok()) tg_fail(403, 'log ind med familiens kode først');

date_default_timezone_set(TIMEZONE);

// ─── Forespørgsler ─────────────────────────────────────────────────
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = (string)($_GET['action'] ?? '');

try {
    if ($method === 'GET') {
        $s = tg_settings();
        if ($action === 'settings') tg_out($s);
        if ($action === 'historik') {
            $slug = strtolower(trim((string)($_GET['slug'] ?? '')));
            if ($slug === '') $slug = $s['slug'];
            if (preg_match(TG_SLUG_RE, $slug) !== 1) tg_fail(400, 'ugyldigt navn');
            tg_out(['slug' => $slug, 'dageGemt' => TG_HISTORIK_DAGE, 'dage' => tg_dage_liste($slug), 'tegneserier' => tg_hist_serier()]);
        }
        if ($action === 'liste') {                                 // alle tegneserier, fra GoComics' A–Z-side (cachet i 7 døgn)
            try { $r = tg_az_cached(($_GET['opdater'] ?? '') === '1'); }
            catch (Throwable $e) { tg_fail(502, $e->getMessage()); }
            tg_out(['tegneserier' => $r['data'], 'stale' => $r['stale'], 'hentet' => date('c', $r['at'])]);
        }
        if ($action === 'dag') {                                   // én bestemt dag, hentet fra datosiden hos GoComics
            $slug = strtolower(trim((string)($_GET['slug'] ?? '')));
            if ($slug === '') $slug = $s['slug'];
            if (preg_match(TG_SLUG_RE, $slug) !== 1) tg_fail(400, 'ugyldigt navn');
            $dato = (string)($_GET['dato'] ?? '');
            if (!tg_dato_gyldig($dato)) tg_fail(400, 'Datoen skal være en af de seneste 90 dage, og højst i går.');
            try { tg_out(['slug' => $slug, 'dag' => tg_dag($slug, $dato)]); }
            catch (Throwable $e) { tg_fail(422, $e->getMessage()); }
        }
        if ($action !== '') tg_fail(400, 'ukendt handling');
        if (!$s['enabled']) tg_out(['enabled' => false, 'slug' => $s['slug']]);
        $r = tg_cached($s['slug']);
        tg_out(['enabled' => true, 'stale' => $r['stale'], 'hentet' => date('c', $r['at'])] + $r['data']);
    }
    if ($method !== 'POST') tg_fail(405, 'kun GET og POST');
    if ($action === 'ryd') {
        $raw = file_get_contents('php://input');
        $b = ($raw !== false && $raw !== '' && strlen($raw) < 2000) ? json_decode($raw, true) : null;
        $slug = is_array($b) ? strtolower(trim((string)($b['slug'] ?? ''))) : '';
        if (preg_match(TG_SLUG_RE, $slug) !== 1) tg_fail(400, 'ugyldigt navn');
        @unlink(tg_hist_fil($slug));
        tg_out(['ok' => true, 'slug' => $slug]);
    }
    if ($action !== 'save') tg_fail(400, 'ukendt handling');

    $raw = file_get_contents('php://input');
    $b = ($raw !== false && $raw !== '' && strlen($raw) < 2000) ? json_decode($raw, true) : null;
    if (!is_array($b)) tg_fail(400, 'kroppen skal være JSON');

    $slug = strtolower(trim((string)($b['slug'] ?? '')));
    // Hvis nogen har indsat hele adressen, tages navnet ud af den.
    if (preg_match('~gocomics\.com/([a-z0-9-]+)~', $slug, $m)) $slug = $m[1];
    if (preg_match(TG_SLUG_RE, $slug) !== 1) tg_fail(400, 'Navnet må kun være små bogstaver, tal og bindestreger, fx calvinandhobbes.');
    $enabled = !array_key_exists('enabled', $b) || (bool)$b['enabled'];

    $strip = null;
    if ($enabled) {
        try { $strip = tg_cached($slug, true); }          // prøv først: gem kun, hvis striben kan hentes
        catch (Throwable $e) { tg_fail(422, $e->getMessage()); }
    }
    try { feeds_write_json(TG_FILE, ['slug' => $slug, 'enabled' => $enabled, 'updatedAt' => date('c')]); }
    catch (Throwable $e) { tg_fail(500, $e->getMessage()); }

    tg_out(['slug' => $slug, 'enabled' => $enabled] + ($strip ? ['strip' => ['stale' => false] + $strip['data']] : []));

} catch (Throwable $e) {
    tg_fail(502, $e->getMessage());
}
