// ═══════════════════════════════════════════════════════════════════
//  Udfyld én gang (opsaet.py gør det for dig). Overskriv ALDRIG denne fil,
//  når du henter en ny version af index.html eller overblik.html.
// ═══════════════════════════════════════════════════════════════════

// Læsenøglen fra ugeplan-lib/config.php. Den ligger her i klartekst og kan
// læses af enhver, der kender adressen — derfor må den KUN være læsenøglen.
// Skrivenøglen hører hjemme i GitHub-hemmeligheder og ingen andre steder.
export const API_KEY = "__READ_TOKEN__";

// Familiens medlemmer. Rækkefølgen bestemmer knapperne i dialogen.
// id skal være med små bogstaver. For børn i skole SKAL id matche
// fornavnet, som det står i Aula — ellers får de ikke deres farve.
// Der er plads til højst 12 personer ud over "Alle" (4 voksne og 8 børn; --p-1 til --p-12 i CSS).
// <<PEOPLE-START>>
export const PEOPLE = [
  { id: "alle",    name: "Alle",    color: "var(--p-alle)" },
  { id: "voksen1", name: "Voksen1", color: "var(--p-1)"    },
  { id: "voksen2", name: "Voksen2", color: "var(--p-2)"    },
  { id: "barn1",   name: "Barn1",   color: "var(--p-3)"    },
  { id: "barn2",   name: "Barn2",   color: "var(--p-4)"    },
  { id: "barn3",   name: "Barn3",   color: "var(--p-5)"    }
];
// <<PEOPLE-END>>

// ── Valgfrit ────────────────────────────────────────────────────────
// Hvor api.php ligger, set fra index.html. Standard er samme mappe.
// export const API_BASE = "api.php";

// Rækkefølgen af indeks under "Marked". Skal matche label i config.php.
// export const MARKET_ORDER = ["C25", "S&P 500", "Nasdaq"];
