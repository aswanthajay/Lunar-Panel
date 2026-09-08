#!/usr/bin/env bash
# ==============================================================================
# Votion Code — Node Sidecar Setup Script (powered by coder/code-server)
# ==============================================================================
# Features:
#   - Genuine coder/code-server daemon on port 8443 (native Wings SSL support)
#   - Direct root disk access to server files (/var/lib/pterodactyl/volumes)
#   - Live server console streaming via Docker logs (auto-runs on folder open)
#   - Instant file synchronization directly with Pterodactyl servers
#   - Case-insensitive & short-ID symlinks for seamless URL routing
#   - Dark Modern theme default, workspace trust enabled, no workspace buttons
# ==============================================================================

set -e

PORT="${VOTION_PORT:-8443}"
CONFIG_DIR="/var/lib/votion-code/User"

echo "=========================================================="
echo "          Installing Votion Code (coder/code-server)      "
echo "=========================================================="

if ! command -v docker &> /dev/null; then
    echo "[ERROR] Docker is required but not installed."
    exit 1
fi

DOCKER_BIN=$(command -v docker 2>/dev/null || echo "/usr/bin/docker")

# 1. Auto-detect or accept custom volume directory
VOLUMES_PATH=""
if [ -n "$1" ] && [ -d "$1" ]; then
    VOLUMES_PATH="$1"
    echo "[i] Using custom volume directory passed as argument: $VOLUMES_PATH"
elif [ -n "$PTERO_VOLUMES" ] && [ -d "$PTERO_VOLUMES" ]; then
    VOLUMES_PATH="$PTERO_VOLUMES"
fi

if [ -z "$VOLUMES_PATH" ]; then
    for cfg in "/etc/reviactyl/config.yml" "/etc/pterodactyl/config.yml"; do
        if [ -f "$cfg" ]; then
            CONF_DATA=$(grep -E '^[[:space:]]*data:' "$cfg" | head -n 1 | awk '{print $2}' | tr -d '"' | tr -d "'")
            if [ -n "$CONF_DATA" ] && [ -d "$CONF_DATA" ]; then
                VOLUMES_PATH="$CONF_DATA"
                echo "[i] Auto-detected volume directory from $cfg: $VOLUMES_PATH"
                break
            fi
        fi
    done
fi

if [ -z "$VOLUMES_PATH" ]; then
    for candidate in \
        "/var/lib/reviactyl/volumes" \
        "/var/lib/pterodactyl/volumes" \
        "/srv/daemon-data"; do
        if [ -d "$candidate" ] && [ -n "$(ls -A "$candidate" 2>/dev/null)" ]; then
            VOLUMES_PATH="$candidate"
            break
        elif [ -d "$candidate" ]; then
            VOLUMES_PATH="$candidate"
        fi
    done
fi

[ -z "$VOLUMES_PATH" ] && VOLUMES_PATH="/var/lib/pterodactyl/volumes"
[ ! -d "$VOLUMES_PATH" ] && mkdir -p "$VOLUMES_PATH"

echo "[i] Using volumes directory: $VOLUMES_PATH"

# Cross-link reviactyl and pterodactyl volumes directories so all paths stay valid
if [ "$VOLUMES_PATH" = "/var/lib/reviactyl/volumes" ]; then
    mkdir -p /var/lib/pterodactyl 2>/dev/null || true
    ln -sfn /var/lib/reviactyl/volumes /var/lib/pterodactyl/volumes 2>/dev/null || true
    echo "  -> Linked /var/lib/pterodactyl/volumes -> /var/lib/reviactyl/volumes"
elif [ "$VOLUMES_PATH" = "/var/lib/pterodactyl/volumes" ]; then
    mkdir -p /var/lib/reviactyl 2>/dev/null || true
    ln -sfn /var/lib/pterodactyl/volumes /var/lib/reviactyl/volumes 2>/dev/null || true
    echo "  -> Linked /var/lib/reviactyl/volumes -> /var/lib/pterodactyl/volumes"
fi

