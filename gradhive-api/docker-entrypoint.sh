#!/bin/sh
set -e
php artisan migrate --force
if [ "$SEED_DEMO_DATA" = "true" ]; then php artisan db:seed --force; fi
php artisan config:cache
php artisan route:cache
exec php artisan serve --host=0.0.0.0 --port="${PORT:-10000}"
