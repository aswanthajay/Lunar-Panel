<div align="center">

# ✦ Lunar Panel ✦

**Next-generation game server & cloud virtualization control plane engineered with Carta Ink / Votion One™ minimal luxury design principles.**

[![License: Proprietary](https://img.shields.io/badge/License-Proprietary%20%26%20Commercial-black.svg?style=for-the-badge)](LICENSE.md)
[![Security: Tamper-Sealed](https://img.shields.io/badge/Security-Tamper--Sealed%20Core-059669?style=for-the-badge&logo=shield&logoColor=white)](SECURITY.md)
[![Cryptography: RSA-2048](https://img.shields.io/badge/Cryptography-RSA--2048%20Signed-6366F1?style=for-the-badge&logo=auth0&logoColor=white)](SECURITY.md)
[![PHP: ^8.2](https://img.shields.io/badge/PHP-8.2%20%7C%208.3-777BB4?style=for-the-badge&logo=php&logoColor=white)](https://php.net)
[![React: ^17](https://img.shields.io/badge/React-17.x-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.x-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Cloudflare Edge](https://img.shields.io/badge/Cloudflare-Anycast%20Edge%20DNS-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)](https://cloudflare.com)

[📘 **VPS Installation Manual (INSTALL.md)**](INSTALL.md) &nbsp;•&nbsp; [🚀 **Upgrade from Pterodactyl (UPGRADE.md)**](UPGRADE.md) &nbsp;•&nbsp; [🛡️ **Security Policy**](SECURITY.md) &nbsp;•&nbsp; [📜 **License**](LICENSE.md) &nbsp;•&nbsp; [🤝 **Code of Conduct**](CODE_OF_CONDUCT.md) &nbsp;•&nbsp; [👥 **Contributing**](CONTRIBUTING.md)

</div>

---

## Overview

**Lunar Panel** is an ultra-modern, editorial-grade game server and cloud virtualization control panel. Designed from the ground up for high-performance hosting providers, studios, and cloud operators, Lunar Panel pairs low-latency container orchestration with a signature obsidian dark aesthetic inspired by **Carta Ink** and **Votion One™**.

All compute instances execute within securely isolated Docker containers managed by daemon nodes, while providing users and administrators with an intuitive, unified, and cryptographically protected control plane.

---

## ✦ Key Feature Modules

### 1. Cloudflare Anycast Edge Subdomain Engine
Automate zero-port subdomain provisioning for game servers directly through Cloudflare's Anycast Edge DNS:
- **Multiple Cloudflare API Accounts**: Configure multiple Cloudflare accounts in Admin CP using scoped **API Tokens** (`Zone.DNS:Edit` + `Zone.Zone:Read`) or **Global API Keys**. Credentials are encrypted at rest with AES-256.
- **Multiple Apex Root Domains**: Bind multiple custom root domains (e.g. `stellarhost.gg`, `playmc.xyz`, `craftserver.net`) to any configured account.
- **Automated Protocol Routing**:
  - `SRV + A Record` *(Recommended)*: Creates an A record to the allocation node and an SRV record (`_minecraft._tcp.<subdomain>.<domain>`) targeting the allocation port. Players join directly without entering port numbers.
  - `SRV Record Only`: Dedicated SRV resolution for compatible game engines.
  - `A Record Only`: Direct allocation IP resolution.
- **Client Subdomain Hub (`/server/{id}/subdomains`)**:
  - Live address preview (`play.stellarhost.gg`).
  - Reserved keyword filtering (`admin`, `panel`, `api`, `mail`, `node`, `wings`, etc.).
  - 1-click clipboard copy and deletion modal with automated Cloudflare DNS cleanup.

---

### 2. Advanced Database Hub (`/server/{id}/databases`)
A comprehensive database management suite engineered directly into the server control plane:
- **Bento Telemetry & Quota Gauges**: Real-time graphical meter showing allocated databases versus server quota limits, coupled with dynamic search filtering.
- **In-Browser Interactive SQL Console (`SqlConsoleModal`)**:
  - Execute queries directly within the browser console.
  - Quick SQL template shortcuts: `SHOW TABLES`, `CHECK TABLE`, `OPTIMIZE TABLE`, `SELECT COUNT`.
  - Microsecond execution timer and tabular data viewer with schema analyzer.
- **Multi-Stack Connection Cheat Sheet (`ConnectionCheatSheetModal`)**:
  - 1-click copyable snippets for:
    - `.env` / Laravel
    - Node.js (Prisma ORM / mysql2 / TypeORM)
    - Python (SQLAlchemy / Django / PyMySQL)
    - PHP PDO / WordPress `wp-config.php`
    - Java JDBC (Spring Boot / PaperMC plugins)
    - Terminal CLI (`mysql -h ... -u ... -p`)
- **Enhanced Database Row Controls (`DatabaseRow`)**:
  - Live ping latency and connectivity pulse indicator.
  - Inline eye password peek & copy without regenerating credentials.
  - Quick actions for Console, Connect, Export, Import, phpMyAdmin redirect, and Password Rotation.

---

### 3. Multi-Game Management Suite
Specialized high-performance managers built directly into the server navigation:
- **Minecraft Manager Suite**:
  - **Player Manager**: Live player list, kick/ban/op controls, and player inventory inspection.
  - **Plugins & Addons**: Integrated Spigot/Paper plugin browser and Bedrock addon installer.
  - **Version & Jar Switcher**: 1-click engine switcher (Paper, Purpur, Fabric, Forge, BungeeCord, Velocity, Vanilla).
  - **World Manager**: World backup, dimension management (Overworld, Nether, The End), and seed editor.
  - **Properties Manager**: Visual editor for `server.properties` with type validation and search.
  - **Spark Profiler**: Real-time server tick performance, memory allocation, and CPU profiler graphs.
- **FiveM & GTA V Manager**:
  - Live FiveM player card, TXAdmin integration, and player management modals.
- **SA-MP Pawn Compiler**:
  - In-browser Pawn script compiler with real-time build output, error highlighting, and automated `.amx` binary deployment.

---

### 4. Passkey Authentication & Push Notifications
- **WebAuthn / FIDO2 Passkeys**: Fast, biometric, phishing-resistant authentication supporting Touch ID, Face ID, Windows Hello, and YubiKeys.
- **Real-Time Push Notifications**: Native browser push notification support for critical server events (server crash, restart, backup completed, low resource warning).

---

### 5. Integrated Billing Operations & Support Ticketing
- **Client Billing View (`/billing-operations`)**: In-panel store, hourly/monthly server renewals, invoice history, and account balance management.
- **Support Ticket Center (`/support`)**: Dedicated in-panel support ticketing system with threaded replies, attachment uploads, and priority routing.

---

### 6. Google Drive Cloud Backup Vault (`/admin/gdrive`)
Native offsite disaster recovery and cloud snapshot mirroring powered by Google Drive API v3:
- **Zero-RAM Streaming Resumable Uploads**: Upload multi-gigabyte `.tar.gz` game server snapshots directly into Google Drive in chunked streams without exhausting panel memory.
- **Service Account & OAuth2**: Connect seamlessly using standard Google Service Account JSON keys or OAuth2 refresh tokens.
- **Automated Background Sync**: Automatically mirrors snapshots to Google Drive the instant any server backup completes.
- **Admin CP Dashboard**: Live connection tester, Google Drive storage quota meter (Used / Total GB), retention policy with automated pruning, and fleet backup explorer with direct Google Drive links.
- **Client UI Badges**: Synced server backups display a sleek `Google Drive` badge with 1-click cloud access.
- **Artisan CLI**: Includes `php artisan lunar:gdrive:test`, `php artisan lunar:gdrive:sync`, and `php artisan lunar:gdrive:prune`.

---

### 7. Enterprise Cryptographic Protection
- **Asymmetric RSA-2048 Licensing**: Grants are mathematically signed with an offline RSA-2048 private key. Runtime validation verifies signatures using `OPENSSL_ALGO_SHA256`. Keys cannot be forged.
- **AES-256-CBC Bytecode Encryption**: 27 proprietary backend modules are encrypted into high-entropy cipher payloads.
- **HMAC-SHA256 Tamper Seals**: Embedded cryptographic signatures self-verify code integrity on every boot. Any unauthorized tampering immediately halts execution with a 500 integrity violation.
- **Automated ionCube Loader Installer**: Single-command script ([`scripts/install-ioncube.sh`](scripts/install-ioncube.sh)) for automated setup across Debian, Ubuntu, RHEL, and AlmaLinux.

---

## Architecture & Tech Stack

| Layer | Technologies |
|---|---|
| **Backend Core** | PHP 8.2+, Laravel 10.x, MariaDB 10.6+ / MySQL 8.0+, Redis 6.0+ |
| **Frontend UI** | React 17, TypeScript 5, EasyPeasy (Redux), Tailwind CSS 3, Formik, Yup |
| **Edge DNS** | Cloudflare API v4 (Anycast Edge, SRV + A Records) |
| **Virtualization** | Go (Wings Daemon), Docker Engine, Linux Cgroups |
| **Security Core** | RSA-2048 Asymmetric Signatures, AES-256-CBC, HMAC-SHA256 Tamper Seals |
| **Design Language** | Carta Ink / Votion One™ Luxury Principles, Newsreader Serif, Inter Font |

---

## 🚀 Upgrading from Vanilla Pterodactyl (Zero Data Loss)

If you already run a vanilla Pterodactyl panel and want to upgrade to **Lunar Panel** with **zero data loss** (keeping all existing game servers, databases, files, users, and nodes 100% intact):

👉 **Read the comprehensive upgrade guide: [UPGRADE.md](UPGRADE.md)**

```bash
# 1. Put existing panel in maintenance & backup database
cd /var/www/pterodactyl && php artisan down
mysqldump -u root -p pterodactyl > /root/panel_backup_$(date +%F).sql
cp .env /root/.env.backup

# 2. Clone Lunar Panel alongside existing install
git clone https://github.com/aswanthajay/Lunar-Panel.git /var/www/lunar-panel
cd /var/www/lunar-panel
cp /var/www/pterodactyl/.env /var/www/lunar-panel/.env

# 3. Install dependencies & run additive migrations
composer install --no-dev --optimize-autoloader --no-interaction
php artisan migrate --seed --force
php artisan optimize

# 4. Set permissions & swap directories
chown -R www-data:www-data /var/www/lunar-panel/*
chmod -R 755 storage bootstrap/cache
mv /var/www/pterodactyl /var/www/pterodactyl-old
mv /var/www/lunar-panel /var/www/pterodactyl

# 5. Restart services & bring online
php artisan queue:restart && systemctl restart pteroq nginx php8.2-fpm
php artisan up
```

---

## Updating Your Panel via Git

To update your live VPS installation to the latest release of Lunar Panel:

```bash
cd /var/www/pterodactyl

# 1. Put panel into maintenance mode
php artisan down

# 2. Pull the latest code
git pull origin stellar

# 3. Update dependencies (if composer.json changed)
COMPOSER_ALLOW_SUPERUSER=1 composer install --no-dev --optimize-autoloader

# 4. Run database migrations
php artisan migrate --force

# 5. Clear application & route caches
php artisan view:clear
php artisan route:clear
php artisan config:clear
php artisan cache:clear

# 6. Re-apply file permissions
chown -R www-data:www-data /var/www/pterodactyl/*
chmod -R 755 /var/www/pterodactyl/storage /var/www/pterodactyl/bootstrap/cache

# 7. Bring panel back online and restart queue
php artisan up
php artisan queue:restart
```

---

## Quick Installation Summary

For step-by-step instructions (including MariaDB setup, SSL certificate generation, and Nginx site configs), consult the [📘 Comprehensive Installation Guide (INSTALL.md)](INSTALL.md).

```bash
# 1. Clone the repository
git clone https://github.com/aswanthajay/Lunar-Panel.git /var/www/pterodactyl
cd /var/www/pterodactyl

# 2. Install PHP dependencies
COMPOSER_ALLOW_SUPERUSER=1 composer install --no-dev --optimize-autoloader

# 3. Setup environment configuration
cp .env.example .env
php artisan key:generate --force

# 4. Run migrations & create admin user
php artisan migrate --seed --force
php artisan p:user:make

# 5. Set directory permissions
chown -R www-data:www-data /var/www/pterodactyl/*
chmod -R 755 /var/www/pterodactyl/storage /var/www/pterodactyl/bootstrap/cache

# 6. Configure crontab
crontab -e
# Add: * * * * * php /var/www/pterodactyl/artisan schedule:run >> /dev/null 2>&1
```

---

## Community & Support

- **Repository**: [https://github.com/aswanthajay/Lunar-Panel](https://github.com/aswanthajay/Lunar-Panel)
- **Security Inquiries**: [aswanthajay@proton.me](mailto:aswanthajay@proton.me) • [SECURITY.md](SECURITY.md)
- **License Terms**: [LICENSE.md](LICENSE.md)
- **Community Standards**: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
- **Contribution Guidelines**: [CONTRIBUTING.md](CONTRIBUTING.md)

---

## License & Credits
 
- **Lunar Panel & Votion One™ Design**: Copyright © 2026 [Aswanth Ajay](https://github.com/aswanthajay) / Votion Cloud. All rights reserved. Licensed under the [Lunar Panel Commercial License](LICENSE.md).
- **Third-Party Notices**: Open-source framework components and libraries are acknowledged in [NOTICE.md](NOTICE.md).
