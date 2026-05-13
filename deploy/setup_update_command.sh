#!/bin/bash
# Run this ONCE on the server after first deploy.
# After that, just type:  update

APP="/var/www/logistic-crm"

chmod +x "$APP/deploy/update.sh"
ln -sf "$APP/deploy/update.sh" /usr/local/bin/update

echo "Done! Now just type:  update"
