<?php
/**
 * ugeplan-lib/tegneserie.php — fælles kode for tegneserie.php (kortet og
 * indstillingerne) og hent.php (baggrundsjobbet "tegneserie").
 * Ingen adgangskontrol og ingen udskrift her: det ligger i filerne, der bruger den.
 *
 * Kræver, at feeds.php er indlæst (DATA_DIR og feeds_write_json()).
 *
 * ── Historik ───────────────────────────────────────────────────────────
 * Kortet viser GÅRSDAGENS strip, hentet fra datosiden https://www.gocomics.com/<navn>/ÅÅÅÅ/MM/DD. Samme adresse bruges til tidligere dage:
 * en dag hentes første gang, den bliver set (eller af baggrundsjobbet), og en dato ændrer sig ikke bagefter.
 *
 * Hver gang en strip hentes, gemmes dens dato, titel og adresser i
 * DATA_DIR/tegneserie/<navn>.json. Billedet selv gemmes IKKE: historikken
 * viser billederne fra GoComics' egen server, så der ligger ingen kopier
 * af striberne her. De seneste 90 dage beholdes; ældre slettes automatisk.
 * Historikken viser alle de seneste 90 dage. Dage, der ikke er hentet endnu, hentes, når de åbnes.
 */

declare(strict_types=1);

const TG_FILE      = DATA_DIR . '/private/tegneserie.json';
const TG_STANDARD  = 'calvinandhobbes';
const TG_SLUG_RE   = '/^[a-z0-9][a-z0-9-]{0,60}\z/';
const TG_CACHE_TTL = 604800;     // 7 døgn: en strip for en given dato ændrer sig ikke
const TG_HISTORIK_DAGE = 90;     // så mange dage tilbage gemmes
const TG_HISTORIK_MAX  = 200;    // og aldrig flere strips pr. tegneserie end det
const TG_HISTORIK_DIR  = DATA_DIR . '/tegneserie';
/** Billedet må kun komme fra disse værter. Alt andet (fx forsidens logo) afvises. */
const TG_BILLEDVAERTER = ['featureassets.gocomics.com', 'assets.gocomics.com', 'assets.amuniversal.com'];

// ─── Indstillinger ─────────────────────────────────────────────────
/** @return array{slug:string, enabled:bool} */
function tg_settings(): array
{
    $s = ['slug' => TG_STANDARD, 'enabled' => true];
    if (is_file(TG_FILE)) {
        $d = json_decode((string)@file_get_contents(TG_FILE), true);
        if (is_array($d)) {
            if (isset($d['slug']) && is_string($d['slug']) && preg_match(TG_SLUG_RE, $d['slug']) === 1) $s['slug'] = $d['slug'];
            if (isset($d['enabled'])) $s['enabled'] = (bool)$d['enabled'];
        }
    }
    return $s;
}

function tg_cut(string $s, int $n): string
{
    return preg_match('/^.{0,' . $n . '}/us', $s, $m) ? $m[0] : substr($s, 0, $n);
}

// ─── Listen over tegneserier (GoComics' A–Z-side) ──────────────────
const TG_AZ_URL   = 'https://www.gocomics.com/comics/a-to-z';
const TG_AZ_TTL   = 604800;     // 7 dage
const TG_AZ_MIN   = 20;         // færre end det er næppe en rigtig liste: siden har sikkert ændret form
const TG_AZ_SIDER = 8;          // højst så mange undersider (a-b, c-e …) hentes
/** Stier på GoComics, der ikke er en tegneserie (menuer, genrer, butik m.m.). */
const TG_AZ_RESERVERET = ['comics', 'popular', 'recommended', 'newest', 'genres', 'political', 'espanol', 'a-to-z', 'blog', 'shop', 'books',
    'calendars', 'prints', 'cart', 'checkout', 'signin', 'signup', 'sign-in', 'sign-up', 'search', 'about', 'advertise', 'contact', 'help',
    'terms', 'privacy', 'premium', 'account', 'profile', 'login', 'logout', 'author', 'authors', 'news', 'search', 'feeds', 'rss', 'mobile', 'app', 'apps'];

