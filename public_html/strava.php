<?php
/**
 * strava.php — Strava-kortet i overblik.html og Strava-dialogen i index.html.
 *
 *   GET  strava.php                       -> status: er appen sat op, hvem er forbundet, antal, hvem vises
 *   GET  strava.php?action=aktiviteter    -> de seneste aktiviteter pr. valgt person
 *   POST strava.php?action=app            {"clientId":"…","clientSecret":"…"}
 *   POST strava.php?action=login          {"person":"voksen1"}          -> {authUrl}
 *   POST strava.php?action=connect        {"redirect":"http://localhost/?state=…&code=…&scope=…"}
 *   POST strava.php?action=disconnect     {"person":"voksen1"}
 *   POST strava.php?action=settings       {"antal":3,"personer":["voksen1","barn1"]}
 *
 * ── Login ──────────────────────────────────────────────────────────────
 * Hver person forbinder sin egen Strava-konto: autorisationskode mod
 * https://www.strava.com/oauth/authorize med omdirigering til http://localhost.
 * Siden efter godkendelse kan ikke åbnes (der er ingen server på localhost), og
 * så kopierer man adressen fra adresselinjen og sætter den ind i dialogen.
 * Appens "Authorization Callback Domain" skal være "localhost".
 * Der bedes kun om scope activity:read — aktiviteter, der er sat til "Kun mig",
 * hentes ikke, og kortet viser dem aldrig.
 *
 * ── Stravas vilkår ─────────────────────────────────────────────────────
 * Stravas API-aftale tillader kun, at en persons aktiviteter vises for personen
 * selv. Et fælles familieskærmkort gør det modsatte. Det er et bevidst valg for
 * privat brug, og Strava kan lukke appens adgang. Strava-data må heller ikke
 * bruges i AI-modeller: de sendes derfor ikke til nogen model, og denne fil
 * har intet at gøre med Aula-synkroniseringen. Kortet viser "Powered by Strava"
 * og et "Se på Strava"-link ved hver aktivitet.
 *
 * ── Hvad der ligger hvor ───────────────────────────────────────────────
 * DATA_DIR/private/strava.json: app-nøgler, loginnøgler pr. person og indstillinger.
 * Intet derfra sendes til browseren (heller ikke client secret).
 * DATA_DIR/cache/strava-<person>.json: de seneste aktiviteter i 10 minutter.
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

function st_out(array $data, int $code = 200): never
{
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function st_fail(int $code, string $msg, string $kind = ''): never
{
    st_out($kind === '' ? ['error' => $msg] : ['error' => $msg, 'kind' => $kind], $code);
}

if ($lib === null || !is_file("$lib/gate.php")) st_fail(500, 'ugeplan-lib/feeds.php eller gate.php mangler');
require_once "$lib/feeds.php";   // DATA_DIR og feeds_write_json()
require_once "$lib/gate.php";

$key = (string)($_SERVER['HTTP_X_UGEPLAN_KEY'] ?? '');
$ok  = ($key !== '' && WRITE_TOKEN !== 'UDFYLD' && hash_equals(WRITE_TOKEN, $key))
    || ($key !== '' && READ_TOKEN  !== 'UDFYLD' && hash_equals(READ_TOKEN,  $key));
if (!$ok)       st_fail(401, 'ukendt eller manglende nøgle');
if (!gate_ok()) st_fail(403, 'log ind med familiens kode først');

date_default_timezone_set(TIMEZONE);

const ST_FILE      = DATA_DIR . '/private/strava.json';
const ST_LOCK      = DATA_DIR . '/private/strava.lock';
const ST_REDIRECT  = 'http://localhost';
const ST_SCOPE     = 'activity:read';
const ST_PENDING_SEKUNDER = 900;     // et login skal gennemføres inden 15 minutter
const ST_CACHE_TTL = 600;
const ST_PERSON_RE = '/^[a-z0-9_-]{1,30}\z/';

/** Fejl ved login/forbindelse, så dialogen kan sende brugeren tilbage til "Forbind". */
final class StAuthError extends RuntimeException
{
    public function __construct(public readonly string $kind, string $message)
    {
        parent::__construct($message);
    }
}

// ─── Lagring ───────────────────────────────────────────────────────
function st_load(): array
{
    if (!is_file(ST_FILE)) return [];
    $raw = @file_get_contents(ST_FILE);
    $d = ($raw === false || $raw === '') ? null : json_decode($raw, true);
    return is_array($d) ? $d : [];
}

