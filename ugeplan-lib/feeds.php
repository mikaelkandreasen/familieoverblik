<?php
/**
 * feeds.php — listen over kalendere (ICS-feeds), som hent.php henter hver time.
 *
 * Listen stod før fast i config.php (ICS_FEEDS). Nu ligger den som data i
 *   DATA_DIR/private/feeds.json
 * og redigeres fra Kalendere-dialogen i index.html via kalendere.php.
 *
 * Findes filen ikke, bruges ICS_FEEDS fra config.php stadig — så en
 * installation, der aldrig har åbnet dialogen, opfører sig præcis som før.
 * Første gang der gemmes i dialogen, kopieres config-listen over i filen, og
 * derfra er det filen, der gælder. ICS_FEEDS kan så tømmes, men behøver ikke.
 *
 * ── Hvorfor "private/" og ikke "settings/" ────────────────────────────
 * Adresserne er reelt adgangskoder: et Holdsport-, DBU- eller Google-link
 * indeholder en personlig nøgle, og kender man linket, kan man læse
 * børnenes aktiviteter. Alt under settings/ kan hentes af api.php med
 * LÆSENØGLEN, og den står i klartekst i config.js. Derfor ligger listen et
 * sted, store_valid_path() slet ikke kender, og api.php kan ikke nå den.
 * Den eneste vej ind er kalendere.php, der kræver PIN-cookien, og som kun
 * nogensinde sender adresserne tilbage maskeret.
 */

declare(strict_types=1);

require_once __DIR__ . '/store.php';

const FEEDS_FILE        = DATA_DIR . '/private/feeds.json';
const FEEDS_STATUS_FILE = DATA_DIR . '/private/feeds-status.json';
const FEEDS_MAX         = 30;
const FEEDS_URL_MAX     = 2000;
const FEEDS_MAX_BYTES   = 8_000_000;   // største feed i drift er 0,7 MB
const FEEDS_LOCK_FILE   = DATA_DIR . '/private/feeds.lock';

/** Et feeds id er et kort hash af adressen — samme adresse, samme id. */
function feeds_id(string $url): string
{
    return substr(hash('sha256', $url), 0, 10);
}

/** Ryd et gemt element op til den form resten af koden regner med. */
function feeds_clean(array $f): ?array
{
    $url = trim((string)($f['url'] ?? ''));
    if ($url === '') return null;
    return [
        'id'      => feeds_id($url),
        'url'     => $url,
        'person'  => (string)($f['person'] ?? ''),
        'icon'    => (string)($f['icon'] ?? ''),
        'tag'     => (string)($f['tag'] ?? ''),
        'label'   => (string)($f['label'] ?? ''),
        'enabled' => !array_key_exists('enabled', $f) || (bool)$f['enabled'],
    ];
}

/**
 * Hele listen med fulde adresser. Kun til serverbrug — må aldrig sendes
 * ufiltreret til en browser (brug feeds_public()).
 *
 * @return array{source:string, updatedAt:?string, rev:?string, feeds:list<array>}
 */
function feeds_load(): array
{
    if (is_file(FEEDS_FILE)) {
        $raw = @file_get_contents(FEEDS_FILE);
        $doc = ($raw === false || $raw === '') ? null : json_decode($raw, true);
        if (!is_array($doc) || !isset($doc['feeds']) || !is_array($doc['feeds'])) {
            // En ødelagt fil må IKKE stille falde tilbage til config.php: det
            // ville genoplive kalendere, man har fjernet. Hellere at ICS-jobbet
            // fejler højlydt og lader gårsdagens data stå.
            throw new RuntimeException('private/feeds.json kan ikke læses — ret eller slet filen '
                . 'via FTP (slettes den, bruges ICS_FEEDS i config.php igen)');
        }
        $list = [];
        foreach ($doc['feeds'] as $f) {
            if (is_array($f) && ($c = feeds_clean($f))) $list[] = $c;
        }
        // rev er et hash af selve filen. updatedAt duer ikke til at opdage
        // samtidige ændringer: den har sekund-opløsning, og to gem inden for
        // samme sekund ville se ens ud.
        return ['source' => 'file', 'updatedAt' => $doc['updatedAt'] ?? null,
                'rev' => substr(hash('sha256', $raw), 0, 12), 'feeds' => $list];
    }

    $list = [];
    foreach ((defined('ICS_FEEDS') ? ICS_FEEDS : []) as $f) {
        if (is_array($f) && ($c = feeds_clean($f))) $list[] = $c;
    }
    return ['source' => 'config', 'updatedAt' => null, 'rev' => null, 'feeds' => $list];
}