/** Første ikke-tomme tekst i linket: navnet står før forfatteren. */
function tg_az_navn(DOMElement $a, string $slug): string
{
    $xp = new DOMXPath($a->ownerDocument);
    foreach ($xp->query('.//text()', $a) ?: [] as $t) {
        $v = trim((string)preg_replace('/\s+/u', ' ', (string)$t->nodeValue));
        if ($v !== '') return tg_cut($v, 80);
    }
    foreach ($xp->query('.//img[@alt]', $a) ?: [] as $img) {
        $v = trim((string)$img->getAttribute('alt'));
        if ($v !== '') return tg_cut($v, 80);
    }
    return $slug;
}

/** Stien (med eventuel forespørgsel) i et link, hvis det peger på GoComics eller er relativt. Ellers null. */
function tg_az_sti(string $href): ?string
{
    $href = trim($href);
    if ($href === '' || $href[0] === '#') return null;
    if (preg_match('~^(?:https?:)?//([^/]+)(/.*)?$~i', $href, $m)) {
        if (strtolower($m[1]) !== 'www.gocomics.com' && strtolower($m[1]) !== 'gocomics.com') return null;
        $href = $m[2] ?? '/';
    }
    if ($href === '' || $href[0] !== '/') return null;
    $sti = (string)preg_replace('/#.*$/', '', $href);
    return $sti === '' ? '/' : $sti;
}

/**
 * Læs en A–Z-side. Returnerer tegneserierne (slug => navn) og stierne til undersiderne (a-b, c-e …).
 * Et link tæller som en tegneserie, hvis stien er ét enkelt navn (/calvinandhobbes) uden for de reserverede.
 * Siden er læst som tekst og ikke set som HTML: ændrer GoComics den, kan listen være tom (så meldes det).
 * @return array{serier: array<string,string>, undersider: list<string>}
 */
function tg_az_parse(string $html): array
{
    $serier = [];
    $under = [];
    if (trim($html) === '') return ['serier' => [], 'undersider' => []];
    $doc = new DOMDocument();
    $prev = libxml_use_internal_errors(true);
    $doc->loadHTML('<?xml encoding="utf-8" ?>' . $html);
    libxml_clear_errors();
    libxml_use_internal_errors($prev);
    foreach ($doc->getElementsByTagName('a') as $a) {
        $rå = tg_az_sti($a->getAttribute('href'));
        if ($rå === null) continue;
        if (str_starts_with($rå, '/comics/a-to-z') && rtrim($rå, '/') !== '/comics/a-to-z') { $under[$rå] = true; continue; }   // a-b, c-e … eller ?side=2
        $sti = (string)preg_replace('/\?.*$/', '', $rå);
        if (preg_match('~^/([a-z0-9][a-z0-9-]{0,60})/?$~', $sti, $m) !== 1) continue;
        $slug = $m[1];
        if (in_array($slug, TG_AZ_RESERVERET, true)) continue;
        $navn = tg_az_navn($a, $slug);
        if (!isset($serier[$slug]) || ($serier[$slug] === $slug && $navn !== $slug)) $serier[$slug] = $navn;
    }
    return ['serier' => $serier, 'undersider' => array_keys($under)];
}

/** Hent hele listen: A–Z-siden og dens undersider. Kaster en fejl, hvis der ikke findes en rimelig liste. @return list<array{slug:string, navn:string}> */
function tg_az_hent(): array
{
    $alle = [];
    $forste = tg_az_parse(tg_get(TG_AZ_URL));
    $alle += $forste['serier'];
    foreach (array_slice($forste['undersider'], 0, TG_AZ_SIDER) as $sti) {
        try { $alle += tg_az_parse(tg_get('https://www.gocomics.com' . $sti))['serier']; }
        catch (Throwable $e) { /* en underside, der ikke kan hentes, må ikke vælte resten */ }
    }
    if (count($alle) < TG_AZ_MIN) {
        throw new RuntimeException('Kunne ikke læse listen over tegneserier fra GoComics (fandt ' . count($alle) . '). Siden kan have ændret form. Skriv navnet selv.');
    }
    $ud = [];
    foreach ($alle as $slug => $navn) $ud[] = ['slug' => (string)$slug, 'navn' => (string)$navn];
    usort($ud, fn($a, $b) => strcasecmp($a['navn'], $b['navn']) ?: strcmp($a['slug'], $b['slug']));
    return $ud;
}