/** Læs, ret og gem under lås. $fn får filens indhold og skal returnere det nye. */
function st_mutate(callable $fn): array
{
    @mkdir(dirname(ST_LOCK), 0770, true);
    $fh = @fopen(ST_LOCK, 'c');
    if ($fh) flock($fh, LOCK_EX);
    try {
        $d = $fn(st_load());
        feeds_write_json(ST_FILE, $d);
        return $d;
    } finally {
        if ($fh) { flock($fh, LOCK_UN); fclose($fh); }
    }
}

function st_cut(string $s, int $n): string
{
    return preg_match('/^.{0,' . $n . '}/us', $s, $m) ? $m[0] : substr($s, 0, $n);
}

// ─── HTTP (kun mod Strava) ─────────────────────────────────────────
/** @return array{int, ?array, string}  [statuskode, JSON, rå krop] */
function st_http(string $method, string $url, array $headers = [], ?string $body = null): array
{
    if (!str_starts_with($url, 'https://www.strava.com/')) throw new RuntimeException('uventet adresse');
    $headers[] = 'User-Agent: familieoverblik/1.0 (hjemmeserver)';

    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST => $method, CURLOPT_RETURNTRANSFER => true, CURLOPT_HTTPHEADER => $headers,
            CURLOPT_TIMEOUT => 20, CURLOPT_CONNECTTIMEOUT => 10, CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_MAXFILESIZE => 2_000_000,
        ]);
        if ($body !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
        $raw  = curl_exec($ch);
        $err  = curl_error($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);
        if ($raw === false) throw new StAuthError('net', 'Kunne ikke nå Strava: ' . ($err ?: 'ukendt fejl'));
    } else {
        $ctx = stream_context_create(['http' => [
            'method' => $method, 'header' => implode("\r\n", $headers), 'content' => $body ?? '',
            'timeout' => 20, 'ignore_errors' => true, 'follow_location' => 0,
        ]]);
        $raw = @file_get_contents($url, false, $ctx);
        if ($raw === false) throw new StAuthError('net', 'Kunne ikke nå Strava.');
        $code = 0;
        foreach ($http_response_header ?? [] as $h) {
            if (preg_match('#^HTTP/\S+\s+(\d{3})#', $h, $m)) $code = (int)$m[1];
        }
    }
    $j = json_decode((string)$raw, true);
    return [$code, is_array($j) ? $j : null, (string)$raw];
}

function st_hint(string $s): string
{
    $s = strtolower($s);
    return match (true) {
        str_contains($s, 'redirect_uri'), str_contains($s, 'redirect uri')
            => ' Sæt «Authorization Callback Domain» til localhost i Strava-appens indstillinger.',
        str_contains($s, 'client_id'), str_contains($s, 'client_secret'), str_contains($s, 'application')
            => ' Tjek at Client ID og Client Secret er kopieret rigtigt.',
        str_contains($s, 'limit'), str_contains($s, 'athlete')
            => ' Appen er måske stadig i «Single Player Mode». Opgradér til 10 athletes under strava.com/settings/api.',
        str_contains($s, 'code')
            => ' Koden er brugt eller udløbet. Tryk «Åbn Strava» igen og brug den nye adresse.',
        default => '',
    };
}

function st_token_request(array $form): array
{
    [$code, $j] = st_http('POST', 'https://www.strava.com/oauth/token',
        ['Content-Type: application/x-www-form-urlencoded', 'Accept: application/json'], http_build_query($form));
    if ($code !== 200 || !is_array($j) || empty($j['access_token'])) {
        $msg = is_array($j) ? (string)($j['message'] ?? '') : '';
        $felt = '';
        if (is_array($j) && isset($j['errors'][0]) && is_array($j['errors'][0])) {
            $e = $j['errors'][0];
            $felt = trim((string)($e['resource'] ?? '') . ' ' . (string)($e['field'] ?? '') . ' ' . (string)($e['code'] ?? ''));
        }
        $kind = in_array($code, [400, 401], true) && ($form['grant_type'] ?? '') === 'refresh_token' ? 'reconnect' : 'auth';
        $tekst = trim($msg . ' ' . $felt);
        throw new StAuthError($kind, 'Strava afviste login' . ($tekst !== '' ? ': ' . st_cut($tekst, 200) : ' (HTTP ' . $code . ')') . '.' . st_hint($tekst));
    }
    return $j;
}

