# Upgrading from Existing Pterodactyl to Lunar Panel (Zero Data Loss Guide)

This guide provides a production-tested, step-by-step procedure for upgrading an existing vanilla **Pterodactyl** installation to **Lunar Panel** with **zero data loss**.

All of your game servers, databases, files, users, allocations, eggs, and Wings nodes will remain 100% intact.

---

## Table of Contents
1. [Core Data Integrity Principles](#core-data-integrity-principles)
2. [Pre-Upgrade Checklist](#pre-upgrade-checklist)
3. [Method 1: Atomic Side-by-Side Upgrade (Recommended)](#method-1-atomic-side-by-side-upgrade-recommended)
   - [Step 1: Maintenance Mode & Safety Backups](#step-1-maintenance-mode--safety-backups)
   - [Step 2: Download & Prepare Lunar Panel](#step-2-download--prepare-lunar-panel)
   - [Step 3: Install PHP Dependencies & Run Migrations](#step-3-install-php-dependencies--run-migrations)
   - [Step 4: Set Webserver File Permissions](#step-4-set-webserver-file-permissions)
   - [Step 5: Atomic Directory Swap & Service Restart](#step-5-atomic-directory-swap--service-restart)
   - [Step 6: Bring Panel Live](#step-6-bring-panel-live)
4. [Method 2: In-Place Git Upgrade](#method-2-in-place-git-upgrade)
5. [Post-Upgrade Verification Checklist](#post-upgrade-verification-checklist)
6. [Instant 60-Second Rollback Procedure](#instant-60-second-rollback-procedure)
7. [Frequently Asked Questions (FAQ)](#frequently-asked-questions-faq)

---

## Core Data Integrity Principles

Understanding how Pterodactyl and Lunar Panel store data explains why this upgrade is safe:

1. **Game Server Files Live on Wings Nodes, NOT the Web Panel**:
   All container data, Minecraft worlds, Discord bots, and server files are stored on each node under `/var/lib/pterodactyl/volumes`. Upgrading the web panel (`/var/www/pterodactyl`) does not alter or touch any server files on any node.
2. **Database Migrations are Strictly Additive**:
   Lunar Panel's migrations only add new features (e.g., Support Ticket tables, renewal billing columns, passkeys, and subdomains). Existing tables (`servers`, `users`, `nodes`, `allocations`, `mounts`, `eggs`) are preserved completely.
3. **The #1 Golden Rule — NEVER LOSE OR REGENERATE `APP_KEY`**:
   > [!CAUTION]
   > Your `.env` file contains your unique `APP_KEY`. All server database passwords, Wings communication tokens, and 2FA secrets are encrypted with this key. **Never run `php artisan key:generate`** during an upgrade, and always preserve your original `.env` file!

---

## Pre-Upgrade Checklist

Before starting, verify your server meets the minimum requirements:

- **Operating System**: Ubuntu 20.04 / 22.04 / 24.04 LTS, Debian 11 / 12, or AlmaLinux / Rocky Linux 8 / 9.
- **PHP Version**: PHP 8.2 or PHP 8.3 with required extensions (`php-fpm`, `php-mysql`, `php-mbstring`, `php-bcmath`, `php-xml`, `php-curl`, `php-zip`, `php-gd`, `php-intl`, `php-redis`).
- **Composer**: Composer 2.x installed.
- **Root / Sudo Access**: Full administrative access to the panel server.

Check your versions:
```bash
php -v
composer -V
```

---

## Method 1: Atomic Side-by-Side Upgrade (Recommended)

This method prepares the new panel in `/var/www/lunar-panel` while keeping your existing panel untouched until the very final step. If anything goes wrong, your original panel is still completely preserved.

### Step 1: Maintenance Mode & Safety Backups

Log into your VPS via SSH as `root` (or use `sudo`):

```bash
# 1. Navigate to existing panel
cd /var/www/pterodactyl

# 2. Put panel into maintenance mode
php artisan down

# 3. Create a dedicated backup folder
mkdir -p /root/panel_backups
cd /root/panel_backups

# 4. Dump your MySQL/MariaDB database (Replace with your DB credentials from .env)
mysqldump -u root -p pterodactyl > "panel_backup_$(date +%F_%H-%M).sql"

# 5. Backup your critical configuration (.env) and storage uploads
cp /var/www/pterodactyl/.env /root/panel_backups/.env.backup
cp -r /var/www/pterodactyl/storage /root/panel_backups/storage_backup
```

---

### Step 2: Download & Prepare Lunar Panel

```bash
# 1. Clone the Lunar Panel repository into a temporary directory
git clone https://github.com/aswanthajay/Lunar-Panel.git /var/www/lunar-panel

# 2. Navigate to the new panel directory
cd /var/www/lunar-panel

# 3. Switch to the main release branch
git checkout main
git pull

# 4. Copy your existing configuration and user storage
cp /var/www/pterodactyl/.env /var/www/lunar-panel/.env
cp -rn /var/www/pterodactyl/storage/app /var/www/lunar-panel/storage/
```

---

### Step 3: Install PHP Dependencies & Run Migrations

```bash
cd /var/www/lunar-panel

# 1. Automatically install ionCube Loader Bytecode Extension
sudo bash scripts/install-ioncube.sh

# 2. Install production PHP dependencies
composer install --no-dev --optimize-autoloader --no-interaction

# 3. Run additive database migrations
# This safely provisions new Lunar tables (tickets, billing, subdomains, passkeys)
php artisan migrate --seed --force

# 4. Clear and cache framework optimization layers
php artisan view:clear
php artisan config:clear
php artisan route:clear
php artisan cache:clear
php artisan optimize
```

> [!NOTE]
> All production frontend JavaScript and CSS assets (`bundle.*.js`, `dashboard.*.js`, `votion.css`, `manifest.json`) are already pre-compiled in the Git repository. **You do not need Node.js or Yarn installed on your server.**

---

### Step 4: Set Webserver File Permissions

Set the appropriate webserver user permissions:

```bash
# For Ubuntu / Debian:
chown -R www-data:www-data /var/www/lunar-panel/*
chmod -R 755 /var/www/lunar-panel/storage /var/www/lunar-panel/bootstrap/cache

# For CentOS / AlmaLinux / Rocky Linux:
# chown -R nginx:nginx /var/www/lunar-panel/*
# chmod -R 755 /var/www/lunar-panel/storage /var/www/lunar-panel/bootstrap/cache
```

---

### Step 5: Atomic Directory Swap & Service Restart

Swap the directory pointers so your web server serves Lunar Panel:

```bash
# 1. Archive previous panel directory
mv /var/www/pterodactyl /var/www/pterodactyl-old

# 2. Move Lunar Panel to active production location
mv /var/www/lunar-panel /var/www/pterodactyl

# 3. Restart queue worker and web services
php artisan queue:restart
systemctl restart pteroq
systemctl restart php8.2-fpm    # (or php8.3-fpm depending on your installed PHP version)
systemctl restart nginx
```

---

### Step 6: Bring Panel Live

```bash
cd /var/www/pterodactyl
php artisan up
```

Your upgrade is complete! Log into your panel to verify your new Lunar / Stellar interface.

---

## Method 2: In-Place Git Upgrade

Use this method if `/var/www/pterodactyl` was already installed via Git and you prefer upgrading directly in-place:

```bash
cd /var/www/pterodactyl

# 1. Backup critical files first
cp .env /root/.env.backup
mysqldump -u root -p pterodactyl > /root/pterodactyl_before_lunar.sql

# 2. Enable maintenance mode
php artisan down

# 3. Configure Git remote for Lunar Panel
git remote add lunar https://github.com/aswanthajay/Lunar-Panel.git 2>/dev/null || git remote set-url lunar https://github.com/aswanthajay/Lunar-Panel.git
git fetch lunar

# 4. Checkout the latest Lunar release
git checkout -B main lunar/main

# 5. Restore .env
cp /root/.env.backup .env

# 6. Install dependencies and run migrations
composer install --no-dev --optimize-autoloader --no-interaction
php artisan migrate --seed --force

# 7. Clear caches & restart queue
php artisan view:clear
php artisan config:clear
php artisan route:clear
php artisan cache:clear
php artisan optimize
php artisan queue:restart
systemctl restart pteroq
systemctl restart php8.2-fpm    # or php8.3-fpm
systemctl restart nginx

# 8. Set permissions & bring panel online
chown -R www-data:www-data /var/www/pterodactyl/*
chmod -R 755 storage bootstrap/cache
php artisan up
```

---

## Post-Upgrade Verification Checklist

After upgrading, perform these quick checks:

1. **Dashboard & Fleet View (`/` & `/instances`)**:
   - Verify that your servers and containers are listed with accurate names and allocations.
   - Verify live RAM and CPU utilization gauges display real-time metrics without `/ ∞` suffixes.
2. **Server Console & WebSockets**:
   - Enter any server and verify that console output, command sending, and power actions (`Start`, `Restart`, `Stop`) work smoothly.
3. **Wings Nodes (`/admin/nodes`)**:
   - Check that all daemon nodes show green and responsive with authentic heartbeat status.
4. **New Feature Hubs**:
   - **Support Tickets**: Verify `/support` loads the new ticket ecosystem.
   - **Backup Bento Grid**: Navigate to `/server/{id}/backups` to explore the redesigned backup management interface.
   - **Live Download Tracker**: Test downloading a file or backup and watch the real-time speed, ETA, and server attribution progress bar in the top navigation bar.

---

## Instant 60-Second Rollback Procedure

In the unlikely event you need to revert back to your previous vanilla panel:

```bash
# 1. Put panel into maintenance
cd /var/www/pterodactyl
php artisan down

# 2. Swap back directory to the original backup
mv /var/www/pterodactyl /var/www/lunar-panel-failed
mv /var/www/pterodactyl-old /var/www/pterodactyl

# 3. Restore database snapshot (if you want to revert schema changes)
mysql -u root -p pterodactyl < /root/panel_backups/panel_backup_*.sql

# 4. Restart services
cd /var/www/pterodactyl
php artisan queue:restart
systemctl restart pteroq
systemctl restart php8.2-fpm
systemctl restart nginx
php artisan up
```

---

## Frequently Asked Questions (FAQ)

### Will my existing game servers or Minecraft worlds be deleted?
**No.** Game files and container data are stored exclusively on your Wings daemon servers under `/var/lib/pterodactyl/volumes`. Upgrading the web panel does not delete or touch these volumes.

### Do I need to reconfigure Wings?
**No.** Lunar Panel is 100% compatible with official Wings daemon (v1.11+). Because your `.env` and `APP_KEY` are preserved, all node keys and tokens decrypt seamlessly.

### Do I need Node.js or Yarn installed on my VPS?
**No.** All production assets (`votion.css`, `bundle.js`, `dashboard.js`, `server.js`) are pre-compiled and bundled directly inside the GitHub repository. Running `composer install` is all that is required.

### What if I get an HTTP 500 error after upgrading?
1. Check the Laravel error log: `tail -n 100 /var/www/pterodactyl/storage/logs/laravel-$(date +%F).log`.
2. Check file permissions: ensure `/var/www/pterodactyl/storage` and `bootstrap/cache` are owned by `www-data` (or `nginx`).
3. Clear caches: run `php artisan view:clear && php artisan config:clear && php artisan cache:clear`.
