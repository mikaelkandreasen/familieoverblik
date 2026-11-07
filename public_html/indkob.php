<?php
/**
 * indkob.php — Indkøbsseddelen i index.html (og visningen i overblik.html).
 * Taler med Microsoft To Do gennem Microsoft Graph.
 *
 *   GET  indkob.php                     -> status (forbundet? hvilken liste?)
 *   GET  indkob.php?action=lists        -> To Do-lister på kontoen
 *   GET  indkob.php?action=items        -> varerne, der mangler (ikke afkrydset)
 *   POST indkob.php?action=config       {"client_id":…}  -> {authUrl}
 *   POST indkob.php?action=connect      {"redirect":"http://localhost/?code=…&state=…"}
 *   POST indkob.php?action=setlist      {"id":…}
 *   POST indkob.php?action=add          {"title":…}
 *   POST indkob.php?action=done         {"id":…}
 *   POST indkob.php?action=reopen       {"id":…}
 *   POST indkob.php?action=disconnect
 *
 * ── Login ──────────────────────────────────────────────────────────────
 * Autorisationskode med PKCE og omdirigering til http://localhost. NUC'en
 * behøver ikke kunne nås udefra: du åbner Microsofts login i en browser, og
 * når den til sidst sender dig til http://localhost (som ikke findes), kopierer
 * du adressen fra adresselinjen og sætter den ind i dialogen.
 *
 * ── Hvad der ligger hvor ───────────────────────────────────────────────
 * DATA_DIR/private/ms-todo.json har refresh-token, adgangstoken, client-id og
 * den valgte liste. Samme sted og samme regler som kalenderlinks (feeds.php):
 * api.php kan ikke nå mappen, og tokens sendes aldrig tilbage til browseren.
 *
 * ── Adgang ─────────────────────────────────────────────────────────────
 * Som kalendere.php: en af nøglerne i headeren X-Ugeplan-Key OG PIN-cookien.
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

function ind_out(array $data, int $code = 200): never
{
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function ind_fail(int $code, string $msg, string $kind = ''): never
{
    ind_out($kind === '' ? ['error' => $msg] : ['error' => $msg, 'kind' => $kind], $code);
}

if ($lib === null || !is_file("$lib/gate.php")) {
    ind_fail(500, 'ugeplan-lib/feeds.php eller gate.php mangler');
}
require_once "$lib/feeds.php";   // DATA_DIR og feeds_write_json()
require_once "$lib/gate.php";

// ─── Adgang ────────────────────────────────────────────────────────
$key = (string)($_SERVER['HTTP_X_UGEPLAN_KEY'] ?? '');
$role = null;
if ($key !== '' && WRITE_TOKEN !== 'UDFYLD' && hash_equals(WRITE_TOKEN, $key))     $role = 'write';
elseif ($key !== '' && READ_TOKEN !== 'UDFYLD' && hash_equals(READ_TOKEN, $key))   $role = 'read';
if ($role === null) ind_fail(401, 'ukendt eller manglende nøgle');
if (!gate_ok())     ind_fail(403, 'log ind med familiens kode først');

// ─── Konstanter ────────────────────────────────────────────────────
const MS_FILE     = DATA_DIR . '/private/ms-todo.json';
const MS_LOCK     = DATA_DIR . '/private/ms-todo.lock';
const MS_AUTH     = 'https://login.microsoftonline.com/consumers/oauth2/v2.0';
const MS_GRAPH    = 'https://graph.microsoft.com/v1.0';
const MS_SCOPE    = 'Tasks.ReadWrite offline_access';
const MS_REDIRECT = 'http://localhost';
const MS_PENDING_SEKUNDER = 900;     // et login skal gennemføres inden 15 minutter
const MS_TITEL_MAX = 200;

/** Fejl der skyldes login/forbindelse, så dialogen kan sende brugeren tilbage til opsætningen. */
final class MsAuthError extends RuntimeException
{
    public function __construct(public readonly string $kind, string $message)
    {
        parent::__construct($message);
    }
}

