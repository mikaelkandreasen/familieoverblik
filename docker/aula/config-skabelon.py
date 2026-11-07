# ═══════════════════════════════════════════════════════════════════
#  aula-sync/config.py — læser hemmeligheder fra GitHub-hemmeligheder
#  (Settings → Secrets and variables → Actions). Her står kun det,
#  der ikke er hemmeligt: adresse, model og børnene.
# ═══════════════════════════════════════════════════════════════════
import os

# Adressen på din api.php (opsaet.py skriver den for dig).
API_BASE = "__API_BASE__"

# Model-id: slå det gældende op på console.anthropic.com.
# Opus er målt til at finde flest ægte huskepunkter; Haiku er ca. 6 gange billigere
# men oversprang punkter i testen. Se guiden før du vælger.
ANTHROPIC_MODEL = "claude-opus-5"

WRITE_TOKEN = os.environ["WRITE_TOKEN"]
MITID_USERNAME = os.environ["MITID_USERNAME"]
ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]

# Børnene. name skal matche FORNAVNET i Aula og id'et i public_html/config.js.
# calendar_id er kolonnen "ID" fra `aula profile` — IKKE "Profile".
# Rækkefølgen bestemmer, hvordan børnene står under hinanden på skærmen.
# <<CHILDREN-START>>
CHILDREN = [
    {"name": "Barn1", "calendar_id": 0},   # skole
    {"name": "Barn2", "calendar_id": 0},   # skole
]
# <<CHILDREN-END>>
