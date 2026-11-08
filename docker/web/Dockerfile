# Webcontaineren: Apache + PHP med siderne og alle endpoints. Bygges med  docker build -f docker/web/Dockerfile .  fra projektets rod.
FROM php:8.3-apache
ARG VERSION=dev
LABEL org.opencontainers.image.title="familieoverblik-web" org.opencontainers.image.version="${VERSION}" org.opencontainers.image.source="https://github.com/"
RUN apt-get update && apt-get install -y --no-install-recommends python3 tzdata \
 && rm -rf /var/lib/apt/lists/* \
 && a2enmod rewrite headers \
 && sed -i 's/AllowOverride None/AllowOverride All/' /etc/apache2/apache2.conf \
 && echo "date.timezone=Europe/Copenhagen" > /usr/local/etc/php/conf.d/tz.ini \
 && printf "upload_max_filesize=20M\npost_max_size=24M\n" > /usr/local/etc/php/conf.d/upload.ini
# Skabelonerne (siderne og configfilerne med pladsholdere). De skrives ud til /var/www ved hver opstart af bootstrap.py.
COPY public_html /opt/familieoverblik/skabelon/html
COPY ugeplan-lib /opt/familieoverblik/skabelon/lib
COPY ugeplan-data /opt/familieoverblik/skabelon/data
COPY docker/aula/config-skabelon.py /opt/familieoverblik/skabelon/aula-config.py
COPY CHANGELOG.md VERSION /opt/familieoverblik/skabelon/
COPY docker/web/bootstrap.py docker/web/ics.py docker/web/entrypoint.sh /opt/familieoverblik/
RUN chmod +x /opt/familieoverblik/entrypoint.sh
# Alt, der er dit (data, billeder, nøgler, indstillinger), ligger i dette ene volume
VOLUME /var/www/ugeplan-data
ENTRYPOINT ["/opt/familieoverblik/entrypoint.sh"]
CMD ["apache2-foreground"]
