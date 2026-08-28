---
sidebar_position: 5
---

# Certificats

OIBus conserve un magasin de certificats (**Engine > Certificates**) utilisé pour authentifier OIBus auprès de systèmes
externes. L'un de ces scénarios consiste à utiliser un certificat dédié pour établir des connexions [OIAnalytics](../north-connectors/oianalytics.md)
via **Azure Active Directory avec certificats**.

Une entrée de certificat peut être soit **générée par OIBus** (auto-signée), soit **importée** depuis une autorité de
certification externe.

## Générer un certificat auto-signé {#generating-a-self-signed-certificate}

Utilisez le bouton **+** et renseignez les champs du sujet (nom commun, pays, état/province, localité, organisation),
la taille de clé et le nombre de jours avant expiration. OIBus génère une paire de clés RSA, signe lui-même le
certificat et stocke la clé privée chiffrée.

L'expiration affichée est la date `notAfter` réelle du certificat.

## Importer un certificat signé par votre propre CA {#importing-a-certificate-signed-by-your-own-ca}

Utilisez le bouton **upload** pour importer un certificat existant plutôt que d'en générer un. Vous devez fournir :

- **Fichier de certificat** (obligatoire) — le certificat feuille, encodé en PEM (`.pem`, `.crt`, `.cer`) ou en DER
  (`.der`, `.cer`).
- **Fichier de clé privée** (obligatoire) — la clé privée correspondante, PKCS#1 (`-----BEGIN RSA PRIVATE KEY-----`)
  ou PKCS#8 (`-----BEGIN PRIVATE KEY-----`), encodée en PEM ou en DER. Les clés chiffrées sont acceptées — indiquez la
  phrase secrète dans le champ **Private key passphrase**.
- **Fichier de chaîne CA** (facultatif) — les certificats CA intermédiaires et racine. Comme un fichier DER ne peut
  contenir qu'un seul certificat, une chaîne à plusieurs certificats doit être fournie sous forme de paquet PEM
  concaténé.

OIBus vérifie que la clé privée correspond à la clé publique du certificat et rejette l'import dans le cas contraire.
L'expiration est lue depuis le certificat lui-même. Seules les clés RSA sont prises en charge.

La chaîne CA est stockée telle que fournie ; OIBus ne vérifie pas qu'elle remonte effectivement jusqu'au certificat
feuille.

:::info
Les paquets PKCS#12 / `.pfx` ne sont pas pris en charge. Extrayez d'abord le certificat et la clé :

```bash
openssl pkcs12 -in bundle.pfx -clcerts -nokeys -out certificate.pem
openssl pkcs12 -in bundle.pfx -nocerts -nodes -out private-key.pem
```
:::

## Télécharger un certificat {#downloading-a-certificate}

Le bouton **download** sur une ligne de certificat ouvre une boîte de dialogue proposant :

- **Format** — **PEM** (`.pem`) ou **DER** (`.cer`). DER est le format attendu par les serveurs OPC UA tels que
  Kepware, il peut donc être fourni directement sans passer par une conversion `openssl`.
- **Include the CA chain** — ajoute la chaîne stockée au fichier exporté. Disponible uniquement avec PEM, car un
  fichier DER ne contient qu'un seul certificat.
- **Include the private key** — voir ci-dessous.

## Télécharger la clé privée {#downloading-the-private-key}

La clé privée ne peut être téléchargée que sous forme chiffrée. Cochez **Include the private key** et saisissez une
phrase secrète (au moins 8 caractères, répétée pour confirmation). OIBus produit un fichier PEM chiffré PKCS#8
(`-----BEGIN ENCRYPTED PRIVATE KEY-----`, PBES2 avec PBKDF2-HMAC-SHA256 et AES-256-CBC), téléchargé en tant que
fichier séparé aux côtés du certificat.

La phrase secrète n'est jamais stockée par OIBus — si vous la perdez, le fichier téléchargé devient inutilisable.
Chaque export de clé privée est enregistré dans les journaux OIBus avec l'utilisateur qui l'a demandé.

Vous pouvez inspecter ou convertir la clé téléchargée avec :

```bash
openssl pkcs8 -in private-key.pem -passin pass:yourpassphrase -noout
```
