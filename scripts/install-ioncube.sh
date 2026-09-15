#!/usr/bin/env bash
# ==============================================================================
# Lunar Panel — Automated ionCube Loader Installer
# Fully automated detection, download, installation, and activation for Linux
# Supports: Ubuntu, Debian, AlmaLinux, Rocky Linux, CentOS, RHEL
# Architectures: x86_64, aarch64 (ARM64)
# PHP Versions: 8.1, 8.2, 8.3
# ==============================================================================
set -e

# ANSI Color codes for luxury terminal output
C_RESET="\033[0m"
C_BOLD="\033[1m"
C_CYAN="\033[38;2;14;165;233m"
C_GREEN="\033[38;2;34;197;94m"
C_AMBER="\033[38;2;245;158;11m"
C_ROSE="\033[38;2;244;63;94m"
C_MUTED="\033[38;2;115;115;115m"

echo -e "\n${C_BOLD}${C_CYAN}==========================================================="
echo -e "       LUNAR PANEL — IONCUBE LOADER AUTO-INSTALLER         "
echo -e "===========================================================${C_RESET}\n"

# 1. Require Root / Sudo privileges
if [ "$(id -u)" -ne 0 ]; then
    echo -e "${C_ROSE}[ERROR] This installer must be run as root or with sudo.${C_RESET}"
    echo -e "${C_MUTED}Usage: sudo bash $0${C_RESET}\n"
    exit 1
fi

# 2. Check if PHP is installed
if ! command -v php &>/dev/null; then
    echo -e "${C_ROSE}[ERROR] PHP CLI was not detected on this system.${C_RESET}"
    echo -e "${C_MUTED}Please install PHP 8.2 or 8.3 first before running this script.${C_RESET}\n"
    exit 1
fi

# Check if ionCube is already active
if php -m 2>/dev/null | grep -qi "ioncube"; then
    echo -e "${C_GREEN}[?] ionCube Loader is ALREADY installed and active on this system!${C_RESET}"
    php -v | grep -i "ioncube" || true
    echo -e "\n${C_CYAN}No further action required.${C_RESET}\n"
    exit 0
fi

# 3. Detect System Architecture
UNAME_M=$(uname -m)
case "$UNAME_M" in
    x86_64|amd64)
        ARCH="x86-64"
        ;;
    aarch64|arm64)
        ARCH="aarch64"
        ;;
    *)
        echo -e "${C_ROSE}[ERROR] Unsupported architecture: ${UNAME_M}.${C_RESET}"
        echo -e "${C_MUTED}ionCube Loader supports x86_64 and aarch64 Linux systems.${C_RESET}\n"
        exit 1
        ;;
esac

# 4. Detect PHP Major.Minor Version
PHP_VER=$(php -r "echo PHP_MAJOR_VERSION . '.' . PHP_MINOR_VERSION;")
echo -e "${C_CYAN}[1/5]${C_RESET} Detected Architecture: ${C_BOLD}${UNAME_M}${C_RESET} | PHP Version: ${C_BOLD}${PHP_VER}${C_RESET}"

# 5. Detect PHP Extension Directory
EXT_DIR=$(php -r "echo ini_get('extension_dir');")
if [ -z "$EXT_DIR" ] || [ ! -d "$EXT_DIR" ]; then
    if command -v php-config &>/dev/null; then
        EXT_DIR=$(php-config --extension-dir)
    fi
fi

if [ -z "$EXT_DIR" ] || [ ! -d "$EXT_DIR" ]; then
    echo -e "${C_ROSE}[ERROR] Could not automatically locate PHP extension_dir.${C_RESET}"
    exit 1
fi
echo -e "${C_CYAN}[2/5]${C_RESET} PHP Extension Directory: ${C_MUTED}${EXT_DIR}${C_RESET}"

# 6. Download ionCube Loader Tarball
TMP_DIR="/tmp/ioncube_installer_$$"
mkdir -p "$TMP_DIR"
TAR_FILE="${TMP_DIR}/ioncube_loaders.tar.gz"

DOWNLOAD_URL="https://downloads.ioncube.com/loader_downloads/ioncube_loaders_lin_${ARCH}.tar.gz"
FALLBACK_URL="http://downloads3.ioncube.com/loader_downloads/ioncube_loaders_lin_${ARCH}.tar.gz"

echo -e "${C_CYAN}[3/5]${C_RESET} Downloading official ionCube loaders from ioncube.com..."
if command -v curl &>/dev/null; then
    curl -fsSL "$DOWNLOAD_URL" -o "$TAR_FILE" || curl -fsSL "$FALLBACK_URL" -o "$TAR_FILE"
elif command -v wget &>/dev/null; then
    wget -q "$DOWNLOAD_URL" -O "$TAR_FILE" || wget -q "$FALLBACK_URL" -O "$TAR_FILE"
else
    echo -e "${C_ROSE}[ERROR] Neither curl nor wget found. Installing curl...${C_RESET}"
    apt-get update && apt-get install -y curl || yum install -y curl
    curl -fsSL "$DOWNLOAD_URL" -o "$TAR_FILE"