# Count server volumes
SERVER_COUNT=0
for sdir in "$VOLUMES_PATH"/*; do
    if [ -d "$sdir" ] && [ ! -L "$sdir" ]; then
        base=$(basename "$sdir")
        if [ "$base" != ".vscode" ]; then
            SERVER_COUNT=$((SERVER_COUNT + 1))
        fi
    fi
done

if [ "$SERVER_COUNT" -eq 0 ]; then
    echo ""
    echo "========================================================================"
    echo "  [⚠️ ATTENTION: 0 SERVER VOLUMES FOUND ON THIS MACHINE]"
    echo "  This machine has no server volumes in: $VOLUMES_PATH"
    echo "  Server files are stored on your Wings node, not the panel VPS."
    echo "========================================================================"
    echo ""
else
    echo "  [✓] Found $SERVER_COUNT server volume(s) on this machine!"
fi

# 2. Pre-seed Global Dark Mode theme, trust settings & fallback workspace
mkdir -p "$CONFIG_DIR"
cat << 'EOF' > "$CONFIG_DIR/settings.json"
{
    "workbench.colorTheme": "Default Dark Modern",
    "workbench.preferredDarkColorTheme": "Default Dark Modern",
    "security.workspace.trust.enabled": false,
    "workbench.startupEditor": "none",
    "workbench.tips.enabled": false,
    "window.restoreWindows": "all",
    "files.autoSave": "afterDelay",
    "workbench.colorCustomizations": {
        "editor.background": "#000000",
        "sideBar.background": "#050505",
        "activityBar.background": "#000000",
        "statusBar.background": "#0a0a0a",
        "titleBar.activeBackground": "#050505"
    }
}
EOF

cat << 'EOF' > "$CONFIG_DIR/coder.json"
{
    "query": {},
    "lastOpened": {
        "folder": "/home/coder/projects"
    }
}
EOF
chmod -R 777 /var/lib/votion-code

# 3. Create Symlinks, Remove Stale Workspaces, and Setup Live Console Stream in each server volume
echo "[i] Configuring server volumes and live console streaming in $VOLUMES_PATH..."
for sdir in "$VOLUMES_PATH"/*; do
    if [ -d "$sdir" ] && [ ! -L "$sdir" ]; then
        base=$(basename "$sdir")
        if [ "$base" = ".vscode" ]; then
            continue
        fi

        lower=$(echo "$base" | tr '[:upper:]' '[:lower:]')
        upper=$(echo "$base" | tr '[:lower:]' '[:upper:]')
        short=$(echo "$lower" | cut -c1-8)

        # Ensure server folder is readable/writable
        chmod 755 "$sdir" 2>/dev/null || true

        # Remove stale workspace file that caused the 'Open Workspace' button
        rm -f "$sdir/.votion.code-workspace" 2>/dev/null || true

        # Create lowercase symlink if needed
        if [ "$base" != "$lower" ]; then
            ln -sfn "$sdir" "$VOLUMES_PATH/$lower" 2>/dev/null || true
            echo "  -> Linked lowercase: $lower -> $base"
        fi
        # Create uppercase symlink if needed
        if [ "$base" != "$upper" ]; then
            ln -sfn "$sdir" "$VOLUMES_PATH/$upper" 2>/dev/null || true
            echo "  -> Linked uppercase: $upper -> $base"
        fi
        # Create short ID symlink if valid UUID length (>= 32)
        if [ ${#base} -ge 32 ]; then
            ln -sfn "$sdir" "$VOLUMES_PATH/$short" 2>/dev/null || true
            echo "  -> Linked short ID: $short -> $base"
        fi

        # Pre-seed .vscode directory
        mkdir -p "$sdir/.vscode" 2>/dev/null || true

        # .vscode/settings.json
        cat << EOF > "$sdir/.vscode/settings.json" 2>/dev/null || true
{
    "workbench.colorTheme": "Default Dark Modern",
    "workbench.preferredDarkColorTheme": "Default Dark Modern",
    "security.workspace.trust.enabled": false,
    "terminal.integrated.cwd": "/home/coder/projects/${lower}",
    "workbench.colorCustomizations": {
        "editor.background": "#000000",
        "sideBar.background": "#050505",
        "activityBar.background": "#000000",
        "statusBar.background": "#0a0a0a",
        "titleBar.activeBackground": "#050505"
    }
}
EOF

        # .vscode/tasks.json — Streams live Pterodactyl server console into VS Code terminal
        cat << EOF > "$sdir/.vscode/tasks.json" 2>/dev/null || true
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "📡 Server Console",
            "detail": "Live output stream of the Pterodactyl server",
            "type": "shell",
            "command": "docker logs -f --tail 100 ${lower} 2>&1 || docker logs -f --tail 100 ${base} 2>&1 || echo 'Server container is offline or starting...'",
            "presentation": {
                "reveal": "always",
                "panel": "dedicated",
                "group": "server-output",
                "clear": true,
                "echo": false,
                "showReuseMessage": false
            },
            "runOptions": {
                "runOn": "folderOpen"
            },
            "isBackground": true,
            "problemMatcher": []
        }
    ]
}
EOF
    fi
done

# Traversal permissions on parent volumes directory
chmod 711 "$VOLUMES_PATH" 2>/dev/null || true

# 4. Auto-detect Wings SSL Certificates (Let's Encrypt)
SSL_CERT=""
SSL_KEY=""
SSL_ENABLED=false

if [ -f "/etc/reviactyl/config.yml" ]; then
    CONF_CERT=$(grep -E '^[[:space:]]*cert:' /etc/reviactyl/config.yml | head -n 1 | awk '{print $2}' | tr -d '"' | tr -d "'")
    CONF_KEY=$(grep -E '^[[:space:]]*key:' /etc/reviactyl/config.yml | head -n 1 | awk '{print $2}' | tr -d '"' | tr -d "'")
    if [ -n "$CONF_CERT" ] && [ -f "$CONF_CERT" ] && [ -n "$CONF_KEY" ] && [ -f "$CONF_KEY" ]; then
        SSL_CERT="$CONF_CERT"
        SSL_KEY="$CONF_KEY"
        SSL_ENABLED=true
    fi
elif [ -f "/etc/pterodactyl/config.yml" ]; then
    CONF_CERT=$(grep -E '^[[:space:]]*cert:' /etc/pterodactyl/config.yml | head -n 1 | awk '{print $2}' | tr -d '"' | tr -d "'")
    CONF_KEY=$(grep -E '^[[:space:]]*key:' /etc/pterodactyl/config.yml | head -n 1 | awk '{print $2}' | tr -d '"' | tr -d "'")
    if [ -n "$CONF_CERT" ] && [ -f "$CONF_CERT" ] && [ -n "$CONF_KEY" ] && [ -f "$CONF_KEY" ]; then
        SSL_CERT="$CONF_CERT"
        SSL_KEY="$CONF_KEY"
        SSL_ENABLED=true
    fi
fi

if [ "$SSL_ENABLED" = false ]; then
    FOUND_CERT=$(find /etc/letsencrypt/live -name "fullchain.pem" 2>/dev/null | head -n 1)
    FOUND_KEY=$(find /etc/letsencrypt/live -name "privkey.pem" 2>/dev/null | head -n 1)
    if [ -n "$FOUND_CERT" ] && [ -f "$FOUND_CERT" ] && [ -n "$FOUND_KEY" ] && [ -f "$FOUND_KEY" ]; then
        SSL_CERT="$FOUND_CERT"
        SSL_KEY="$FOUND_KEY"
        SSL_ENABLED=true
    fi
fi

# 5. Open Firewall for port $PORT
echo "[i] Configuring firewall rules for port $PORT..."
if command -v ufw &>/dev/null; then
    ufw allow "$PORT/tcp" 2>/dev/null || true
    echo "  -> Port $PORT allowed in UFW"
fi
if command -v iptables &>/dev/null; then
    iptables -I INPUT -p tcp --dport "$PORT" -j ACCEPT 2>/dev/null || true
fi

echo "[1/4] Removing old container(s) if exists..."
docker rm -f votion-code 2>/dev/null || true
for c in $(docker ps -a --filter "name=votion-code-" --format "{{.Names}}" 2>/dev/null); do
    docker rm -f "$c" 2>/dev/null || true
done

echo "[2/4] Pulling latest coder/code-server image..."
docker pull codercom/code-server:latest

# Prepare Docker CLI mount for live console streaming
DOCKER_MOUNT=""
if [ -f "$DOCKER_BIN" ]; then
    DOCKER_MOUNT="-v ${DOCKER_BIN}:/usr/local/bin/docker:ro"
fi

echo "[3/4] Starting Votion Code daemon on port $PORT with root disk access & console streaming..."
if [ "$SSL_ENABLED" = true ]; then
    echo "  -> Enabling native HTTPS using Wings SSL certificate:"
    echo "     Cert: $SSL_CERT"
    echo "     Key:  $SSL_KEY"

    CERT_MOUNT="-v /etc/letsencrypt:/etc/letsencrypt:ro"
    if [[ "$SSL_CERT" != /etc/letsencrypt* ]]; then
        CERT_MOUNT="-v $(dirname "$SSL_CERT"):$(dirname "$SSL_CERT"):ro"
    fi

    docker run -d \
        --name votion-code \
        --restart always \
        -u 0:0 \
        -p "$PORT:$PORT" \
        -v "$VOLUMES_PATH:/home/coder/projects" \
        -v "/var/run/docker.sock:/var/run/docker.sock" \
        $DOCKER_MOUNT \
        -v "$CONFIG_DIR:/root/.local/share/code-server/User" \
        -v "$CONFIG_DIR:/home/coder/.local/share/code-server/User" \
        -v "$CONFIG_DIR:/root/.local/share/code-server/Machine" \
        -v "$CONFIG_DIR:/home/coder/.local/share/code-server/Machine" \
        -v "$CONFIG_DIR/coder.json:/root/.local/share/code-server/coder.json" \
        -v "$CONFIG_DIR/coder.json:/home/coder/.local/share/code-server/coder.json" \
        $CERT_MOUNT \
        -e CS_DISABLE_TELEMETRY=true \
        codercom/code-server:latest \
        --bind-addr "0.0.0.0:$PORT" \
        --cert "$SSL_CERT" \
        --cert-key "$SSL_KEY" \
        --auth none \
        --disable-telemetry \
        --app-name "Votion Code"
else
    echo "  -> Starting HTTP mode on port $PORT..."
    docker run -d \
        --name votion-code \
        --restart always \
        -u 0:0 \
        -p "$PORT:8080" \
        -v "$VOLUMES_PATH:/home/coder/projects" \
        -v "/var/run/docker.sock:/var/run/docker.sock" \
        $DOCKER_MOUNT \
        -v "$CONFIG_DIR:/root/.local/share/code-server/User" \
        -v "$CONFIG_DIR:/home/coder/.local/share/code-server/User" \
        -v "$CONFIG_DIR:/root/.local/share/code-server/Machine" \
        -v "$CONFIG_DIR:/home/coder/.local/share/code-server/Machine" \
        -v "$CONFIG_DIR/coder.json:/root/.local/share/code-server/coder.json" \
        -v "$CONFIG_DIR/coder.json:/home/coder/.local/share/code-server/coder.json" \
        -e CS_DISABLE_TELEMETRY=true \
        codercom/code-server:latest \
        --auth none \
        --disable-telemetry \
        --app-name "Votion Code"
fi

echo "[4/4] Checking Nginx reverse proxy (if on Panel VPS)..."
NGINX_CONF=""
for conf_candidate in \
    "/etc/nginx/sites-available/reviactyl.conf" \
    "/etc/nginx/sites-available/pterodactyl.conf" \
    "/etc/nginx/sites-enabled/reviactyl.conf" \
    "/etc/nginx/sites-enabled/pterodactyl.conf" \
    "/etc/nginx/conf.d/reviactyl.conf" \
    "/etc/nginx/conf.d/pterodactyl.conf"; do
    if [ -f "$conf_candidate" ]; then
        NGINX_CONF="$conf_candidate"
        break
    fi
done

if [ -n "$NGINX_CONF" ]; then
    if grep -q "location /votion-code/" "$NGINX_CONF"; then
        echo "  -> Nginx reverse proxy already configured in $NGINX_CONF"
    else
        echo "  -> Adding /votion-code/ reverse proxy to $NGINX_CONF..."
        cp "$NGINX_CONF" "${NGINX_CONF}.bak"
        PROXY_DEST="http://127.0.0.1:${PORT}/"
        if [ "$SSL_ENABLED" = true ]; then
            PROXY_DEST="https://127.0.0.1:${PORT}/"
        fi
        sed -i "/location ~ \\\.php/i \\
    location /votion-code/ {\\
        proxy_pass ${PROXY_DEST};\\
        proxy_ssl_verify off;\\
        proxy_set_header Host \$host;\\
        proxy_set_header Upgrade \$http_upgrade;\\
        proxy_set_header Connection \"upgrade\";\\
        proxy_set_header Accept-Encoding gzip;\\
        proxy_read_timeout 86400s;\\
        proxy_send_timeout 86400s;\\
        add_header Access-Control-Allow-Origin * always;\\
        add_header Access-Control-Allow-Methods \"GET, POST, OPTIONS, HEAD\" always;\\
        add_header Access-Control-Allow-Headers \"*\" always;\\
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
fi

# Clean up any leftover per-server nginx files from earlier tests
rm -f /etc/nginx/conf.d/votion-code.conf /etc/nginx/votion-code-locations.conf 2>/dev/null || true
if command -v nginx &>/dev/null && nginx -t &>/dev/null; then
    nginx -s reload 2>/dev/null || systemctl reload nginx 2>/dev/null || true
fi

MY_IP=$(curl -4 -s --connect-timeout 3 ifconfig.me 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}')
MY_HOSTNAME=$(hostname -f 2>/dev/null || echo "$MY_IP")

if [ "$SSL_ENABLED" = true ]; then
    ENDPOINT_URL="https://${MY_HOSTNAME}:${PORT}"
else
    ENDPOINT_URL="http://${MY_HOSTNAME}:${PORT}"
fi

echo ""
echo "=========================================================="
echo "   Votion Code Engine successfully installed and running!"
echo "   Default Theme:     Dark Modern"
echo "   Restricted Mode:   Disabled (Full trust)"
echo "   Permissions:       Full Root (Direct volume access)"
echo "   Console Streaming: Enabled via Docker logs task"
echo "   SSL Protocol:      $([ "$SSL_ENABLED" = true ] && echo "HTTPS (Active with Wings cert)" || echo "HTTP (Port $PORT)")"
echo "   Node Endpoint:     $ENDPOINT_URL"
echo "   Mount directory:   $VOLUMES_PATH -> /home/coder/projects"
echo "=========================================================="
