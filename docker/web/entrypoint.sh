#!/bin/sh
# Webcontainerens opstart: laver nøgler og config første gang (bootstrap.py), og starter så Apache som sædvanligt.
set -e
python3 /opt/familieoverblik/bootstrap.py start
exec docker-php-entrypoint "$@"
