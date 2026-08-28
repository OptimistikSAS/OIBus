# OIAnalytics®

Le **connecteur North OIAnalytics®** envoie des fichiers et des valeurs à l'**application SaaS OIAnalytics®**, en prenant
en charge à la fois les **charges utiles JSON** et les **données basées sur des fichiers**.

OIAnalytics® peut traiter :

- **Charges utiles JSON de valeurs temporelles** : points de données formatés provenant de protocoles South (par
  exemple, OPC UA, MQTT).
- **Fichiers** : transmis tels quels (compressés ou non compressés). Les formats pris en charge incluent CSV, TXT et
  XLSX.

OIAnalytics® inclut des **analyseurs de fichiers intégrés**, éliminant le besoin de prétraitement. L'analyse est
configurée directement dans l'application SaaS.

**Exemples de cas d'usage** :

- **Analytique en temps réel** : envoyer des charges utiles JSON pour un traitement immédiat.
- **Stockage de données historiques** : transmettre des fichiers à des fins d'archivage et d'analyse.
- **Intégration** : combiner avec les tableaux de bord, les alertes et les outils d'analyse d'OIAnalytics®.

## Paramètres spécifiques {#specific-settings}

| Paramètre                              | Description                                                                                                | Exemple de valeur |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------- |
| **Utiliser l'enregistrement OIAnalytics** | Utiliser les paramètres de connexion issus de l'[enregistrement OIAnalytics](../installation/oianalytics.mdx).  | Activé/Désactivé    |
| **Délai d'expiration**                   | Durée (en secondes) avant qu'un échec de connexion ne soit signalé.                                              | `30`                 |
| **Compresser les données**               | Compresser les données si elles ne le sont pas déjà. Ajoute l'extension `.gz` aux fichiers et compresse les charges utiles JSON. | Activé/Désactivé    |

### Configuration manuelle (si l'enregistrement n'est pas utilisé) {#manual-configuration-if-registration-is-not-used}

| Paramètre                              | Description                                                                     | Exemple de valeur                    |
| ----------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------- |
| **Hôte**                                 | Nom d'hôte de l'application SaaS OIAnalytics®.                                          | `https://optimistik.oianalytics.com`   |
| **Accepter les certificats non autorisés** | Activer si les requêtes HTTP transitent par un pare-feu qui supprime les certificats.  | Activé/Désactivé                       |

#### Authentification {#authentication}

| Paramètre           | Description                                                                        | Exemple de valeur                                                                                            |
| --------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Authentification**  | Méthode d'authentification.                                                              | `Access key/Secret`, `Azure Active Directory with client secret`, `Azure Active Directory with certificate`     |
| **Clé d'accès**       | Clé d'accès. Requise pour Access key/Secret.                                             | `my-access-key`                                                                                                   |
| **Secret**            | Clé secrète. Requise pour Access key/Secret.                                             | `••••••••`                                                                                                        |
| **ID du tenant**      | ID du tenant Azure AD. Requis pour les méthodes AAD.                                     | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`                                                                            |
| **ID client**         | ID de l'application (client). Requis pour les méthodes AAD.                              | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`                                                                            |
| **Secret client**     | Secret client de l'application. Requis pour Azure Active Directory with client secret.   | `••••••••`                                                                                                        |
| **Certificat**        | Certificat de l'application. Requis pour Azure Active Directory with certificate.        | (sélectionné dans une liste)                                                                                      |
| **Portée**            | Portée OAuth2. Requise pour Azure Active Directory with certificate.                     | `https://example.com/.default`                                                                                    |

#### Configuration du proxy {#proxy-configuration}

Si votre infrastructure réseau exige que les requêtes passent par un serveur proxy pour atteindre OIAnalytics®, activez
**Utiliser un proxy** et configurez les détails du proxy ci-dessous.

| Paramètre                | Description                                          | Exemple de valeur               |
| ------------------------- | ------------------------------------------------------ | -------------------------------- |
| **Utiliser un proxy**     | Router les requêtes via un serveur proxy.               | Activé/Désactivé                |
| **URL du proxy**          | URL du serveur proxy.                                   | `http://proxy.example.com:8080` |
| **Nom d'utilisateur proxy** | Nom d'utilisateur pour l'authentification proxy (si requis). | `proxy_user`                    |
| **Mot de passe proxy**    | Mot de passe pour l'authentification proxy (si requis). | `••••••••`                      |

## Connexion d'OIBus à OIAnalytics® {#connecting-oibus-to-oianalytics}

### Approche recommandée : enregistrement OIAnalytics {#recommended-approach-oianalytics-registration}

1. **Enregistrez OIBus** sur OIAnalytics® pour une intégration transparente et une communication sécurisée.
2. Activez **Utiliser l'enregistrement OIAnalytics** dans les paramètres du connecteur North.
   - Cela élimine le besoin de transférer manuellement les clés API, renforçant la sécurité.

:::tip Enregistrement d'OIBus dans OIAnalytics®
Pour la procédure d'enregistrement complète, reportez-vous au [guide d'enregistrement OIAnalytics](../installation/oianalytics.mdx).
:::

### Approche alternative : authentification par clé API {#alternative-approach-api-key-authentication}

Si vous choisissez de ne pas enregistrer OIBus sur OIAnalytics®, obtenez une clé API :

1. Dans OIAnalytics®, accédez à **Configuration → Utilisateurs**.
2. Sélectionnez l'utilisateur et cliquez sur l'**icône de clé** pour générer une clé API.
3. Copiez et conservez en lieu sûr à la fois la **clé API** et son mot de passe associé.
4. Saisissez la clé API et la clé secrète dans OIBus.

![Génération d'une clé API OIAnalytics](../../../static/img/guide/north/oianalytics/oia-api-key-gen.png)

:::danger Récupération du mot de passe
Le mot de passe n'est **affiché qu'une seule fois** lors de la génération de la clé API. En cas de perte, vous devez
générer une nouvelle clé API.
:::

:::tip Gestion des utilisateurs API

- Créez un **utilisateur API dédié** dans OIAnalytics® avec un accès API exclusif.
- Attribuez une **clé API unique** à chaque instance OIBus pour faciliter la gestion et la sécurité.

:::

## Format des données {#data-format}

- Les **valeurs temporelles** OIBus sont envoyées sous forme de **charges utiles JSON** à OIAnalytics®.
- OIAnalytics® référence directement les données externes dans le champ `pointId` des valeurs temporelles (aucun
  analyseur de fichiers nécessaire).
