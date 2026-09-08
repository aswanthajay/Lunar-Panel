#!/usr/bin/env bash
# ==============================================================================
# Votion Code — Node Sidecar Setup Script (powered by coder/code-server)
# ==============================================================================
# This script sets up the genuine coder/code-server daemon on your Pterodactyl node.
# It mounts all server files (/var/lib/pterodactyl/volumes) so you can edit
# any server's files directly with the full VS Code Web UI and bash terminal.
# ==============================================================================

set -e

PORT="${VOTION_PORT:-8443}"
VOLUMES_PATH="${PTERO_VOLUMES:-/var/lib/pterodactyl/volumes}"

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

echo "[1/3] Removing old container if exists..."
docker rm -f votion-code 2>/dev/null || true

echo "[2/3] Pulling latest coder/code-server image..."
docker pull codercom/code-server:latest

echo "[3/3] Starting Votion Code daemon on port $PORT..."
docker run -d \
    --name votion-code \
    --restart always \
    -p "$PORT:8080" \
    -v "$VOLUMES_PATH:/home/coder/projects" \
    -e CS_DISABLE_TELEMETRY=true \
    codercom/code-server:latest \
    --auth none \
    --disable-telemetry \
    --app-name "Votion Code"

echo ""
echo "=========================================================="
echo "   Votion Code Engine successfully started!"
echo "   Listening on port: $PORT"
echo "   Mount directory:   $VOLUMES_PATH -> /home/coder/projects"
echo "=========================================================="
echo ""
echo "Access directly: http://<your-node-ip>:$PORT"
echo ""
echo "To proxy via Nginx under your domain (e.g. /votion-code/):"
echo "  location /votion-code/ {"
echo "      proxy_pass http://127.0.0.1:$PORT/;"
echo "      proxy_set_header Host \$host;"
echo "      proxy_set_header Upgrade \$http_upgrade;"
echo "      proxy_set_header Connection upgrade;"
echo "      proxy_set_header Accept-Encoding gzip;"
echo "  }"
echo "=========================================================="