/** Listen med disk-cache (7 døgn). $force henter igen, men højst en gang i timen. @return array{data: list<array{slug:string, navn:string}>, stale:bool, at:int} */
function tg_az_cached(bool $force = false): array
{
    $fil = DATA_DIR . '/cache/gocomics-az.json';
    $cache = null;
    if (is_file($fil)) {
        $c = json_decode((string)@file_get_contents($fil), true);
        if (is_array($c) && isset($c['fetchedAt'], $c['data']) && is_array($c['data'])) $cache = $c;
    }
    $alder = $cache ? time() - (int)$cache['fetchedAt'] : PHP_INT_MAX;
    if ($cache && $alder <= ($force ? 3600 : TG_AZ_TTL)) return ['data' => $cache['data'], 'stale' => false, 'at' => (int)$cache['fetchedAt']];
    try {
        $ny = tg_az_hent();
        feeds_write_json($fil, ['fetchedAt' => time(), 'data' => $ny]);
        return ['data' => $ny, 'stale' => false, 'at' => time()];
    } catch (Throwable $e) {
        if ($cache) return ['data' => $cache['data'], 'stale' => true, 'at' => (int)$cache['fetchedAt']];
        throw $e;
    }
}

// ─── Datoer ────────────────────────────────────────────────────────
function tg_zone(): DateTimeZone
{
    return new DateTimeZone(defined('TIMEZONE') ? TIMEZONE : date_default_timezone_get());
}

/** Gårsdagens dato (ÅÅÅÅ-MM-DD) efter familiens tidszone. Gårsdagens strip findes altid, i dag kan mangle. */
function tg_i_gaar(): string
{
    return (new DateTimeImmutable('yesterday', tg_zone()))->format('Y-m-d');
}

/** Er det en rigtig dato fra og med for 90 dage siden til og med i går? */
function tg_dato_gyldig(string $dato): bool
{
    if (preg_match('/^(\d{4})-(\d{2})-(\d{2})\z/', $dato, $m) !== 1 || !checkdate((int)$m[2], (int)$m[3], (int)$m[1])) return false;
    $graense = (new DateTimeImmutable('today', tg_zone()))->modify('-' . TG_HISTORIK_DAGE . ' days')->format('Y-m-d');
    return $dato >= $graense && $dato <= tg_i_gaar();
}

/** https://www.gocomics.com/calvinandhobbes/2026/11/05 */
function tg_dato_url(string $slug, string $dato): string
{
    return 'https://www.gocomics.com/' . $slug . '/' . str_replace('-', '/', $dato);
}

