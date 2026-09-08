#!/usr/bin/env bash
# ==============================================================================
# Votion Code — Node Sidecar Setup Script (powered by coder/code-server)
# ==============================================================================
# This script sets up the genuine coder/code-server daemon on your Pterodactyl node.
# It mounts all server files (/var/lib/pterodactyl/volumes) with root read/write
# access so all server files appear immediately in the VS Code explorer.
# It sets Dark Mode as default, disables Restricted Mode, and configures Nginx.
# ==============================================================================

set -e

PORT="${VOTION_PORT:-8443}"
VOLUMES_PATH="${PTERO_VOLUMES:-/var/lib/pterodactyl/volumes}"
CONFIG_DIR="/var/lib/votion-code/User"

echo "=========================================================="
echo "          Installing Votion Code (coder/code-server)      "
echo "=========================================================="

if ! command -v docker &> /dev/null; then
    echo "[ERROR] Docker is required but not installed."
    exit 1
fi

if [ ! -d "$VOLUMES_PATH" ]; then
    echo "[WARN] Directory $VOLUMES_PATH does not exist yet. Creating it..."
    mkdir -p "$VOLUMES_PATH"
fi

# Pre-seed Dark Mode theme and trust settings
mkdir -p "$CONFIG_DIR"
cat << 'EOF' > "$CONFIG_DIR/settings.json"
{
    "workbench.colorTheme": "Default Dark Modern",
    "workbench.preferredDarkColorTheme": "Default Dark Modern",
    "security.workspace.trust.enabled": false,
    "workbench.startupEditor": "none"
}
EOF
chmod -R 777 /var/lib/votion-code

echo "[1/4] Removing old container if exists..."
docker rm -f votion-code 2>/dev/null || true

echo "[2/4] Pulling latest coder/code-server image..."
docker pull codercom/code-server:latest

echo "[3/4] Starting Votion Code daemon on port $PORT with full disk access..."
docker run -d \
    --name votion-code \
    --restart always \
    -u 0:0 \
    -p "$PORT:8080" \
    -v "$VOLUMES_PATH:/home/coder/projects" \
    -v "$CONFIG_DIR:/root/.local/share/code-server/User" \
    -v "$CONFIG_DIR:/home/coder/.local/share/code-server/User" \
    -e CS_DISABLE_TELEMETRY=true \
    codercom/code-server:latest \
    --auth none \
    --disable-telemetry \
    --app-name "Votion Code"

echo "[4/4] Checking and configuring Nginx reverse proxy..."
NGINX_CONF=""
if [ -f "/etc/nginx/sites-available/pterodactyl.conf" ]; then
    NGINX_CONF="/etc/nginx/sites-available/pterodactyl.conf"
elif [ -f "/etc/nginx/sites-enabled/pterodactyl.conf" ]; then
    NGINX_CONF="/etc/nginx/sites-enabled/pterodactyl.conf"
elif [ -f "/etc/nginx/conf.d/pterodactyl.conf" ]; then
    NGINX_CONF="/etc/nginx/conf.d/pterodactyl.conf"
fi

if [ -n "$NGINX_CONF" ]; then
    if grep -q "location /votion-code/" "$NGINX_CONF"; then
        echo "  -> Nginx reverse proxy already configured in $NGINX_CONF"
    else
        echo "  -> Adding /votion-code/ reverse proxy to $NGINX_CONF..."
        cp "$NGINX_CONF" "${NGINX_CONF}.bak"
        sed -i "/location ~ \\\.php/i \\
    location /votion-code/ {\\
        proxy_pass http://127.0.0.1:${PORT}/;\\
        proxy_set_header Host \$host;\\
        proxy_set_header Upgrade \$http_upgrade;\\
        proxy_set_header Connection \"upgrade\";\\
        proxy_set_header Accept-Encoding gzip;\\
        proxy_read_timeout 86400s;\\
        proxy_send_timeout 86400s;\\
    }\\
" "$NGINX_CONF"

        if nginx -t 2>/dev/null; then
            systemctl reload nginx 2>/dev/null || service nginx reload 2>/dev/null || true
            echo "  -> Nginx successfully configured and reloaded!"
        else
            echo "  -> [WARN] Nginx syntax test failed. Restoring backup..."
            cp "${NGINX_CONF}.bak" "$NGINX_CONF"
        fi
    fi
else
    echo "  -> Note: Nginx config file for Pterodactyl not found automatically."
    echo "     If you use Nginx, add the following block manually inside your server { } block:"
    echo "       location /votion-code/ {"
    echo "           proxy_pass http://127.0.0.1:$PORT/;"
    echo "           proxy_set_header Host \$host;"
    echo "           proxy_set_header Upgrade \$http_upgrade;"
    echo "           proxy_set_header Connection \"upgrade\";"
    echo "       }"
fi

echo ""
echo "=========================================================="
echo "   Votion Code Engine successfully installed and running!"
echo "   Default Theme:     Dark Modern"
echo "   Restricted Mode:   Disabled (Full trust)"
echo "   Permissions:       Full Root (All volume files visible)"
echo "   Listening on port: $PORT"
echo "   Mount directory:   $VOLUMES_PATH -> /home/coder/projects"
echo "=========================================================="
