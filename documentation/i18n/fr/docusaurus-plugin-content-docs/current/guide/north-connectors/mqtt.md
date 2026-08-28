# MQTT

Le **connecteur North MQTT** permet à OIBus de **publier des données vers des brokers MQTT**, ce qui permet une
intégration transparente avec les plateformes IoT, les files de messages et les systèmes compatibles MQTT.

**Exemples de cas d'usage**

- **Intégration de plateformes IoT** : publier des données de capteurs vers des plateformes IoT cloud
- **Notifications en temps réel** : envoyer des alertes et des événements aux systèmes abonnés
- **Contrôle des appareils en périphérie** : envoyer des commandes aux appareils en périphérie via des sujets MQTT

## Paramètres spécifiques {#specific-settings}

### Configuration de la connexion {#connection-configuration}

| Paramètre                              | Description                                                                                                                                        | Exemple de valeur                |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| **URL**                                  | URL du broker MQTT.                                                                                                                                        | `mqtt://broker.example.com:1883`   |
| **QoS**                                  | Niveau de qualité de service : `0` (au plus une fois), `1` (au moins une fois), `2` (exactement une fois).                                                | `0`, `1`, `2`                       |
| **Rejeter les connexions non autorisées** | Rejeter les connexions qui ne peuvent pas être autorisées.                                                                                                | Activé/Désactivé                   |
| **Période de reconnexion**               | Intervalle entre les tentatives de reconnexion (en millisecondes).                                                                                        | `5000`                              |
| **Délai d'expiration de connexion**      | Temps maximal d'attente d'une connexion (en millisecondes).                                                                                               | `30000`                             |
| **Persistant**                           | Activer pour des sessions persistantes qui survivent aux redémarrages du broker. Disponible uniquement lorsque **QoS** est `1` ou `2` — une session QoS `0` ne peut pas être persistante. | Activé/Désactivé                   |

### Authentification {#authentication}

| Paramètre           | Description                                                                                                                       | Exemple de valeur                          |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| **Authentification**  | Méthode d'authentification.                                                                                                              | `None`, `Username/Password`, `Certificate`   |
| **Nom d'utilisateur** | Nom d'utilisateur pour l'authentification auprès du broker. Requis pour Username/Password.                                              | `mqtt_user`                                  |
| **Mot de passe**      | Mot de passe pour l'authentification auprès du broker. Utilisé avec Username/Password (laissez vide lors de la modification pour conserver le mot de passe existant). | `••••••••`                                   |
| **Chemin du fichier de certificat** | Chemin vers le fichier de certificat signé. Requis pour l'authentification par certificat.                              | `/path/to/cert.pem`                          |
| **Chemin du fichier de clé** | Chemin vers le fichier de clé privée. Requis pour l'authentification par certificat.                                          | `/path/to/key.pem`                           |
| **Chemin du fichier CA** | Chemin vers le fichier de l'autorité de certification. Requis pour l'authentification par certificat.                            | `/path/to/ca.pem`                            |
