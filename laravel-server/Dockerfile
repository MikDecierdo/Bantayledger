# BantayLedger API — container image for Render (free web service).
#
# Render has no PHP runtime, so the API runs as a Docker service: Apache +
# PHP 8.3 serving Laravel's public/ folder on the port Render provides.
# Start-up (docker/start.sh) writes the database CA certificate, caches the
# config and runs any new migrations before Apache starts.

FROM php:8.3-apache

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      git unzip ca-certificates libzip-dev libpng-dev libjpeg62-turbo-dev libfreetype6-dev libonig-dev \
 && docker-php-ext-configure gd --with-freetype --with-jpeg \
 && docker-php-ext-install pdo_mysql mbstring zip gd bcmath \
 && a2enmod rewrite headers \
 && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# Serve Laravel's public/ folder and let its .htaccess route every request.
ENV APACHE_DOCUMENT_ROOT=/var/www/html/public
RUN sed -ri -e 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/sites-available/*.conf \
 && sed -ri -e 's!/var/www/!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/apache2.conf /etc/apache2/conf-available/*.conf \
 && sed -ri -e 's/AllowOverride None/AllowOverride All/g' /etc/apache2/apache2.conf

WORKDIR /var/www/html

# Dependencies first, so code changes don't reinstall them.
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist --no-interaction --no-progress

COPY . .
RUN composer dump-autoload --optimize --no-dev \
 && mkdir -p storage/framework/cache storage/framework/sessions storage/framework/views storage/logs bootstrap/cache \
 && chown -R www-data:www-data storage bootstrap/cache \
 && chmod +x docker/start.sh

CMD ["docker/start.sh"]
