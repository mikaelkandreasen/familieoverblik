<?php
/**
 * login.php — lille PIN-gate foran siderne, med totrinsbekræftelse (TOTP), hvis den er slået til.
 *
 * .htaccess sender enhver, der ikke har den rigtige cookie, hertil (mod_rewrite,
 * fordi webhotellet mangler mod_authz_core — se note i .htaccess). Efter korrekt
 * PIN sættes en cookie i 180 dage, og brugeren sendes videre til den side, de
 * oprindeligt bad om. api.php, hent.php (cronjob) og service workeren rammes
 * slet ikke af dette — de har deres egen nøgle-baserede adgang og skal
 * blive ved med at virke uændret.
 */

declare(strict_types=1);

// Familiens fælles kode. Ikke tænkt som en stærk hemmelighed (4 cifre) —
// formålet er at stoppe et tilfældigt opsnappet link, ikke et målrettet angreb.
const SITE_PIN = '__PIN__';

// Cookiens værdi (GATE_TOKEN) ligger i ugeplan-lib/gate.php, fordi
// kalendere.php også skal kunne tjekke den. Den skal stadig være PRÆCIS den
// samme streng som i .htaccess' RewriteCond — ellers logger ingen ind.
// ugeplan-lib findes ved at gå opad, samme fremgangsmåde som i api.php.
$gate = null;
for ($d = __DIR__, $i = 0; $i < 5; $i++, $d = dirname($d)) {
    if (is_file($d . '/ugeplan-lib/gate.php')) { $gate = $d . '/ugeplan-lib/gate.php'; break; }
    if ($d === dirname($d)) break;
}
if ($gate === null) {
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    exit("ugeplan-lib/gate.php mangler — den skal uploades sammen med login.php\n");
}
require_once $gate;

$to = (string)($_GET['to'] ?? '');
$to = in_array($to, ['index.html', 'overblik.html', 'billeder.html', 'gaest-wifi.html', 'vaelger.html', 'backlog.html'], true) ? $to : 'overblik.html';

// ─── Totrinsbekræftelse (valgfri; slås til under Opsætning → Login og sikkerhed) ─────
// Efter korrekt PIN spørges der efter en kode fra en autentificeringsapp (eller en gendannelseskode), medmindre enheden er husket.
// Koden tjekkes af bootstrap.py (RFC 6238, ingen genbrug, gendannelseskoder bruges én gang). Her er kun cookies og trinene.
const TOTP_FIL   = DATA_DIR . '/private/totp.json';
const TOTP_PY    = '/opt/familieoverblik/bootstrap.py';
const TOTP_ENHED = 'ugeplan_enhed';

