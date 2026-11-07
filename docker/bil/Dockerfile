# Batteriniveau fra Hyundai. Bygges med  docker build -f docker/bil/Dockerfile .  fra projektets rod.
ARG PYTHON_VERSION=3.14
FROM python:${PYTHON_VERSION}-slim
ARG VERSION=dev
LABEL org.opencontainers.image.title="familieoverblik-bil" org.opencontainers.image.version="${VERSION}"
RUN apt-get update && apt-get install -y --no-install-recommends tzdata \
 && rm -rf /var/lib/apt/lists/* \
 && pip install --no-cache-dir hyundai-kia-connect-api==4.49.0
COPY docker/bil/bil_sync.py /app/bil_sync.py
ENV DATA_DIR=/data TZ=Europe/Copenhagen
WORKDIR /app
CMD ["python", "/app/bil_sync.py"]
