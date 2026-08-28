# Amazon S3™

Le **connecteur North Amazon S3™** vous permet de stocker des fichiers dans **Amazon S3™ (Simple Storage Service)**. Il est
idéal pour le stockage à long terme, les data lakes ou l'intégration avec les services AWS.

**Exemples de cas d'usage** :

- **Intégration de data lake** : stocker des données historiques pour l'analyse ou la conformité.
- **Sauvegarde et archivage** : archiver de manière sécurisée les données d'OIBus vers Amazon S3.
- **Intégration à l'écosystème AWS** : utiliser les données stockées avec des services AWS comme Athena, Redshift ou Glue.

## Paramètres spécifiques {#specific-settings}

Configurez les paramètres suivants pour vous connecter à votre bucket Amazon S3 :

| Paramètre      | Description                                                          | Exemple de valeur      |
| -------------- | --------------------------------------------------------------------- | ---------------------- |
| **Bucket**     | Nom du bucket Amazon S3 dans lequel les fichiers seront stockés.      | `my-oibus-bucket`      |
| **Région**     | Région AWS dans laquelle se trouve le bucket.                         | `eu-west-3`            |
| **Dossier**    | Dossier spécifique au sein du bucket où les fichiers doivent être stockés. | `oibus/data`           |
| **Clé d'accès** | Clé d'authentification pour la connexion au bucket Amazon S3.        | `AKIAIOSFODNN7EXAMPLE` |
| **Clé secrète** | Clé secrète associée à la clé d'accès.                                | `••••••••`             |

### Configuration du proxy {#proxy-configuration}

Si votre infrastructure réseau exige que les requêtes passent par un serveur proxy pour atteindre Amazon S3, activez
l'option **Utiliser un proxy** et configurez les détails du proxy ci-dessous.

| Paramètre                | Description                                          | Exemple de valeur               |
| ------------------------ | ------------------------------------------------------ | -------------------------------- |
| **Utiliser un proxy**    | Router les requêtes via un serveur proxy.               | Activé/Désactivé                |
| **URL du proxy**         | URL du serveur proxy.                                   | `http://proxy.example.com:8080` |
| **Nom d'utilisateur proxy** | Nom d'utilisateur pour l'authentification proxy (si requis). | `proxy_user`                    |
| **Mot de passe proxy**   | Mot de passe pour l'authentification proxy (si requis). | `••••••••`                      |

## Bonnes pratiques {#best-practices}

- **Permissions IAM** : assurez-vous que la clé d'accès et la clé secrète fournies disposent des permissions
  nécessaires (par exemple, `s3:PutObject`).
- **Surveillance** : surveillez l'utilisation du stockage et les coûts dans la console AWS S3.
