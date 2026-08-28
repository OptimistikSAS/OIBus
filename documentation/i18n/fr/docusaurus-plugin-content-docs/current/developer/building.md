---
displayed_sidebar: developerSidebar
sidebar_position: 2
---

# Construction d'OIBus

OIBus utilise un [fork de pkg](https://github.com/yao-pkg/pkg) comme outil de construction pour créer des binaires spécifiques à chaque plateforme.

:::caution Remarque sur la version de pkg
Le `pkg` d'origine est déprécié. OIBus utilise un fork maintenu, compatible avec les versions récentes de Node.js.
:::

## 📦 Construction des binaires {#-building-binaries}

### Commandes de construction disponibles {#available-build-commands}

| Commande                    | Plateforme | Architecture  | Description                                      |
| --------------------------- | ---------- | ------------- | ------------------------------------------------- |
| `npm run build:win-x64`     | Windows    | x64           | Construit l'exécutable Windows                    |
| `npm run build:linux-x64`   | Linux      | x64           | Construit pour les systèmes Linux x64              |
| `npm run build:linux-arm64` | Linux      | ARM64         | Construit pour Linux ARM64 (Raspberry Pi 3 B+, etc.) |
| `npm run build:macos-x64`   | macOS      | Intel         | Construit pour les Mac à base Intel                |
| `npm run build:macos-arm64` | macOS      | Apple Silicon | Construit pour les Mac M1/M2                       |

### Détails du processus de construction {#build-process-details}

1. **Prérequis** :
   - Node.js installé (version indiquée dans `.nvmrc`)
   - Toutes les dépendances installées (`npm install`)

2. **Construction** :

   ```bash
   # Exemple : construire pour Windows
   npm run build:win

   # Le résultat sera dans :
   # ./dist/oibus-win-x64/
   ```

3. **Résultat de la construction** :
   - Les binaires sont générés dans le répertoire `dist/`
   - Chaque plateforme a son propre sous-répertoire
   - Inclut toutes les ressources et dépendances requises

## 🚀 Démarrage du binaire {#-starting-the-binary}

### Commandes de démarrage disponibles {#available-start-commands}

| Commande                    | Plateforme           | Description                        |
| ---------------------------- | -------------------- | ----------------------------------- |
| `npm run start:win-x64`     | Windows              | Démarre le binaire Windows          |
| `npm run start:linux-x64`   | Linux                | Démarre le binaire Linux            |
| `npm run start:linux-arm64` | Linux ARM64          | Démarre le binaire Linux ARM64      |
| `npm run start:macos-x64`   | macOS Intel          | Démarre le binaire Mac Intel        |
| `npm run start:macos-arm64` | macOS Apple Silicon  | Démarre le binaire Apple Silicon    |

### Dossier de données {#data-folder}

Toutes les commandes utilisent `data-folder` comme répertoire par défaut pour :

- Les fichiers de configuration
- Le stockage du cache
- Les fichiers de journalisation
- Les données temporaires

## Installeur Windows {#windows-installer}

L'installeur Windows est construit avec [Inno Setup](https://jrsoftware.org/isinfo.php).

### Prérequis {#prerequisites}

- Système d'exploitation Windows
- [Inno Setup](https://jrsoftware.org/isinfo.php) installé
- OpenSSL pour les opérations liées aux certificats

### Configuration du certificat {#certificate-setup}

#### 1. Créer le fichier de configuration {#1-create-configuration-file}

Créez `cert.conf` avec le contenu suivant :

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

#### 2. Générer les fichiers de certificat {#2-generate-certificate-files}

Exécutez ces commandes dans **PowerShell** :

```powershell
# Générer la clé privée et le CSR
openssl req -new -newkey rsa:4096 -keyout private.key -sha256 -nodes -out oibus.csr -config cert.conf

# Créer un certificat auto-signé
openssl x509 -req -in oibus.csr -signkey private.key -out oibus.crt

# Convertir au format PFX
openssl pkcs12 -export -in oibus.crt -inkey private.key -out oibus.pfx -passout pass:password -name "OIBus"

# Convertir en base64
$pfxContent = [System.Convert]::ToBase64String((Get-Content -Path "oibus.pfx" -Encoding Byte))
$pfxContent | Out-File -FilePath "oibus64.pfx" -Encoding ASCII
```

#### 3. Construire l'installeur {#3-build-the-installer}

```powershell
# Lancer la construction
npm run build:win-setup
```

### Processus de construction de l'installeur {#installer-build-process}

1. Le script :
   - Compile le binaire (s'il n'est pas déjà construit)
   - Crée la configuration de l'installeur
   - Signe l'exécutable
   - Empaquette le tout dans un installeur `.exe`

2. **Résultat** :
   - L'installeur se trouve dans `dist/setup/`
   - Nommé `OIBus-Setup-{version}.exe`
