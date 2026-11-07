FROM alpine:3
ARG VERSION=dev
LABEL org.opencontainers.image.title="familieoverblik-cron" org.opencontainers.image.version="${VERSION}"
RUN apk add --no-cache curl
COPY docker/cron/cron.sh /cron.sh
CMD ["sh", "/cron.sh"]