/** Et gyldigt adgangstoken til personen. Fornyes med refresh-token under lås. */
function st_access(string $person): string
{
    $d = st_load();
    $t = $d['tokens'][$person] ?? null;
    if (!is_array($t) || empty($t['refresh_token']) || empty($d['client_id']) || empty($d['client_secret'])) {
        throw new StAuthError('not_connected', 'Personen er ikke forbundet til Strava.');
    }
    if (!empty($t['access_token']) && (int)($t['expires_at'] ?? 0) > time() + 120) return (string)$t['access_token'];

    $tok = ''; $fejl = null;
    st_mutate(function (array $d) use ($person, &$tok, &$fejl): array {
        $t = $d['tokens'][$person] ?? null;
        if (!is_array($t) || empty($t['refresh_token'])) { $fejl = new StAuthError('not_connected', 'Personen er ikke forbundet til Strava.'); return $d; }
        if (!empty($t['access_token']) && (int)($t['expires_at'] ?? 0) > time() + 120) { $tok = (string)$t['access_token']; return $d; }   // en anden nåede det først
        try {
            $n = st_token_request([
                'client_id' => (string)$d['client_id'], 'client_secret' => (string)$d['client_secret'],
                'grant_type' => 'refresh_token', 'refresh_token' => (string)$t['refresh_token'],
            ]);
        } catch (StAuthError $e) {
            if ($e->kind === 'reconnect') { unset($d['tokens'][$person]); $fejl = new StAuthError('reconnect', 'Forbindelsen til Strava er udløbet. Forbind igen.'); }
            else $fejl = $e;
            return $d;
        }
        $d['tokens'][$person]['access_token']  = (string)$n['access_token'];
        $d['tokens'][$person]['expires_at']    = (int)($n['expires_at'] ?? (time() + (int)($n['expires_in'] ?? 21600)));
        if (!empty($n['refresh_token'])) $d['tokens'][$person]['refresh_token'] = (string)$n['refresh_token'];   // Strava kan rotere den
        $tok = (string)$n['access_token'];
        return $d;
    });
    if ($fejl) throw $fejl;
    return $tok;
}

// ─── Status ────────────────────────────────────────────────────────
function st_status(): array
{
    $d = st_load();
    $forb = [];
    foreach (($d['tokens'] ?? []) as $p => $t) {
        if (is_array($t) && !empty($t['refresh_token']) && preg_match(ST_PERSON_RE, (string)$p) === 1) {
            $forb[(string)$p] = ['navn' => (string)($t['athlete'] ?? '')];
        }
    }
    // Har du aldrig valgt, hvem der vises, vises alle forbundne.
    $personer = array_key_exists('personer', $d) && is_array($d['personer'])
        ? array_values(array_filter(array_map('strval', $d['personer']), fn($x) => preg_match(ST_PERSON_RE, $x) === 1))
        : array_keys($forb);
    return [
        'configured' => !empty($d['client_id']) && !empty($d['client_secret']),
        'clientId'   => (string)($d['client_id'] ?? ''),
        'antal'      => max(1, min(10, (int)($d['antal'] ?? 3))),
        'personer'   => $personer,
        'forbundet'  => (object)$forb,
    ];
}

// ─── Aktiviteter ───────────────────────────────────────────────────
/** @return array{items:list<array>, stale:bool} */
function st_aktiviteter(string $person): array
{
    $fil = DATA_DIR . '/cache/strava-' . $person . '.json';
    $cache = null;
    if (is_file($fil)) {
        $c = json_decode((string)@file_get_contents($fil), true);
        if (is_array($c) && isset($c['fetchedAt'], $c['items']) && is_array($c['items'])) $cache = $c;
    }
    if ($cache && (time() - (int)$cache['fetchedAt']) <= ST_CACHE_TTL) return ['items' => $cache['items'], 'stale' => false];

    try {
        $tok = st_access($person);
        [$code, $j] = st_http('GET', 'https://www.strava.com/api/v3/athlete/activities?per_page=30',
            ['Authorization: Bearer ' . $tok, 'Accept: application/json']);
        if ($code === 401) throw new StAuthError('reconnect', 'Strava afviste adgangen. Forbind igen.');
        if ($code === 429) throw new RuntimeException('Strava: for mange kald lige nu. Prøver igen senere.');
        if ($code >= 400 || !is_array($j) || isset($j['message'])) {
            throw new RuntimeException('Strava svarede ' . $code . (is_array($j) && isset($j['message']) ? ': ' . st_cut((string)$j['message'], 120) : ''));
        }
        $items = [];
        foreach ($j as $a) {
            if (!is_array($a) || !isset($a['id']) || !preg_match('/^\d{1,20}$/', (string)$a['id'])) continue;
            if (($a['private'] ?? false) === true || ($a['visibility'] ?? '') === 'only_me') continue;   // dobbelt sikkerhed ovenpå scope
            $items[] = [
                'id'      => (string)$a['id'],
                'navn'    => st_cut((string)($a['name'] ?? ''), 120),
                'sport'   => st_cut((string)($a['sport_type'] ?? $a['type'] ?? ''), 40),
                'afstand' => round((float)($a['distance'] ?? 0), 1),
                'tid'     => (int)($a['moving_time'] ?? 0),
                'hoejde'  => round((float)($a['total_elevation_gain'] ?? 0), 1),
                'start'   => substr((string)($a['start_date_local'] ?? ''), 0, 19),
                'url'     => 'https://www.strava.com/activities/' . $a['id'],
            ];
        }
        feeds_write_json($fil, ['fetchedAt' => time(), 'items' => $items]);
        return ['items' => $items, 'stale' => false];
    } catch (StAuthError $e) {
        if ($e->kind === 'net' && $cache) return ['items' => $cache['items'], 'stale' => true];   // Strava kan ikke nås: brug det gemte
        throw $e;                                                                                  // login-fejl skal vises
    } catch (Throwable $e) {
        if ($cache) return ['items' => $cache['items'], 'stale' => true];
        throw $e;
    }
}

