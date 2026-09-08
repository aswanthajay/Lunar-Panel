#!/usr/bin/env bash
# ==============================================================================
# Votion Code — Node Sidecar Setup Script (powered by coder/code-server)
# ==============================================================================
# Architecture: One isolated code-server container per server volume.
#   - Each container mounts ONLY its own server's files → real FS-level isolation
#   - Docker socket + binary mounted → live console streaming via `docker logs`
#   - Nginx on port 8443 routes /vc/<short-id>/ to each container
#   - .vscode/tasks.json auto-runs console stream on folder open
# ==============================================================================

set -e

CONFIG_DIR="/var/lib/votion-code/User"
PORT_MAP_FILE="/var/lib/votion-code/port-map.txt"
VC_NGINX_LOCATIONS="/etc/nginx/votion-code-locations.conf"
VC_NGINX_CONF="/etc/nginx/conf.d/votion-code.conf"
BASE_PORT=18000
VOTION_PORT="${VOTION_PORT:-8443}"

echo "=========================================================="
echo "          Votion Code — Per-Server Isolated Setup         "
echo "=========================================================="

# ── Preflight ────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
    echo "[ERROR] Docker is required but not installed."
    exit 1
fi

DOCKER_BIN=$(command -v docker 2>/dev/null || echo "/usr/bin/docker")

# ── 1. Volume directory detection ────────────────────────────
VOLUMES_PATH=""
if [ -n "$1" ] && [ -d "$1" ]; then
    VOLUMES_PATH="$1"
    echo "[i] Using custom volume directory: $VOLUMES_PATH"
elif [ -n "$PTERO_VOLUMES" ] && [ -d "$PTERO_VOLUMES" ]; then
    VOLUMES_PATH="$PTERO_VOLUMES"
fi

if [ -z "$VOLUMES_PATH" ]; then
    for cfg in "/etc/reviactyl/config.yml" "/etc/pterodactyl/config.yml"; do
        if [ -f "$cfg" ]; then
            CONF_DATA=$(grep -E '^[[:space:]]*data:' "$cfg" | head -n 1 | awk '{print $2}' | tr -d '"' | tr -d "'")
            if [ -n "$CONF_DATA" ] && [ -d "$CONF_DATA" ]; then
                VOLUMES_PATH="$CONF_DATA"
                echo "[i] Auto-detected volumes from $cfg: $VOLUMES_PATH"
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
        if [ -d "$candidate" ]; then
            VOLUMES_PATH="$candidate"
            break
        fi
    done
fi

[ -z "$VOLUMES_PATH" ] && VOLUMES_PATH="/var/lib/pterodactyl/volumes"
[ ! -d "$VOLUMES_PATH" ] && mkdir -p "$VOLUMES_PATH"

echo "[i] Volumes directory: $VOLUMES_PATH"

# Cross-link reviactyl <-> pterodactyl so both paths always resolve
if [ "$VOLUMES_PATH" = "/var/lib/reviactyl/volumes" ]; then
    mkdir -p /var/lib/pterodactyl 2>/dev/null || true
    ln -sfn /var/lib/reviactyl/volumes /var/lib/pterodactyl/volumes 2>/dev/null || true
elif [ "$VOLUMES_PATH" = "/var/lib/pterodactyl/volumes" ]; then
    mkdir -p /var/lib/reviactyl 2>/dev/null || true
    ln -sfn /var/lib/pterodactyl/volumes /var/lib/reviactyl/volumes 2>/dev/null || true
fi