fi

# 7. Extract Loader Matching Target PHP Version
echo -e "${C_CYAN}[4/5]${C_RESET} Extracting loader for PHP ${PHP_VER}..."
tar -xzf "$TAR_FILE" -C "$TMP_DIR"

LOADER_FILE="${TMP_DIR}/ioncube/ioncube_loader_lin_${PHP_VER}.so"
if [ ! -f "$LOADER_FILE" ]; then
    echo -e "${C_ROSE}[ERROR] Loader file not found: ${LOADER_FILE}${C_RESET}"
    echo -e "${C_MUTED}ionCube might not yet provide a loader for PHP ${PHP_VER} on ${UNAME_M}.${C_RESET}"
    echo -e "${C_MUTED}Available in archive:${C_RESET}"
    ls -l "${TMP_DIR}/ioncube/"
    rm -rf "$TMP_DIR"
    exit 1
fi

# Copy into PHP extension directory
TARGET_SO="${EXT_DIR}/ioncube_loader_lin_${PHP_VER}.so"
cp -f "$LOADER_FILE" "$TARGET_SO"
chmod 755 "$TARGET_SO"
rm -rf "$TMP_DIR"
echo -e "${C_GREEN}[?] Copied loader to ${TARGET_SO}${C_RESET}"

# 8. Configure PHP (CLI & FPM)
echo -e "${C_CYAN}[5/5]${C_RESET} Registering ionCube in PHP configuration..."

CONFIGURED=false

# Case A: Debian / Ubuntu (mods-available & phpenmod)
if [ -d "/etc/php/${PHP_VER}" ]; then
    MODS_DIR="/etc/php/${PHP_VER}/mods-available"
    mkdir -p "$MODS_DIR"
    INI_FILE="${MODS_DIR}/00-ioncube.ini"
    echo "zend_extension = ${TARGET_SO}" > "$INI_FILE"
    chmod 644 "$INI_FILE"

    if command -v phpenmod &>/dev/null; then
        phpenmod -v "${PHP_VER}" 00-ioncube || true
    fi

    # Ensure explicit symlinks in cli and fpm conf.d
    for SAPI in cli fpm apache2 cgi; do
        if [ -d "/etc/php/${PHP_VER}/${SAPI}/conf.d" ]; then
            ln -sf "$INI_FILE" "/etc/php/${PHP_VER}/${SAPI}/conf.d/00-ioncube.ini"
        fi
    done
    CONFIGURED=true
fi

# Case B: RHEL / AlmaLinux / CentOS (/etc/php.d or /etc/php-zts.d)
if [ -d "/etc/php.d" ]; then
    INI_FILE="/etc/php.d/00-ioncube.ini"
    echo "zend_extension = ${TARGET_SO}" > "$INI_FILE"
    chmod 644 "$INI_FILE"
    CONFIGURED=true
fi

# Fallback: find all active php.ini files if not Debian/RHEL structure
if [ "$CONFIGURED" = false ]; then
    ACTIVE_INI=$(php -r "echo php_ini_loaded_file();")
    if [ -n "$ACTIVE_INI" ] && [ -f "$ACTIVE_INI" ]; then
        if ! grep -q "ioncube_loader" "$ACTIVE_INI"; then
            sed -i "1s|^|zend_extension = ${TARGET_SO}\n|" "$ACTIVE_INI"
            echo -e "${C_GREEN}[?] Injected zend_extension into ${ACTIVE_INI}${C_RESET}"
        fi
        CONFIGURED=true
    fi
fi

# 9. Restart Services (PHP-FPM, Web Server)
echo -e "${C_CYAN}Restarting PHP-FPM service...${C_RESET}"
if command -v systemctl &>/dev/null; then
    systemctl restart "php${PHP_VER}-fpm" 2>/dev/null || \
    systemctl restart php-fpm 2>/dev/null || \
    systemctl restart php8.2-fpm 2>/dev/null || \
    systemctl restart php8.3-fpm 2>/dev/null || true

    systemctl restart nginx 2>/dev/null || \
    systemctl restart apache2 2>/dev/null || \
    systemctl restart httpd 2>/dev/null || true
fi

# 10. Verification
echo -e "\n${C_BOLD}${C_CYAN}==========================================================="
echo -e "                   VERIFICATION RESULT                     "
echo -e "===========================================================${C_RESET}"

if php -m 2>/dev/null | grep -qi "ioncube"; then
    echo -e "${C_GREEN}${C_BOLD}[SUCCESS] ionCube Loader successfully installed and activated!${C_RESET}"
    php -v | grep -i "ioncube" || true
    echo -e "\n${C_GREEN}Lunar Panel bytecode encryption is now active on this host.${C_RESET}\n"
    exit 0
else
    echo -e "${C_AMBER}[WARNING] The extension was installed to ${TARGET_SO}, but 'php -m' did not report it.${C_RESET}"
    echo -e "${C_MUTED}Please check your php.ini or try manually restarting your server with: reboot${C_RESET}\n"
    exit 1
fi
