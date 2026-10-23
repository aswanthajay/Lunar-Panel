#!/usr/bin/env bash
# ==============================================================================
# Votion Platform 2.0 - Host Node & Control Plane Installer for Ubuntu / Debian
# Sets up crun, cgroups v2, Node.js 22, Rust, and systemd services
# ==============================================================================

set -euo pipefail

echo "=========================================================="
echo "          Installing Votion Platform 2.0 Node             "
echo "=========================================================="

if [ "$EUID" -ne 0 ]; then
  echo "[-] Please run as root: sudo bash deploy-vps.sh"
  exit 1
fi

# 1. Update and install base packages
echo "[+] Updating apt repositories..."
apt-get update -y
apt-get install -y \
  curl \
  wget \
  git \
  build-essential \
  crun \
  skopeo \
  umoci \
  protobuf-compiler \
  pkg-config \
  libssl-dev \
  jq

# 2. Verify cgroups v2 is active
echo "[+] Verifying cgroups v2..."
if [ ! -f /sys/fs/cgroup/cgroup.controllers ]; then
  echo "[!] Warning: cgroups v2 is not active. Enabling in GRUB..."
  sed -i 's/GRUB_CMDLINE_LINUX="/GRUB_CMDLINE_LINUX="systemd.unified_cgroup_hierarchy=1 /' /etc/default/grub
  update-grub
  echo "[!] Reboot will be required for cgroups v2 to take effect."
fi

# Setup Votion cgroups slice
mkdir -p /sys/fs/cgroup/votion
if [ -f /sys/fs/cgroup/cgroup.subtree_control ]; then
  echo "+cpu +memory +io" > /sys/fs/cgroup/cgroup.subtree_control || true
fi

# 3. Create required runtime directories
echo "[+] Creating /var/lib/votion directories..."
mkdir -p /var/lib/votion/containers
mkdir -p /var/lib/votion/cache
mkdir -p /var/lib/votion/images
mkdir -p /etc/votion

# 4. Install Node.js 22 LTS if not present
if ! command -v node &> /dev/null; then
  echo "[+] Installing Node.js 22..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

# 5. Build and install votion-node daemon
echo "[+] Compiling votion-node..."
if [ -d "daemon" ]; then
  cd daemon
  if ! command -v cargo &> /dev/null; then
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
  fi
  cargo build --release
  cp target/release/votion-node /usr/local/bin/votion-node
  chmod +x /usr/local/bin/votion-node
  cd ..
fi

# 6. Create systemd service for votion-node
echo "[+] Creating systemd service /etc/systemd/system/votion-node.service..."
cat << 'EOF' > /etc/systemd/system/votion-node.service
[Unit]
Description=Votion Host Node Daemon v2.0
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/var/lib/votion
ExecStart=/usr/local/bin/votion-node --grpc-port 50051 --ws-port 50052
Restart=always
RestartSec=5s
LimitNOFILE=1048576
LimitNPROC=512000
LimitMEMLOCK=infinity
TasksMax=infinity

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable votion-node
echo "[+] votion-node service created and enabled."

echo "=========================================================="
echo "  Votion Platform 2.0 Host Node Installation Complete!    "
echo "  Start daemon with: systemctl start votion-node          "
echo "  Status with:       systemctl status votion-node         "
echo "=========================================================="
