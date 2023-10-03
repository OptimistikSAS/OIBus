---
sidebar_position: 2
---

# OIBus
OIBus is a North connector specifically designed for sending data to other OIBus endpoints. It supports both 
[JSON payloads](#json-payload), sent to `/api/add-values`, and files, sent to `/api/add-file`.

## Specific settings
To transmit data, whether in JSON or file format, to another OIBus instance, you need to complete the following fields:
- **Host**: The hostname of the target OIBus (e.g., `http://1.2.3.4:2223`).
- **Username**: The username used for the connection.
- **Password**: The password associated with the specified username.
- **Use proxy**: An option to employ a proxy for HTTP requests.
- **Proxy URL**: The URL of the proxy server to be used.
- **Proxy username**: The username linked to the proxy.
- **Proxy password**: The password associated with the proxy username.

## JSON payload
The other OIBus will accept the following payload format:
```json title="JSON payload"
[
  {
    "timestamp": "2020-01-01T00:00:00.000Z",
    "data": "{ value: 28 }",
    "pointId": "MyPointId1"
  }
]
```

## Connecting two OIBus together
Refer to the [documentation provided](../advanced/oibus-to-oibus.md) for detailed instructions on how to establish a 
connection between one OIBus instance and another.

## HTTPS
OIBus only includes an HTTP server. To establish an HTTPS connection between two OIBus instances, it's recommended to 
utilize a dedicated HTTP server like Nginx or Apache as a reverse proxy in front of OIBus. By doing so, you can delegate 
certificate management to the HTTP server and securely forward HTTPS requests to the OIBus HTTP server on the relevant port.