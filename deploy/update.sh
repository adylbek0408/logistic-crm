#!/bin/bash
# Run this on the server to pull and apply updates:
# bash /var/www/logistic-crm/deploy/update.sh

set -e
cd /var/www/logistic-crm

echo "==> Pulling latest code..."
git pull origin main

echo "==> Installing Python dependencies..."
venv/bin/pip install -r requirements.txt -q

echo "==> Running migrations..."
venv/bin/python manage.py migrate --noinput

echo "==> Collecting static files..."
venv/bin/python manage.py collectstatic --noinput

echo "==> Building frontend..."
cd frontend
npm ci --silent
npm run build
cd ..

echo "==> Restarting services..."
systemctl restart daphne
systemctl restart celery

echo "==> Done! Status:"
systemctl status daphne --no-pager -l
