#!/usr/bin/env bash
# ==============================================================================
# Votion 2.0 - Host Data Volume Migration Script
# Safely moves or symlinks /var/lib/pterodactyl/volumes to /var/lib/votion/containers
# ==============================================================================

set -euo pipefail

PTERO_DIR="/var/lib/pterodactyl/volumes"
VOTION_DIR="/var/lib/votion/containers"

if [ ! -d "$PTERO_DIR" ]; then
  echo "[-] Pterodactyl volumes directory $PTERO_DIR not found. Skipping disk migration."
  exit 0
fi

echo "[+] Creating Votion container directories..."
mkdir -p "$VOTION_DIR"

for server_dir in "$PTERO_DIR"/*; do
  if [ -d "$server_dir" ]; then
    SERVER_UUID=$(basename "$server_dir")
    TARGET_DIR="$VOTION_DIR/$SERVER_UUID/data"
    
    echo "[+] Migrating server data: $SERVER_UUID"
    mkdir -p "$VOTION_DIR/$SERVER_UUID"
    
    # Method 1: Instant zero-downtime Hard Link or Move
    if [ ! -e "$TARGET_DIR" ]; then
      cp -al "$server_dir" "$TARGET_DIR" || cp -r "$server_dir" "$TARGET_DIR"
      chown -R 1000:1000 "$TARGET_DIR"
      echo "  ✓ Successfully copied data for $SERVER_UUID"
    else
      echo "  ! Target data directory already exists for $SERVER_UUID, skipping."
    fi
  fi
done

echo "[+] Volume migration complete. All server worlds, configs, and saves preserved."
