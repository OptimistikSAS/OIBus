# Azure Data Explorer™

Le **connecteur North Azure Data Explorer™** ingère les données OIBus dans un cluster, une base de données et une table
**Azure Data Explorer (Kusto)**, en utilisant les SDK officiels de Microsoft via une **ingestion en file d'attente**
(queued ingestion). Il s'agit du premier connecteur North d'OIBus dans la catégorie **base de données**.

**Exemples de cas d'usage** :

- **Analytique de séries temporelles à grande échelle** : stocker de gros volumes de données industrielles de séries
  temporelles pour une analytique rapide et évolutive.
- **Requêtage KQL ad hoc** : explorer et interroger les données industrielles de manière interactive à l'aide du langage
  Kusto Query Language (KQL).
- **Tableaux de bord et rapports** : alimenter directement Power BI ou les tableaux de bord Azure depuis Azure Data
  Explorer.
- **Déchargement de l'historian** : utiliser Azure Data Explorer comme historian à long terme et à faible coût pour les
  données OIBus.

## Paramètres spécifiques {#specific-settings}

Configurez les paramètres suivants pour vous connecter à votre cluster Azure Data Explorer :

| Paramètre                       | Description                                                                                                                                                                                        | Exemple de valeur                                |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| **URL du cluster**               | Point de terminaison du moteur du cluster Azure Data Explorer. Saisissez l'URL simple du cluster, pas le point de terminaison `ingest-` : le connecteur en dérive automatiquement le point de terminaison d'ingestion (`ingest-`). | `https://mycluster.westeurope.kusto.windows.net` |
| **Base de données**              | Nom de la base de données Azure Data Explorer dans laquelle ingérer.                                                                                                                              | `oibus`                                             |
| **Table**                        | Nom de la table cible dans laquelle ingérer. La table doit déjà exister dans Azure Data Explorer.                                                                                                 | `TimeValues`                                        |
| **Format des données**           | Format utilisé pour envoyer les données à Azure Data Explorer. Doit correspondre au transformateur sélectionné sur ce connecteur.                                                                | `CSV`, `JSON`, `Multiline JSON`                     |
| **Nom du mapping d'ingestion**   | Nom d'un mapping d'ingestion Azure Data Explorer préexistant utilisé pour mapper les colonnes. Facultatif ; doit déjà exister dans Azure Data Explorer. Lorsqu'il est vide, Azure Data Explorer utilise sa résolution de colonnes par défaut. | `TimeValuesMapping`                                 |

### Authentification {#authentication}

Azure Data Explorer prend en charge trois modes d'authentification :

| Paramètre           | Description                                                                                                                    | Exemple de valeur                                                           |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **Authentification** | Méthode d'authentification.                                                                                                        | `AAD application secret`, `AAD application certificate`, `Managed identity` |
| **ID du tenant**     | ID du tenant Azure Active Directory. Requis pour `AAD application secret` et `AAD application certificate`.                       | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`                                      |
| **ID client**        | ID de l'application (client). Requis pour `AAD application secret` et `AAD application certificate`.                              | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`                                      |
| **Secret client**    | Secret client de l'application. Requis pour `AAD application secret`.                                                             | `••••••••`                                                                  |
| **Certificat**       | Certificat à utiliser pour l'authentification, sélectionné dans le magasin de certificats d'OIBus. Requis pour `AAD application certificate`. | `my-adx-certificate`                                                        |

Avec `Managed identity`, aucune information d'identification n'est requise : OIBus s'authentifie à l'aide de l'identité
managée Azure ambiante de l'hôte sur lequel il s'exécute (par exemple une VM Azure ou un App Service disposant d'une
identité managée assignée par le système ou par l'utilisateur).

### Proxy {#proxy}

Si votre infrastructure réseau exige que les requêtes passent par un serveur proxy pour atteindre Azure Data Explorer,
activez l'option **Utiliser un proxy** et configurez les détails du proxy ci-dessous.

| Paramètre                | Description                                          | Exemple de valeur               |
| ------------------------- | ------------------------------------------------------ | -------------------------------- |
| **URL du proxy**          | URL du serveur proxy.                                   | `http://proxy.example.com:8080` |
| **Nom d'utilisateur proxy** | Nom d'utilisateur pour l'authentification proxy (si requis). | `proxy_user`                    |
| **Mot de passe proxy**    | Mot de passe pour l'authentification proxy (si requis). | `••••••••`                      |

Le support du proxy est partiel. Le SDK Azure Data Explorer n'expose aucune option de proxy, OIBus installe donc le
proxy directement sur les clients HTTP du SDK, et le transmet également aux informations d'identification Entra ID
(`@azure/identity`) utilisées pour l'authentification. Cela couvre les appels Azure Data Explorer eux-mêmes — commandes
de gestion (y compris **Tester les paramètres**) et découverte des ressources d'ingestion — ainsi que les requêtes de
jeton effectuées auprès d'Entra ID pour acquérir et rafraîchir les informations d'identification.

Cela **ne couvre pas** le téléversement de la charge utile : l'ingestion en file d'attente téléverse le fichier via le
SDK Azure Storage, qui ne respecte pas ce paramètre. Si ces téléversements doivent également passer par le proxy,
définissez `HTTPS_PROXY` au niveau du système d'exploitation en complément de la configuration du proxy ici.

## Remarques importantes {#important-notes}

- **Le format des données doit correspondre au transformateur** : utilisez le transformateur `oibus-time-values-to-csv`
  avec le format de données `CSV`, ou le transformateur `oibus-time-values-to-json` avec le format de données `JSON`
  ou `Multiline JSON`. Une incohérence entre le transformateur et le format de données entraîne des échecs d'ingestion
  côté Azure Data Explorer.
- **L'ingestion est mise en file d'attente, pas en flux continu** : Azure Data Explorer accepte le lot et termine
  l'ingestion de manière asynchrone, si bien que les lignes ne deviennent interrogeables qu'après la latence de mise en
  lot propre à Azure Data Explorer (par défaut jusqu'à environ 5 minutes, régie par la politique de mise en lot
  d'ingestion de la table cible). Un envoi réussi dans OIBus signifie que les données ont été acceptées pour
  l'ingestion, pas qu'elles sont immédiatement interrogeables.
- **Le schéma doit préexister** : la table cible et tout mapping d'ingestion doivent être créés au préalable dans Azure
  Data Explorer. Ce connecteur ne crée ni ne modifie le schéma.

## Test de la connexion {#testing-the-connection}

L'action **Tester les paramètres** exécute une commande de gestion légère `.show table … cslschema` sur le cluster, la
base de données et la table configurés. Cela vérifie l'accessibilité du cluster, l'authentification, et que la table
cible existe, sans ingérer aucune donnée.
