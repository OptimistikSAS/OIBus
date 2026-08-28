---
displayed_sidebar: developerSidebar
sidebar_position: 6
---

import DownloadButton from '../../../../../src/components/DownloadButton';

# Pile de test locale

Le dépôt fournit un `docker-compose.yml` à sa racine qui démarre un ensemble complet de serveurs de
protocole et de simulateurs afin que vous puissiez développer et tester les connecteurs OIBus sans accès à
un équipement industriel réel. Cette page documente chaque service, ce qu'il simule, comment le configurer,
et comment le démarrer.

## Démarrage rapide {#quick-start}

La façon la plus simple de démarrer la pile est via les scripts npm définis dans `backend/package.json`.
Exécutez-les depuis le répertoire `backend/` :

```bash
# IoT protocol servers only (OPC UA, Modbus, MQTT)
npm run docker:iot

# IoT servers + database servers + simulator (recommended for connector development)
npm run docker:simulator

# PostgreSQL + InfluxDB
npm run docker:database

# FTP / SFTP servers only
npm run docker:ftp

# Syslog test receiver only
npm run docker:logging

# Squid forward proxy (with auth) only
npm run docker:proxy

# Full development stack: IoT + simulator + database
npm run docker:dev

# Everything including OIBus runtime and nginx
npm run docker:all

# Tear down all containers
npm run docker:down
```

Vous pouvez également invoquer Docker Compose directement si vous avez besoin d'une combinaison
personnalisée de profils :

```bash
docker compose --profile iot --profile database --profile simulator up -d
```

Les services sont regroupés en **profils Docker Compose** :

| Profil      | Services                                       |
| ----------- | ----------------------------------------------- |
| `iot`       | `opcua-server`, `modbus-server`, `mqtt-broker` |
| `simulator` | `simulator`                                    |
| `database`  | `postgres`, `influxdb`                         |
| `ftp`       | `ftp-server`, `sftp-server`                    |
| `logging`   | `syslog-server`                                |
| `proxy`     | `squid-proxy`                                  |
| `oibus`     | `oibus`, `nginx`                               |

:::note Indépendance des profils
Le profil `simulator` nécessite que les services des profils `iot` et `database` soient en cours
d'exécution (serveur Modbus, broker MQTT, InfluxDB et PostgreSQL). Démarrez-les toujours ensemble :
`--profile iot --profile database --profile simulator` (ou utilisez `npm run docker:simulator`, qui le
fait automatiquement).
:::

Tous les services partagent le réseau bridge interne `oibus-network`. Les ports sont redirigés vers
`localhost` afin qu'OIBus exécuté en dehors de Docker (c'est-à-dire `npm start` dans le répertoire
`backend/`) puisse les atteindre directement.

---

## Services {#services}

### Serveur OPC UA — `opcua-server` {#opc-ua-server--opcua-server}

| Propriété  | Valeur                                                                                                     |
| ---------- | --------------------------------------------------------------------------------------------------------- |
| **Image**  | [`mcr.microsoft.com/iotedge/opc-plc`](https://mcr.microsoft.com/en-us/artifact/mar/iotedge/opc-plc/about) |
| **Port**   | `50000` (OPC UA TCP)                                                                                      |
| **Config** | `docker/opcua/nodes_config.json`                                                                          |

Le [simulateur OPC PLC](https://github.com/Azure-Samples/iot-edge-opc-plc) de Microsoft. Il expose un
serveur OPC UA standard avec des nœuds personnalisés définis dans `nodes_config.json` ainsi qu'un ensemble
de nœuds intégrés (simulation de chaudière, variables changeant rapidement/lentement, etc.).

**Nœuds personnalisés** (dossier `OIBus`, tous avec `Historizing: true`) :

| ID de nœud | Description        | Type de données | Simulation  | Paramètres                          |
| ---------- | ------------------- | ---------------- | ----------- | ------------------------------------- |
| `1023`     | Température (°C)   | `Double`         | Marche aléatoire | 18 – 28 °C, pas 0,5, toutes les 2 s |
| `1024`     | Pression (hPa)      | `Double`         | Onde sinusoïdale | 1013,25 ± 10 hPa, période 10 s   |
| `1025`     | Débit (L/min)       | `Double`         | Marche aléatoire | 40 – 60 L/min, pas 1, toutes les 3 s |
| `1026`     | Humidité (%)        | `Double`         | Onde sinusoïdale | 65 ± 15 %, période 15 s          |
| `1027`     | RPM                 | `Int32`          | Marche aléatoire | 1 200 – 1 800, pas 50, toutes les 2,5 s |
| `1028`     | État de la pompe    | `Boolean`        | Onde carrée | période 20 s                         |
| `1029`     | Tension (V)         | `Double`         | Marche aléatoire | 210 – 230 V, pas 0,5, toutes les 2 s |
| `1030`     | Courant (A)         | `Double`         | Onde sinusoïdale | 15,2 ± 2 A, période 12 s          |

Les IDs de nœuds suivent l'espace de noms OPC UA `ns=3;i=<NodeId>`. L'adresse OPC UA de la température,
par exemple, est `ns=3;i=1023`.

**Prise en charge de l'historien :** `Historizing: true` active l'accès aux données historiques OPC UA
(HA) sur chaque nœud personnalisé. Le serveur répond aux requêtes `HistoryRead`, ce qui le rend adapté au
test du mode de requête historique d'OIBus.

:::caution Historique en mémoire uniquement
L'historique est stocké en RAM — il n'est pas persisté sur disque. Toutes les données historiques sont
perdues au redémarrage du conteneur. Les scénarios nécessitant un rattrapage après un long écart
(jours/semaines) ne peuvent pas être reproduits avec ce simulateur.
:::

**Authentification :** l'accès anonyme est désactivé. Utilisez les identifiants configurés via les
variables d'environnement `OPCUA_DEFAULT_PASSWORD` (par défaut `pass`) et `OPCUA_ADMIN_PASSWORD` (par
défaut `pass`), avec respectivement les noms d'utilisateur `oibus` et `admin` (définis dans
`docker-compose.yml`).