# ── 2. Count server volumes ──────────────────────────────────
SERVER_COUNT=0
for sdir in "$VOLUMES_PATH"/*/; do
    [ -d "$sdir" ] && [ ! -L "$sdir" ] || continue
    base=$(basename "$sdir")
    [[ "$base" == .* ]] && continue
    SERVER_COUNT=$((SERVER_COUNT + 1))
done

if [ "$SERVER_COUNT" -eq 0 ]; then
    echo ""
    echo "========================================================================"
    echo "  [WARNING: 0 SERVER VOLUMES FOUND IN: $VOLUMES_PATH]"
    echo "  Server files are stored on the WINGS NODE, not the panel VPS."
    echo "  SSH into the Wings node and re-run this script there."
    echo "========================================================================"
fi

# ── 3. Global code-server settings (dark theme, no trust prompts) ──
mkdir -p "$CONFIG_DIR"
cat > "$CONFIG_DIR/settings.json" << 'EOF'
{
    "workbench.colorTheme": "Default Dark Modern",
    "workbench.preferredDarkColorTheme": "Default Dark Modern",
    "security.workspace.trust.enabled": false,
    "workbench.startupEditor": "none",
    "workbench.tips.enabled": false,
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
chmod -R 777 /var/lib/votion-code

# ── 4. Port map management ───────────────────────────────────
# Ports are stable: once assigned to a short-UUID they never change
mkdir -p /var/lib/votion-code
touch "$PORT_MAP_FILE"

get_or_assign_port() {
    local short="$1"
    local existing
    existing=$(grep "^${short}:" "$PORT_MAP_FILE" 2>/dev/null | cut -d: -f2 | head -n1)
    if [ -n "$existing" ]; then
        echo "$existing"
        return
    fi
    local next=$((BASE_PORT + 1))
    while grep -q ":${next}$" "$PORT_MAP_FILE" 2>/dev/null; do
        next=$((next + 1))
    done
    echo "${short}:${next}" >> "$PORT_MAP_FILE"
    echo "$next"
}

# ── 5. Remove legacy single shared container ─────────────────
echo "[i] Removing legacy shared votion-code container (if any)..."
docker rm -f votion-code 2>/dev/null || true

# ── 6. SSL certificate detection ─────────────────────────────
SSL_CERT=""
SSL_KEY=""

for cfg in "/etc/reviactyl/config.yml" "/etc/pterodactyl/config.yml"; do
    if [ -f "$cfg" ]; then
        CONF_CERT=$(grep -E '^[[:space:]]*cert:' "$cfg" | head -n 1 | awk '{print $2}' | tr -d '"' | tr -d "'")
        CONF_KEY=$(grep -E '^[[:space:]]*key:' "$cfg" | head -n 1 | awk '{print $2}' | tr -d '"' | tr -d "'")
        if [ -n "$CONF_CERT" ] && [ -f "$CONF_CERT" ] && [ -n "$CONF_KEY" ] && [ -f "$CONF_KEY" ]; then
            SSL_CERT="$CONF_CERT"
            SSL_KEY="$CONF_KEY"
            break
        fi
    fi
done

if [ -z "$SSL_CERT" ]; then
    FOUND_CERT=$(find /etc/letsencrypt/live -name "fullchain.pem" 2>/dev/null | head -n 1)
    FOUND_KEY=$(find /etc/letsencrypt/live -name "privkey.pem" 2>/dev/null | head -n 1)
    if [ -n "$FOUND_CERT" ] && [ -f "$FOUND_CERT" ] && [ -n "$FOUND_KEY" ] && [ -f "$FOUND_KEY" ]; then
        SSL_CERT="$FOUND_CERT"
        SSL_KEY="$FOUND_KEY"
    fi
fi

[ -n "$SSL_CERT" ] && echo "[i] SSL cert: $SSL_CERT" || echo "[i] SSL: none found — using HTTP"

# ── 7. Ensure Nginx is installed ─────────────────────────────
if ! command -v nginx &>/dev/null; then
    echo "[i] Nginx not found — installing..."
    apt-get update -qq 2>/dev/null && apt-get install -y -qq nginx 2>/dev/null || \
    yum install -y -q nginx 2>/dev/null || true
fi

# ── 8. Pull latest code-server image ─────────────────────────
echo "[i] Pulling coder/code-server:latest..."
docker pull codercom/code-server:latest

# ── 9. Init Nginx locations file ─────────────────────────────
cat > "$VC_NGINX_LOCATIONS" << 'NGINXEOF'
# Votion Code — per-server location blocks (auto-generated)
# Do NOT edit manually. Re-run setup-votion-code.sh to update.
NGINXEOF

# ── 10. Per-server container loop ───────────────────────────
echo ""
echo "[i] Setting up isolated containers per server volume..."
ACTIVE=0

for sdir in "$VOLUMES_PATH"/*/; do
    [ -d "$sdir" ] && [ ! -L "$sdir" ] || continue
    uuid=$(basename "$sdir")
    [[ "$uuid" == .* ]] && continue

    lower=$(echo "$uuid" | tr '[:upper:]' '[:lower:]')
    short="${lower:0:8}"
    port=$(get_or_assign_port "$short")
    base_path="/vc/${short}"

    echo ""
    echo "  [+] Server: ${short}  UUID: ${lower}"
    echo "      Port: ${port}  Path: ${base_path}"

    # Make server files accessible
    chmod 755 "$sdir" 2>/dev/null || true

    # Clean up stale .votion.code-workspace files from old setup
    rm -f "${sdir}.votion.code-workspace" 2>/dev/null || true

    # ── .vscode/tasks.json — auto-run server console on folder open ──
    mkdir -p "${sdir}.vscode" 2>/dev/null || true
    cat > "${sdir}.vscode/tasks.json" 2>/dev/null << EOF || true
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "📡 Server Console",
            "detail": "Streams live output from the Pterodactyl server container",
            "type": "shell",
            "command": "docker logs -f --timestamps ${lower} 2>&1 || echo '  ⚠  Server container is offline or not yet started'",
            "presentation": {
                "reveal": "always",
                "panel": "dedicated",
                "group": "votion",
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

    # ── .vscode/settings.json — per-server dark theme + terminal cwd ─
    cat > "${sdir}.vscode/settings.json" 2>/dev/null << EOF || true
{
    "workbench.colorTheme": "Default Dark Modern",
    "security.workspace.trust.enabled": false,
    "terminal.integrated.cwd": "/home/coder/project",
    "workbench.colorCustomizations": {
        "editor.background": "#000000",
        "sideBar.background": "#050505",
        "activityBar.background": "#000000"
    }
}
EOF

    # ── Remove stale container for this server ────────────────────────
    docker rm -f "votion-code-${short}" 2>/dev/null || true

    # ── Start isolated container ──────────────────────────────────────
    # Mounts:
    #   ${sdir} → /home/coder/project       (ONLY this server's files)
    #   docker.sock + binary                 (for `docker logs` console streaming)
    #   CONFIG_DIR → code-server User dirs   (shared global settings)
    docker run -d \
        --name "votion-code-${short}" \
        --restart always \
        -u 0:0 \
        -p "127.0.0.1:${port}:8080" \
        -v "${sdir}:/home/coder/project" \
        -v "/var/run/docker.sock:/var/run/docker.sock" \
        -v "${DOCKER_BIN}:/usr/local/bin/docker:ro" \
        -v "${CONFIG_DIR}:/root/.local/share/code-server/User" \
        -v "${CONFIG_DIR}:/home/coder/.local/share/code-server/User" \
        -e CS_DISABLE_TELEMETRY=true \
        codercom/code-server:latest \
        --bind-addr "0.0.0.0:8080" \
        --base-path "${base_path}" \
        --auth none \
        --disable-telemetry \
        --app-name "Votion Code" \
    && echo "      → Started ✓" \
    || echo "      → [WARN] Failed to start container"

    # ── Append Nginx location block ───────────────────────────────────
    cat >> "$VC_NGINX_LOCATIONS" << EOF

# ${uuid}
location ${base_path}/ {
    proxy_pass         http://127.0.0.1:${port}${base_path}/;
    proxy_http_version 1.1;
    proxy_set_header   Host              \$host;
    proxy_set_header   Upgrade           \$http_upgrade;
    proxy_set_header   Connection        "upgrade";
    proxy_set_header   Accept-Encoding   gzip;
    proxy_read_timeout 86400s;
    proxy_send_timeout 86400s;
}
EOF

    ACTIVE=$((ACTIVE + 1))
done

# ── 11. Write Nginx server block on port VOTION_PORT ─────────
if command -v nginx &>/dev/null; then
    echo ""
    echo "[i] Writing Nginx server block for port ${VOTION_PORT}..."

    if [ -n "$SSL_CERT" ] && [ -f "$SSL_CERT" ]; then
        cat > "$VC_NGINX_CONF" << EOF
server {
    listen ${VOTION_PORT} ssl;
    listen [::]:${VOTION_PORT} ssl;
    server_name _;

    ssl_certificate     ${SSL_CERT};
    ssl_certificate_key ${SSL_KEY};
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;
    ssl_session_cache   shared:SSL:10m;
    ssl_session_timeout 10m;

    include ${VC_NGINX_LOCATIONS};

    location / {
        return 404 "Votion Code: no server selected";
    }
}
EOF
    else
        cat > "$VC_NGINX_CONF" << EOF
server {
    listen ${VOTION_PORT};
    listen [::]:${VOTION_PORT};
    server_name _;

    include ${VC_NGINX_LOCATIONS};

    location / {
        return 404 "Votion Code: no server selected";
    }
}
EOF
    fi

    # Firewall
    if command -v ufw &>/dev/null; then
        ufw allow "${VOTION_PORT}/tcp" 2>/dev/null || true
        echo "  → UFW: port ${VOTION_PORT} allowed"
    fi
    if command -v iptables &>/dev/null; then
        iptables -I INPUT -p tcp --dport "$VOTION_PORT" -j ACCEPT 2>/dev/null || true
    fi

    # Validate and reload
    if nginx -t 2>/dev/null; then
        systemctl reload nginx 2>/dev/null \
            || service nginx reload 2>/dev/null \
            || nginx -s reload 2>/dev/null \
            || true
        echo "  → Nginx: reloaded ✓"
    else
        echo "  → [ERROR] Nginx config invalid:"
        nginx -t
    fi
fi

# ── 12. Summary ───────────────────────────────────────────────
MY_HOSTNAME=$(hostname -f 2>/dev/null || curl -4 -s --connect-timeout 3 ifconfig.me 2>/dev/null || echo "this-node")
PROTO="http"
[ -n "$SSL_CERT" ] && PROTO="https"

echo ""
echo "=========================================================="
echo "   Votion Code — Setup Complete!"
echo "   Isolated containers: ${ACTIVE}"
echo "   Port map:            ${PORT_MAP_FILE}"
echo ""
if [ "$ACTIVE" -gt 0 ]; then
    echo "   Per-server access URLs:"
    for sdir in "$VOLUMES_PATH"/*/; do
        [ -d "$sdir" ] && [ ! -L "$sdir" ] || continue
        uuid=$(basename "$sdir")
        [[ "$uuid" == .* ]] && continue
        lower=$(echo "$uuid" | tr '[:upper:]' '[:lower:]')
        short="${lower:0:8}"
        p=$(grep "^${short}:" "$PORT_MAP_FILE" 2>/dev/null | cut -d: -f2 | head -n1)
        echo "     ${PROTO}://${MY_HOSTNAME}:${VOTION_PORT}/vc/${short}/  (container port ${p})"
    done
fi
echo ""
echo "   Console output auto-streams via .vscode/tasks.json"
echo "   (docker logs -f <server-uuid> on folder open)"
echo "=========================================================="