// ─── Lagring ───────────────────────────────────────────────────────
function ms_load(): array
{
    if (!is_file(MS_FILE)) return [];
    $raw = @file_get_contents(MS_FILE);
    $d = ($raw === false || $raw === '') ? null : json_decode($raw, true);
    return is_array($d) ? $d : [];
}

function ms_save(array $d): void
{
    feeds_write_json(MS_FILE, $d);
}

// ─── HTTP (kun mod Microsoft) ──────────────────────────────────────
/** @return array{int, ?array, string}  [statuskode, JSON, rå krop] */
function ms_http(string $method, string $url, array $headers = [], ?string $body = null): array
{
    // Adresserne er faste. En nextLink fra Graph tjekkes her, før den følges.
    if (!str_starts_with($url, MS_AUTH . '/') && !str_starts_with($url, 'https://graph.microsoft.com/')) {
        throw new RuntimeException('uventet adresse');
    }

    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST  => $method,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER     => $headers,
            CURLOPT_TIMEOUT        => 20,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_FOLLOWLOCATION => false,
        ]);
        if ($body !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
        $raw  = curl_exec($ch);
        $err  = curl_error($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);
        if ($raw === false) throw new MsAuthError('net', 'Kunne ikke nå Microsoft: ' . ($err ?: 'ukendt fejl'));
    } else {
        $ctx = stream_context_create(['http' => [
            'method' => $method, 'header' => implode("\r\n", $headers),
            'content' => $body ?? '', 'timeout' => 20, 'ignore_errors' => true, 'follow_location' => 0,
        ]]);
        $raw = @file_get_contents($url, false, $ctx);
        if ($raw === false) throw new MsAuthError('net', 'Kunne ikke nå Microsoft.');
        $code = 0;
        foreach ($http_response_header ?? [] as $h) {
            if (preg_match('#^HTTP/\S+\s+(\d{3})#', $h, $m)) $code = (int)$m[1];
        }
    }
    $j = json_decode((string)$raw, true);
    return [$code, is_array($j) ? $j : null, (string)$raw];
}

/** Første linje af en fejltekst, uden Microsofts sporings-id'er. */
function ms_first_line(string $s): string
{
    $s = trim(strtok($s, "\r\n") ?: $s);
    $s = preg_replace('/\s*Trace ID:.*$/i', '', $s) ?? $s;
    return mb_substr_safe($s, 300);
}

function mb_substr_safe(string $s, int $n): string
{
    return preg_match('/^.{0,' . $n . '}/us', $s, $m) ? $m[0] : substr($s, 0, $n);
}

/** Hjælp til de mest almindelige fejl i registreringen af appen. */
function ms_hint(string $msg): string
{
    return match (true) {
        str_contains($msg, 'AADSTS700016'), str_contains($msg, 'unauthorized_client')
            => ' Tjek at Application (client) ID er kopieret rigtigt, og at appen er registreret til personlige Microsoft-konti.',
        str_contains($msg, 'AADSTS50011'), str_contains($msg, 'redirect_uri')
            => ' Tilføj http://localhost som omdirigerings-adresse under «Mobile and desktop applications» i appens Authentication.',
        str_contains($msg, 'AADSTS70002'), str_contains($msg, 'AADSTS7000218')
            => ' Slå «Allow public client flows» til i appens Authentication.',
        str_contains($msg, 'AADSTS54005'), str_contains($msg, 'AADSTS70008')
            => ' Koden er brugt eller udløbet. Start forfra med «Åbn Microsoft-login».',
        default => '',
    };
}

