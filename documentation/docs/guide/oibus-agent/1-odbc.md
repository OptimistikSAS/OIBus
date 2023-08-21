---
sidebar_position: 2
---

# ODBC
Send HTTP queries to connect to an ODBC driver and read data through SQL queries.

## Status
```
curl --location 'http://localhost:2224/api/odbc/id/status'
```

## Connection
```
curl --location --request PUT 'http://localhost:2224/api/odbc/id/connect' \
--header 'Content-Type: application/json' \
--data '{
"connectionString": "Driver={AspenTech SQLplus};HOST=localhost;PORT=10014",
"connectionTimeout": 10000
}'
```

## Read
```
curl --location --request PUT 'http://localhost:2224/api/odbc/id/read' \
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

## Disconnection
```
curl --location --request DELETE 'http://localhost:2224/api/odbc/id/disconnect'
```

