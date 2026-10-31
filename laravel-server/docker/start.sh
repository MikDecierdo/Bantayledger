#!/bin/sh
# Container start-up for Render (see ../Dockerfile).
set -e

# Render tells the service which port to listen on.
PORT="${PORT:-10000}"
sed -i "s/^Listen 80$/Listen ${PORT}/" /etc/apache2/ports.conf
sed -i "s/<VirtualHost \*:80>/<VirtualHost *:${PORT}>/" /etc/apache2/sites-available/000-default.conf

# Aiven (and most hosted MySQL) needs TLS with its own CA certificate. Render
# has no file upload for secrets, so the certificate's text comes in an env var.
if [ -n "$MYSQL_SSL_CA_PEM" ]; then
  printf '%s\n' "$MYSQL_SSL_CA_PEM" > /tmp/db-ca.pem
  export MYSQL_ATTR_SSL_CA=/tmp/db-ca.pem
fi

php artisan storage:link >/dev/null 2>&1 || true
php artisan config:cache
php artisan route:cache

# New migrations (only the ones not yet run) on every start.
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  php artisan migrate --force
fi

chown -R www-data:www-data storage bootstrap/cache
exec apache2-foreground