function ms_token_request(array $form): array
{
    [$code, $j, $raw] = ms_http('POST', MS_AUTH . '/token',
        ['Content-Type: application/x-www-form-urlencoded', 'Accept: application/json'],
        http_build_query($form));
    if ($code !== 200 || !is_array($j) || empty($j['access_token'])) {
        $err  = is_array($j) ? (string)($j['error'] ?? '') : '';
        $desc = is_array($j) ? ms_first_line((string)($j['error_description'] ?? $err)) : "HTTP $code";
        $kind = in_array($err, ['invalid_grant', 'interaction_required', 'consent_required'], true) ? 'reconnect' : 'auth';
        throw new MsAuthError($kind, 'Microsoft afviste login: ' . $desc . ms_hint($desc));
    }
    return $j;
}

function ms_apply_tokens(array $d, array $t): array
{
    $d['access_token'] = (string)$t['access_token'];
    $d['expires_at']   = time() + (int)($t['expires_in'] ?? 3600);
    if (!empty($t['refresh_token'])) $d['refresh_token'] = (string)$t['refresh_token'];
    return $d;
}

/** Et gyldigt adgangstoken. Fornyes med refresh-token, og kun ét kald ad gangen. */
function ms_access(bool $force = false): string
{
    @mkdir(dirname(MS_LOCK), 0770, true);
    $fh = @fopen(MS_LOCK, 'c');
    if ($fh) flock($fh, LOCK_EX);
    try {
        $d = ms_load();
        if (empty($d['client_id']) || empty($d['refresh_token'])) {
            throw new MsAuthError('not_connected', 'Ikke forbundet til Microsoft endnu.');
        }
        if (!$force && !empty($d['access_token']) && (int)($d['expires_at'] ?? 0) > time() + 120) {
            return (string)$d['access_token'];
        }
        try {
            $t = ms_token_request([
                'grant_type' => 'refresh_token', 'client_id' => $d['client_id'],
                'refresh_token' => $d['refresh_token'], 'scope' => MS_SCOPE,
            ]);
        } catch (MsAuthError $e) {
            if ($e->kind === 'reconnect') {
                unset($d['refresh_token'], $d['access_token'], $d['expires_at']);
                ms_save($d);
                throw new MsAuthError('reconnect', 'Forbindelsen til Microsoft er udløbet. Forbind igen.');
            }
            throw $e;
        }
        $d = ms_apply_tokens($d, $t);
        ms_save($d);
        return (string)$d['access_token'];
    } finally {
        if ($fh) { flock($fh, LOCK_UN); fclose($fh); }
    }
}

function ms_graph(string $method, string $path, ?array $body = null): array
{
    $url = str_starts_with($path, 'https://') ? $path : MS_GRAPH . $path;
    for ($try = 0; $try < 2; $try++) {
        $h = ['Authorization: Bearer ' . ms_access($try === 1), 'Accept: application/json'];
        $b = null;
        if ($body !== null) { $h[] = 'Content-Type: application/json'; $b = json_encode($body, JSON_UNESCAPED_UNICODE); }
        [$code, $j] = ms_http($method, $url, $h, $b);
        if ($code === 401 && $try === 0) continue;       // token afvist: forny og prøv én gang til
        if ($code === 401) throw new MsAuthError('reconnect', 'Microsoft afviste adgangen. Forbind igen.');
        if ($code >= 400) {
            $m = is_array($j) ? ms_first_line((string)($j['error']['message'] ?? '')) : '';
            throw new RuntimeException("Microsoft svarede $code" . ($m !== '' ? ": $m" : ''));
        }
        return $j ?? [];
    }
    throw new RuntimeException('Microsoft svarede ikke');
}

// ─── Hjælp ─────────────────────────────────────────────────────────
function ind_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') ind_fail(400, 'tom krop');
    if (strlen($raw) > 20_000)         ind_fail(413, 'kroppen er for stor');
    $b = json_decode($raw, true);
    if (!is_array($b)) ind_fail(400, 'kroppen skal være JSON');
    return $b;
}

function ind_id(mixed $v): string
{
    $s = (string)$v;
    if (!preg_match('~^[A-Za-z0-9_=+/-]{8,400}\z~', $s)) ind_fail(400, 'ugyldigt id');
    return $s;
}