/** De aktive feeds, i samme form som ICS_FEEDS altid har haft — til hent.php. */
function feeds_active(): array
{
    return array_values(array_filter(feeds_load()['feeds'], fn($f) => $f['enabled']));
}

/** Skriv listen atomisk: midlertidig fil i samme mappe, derefter rename(). */
function feeds_write_json(string $file, array $doc): void
{
    $dir = dirname($file);
    if (!is_dir($dir) && !@mkdir($dir, 0770, true) && !is_dir($dir)) {
        throw new RuntimeException("kan ikke oprette mappen $dir");
    }
    $json = json_encode($doc, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    if ($json === false) throw new RuntimeException('kunne ikke kode JSON: ' . json_last_error_msg());

    $tmp = $file . '.' . getmypid() . '.tmp';
    if (@file_put_contents($tmp, $json, LOCK_EX) === false) {
        throw new RuntimeException("kan ikke skrive $tmp — tjek rettigheder på " . DATA_DIR);
    }
    if (!@rename($tmp, $file)) {
        @unlink($tmp);
        throw new RuntimeException("kan ikke omdøbe til $file");
    }
    @chmod($file, 0660);
}

function feeds_save(array $feeds): string
{
    $at = date('c');
    $out = [];
    foreach ($feeds as $f) {
        $out[] = [
            'url'     => $f['url'],
            'person'  => $f['person'],
            'icon'    => $f['icon'],
            'tag'     => $f['tag'] ?? '',
            'label'   => $f['label'],
            'enabled' => $f['enabled'],
        ];
    }
    feeds_write_json(FEEDS_FILE, ['updatedAt' => $at, 'feeds' => $out]);
    return $at;
}

// ─── Status fra seneste hentning ───────────────────────────────────
// hent.php skriver, hvordan det gik med hvert feed, så dialogen kan sige
// "fejlede: HTTP 404" i stedet for at en kalender bare stille forsvinder.

function feeds_status_load(): array
{
    if (!is_file(FEEDS_STATUS_FILE)) return [];
    $doc = json_decode((string)@file_get_contents(FEEDS_STATUS_FILE), true);
    return is_array($doc) ? $doc : [];
}

function feeds_status_write(array $status): void
{
    try { feeds_write_json(FEEDS_STATUS_FILE, $status); } catch (Throwable) { /* status er pynt */ }
}

// ─── Adresser ind ──────────────────────────────────────────────────

/**
 * Gør en indtastet adresse klar, eller kast med en besked der kan vises.
 * webcal:// er bare https:// med et andet navn — Google og Holdsport giver
 * gerne det ene, og PHP kan kun hente det andet.
 */
function feeds_normalize_url(string $url): string
{
    $url = trim($url);
    if ($url === '')                         throw new InvalidArgumentException('Linket er tomt.');
    if (strlen($url) > FEEDS_URL_MAX)        throw new InvalidArgumentException('Linket er for langt.');
    if (preg_match('/\s/', $url))            throw new InvalidArgumentException('Linket må ikke indeholde mellemrum.');

    $url = preg_replace('#^webcals?://#i', 'https://', $url) ?? $url;

    $p = parse_url($url);
    $scheme = strtolower((string)($p['scheme'] ?? ''));
    if (!in_array($scheme, ['http', 'https'], true) || empty($p['host'])) {
        throw new InvalidArgumentException('Det ligner ikke et kalenderlink. Det skal starte med https://, http:// eller webcal://.');
    }
    if (isset($p['user']) || isset($p['pass'])) {
        throw new InvalidArgumentException('Linket må ikke indeholde brugernavn eller adgangskode.');
    }
    $ports = array_merge([80, 443], defined('FEEDS_TEST_PORTS') ? FEEDS_TEST_PORTS : []);   // kun test udvider
    if (isset($p['port']) && !in_array((int)$p['port'], $ports, true)) {
        throw new InvalidArgumentException('Linket bruger en usædvanlig port.');
    }
    feeds_public_ip((string)$p['host']);
    return $url;
}

/**
 * Webhotellet må ikke kunne bruges til at kigge ind på sit eget netværk.
 * Et link til 127.0.0.1 eller 10.x ville ellers få serveren til at hente
 * noget, kun den selv kan se — og vise det i test-svaret.
 *
 * Returnerer den IPv4-adresse, der blev godkendt. feeds_fetch() forbinder
 * til præcis den (CURLOPT_RESOLVE), så et navn ikke kan skifte til en intern
 * adresse mellem tjekket og hentningen. IPv6 bruges ikke: ingen af
 * kalendertjenesterne kræver det, og filter_var kender ikke alle de
 * IPv6-former, der dækker over en intern IPv4-adresse.
 * null betyder testtilstand (ingen pinning).
 */
function feeds_public_ip(string $host): ?string
{
    if (defined('FEEDS_ALLOW_PRIVATE') && FEEDS_ALLOW_PRIVATE) return null;   // kun til test

    $host = trim($host, '[]');
    if (filter_var($host, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6)) {
        throw new InvalidArgumentException('Links med en IPv6-adresse understøttes ikke.');
    }
    $ips = filter_var($host, FILTER_VALIDATE_IP) ? [$host] : (@gethostbynamel($host) ?: []);
    if (!$ips) throw new InvalidArgumentException("Kan ikke finde serveren $host.");

    foreach ($ips as $ip) {
        if (!filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4 | FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
            throw new InvalidArgumentException('Linket peger på en intern adresse.');
        }
    }
    return $ips[0];
}

/**
 * Hent et feed. Bruges af både "Test"-knappen og det timelige ICS-job.
 *
 * Omdirigeringer følges i hånden, fordi hvert hop skal igennem samme tjek
 * som det link, brugeren tastede: en offentlig adresse må ikke kunne sende
 * videre til 127.0.0.1. Kroppen er loftet, så et link til en kæmpefil ikke
 * kan fylde webhotellets hukommelse.
 */
function feeds_fetch(string $url, int $timeout = 30): string
{
    for ($hop = 0; $hop <= 3; $hop++) {
        try {
            $url = feeds_normalize_url($url);
            $p   = parse_url($url);
            $ip  = feeds_public_ip((string)$p['host']);
        } catch (InvalidArgumentException $e) {
            throw new RuntimeException($hop ? 'omdirigeret til et link, der ikke er tilladt: ' . $e->getMessage()
                                            : $e->getMessage());
        }
        [$code, $next, $body] = function_exists('curl_init')
            ? feeds_fetch_curl($url, $p, $ip, $timeout)
            : feeds_fetch_stream($url, $timeout);

        if ($code >= 300 && $code < 400 && $next !== '') { $url = feeds_resolve($url, $next); continue; }
        if ($code >= 400) throw new RuntimeException("HTTP $code");
        return $body;
    }
    throw new RuntimeException('for mange omdirigeringer');
}

/** @return array{int, string, string}  [statuskode, Location, krop] */
function feeds_fetch_curl(string $url, array $p, ?string $ip, int $timeout): array
{
    $host = (string)$p['host'];
    $port = (int)($p['port'] ?? (strtolower((string)$p['scheme']) === 'https' ? 443 : 80));

    $body = ''; $tooBig = false;
    $ch = curl_init($url);
    $opt = [
        CURLOPT_FOLLOWLOCATION  => false,
        CURLOPT_TIMEOUT         => $timeout,
        CURLOPT_CONNECTTIMEOUT  => 10,
        CURLOPT_USERAGENT       => 'Mozilla/5.0 (compatible; Ugeplan/2)',
        CURLOPT_ENCODING        => '',
        CURLOPT_PROTOCOLS       => CURLPROTO_HTTP | CURLPROTO_HTTPS,
        CURLOPT_WRITEFUNCTION   => function ($ch, string $chunk) use (&$body, &$tooBig): int {
            if (strlen($body) + strlen($chunk) > FEEDS_MAX_BYTES) { $tooBig = true; return 0; }
            $body .= $chunk;
            return strlen($chunk);
        },
    ];
    if ($ip !== null) {
        // Forbind til præcis den adresse, der blev godkendt
        $opt[CURLOPT_IPRESOLVE] = CURL_IPRESOLVE_V4;
        if (!filter_var($host, FILTER_VALIDATE_IP)) $opt[CURLOPT_RESOLVE] = ["$host:$port:$ip"];
    }
    curl_setopt_array($ch, $opt);
    $ok   = curl_exec($ch);
    $err  = curl_error($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $next = (string)curl_getinfo($ch, CURLINFO_REDIRECT_URL);
    curl_close($ch);

    if ($tooBig)       throw new RuntimeException('kalenderen er større end ' . (FEEDS_MAX_BYTES / 1_000_000) . ' MB');
    if ($ok === false) throw new RuntimeException("curl: $err");
    return [$code, $next, $body];
}

/**
 * Uden curl: PHP's egen http-strøm, som hent.php altid har kunnet falde
 * tilbage på. Omdirigeringer følges heller ikke her automatisk. Adressen kan
 * ikke låses fast som med curl — et navn slås op igen ved forbindelsen.
 * @return array{int, string, string}
 */
function feeds_fetch_stream(string $url, int $timeout): array
{
    if (!ini_get('allow_url_fopen')) {
        throw new RuntimeException('hverken curl eller allow_url_fopen er tilgængelig — '
            . 'webhotellet tillader ikke udgående HTTP fra PHP');
    }
    $ctx = stream_context_create(['http' => [
        'timeout' => $timeout, 'user_agent' => 'Mozilla/5.0 (compatible; Ugeplan/2)',
        'follow_location' => 0, 'ignore_errors' => true,
    ]]);
    $fh = @fopen($url, 'rb', false, $ctx);
    if ($fh === false) throw new RuntimeException('hentningen fejlede');

    $code = 0; $next = '';
    foreach ((stream_get_meta_data($fh)['wrapper_data'] ?? []) as $h) {
        if (preg_match('#^HTTP/\S+\s+(\d{3})#', $h, $m)) $code = (int)$m[1];
        elseif (preg_match('#^Location:\s*(\S+)#i', $h, $m)) $next = $m[1];
    }
    $body = '';
    while (!feof($fh)) {
        $chunk = fread($fh, 65536);
        if ($chunk === false) break;
        $body .= $chunk;
        if (strlen($body) > FEEDS_MAX_BYTES) {
            fclose($fh);
            throw new RuntimeException('kalenderen er større end ' . (FEEDS_MAX_BYTES / 1_000_000) . ' MB');
        }
    }
    fclose($fh);
    return [$code, $next, $body];
}

/** Gør en Location-header absolut ud fra den adresse, der svarede. */
function feeds_resolve(string $base, string $loc): string
{
    if (preg_match('#^[a-z][a-z0-9+.-]*:#i', $loc)) return $loc;
    $p = parse_url($base);
    $root = $p['scheme'] . '://' . $p['host'] . (isset($p['port']) ? ':' . $p['port'] : '');
    if (str_starts_with($loc, '//')) return $p['scheme'] . ':' . $loc;
    if (str_starts_with($loc, '/'))  return $root . $loc;
    $dir = preg_replace('#/[^/]*$#', '/', $p['path'] ?? '/') ?? '/';
    return $root . $dir . $loc;
}

// ─── Adresser ud ───────────────────────────────────────────────────

/** Hvilken tjeneste er det? Kun til visning. */
function feeds_service(string $url): string
{
    $h = strtolower((string)parse_url($url, PHP_URL_HOST));
    return match (true) {
        str_ends_with($h, 'holdsport.dk')        => 'Holdsport',
        str_ends_with($h, 'dbu.dk')              => 'DBU',
        str_ends_with($h, 'google.com')          => 'Google Kalender',
        str_ends_with($h, 'fixtur.es')           => 'Fixtur.es',
        str_ends_with($h, 'fotmob.com')          => 'FotMob',
        str_ends_with($h, 'outlook.office365.com'),
        str_ends_with($h, 'outlook.live.com')    => 'Outlook',
        str_ends_with($h, 'icloud.com')          => 'iCloud',
        default                                  => preg_replace('/^www\./', '', $h) ?? $h,
    };
}

/**
 * Nok til at kende to links fra hinanden — værten og et kort mærke — men
 * intet fra selve linket. To børn kan begge have et Holdsport-link, og de
 * sidste tegn i sådan et link ER den hemmelige nøgle; mærket er derfor de
 * første tegn af id'et, som er et hash og ikke kan regnes baglæns.
 */
function feeds_hint(string $url): string
{
    $h = preg_replace('/^www\./', '', strtolower((string)parse_url($url, PHP_URL_HOST))) ?? '';
    return $h . ' · #' . substr(feeds_id($url), 0, 4);
}

/** Listen som den må se ud i en browser: ingen adresser. */
function feeds_public(array $loaded): array
{
    $status = feeds_status_load();
    $out = [];
    foreach ($loaded['feeds'] as $f) {
        $out[] = [
            'id'      => $f['id'],
            'service' => feeds_service($f['url']),
            'hint'    => feeds_hint($f['url']),
            'person'  => $f['person'],
            'icon'    => $f['icon'],
            'tag'     => $f['tag'],
            'label'   => $f['label'],
            'enabled' => $f['enabled'],
            'status'  => $status[$f['id']] ?? null,
        ];
    }
    return [
        'source'    => $loaded['source'],
        'updatedAt' => $loaded['updatedAt'],
        'rev'       => $loaded['rev'],
        'feeds'     => $out,
    ];
}
