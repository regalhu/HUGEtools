#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-18089}"
ARCHIVE="${1:-/tmp/hugetools-static.tar.gz}"
WEB_ROOT="${WEB_ROOT:-/var/www/hugetools}"
NGINX_CONF="${NGINX_CONF:-/etc/nginx/conf.d/hugetools-mainland.conf}"

if [[ -z "${ALLOWED_IPS:-}" ]]; then
  echo "ERROR: set ALLOWED_IPS first, for example:" >&2
  echo "ALLOWED_IPS='1.2.3.4,5.6.7.8' PORT=18089 bash $0 $ARCHIVE" >&2
  exit 1
fi

if [[ "$PORT" == "80" || "$PORT" == "443" || "$PORT" == "8080" || "$PORT" == "8443" ]]; then
  echo "ERROR: Tianyi Cloud default policy may block port $PORT. Use a high custom port such as 18089." >&2
  exit 1
fi

if [[ ! -f "$ARCHIVE" ]]; then
  echo "ERROR: archive not found: $ARCHIVE" >&2
  exit 1
fi

command -v nginx >/dev/null 2>&1 || {
  echo "ERROR: nginx is not installed or not in PATH." >&2
  exit 1
}

install -d -m 0755 "$WEB_ROOT"
tar -xzf "$ARCHIVE" -C "$WEB_ROOT"
chown -R root:root "$WEB_ROOT"
find "$WEB_ROOT" -type d -exec chmod 0755 {} \;
find "$WEB_ROOT" -type f -exec chmod 0644 {} \;

ALLOW_LINES=""
IFS=',' read -ra IPS <<< "$ALLOWED_IPS"
for raw_ip in "${IPS[@]}"; do
  ip="$(echo "$raw_ip" | xargs)"
  [[ -z "$ip" ]] && continue
  ALLOW_LINES+="        allow $ip;"$'\n'
done

if [[ -z "$ALLOW_LINES" ]]; then
  echo "ERROR: ALLOWED_IPS did not contain any usable IP." >&2
  exit 1
fi

cat > "$NGINX_CONF" <<EOF_CONF
server {
    listen ${PORT};
    server_name _;

    location = /hugetools {
        return 301 /hugetools/;
    }

    location /hugetools/ {
${ALLOW_LINES}        deny all;

        add_header Cache-Control "no-cache, must-revalidate" always;
        root /var/www;
        index index.html;
        try_files \$uri \$uri/ /hugetools/index.html;
    }

    location /hugetools/data/ {
${ALLOW_LINES}        deny all;

        root /var/www;
        try_files \$uri =404;
        add_header Cache-Control "public, max-age=0, must-revalidate";
    }
}
EOF_CONF

if command -v ufw >/dev/null 2>&1; then
  for raw_ip in "${IPS[@]}"; do
    ip="$(echo "$raw_ip" | xargs)"
    [[ -z "$ip" ]] && continue
    ufw allow from "$ip" to any port "$PORT" proto tcp || true
  done
fi

nginx -t
systemctl reload nginx || systemctl restart nginx

echo "OK: deployed to http://113.249.104.188:${PORT}/hugetools/"
echo "Allowed IPs: ${ALLOWED_IPS}"
