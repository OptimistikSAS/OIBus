---
sidebar_position: 1
---

# OIBus Security

## Credential Protection

### Password Security

| Component             | Protection Method      | Details                                                       |
| --------------------- | ---------------------- | ------------------------------------------------------------- |
| **Login Password**    | Argon2 hashing         | Only hash stored, never plaintext                             |
| **Connector Secrets** | AES-256-CBC encryption | Encrypted in `oibus.db`, key stored separately in `crypto.db` |

### Secret Management

1. **Local Storage**:
   - All credentials encrypted with AES-256 in CBC mode
   - Encryption key stored separately from configuration
   - Requires both `oibus.db` and `crypto.db` files to decrypt secrets

2. **OIAnalytics Integration**:
   - **Configuration Sync**: Secrets automatically filtered out before transmission
   - **Key Management**:
     - RSA-OAEP 4096-bit public/private key pair
     - Generated during initial registration
     - Regeneratable via OIAnalytics SaaS configuration interface
   - **Encryption Process**:
     - Public key used to encrypt secrets entered in OIAnalytics
     - Only OIBus (with private key) can decrypt the secrets
     - Plaintext secrets never stored on OIAnalytics servers

:::caution Critical Files

- `oibus.db`: Contains encrypted configuration data
- `crypto.db`: Stores the AES encryption key
- **Warning**: Deleting `crypto.db` will require re-entering all secrets after OIBus restart

:::

## Physical Security

### Access Control Recommendations

| Area                | Security Measure                | Implementation Guide                                      |
| ------------------- | ------------------------------- | --------------------------------------------------------- |
| Machine Access      | Restrict to administrators only | Use OS-level permissions, disable guest access            |
| Remote Access       | Limit to LAN/VPN                | Configure firewalls, disable public RDP/SMB               |
| Configuration Files | Protect from modification       | Set strict file permissions, use read-only where possible |

### Cache Management

- Configurable cache sizes for North connectors
- Prevents disk overload during communication issues
- Set limits based on:
  - Available disk space
  - Expected data volumes
  - Retention requirements

## Administration Access

### Interface Security

| Aspect             | Current Implementation | Recommended Enhancement                                 |
| ------------------ | ---------------------- | ------------------------------------------------------- |
| Authentication     | Basic Auth over HTTP   | Change default credentials (`admin`/`pass`) immediately |
| Network Protection | IP filtering           | Restrict to specific IPs, use VPN for remote access     |
| Protocol           | HTTP (port 2223)       | Implement reverse proxy with HTTPS (nginx/Apache)       |

:::tip HTTPS Configuration
To enable HTTPS:

1. Set up reverse proxy (nginx/Apache)
2. Configure SSL certificates
3. Proxy HTTPS requests to OIBus HTTP server
4. Restrict direct HTTP access

:::

### Access Best Practices

1. **Local Access**: Prefer `http://localhost:2223`
2. **Remote Access**:
   - Configure [IP Filters](../engine/ip-filters.mdx)
   - Use VPN for external connections
   - Never expose to public internet

## Software Integrity

### Build Process

- Official releases built via GitHub Actions
- Source code available for custom compilation
- All changes undergo team review

### Dependency Security

- Monitored by dependabot for vulnerabilities
- Response protocol:
  1. Update vulnerable dependencies
  2. Implement workarounds if updates unavailable
  3. Verify fixes before deployment

:::info Open Source Advantages

- Public code review on GitHub
- Community scrutiny of security practices
- Transparent vulnerability management
- Option for custom compilation/auditing

:::

## Data Source Access

### Security Recommendations

1. **Principle of Least Privilege**:
   - Create dedicated OIBus user accounts
   - Grant read-only permissions where possible
   - Limit to required data sources only

2. **Authentication Methods**:
   - Prefer key-based authentication when available
   - Use strong, unique passwords for each system
   - Rotate credentials periodically

3. **Network Segmentation**:
   - Isolate OIBus in dedicated network segment
   - Restrict outbound connections to required systems
   - Monitor connection attempts

### Audit Trail

- Maintain logs of:
  - Configuration changes
  - Authentication attempts
  - Data access patterns
- Regularly review for anomalies
