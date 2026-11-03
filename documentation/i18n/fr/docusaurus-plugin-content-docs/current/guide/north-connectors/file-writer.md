# File Writer

Le **connecteur North File Writer** écrit des fichiers dans un dossier de sortie spécifié sur le disque. Ce connecteur
est utile pour le stockage local, les pipelines de traitement de données ou l'intégration avec des systèmes basés sur
des fichiers.

Il ne reçoit que des fichiers : les listes d'enregistrements (consignes OIAnalytics comprises) sont écrites dans des
fichiers par un transformateur (par exemple [Fichier](../engine/transformers.mdx#file-from-records)). Avant la 3.10, il
recevait aussi des enregistrements et des consignes : la mise à jour écrit les lignes des transformateurs
[Enregistrements](../engine/transformers.mdx#records-from-file) dans des fichiers JSON via
[Fichier (tel quel, renommé ou converti)](../engine/transformers.mdx#file-as-is-renamed-or-converted), et supprime ses
transformateurs personnalisés envoyant des enregistrements ou des consignes.

## Paramètres spécifiques {#specific-settings}

| Paramètre             | Description                                                                                                                                            | Exemple de valeur |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------- |
| **Dossier de sortie** | Répertoire dans lequel les fichiers seront stockés. Les chemins relatifs sont résolus à partir du **dossier de données** (voir la section _À propos_). | `/data/oibus-out` |

### Authentification pour partage réseau (Windows uniquement) {#network-share-authentication-windows-only}

Pour écrire sur un partage réseau Windows, définissez **Dossier de sortie** sur un chemin UNC (`\\server\share\...`) et
fournissez les informations d'identification associées :

| Paramètre                 | Description                                                                            | Exemple de valeur |
| ------------------------- | -------------------------------------------------------------------------------------- | ----------------- |
| **Nom d'utilisateur SMB** | Nom d'utilisateur utilisé pour s'authentifier auprès du partage réseau.                | `svc_oibus`       |
| **Mot de passe SMB**      | Mot de passe pour le nom d'utilisateur SMB.                                            | `••••••••`        |
| **Domaine SMB**           | Domaine pour le nom d'utilisateur SMB (facultatif, par exemple pour Active Directory). | `CORP`            |

:::info Windows uniquement
Ces champs n'apparaissent que lorsqu'OIBus s'exécute sous Windows. OIBus authentifie une session SMB auprès du serveur
(`net use`) avant l'écriture, et la supprime lorsque le connecteur se déconnecte. Cela ne passe pas par le gestionnaire
d'identification Windows, ce qui fonctionne également lorsque OIBus s'exécute en tant que service Windows, où le
gestionnaire d'identification limité aux sessions interactives est peu fiable, même avec un compte disposant par
ailleurs d'un accès au partage.
:::

### Noms des fichiers {#file-names}

Les fichiers sont écrits avec le nom donné par leur transformateur, sans leur sous-dossier : le **Nom du fichier** des
transformateurs [Fichier (tel quel, renommé ou converti)](../engine/transformers.mdx#file-as-is-renamed-or-converted)
et [Fichier](../engine/transformers.mdx#file-from-records) (par exemple `@SourceFilename-@CurrentDate@SourceExtension`).

:::info Mise à jour vers la 3.10
Avant la 3.10, le connecteur ajoutait un **Préfixe** et un **Suffixe** au nom des fichiers. La mise à jour les ajoute
au nom de fichier de ses transformateurs, `@ConnectorName` étant remplacé par le nom du connecteur (dans un
transformateur, `@ConnectorName` est le nom du connecteur South), et renomme les fichiers en attente dans son cache. Un
transformateur personnalisé nomme lui-même les fichiers.
:::

## Bonnes pratiques {#best-practices}

- Utilisez des **chemins absolus** pour le dossier de sortie afin d'éviter toute ambiguïté.
- Créez un **répertoire dédié** pour chaque connecteur afin de conserver des fichiers organisés.
- Combinez avec des [transformateurs](./common-settings#transformers) pour :
  - Convertir les données dans d'autres formats (par exemple, JSON, CSV).
  - Filtrer ou enrichir les données avant leur écriture.
- Surveillez l'utilisation de l'espace disque, en particulier lors du traitement de gros volumes de données.
