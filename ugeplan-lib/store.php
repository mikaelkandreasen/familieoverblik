<?php
/**
 * store.php — datalaget.
 *
 * Dokumenter gemmes som JSON-filer under DATA_DIR, ét per sti:
 *   planner/2026-W35   aktiviteter, madplan, skjulte huskepunkter   (skærmen skriver)
 *   calendar/2026-W35  aftaler fra Outlook                          (PC'en skriver)
 *   aula/2026-W35      skema, ugebreve, huskepunkter                (PC'en skriver)
 *   ics/2026-W35       kampe, ferier m.m. fra ICS-feeds             (cron skriver)
 *   settings/…         recurring, birthdays, markets, weather, dated, important, notes, affald, visning, vaelger
 *
 * JSON afkodes som objekter, ikke assoc-arrays. Det er med vilje: PHP kan
 * ikke skelne et tomt objekt fra en tom liste, når begge er array(), og
 * så ville {"hiddenRem":{}} blive til {"hiddenRem":[]} ved næste skrivning.
 */

require_once __DIR__ . '/config.php';

const STORE_MAX_BYTES = 2_000_000;   // ét dokument. Ugebreve fylder typisk under 20 KB.

/** Er stien en gyldig, kendt dokumentsti? Afviser alt andet — også traversal. */
function store_valid_path(string $path): bool
{
    if (preg_match('#^(planner|calendar|aula|ics)/\d{4}-W\d{2}$#', $path)) {
        // Ugenumre går til 53. "2026-W00" og "2026-W99" er ikke uger.
        $wk = (int)substr($path, -2);
        return $wk >= 1 && $wk <= 53;
    }
    return (bool)preg_match('#^settings/(recurring|birthdays|markets|weather|dated|important|notes|affald|visning|vaelger)$#', $path);
}

function store_file(string $path): string
{
    return rtrim(DATA_DIR, '/') . '/' . $path . '.json';
}

/** Læs et dokument. Returnerer null hvis det ikke findes eller er ulæseligt. */
function store_read(string $path): ?object
{
    $f = store_file($path);
    if (!is_file($f)) return null;

    $raw = @file_get_contents($f);
    if ($raw === false || $raw === '') return null;

    $doc = json_decode($raw, false);
    if (!is_object($doc)) return null;         // halvskrevet eller manipuleret fil

    return $doc;
}

/**
 * Skriv et dokument atomisk.
 *
 * Der skrives til en midlertidig fil i samme mappe og omdøbes bagefter.
 * rename() er atomisk inden for samme filsystem, så en læser ser enten
 * den gamle eller den nye fil — aldrig en halvskreven.
 */
function store_write(string $path, $payload, bool $merge = false): object
{
    $f   = store_file($path);
    $dir = dirname($f);

    if (!is_dir($dir) && !@mkdir($dir, 0770, true) && !is_dir($dir)) {
        throw new RuntimeException("kan ikke oprette mappen $dir");
    }

    if ($merge) {
        $old = store_read($path);
        if ($old !== null && isset($old->payload)) {
            $payload = store_deep_merge($old->payload, $payload);
        }
    }

    $doc = (object)[
        'payload'   => $payload,
        'updatedAt' => date('c'),
    ];

    $json = json_encode($doc, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) {
        throw new RuntimeException('kunne ikke kode JSON: ' . json_last_error_msg());
    }
    if (strlen($json) > STORE_MAX_BYTES) {
        throw new RuntimeException('dokumentet er for stort (' . strlen($json) . ' bytes)');
    }

    $tmp = $f . '.' . getmypid() . '.tmp';
    if (@file_put_contents($tmp, $json, LOCK_EX) === false) {
        throw new RuntimeException("kan ikke skrive $tmp — tjek rettigheder på " . DATA_DIR);
    }
    if (!@rename($tmp, $f)) {
        @unlink($tmp);
        throw new RuntimeException("kan ikke omdøbe til $f");
    }
    @chmod($f, 0660);

    $doc->rev = store_rev_of($json);
    return $doc;
}

/**
 * Flet nyt ind i gammelt, som Firestores merge:true gjorde.
 *
 * Objekter flettes rekursivt. Alt andet — tal, strenge, LISTER — erstattes
 * helt. Det er med vilje: en dags aktiviteter er en liste, og den skal
 * kunne blive kortere, når man sletter et element.
 *
 * null som værdi sletter nøglen, så skærmen kan fjerne et felt igen.
 */
function store_deep_merge($old, $new)
{
    if (!is_object($old) || !is_object($new)) return $new;

    $out = clone $old;
    foreach (get_object_vars($new) as $k => $v) {
        if ($v === null)                      { unset($out->$k); continue; }
        if (is_object($v) && isset($out->$k) && is_object($out->$k)) {
            $out->$k = store_deep_merge($out->$k, $v);
        } else {
            $out->$k = $v;
        }
    }
    return $out;
}

/** Kort hash af dokumentets indhold. Skærmen poller på den. */
function store_rev_of(string $json): string
{
    return substr(hash('sha256', $json), 0, 12);
}

/** Nuværende rev uden at afkode dokumentet. null hvis det ikke findes. */
function store_rev(string $path): ?string
{
    $f = store_file($path);
    if (!is_file($f)) return null;
    $raw = @file_get_contents($f);
    return $raw === false ? null : store_rev_of($raw);
}

/** Ryd uge-dokumenter op, der er ældre end $keepWeeks. Returnerer antal slettede. */
function store_prune(int $keepWeeks = 8): int
{
    $cutoff = (new DateTimeImmutable("-{$keepWeeks} weeks"))->format('o-\WW');
    $n = 0;
    foreach (['planner', 'calendar', 'aula', 'ics'] as $coll) {
        foreach (glob(rtrim(DATA_DIR, '/') . "/$coll/*.json") ?: [] as $f) {
            $id = basename($f, '.json');
            // Strengsammenligning virker, fordi formatet er ÅÅÅÅ-Wuu med nul foran
            if (strcmp($id, $cutoff) < 0 && @unlink($f)) $n++;
        }
    }
    return $n;
}
