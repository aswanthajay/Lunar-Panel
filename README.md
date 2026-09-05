<div align="center">

# Lunar Panel

**Next-generation game server & cloud infrastructure management platform engineered with Carta Ink / Votion One™ design principles.**

[![License: MIT](https://img.shields.io/badge/License-MIT-black.svg?style=for-the-badge)](LICENSE.md)
[![PHP: ^8.2](https://img.shields.io/badge/PHP-8.2%2B-777BB4?style=for-the-badge&logo=php&logoColor=white)](https://php.net)
[![React: ^17](https://img.shields.io/badge/React-17.x-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactjs.org)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.x-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![GitHub Repo](https://img.shields.io/badge/GitHub-aswanthajay%2FLunar--Panel-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/aswanthajay/Lunar-Panel)

</div>

---

## Overview

**Lunar Panel** is an ultra-modern, editorial-grade game server and cloud virtualization control panel. Designed from the ground up for high-performance hosting providers, studios, and cloud operators, Lunar Panel pairs low-latency container orchestration with a signature obsidian dark aesthetic inspired by **Carta Ink** and **Votion One™**.

All game servers and compute instances execute within securely isolated Docker containers managed by daemon nodes, while providing users with an intuitive, unified control plane.

---

## Key Highlights & Features

### ✦ Editorial Carta Ink Design System
- **Luxury Dark & Carta Ink Surfaces**: Pure obsidian black surfaces (`#000000` / `#0A0A0A`), crisp `#242424` borders, and high-contrast typography powered by our signature **Newsreader** editorial serif and **Inter** font family.
- **Votion Authentic Preloader**: Fullscreen pulsing metallic branding with smooth cubic-bezier transitions, zero white flashes, and unified in-app route loaders.
- **Refined Telemetry & Navigation**: Responsive sidebar with collapsible **Essentials** quick-access drawers, live server status beacons, and unified product app switchers.

### ✦ Infrastructure Telemetry & Hardware Cost Basis
- **Live Daemon Telemetry**: Real-time RAM, disk, server allocations, and node specifications queried directly from active daemon nodes.
- **Fleet Margin & Break-Even Calculator**: Real-time margin modeling factoring monthly node lease costs, power expenses, IP transit, and compute density.

### ✦ Identity & Self-Service Account Portal
- **Profile Management**: Direct client-side editing for **First Name**, **Last Name**, and **Username** handles with cryptographic password authentication.
- **Security & Access**: Native Two-Factor Authentication (TOTP), public SSH key deployment, and fine-grained API access token generation.

### ✦ Automated Domain Management
- **Automated Routing & Proxying**: Nginx reverse proxy configuration, automated SSL certificate generation, and seamless port mapping for custom game subdomains.

---

## Architecture & Tech Stack

| Layer | Technologies |
|---|---|
| **Backend Core** | PHP 8.2+, Laravel Framework, MariaDB / MySQL, Redis |
| **Frontend UI** | React, TypeScript, EasyPeasy (Redux), Tailwind CSS, Formik, Yup |
| **Daemon & Runtime** | Go (Wings Daemon), Docker Engine, Linux Cgroups |
| **Aesthetics** | Carta Ink / Votion One Design Language, Newsreader Serif, Inter |

---

## Installation & Deployment

### Prerequisites
- **Operating System**: Linux (Ubuntu 22.04 LTS / 24.04 LTS, Debian 12, Rocky Linux 9)
- **PHP**: `8.2` or `8.3` with extensions (`cli`, `openssl`, `pdo_mysql`, `mbstring`, `tokenizer`, `xml`, `bcmath`, `curl`, `gd`, `zip`)
- **Database**: MariaDB 10.6+ or MySQL 8.0+
- **Cache / Queue**: Redis 6.0+
- **Web Server**: Nginx with SSL (Certbot / Let's Encrypt)
- **Node.js & Yarn**: Node 18+ & Yarn 1.22+

### Quick Start

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/aswanthajay/Lunar-Panel.git /var/www/lunar-panel
   cd /var/www/lunar-panel
   ```

2. **Install PHP Dependencies**:
   ```bash
   composer install --no-dev --optimize-autoloader
   ```

3. **Configure Environment**:
   ```bash
   cp .env.example .env
   php artisan key:generate --force
   ```

4. **Initialize Database**:
   ```bash
   php artisan migrate --seed --force
   ```

5. **Build Frontend Assets**:
   ```bash
   yarn install
   yarn run build:production
   ```

6. **Set Permissions**:
   ```bash
   chown -R www-data:www-data /var/www/lunar-panel/storage /var/www/lunar-panel/bootstrap/cache
   chmod -R 755 /var/www/lunar-panel/storage /var/www/lunar-panel/bootstrap/cache
   ```

---

## Supported Workloads & Games

Lunar Panel supports any Docker-compatible server image or game server egg, including:
- **Minecraft** (Paper, Purpur, Velocity, Fabric, Forge, BungeeCord, Bedrock)
- **Steam & Source Games** (Rust, Counter-Strike 2, Team Fortress 2, Garry's Mod, ARK: Survival Evolved)
- **Survival & Sandbox** (Palworld, Valheim, Terraria, Enshrouded, Project Zomboid)
- **Voice & Automation** (Discord Bots, Voice Servers, Node.js / Python microservices)

---

## Contributing & Development

Contributions, bug reports, and feature requests are welcome!

```bash
# Watch frontend changes during development
yarn run watch

# Run test suite
composer test
```

---

## License & Credits

- **Lunar Panel**: Developed and maintained by [Aswanth Ajay](https://github.com/aswanthajay).
- Built atop the open-source [Pterodactyl](https://github.com/pterodactyl) foundation under the [MIT License](LICENSE.md).
