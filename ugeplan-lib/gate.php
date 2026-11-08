<?php
/**
 * gate.php — PIN-login'ets adgangscookie, ét sted i PHP.
 *
 * login.php sætter cookien 'ugeplan_ok' til denne værdi efter korrekt PIN.
 * .htaccess tjekker den foran index.html og overblik.html, og kalendere.php
 * tjekker den selv. Værdien skal derfor være PRÆCIS den samme som i
 * .htaccess' to RewriteCond-linjer — ændres den her, skal den ændres der.
 */

declare(strict_types=1);

require_once __DIR__ . '/store.php';   // DATA_DIR, til tælleren nedenfor

const GATE_TOKEN = '__GATE_TOKEN__';

// Åben visning (Opsætning → Login og sikkerhed). Er den slået til, må forsiden hente det, den viser, uden PIN-cookie. Kun LÆSNING (GET),
// kun disse scripts og kun disse handlinger. Alt, der ændrer noget, og alt andet (indstillinger, sikkerhedskopi, wifi, kalendere, oversættelse) kræver stadig cookien.
// Sættes ved opstart ud fra indstillingen («ja» eller «nej»).
const GATE_AABEN_VISNING = '__AABEN_VISNING__';
const GATE_AABNE_LAESNINGER = [
    'vejr.php' => [''], 'tema.php' => [''], 'joke.php' => [''], 'elpris.php' => [''], 'bil.php' => [''], 'info.php' => [''], 'sprog.php' => [''],
    'tegneserie.php' => ['', 'dag', 'historik'], 'strava.php' => ['aktiviteter'], 'indkob.php' => ['items'], 'billeder.php' => ['liste', 'hent'],
];

/** Har browseren den cookie, login.php giver efter korrekt PIN? */
function gate_cookie_ok(): bool
{
    $c = (string)($_COOKIE['ugeplan_ok'] ?? '');
    return strlen(GATE_TOKEN) >= 32 && hash_equals(GATE_TOKEN, $c);
}

/** Må denne forespørgsel læse uden login, fordi åben visning er slået til? */
function gate_aaben_laesning(): bool
{
    if (GATE_AABEN_VISNING !== 'ja') return false;
    if (!in_array($_SERVER['REQUEST_METHOD'] ?? '', ['GET', 'HEAD'], true)) return false;
    $tilladt = GATE_AABNE_LAESNINGER[basename((string)($_SERVER['SCRIPT_NAME'] ?? ''))] ?? null;
    return $tilladt !== null && in_array((string)($_GET['action'] ?? ''), $tilladt, true);
}

/** Login-cookien, eller en læsning, som åben visning tillader. */
function gate_ok(): bool
{
    return gate_cookie_ok() || gate_aaben_laesning();
}

// ─── Forkerte koder ────────────────────────────────────────────────
// Fire cifre er 10.000 muligheder. Uden en grænse prøver et script dem alle
// på få minutter — og med Kalendere-dialogen giver koden nu også lov til at
// ændre, hvilke kalendere webhotellet henter. Grænsen er sat højt nok til,
// at et barn der taster forkert, ikke spærrer resten af familien (samme
// hjemmenetværk = samme adresse): 20 forkerte på 15 minutter. Så tager en
// gennemprøvning over 100 timer i stedet for minutter.
// Adresserne gemmes kun som hash.
const GATE_MAX_FEJL = 20;
const GATE_VINDUE   = 900;
const GATE_FEJLFIL  = DATA_DIR . '/private/login-fejl.json';

/** Kør $fn på tællerfilen under lås. $fn får og returnerer [nøgle => [tid, …]]. */
function gate_taeller(callable $fn): array
{
    $dir = dirname(GATE_FEJLFIL);
    if (!is_dir($dir)) @mkdir($dir, 0770, true);
    $h = @fopen(GATE_FEJLFIL, 'c+');
    if (!$h) return [];                       // hellere uden grænse end uden login
    flock($h, LOCK_EX);
    $data = json_decode((string)stream_get_contents($h), true);
    $data = is_array($data) ? $data : [];
    $nu = time();
    foreach ($data as $k => $tider) {
        $data[$k] = array_values(array_filter((array)$tider, fn($t) => is_int($t) && $t > $nu - GATE_VINDUE));
        if (!$data[$k]) unset($data[$k]);
    }
    $ny = $fn($data);
    ftruncate($h, 0); rewind($h);
    fwrite($h, json_encode($ny));
    flock($h, LOCK_UN); fclose($h);
    return $ny;
}

/** $tag giver en særskilt tæller (fx 'totp' til koden i andet trin), så PIN-forsøg og kodeforsøg ikke blandes. Uden $tag er nøglen som før. */
function gate_noegle(string $ip, string $tag = ''): string { return substr(hash('sha256', 'ugeplan|' . ($tag !== '' ? $tag . '|' : '') . $ip), 0, 16); }

function gate_spaerret(string $ip, string $tag = '', int $max = GATE_MAX_FEJL): bool
{
    $k = gate_noegle($ip, $tag);
    $data = gate_taeller(fn($d) => $d);
    return count($data[$k] ?? []) >= $max;
}

function gate_forkert(string $ip, string $tag = ''): void
{
    $k = gate_noegle($ip, $tag);
    gate_taeller(function ($d) use ($k) { $d[$k][] = time(); return $d; });
}

function gate_rigtig(string $ip, string $tag = ''): void
{
    $k = gate_noegle($ip, $tag);
    gate_taeller(function ($d) use ($k) { unset($d[$k]); return $d; });
}
