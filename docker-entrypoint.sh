#!/bin/sh
set -e
CONFIG_PATH="/usr/share/nginx/html/assets/config.json"
MAPS_KEY="${GOOGLE_MAPS_API_KEY:-}"
CLIENT_ID="${GOOGLE_CLIENT_ID:-}"
escape_json() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}
MAPS_ESC=$(escape_json "$MAPS_KEY")
CLIENT_ESC=$(escape_json "$CLIENT_ID")
printf '{"googleMapsApiKey":"%s","googleClientId":"%s"}\n' "$MAPS_ESC" "$CLIENT_ESC" > "$CONFIG_PATH"
exec nginx -g 'daemon off;'
