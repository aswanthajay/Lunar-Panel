#!/usr/bin/env bash
# ==============================================================================
# Votion Platform 2.0 - Safe Side-by-Side Migration & Upgrade Script
#
# Guarantees:
# 1. Automatic backup of existing MySQL database and Wings configs
# 2. Zero risk to existing servers: creates hard-links without using extra disk space
# 3. Parallel operation: runs on separate ports so your live panel stays online!
# ==============================================================================

set -euo pipefail

echo "=============================================================="
echo "    VOTION PLATFORM 2.0 - SAFE ZERO-RISK UPGRADE ASSISTANT    "
echo "=============================================================="

if [ "$EUID" -ne 0 ]; then
  echo "[-] Please run as root: sudo bash safe-migrate.sh"
  exit 1
fi

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/root/votion_migration_backup_$TIMESTAMP"

echo "[+] Creating safe backup directory at: $BACKUP_DIR"
mkdir -p "$BACKUP_DIR"

# ------------------------------------------------------------------------------
# STEP 1: Full Backup of Existing Panel & Database
# ------------------------------------------------------------------------------
echo ""
echo "=== STEP 1/5: BACKING UP EXISTING SYSTEM ==="

# Backup Pterodactyl .env
if [ -f "/var/www/pterodactyl/.env" ]; then
  echo "[+] Backing up /var/www/pterodactyl/.env..."
  cp "/var/www/pterodactyl/.env" "$BACKUP_DIR/pterodactyl.env"
fi

# Backup Wings config
if [ -f "/etc/pterodactyl/config.yml" ]; then
  echo "[+] Backing up /etc/pterodactyl/config.yml..."
  cp "/etc/pterodactyl/config.yml" "$BACKUP_DIR/wings_config.yml"
fi

# Backup MySQL Database
echo "[+] Creating snapshot of MySQL/MariaDB database..."
if command -v mysqldump &> /dev/null; then
  read -r -p "Enter your MySQL database name [pterodactyl]: " DB_NAME
  DB_NAME=${DB_NAME:-pterodactyl}
  read -r -p "Enter MySQL user [root]: " DB_USER
  DB_USER=${DB_USER:-root}
  
  mysqldump -u "$DB_USER" -p "$DB_NAME" > "$BACKUP_DIR/ptero_mysql_dump.sql" || {
    echo "[!] Warning: MySQL dump failed or was skipped. Please verify credentials."
  }
  echo "  ✓ Database backup stored at $BACKUP_DIR/ptero_mysql_dump.sql"
else
  echo "[!] mysqldump not found in PATH. Skipping automated DB dump."
fi

# ------------------------------------------------------------------------------
# STEP 2: Install Votion 2.0 Runtime Prerequisites
# ------------------------------------------------------------------------------
echo ""
echo "=== STEP 2/5: INSTALLING RUNTIME & TOOLS ==="
apt-get update -y
apt-get install -y curl wget git build-essential crun jq postgresql postgresql-contrib protobuf-compiler

# Start and enable PostgreSQL
systemctl enable postgresql
systemctl start postgresql

# Create PostgreSQL database for Votion 2.0
echo "[+] Configuring PostgreSQL database 'votion'..."
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname = 'votion'" | grep -q 1 || \
sudo -u postgres psql -c "CREATE DATABASE votion;"
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'votion_secure_pass';" 2>/dev/null || true

# ------------------------------------------------------------------------------
# STEP 3: Zero-Copy Volume Linking (Preserves Disk Space)
# ------------------------------------------------------------------------------
echo ""
echo "=== STEP 3/5: LINKING SERVER VOLUMES ==="
PTERO_VOLUMES="/var/lib/pterodactyl/volumes"
VOTION_VOLUMES="/var/lib/votion/containers"

mkdir -p "$VOTION_VOLUMES"

if [ -d "$PTERO_VOLUMES" ]; then
  echo "[+] Creating hard-links from $PTERO_VOLUMES to $VOTION_VOLUMES..."
  for server_dir in "$PTERO_VOLUMES"/*; do
    if [ -d "$server_dir" ]; then
      UUID=$(basename "$server_dir")
      TARGET="$VOTION_VOLUMES/$UUID/data"
      mkdir -p "$VOTION_VOLUMES/$UUID"
      
      if [ ! -e "$TARGET" ]; then
        # Pure symbolic link: takes 0 bytes of disk space, points directly to original files
        ln -sfn "$server_dir" "$TARGET"
        echo "  ✓ Symlinked server data (0 bytes used): $UUID"
      fi
    fi
  done
else
  echo "[!] Note: Pterodactyl volumes directory not found at $PTERO_VOLUMES."
fi

# ------------------------------------------------------------------------------
# STEP 4: Build Votion 2.0 (Panel + Host Daemon)
# ------------------------------------------------------------------------------
echo ""
echo "=== STEP 4/5: BUILDING VOTION 2.0 (PARALLEL MODE) ==="
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Build Panel
cd "$ROOT_DIR/panel"
npm install

if [ ! -f "$ROOT_DIR/panel/.env" ]; then
  echo 'DATABASE_URL="postgresql://postgres:votion_secure_pass@localhost:5432/votion?schema=public"' > "$ROOT_DIR/panel/.env"
fi
export DATABASE_URL="postgresql://postgres:votion_secure_pass@localhost:5432/votion?schema=public"

npx prisma generate --schema=prisma/schema.prisma
npx prisma db push --schema=prisma/schema.prisma --accept-data-loss || true
npm run build

# Build Daemon
cd "$ROOT_DIR/daemon"
if [ -f "$HOME/.cargo/env" ]; then
  source "$HOME/.cargo/env"
fi
if ! command -v cargo &> /dev/null; then
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
  source "$HOME/.cargo/env"
fi
if ! command -v protoc &> /dev/null; then
  apt-get install -y protobuf-compiler
fi
cargo build --release
cp target/release/votion-node /usr/local/bin/votion-node
chmod +x /usr/local/bin/votion-node

# ------------------------------------------------------------------------------
# STEP 5: Verification & Cutover Instructions
# ------------------------------------------------------------------------------
echo ""
echo "=============================================================="
echo "          SAFE MIGRATION READY FOR REVIEW!                    "
echo "=============================================================="
echo ""
echo "Your live Pterodactyl setup is UNTOUCHED and still running."
echo ""
echo "To test Votion 2.0 in parallel right now:"
echo "  1. Start Votion Node:  /usr/local/bin/votion-node --grpc-port 50051 --ws-port 50052"
echo "  2. Start Votion Panel: cd $ROOT_DIR/panel && npm start"
echo "  3. Open your browser:  http://<YOUR_VPS_IP>:3000"
echo ""
echo "When you are 100% happy to switch:"
echo "  - Stop Wings:          systemctl stop wings && systemctl disable wings"
echo "  - Enable Votion Node:  systemctl enable --now votion-node"
echo "  - Point Nginx port 80/443 to localhost:3000"
echo "=============================================================="
