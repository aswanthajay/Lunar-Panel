# Lunar Panel — Complete Installation & Deployment Guide

This guide provides comprehensive, production-tested instructions for installing, configuring, and updating **Lunar Panel** on a fresh Linux VPS (Ubuntu 22.04 / 24.04 LTS or Debian 12), as well as configuring the **Cloudflare Subdomain System** and **Database Hub**.

---

## Table of Contents
1. [System Requirements](#system-requirements)
2. [Fresh Installation (Ubuntu / Debian)](#fresh-installation-ubuntu--debian)
   - [Step 1: Install Required Dependencies](#step-1-install-required-dependencies)
   - [Step 2: Install Composer & Node.js](#step-2-install-composer--nodejs)
   - [Step 3: Configure MariaDB Database](#step-3-configure-mariadb-database)
   - [Step 4: Download & Install Lunar Panel](#step-4-download--install-lunar-panel)
   - [Step 5: Environment & Encryption Setup](#step-5-environment--encryption-setup)
   - [Step 6: Database Migrations & Initial Admin](#step-6-database-migrations--initial-admin)
   - [Step 7: Build Production UI Assets](#step-7-build-production-ui-assets)
   - [Step 8: Configure Cron & Systemd Queue Worker](#step-8-configure-cron--systemd-queue-worker)
   - [Step 9: Configure Nginx with SSL](#step-9-configure-nginx-with-ssl)
3. [Updating Existing Installations (Git Pull)](#updating-existing-installations-git-pull)
4. [Cloudflare Subdomain System Setup](#cloudflare-subdomain-system-setup)
   - [Creating a Cloudflare API Token](#creating-a-cloudflare-api-token)
   - [Adding Cloudflare Account in Admin CP](#adding-cloudflare-account-in-admin-cp)
   - [Registering Apex Root Domains](#registering-apex-root-domains)
   - [Managing Domains & Protocols](#managing-domains--protocols)
   - [Client Subdomain Provisioning](#client-subdomain-provisioning)
5. [Database Hub Setup](#database-hub-setup)
6. [Troubleshooting & Maintenance](#troubleshooting--maintenance)

---

## System Requirements

| Component | Minimum Specification | Recommended |
|---|---|---|
| **Operating System** | Ubuntu 22.04 LTS / Debian 12 | Ubuntu 24.04 LTS |
| **CPU** | 2 Virtual Cores (x86_64) | 4+ Cores |
| **RAM** | 2 GB | 4 GB+ |
| **Storage** | 20 GB SSD / NVMe | 50 GB+ NVMe |
| **PHP Version** | PHP 8.2 or 8.3 | PHP 8.2 / 8.3 |
| **Database** | MariaDB 10.6+ or MySQL 8.0+ | MariaDB 10.11 LTS |
| **Web Server** | Nginx with HTTP/2 & SSL | Nginx |
| **Queue / Cache** | Redis 6.0+ | Redis 7+ |

---

## Fresh Installation (Ubuntu / Debian)

### Step 1: Install Required Dependencies

Update package repositories and install core system utilities:

```bash
apt update && apt upgrade -y
apt install -y software-properties-common curl apt-transport-https ca-certificates gnupg lsb-release git unzip tar

# Add PHP PPA repository (Ubuntu)
add-apt-repository -y ppa:ondrej/php
apt update

# Install PHP 8.2 and necessary extensions
apt install -y php8.2 php8.2-{cli,common,fpm,mysql,mbstring,bcmath,xml,curl,zip,gd,intl,redis,tokenizer}

# Install MariaDB Server, Redis, and Nginx
apt install -y mariadb-server redis-server nginx
systemctl enable --now mariadb redis-server nginx
```

---

### Step 2: Install Composer & Node.js

```bash
# Install Composer (PHP Dependency Manager)
curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer

# Install Node.js 18.x LTS & Yarn
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs
npm install -g yarn
```

Verify versions:
```bash
php -v
composer -V
node -v
yarn -v
```

---

### Step 3: Configure MariaDB Database

Secure your database and create the panel database and user:

```bash
mariadb -u root
```

Execute the following SQL commands (replace `your_secure_password` with a strong random secret):

```sql
CREATE DATABASE pterodactyl CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'pterodactyl'@'127.0.0.1' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON pterodactyl.* TO 'pterodactyl'@'127.0.0.1' WITH GRANT OPTION;
FLUSH PRIVILEGES;
EXIT;
```

---

### Step 4: Download & Install Lunar Panel

```bash
# Create directory
mkdir -p /var/www/pterodactyl
cd /var/www/pterodactyl

# Clone the official repository
git clone https://github.com/aswanthajay/Lunar-Panel.git /var/www/pterodactyl

# Install PHP dependencies
COMPOSER_ALLOW_SUPERUSER=1 composer install --no-dev --optimize-autoloader
```

---

### Step 5: Environment & Encryption Setup

```bash
# Copy example environment configuration
cp .env.example .env

# Generate application encryption key
php artisan key:generate --force
```

Configure your environment settings:
```bash
nano .env
```

Ensure the following variables are accurately configured:
```ini
APP_NAME="Lunar"
APP_ENV=production
APP_DEBUG=false
APP_THEME=pterodactyl
APP_URL=https://panel.yourdomain.com
APP_TIMEZONE=UTC

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=pterodactyl
DB_USERNAME=pterodactyl
DB_PASSWORD=your_secure_password

CACHE_DRIVER=redis
SESSION_DRIVER=redis
QUEUE_CONNECTION=redis
REDIS_HOST=127.0.0.1
REDIS_PASSWORD=null
REDIS_PORT=6379
```

---

### Step 6: Database Migrations & Initial Admin

```bash
# Run database migrations (creates core and subdomain tables)
php artisan migrate --seed --force

# Create the initial root administrator account
php artisan p:user:make
```

Follow the interactive prompts to specify:
- Administrator email
- Username
- First and last name
- Strong password

---

### Step 7: Build Production UI Assets

The repository contains pre-compiled assets in `public/assets/`. If you wish to build or rebuild fresh production assets:

```bash
yarn install
yarn run build:production
```

---

### Step 8: Configure Cron & Systemd Queue Worker

#### 1. Setup Scheduled Cron Jobs
Open root's crontab:
```bash
crontab -e
```
Add this line at the bottom:
```cron
* * * * * php /var/www/pterodactyl/artisan schedule:run >> /dev/null 2>&1
```

#### 2. Create Queue Worker Systemd Service
Create the service unit file:
```bash
nano /etc/systemd/system/pteroq.service
```

Paste the configuration:
```ini
[Unit]
Description=Pterodactyl Queue Worker
After=redis-server.service

[Service]
User=www-data
Group=www-data
Restart=always
ExecStart=/usr/bin/php /var/www/pterodactyl/artisan queue:work --queue=high,standard,low --sleep=3 --tries=3
StartLimitInterval=0
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable and start the queue service:
```bash
systemctl daemon-reload
systemctl enable --now pteroq.service
```

---

### Step 9: Configure Nginx with SSL

#### 1. Install Certbot (Let's Encrypt)
```bash
apt install -y certbot python3-certbot-nginx
```

#### 2. Issue SSL Certificate
```bash
certbot certonly --nginx -d panel.yourdomain.com
```

#### 3. Create Nginx Site Configuration
```bash
nano /etc/nginx/sites-available/pterodactyl.conf
```

Paste the following production Nginx block (replace `panel.yourdomain.com` with your FQDN):

```nginx
server {
    listen 80;
    server_name panel.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name panel.yourdomain.com;

    root /var/www/pterodactyl/public;
    index index.html index.htm index.php;
    charset utf-8;

    ssl_certificate /etc/letsencrypt/live/panel.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/panel.yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    client_max_body_size 100m;
    client_body_timeout 120s;
    sendfile off;

    add_header X-Content-Type-Options "nosniff";
    add_header X-XSS-Protection "1; mode=block";
    add_header X-Robots-Tag "none";
    add_header Content-Security-Policy "frame-ancestors 'self'";
    add_header X-Frame-Options "SAMEORIGIN";
    add_header Referrer-Policy "same-origin";

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \.php$ {
        fastcgi_split_path_info ^(.+\.php)(/.+)$;
        fastcgi_pass unix:/run/php/php8.2-fpm.sock;
        fastcgi_index index.php;
        include fastcgi_params;
        fastcgi_param PHP_VALUE "upload_max_filesize = 100M \n post_max_size = 100M";
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        fastcgi_param HTTP_PROXY "";
        fastcgi_intercept_errors off;
        fastcgi_buffer_size 16k;
        fastcgi_buffers 4 16k;
        fastcgi_connect_timeout 300;
        fastcgi_send_timeout 300;
        fastcgi_read_timeout 300;
    }

    location ~ /\.ht {
        deny all;
    }
}
```

Enable configuration and test:
```bash
ln -s /etc/nginx/sites-available/pterodactyl.conf /etc/nginx/sites-enabled/pterodactyl.conf
nginx -t
systemctl reload nginx
```

#### 4. Final Permissions
```bash
chown -R www-data:www-data /var/www/pterodactyl/*
chmod -R 755 /var/www/pterodactyl/storage /var/www/pterodactyl/bootstrap/cache
```

---

## Updating Existing Installations (Git Pull)

Whenever new features, security updates, or fixes are released on GitHub, update your panel using this standardized sequence:

```bash
cd /var/www/pterodactyl

# 1. Put panel in maintenance mode
php artisan down

# 2. Pull latest code from main branch
git pull origin main

# 3. Update dependencies (if composer.json changed)
COMPOSER_ALLOW_SUPERUSER=1 composer install --no-dev --optimize-autoloader

# 4. Run database migrations
php artisan migrate --force

# 5. Clear and refresh caches
php artisan view:clear
php artisan route:clear
php artisan config:clear
php artisan cache:clear

# 6. Re-apply file permissions
chown -R www-data:www-data /var/www/pterodactyl/*
chmod -R 755 /var/www/pterodactyl/storage /var/www/pterodactyl/bootstrap/cache

# 7. Bring panel online and restart queue
php artisan up
php artisan queue:restart
```

---

## Cloudflare Subdomain System Setup

The **Subdomain Manager** allows hosting administrators to configure multiple Cloudflare accounts and root domains so that server owners can create zero-port addresses (`play.stellarhost.gg`) mapped to their server allocations via Cloudflare Edge DNS.

### Creating a Cloudflare API Token

1. Log in to your [Cloudflare Dashboard](https://dash.cloudflare.com).
2. Click your profile avatar in the upper right corner &rarr; **My Profile** &rarr; **API Tokens**.
3. Click **Create Token** &rarr; select **Create Custom Token**.
4. Configure the token:
   - **Token name**: `Lunar Panel Subdomain Manager`
   - **Permissions**:
     - `Zone` &rarr; `DNS` &rarr; `Edit`
     - `Zone` &rarr; `Zone` &rarr; `Read`
   - **Zone Resources**:
     - `Include` &rarr; `All zones` (or `Specific zone` &rarr; choose your target domain)
5. Click **Continue to summary** &rarr; **Create Token**.
6. Copy your generated API Token.

*(Alternatively, you can use your Cloudflare Account Email + Global API Key, but an API Token is recommended for security).*

---

### Adding Cloudflare Account in Admin CP

1. Navigate to your panel's Admin Area: `https://panel.yourdomain.com/admin/subdomains`.
2. Scroll to the **Cloudflare API Accounts** card and click **Add Cloudflare Account**.
3. Enter:
   - **Friendly Name**: e.g. `Primary Cloudflare Account`
   - **Authentication Method**: `API Token (Recommended)`
   - **API Token**: Paste the token generated above.
4. Click **Verify & Add Account**. The panel immediately queries Cloudflare to verify credentials and lists available zones.

---

### Registering Apex Root Domains

1. On the same page (`/admin/subdomains`), click **Add Domain** under **Available Root Domains**.
2. Fill in the fields:
   - **Cloudflare Account**: Select the account linked above.
   - **Domain Name**: The apex root domain (e.g. `stellarhost.gg` or `playmc.xyz` — without `http://` or subdomains).
   - **Cloudflare Zone ID**:
     - Open your domain in the Cloudflare dashboard.
     - On the **Overview** page, scroll down on the right sidebar to find **API** &rarr; **Zone ID**.
     - Copy the 32-character Zone ID string.
   - **Record Protocol Policy**:
     - `SRV + A Record` *(Recommended)*: Creates an A record to the node IP and an SRV record (`_minecraft._tcp`) containing the allocation port. Players join directly using `play.yourdomain.gg` without typing ports.
     - `SRV Record Only`: For SRV-only game engines.
     - `A Record Only`: Direct A record mapping.
   - **Enable Domain immediately**: Checked.
3. Click **Save Domain**.

---

### Managing Domains & Protocols

- **Toggle Enabled / Disabled**: Admins can enable or disable domains at any time using the 1-click status switch. Disabled domains are instantly hidden from clients.
- **Delete Domain**: Safely deletes the domain and cascades to clean up all active subdomains and their Cloudflare DNS records.

---

### Client Subdomain Provisioning

Server owners can navigate to:
`Server Dashboard` &rarr; **Subdomains** (or `/server/{id}/subdomains`):

1. Enter a prefix (e.g. `play`, `survival`, `skyblock`).
2. Select an active root domain from the dropdown.
3. Select the target server allocation port (defaults to primary port).
4. Review the live preview (`play.stellarhost.gg`).
5. Click **Create Subdomain**.
6. The panel instantly provisions the records on Cloudflare Anycast edge with `proxied: false`.
7. Players can connect immediately using `play.stellarhost.gg`.

---

## Database Hub Setup

The **Database Hub** provides server owners with full self-service database control:

1. **Quota & Bento Telemetry**: Live graphical gauge displaying used databases versus server allocation limit.
2. **Interactive In-Browser SQL Runner**:
   - Execute queries directly within the browser console.
   - Quick template shortcuts: `SHOW TABLES`, `CHECK TABLE`, `OPTIMIZE TABLE`, `SELECT COUNT`.
   - Microsecond execution timer and tabular data viewer.
3. **Multi-Stack Connection Cheat Sheet**:
   - Ready-to-copy connection snippets for:
     - `.env` / Laravel
     - Node.js (Prisma / mysql2 / TypeORM)
     - Python (SQLAlchemy / Django / PyMySQL)
     - PHP PDO / WordPress `wp-config.php`
     - Java JDBC (Spring Boot / PaperMC plugins)
     - Terminal CLI (`mysql -h ... -u ... -p`)
4. **Enhanced Row Controls**:
   - Live ping/health latency status.
   - Table count and physical storage size metrics.
   - Inline eye password peek & copy.
   - One-click password rotation and phpMyAdmin redirect.

---

## Troubleshooting & Maintenance

### Common Fixes

#### 1. "Subdomain database tables not found"
Run:
```bash
php artisan migrate --force
```
*(The panel includes an automatic schema bootstrapper that self-heals tables on page load if migrations were bypassed).*

#### 2. Views or Routes Not Updating
Clear all Laravel cached states:
```bash
php artisan view:clear
php artisan route:clear
php artisan config:clear
php artisan cache:clear
```

#### 3. Cloudflare API Error: "Zone not found" or "Unauthorized"
- Verify that your Cloudflare API Token has `Zone.DNS:Edit` and `Zone.Zone:Read` permissions.
- Ensure the token includes the specific zone where your root domain resides.
- Ensure the **Zone ID** entered in `/admin/subdomains` matches the exact string shown on your domain's Cloudflare Overview page.

#### 4. Game Clients Cannot Connect to Subdomain
- Verify the DNS record in Cloudflare has `proxied: false` (Grey cloud, DNS only). Game traffic (TCP/UDP) cannot pass through Cloudflare's HTTP CDN reverse proxy.
- For Minecraft, ensure the SRV record has target pointing to the subdomain FQDN (`play.yourdomain.gg`) and port matching your allocation port.

#### 5. Inspecting Application Logs
```bash
tail -n 100 -f /var/www/pterodactyl/storage/logs/laravel-$(date +%F).log
```
