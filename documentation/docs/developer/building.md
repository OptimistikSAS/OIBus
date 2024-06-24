---
displayed_sidebar: developerSidebar
sidebar_position: 2
---

# Building OIBus
OIBus uses [pkg](https://github.com/vercel/pkg) as its building tool.

:::caution
`pkg` is deprecated and for now, OIBus uses [a pkg fork](https://github.com/yao-pkg/pkg) that is compatible with latest
versions of NodeJS.
:::

## Building binaries
- `npm run build:win`: Build OIBus for Windows x64 architecture
- `npm run build:linux`: Build OIBus for x64 linux based architectures
- `npm run build:linux-arm64`: Build OIBus for ARM64 linux based platform (like Raspberry 3 B+)
- `npm run build:macos`: Build OIBus for macOS Intel chips
- `npm run build:macos-arm64`:  Build OIBus for macOS Apple chips

## Starting the binary
The following commands start the appropriate binary with data-folder as the directory where to store the caches, configuration, logs...
- `npm run start:win`
- `npm run start:linux`
- `npm run start:linux-arm64`
- `npm run start:macos`
- `npm run start:macos-arm64`

## Windows Installer (Windows only)
The Windows Installer can be built with [Inno Setup](https://jrsoftware.org/isinfo.php), only on Windows platform.

However, because of some environment variables, the build action cannot be executed from Inno Setup directly. OIBus backend
package.json file provide a npm command: `build:win-setup`. Before running it, you may need to set a few things up in order 
to manage the signing of the installer.


### Signing OIBus Windows Installer
These commands can be used with **Powershell**, on a Windows system.
1. Create a `cert.conf` file:
```
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
extendedKeyUsage= serverAuth, clientAuth
nsComment = "OIBus Cert"
subjectKeyIdentifier=hash
authorityKeyIdentifier=keyid,issuer
subjectAltName = URI:urn:oibus,IP:127.0.0.1

[ subject ]
countryName = FR
stateOrProvinceName = FR
localityName = Chambéry
organizationName = OI
commonName = oibus
```
2. Generate CSR (Certificate Signing Request) from `cert.conf` file, and keep secret the private.key:
```
openssl req -new -newkey rsa:4096 -keyout private.key -sha256 -nodes -out oibus.csr -config cert.conf
```
3. Create a local self-signed certificate
```
openssl x509 -req -in oibus.csr -signkey private.key -out oibus.crt
```
4. Convert the cert file to PFX file
```
openssl pkcs12 -export -in oibus.crt -inkey private.key -out oibus.pfx -passout pass:password -name OIBus
```
5. Convert PFX certificate file to _base64_
```
base64 oibus.pfx > oibus64.pfx
```
6. Create the installer
```
$env:PFX_PASSWORD = "password" ; $env:PFX_PATH = "path" ; npm run build:win-setup
```
