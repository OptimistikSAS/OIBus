---
displayed_sidebar: developerSidebar
sidebar_position: 2
---

# Certificates
Some protocols and tools use certificates for authentication or signing purposes. If you need to create self-signed 
certificates to test OIBus, you can follow this guide.
A configuration file cert.conf should be created to insert some settigns for the certificate creation. Here is an example
that will be used for this guide:
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
nsComment = "OIBus User Cert"
subjectKeyIdentifier=hash
authorityKeyIdentifier=keyid,issuer
subjectAltName = URI:urn:opcua:user:oibus,IP: 127.0.0.1

[ subject ]
countryName = FR
stateOrProvinceName = FR
localityName = Chambéry
organizationName = OI
commonName = oibus
```

## Using certificates with ProSys OPC UA Simulation Server
1. Create a private key and certificate using the `cert.conf`:
```
openssl req -new -x509 -keyout oibus.key -out oibus.pem -config cert.conf
```
2. Remove private key passphrase:
```
openssl rsa -in oibus.key -out oibus.key
```
3. Create DER cert for ProSys:
```
openssl x509 -inform PEM -outform DER -in oibus.pem -out oibus.der
``` 

4. Copy the DER cert in ProSys USERS_PKI certificate folder: `prosys-opc-ua-simulation-server\USERS_PKI\CA\certs`

## Signing OIBus Windows Installer
These commands can be used with **Powershell**, on a Windows system.
1. Generate CSR (Certificate Signing Request) from `cert.conf` file, and keep secret the private.key:
```
openssl req -new -newkey rsa:4096 -keyout private.key -sha256 -nodes -out oibus.csr -config cert.conf
```
2. Create a local self-signed certificate
```
openssl x509 -req -in oibus.csr -signkey private.key -out oibus.crt
```
3. Convert the cert file to PFX file
```
openssl pkcs12 -export -in oibus.crt -inkey private.key -out oibus.pfx -passout pass:password -name OIBus
```
4. Convert PFX certificate file to _base64_
```
base64 oibus.pfx >  oibus64.pfx
```
5. Run sign tool
```
$env:PFX_PASSWORD = "password" ; $env:PFX_PATH = "path" ; npm run build:win-setup
```
