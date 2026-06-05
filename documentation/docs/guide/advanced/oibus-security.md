---
sidebar_position: 2
---

# OIBus Security

## Credential Storage

### Login Passwords

User passwords are hashed with **Argon2** before being stored in `oibus.db`. The plaintext password is
never persisted — only the hash. Argon2 is a memory-hard hashing function designed to resist brute-force
and GPU-accelerated attacks.

### Connector Secrets

Passwords, tokens, and API keys configured in South and North connectors are encrypted at rest using
**AES-256-CBC**:

- A 256-bit key and a 128-bit initialisation vector (IV) are generated with a cryptographically secure
  random number generator during OIBus initialisation.
- The key and IV are stored as base64 strings in **`crypto.db`** — a separate SQLite database from the
  main configuration database.
- Encrypted secrets are stored in **`oibus.db`** and can only be decrypted when both databases are
  present.

:::danger Protect crypto.db
If `crypto.db` is deleted or lost, OIBus can no longer decrypt any connector secret. All secrets must
be re-entered after restarting OIBus. Treat `crypto.db` with the same care as a private key file.
:::

### Database Layout

OIBus uses four SQLite databases in the data folder:

| Database        | Contents                                                                                                   |
| --------------- | ---------------------------------------------------------------------------------------------------------- |
| **`oibus.db`**  | All configuration: connectors, items, scan modes, IP filters, users (hashed passwords), encrypted secrets. |
| **`crypto.db`** | AES-256-CBC key and IV used to encrypt/decrypt connector secrets.                                          |
| **`logs.db`**   | Runtime log entries.                                                                                       |
| **`cache.db`**  | South connector cache (values pending transmission to North connectors).                                   |

Backing up both `oibus.db` and `crypto.db` together is necessary for a complete, restorable snapshot.

## Web Interface Authentication

The OIBus web interface supports two authentication methods:

### JWT (Primary)

After a successful login, OIBus issues a **JWT signed with RS256** (RSA-SHA256). The token:

- Has a **7-day lifetime**.
- Is signed with an RSA private key held by OIBus.
- Is verified on every API request using the corresponding public key.
- Contains the user's login and a hash of their password — the token is automatically invalidated if the
  password changes.

### Basic Auth (API / CLI)

HTTP Basic Authentication is also accepted on every endpoint. It is used by curl-based automation scripts
(see [automated installation](../installation/disk-image.mdx)) and by tools that do not support JWT.

:::tip
For scripted access, prefer a dedicated API approach and always run scripts on the OIBus host itself
(`localhost`) so credentials are not transmitted over the network unencrypted.
:::

## IP Filtering

OIBus enforces IP-based access control at the HTTP request level. Requests from unlisted addresses
receive an HTTP 401 response before any authentication is attempted.

Key behaviours:

| Behaviour               | Detail                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Localhost bypass**    | `127.0.0.1`, `::1`, and other loopback addresses are always allowed, regardless of the filter list.           |
| **Wildcard**            | An entry of `*` allows all remote addresses.                                                                  |
| **IPv4 / IPv6**         | Both formats are supported. IPv4-mapped IPv6 addresses (e.g. `::ffff:192.168.1.1`) are handled transparently. |
| **Pattern matching**    | Entries are treated as regex patterns, allowing subnet-style rules.                                           |
| **Disable for testing** | Pass `--ignore-ip-filters` to `oibus-launcher` to bypass all IP checks without modifying the configuration.   |

See [IP Filters](../engine/ip-filters.mdx) for configuration details.

## OIAnalytics Secret Exchange

When secrets are entered or updated through OIAnalytics, they are encrypted **in the browser** before
being transmitted, using OIBus's RSA public key (RSA-OAEP, 4096-bit). This means:

- OIAnalytics never sees or stores plaintext secrets.
- Only OIBus, holding the matching private key, can decrypt them.
- When OIBus sends its configuration to OIAnalytics, all secret fields are stripped out before
  transmission.

The RSA key pair is generated during OIAnalytics registration and can be rotated with the
**Regenerate cipher keys** remote command. After rotation, any secrets previously entered through
OIAnalytics must be re-entered because the old ciphertext can no longer be decrypted.

The same 4096-bit RSA infrastructure is also used to generate self-signed certificates for OPC UA
connections.

## Network Security

OIBus does **not** support HTTPS natively. The web interface runs on plain HTTP (port 2223 by default).

For production environments where the interface is accessed remotely:

1. Place OIBus behind a **reverse proxy** (nginx, Apache, Caddy) that terminates TLS.
2. Configure the proxy to forward requests to `http://localhost:2223`.
3. Use [IP filters](../engine/ip-filters.mdx) to prevent direct access on port 2223 from outside the host.
4. For external access, prefer a **VPN** over exposing the reverse proxy to the public internet.

## Data Source Access

Apply the principle of least privilege for every system OIBus connects to:

- Create a **dedicated account** for OIBus — do not reuse service accounts shared with other tools.
- Grant **read-only permissions** for South connectors that only query data.
- Restrict the account to the specific databases, tags, or topics it needs — nothing broader.
- Prefer **key-based or token-based authentication** over passwords where the protocol supports it.
- Rotate credentials periodically and update them in OIBus connector settings.

## Software Integrity

- **Open source**: The full source code is publicly available on
  [GitHub](https://github.com/OptimistikSAS/OIBus). All commits go through team review before merging.
- **Official builds**: Release binaries are built by GitHub Actions from the tagged source. The build
  pipeline is auditable via the repository's Actions workflows.
- **Dependency monitoring**: [Dependabot](https://github.com/OptimistikSAS/OIBus/security/dependabot)
  continuously scans dependencies for known vulnerabilities and opens pull requests to update them.
- **Custom compilation**: The open-source licence and public codebase allow you to compile OIBus from
  source and audit it independently before deploying to sensitive environments.
- **Software Bill of Materials**: Every stable release ships a CycloneDX SBOM (`oibus-sbom.json`)
  listing all components and their versions, ready for vulnerability scanning or licence compliance
  checks. See [Software Bill of Materials](./oibus-sbom.md) for details.
