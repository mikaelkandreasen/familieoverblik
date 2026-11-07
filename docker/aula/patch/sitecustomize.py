# Læses automatisk af Python ved start (PYTHONPATH=/patch i Aula-billedet).
# Slå fra med AULA_LOGIN_PATCH=0 i lokal/.env.
import os
import sys

if os.environ.get("AULA_LOGIN_PATCH", "1") != "0":
    try:
        import aula_login_forms
        aula_login_forms.install()
    except ImportError:
        pass                      # httpx findes ikke i denne Python (fx pip selv): intet at lægge sig i
    except Exception as e:        # aldrig lad et hjælpescript vælte Python
        print(f"aula-login: tilføjelsen kunne ikke aktiveres ({type(e).__name__}: {e})", file=sys.stderr)
