#!/usr/bin/env bash
# Adds the /monogame/ route to the live deeppixel.online nginx site. Run with sudo.
set -euo pipefail
SITE=/etc/nginx/sites-enabled/ultimate-fix  # a real file here, not a symlink
SNIPPET=/etc/nginx/snippets/monogame.conf
cp "$(dirname "$0")/monogame.nginx.conf" "$SNIPPET"
if ! grep -q "snippets/monogame.conf" "$SITE"; then
    cp "$SITE" "/etc/nginx/sites-available/ultimate-fix.bak-monogame-$(date +%Y%m%d-%H%M%S)"
    # Insert right before the existing "/game" block, inside the deeppixel.online server
    sed -i 's|^\(\s*\)# 5. MONOPOLY GAME|\1include /etc/nginx/snippets/monogame.conf;\n\n\1# 5. MONOPOLY GAME|' "$SITE"
fi
nginx -t
systemctl reload nginx
echo "OK: https://deeppixel.online/monogame/ now routes to the game server on :3000"
