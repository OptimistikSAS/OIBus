---
sidebar_position: 4
---

# OLEDB

Envoyez des requêtes HTTP pour vous connecter à un pilote ODBC et lire des données via des requêtes SQL.

## API HTTP {#http-api}

### État {#status}

```
curl --location 'http://localhost:2224/api/ole/id/status'
```

### Connexion {#connection}

```
curl --location --request PUT 'http://localhost:2224/api/ole/id/connect' \
--header 'Content-Type: application/json' \
--data '{
"connectionString": "Driver={AspenTech SQLplus};HOST=localhost;PORT=10014",
"connectionTimeout": 10000
}'
```

### Lecture {#read}

```
curl --location --request PUT 'http://localhost:2224/api/ole/id/read' \
--header 'Content-Type: application/json' \
--data '{
    "connectionString": "Driver={AspenTech SQLplus};HOST=localhost;PORT=10014",
    "sql": "SELECT timestamp, reference, value FROM demo",
    "readTimeout": 10000,
    "timeColumn": "timestamp",
    "datasourceTimestampFormat": "yyyy-MM-dd HH:mm:ss.SSS",
    "datasourceTimezone": "Europe/Paris",
    "delimiter": ";",
    "outputTimestampFormat": "yyyy-MM-dd HH:mm:ss.SSS",
    "outputTimezone": "UTC"
}'
```

### Déconnexion {#disconnection}

```
curl --location --request DELETE 'http://localhost:2224/api/ole/id/disconnect'
```