function login_totp(): ?array
{
    $d = is_file(TOTP_FIL) ? json_decode((string)@file_get_contents(TOTP_FIL), true) : null;
    return is_array($d) && ($d['aktiv'] ?? false) === true && is_string($d['enhedsnoegle'] ?? null) ? $d : null;
}
/** Ventende login: PIN er rigtig, koden mangler. Gyldig i 5 minutter. Underskrevet, så den ikke kan laves af andre. */
function login_ventende_lav(): string
{
    $t = (string)time();
    return $t . '.' . hash_hmac('sha256', 'pending|' . $t, GATE_TOKEN);
}
function login_ventende_ok(string $p): bool
{
    $dele = explode('.', $p, 2);
    if (count($dele) !== 2 || !ctype_digit($dele[0])) return false;
    $alder = time() - (int)$dele[0];
    return $alder >= -5 && $alder <= 300 && hash_equals(hash_hmac('sha256', 'pending|' . $dele[0], GATE_TOKEN), $dele[1]);
}
/** Husket enhed: udløb + underskrift med en nøgle, kun serveren kender. Ny enhedsnøgle (Log alle enheder ud) gør alle ugyldige. */
function login_enhed_lav(array $totp): string
{
    $u = (string)(time() + 86400 * (int)($totp['husk_dage'] ?? 90));
    return $u . '.' . hash_hmac('sha256', 'enhed|' . $u . '|' . $totp['enhedsnoegle'], GATE_TOKEN);
}
function login_enhed_ok(array $totp, string $c): bool
{
    $dele = explode('.', $c, 2);
    if (count($dele) !== 2 || !ctype_digit($dele[0]) || (int)$dele[0] <= time()) return false;
    return hash_equals(hash_hmac('sha256', 'enhed|' . $dele[0] . '|' . $totp['enhedsnoegle'], GATE_TOKEN), $dele[1]);
}
function login_kode_ok(string $kode): bool
{
    if (!is_file(TOTP_PY)) return false;
    $p = @proc_open(['python3', TOTP_PY, 'totp', 'tjek'], [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
    if (!is_resource($p)) return false;
    fwrite($pipes[0], json_encode(['kode' => substr($kode, 0, 40)]));
    fclose($pipes[0]);
    $ud = (string)stream_get_contents($pipes[1]); fclose($pipes[1]); fclose($pipes[2]); proc_close($p);
    $j = json_decode($ud, true);
    return is_array($j) && ($j['ok'] ?? false) === true;
}
function login_cookie(string $navn, string $vaerdi, int $udloeb): void
{
    setcookie($navn, $vaerdi, [
        'expires'  => $udloeb,
        'path'     => '/',
        'secure'   => true,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}
function login_faerdig(string $to): never
{
    login_cookie('ugeplan_ok', GATE_TOKEN, time() + 60 * 60 * 24 * 180);
    header('Location: ' . $to);
    exit;
}

$error = '';
$trin = 'pin';                                    // 'pin' eller 'kode'
$ventende = '';
$ip = (string)($_SERVER['REMOTE_ADDR'] ?? '');
$totp = login_totp();
$husk_dage = $totp ? (int)($totp['husk_dage'] ?? 90) : 0;
if ($_SERVER['REQUEST_METHOD'] === 'POST' && gate_spaerret($ip)) {
    // Koden prøves slet ikke, mens der er spærret — heller ikke den rigtige.
    // Ellers kunne et script bare fortsætte og se efter svaret.
    http_response_code(429);
    $error = 'For mange forkerte forsøg. Vent et kvarter, og prøv igen.';
} elseif ($_SERVER['REQUEST_METHOD'] === 'POST' && $totp && isset($_POST['kode'])) {
    // Andet trin. Højst 5 forkerte koder pr. 15 minutter (eget loft, så PIN-forsøg ikke tæller med).
    if (!login_ventende_ok((string)($_POST['ventende'] ?? ''))) {
        $error = 'Der er gået for lang tid. Skriv PIN-koden igen.';
    } elseif (gate_spaerret($ip, 'totp', 5)) {
        http_response_code(429);
        $error = 'For mange forkerte koder. Vent et kvarter, og prøv igen.';
        $trin = 'kode'; $ventende = login_ventende_lav();
    } elseif (login_kode_ok((string)$_POST['kode'])) {
        gate_rigtig($ip); gate_rigtig($ip, 'totp');
        if (!empty($_POST['husk'])) login_cookie(TOTP_ENHED, login_enhed_lav($totp), time() + 86400 * $husk_dage);
        login_faerdig($to);
    } else {
        gate_forkert($ip, 'totp');
        $error = 'Forkert kode.';
        $trin = 'kode'; $ventende = login_ventende_lav();
    }
} elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $pin = (string)($_POST['pin'] ?? '');
    if (hash_equals(SITE_PIN, $pin)) {
        gate_rigtig($ip);
        if ($totp && !login_enhed_ok($totp, (string)($_COOKIE[TOTP_ENHED] ?? ''))) {
            $trin = 'kode'; $ventende = login_ventende_lav();           // PIN er rigtig; nu mangler koden fra appen
        } else {
            login_faerdig($to);
        }
    } else {
        gate_forkert($ip);
        $error = 'Forkert kode.';
    }
}

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
?>
<!doctype html>
<html lang="da">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ugeplan — log ind</title>
<style>
  :root { color-scheme: light dark; }
  body {
    margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    background: #FBFAF6; font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  form {
    background: #fff; border-radius: 16px; padding: 2rem 2.5rem; box-shadow: 0 2px 16px rgba(0,0,0,.08);
    display: flex; flex-direction: column; gap: 1rem; width: min(90vw, 320px);
  }
  h1 { font-size: 1.1rem; margin: 0 0 .25rem; color: #12302C; }
  input[type=password] {
    font-size: 1.5rem; letter-spacing: .3em; text-align: center; padding: .6rem;
    border: 1px solid #ccc; border-radius: 8px;
  }
  button {
    font-size: 1rem; padding: .6rem; border: none; border-radius: 8px;
    background: #12302C; color: #fff; cursor: pointer;
  }
  .err { color: #b3261e; font-size: .9rem; margin: 0; }
  .hjaelp { font-size: .85rem; margin: 0; color: #555; }
  input.kode { font-size: 1.4rem; letter-spacing: .15em; text-align: center; padding: .6rem; border: 1px solid #ccc; border-radius: 8px; }
  .husk { font-size: .9rem; display: flex; gap: .5rem; align-items: center; }
</style>
</head>
<body>
<form method="post" autocomplete="off">
<?php if ($trin === 'kode'): ?>
  <h1>Kode fra din app</h1>
  <?php if ($error !== ''): ?><p class="err"><?= htmlspecialchars($error, ENT_QUOTES, 'UTF-8') ?></p><?php endif; ?>
  <p class="hjaelp">Skriv den 6-cifrede kode fra din autentificeringsapp, eller en gendannelseskode.</p>
  <input type="hidden" name="ventende" value="<?= htmlspecialchars($ventende, ENT_QUOTES, 'UTF-8') ?>">
  <input type="text" name="kode" class="kode" autocomplete="one-time-code" inputmode="text" maxlength="12" autofocus required>
  <label class="husk"><input type="checkbox" name="husk" value="1" checked> Husk denne enhed i <?= (int)$husk_dage ?> dage</label>
  <button type="submit">Log ind</button>
<?php else: ?>
  <h1>Familiens kode</h1>
  <?php if ($error !== ''): ?><p class="err"><?= htmlspecialchars($error, ENT_QUOTES, 'UTF-8') ?></p><?php endif; ?>
  <input type="password" name="pin" inputmode="numeric" pattern="[0-9]*" maxlength="8" autofocus required>
  <button type="submit">Log ind</button>
<?php endif; ?>
</form>
</body>
</html>
