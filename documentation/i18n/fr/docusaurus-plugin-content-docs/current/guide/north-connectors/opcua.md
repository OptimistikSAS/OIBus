# OPC UA™

Le **connecteur North OPC UA™** permet à OIBus d'**écrire des données vers des serveurs OPC UA**, ce qui permet une
intégration transparente avec les systèmes industriels, les automates (PLC) et d'autres appareils compatibles OPC UA.
Contrairement au [connecteur South OPC UA](../south-connectors/opcua.mdx) qui lit des données depuis des serveurs OPC
UA, ce connecteur North **envoie des données** depuis OIBus vers des serveurs OPC UA.

**Exemples de cas d'usage**

- **Contrôle de processus** : écrire des consignes vers les automates
- **Gestion de la configuration** : mettre à jour les paramètres des appareils depuis des systèmes centralisés

## Paramètres spécifiques {#specific-settings}

### Configuration de la connexion {#connection-configuration}

| Paramètre                    | Description                                       | Exemple de valeur          |
| -------------------------------- | ------------------------------------------------------- | ----------------------------- |
| **URL du point de terminaison** | URL du serveur OPC UA.                                   | `opc.tcp://localhost:4840`   |
| **Garder la session active**     | Garder la session active entre les messages.             | Activé/Désactivé             |
| **Intervalle de nouvelle tentative** | Délai entre les tentatives (en millisecondes).       | `5000`                        |

### Paramètres de sécurité {#security-settings}

| Paramètre               | Description                                                                                                                                       | Exemple de valeur                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| **Mode de sécurité**       | Mode de sécurité de la connexion.                                                                                                                        | `None`, `Sign`, `Sign and encrypt`                       |
| **Politique de sécurité**  | Politique de sécurité de la connexion. Affichée uniquement lorsque **Mode de sécurité** est `Sign` ou `Sign and encrypt` — non utilisée lorsque Mode de sécurité est `None`. Voir la remarque ci-dessous pour la liste complète. | `None`, `Basic256-SHA256`, `AES128-SHA256-RSA-OAEP`     |

:::note Valeurs de la politique de sécurité

| Valeur                  | Description                                                                                                                 |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| None                   | Aucune sécurité. Les données sont transmises non chiffrées, sans authentification des messages.                            |
| Basic128               | Chiffrement AES-128, signature HMAC-SHA1, échange de clés RSA-1024.                                                          |
| Basic192               | Chiffrement AES-192, signature HMAC-SHA1, échange de clés RSA-1024.                                                          |
| Basic256               | ⚠️ **Obsolète.** Chiffrement AES-256, signature HMAC-SHA1. À éviter — SHA-1 est cryptographiquement faible.                 |
| Basic128-RSA15         | ⚠️ **Obsolète.** Chiffrement AES-128, signature HMAC-SHA1, remplissage RSA PKCS#1 v1.5. À éviter — SHA-1 et RSA-1.5 sont tous deux faibles. |
| Basic192-RSA15         | Chiffrement AES-192, signature HMAC-SHA1, remplissage RSA PKCS#1 v1.5.                                                       |
| Basic256-RSA15         | Chiffrement AES-256, signature HMAC-SHA1, remplissage RSA PKCS#1 v1.5.                                                       |
| Basic256-SHA256        | Chiffrement AES-256, signature HMAC-SHA256, remplissage RSA-OAEP. **Recommandé** pour la plupart des déploiements.          |
| AES128-SHA256-RSA-OAEP | Chiffrement AES-128, signature SHA-256, remplissage RSA-OAEP. Standard moderne (OPC UA Part 2 rev. 1.05).                    |
| PubSub AES-128-CTR     | Chiffrement symétrique AES-128-CTR pour le mode OPC UA Pub/Sub.                                                              |
| PubSub AES-256-CTR     | Chiffrement symétrique AES-256-CTR pour le mode OPC UA Pub/Sub.                                                              |

:::

### Authentification {#authentication}

| Paramètre           | Description                                                                | Exemple de valeur                          |
| --------------------- | --------------------------------------------------------------------------------- | --------------------------------------------- |
| **Authentification**  | Méthode d'authentification.                                                       | `None`, `Username/Password`, `Certificate`   |
| **Nom d'utilisateur** | Nom d'utilisateur pour l'authentification Username/Password.                      | `opc_user`                                   |
| **Mot de passe**      | Mot de passe pour l'authentification Username/Password.                           | `••••••••`                                   |
| **Chemin du fichier de certificat** | Chemin du fichier de certificat client. Requis pour l'authentification par certificat. | `/path/to/cert.pem`                    |
| **Chemin du fichier de clé** | Chemin du fichier de clé privée. Requis pour l'authentification par certificat.  | `/path/to/key.pem`                     |
