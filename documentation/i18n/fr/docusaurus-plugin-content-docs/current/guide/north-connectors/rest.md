# API REST

Le **connecteur North API REST** permet à OIBus d'**envoyer des données vers n'importe quel point de terminaison HTTP
REST**, ce qui en fait un choix idéal pour l'intégration avec des API personnalisées, des webhooks et des services cloud
acceptant des charges utiles JSON ou des téléversements de fichiers.

OIBus peut transmettre :

- **Charges utiles de valeurs temporelles** : sérialisées en tant que corps JSON ou fichier JSON envoyé via FormData.
- **Fichiers** : transférés tels quels (compressés ou non compressés) via FormData.

**Exemples de cas d'usage** :

- **Intégration d'API personnalisée** : transmettre directement les données OIBus à une API REST interne ou tierce.
- **Livraison de webhook** : déclencher des systèmes externes avec des appels HTTP pilotés par événements.
- **Ingestion cloud** : transférer des données vers des plateformes cloud exposant un point de terminaison d'ingestion
  HTTP.

## Paramètres spécifiques {#specific-settings}

### Configuration de la connexion {#connection-configuration}

| Paramètre                             | Description                                                                                    | Exemple de valeur          |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------- |
| **Hôte**                                 | URL de base du serveur API REST. Doit commencer par `http://` ou `https://`.                         | `https://api.example.com`    |
| **Accepter les certificats non autorisés** | Accepter les certificats TLS auto-signés ou autrement non fiables.                                  | Activé/Désactivé              |
| **Méthode**                               | Méthode HTTP utilisée lors de l'envoi des données.                                                   | `POST`, `PUT`, `PATCH`        |
| **Point de terminaison**                  | Chemin ajouté à l'hôte pour former l'URL de requête complète.                                        | `/api/data`                   |
| **Délai d'expiration de la requête**      | Temps maximal (en secondes) d'attente d'une réponse avant que la requête ne soit considérée en échec. | `30`                          |
| **Envoyer la charge utile en tant que**   | Comment la charge utile est envoyée : en tant que **Body** brut ou en tant que pièce jointe multipart **File (FormData)**. | `Body`               |
| **Code de succès attendu**                | Code de statut HTTP indiquant une transmission réussie.                                              | `200`                          |

:::tip Envoyer la charge utile en tant que

- **Body** : la charge utile (contenu JSON ou fichier) est envoyée directement en tant que corps de la requête. OIBus
  définit automatiquement l'en-tête `Content-Type` en fonction de l'extension du fichier (`.json`, `.xml`, `.txt`,
  `.csv`).
- **File (FormData)** : la charge utile est jointe en tant que fichier dans une requête `multipart/form-data`. Utilisez
  cette option lorsque l'API attend un téléversement de fichier plutôt qu'un corps brut.
  :::

### Authentification {#authentication}

| Paramètre           | Description                                                                                                                                        | Exemple de valeur                                              |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **Type**              | Méthode d'authentification.                                                                                                                             | `None`, `Basic (username/password)`, `Bearer token`, `API key`    |
| **Nom d'utilisateur** | Nom d'utilisateur. Requis pour l'authentification Basic.                                                                                                | `api_user`                                                         |
| **Mot de passe**      | Mot de passe utilisé avec l'authentification Basic (laissez vide lors de la modification pour conserver le mot de passe existant).                     | `••••••••`                                                         |
| **Jeton Bearer**      | Jeton envoyé dans l'en-tête `Authorization: Bearer`, utilisé avec l'authentification Bearer token (laissez vide lors de la modification pour conserver le jeton existant). | `••••••••`                                     |
| **Clé API**           | Nom du paramètre de clé API. Requis pour l'authentification API key.                                                                                    | `X-API-Key`                                                        |
| **Valeur API**        | Valeur de la clé API, utilisée avec l'authentification API key (laissez vide lors de la modification pour conserver la valeur existante).             | `••••••••`                                                         |
| **Ajouter à**         | Où joindre la clé API : `Header` ou `Query parameters`. Requis pour API key.                                                                            | `Header`                                                           |

### Configuration du proxy {#proxy-configuration}

Si votre infrastructure réseau exige que les requêtes passent par un serveur proxy pour atteindre l'API REST cible,
activez l'option **Utiliser un proxy** et configurez les détails du proxy ci-dessous.

| Paramètre                | Description                                          | Exemple de valeur               |
| ------------------------- | ------------------------------------------------------ | -------------------------------- |
| **Utiliser un proxy**     | Router les requêtes via un serveur proxy.               | Activé/Désactivé                |
| **URL du proxy**          | URL du serveur proxy.                                   | `http://proxy.example.com:8080` |
| **Nom d'utilisateur proxy** | Nom d'utilisateur pour l'authentification proxy (si requis). | `proxy_user`                    |
| **Mot de passe proxy**    | Mot de passe pour l'authentification proxy (si requis). | `••••••••`                      |

### Paramètres de requête {#query-parameters}

Ajoutez des paramètres de requête statiques ajoutés à chaque URL de requête. Chaque entrée dispose d'une **Clé** et
d'une **Valeur**.

| Champ       | Description                     | Exemple de valeur |
| ------------- | ---------------------------------- | -------------------- |
| **Clé**       | Nom du paramètre de requête.       | `source`             |
| **Valeur**    | Valeur du paramètre de requête.    | `oibus`               |

### En-têtes {#headers}

Ajoutez des en-têtes HTTP personnalisés envoyés avec chaque requête. Chaque entrée dispose d'un nom de clé et d'une
valeur.

| Champ                            | Description               | Exemple de valeur   |
| ----------------------------------- | ---------------------------- | ---------------------- |
| **Nom de la clé d'en-tête HTTP**   | Nom de l'en-tête HTTP.       | `X-Custom-Header`      |
| **Valeur de l'en-tête HTTP**       | Valeur de l'en-tête HTTP.    | `my-value`              |

:::info En-têtes d'authentification
Les en-têtes définis dans la section **En-têtes** sont fusionnés avec tous les en-têtes générés par la configuration
d'authentification. Les en-têtes d'authentification (par exemple, `Authorization`) sont prioritaires si le même nom
d'en-tête est défini aux deux endroits.
:::

## Test de connexion {#connection-test}

Utilisez la section **Test de connexion** pour vérifier la connectivité avant qu'OIBus ne commence à envoyer des
données réelles.

| Paramètre                    | Description                                                                              | Exemple de valeur |
| ------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------- |
| **Méthode**                     | Méthode HTTP utilisée pour la requête de test.                                                | `GET`                 |
| **Point de terminaison de test** | Chemin utilisé pour la requête de test (ajouté à l'**Hôte** configuré).                       | `/health`             |
| **Body**                        | Corps JSON envoyé avec la requête de test. Disponible uniquement lorsque la méthode est `POST` ou `PUT`. | `{}`                  |
| **Code de succès attendu**      | Code de statut HTTP indiquant une réponse de test réussie.                                    | `200`                 |

Le test utilise le même hôte, la même authentification et les mêmes paramètres de proxy que la configuration réelle.
Il ne réutilise **pas** les paramètres de requête ou les en-têtes configurés — ceux-ci ne sont envoyés qu'avec les
données réelles.
