#!/bin/sh
set -e
CONFIG_PATH="/usr/share/nginx/html/assets/config.json"
KEY="${GOOGLE_MAPS_API_KEY:-}"
ESCAPED=$(printf '%s' "$KEY" | sed 's/\\/\\\\/g; s/"/\\"/g')
printf '{"googleMapsApiKey":"%s"}\n' "$ESCAPED" > "$CONFIG_PATH"
exec nginx -g 'daemon off;'