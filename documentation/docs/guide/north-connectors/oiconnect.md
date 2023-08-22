---
sidebar_position: 2
---

# OIConnect
OIConnect is a North connector used to send both files and JSON payloads to another OIBus endpoints:
-`/api/add-values` for [JSON payloads](#json-payload)
-`/api/add-file` for files

## Specific settings
To send data (JSON or files) to another OIBus, the following fields must be filled:
- **Host**: The hostname of the other OIBus (example: `http://1.2.3.4:2223`)
- **Username**: The username to connect to
- **Password**: The password associated to the username
- **Use proxy**: Use a proxy to send the HTTP requests
- **Proxy URL**: The URL to pass through
- **Proxy username**: Username attached to the proxy
- **Proxy password**: Associated password

## JSON payload
The other OIBus will accept these payloads:
````json
[
  {
    "timestamp": "2020-01-01T00:00:00.000Z",
    "data": "{ value: 28 }",
    "pointId": "MyPointId1"
  }
]
````

## Connecting two OIBus together
See [this doc](../advanced/oibus-to-oibus.md) to learn more on how to connect one OIBus to another.
