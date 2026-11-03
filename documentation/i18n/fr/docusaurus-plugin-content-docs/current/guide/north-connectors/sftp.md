# SFTP

Le **connecteur North SFTP** téléverse de manière sécurisée des fichiers vers un **serveur SFTP (SSH File Transfer
Protocol)**.

## Paramètres spécifiques {#specific-settings}

| Paramètre | Description                               | Exemple de valeur |
| --------- | ----------------------------------------- | ----------------- |
| **Hôte**  | Adresse IP ou nom d'hôte du serveur SFTP. | `192.168.1.100`   |
| **Port**  | Port de connexion (par défaut : `22`).    | `22`              |

### Authentification {#authentication}

| Paramètre             | Description                                                                                       | Exemple de valeur                              |
| --------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| **Authentification**  | Méthode d'authentification.                                                                       | `Nom d'utilisateur/Mot de passe`, `Clé privée` |
| **Nom d'utilisateur** | Nom d'utilisateur pour le serveur SFTP.                                                           | `sftp_user`                                    |
| **Mot de passe**      | Mot de passe. Requis pour l'authentification par nom d'utilisateur/mot de passe.                  | `••••••••`                                     |
| **Clé privée**        | Chemin vers le fichier de clé privée (format PEM). Requis pour l'authentification par clé privée. | `/path/to/key.pem`                             |
| **Phrase secrète**    | Phrase secrète pour la clé privée (si protégée).                                                  | `••••••••`                                     |

### Configuration des fichiers {#file-configuration}

| Paramètre           | Description                                                    | Exemple de valeur |
| ------------------- | -------------------------------------------------------------- | ----------------- |
| **Dossier distant** | Répertoire sur le serveur SFTP où les fichiers seront stockés. | `/data/oibus`     |

Les fichiers sont écrits avec le nom donné par leur transformateur, sans leur sous-dossier : le **Nom du fichier** des
transformateurs [Fichier (tel quel, renommé ou converti)](../engine/transformers.mdx#file-as-is-renamed-or-converted)
et [Fichier](../engine/transformers.mdx#file-from-records) (par exemple `@SourceFilename-@CurrentDate@SourceExtension`).

:::info Mise à jour vers la 3.10
Avant la 3.10, le connecteur ajoutait un **Préfixe** et un **Suffixe** au nom des fichiers. La mise à jour les ajoute
au nom de fichier de ses transformateurs, `@ConnectorName` étant remplacé par le nom du connecteur (dans un
transformateur, `@ConnectorName` est le nom du connecteur South), et renomme les fichiers en attente dans son cache. Un
transformateur personnalisé nomme lui-même les fichiers.
:::
