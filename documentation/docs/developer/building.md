---
displayed_sidebar: developerSidebar
sidebar_position: 2
---

# Building OIBus

OIBus uses a [fork of pkg](https://github.com/yao-pkg/pkg) as its building tool to create platform-specific binaries.

:::caution pkg Version Note
The original `pkg` is deprecated. OIBus uses a maintained fork that's compatible with modern Node.js versions.
:::

## 📦 Building Binaries

### Available Build Commands

| Command                     | Platform | Architecture  | Description                                      |
| --------------------------- | -------- | ------------- | ------------------------------------------------ |
| `npm run build:win-x64`     | Windows  | x64           | Builds Windows executable                        |
| `npm run build:linux-x64`   | Linux    | x64           | Builds for x64 Linux systems                     |
| `npm run build:linux-arm64` | Linux    | ARM64         | Builds for ARM64 Linux (Raspberry Pi 3 B+, etc.) |
| `npm run build:macos-x64`   | macOS    | Intel         | Builds for Intel-based Macs                      |
| `npm run build:macos-arm64` | macOS    | Apple Silicon | Builds for M1/M2 Macs                            |

### Build Process Details

1. **Prerequisites**:
   - Node.js installed (version specified in `.nvmrc`)
   - All dependencies installed (`npm install`)

2. **Building**:

   ```bash
   # Example: Build for Windows
   npm run build:win

   # Output will be in:
   # ./dist/oibus-win-x64/
   ```

3. **Build Output**:
   - Binaries are output to the `dist/` directory
   - Each platform has its own subdirectory
   - Includes all required assets and dependencies

## 🚀 Starting the Binary

### Available Start Commands

| Command                     | Platform            | Description                 |
| --------------------------- | ------------------- | --------------------------- |
| `npm run start:win-x64`     | Windows             | Starts Windows binary       |
| `npm run start:linux-x64`   | Linux               | Starts Linux binary         |
| `npm run start:linux-arm64` | Linux ARM64         | Starts ARM64 Linux binary   |
| `npm run start:macos-x64`   | macOS Intel         | Starts Intel Mac binary     |
| `npm run start:macos-arm64` | macOS Apple Silicon | Starts Apple Silicon binary |

### Data Folder

All commands use `data-folder` as the default directory for:

- Configuration files
- Cache storage
- Log files
- Temporary data

## Windows Installer

The Windows installer is built using [Inno Setup](https://jrsoftware.org/isinfo.php).

### Prerequisites

- Windows operating system
- [Inno Setup](https://jrsoftware.org/isinfo.php) installed
- OpenSSL for certificate operations

### Certificate Setup

#### 1. Create Configuration File

Create `cert.conf` with the following content:

```ini
[ req ]
default_bits = 2048
default_md = sha256
distinguished_name = subject
req_extensions = req_ext
x509_extensions = req_ext
string_mask = utf8only
prompt = no

[ req_ext ]
basicConstraints = CA:FALSE
nsCertType = client, server
keyUsage = nonRepudiation, digitalSignature, keyEncipherment, dataEncipherment, keyCertSign
extendedKeyUsage = serverAuth, clientAuth
nsComment = "OIBus Cert"
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid,issuer
subjectAltName = URI:urn:oibus,IP:127.0.0.1

[ subject ]
countryName = FR
stateOrProvinceName = FR
localityName = Chambéry
organizationName = OI
commonName = oibus
```

#### 2. Generate Certificate Files

Run these commands in **PowerShell**:

```powershell
# Generate private key and CSR
openssl req -new -newkey rsa:4096 -keyout private.key -sha256 -nodes -out oibus.csr -config cert.conf

# Create self-signed certificate
openssl x509 -req -in oibus.csr -signkey private.key -out oibus.crt

# Convert to PFX format
openssl pkcs12 -export -in oibus.crt -inkey private.key -out oibus.pfx -passout pass:password -name "OIBus"

# Convert to base64
$pfxContent = [System.Convert]::ToBase64String((Get-Content -Path "oibus.pfx" -Encoding Byte))
$pfxContent | Out-File -FilePath "oibus64.pfx" -Encoding ASCII
```

#### 3. Build the Installer

```powershell
# Set environment variables
$env:PFX_PASSWORD = "password"
$env:PFX_PATH = "full\path\to\oibus64.pfx"

# Run the build
npm run build:win-setup
```

### Installer Build Process

1. The script:
   - Compiles the binary (if not already built)
   - Creates installer configuration
   - Signs the executable
   - Packages everything into an `.exe` installer

2. **Output**:
   - Installer will be in `dist/setup/`
   - Named `OIBus-Setup-{version}.exe`
