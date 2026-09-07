<div align="center">

# Lunar Panel

**Next-generation game server & cloud infrastructure virtualization control plane engineered with Carta Ink / Votion One™ minimal luxury design principles.**

[![License: MIT](https://img.shields.io/badge/License-MIT-black.svg?style=for-the-badge)](LICENSE.md)
[![PHP: ^8.2](https://img.shields.io/badge/PHP-8.2%20%7C%208.3-777BB4?style=for-the-badge&logo=php&logoColor=white)](https://php.net)
[![React: ^17](https://img.shields.io/badge/React-17.x-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.x-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Cloudflare Edge](https://img.shields.io/badge/Cloudflare-Anycast%20Edge%20DNS-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)](https://cloudflare.com)
[![GitHub Repo](https://img.shields.io/badge/GitHub-aswanthajay%2FLunar--Panel-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/aswanthajay/Lunar-Panel)

<br/>

[📘 **Complete VPS Installation Manual (INSTALL.md)**](INSTALL.md) &nbsp;•&nbsp; [⚡ **1-Minute VPS Update Guide**](#updating-your-panel-via-git) &nbsp;•&nbsp; [🌐 **Cloudflare Subdomain Setup**](#cloudflare-subdomain-system) &nbsp;•&nbsp; [🗄️ **Database Hub**](#advanced-database-hub)

</div>

---

## Overview

**Lunar Panel** is an ultra-modern, editorial-grade game server and cloud virtualization control panel. Designed from the ground up for high-performance hosting providers, studios, and cloud operators, Lunar Panel pairs low-latency container orchestration with a signature obsidian dark aesthetic inspired by **Carta Ink** and **Votion One™**.

All game servers and compute instances execute within securely isolated Docker containers managed by daemon nodes, while providing users with an intuitive, unified control plane.

---

## Key Feature Modules

### ✦ Cloudflare Subdomain Management System
Automate zero-port subdomain provisioning for game servers via Cloudflare's Anycast Edge DNS network:
- **Multiple Cloudflare API Accounts**: Configure and manage multiple Cloudflare accounts in Admin CP using scoped **API Tokens** (`Zone.DNS:Edit` + `Zone.Zone:Read`) or **Global API Keys** (Email + Key). All sensitive credentials are encrypted at rest via AES-256 (`Crypt::encryptString`).
- **Multiple Apex Root Domains**: Register multiple domains (e.g. `stellarhost.gg`, `playmc.xyz`, `craftserver.net`) tied to any configured Cloudflare account.
- **Protocol Routing Policies**:
  - `SRV + A Record` *(Recommended)*: Creates an A record to the allocation node and an SRV record (`_minecraft._tcp.<subdomain>.<domain>`) targeting the allocation port. Players join directly without entering port numbers.
  - `SRV Record Only`: For game engines supporting native SRV lookup.
  - `A Record Only`: Direct allocation IP resolution.
- **Admin CP Controls**: 1-click **Enable / Disable** switches for each root domain. Disabled domains are immediately hidden from client selection.
- **Client Subdomain Hub (`/server/{id}/subdomains`)**:
  - Bento metric telemetry: Active subdomains, primary gateway address, and live Cloudflare Anycast status.
  - Quick provisioning bar with reserved keyword filtering (`admin`, `panel`, `api`, `mail`, `node`, `wings`, etc.).
  - Instant live address preview (`play.stellarhost.gg`).
  - Fleet management cards with 1-click clipboard copy and deletion modal with automatic Cloudflare DNS cleanup.
- **Self-Healing Schema**: Includes an automated schema bootstrapper (`SubdomainSchemaHelper`) that auto-provisions and repairs database tables on the fly.

---

### ✦ Advanced Database Hub (`/server/{id}/databases`)
Complete overhaul of the database management suite for server owners:
- **Bento Telemetry & Quota Gauges**: Real-time graphical meter showing allocated databases versus server quota limits, coupled with dynamic search filtering across database names, usernames, and host endpoints.
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
  - Table count and physical disk storage badges.
  - Inline eye password peek & copy without regenerating passwords.
  - Quick actions for Console, Connect, Export, Import, phpMyAdmin redirect, and Password Rotation.

---

### ✦ Luxury Tree View File Explorer
- **Editorial Tree View**: Dual tree and tabular file explorer, auto-expanded by default with smooth toggle transitions.
- **File Operations**: Breadcrumb navigation, mass archive compression/decompression, fast file search, inline Monaco editor, and mobile-friendly touch controls.

---

### ✦ Custom Domains & Nginx Reverse Proxy (`/server/{id}/domains`)
- Bring your own apex or subdomain with automated Nginx reverse proxy configuration.
- Automated SSL certificate provisioning via Certbot / Let's Encrypt.
- DNS diagnostics with live A/CNAME verification.

---

### ✦ SAMP & Pawn Compiler Hub
- In-browser GTA San Andreas Multiplayer (SA-MP) Pawn script compiler.
- Real-time compiler output, error highlighting, and automated `.amx` binary deployment.

---

### ✦ Fleet Economics & Infrastructure Telemetry
- **Hardware Margin Calculator**: Real-time margin modeling factoring monthly node lease costs, power expenses, IP transit, and compute density.
- **Daemon Telemetry**: Real-time CPU, RAM, disk, and Docker container stats queried directly from active Wings daemons.

---

## Architecture & Tech Stack

| Layer | Technologies |
|---|---|
| **Backend Core** | PHP 8.2+, Laravel 10.x, MariaDB 10.6+ / MySQL 8.0+, Redis 6.0+ |
| **Frontend UI** | React 17, TypeScript 5, EasyPeasy (Redux), Tailwind CSS 3, Formik, Yup |
| **Edge DNS** | Cloudflare API v4 (Anycast Edge, SRV + A Records, `proxied: false`) |
| **Virtualization** | Go (Wings Daemon), Docker Engine, Linux Cgroups |
| **Design Language** | Carta Ink / Votion One™ Design Principles, Newsreader Serif, Inter Font |

---

## Updating Your Panel via Git

To update your existing VPS installation to the latest version of Lunar Panel:

```bash
cd /var/www/pterodactyl

# 1. Put panel into maintenance mode
php artisan down

# 2. Pull the latest code
git pull origin main

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

For full, step-by-step instructions (including MariaDB setup, SSL certificate generation, and Nginx site configs), please consult the [📘 Comprehensive Installation Guide (INSTALL.md)](INSTALL.md).

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

## Cloudflare Subdomain System

### 1. Generate Cloudflare API Token
1. In the Cloudflare Dashboard, go to **My Profile** &rarr; **API Tokens** &rarr; **Create Token**.
2. Select **Create Custom Token** with permissions:
   - `Zone` &rarr; `DNS` &rarr; `Edit`
   - `Zone` &rarr; `Zone` &rarr; `Read`
3. Under **Zone Resources**, select `Include` &rarr; `All zones` (or specific domain).
4. Save and copy the generated token.

### 2. Configure in Admin CP (`/admin/subdomains`)
1. Go to **Admin CP** &rarr; **Subdomains** (`/admin/subdomains`).
2. Click **Add Cloudflare Account**, select `API Token`, and paste your token.
3. Click **Add Domain**, enter your apex domain (e.g. `stellarhost.gg`), paste the **Zone ID** (found on your domain's Cloudflare Overview page), and select protocol `SRV + A Record`.
4. Toggle the domain **Enabled**.

### 3. Server Owner Provisioning
Server owners navigate to `/server/{id}/subdomains`, enter their desired prefix (e.g. `play`), pick the domain, select their allocation port, and click **Create Subdomain**. Cloudflare edge DNS records are created instantly.

---

## Contributing & Development

```bash
# Install frontend dependencies
yarn install

# Watch frontend changes during development
yarn run watch

# Build production assets
yarn run build:production

# Run PHP test suite
composer test
```

---

## License & Credits

- **Lunar Panel**: Developed and maintained by [Aswanth Ajay](https://github.com/aswanthajay).
- Built atop the open-source [Pterodactyl](https://github.com/pterodactyl) foundation under the [MIT License](LICENSE.md).
- Designed with **Carta Ink / Votion One™** aesthetics.
