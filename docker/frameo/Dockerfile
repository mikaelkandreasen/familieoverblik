# EKSPERIMENT: henter billeder fra en Frameo-ramme over ADB. Bygges med  docker build -f docker/frameo/Dockerfile .
FROM alpine:3
ARG VERSION=dev
LABEL org.opencontainers.image.title="familieoverblik-frameo" org.opencontainers.image.version="${VERSION}"
RUN apk add --no-cache android-tools
COPY docker/frameo/frameo-sync.sh /frameo-sync.sh
CMD ["sh", "/frameo-sync.sh"]
