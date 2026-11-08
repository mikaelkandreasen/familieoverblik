# Aula-synkroniseringen. Bygges med  docker build -f docker/aula/Dockerfile .  fra projektets rod.
# aula 1.x kræver Python 3.14 eller nyere.
ARG PYTHON_VERSION=3.14
FROM python:${PYTHON_VERSION}-slim
ARG VERSION=dev
LABEL org.opencontainers.image.title="familieoverblik-aula" org.opencontainers.image.version="${VERSION}"
RUN apt-get update && apt-get install -y --no-install-recommends tzdata \
 && rm -rf /var/lib/apt/lists/* \
 && pip install --no-cache-dir aula==1.16.0
# Tilføjelse, der klarer rolle- og bekræftelsessiden efter MitID (selected-aktoer = KONTAKT og ACCEPT)
COPY docker/aula/patch/ /patch/
ENV PYTHONPATH=/patch:/data/private/aula-config AULA_STATE_DIR=/data/private/aula-state TZ=Europe/Copenhagen
COPY docker/aula/Sync-Aula.py docker/aula/loop.sh /app/
WORKDIR /app
CMD ["sh", "/app/loop.sh"]