**Connexion depuis OIBus :** créez un connecteur South OPC UA avec les paramètres suivants :

| Paramètre                | Valeur                                |
| ------------------------- | -------------------------------------- |
| **URL**                   | `opc.tcp://localhost:50000`           |
| **Mode de sécurité**      | `none`                                 |
| **Politique de sécurité** | `none`                                 |
| **Authentification**      | `basic`                                |
| **Nom d'utilisateur**     | `oibus`                                |
| **Mot de passe**          | `pass` (ou `$OPCUA_DEFAULT_PASSWORD`) |

<div style={{ display: 'flex', justifyContent: 'center' }}>
  <DownloadButton link="/files/opcua-item-list.csv">Download item list (CSV)</DownloadButton>
</div>

---

### Serveur Modbus — `modbus-server` {#modbus-server--modbus-server}

| Propriété  | Valeur                                                               |
| ---------- | --------------------------------------------------------------------- |
| **Image**  | [`oitc/modbus-server`](https://hub.docker.com/r/oitc/modbus-server) |
| **Port**   | `5020` (Modbus TCP)                                                   |
| **Config** | `docker/modbus/server_config.json`                                    |

Un serveur Modbus TCP léger. Sa carte de registres est déclarée dans `server_config.json`. Le serveur
accepte les écritures de tout client Modbus TCP, de sorte que le [Simulateur](#unified-simulator--simulator)
peut mettre à jour dynamiquement les registres de maintien et les bobines en temps réel.

:::note Numérotation des clés server_config.json vs décalage d'adresse OIBus
Le fichier de configuration utilise des **clés de registre indexées à partir de 1** (`"1"`, `"2"`, …) car
le serveur est configuré avec `"zeroMode": false`. Ceci est un détail propre au format du fichier de
configuration du serveur uniquement — le Modbus TCP au niveau du câble est toujours indexé à partir de 0,
donc la correspondance est simplement `clé de config = adresse de protocole + 1`.

Ceci est indépendant du paramètre [**décalage d'adresse**](../guide/south-connectors/modbus.mdx#connection-configuration)
d'OIBus (Modbus vs JBus). Lors de la connexion d'OIBus à ce serveur, conservez le décalage **Modbus**
par défaut (pas de décalage) : OIBus envoie des adresses de protocole indexées à partir de 0, et le
serveur les résout en interne par rapport à ses clés indexées à partir de 1. Le décalage JBus ne serait
nécessaire que pour les appareils qui exposent des adresses indexées à partir de 1 au niveau même du
protocole Modbus.
:::

**Valeurs de registre initiales** (écrasées par le simulateur après sa connexion) :

| Type de registre | Adresse de protocole | Valeur initiale | Description                |
| ----------------- | :--------------------: | :----------------: | ---------------------------- |
| Registre d'entrée | 0                       | `314`               | Version du firmware (uint16) |
| Registre d'entrée | 1                       | `22136`             | Numéro de série — mot bas    |
| Registre d'entrée | 2                       | `4660`              | Numéro de série — mot haut   |
| Entrée discrète    | 0                       | `true`              | Porte du panneau fermée      |
| Entrée discrète    | 1                       | `true`              | Relais de sécurité OK        |
| Entrée discrète    | 2                       | `false`             | Réseau connecté              |
| Entrée discrète    | 3                       | `false`             | Arrêt d'urgence enclenché    |

Les registres d'entrée et les entrées discrètes sont **en lecture seule** du point de vue d'un client
Modbus, donc leurs valeurs sont statiques et proviennent de `server_config.json`. Les registres de
maintien et les bobines sont mis à jour toutes les 2 secondes par le simulateur.

**Connexion depuis OIBus :** créez un connecteur South Modbus avec les paramètres suivants :

| Paramètre                | Valeur       |
| -------------------------- | ------------- |
| **Hôte**                   | `localhost`   |
| **Port**                   | `5020`        |
| **ID esclave**              | `1`           |
| **Décalage d'adresse**     | `Modbus`      |

<div style={{ display: 'flex', justifyContent: 'center' }}>
  <DownloadButton link="/files/modbus-item-list.csv">Download item list (CSV)</DownloadButton>
</div>

---

### Broker MQTT — `mqtt-broker` {#mqtt-broker--mqtt-broker}

| Propriété  | Valeur                                                             |
| ---------- | --------------------------------------------------------------------- |
| **Image**  | [`eclipse-mosquitto`](https://hub.docker.com/_/eclipse-mosquitto) |
| **Ports**  | `1883` (MQTT), `9001` (WebSocket)                                  |
| **Config** | `docker/mosquitto/config/`                                          |

Eclipse Mosquitto avec un point d'entrée personnalisé (`docker/mosquitto/entrypoint.sh`) qui injecte les
identifiants `MQTT_USER` / `MQTT_PASSWORD` au démarrage. L'accès anonyme est désactivé.

Le port WebSocket `9001` est disponible pour les clients MQTT basés sur navigateur si nécessaire.

**Connexion depuis OIBus :** créez un connecteur South MQTT avec les paramètres suivants :

| Paramètre                | Valeur                        |
| -------------------------- | -------------------------------- |
| **URL**                    | `mqtt://localhost:1883`          |
| **QoS**                    | `1`                               |
| **Authentification**       | `basic`                          |
| **Nom d'utilisateur**      | `oibus`                          |
| **Mot de passe**           | `pass` (ou `$MQTT_PASSWORD`)     |

Les éléments s'abonnent aux [sujets scalaires](#scalar-topics) publiés par le simulateur (les sujets
JSON sont destinés aux tests `any-content` / transformateur personnalisé, pas aux éléments de valeur
ponctuelle) :

<div style={{ display: 'flex', justifyContent: 'center' }}>
  <DownloadButton link="/files/mqtt-item-list.csv">Download item list (CSV)</DownloadButton>
</div>

---

### Serveur Syslog — `syslog-server` _(profil : `logging`)_ {#syslog-server--syslog-server-_profile-logging_}

| Propriété  | Valeur                                                 |
| ---------- | --------------------------------------------------------- |
| **Image**  | [`python:3.14-slim`](https://hub.docker.com/_/python) |
| **Ports**  | `514` (UDP), `514` (TCP)                                |
| **Script** | `docker/syslog/syslog_server.py`                          |

Un récepteur syslog minimal utilisé pour tester le logger Syslog d'OIBus (Paramètres du moteur →
Journalisation → Syslog). Il écoute à la fois en UDP et en TCP sur le même port et affiche chaque ligne
reçue sur stdout — pas d'analyse ni d'authentification, il existe uniquement pour vous permettre de voir
exactement ce qu'OIBus envoie sur le réseau :

```bash
docker compose logs -f syslog-server
```

**Connexion depuis OIBus** : dans Paramètres du moteur → Journalisation → Syslog, définissez **Hôte**
`localhost`, **Port** `514`, **Protocole** `udp4` (ou `tcp`), puis activez le niveau de journal que vous
voulez tester.

---

### Proxy Squid — `squid-proxy` _(profil : `proxy`)_ {#squid-proxy--squid-proxy-_profile-proxy_}

| Propriété  | Valeur                                                         |
| ---------- | ----------------------------------------------------------------- |
| **Image**  | [`ubuntu/squid`](https://hub.docker.com/r/ubuntu/squid)       |
| **Port**   | `3128` (proxy direct HTTP/HTTPS)                                 |
| **Config** | `docker/squid/conf.d/auth.conf`, `docker/squid/entrypoint.sh` |

Un véritable proxy direct Squid nécessitant une authentification HTTP Basic, utilisé pour tester le
[serveur proxy](../guide/engine/engine-settings.mdx#proxy-server) d'OIBus — spécifiquement la
fonctionnalité [« Transférer vers un proxy en amont »](../guide/engine/engine-settings.mdx#forward-to-an-upstream-proxy).
`docker/squid/entrypoint.sh` génère `/etc/squid/passwords` au démarrage du conteneur à partir des
variables d'environnement `SQUID_USER` (par défaut `oibus`) / `SQUID_PASSWORD` (par défaut `pass`) en
utilisant `openssl passwd -6` ; `docker/squid/conf.d/auth.conf` est repris par le `include
/etc/squid/conf.d/*.conf` du squid.conf par défaut et exige `proxy_auth` sur chaque requête.

Pour tester la fonctionnalité de proxy direct : activez le propre serveur proxy d'OIBus, puis activez
**Transférer vers un proxy en amont** avec **URL** `http://localhost:3128` et les identifiants ci-dessus.
Les requêtes passant par le proxy d'OIBus ne réussissent que s'il attache correctement l'en-tête
`Proxy-Authorization` en amont — surveillez `docker compose logs -f squid-proxy`, ou essayez de mauvais
identifiants, pour le confirmer.

---

### PostgreSQL — `postgres` {#postgresql--postgres}

| Propriété | Valeur                                           |
| --------- | --------------------------------------------------- |
| **Image** | [`postgres`](https://hub.docker.com/_/postgres) |
| **Port**  | `5432`                                              |

Une instance PostgreSQL classique pour tester le connecteur South-PostgreSQL. Les identifiants sont :

| Variable            | Par défaut  |
| --------------------- | ----------- |
| `POSTGRES_USER`     | `oibus`     |
| `POSTGRES_PASSWORD` | `pass`      |
| `POSTGRES_DB`       | `oibus-db`  |

Remplacez les mots de passe via le fichier `.env` ou une variable d'environnement shell (par ex.
`POSTGRES_PASSWORD=secret docker compose up`).

Le [Simulateur](#unified-simulator--simulator) écrit des lignes dans une table `sensor_readings` toutes les
`POSTGRES_UPDATE_INTERVAL` secondes (par défaut 10 s), créée automatiquement à la première connexion :

```sql
CREATE TABLE IF NOT EXISTS sensor_readings (
    id SERIAL PRIMARY KEY,
    "timestamp" TIMESTAMPTZ NOT NULL,
    workshop TEXT NOT NULL,
    sensor_id TEXT NOT NULL,
    measurement TEXT NOT NULL,
    value DOUBLE PRECISION NOT NULL
);
```

---

### InfluxDB — `influxdb` {#influxdb--influxdb}

| Propriété | Valeur                                             |
| --------- | ----------------------------------------------------- |
| **Image** | [`influxdb:2`](https://hub.docker.com/_/influxdb) |
| **Port**  | `8088` (hôte) → `8086` (conteneur)                  |

Une instance InfluxDB 2.x pour tester le connecteur South-InfluxDB, initialisée au premier démarrage via
le mode de configuration intégré de l'image. Les identifiants / détails de connexion sont :

| Variable                        | Par défaut          |
| ---------------------------------- | -------------------- |
| `DOCKER_INFLUXDB_INIT_USERNAME` | `oibus`               |
| `INFLUXDB_PASSWORD`             | `oibuspassword`       |
| `DOCKER_INFLUXDB_INIT_ORG`      | `oibus`               |
| `DOCKER_INFLUXDB_INIT_BUCKET`   | `oibus-bucket`        |
| `INFLUXDB_TOKEN`                | `oibus-admin-token`   |

:::note Pourquoi pas `pass` ?
Tous les autres services de cette pile utilisent par défaut les identifiants `oibus` / `pass`, mais
InfluxDB 2 rejette les mots de passe de moins de 8 caractères lors de la configuration, donc `pass` ne
peut pas être utilisé ici. Remplacez-le par votre propre valeur (8+ caractères) via `INFLUXDB_PASSWORD`
si nécessaire.
:::

Le [Simulateur](#unified-simulator--simulator) écrit des points dans ce bucket toutes les
`INFLUXDB_UPDATE_INTERVAL` secondes (par défaut 10 s). Les données ne sont pas persistées lors de la
recréation du conteneur (aucun volume n'est monté), à l'image de la configuration éphémère du service
`postgres`.

Le conteneur écoute sur le port `8086` en interne, mappé au port `8088` de l'hôte pour éviter tout
conflit avec un InfluxDB installé localement. Les autres conteneurs sur `oibus-network` (comme le
simulateur) l'atteignent via `http://influxdb:8086` ; depuis l'hôte (par exemple OIBus exécuté via
`npm start`, ou l'interface InfluxDB dans un navigateur) utilisez `http://localhost:8088`.

Remplacez le mot de passe/jeton via le fichier `.env` ou une variable d'environnement shell (par ex.
`INFLUXDB_PASSWORD=secret docker compose up`).

**Exemple de requête d'élément (`version: 2`, Flux) :** OIBus substitue `@StartTime` / `@EndTime`
directement (sans guillemets) dans le paramètre `query` de l'élément, afin qu'ils puissent être utilisés
comme littéraux de temps Flux dans `range()`. Ceci interroge la mesure `temperature` écrite par le
simulateur, filtrée sur un seul capteur via ses tags :

```flux title="South-InfluxDB item query"
from(bucket: "oibus-bucket")
  |> range(start: @StartTime, stop: @EndTime)
  |> filter(fn: (r) => r._measurement == "temperature")
  |> filter(fn: (r) => r._field == "value")
  |> filter(fn: (r) => r.workshop == "workshop1" and r.sensor_id == "sensor1")
  |> keep(columns: ["_time", "_value", "workshop", "sensor_id"])
```

Supprimez les deux derniers appels `filter()` (ou ajustez les valeurs des tags) pour récupérer tous les
ateliers/capteurs d'une mesure, ou remplacez `"temperature"` par l'une des autres mesures que le
simulateur écrit (`humidity`, `pressure`, `vibration`, `co2` — voir le
[tableau des capteurs ci-dessous](#influxdb-thread)).

:::tip Exclure le début de la plage
Le `range()` de Flux inclut `start` (`start <= _time < stop`). Comme la prochaine interrogation d'OIBus
commence exactement là où `@EndTime` de la précédente s'est arrêté, un point tombant exactement sur cette
limite serait retourné deux fois. Ajoutez un filtre explicite sur `_time` pour rendre le début exclusif
lui aussi :

```flux
from(bucket: "oibus-bucket")
  |> range(start: @StartTime, stop: @EndTime)
  |> filter(fn: (r) => r._time > @StartTime)
  |> filter(fn: (r) => r._measurement == "temperature")
  |> filter(fn: (r) => r._field == "value")
```

:::

---

### Serveur FTP — `ftp-server` _(profil : `ftp`)_ {#ftp-server--ftp-server-_profile-ftp_}

| Propriété | Valeur                                                     |
| --------- | --------------------------------------------------------------- |
| **Image** | [`fauria/vsftpd`](https://hub.docker.com/r/fauria/vsftpd) |
| **Ports** | `20`, `21`, `21100–21110` (passif)                          |

vsftpd en mode passif. Identifiants : `oibus` / `pass` (remplacez le mot de passe via `FTP_PASSWORD`).
Les fichiers atterrissent dans `docker/ftp/data/`.

---

### Serveur SFTP — `sftp-server` _(profil : `ftp`)_ {#sftp-server--sftp-server-_profile-ftp_}

| Propriété | Valeur                                               |
| --------- | ----------------------------------------------------- |
| **Image** | [`atmoz/sftp`](https://hub.docker.com/r/atmoz/sftp) |
| **Port**  | `2222` (SSH)                                            |

Serveur SFTP mono-utilisateur. Identifiants : `oibus` / `pass` (remplacez le mot de passe via
`SFTP_PASSWORD`). Répertoire de téléversement : `docker/sftp/data/`.

---

### Environnement d'exécution OIBus — `oibus` _(profil : `oibus`)_ {#oibus-runtime--oibus-_profile-oibus_}

| Propriété | Valeur                                                                                        |
| --------- | -------------------------------------------------------------------------------------------------- |
| **Image** | [`ghcr.io/optimistiksas/oibus`](https://github.com/OptimistikSAS/OIBus/pkgs/container/oibus) |
| **Port**  | `2223` (interface web / API)                                                                        |
| **Data**  | `./data-folder` → `/app/OIBus/OIBusData`                                                          |

L'environnement d'exécution OIBus lui-même, utile lorsque vous voulez tester la pile complète dans Docker
plutôt que d'exécuter le backend avec `npm start`. Voir [Image Docker](./docker.mdx) pour plus de détails
sur cette image.

---

### Nginx — `nginx` _(profil : `oibus`)_ {#nginx--nginx-_profile-oibus_}

| Propriété  | Valeur                                     |
| ---------- | --------------------------------------------- |
| **Image**  | [`nginx`](https://hub.docker.com/_/nginx) |
| **Ports**  | `80` (HTTP), `443` (HTTPS)                   |
| **Config** | `docker/nginx/`                               |

Reverse proxy devant le conteneur OIBus. Nécessite la variable d'environnement `DOMAIN` et des
certificats TLS dans `docker/nginx/certs/`. Nécessaire uniquement lors du test de la configuration
complète TLS / reverse-proxy.

---

### Simulateur unifié — `simulator` {#unified-simulator--simulator}

| Propriété       | Valeur                                                                |
| ---------------- | -------------------------------------------------------------------- |
| **Image**        | [`python:3.14-slim`](https://hub.docker.com/_/python)                |
| **Script**       | `docker/simulator/simulator.py`                                      |
| **Bibliothèques** | `pymodbus==3.6.9`, `paho-mqtt`, `influxdb-client`, `psycopg2-binary` |

Un unique script Python qui pilote le serveur Modbus, le broker MQTT, InfluxDB et PostgreSQL. Il exécute
un thread démon par source, chacun avec sa propre boucle de réessai indépendante afin qu'une défaillance
d'une source n'affecte pas les autres.

#### Thread Modbus {#modbus-thread}

Écrit sur le serveur Modbus toutes les `MODBUS_UPDATE_INTERVAL` secondes (par défaut 2 s). Toutes les
valeurs sont sinusoïdales avec 5 % de bruit aléatoire, sauf indication contraire.

**Registres de maintien — uint16 (1 mot) :**

| Adresse protocole | Nom          | Base | Amplitude | Période |
| :------------------: | ------------ | ---: | --------: | -----: |
| 0                     | temperature  |  250 |        50 |   60 s |
| 1                     | humidity     |  600 |       200 |  120 s |
| 2                     | pressure     |  100 |        30 |  180 s |
| 3                     | vibration    |  250 |       200 |   30 s |
| 4                     | co2          |  600 |       200 |  300 s |
| 5                     | flow_rate    |  150 |        80 |   90 s |

**Registres de maintien — types de données étendus (multi-mots) :**

| Adresse protocole | Nom               | Type de données |    Base | Amplitude | Période |
| :------------------: | ------------------ | --------- | ------: | --------: | -----: |
| 6                     | outdoor_temp       | int16     |       5 |        25 |  240 s |
| 7 – 8                 | production_count   | uint32    |  50 000 |    40 000 |  600 s |
| 9 – 10                | power_kw           | float     |    75,5 |      45,0 |  180 s |
| 11 – 12               | energy_balance      | int32     |       0 |     5 000 |  360 s |
| 13 – 16               | shaft_speed         | double    | 1 500,0 |     300,0 |  120 s |
| 17                    | status_flags        | bitfield  |       — |         — |      — |

`status_flags` est un registre 16 bits dont les bits individuels sont des ondes carrées indépendantes :

| Bit | Nom              | Période |
| :-: | ----------------- | -----: |
| 0   | motor_running     |   60 s |
| 1   | fault_detected    |  300 s |
| 2   | maintenance_due   |  600 s |
| 3   | overload          |  120 s |

**Bobines (onde carrée, 1 = activé pour la première moitié de la période) :**

| Adresse protocole | Nom           | Période |
| :------------------: | -------------- | -----: |
| 0                     | pump_running   |   30 s |
| 1                     | valve_open     |   45 s |
| 2                     | alarm_active   |  120 s |
| 3                     | machine_on     |   20 s |

:::info Encodage multi-mots
OIBus applique un `swap32() + swap16()` inconditionnel sur les valeurs multi-mots avant de les lire. Le
simulateur en tient compte en écrivant le **mot de 16 bits bas avant le mot de 16 bits haut** au sein de
chaque dword de 32 bits. Ceci correspond aux paramètres OIBus par défaut (`swapWordsInDWords: false`,
`endianness: big-endian`).
:::

#### Thread MQTT {#mqtt-thread}

Publie sur le broker MQTT toutes les `MQTT_UPDATE_INTERVAL` secondes (par défaut 2 s). Chaque cycle de
publication envoie **deux familles** de sujets :

- **Sujets scalaires** — un nombre unique, pour les éléments basés sur des valeurs.
- **Sujets JSON** (sous `<workshop>/json/<shape>`) — des charges utiles structurées de différentes formes.
  Le South MQTT d'OIBus les ingère en tant qu'`any-content`, ce qui les rend idéaux pour tester des
  transformateurs personnalisés.

##### Sujets scalaires {#scalar-topics}

Les sujets suivent le modèle `<workshop>/<sensor>/<type>` et transportent un nombre nu (par ex. `23.5`).
Toutes les valeurs sont sinusoïdales avec 5 % de bruit aléatoire.

| Sujet                            |    Base | Amplitude | Période |
| ---------------------------------- | ------: | --------: | -----: |
| `workshop1/sensor1/temperature` |    30,0 |      10,0 |   60 s |
| `workshop1/sensor2/humidity`     |    55,0 |      25,0 |  120 s |
| `workshop1/sensor3/pressure`     | 1 000,0 |      50,0 |  180 s |
| `workshop1/sensor4/vibration`    |     5,0 |       5,0 |   30 s |
| `workshop2/sensor1/temperature` |    28,0 |       8,0 |   90 s |
| `workshop2/sensor2/humidity`     |    50,0 |      20,0 |  150 s |
| `workshop2/sensor3/pressure`     |   990,0 |      40,0 |  210 s |
| `workshop2/sensor4/vibration`    |     4,0 |       4,0 |   45 s |

##### Sujets JSON {#json-topics}

Chaque sujet publie une **forme** JSON différente, afin que les connecteurs et les transformateurs
personnalisés puissent être testés sur toute la gamme des charges utiles qu'OIBus peut recevoir via MQTT.
Les valeurs numériques varient à chaque cycle (sinusoïdales avec bruit).

| Sujet                    | Forme                                    |
| -------------------------- | ------------------------------------------ |
| `workshop1/json/flat`    | Objet plat (lecture unique)                |
| `workshop1/json/nested`  | Objets imbriqués                           |
| `workshop1/json/array`   | Tableau de lectures (un lot)               |
| `workshop2/json/mixed`   | Chaque type scalaire JSON + tableau + objet |
| `workshop2/json/string`  | Une chaîne JSON                            |
| `workshop2/json/number`  | Un nombre JSON nu                          |

Exemples de charges utiles :

```json title="workshop1/json/flat"
{ "value": 35.17, "unit": "celsius", "timestamp": "2026-06-04T08:15:06.673+00:00", "quality": "good" }
```

```json title="workshop1/json/nested"
{
  "sensor": { "id": "sensor-42", "type": "temperature", "location": { "workshop": "workshop1", "line": 3 } },
  "reading": { "value": 34.9, "timestamp": "2026-06-04T08:15:06.673+00:00" }
}
```

```json title="workshop1/json/array"
[
  { "timestamp": "2026-06-04T08:15:06.673+00:00", "value": 34.95 },
  { "timestamp": "2026-06-04T08:15:08.673+00:00", "value": 35.48 },
  { "timestamp": "2026-06-04T08:15:10.673+00:00", "value": 37.16 }
]
```

```json title="workshop2/json/mixed"
{
  "int": 116,
  "float": 3.741,
  "bool": true,
  "string": "ok",
  "null": null,
  "tags": ["alpha", "beta"],
  "nested": { "a": 1, "b": [1, 2, 3] }
}
```

```json title="workshop2/json/string"
"reading-12"
```

```json title="workshop2/json/number"
42.7
```

:::tip Tester des transformateurs personnalisés
Les charges utiles `nested`, `array` et `mixed` contiennent des champs qui sont eux-mêmes des objets ou
des tableaux. Elles sont utiles pour tester un transformateur personnalisé qui dérive le nom de fichier
ou le contenu de sortie à partir d'un champ de charge utile — le retour d'une valeur non-chaîne à cet
endroit ne doit jamais atteindre la base de données de métriques, et ces sujets facilitent la
reproduction de ce cas limite.
:::

#### Thread InfluxDB {#influxdb-thread}

Écrit sur InfluxDB toutes les `INFLUXDB_UPDATE_INTERVAL` secondes (par défaut **10 s**). Chaque cycle
d'écriture écrit un point par capteur, chacun étiqueté avec `workshop` et `sensor_id` et transportant un
seul champ `value`, répartis sur plusieurs mesures afin que le connecteur South InfluxDB d'OIBus ait
plusieurs mesures/tags à interroger :

| Mesure       | Atelier   | ID capteur |   Base | Amplitude | Période |
| ------------- | --------- | ---------- | -----: | --------: | -----: |
| temperature   | workshop1 | sensor1    |   22,0 |       5,0 |   60 s |
| humidity      | workshop1 | sensor2    |   45,0 |      15,0 |   90 s |
| pressure      | workshop1 | sensor3    | 1010,0 |      20,0 |  120 s |
| temperature   | workshop2 | sensor1    |   20,0 |       4,0 |   75 s |
| vibration     | workshop2 | sensor2    |    3,0 |       2,0 |   40 s |
| co2           | workshop2 | sensor3    |  500,0 |     150,0 |  200 s |

#### Thread PostgreSQL {#postgresql-thread}

Écrit sur PostgreSQL toutes les `POSTGRES_UPDATE_INTERVAL` secondes (par défaut **10 s**), en insérant
une ligne par capteur dans la table `sensor_readings` (voir [PostgreSQL](#postgresql--postgres)
ci-dessus). Il utilise exactement la même liste de capteurs que le thread InfluxDB, avec les colonnes
`workshop`/`sensor_id`/`measurement` remplaçant les tags d'InfluxDB — de sorte que les deux bases de
données finissent avec les mêmes données, adaptées à leurs modèles de requête respectifs (tags Flux/InfluxQL
vs une clause SQL `WHERE`).

#### Variables d'environnement {#environment-variables}

| Variable                    | Par défaut               | Description                                                |
| ----------------------------- | ------------------------- | -------------------------------------------------------------- |
| `RETRY_INTERVAL`            | `10`                       | Secondes entre les tentatives de reconnexion                    |
| `MODBUS_HOST`               | `modbus-server`            | Nom d'hôte du serveur Modbus                                     |
| `MODBUS_PORT`               | `5020`                     | Port TCP Modbus                                                  |
| `MODBUS_SLAVE_ID`           | `1`                        | ID esclave / unité Modbus                                        |
| `MODBUS_UPDATE_INTERVAL`    | `2`                        | Secondes entre les cycles d'écriture Modbus                     |
| `MQTT_BROKER`               | `mqtt-broker`              | Nom d'hôte du broker MQTT                                        |
| `MQTT_PORT`                 | `1883`                     | Port MQTT                                                        |
| `MQTT_USER`                 | `oibus`                    | Nom d'utilisateur MQTT                                           |
| `MQTT_PASSWORD`             | `pass`                     | Mot de passe MQTT (également défini via `$MQTT_PASSWORD`)       |
| `MQTT_UPDATE_INTERVAL`      | `2`                        | Secondes entre les cycles de publication MQTT                   |
| `INFLUXDB_URL`              | `http://influxdb:8086`     | URL de base InfluxDB                                             |
| `INFLUXDB_TOKEN`            | `oibus-admin-token`        | Jeton API InfluxDB (également défini via `$INFLUXDB_TOKEN`)     |
| `INFLUXDB_ORG`              | `oibus`                    | Organisation InfluxDB                                            |
| `INFLUXDB_BUCKET`           | `oibus-bucket`             | Bucket InfluxDB                                                  |
| `INFLUXDB_UPDATE_INTERVAL`  | `10`                       | Secondes entre les cycles d'écriture InfluxDB                   |
| `POSTGRES_HOST`             | `postgres`                 | Nom d'hôte du serveur PostgreSQL                                 |
| `POSTGRES_PORT`             | `5432`                     | Port PostgreSQL                                                  |
| `POSTGRES_USER`             | `oibus`                    | Nom d'utilisateur PostgreSQL                                     |
| `POSTGRES_PASSWORD`         | `pass`                     | Mot de passe PostgreSQL (également défini via `$POSTGRES_PASSWORD`) |
| `POSTGRES_DB`               | `oibus-db`                 | Nom de la base de données PostgreSQL                             |
| `POSTGRES_UPDATE_INTERVAL`  | `10`                       | Secondes entre les cycles d'écriture PostgreSQL                 |

---

## Mots de passe et secrets {#passwords-and-secrets}

Chaque service utilise les mêmes identifiants par défaut, `oibus` / `pass`, il n'y a donc qu'une seule
paire à retenir pour connecter OIBus à l'un d'entre eux. La seule exception est InfluxDB, dont le mot de
passe doit comporter au moins 8 caractères (voir [sa note ci-dessus](#influxdb--influxdb)). Les valeurs
sensibles sont lues depuis des variables d'environnement — créez un fichier `.env` à la racine du dépôt
pour les remplacer localement sans toucher à `docker-compose.yml` :

```dotenv title=".env"
MQTT_PASSWORD=my_mqtt_secret
POSTGRES_PASSWORD=my_pg_secret
INFLUXDB_PASSWORD=my_influx_secret
INFLUXDB_TOKEN=my_influx_token
FTP_PASSWORD=my_ftp_secret
SFTP_PASSWORD=my_sftp_secret
OPCUA_DEFAULT_PASSWORD=my_opcua_secret
OPCUA_ADMIN_PASSWORD=my_admin_secret
SQUID_PASSWORD=my_squid_secret
DOMAIN=oibus.example.com
```

`.env` figure dans `.gitignore` — il ne sera jamais commité.

---

## Commandes utiles {#useful-commands}

```bash
# Start the recommended development stack (IoT servers + simulator + database)
npm run docker:dev

# Tail simulator logs (Modbus + MQTT writes)
docker compose logs -f simulator

# Restart the simulator after changing docker/simulator/simulator.py
docker compose --profile simulator up -d --force-recreate simulator

# Restart the Modbus server after changing docker/modbus/server_config.json
docker compose --profile iot up -d --force-recreate modbus-server

# Stop everything and remove containers (data volumes are kept)
npm run docker:down
```
