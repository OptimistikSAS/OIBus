# SFTP

Le **connecteur North SFTP** téléverse de manière sécurisée des fichiers et des données vers un **serveur SFTP (SSH File
Transfer Protocol)**.

## Paramètres spécifiques {#specific-settings}

| Paramètre | Description                                     | Exemple de valeur |
| ----------- | -------------------------------------------------- | -------------------- |
| **Hôte**    | Adresse IP ou nom d'hôte du serveur SFTP.          | `192.168.1.100`      |
| **Port**    | Port de connexion (par défaut : `22`).             | `22`                  |

### Authentification {#authentication}

| Paramètre           | Description                                                                    | Exemple de valeur                      |
| --------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------ |
| **Authentification**  | Méthode d'authentification.                                                          | `Username/Password`, `Private key`         |
| **Nom d'utilisateur** | Nom d'utilisateur pour le serveur SFTP.                                              | `sftp_user`                                |
| **Mot de passe**      | Mot de passe. Requis pour l'authentification Username/Password.                      | `••••••••`                                 |
| **Clé privée**        | Chemin vers le fichier de clé privée (format PEM). Requis pour l'authentification Private key. | `/path/to/key.pem`                |
| **Phrase secrète**    | Phrase secrète pour la clé privée (si protégée).                                     | `••••••••`                                 |

### Configuration des fichiers {#file-configuration}

| Paramètre         | Description                                                                                              | Exemple de valeur |
| -------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------- |
| **Dossier distant**  | Répertoire sur le serveur SFTP où les fichiers seront stockés.                                                  | `/data/oibus`         |
| **Préfixe**          | Texte à ajouter au début du nom de fichier. Prend en charge les variables internes comme `@ConnectorName`.      | `@ConnectorName-`    |
| **Suffixe**          | Texte à ajouter à la fin du nom de fichier (avant l'extension). Prend en charge les variables internes comme `@CurrentDate`. | `-@CurrentDate`      |

:::tip Noms de fichiers dynamiques
Utilisez des variables internes pour créer des noms de fichiers dynamiques :

- `@ConnectorName` : insère le nom du connecteur.
- `@CurrentDate` : insère l'horodatage actuel au format `yyyy_MM_dd_HH_mm_ss_SSS`.

**Exemple** :
Avec le préfixe `@ConnectorName-` et le suffixe `-@CurrentDate`, un fichier nommé `example.file` devient :
`<ConnectorName>-example-<CurrentDate>.file`
:::
