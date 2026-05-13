#!/bin/bash
# ─────────────────────────────────────────────
#  Logistic CRM — one-command server update
#  Usage:  update   (after first-time setup)
#    or:   bash /var/www/logistic-crm/deploy/update.sh
# ─────────────────────────────────────────────

set -e
APP="/var/www/logistic-crm"
cd "$APP"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

step() { echo -e "\n${YELLOW}▶ $1${NC}"; }
ok()   { echo -e "${GREEN}✓ $1${NC}"; }
fail() { echo -e "${RED}✗ $1${NC}"; exit 1; }

START=$(date +%s)

# ── 1. Pull ───────────────────────────────────
step "Git pull..."
git pull origin main
ok "Code updated"

# ── 2. Python deps ───────────────────────────
step "Python dependencies..."
venv/bin/pip install -r requirements.txt -q
ok "Dependencies ready"

# ── 3. Migrations ────────────────────────────
step "Database migrations..."
venv/bin/python manage.py migrate --noinput
ok "Migrations done"

# ── 4. Static files ──────────────────────────
step "Collecting static files..."
venv/bin/python manage.py collectstatic --noinput -v 0
ok "Static files collected"

# ── 5. Frontend build ────────────────────────
step "Building frontend..."
cd frontend
npm ci --silent
npm run build
cd ..
ok "Frontend built"

# ── 6. Restart services ──────────────────────
step "Restarting services..."
systemctl restart daphne
systemctl restart celery
systemctl reload nginx
ok "Services restarted"

# ── Done ─────────────────────────────────────
END=$(date +%s)
ELAPSED=$((END - START))
echo -e "\n${GREEN}════════════════════════════════${NC}"
echo -e "${GREEN}  Done in ${ELAPSED}s — https://mmm.kg${NC}"
echo -e "${GREEN}════════════════════════════════${NC}"

# Quick health check
sleep 2
if systemctl is-active --quiet daphne; then
    ok "Daphne running"
else
    fail "Daphne NOT running — check: journalctl -u daphne -n 30"
fi
