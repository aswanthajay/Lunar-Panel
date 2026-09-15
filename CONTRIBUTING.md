# Contributing to Lunar Panel

Thank you for your interest in contributing to **Lunar Panel**! We welcome community contributions, bug reports, and enhancements that help create the ultimate cloud and game server virtualization control plane.

---

## 1. How Can You Contribute?

### ✦ Reporting Bugs
If you find a bug or unexpected behavior:
1. **Search existing issues** to see if it has already been reported.
2. If not, open a new issue using our **Bug Report** template.
3. Include clear steps to reproduce the issue, your environment details (PHP version, OS, browser, Wings daemon version), and relevant log outputs from `storage/logs/laravel-*.log` or browser devtools.

> [!NOTE]
> If you discover a security vulnerability or exploit, **do not** open a public GitHub issue. Please follow our [Security Policy](SECURITY.md) for responsible disclosure.

### ✦ Suggesting Enhancements
Feature requests and architectural suggestions are always welcome:
- Open a GitHub Issue detailing the proposed feature, the problem it solves, and why it benefits the ecosystem.
- Clearly describe your envisioned workflow or API contracts.

### ✦ Submitting Pull Requests
We accept Pull Requests that improve:
- **Core Stability & Bug Fixes**: Resolving verified issues.
- **Documentation**: Fixing typos, adding guides, or clarifying installation/upgrade steps.
- **Locales & Translations**: Adding or updating language files in `resources/lang/`.
- **Integrations**: Standard egg configurations, game templates, or daemon telemetry improvements.

---

## 2. Development Setup

### Prerequisites
- **PHP 8.2 or 8.3** with extensions (`bcmath`, `curl`, `gd`, `mbstring`, `openssl`, `pdo_mysql`, `xml`, `zip`)
- **Composer 2.x**
- **Node.js 18+** & **Yarn**
- **MySQL 8.0+** or **MariaDB 10.6+**
- **Redis 6.0+**

### Local Environment Setup
```bash
# 1. Clone the repository
git clone https://github.com/aswanthajay/Lunar-Panel.git
cd Lunar-Panel

# 2. Install PHP dependencies
composer install

# 3. Setup environment configuration
cp .env.example .env
php artisan key:generate

# 4. Run migrations
php artisan migrate --seed

# 5. Build frontend distribution assets
yarn install
yarn run build:production
```

---

## 3. Code Standards & Guidelines

- **PHP**: Adhere to [PSR-12](https://www.php-fig.org/psr/psr-12/) coding standards. Ensure code is strictly typed (`declare(strict_types=1);` where applicable) and clean.
- **Frontend**: Clean TypeScript with functional React components, typed props, and Tailwind CSS utility classes adhering to the **Carta Ink / Votion One™** minimal luxury aesthetic.
- **Commits**: Follow [Conventional Commits](https://www.conventionalcommits.org/):
  - `feat(...)`: A new feature
  - `fix(...)`: A bug fix
  - `docs(...)`: Documentation changes
  - `refactor(...)`: Code change that neither fixes a bug nor adds a feature
  - `perf(...)`: Performance improvement
  - `security(...)`: Vulnerability patches or cryptographic enhancements

---

## 4. Architecture & Proprietary Modules

Lunar Panel utilizes an enterprise architecture:
- **Base Framework**: Utilizes the battle-tested Pterodactyl open-source foundation (credited in [NOTICE.md](NOTICE.md)).
- **Proprietary Core & Licensing**: Advanced enterprise modules (such as the Cloudflare Edge DNS engine, Asymmetric RSA-2048 licensing system, Database Hub SQL engine, Game Managers, and signature Carta Ink visual components) are proprietary intellectual property governed by the [Lunar Panel Commercial License](LICENSE.md). Modifying or attempting to tamper with encrypted bytecode modules will trigger HMAC tamper protections.

---

## 5. Community & Support

- **Repository**: [https://github.com/aswanthajay/Lunar-Panel](https://github.com/aswanthajay/Lunar-Panel)
- **Issues & Discussions**: [GitHub Issues](https://github.com/aswanthajay/Lunar-Panel/issues)
- **Contact**: Aswanth Ajay ([aswanthajay@proton.me](mailto:aswanthajay@proton.me)) | [support@votioncloud.online](mailto:support@votioncloud.online)
