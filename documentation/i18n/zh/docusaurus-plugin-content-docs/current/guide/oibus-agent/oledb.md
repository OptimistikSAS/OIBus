---
sidebar_position: 4
---

# OLEDB

发送 HTTP 请求以连接到 ODBC 驱动程序，并通过 SQL 查询读取数据。

## HTTP API {#http-api}

### 状态 {#status}

```
curl --location 'http://localhost:2224/api/ole/id/status'
```

### 连接 {#connection}

```
curl --location --request PUT 'http://localhost:2224/api/ole/id/connect' \
--header 'Content-Type: application/json' \
--data '{
"connectionString": "Driver={AspenTech SQLplus};HOST=localhost;PORT=10014",
"connectionTimeout": 10000
}'
```

### 读取 {#read}

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

### 断开连接 {#disconnection}

```
curl --location --request DELETE 'http://localhost:2224/api/ole/id/disconnect'
```
