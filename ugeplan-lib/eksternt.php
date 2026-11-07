<?php
/**
 * ugeplan-lib/eksternt.php — hent JSON fra en bestemt ekstern tjeneste, til joke.php og vejr.php.
 * Kun de værter, kaldet selv nævner, og kun https. Ingen omdirigering, tidsgrænse og størrelsesgrænse, ærligt User-Agent.
 * Browseren kalder aldrig tjenesterne selv: det er serveren (NUC'en), der henter, så ingen enhed i huset oplyser sin adresse.
 */

declare(strict_types=1);

/** @param list<string> $vaerter tilladte værtsnavne, små bogstaver. @return array<mixed> */
function ekstern_json(string $url, array $vaerter, int $timeout = 15): array
{
    $p = parse_url($url);
    if (!is_array($p) || ($p['scheme'] ?? '') !== 'https' || !in_array(strtolower((string)($p['host'] ?? '')), $vaerter, true)) {
        throw new RuntimeException('Adressen er ikke på en tilladt tjeneste.');
    }
    $headers = ['Accept: application/json', 'User-Agent: familieoverblik/1.0 (hjemmeserver; privat brug)'];
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true, CURLOPT_HTTPHEADER => $headers, CURLOPT_TIMEOUT => $timeout, CURLOPT_CONNECTTIMEOUT => 8,
            CURLOPT_FOLLOWLOCATION => false, CURLOPT_PROTOCOLS => CURLPROTO_HTTPS, CURLOPT_MAXFILESIZE => 2_000_000,
        ]);
        $raw = curl_exec($ch); $err = curl_error($ch); $code = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);
        if ($raw === false) throw new RuntimeException('Kunne ikke nå tjenesten: ' . ($err ?: 'ukendt fejl'));
    } else {
        $ctx = stream_context_create(['http' => ['method' => 'GET', 'header' => implode("\r\n", $headers), 'timeout' => $timeout, 'ignore_errors' => true, 'follow_location' => 0]]);
        $raw = @file_get_contents($url, false, $ctx);
        if ($raw === false) throw new RuntimeException('Kunne ikke nå tjenesten.');
        $code = 0;
        foreach ($http_response_header ?? [] as $h) if (preg_match('#^HTTP/\S+\s+(\d{3})#', $h, $m)) $code = (int)$m[1];
    }
    $d = json_decode((string)$raw, true);
    if ($code === 429) throw new RuntimeException('Tjenesten siger, at der er hentet for mange gange. Prøv igen om lidt.');
    if ($code >= 400 && !is_array($d)) throw new RuntimeException("Tjenesten svarede HTTP $code.");
    if (!is_array($d)) throw new RuntimeException('Tjenesten svarede ikke med JSON.');
    return $d;
}

/**
 * POST med JSON-krop til en bestemt ekstern tjeneste (bruges af oversaet.php). Samme begrænsninger som ekstern_json().
 * @param list<string> $vaerter @param array<mixed> $body @param list<string> $ekstraHeaders @return array<mixed>
 */
function ekstern_post_json(string $url, array $vaerter, array $body, array $ekstraHeaders = [], int $timeout = 60): array
{
    $p = parse_url($url);
    if (!is_array($p) || ($p['scheme'] ?? '') !== 'https' || !in_array(strtolower((string)($p['host'] ?? '')), $vaerter, true)) {
        throw new RuntimeException('Adressen er ikke på en tilladt tjeneste.');
    }
    if (!function_exists('curl_init')) throw new RuntimeException('PHP mangler curl-udvidelsen.');
    $json = json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) throw new RuntimeException('Kunne ikke lave forespørgslen.');
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true, CURLOPT_POSTFIELDS => $json, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => $timeout, CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_FOLLOWLOCATION => false, CURLOPT_PROTOCOLS => CURLPROTO_HTTPS, CURLOPT_MAXFILESIZE => 2_000_000,
        CURLOPT_HTTPHEADER => array_merge(['Content-Type: application/json', 'Accept: application/json', 'User-Agent: familieoverblik/1.0 (hjemmeserver; privat brug)'], $ekstraHeaders),
    ]);
    $raw = curl_exec($ch); $err = curl_error($ch); $code = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    if ($raw === false) throw new RuntimeException('Kunne ikke nå tjenesten: ' . ($err ?: 'ukendt fejl'));
    $d = json_decode((string)$raw, true);
    if ($code === 429) throw new RuntimeException('Tjenesten siger, at der er sendt for mange forespørgsler. Prøv igen om lidt.');
    if (!is_array($d)) throw new RuntimeException("Tjenesten svarede ikke med JSON (HTTP $code).");
    if ($code >= 400) {
        $m = is_array($d['error'] ?? null) ? (string)($d['error']['message'] ?? '') : '';
        throw new RuntimeException($m !== '' ? "Tjenesten afviste forespørgslen: $m" : "Tjenesten svarede HTTP $code.");
    }
    return $d;
}