function ind_status(): array
{
    $d = ms_load();
    return [
        'configured' => !empty($d['client_id']),
        'connected'  => !empty($d['refresh_token']),
        'clientId'   => (string)($d['client_id'] ?? ''),
        'listId'     => (string)($d['list_id'] ?? ''),
        'listName'   => (string)($d['list_name'] ?? ''),
    ];
}

function ind_lists(): array
{
    $j = ms_graph('GET', '/me/todo/lists');
    $out = [];
    foreach (($j['value'] ?? []) as $l) {
        $out[] = [
            'id'       => (string)($l['id'] ?? ''),
            'name'     => (string)($l['displayName'] ?? ''),
            'isShared' => !empty($l['isShared']),
            'isOwner'  => !array_key_exists('isOwner', $l) || !empty($l['isOwner']),
        ];
    }
    return $out;
}

function ind_list_id(): string
{
    $id = (string)(ms_load()['list_id'] ?? '');
    if ($id === '') ind_fail(409, 'Vælg først, hvilken liste der er indkøbssedlen.', 'no_list');
    return $id;
}

function ind_items(string $listId): array
{
    $url = MS_GRAPH . '/me/todo/lists/' . rawurlencode($listId) . '/tasks?$top=100';
    $out = [];
    for ($page = 0; $page < 5 && $url !== ''; $page++) {
        $j = ms_graph('GET', $url);
        foreach (($j['value'] ?? []) as $t) {
            if (($t['status'] ?? '') === 'completed') continue;
            $out[] = [
                'id'        => (string)($t['id'] ?? ''),
                'title'     => (string)($t['title'] ?? ''),
                'important' => ($t['importance'] ?? '') === 'high',
            ];
        }
        $url = (string)($j['@odata.nextLink'] ?? '');
        if ($url !== '' && !str_starts_with($url, 'https://graph.microsoft.com/')) break;
    }
    return $out;
}

// ─── Forespørgsler ─────────────────────────────────────────────────
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = (string)($_GET['action'] ?? '');

