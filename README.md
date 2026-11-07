# Familieoverblik 3

Et familieoverblik til væg-skærm og telefon: skema og ugebreve fra Aula, kalendere, vejr, elpris, indkøb, bil, træning, tegneserie m.m.
Kører på din egen server (fx en NUC) i Docker og styres med Dockhand. **Ingen SSH.**

Start her: **[GUIDE-V3.md](GUIDE-V3.md)** (eller `FAMILIEOVERBLIK-v3-step-by-step.txt` til Notepad++).

- `compose.yaml`: stakken til Dockhand (fire containere, to volumes)
- `.github/workflows/billeder.yml`: bygger billederne og lægger dem i ghcr.io
- `docker/`: Dockerfiler og scripts (web med opstartsprogrammet `bootstrap.py`, aula, bil, cron, frameo)
- `public_html/`, `ugeplan-lib/`, `ugeplan-data/`: selve sidernes kode (skabeloner, der skrives ud ved opstart)
- `sprog/sprog.json` og `vaerktoej/sprog.py`: alle sprog i én fil og værktøjet til den
- `tests/`: prøver (de to Python-prøvesæt køres af workflowet inden billederne bygges)