// ─── Hjælp til POST ────────────────────────────────────────────────
function st_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') st_fail(400, 'tom krop');
    if (strlen($raw) > 20_000)         st_fail(413, 'kroppen er for stor');
    $b = json_decode($raw, true);
    if (!is_array($b)) st_fail(400, 'kroppen skal være JSON');
    return $b;
}

function st_person(mixed $v): string
{
    $s = (string)$v;
    if (preg_match(ST_PERSON_RE, $s) !== 1 || $s === 'alle') st_fail(400, 'ugyldig person');
    return $s;
}

// ─── Forespørgsler ─────────────────────────────────────────────────
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = (string)($_GET['action'] ?? '');

try {
    if ($method === 'GET') {
        if ($action === '') st_out(st_status());
        if ($action === 'aktiviteter') {
            $s = st_status();
            if (!$s['configured']) st_fail(409, 'Strava er ikke sat op endnu.', 'not_configured');
            $d = st_load();
            $ud = []; $fejl = [];
            foreach ($s['personer'] as $p) {
                if (!isset($d['tokens'][$p]['refresh_token'])) continue;
                try {
                    $r = st_aktiviteter($p);
                    $ud[] = [
                        'id' => $p, 'athlete' => (string)($d['tokens'][$p]['athlete'] ?? ''),
                        'items' => array_slice($r['items'], 0, $s['antal']), 'stale' => $r['stale'],
                    ];
                } catch (Throwable $e) {
                    $fejl[$p] = $e->getMessage();
                }
            }
            st_out(['antal' => $s['antal'], 'personer' => $ud, 'fejl' => (object)$fejl, 'hentet' => date('c')]);
        }
        st_fail(400, 'ukendt handling');
    }
    if ($method !== 'POST') st_fail(405, 'kun GET og POST');

    switch ($action) {
        case 'app': {
            $b = st_body();
            $cid = trim((string)($b['clientId'] ?? ''));
            $sec = strtolower(trim((string)($b['clientSecret'] ?? '')));
            if (!preg_match('/^\d{3,12}$/', $cid)) st_fail(400, 'Client ID er et tal, fx 123456.');
            if (!preg_match('/^[0-9a-f]{20,64}$/', $sec)) st_fail(400, 'Client Secret er en lang række bogstaver og tal. Kopiér den fra strava.com/settings/api.');
            st_mutate(function (array $d) use ($cid, $sec): array {
                if (($d['client_id'] ?? '') !== $cid) { unset($d['tokens'], $d['pending']); }   // ny app: de gamle loginnøgler hører til en anden
                $d['client_id'] = $cid;
                $d['client_secret'] = $sec;
                return $d;
            });
            st_out(st_status());
        }

        case 'login': {
            $person = st_person(st_body()['person'] ?? '');
            $d = st_load();
            if (empty($d['client_id']) || empty($d['client_secret'])) st_fail(409, 'Sæt først Client ID og Client Secret ind.', 'not_configured');
            $state = bin2hex(random_bytes(16));
            st_mutate(function (array $d) use ($person, $state): array {
                $pending = [];
                foreach (($d['pending'] ?? []) as $s => $p) {
                    if (is_array($p) && (time() - (int)($p['at'] ?? 0)) < ST_PENDING_SEKUNDER) $pending[$s] = $p;
                }
                $pending[$state] = ['person' => $person, 'at' => time()];
                $d['pending'] = $pending;
                return $d;
            });
            $authUrl = 'https://www.strava.com/oauth/authorize?' . http_build_query([
                'client_id' => (string)$d['client_id'], 'response_type' => 'code', 'redirect_uri' => ST_REDIRECT,
                'approval_prompt' => 'force', 'scope' => ST_SCOPE, 'state' => $state,
            ], '', '&', PHP_QUERY_RFC3986);
            st_out(['authUrl' => $authUrl]);
        }

        case 'connect': {
            $pasted = trim((string)(st_body()['redirect'] ?? ''));
            if ($pasted === '') st_fail(400, 'Sæt adressen fra browseren ind.');
            $q = (string)(parse_url($pasted, PHP_URL_QUERY) ?? '');
            if ($q === '' && !str_contains($pasted, '://')) $q = ltrim($pasted, '?');
            parse_str($q, $r);
            if (!empty($r['error'])) st_fail(400, 'Strava afviste: ' . st_cut((string)$r['error'], 100) . '. Start forfra, og tryk «Authorize».');
            $code = (string)($r['code'] ?? '');
            $state = (string)($r['state'] ?? '');
            if ($code === '') st_fail(400, 'Adressen indeholder ingen kode. Kopiér hele adressen fra adresselinjen, efter siden ikke kunne åbnes.');
            $scopes = array_map('trim', explode(',', (string)($r['scope'] ?? '')));
            if (!in_array('activity:read', $scopes, true) && !in_array('activity:read_all', $scopes, true)) {
                st_fail(400, 'Du skal sætte hak ved at give adgang til dine aktiviteter. Start forfra.');
            }
            $d = st_load();
            $p = $d['pending'][$state] ?? null;
            if ($state === '' || !is_array($p) || (time() - (int)($p['at'] ?? 0)) > ST_PENDING_SEKUNDER) {
                st_fail(409, 'Login-forsøget er udløbet eller hører til et andet forsøg. Tryk «Forbind» igen.', 'restart');
            }
            $person = (string)$p['person'];
            if (empty($d['client_id']) || empty($d['client_secret'])) st_fail(409, 'Sæt først Client ID og Client Secret ind.', 'not_configured');

            $t = st_token_request([
                'client_id' => (string)$d['client_id'], 'client_secret' => (string)$d['client_secret'],
                'code' => $code, 'grant_type' => 'authorization_code',
            ]);
            if (empty($t['refresh_token'])) throw new StAuthError('auth', 'Strava sendte ingen loginnøgle tilbage.');
            $navn = st_cut(trim((string)($t['athlete']['firstname'] ?? '')), 40);

            st_mutate(function (array $d) use ($person, $state, $t, $navn): array {
                unset($d['pending'][$state]);
                $d['tokens'][$person] = [
                    'access_token'  => (string)$t['access_token'],
                    'refresh_token' => (string)$t['refresh_token'],
                    'expires_at'    => (int)($t['expires_at'] ?? (time() + (int)($t['expires_in'] ?? 21600))),
                    'athlete'       => $navn,
                ];
                if (isset($d['personer']) && is_array($d['personer']) && !in_array($person, $d['personer'], true)) $d['personer'][] = $person;
                return $d;
            });
            @unlink(DATA_DIR . '/cache/strava-' . $person . '.json');
            st_out(st_status());
        }

        case 'disconnect': {
            $person = st_person(st_body()['person'] ?? '');
            st_mutate(function (array $d) use ($person): array {
                unset($d['tokens'][$person]);
                return $d;
            });
            @unlink(DATA_DIR . '/cache/strava-' . $person . '.json');
            st_out(st_status());
        }

        case 'settings': {
            $b = st_body();
            $antal = $b['antal'] ?? null;
            if (!is_numeric($antal) || (int)$antal < 1 || (int)$antal > 10) st_fail(400, 'Antal skal være mellem 1 og 10.');
            $liste = $b['personer'] ?? null;
            if (!is_array($liste) || count($liste) > 10) st_fail(400, 'personer skal være en liste.');
            $personer = [];
            foreach ($liste as $p) $personer[] = st_person($p);
            st_mutate(function (array $d) use ($antal, $personer): array {
                $d['antal'] = (int)$antal;
                $d['personer'] = array_values(array_unique($personer));
                return $d;
            });
            st_out(st_status());
        }
    }
    st_fail(400, 'ukendt handling');

} catch (StAuthError $e) {
    $status = in_array($e->kind, ['not_connected', 'reconnect'], true) ? 409 : 502;
    st_fail($status, $e->getMessage(), $e->kind);
} catch (Throwable $e) {
    st_fail(502, $e->getMessage());
}
