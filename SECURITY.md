# Security Policy

At **Lunar Panel** and **Votion Cloud**, security and integrity are paramount. We take the security of our platform, our infrastructure operators, and the millions of game server instances powered by our software very seriously.

---

## 1. Supported Versions

Only the latest active releases of Lunar Panel receive continuous security updates, vulnerability patches, and cryptographic seal updates.

| Release Branch / Tag | Supported | Security Maintenance Status |
|:---|:---:|:---|
| **Lunar Panel 2.x (`stellar` / `main`)** | :white_check_mark: | **Active Support** (Continuous Patches & Audits) |
| **Vanilla Pterodactyl 1.11.x Migrations** | :white_check_mark: | **Supported via [UPGRADE.md](UPGRADE.md)** |
| **Legacy Forks / Pre-1.0** | :x: | **End of Life** (No updates provided) |

---

## 2. Reporting a Vulnerability

If you believe you have discovered a security vulnerability in Lunar Panel, please practice **responsible disclosure** and report it directly to our security team:

- **Security Team Lead**: Aswanth Ajay ([aswanthajay@proton.me](mailto:aswanthajay@proton.me))
- **Operations & Security**: [security@votioncloud.online](mailto:security@votioncloud.online)

> [!CAUTION]
> **Please DO NOT open a public GitHub issue, discussion, or social media post regarding unpatched vulnerabilities.** Public disclosure before a fix is released endangers active infrastructure across the community.

### What to Include in Your Report
To help us triage and resolve the issue quickly, please provide:
1. A clear description of the vulnerability and its potential impact.
2. Step-by-step reproduction instructions or a minimal Proof of Concept (PoC).
3. Affected components, endpoints, or controllers.
4. Any potential mitigations or suggested fixes you have identified.

### Response & Remediation SLA
- **Initial Acknowledgment**: Within **24 to 48 hours** of report receipt.
- **Triage & Assessment**: Severity rating (CVSS) and reproduction confirmation within **72 hours**.
- **Coordinated Release**: Security patch and advisory published within **14 to 30 days**, giving operators time to update before public disclosure.

---

## 3. Cryptographic Architecture & Tamper Resistance

Lunar Panel employs an enterprise-grade, multi-tiered security defense to protect intellectual property and ensure operational integrity:

### ✦ Asymmetric RSA-2048 Licensing Core
All system license grants are signed offline using an RSA-2048 private key. Runtime validation in [`LicenseManager.php`](app/Services/Licensing/LicenseManager.php) verifies signatures against the embedded public key using `OPENSSL_ALGO_SHA256`. Keys cannot be mathematically spoofed, brute-forced, or forged.

### ✦ AES-256-CBC Bytecode Encryption
Proprietary backend controllers and services are compiled and encrypted using high-entropy AES-256-CBC cipher envelopes. Public repository viewers cannot inspect, copy, or manipulate raw source routines.

### ✦ HMAC-SHA256 Self-Destruct Tamper Seals
Every encrypted module contains a cryptographic HMAC-SHA256 integrity seal. The application verifies code integrity on every single execution. If even **one byte** of code is altered, cracked, or manipulated, execution immediately aborts:
```
Fatal error: Lunar Panel core integrity violation. Code has been tampered with or modified.
```

### ✦ Automated ionCube Loader Integration
Includes an automated, single-command installer script ([`scripts/install-ioncube.sh`](scripts/install-ioncube.sh)) that provisions architecture-optimized ionCube loaders (`x86_64` / `aarch64`) across PHP 8.1, 8.2, and 8.3 environments.

---

## 4. Safe Harbor Policy

We consider security research conducted under this policy to be authorized and protected under Safe Harbor:
- You make a good-faith effort to avoid privacy violations, destruction of data, and interruption or degradation of production services.
- You do not access, alter, or retain user data without explicit permission.
- You give us reasonable time to remediate the vulnerability prior to public disclosure.