try {
    if ($method === 'GET') {
        if ($action === '')      ind_out(ind_status());
        if ($action === 'lists') ind_out(['lists' => ind_lists()]);
        if ($action === 'items') {
            $d = ms_load();
            ind_out(['listName' => (string)($d['list_name'] ?? ''), 'items' => ind_items(ind_list_id()), 'at' => date('c')]);
        }
        ind_fail(400, 'ukendt handling');
    }
    if ($method !== 'POST') ind_fail(405, 'kun GET og POST');

    switch ($action) {
        case 'config': {
            $cid = strtolower(trim((string)(ind_body()['client_id'] ?? '')));
            if (!preg_match('/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/', $cid)) {
                ind_fail(400, 'Application (client) ID ser ikke rigtigt ud. Det er otte-fire-fire-fire-tolv tegn med bindestreger.');
            }
            $d = ms_load();
            if (($d['client_id'] ?? '') !== $cid) {                // nyt id: gamle tokens hører til en anden app
                unset($d['refresh_token'], $d['access_token'], $d['expires_at']);
            }
            $verifier  = rtrim(strtr(base64_encode(random_bytes(48)), '+/', '-_'), '=');
            $challenge = rtrim(strtr(base64_encode(hash('sha256', $verifier, true)), '+/', '-_'), '=');
            $state     = bin2hex(random_bytes(16));
            $d['client_id'] = $cid;
            $d['pending']   = ['verifier' => $verifier, 'state' => $state, 'at' => time()];
            ms_save($d);
            $authUrl = MS_AUTH . '/authorize?' . http_build_query([
                'client_id' => $cid, 'response_type' => 'code', 'redirect_uri' => MS_REDIRECT,
                'response_mode' => 'query', 'scope' => MS_SCOPE, 'state' => $state,
                'code_challenge' => $challenge, 'code_challenge_method' => 'S256',
                'prompt' => 'select_account',
            ], '', '&', PHP_QUERY_RFC3986);
            ind_out(['authUrl' => $authUrl]);
        }

        case 'connect': {
            $pasted = trim((string)(ind_body()['redirect'] ?? ''));
            if ($pasted === '') ind_fail(400, 'Sæt adressen fra browseren ind.');
            $d = ms_load();
            $p = $d['pending'] ?? null;
            if (!is_array($p) || (time() - (int)($p['at'] ?? 0)) > MS_PENDING_SEKUNDER) {
                ind_fail(409, 'Login-forsøget er udløbet. Tryk «Åbn Microsoft-login» igen.', 'restart');
            }
            $q = (string)(parse_url($pasted, PHP_URL_QUERY) ?? '');
            if ($q === '' && !str_contains($pasted, '://')) $q = ltrim($pasted, '?');   // kun query-delen indsat
            parse_str($q, $r);
            if (!empty($r['error'])) {
                $desc = ms_first_line((string)($r['error_description'] ?? $r['error']));
                ind_fail(400, 'Microsoft afviste login: ' . $desc . ms_hint($desc));
            }
            $code = (string)($r['code'] ?? '');
            if ($code === '') ind_fail(400, 'Adressen indeholder ingen kode. Kopiér hele adressen fra adresselinjen, efter siden ikke kunne åbnes.');
            if (!hash_equals((string)$p['state'], (string)($r['state'] ?? ''))) {
                ind_fail(400, 'Adressen hører til et andet login-forsøg. Tryk «Åbn Microsoft-login» igen og brug den nye adresse.');
            }
            $t = ms_token_request([
                'grant_type' => 'authorization_code', 'client_id' => (string)$d['client_id'],
                'code' => $code, 'redirect_uri' => MS_REDIRECT,
                'code_verifier' => (string)$p['verifier'], 'scope' => MS_SCOPE,
            ]);
            unset($d['pending']);
            ms_save(ms_apply_tokens($d, $t));
            ind_out(ind_status());
        }

        case 'setlist': {
            $id = ind_id(ind_body()['id'] ?? '');
            $name = null;
            foreach (ind_lists() as $l) if ($l['id'] === $id) $name = $l['name'];
            if ($name === null) ind_fail(404, 'Listen findes ikke på kontoen.');
            $d = ms_load();
            $d['list_id'] = $id;
            $d['list_name'] = $name;
            ms_save($d);
            ind_out(ind_status());
        }

        case 'add': {
            $title = trim(preg_replace('/[\p{Cc}\s]+/u', ' ', (string)(ind_body()['title'] ?? '')) ?? '');
            if ($title === '') ind_fail(400, 'Skriv, hvad der skal købes.');
            $title = mb_substr_safe($title, MS_TITEL_MAX);
            $t = ms_graph('POST', '/me/todo/lists/' . rawurlencode(ind_list_id()) . '/tasks', ['title' => $title]);
            ind_out(['item' => ['id' => (string)($t['id'] ?? ''), 'title' => (string)($t['title'] ?? $title), 'important' => false]]);
        }

        case 'done':
        case 'reopen': {
            $id = ind_id(ind_body()['id'] ?? '');
            ms_graph('PATCH', '/me/todo/lists/' . rawurlencode(ind_list_id()) . '/tasks/' . rawurlencode($id),
                ['status' => $action === 'done' ? 'completed' : 'notStarted']);
            ind_out(['ok' => true]);
        }

        case 'disconnect': {
            $d = ms_load();
            unset($d['refresh_token'], $d['access_token'], $d['expires_at'], $d['pending']);
            ms_save($d);
            ind_out(ind_status());
        }
    }
    ind_fail(400, 'ukendt handling');

} catch (MsAuthError $e) {
    $status = in_array($e->kind, ['not_connected', 'reconnect'], true) ? 409 : 502;
    ind_fail($status, $e->getMessage(), $e->kind);
} catch (Throwable $e) {
    ind_fail(502, $e->getMessage());
}