// ─── Hent siden ────────────────────────────────────────────────────
function tg_get(string $url): string
{
    $headers = ['Accept: text/html', 'Accept-Language: en', 'User-Agent: familieoverblik/1.0 (hjemmeserver; privat brug)'];
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true, CURLOPT_HTTPHEADER => $headers,
            CURLOPT_TIMEOUT => 20, CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_FOLLOWLOCATION => true, CURLOPT_MAXREDIRS => 3, CURLOPT_REDIR_PROTOCOLS => CURLPROTO_HTTPS,
            CURLOPT_MAXFILESIZE => 3_000_000,
        ]);
        $raw  = curl_exec($ch);
        $err  = curl_error($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $slut = (string)curl_getinfo($ch, CURLINFO_EFFECTIVE_URL);
        curl_close($ch);
        if ($raw === false) throw new RuntimeException('Kunne ikke nå GoComics: ' . ($err ?: 'ukendt fejl'));
        if (strtolower((string)parse_url($slut, PHP_URL_HOST)) !== 'www.gocomics.com') throw new RuntimeException('GoComics sendte videre til en anden side.');
    } else {
        $ctx = stream_context_create(['http' => ['method' => 'GET', 'header' => implode("\r\n", $headers),
            'timeout' => 20, 'ignore_errors' => true, 'follow_location' => 1, 'max_redirects' => 3]]);
        $raw = @file_get_contents($url, false, $ctx);
        if ($raw === false) throw new RuntimeException('Kunne ikke nå GoComics.');
        $code = 0;
        foreach ($http_response_header ?? [] as $h) {
            if (preg_match('#^HTTP/\S+\s+(\d{3})#', $h, $m)) $code = (int)$m[1];   // sidste statuslinje gælder efter omdirigering
        }
    }
    if ($code === 404) throw new RuntimeException('Fandt ikke den tegneserie på GoComics. Tjek navnet (det efter gocomics.com/).');
    if ($code === 403 || $code === 429) throw new RuntimeException("GoComics afviste forespørgslen (HTTP $code), så striben kan ikke hentes automatisk.");
    if ($code >= 400) throw new RuntimeException("GoComics svarede HTTP $code.");
    return (string)$raw;
}

