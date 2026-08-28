# Azure Blob Storage™

Le **connecteur North Azure Blob Storage™** vous permet de stocker des fichiers dans **Microsoft Azure Blob Storage™** ou
**Azure Data Lake Storage**. Ce connecteur est idéal pour le stockage cloud, les data lakes ou l'intégration avec les
services Azure.

**Exemples de cas d'usage** :

- **Stockage de données cloud** : stocker de gros volumes de données non structurées de manière économique.
- **Sauvegarde et archivage** : archiver de manière sécurisée les données OIBus dans Azure Blob Storage.
- **Intégration à l'écosystème Azure** : utiliser les données stockées avec des services Azure comme Azure Functions,
  Logic Apps ou Power BI.

## Paramètres spécifiques {#specific-settings}

Configurez les paramètres suivants pour vous connecter à votre Azure Blob Storage :

| Paramètre                    | Description                                                                              | Exemple de valeur |
| ----------------------------- | ------------------------------------------------------------------------------------------ | ------------------ |
| **Azure Data Lake Storage**   | Activer pour utiliser **Azure Data Lake Storage** au lieu du Azure Blob Storage standard.  | Activé/Désactivé  |
| **Utiliser une URL personnalisée** | Utiliser une URL de point de terminaison personnalisée au lieu de l'URL standard basée sur le compte. | Activé/Désactivé  |

### Paramètres de connexion {#connection-settings}

| Paramètre         | Description                                                                             | Exemple de valeur                                |
| ------------------ | ------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| **Compte**         | Nom du compte de stockage Azure. Utilisé lorsque **Utiliser une URL personnalisée** est désactivé. | `mystorageaccount`                                 |
| **URL personnalisée** | URL complète du point de terminaison du service de stockage. Utilisée lorsque **Utiliser une URL personnalisée** est activé. | `https://mystorageaccount.blob.core.windows.net` |
| **Conteneur**      | Conteneur Azure Blob dans lequel les fichiers seront stockés.                             | `oibus-data`                                       |
| **Chemin**         | Chemin du dossier au sein du conteneur où les fichiers doivent être stockés.               | `factory/line1`                                    |

### Authentification {#authentication}

| Paramètre           | Description                                                                                    | Exemple de valeur                                                           |
| -------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **Authentification** | Méthode d'authentification.                                                                        | `Access key`, `SAS token`, `AAD - Application Active Directory`, `External` |
| **Clé d'accès**      | Clé d'accès du compte. Requise pour l'authentification par clé d'accès.                            | `••••••••`                                                                  |
| **Jeton SAS**        | Jeton de signature d'accès partagé pour un accès limité dans le temps. Requis pour l'authentification par jeton SAS. | `sv=2021-06-08&...`                                                         |
| **ID du tenant**     | ID du tenant Azure Active Directory. Requis pour l'authentification AAD.                          | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`                                      |
| **ID client**        | ID de l'application (client). Requis pour l'authentification AAD.                                  | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`                                      |
| **Secret client**    | Secret client de l'application. Requis pour l'authentification AAD.                                | `••••••••`                                                                  |

### Configuration du proxy {#proxy-configuration}

Si votre infrastructure réseau exige que les requêtes passent par un serveur proxy pour atteindre Azure Blob Storage,
activez l'option **Utiliser un proxy** et configurez les détails du proxy ci-dessous.

| Paramètre                | Description                                          | Exemple de valeur               |
| ------------------------- | ------------------------------------------------------ | -------------------------------- |
| **URL du proxy**          | URL du serveur proxy.                                   | `http://proxy.example.com:8080` |
| **Nom d'utilisateur proxy** | Nom d'utilisateur pour l'authentification proxy (si requis). | `proxy_user`                    |
| **Mot de passe proxy**    | Mot de passe pour l'authentification proxy (si requis). | `••••••••`                      |

## Bonnes pratiques {#best-practices}

- **Surveillance** : utilisez Azure Monitor pour suivre l'utilisation du stockage, les performances et les coûts.
