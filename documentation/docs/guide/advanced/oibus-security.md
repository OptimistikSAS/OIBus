---
sidebar_position: 3
---

# OIBus Security

## Credential Storage {#credential-storage}

### Login Passwords {#login-passwords}

User passwords are hashed with **Argon2id** (64 MiB of memory, 3 iterations, 4 lanes, a random 16-byte salt)
before being stored in `oibus.db`. The plaintext password is never persisted — only the hash. Argon2 is a
memory-hard hashing function designed to resist brute-force and GPU-accelerated attacks. When a newer OIBus
hashes passwords with stronger parameters, a password is hashed again with them the next time its user logs in.

### Password Policy {#password-policy}

Following [NIST SP 800-63B](https://pages.nist.gov/800-63-4/sp800-63b.html), a password must have from **8 to 128
characters**, of any kind. OIBus imposes no composition rule (uppercase letter, digit, special character…): a
long passphrase is both easier to remember and harder to guess.

Changing a password requires the current password of the user who changes it: their own, and theirs too when
they change the password of another user through the API.

### Default Account {#default-account}

At its first start, OIBus creates an **admin** account with the password **pass**, unless the installation sets
other credentials (the `-u` and `-p` options of the installation scripts, or the `ADMIN_USERNAME` and
`ADMIN_PASSWORD` environment variables). The launcher option `--reset-password` also gives the **admin** account
this default password back.

As long as an account has the default password, OIBus only lets it change its password: the web interface opens
the password change right after login, and the API refuses any other request with an HTTP 403 response. This also
applies to the accounts that still have the default password when OIBus is upgraded.

### Connector Secrets {#connector-secrets}

Passwords, tokens, and API keys configured in South and North connectors — as well as the OIAnalytics
registration tokens and keys, the forward proxy and Loki passwords, and the private keys of the
certificates — are encrypted at rest using **AES-256-GCM**:

- A 256-bit key is generated with a cryptographically secure random number generator during OIBus
  initialisation, and stored as a base64 string in **`crypto.db`** — a separate SQLite database from the
  main configuration database. The encryption key is derived from it with HKDF-SHA256.
- Each secret is encrypted with its own random 96-bit nonce, so two identical secrets never give the same
  encrypted value, and carries an authentication tag, so an altered value is rejected instead of being
  decrypted.
- Encrypted secrets are stored in **`oibus.db`** and can only be decrypted when both databases are
  present.

:::danger Protect crypto.db
If `crypto.db` is deleted or lost, OIBus can no longer decrypt any connector secret. All secrets must
be re-entered after restarting OIBus. Treat `crypto.db` with the same care as a private key file.
:::

### Database Layout {#database-layout}

OIBus uses five SQLite databases:

| Database         | Contents                                                                                                                   |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **`oibus.db`**   | All configuration: connectors, items, scan modes, IP filters, users (hashed passwords), encrypted secrets.                 |
| **`crypto.db`**  | Key from which the AES-256-GCM key that encrypts/decrypts the secrets is derived.                                          |
| **`logs.db`**    | Runtime log entries. Stored under the `logs/` subfolder.                                                                   |
| **`metrics.db`** | South/North/history-query runtime metrics, updated on every scan and every North send. Stored under the `logs/` subfolder. |
| **`cache.db`**   | South connector cache (values pending transmission to North connectors). Stored under the `cache/` subfolder.              |

Backing up both `oibus.db` and `crypto.db` together is necessary for a complete, restorable snapshot.

### File Permissions {#file-permissions}

The data folder holds the configuration (password hashes, encrypted secrets), the key of the secrets and the private
key of OIBus. Its access is restricted to the account running OIBus when it is created, and then left to the
administrator, who may change it (for instance to let a backup agent read it):

- The installers create a new data folder for that account only: mode `700` on Linux, and on Windows an access
  control list granting full control to the OIBus service (`SYSTEM`) and the administrators only, without the
  permissions inherited from its parent folder. An existing data folder is left as it is.
- On Linux and macOS, OIBus creates `oibus.db` and `crypto.db` for its user only (mode `600`). The upgrade to OIBus 4.0
  restricts those created before once.

On Windows, restrict an existing data folder the same way from an administrator command prompt:

```bat
icacls "C:\OIBusData" /inheritance:r /grant:r "*S-1-5-18:(OI)(CI)F" "*S-1-5-32-544:(OI)(CI)F"
```

Running OIBus interactively (`go.bat`) then requires an administrator command prompt.

## Web Interface Authentication {#web-interface-authentication}

The OIBus web interface supports two authentication methods:

### JWT (Primary) {#jwt-primary}

After a successful login, OIBus issues a **JWT signed with HS256** (HMAC-SHA256). The token:

- Has a **7-day lifetime by default**, configurable in engine settings from 1 hour up to 30 days.
- Is signed with a random 256-bit secret generated by OIBus and stored in `crypto.db`, used for nothing else.
- Is verified on every API request with the same secret: a token signed otherwise, or with another algorithm, is
  rejected.
- Contains the user's login and a fingerprint of their password hash (never the hash itself) — the token is
  automatically invalidated if the password changes.

### Basic Auth (API / CLI) {#basic-auth-api--cli}

HTTP Basic Authentication is also accepted on every API endpoint except the public status endpoints
(`/api/status`, `/api/engine/status`), which require no authentication. It is used by curl-based automation scripts
(see [automated installation](../installation/disk-image.mdx)) and by tools that do not support JWT.

:::tip
For scripted access, prefer a dedicated API approach and always run scripts on the OIBus host itself
(`localhost`) so credentials are not transmitted over the network unencrypted.
:::

### Failed Authentication Limits {#failed-authentication-limits}

Verifying a password takes time and memory on purpose, so OIBus limits the failed authentications, from the login
page or with Basic Authentication:

- an IP address may fail **10 times in 15 minutes**;
- a login may fail **100 times in 15 minutes**, from any address.

Beyond that, the authentications of the address or of the login are refused with an HTTP 429 response (with a
`Retry-After` header), without checking the password, until 15 minutes have passed since their first failure.
Successful authentications are not counted: an API client using the right credentials is never slowed down, unless
its address or its login is blocked. The higher limit on a login stops a guessing spread over many addresses,
without letting a few of them lock an account out.
The host's own addresses (loopback) are only limited per login, since all the clients of a reverse proxy running on
the host come from them.

A failed authentication takes as long, and gets the same response, whether the login exists or not: it does not
tell which logins exist.

## IP Filtering {#ip-filtering}

OIBus enforces IP-based access control at the HTTP request level. Requests from unlisted addresses
receive an HTTP 401 response before any authentication is attempted.

Key behaviours:

| Behaviour               | Detail                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Localhost bypass**    | `127.0.0.1`, `::1`, and other loopback addresses are always allowed, regardless of the filter list.           |
| **Wildcard**            | An entry of `*` allows all remote addresses.                                                                  |
| **IPv4 / IPv6**         | Both formats are supported. IPv4-mapped IPv6 addresses (e.g. `::ffff:192.168.1.1`) are handled transparently. |
| **Pattern matching**    | Entries support `*` as a wildcard (compiled internally to a regular expression), allowing subnet-style rules. |
| **Disable for testing** | Pass `--ignore-ip-filters` to `oibus-launcher` to bypass all IP checks without modifying the configuration.   |

See [IP Filters](../engine/ip-filters.mdx) for configuration details.

## OIAnalytics Secret Exchange {#oianalytics-secret-exchange}

When secrets are entered or updated through OIAnalytics, they are encrypted **in the browser** before
being transmitted, using OIBus's RSA public key (RSA-OAEP, 4096-bit). This means:

- OIAnalytics never sees or stores plaintext secrets.
- Only OIBus, holding the matching private key, can decrypt them.
- When OIBus sends its configuration to OIAnalytics, all secret fields are stripped out before
  transmission.

The RSA key pair is generated during OIAnalytics registration, and OIBus replaces it by itself every
90 days, along with its tokens (see [Authentication Tokens](../installation/oianalytics.mdx#authentication-tokens)).
OIBus keeps the previous private key, so that the secrets entered through OIAnalytics just before a
replacement can still be decrypted.

The certificate OIBus presents to OPC UA® servers is selected in each OPC UA connector from the
[certificate store](../engine/certificates.md), where its private key is encrypted like the other secrets (see
[Communication Certificate](../south-connectors/opcua.mdx#communication-certificate)). It is distinct from the key pair
used for OIAnalytics secret exchange, and from the secret signing the JWTs.

## Network Security {#network-security}

A new OIBus serves its web interface over [HTTPS](../engine/engine-settings.mdx#https) (port 2223 by default), with
a self-signed certificate it generates at its first start. Replace it with a certificate issued by a CA your browsers
trust to avoid the browser warnings, and keep an OIBus upgraded from a version before 4.0, which keeps serving HTTP,
from being reached over the network until HTTPS is enabled.

For production environments where the interface is accessed remotely:

1. Use [IP filters](../engine/ip-filters.mdx) to restrict who can reach port 2223.
2. To terminate TLS in a **reverse proxy** (nginx, Apache, Caddy) instead, forward its requests to OIBus, and prevent
   direct access to port 2223 from outside the host.
3. For external access, prefer a **VPN** over exposing OIBus or the reverse proxy to the public internet.

## Server Identity {#server-identity}

Before sending any credential, the OPC UA® connectors (with the **Security Mode** `Sign` or `Sign and encrypt`) and the
SFTP connectors, South and North, and the history queries using them, check the identity of the server they connect
to: the certificate of an OPC UA server, the host key of an SFTP server. A connector only connects to a server
presenting the identity it trusts, identified by its SHA-256 fingerprint. This prevents another machine from
impersonating the server to collect the credentials, or the data.

- **Trusting an identity**: testing the connection, or saving or starting a connector whose server identity is not
  trusted yet, shows the identity its server presents: its fingerprint and, for a certificate, its subject, issuer,
  validity and names. Compare the fingerprint with the one the server shows (its certificate, or the output of
  `ssh-keygen -l -f <host key file>` on the SFTP server) before trusting it. Until the identity is trusted, a connection
  test stops after this check, so that no credential is sent to the server.
- **Saving without trusting**: a connector can be saved, or started, without trusting the identity of its server: it
  then waits until its server is trusted.
- **Refused identity**: when the server presents an identity the connector does not trust, or another one than the
  trusted identity (its certificate or host key was renewed, or another server impersonates it), the connector refuses
  to connect, and stops retrying. The page of the connector or history query shows the identity presented: **Review and
  trust** trusts it, and restarts the connector.
- **Traceability**: the page of the connector shows who trusted the identity of its server, and when. Trusting an
  identity is logged, and the trusted identity is kept when the configuration is
  [exported and imported](../engine/config-export-import.mdx).
- **Upgrade**: the OPC UA (with a security mode other than None) and SFTP connectors and history queries created before OIBus 4.0 trust the identity their
  server presents at their first connection. Review it on their page.
- **OIAnalytics**: OIAnalytics shows the identity of the server when it tests a connection, and trusts it only with the
  [**Data flow** and **Connect to data sources** permissions](../installation/oianalytics.mdx#command-permissions).

## Data Source Access {#data-source-access}

Apply the principle of least privilege for every system OIBus connects to:

- Create a **dedicated account** for OIBus — do not reuse service accounts shared with other tools.
- Grant **read-only permissions** for South connectors that only query data.
- Restrict the account to the specific databases, tags, or topics it needs — nothing broader.
- Prefer **key-based or token-based authentication** over passwords where the protocol supports it.
- Rotate credentials periodically and update them in OIBus connector settings.

## Software Integrity {#software-integrity}

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
