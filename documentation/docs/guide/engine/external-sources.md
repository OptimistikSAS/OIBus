---
sidebar_position: 4
---

# External sources and endpoints
## External source
An external source is a remote source that send values to OIBus with HTTP requests. North connectors can subscribe to 
external sources to filter data streams. If the external source is not defined in OIBus, the data received will be ignored
to avoid cache saturation.

## OIBus data endpoints
OIBus can receive data from its two endpoints:
- POST `/api/add-values` to receive values in JSON payload with basic authentication
- POST `/api/add-file` to receive values as files (HTTP form-data) with basic authentication

These two endpoints required a `name` query param. This `name` refers to an external source.
The data are retrieved by the OIBus engine and stored into the North caches subscribed to the external source.


## Data from another OIBus with OIConnect
You can send data from one OIBus to another with a [OIConnect](../../guide/north-connectors/oiconnect.md) North connector.
In this case, the `name` query param will be set to `MyFirstOIBus:MyOIConnect`, so your external source must be set to
`MyFirstOIBus:MyOIConnect`.

## Data from another application
### JSON payload
To send data into OIBus with JSON payload, you can use a HTTP request with the following payload:
```json
[
    {
        "timestamp": "2023-01-01T00:00:00.000Z",
        "pointId": "my reference",
        "data": {
            "value": 1234
        }
    },
    {
        "timestamp": "2023-01-01T10:00:00.000Z",
        "pointId": "another reference",
        "data": {
            "value": 456
        }
    }
]
```

Example:
```
curl --location 'http://localhost:2223/api/add-values?name=%27test%27' \
--header 'Content-Type: application/json' \
-u <username>:<password> \
--data '[
    {
        "timestamp": "2023-01-01T00:00:00.000Z",
        "pointId": "my reference",
        "data": {
            "value": 1234
        }
    },
    {
        "timestamp": "2023-01-01T10:00:00.000Z",
        "pointId": "another reference",
        "data": {
            "value": 456
        }
    }
]'
```

This request will successfully return a `204 No Content` status.

### File payload
To send a file to OIBus, you can use the following cURL command
Example:
```
curl --location 'http://localhost:2223/api/add-file?name=%27test%27' \
-u <username>:<password> \
--form 'file=@"<file-path>"'
```

This request will successfully return a `204 No Content` status.