/** Indholdet af et meta-tag, uanset rækkefølgen af property/name og content. */
function tg_meta(string $html, string $prop): ?string
{
    $p = preg_quote($prop, '~');
    $m = [];
    if (preg_match('~<meta[^>]+(?:property|name)=["\']' . $p . '["\'][^>]*?\bcontent=["\']([^"\']*)["\']~i', $html, $m)
        || preg_match('~<meta[^>]+\bcontent=["\']([^"\']*)["\'][^>]*?(?:property|name)=["\']' . $p . '["\']~i', $html, $m)) {
        return html_entity_decode($m[1], ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }
    return null;
}

/**
 * Læs en side hos GoComics og find stripen på den.
 * $krav = den dato, siden skal være for (datosiden). Viser siden en anden dato, afvises den i stedet for at blive vist som den ønskede.
 * @return array{slug:string, titel:string, imageUrl:string, pageUrl:string, dato:string}
 */
function tg_hent_side(string $slug, string $url, ?string $krav): array
{
    $html = tg_get($url);

    $img = tg_meta($html, 'og:image');
    if (($img === null || $img === '')
        && preg_match('~<img[^>]+src=["\'](https://(?:featureassets|assets)\.gocomics\.com/[^"\']+)["\']~i', $html, $m)) {
        $img = html_entity_decode($m[1], ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }
    if ($img === null || $img === '') {
        throw new RuntimeException('Fandt ingen strip på siden. GoComics kan have ændret deres side, eller navnet er forkert.');
    }
    $host = strtolower((string)parse_url($img, PHP_URL_HOST));
    if (parse_url($img, PHP_URL_SCHEME) !== 'https' || !in_array($host, TG_BILLEDVAERTER, true)) {
        throw new RuntimeException('Fandt ingen strip på siden (billedet kom fra en uventet adresse).');
    }

    $titel = trim((string)(tg_meta($html, 'og:title') ?? ''));
    $titel = preg_replace('/\s*[|\x{2013}\x{2014}-]\s*GoComics.*$/iu', '', $titel) ?? $titel;

    $side = (string)(tg_meta($html, 'og:url') ?? '');
    if (!preg_match('~^https://www\.gocomics\.com/' . preg_quote($slug, '~') . '(/[0-9/]*)?$~', $side)) {
        $side = $url;
    }
    // Stripens egen dato: først fra adressen (…/2026/11/05), ellers fra titlen ("… for November 5, 2026").
    $dato = '';
    if (preg_match('~/(\d{4})/(\d{2})/(\d{2})/?$~', $side, $m) && checkdate((int)$m[2], (int)$m[3], (int)$m[1])) {
        $dato = "$m[1]-$m[2]-$m[3]";
    } elseif (preg_match('/\bfor\s+([A-Z][a-z]+ \d{1,2}, \d{4})/', $titel, $m)) {
        $dt = DateTimeImmutable::createFromFormat('!F j, Y', $m[1]);
        if ($dt !== false) $dato = $dt->format('Y-m-d');
    }
    if ($krav !== null) {
        if ($dato !== '' && $dato !== $krav) throw new RuntimeException("GoComics har ingen strip for $krav (siden viste $dato).");
        $dato = $krav;
    }
    return ['slug' => $slug, 'titel' => tg_cut($titel, 160), 'imageUrl' => $img, 'pageUrl' => $side, 'dato' => $dato];
}

/** Stripen for én bestemt dag (datosiden). Uden dato: i går. */
function tg_hent(string $slug, ?string $dato = null): array
{
    $dato ??= tg_i_gaar();
    if (!tg_dato_gyldig($dato)) throw new RuntimeException('Datoen skal være en af de seneste 90 dage, og højst i går.');
    return tg_hent_side($slug, tg_dato_url($slug, $dato), $dato);
}

/** Seneste strip på forsiden. Bruges kun, hvis gårsdagens datoside ikke findes (fx en tegneserie, der ikke udkommer hver dag). */
function tg_hent_forside(string $slug): array
{
    return tg_hent_side($slug, 'https://www.gocomics.com/' . $slug, null);
}

// ─── Historik ──────────────────────────────────────────────────────
function tg_hist_fil(string $slug): string
{
    return TG_HISTORIK_DIR . '/' . $slug . '.json';
}

/** Gemte strips som dato => {titel, imageUrl, pageUrl}, nyeste først, uden dem der er for gamle. */
function tg_hist_load(string $slug): array
{
    $dage = [];
    if (is_file(tg_hist_fil($slug))) {
        $d = json_decode((string)@file_get_contents(tg_hist_fil($slug)), true);
        if (is_array($d) && is_array($d['dage'] ?? null)) $dage = $d['dage'];
    }
    $graense = date('Y-m-d', strtotime('-' . TG_HISTORIK_DAGE . ' days'));
    $ud = [];
    foreach ($dage as $dato => $e) {
        if (!is_string($dato) || preg_match('/^\d{4}-\d{2}-\d{2}\z/', $dato) !== 1 || $dato < $graense || !is_array($e)) continue;
        $ud[$dato] = [
            'titel'    => (string)($e['titel'] ?? ''),
            'imageUrl' => (string)($e['imageUrl'] ?? ''),
            'pageUrl'  => (string)($e['pageUrl'] ?? ''),
        ];
    }
    krsort($ud);
    return array_slice($ud, 0, TG_HISTORIK_MAX, true);
}

/** Gem dagens strip i historikken. Samme dato overskrives, så et nyt kald ikke giver dubletter. */
function tg_hist_gem(string $slug, array $strip): void
{
    $dato = (string)($strip['dato'] ?? '');
    if (preg_match('/^\d{4}-\d{2}-\d{2}\z/', $dato) !== 1) $dato = date('Y-m-d');
    @mkdir(TG_HISTORIK_DIR, 0770, true);
    $fh = @fopen(TG_HISTORIK_DIR . '/.lock', 'c');
    if ($fh) flock($fh, LOCK_EX);
    try {
        $dage = tg_hist_load($slug);
        $dage[$dato] = [
            'titel'    => (string)($strip['titel'] ?? ''),
            'imageUrl' => (string)($strip['imageUrl'] ?? ''),
            'pageUrl'  => (string)($strip['pageUrl'] ?? ''),
        ];
        krsort($dage);
        feeds_write_json(tg_hist_fil($slug), ['slug' => $slug, 'dage' => array_slice($dage, 0, TG_HISTORIK_MAX, true), 'opdateret' => date('c')]);
    } finally {
        if ($fh) { flock($fh, LOCK_UN); fclose($fh); }
    }
}

/** @return list<array{slug:string, antal:int}>  tegneserier, der har en historik */
function tg_hist_serier(): array
{
    $ud = [];
    foreach (glob(TG_HISTORIK_DIR . '/*.json') ?: [] as $f) {
        $slug = basename($f, '.json');
        if (preg_match(TG_SLUG_RE, $slug) !== 1) continue;
        $n = count(tg_hist_load($slug));
        if ($n > 0) $ud[] = ['slug' => $slug, 'antal' => $n];
    }
    usort($ud, fn($a, $b) => $b['antal'] <=> $a['antal'] ?: strcmp($a['slug'], $b['slug']));
    return $ud;
}

/**
 * Hent med disk-cache pr. tegneserie OG dato. Uden dato: gårsdagens strip. Kan GoComics ikke nås, bruges det gemte (stale = true).
 * Findes gårsdagens datoside ikke (og intet er gemt), bruges forsidens seneste strip, med fallback = true.
 */
function tg_cached(string $slug, bool $force = false, ?string $dato = null): array
{
    $igaar = $dato === null;
    $dato ??= tg_i_gaar();
    $fil = DATA_DIR . '/cache/tegneserie-' . $slug . '-' . $dato . '.json';
    $cache = null;
    if (is_file($fil)) {
        $c = json_decode((string)@file_get_contents($fil), true);
        if (is_array($c) && isset($c['fetchedAt'], $c['data']) && is_array($c['data'])) $cache = $c;
    }
    if (!$force && $cache && (time() - (int)$cache['fetchedAt']) <= TG_CACHE_TTL) {
        return ['data' => $cache['data'], 'stale' => false, 'at' => (int)$cache['fetchedAt']];
    }
    try {
        try {
            $ny = tg_hent($slug, $dato);
        } catch (Throwable $e) {
            if (!$igaar || $cache) throw $e;
            try { $ny = tg_hent_forside($slug) + ['fallback' => true]; }
            catch (Throwable $e2) { throw $e; }
        }
        feeds_write_json($fil, ['fetchedAt' => time(), 'data' => $ny]);
        try { tg_hist_gem($slug, $ny); } catch (Throwable $e) { /* historikken må aldrig vælte kortet */ }
        return ['data' => $ny, 'stale' => false, 'at' => time()];
    } catch (Throwable $e) {
        if ($cache && !$force) return ['data' => $cache['data'], 'stale' => true, 'at' => (int)$cache['fetchedAt']];
        throw $e;
    }
}

/** Stripen for en bestemt dag: fra historikken, hvis den allerede er hentet, ellers hentes den nu og gemmes. */
function tg_dag(string $slug, string $dato): array
{
    if (!tg_dato_gyldig($dato)) throw new RuntimeException('Datoen skal være en af de seneste 90 dage, og højst i går.');
    $e = tg_hist_load($slug)[$dato] ?? null;
    if (is_array($e) && $e['imageUrl'] !== '') return ['dato' => $dato] + $e;
    $r = tg_cached($slug, false, $dato);
    $d = $r['data'];
    return ['dato' => $dato, 'titel' => (string)($d['titel'] ?? ''), 'imageUrl' => (string)($d['imageUrl'] ?? ''), 'pageUrl' => (string)($d['pageUrl'] ?? '')];
}

/** Alle de seneste 90 dage, nyeste først (fra i går). gemt = true, hvis stripen allerede er hentet. */
function tg_dage_liste(string $slug): array
{
    $gemt = tg_hist_load($slug);
    $d = new DateTimeImmutable(tg_i_gaar(), tg_zone());
    $ud = [];
    for ($k = 0; $k < TG_HISTORIK_DAGE; $k++) {
        $dato = $d->modify("-$k days")->format('Y-m-d');
        $ud[] = isset($gemt[$dato]) && $gemt[$dato]['imageUrl'] !== ''
            ? ['dato' => $dato, 'gemt' => true] + $gemt[$dato]
            : ['dato' => $dato, 'gemt' => false];
    }
    return $ud;
}
