---
sidebar_position: 4
---

# External sources and endpoints
## External source
An external source refers to a remote entity that transmits data to OIBus endpoints through HTTP requests. This functionality 
enables other applications to send data to OIBus without configuring South connectors.

North connectors have the capability to subscribe to either South connectors or external sources to retrieve data from 
these sources. However, if an external source is not defined within OIBus, any incoming data from that source will be 
disregarded to prevent cache saturation.

To register an external source, simply provide its name, which will be used as the query parameter `name`, as shown below. 
While optional, adding a description can be beneficial to provide context regarding the purpose of this external source.

## OIBus data endpoints
OIBus has the capability to receive data through two distinct endpoints:
- POST `/api/add-values`: This endpoint is used to accept values in JSON format within the payload. It utilizes basic authentication for security.
- POST `/api/add-file`: Here, data is received in the form of files using HTTP form-data. Basic authentication is also required for this endpoint.

Both of these endpoints necessitate the inclusion of the query parameter `name`, which specifies the external source 
associated with the data. The OIBus engine processes this data and stores it within the North caches that are subscribed 
to the specified external source.

## Data from another OIBus with OIConnect
If you intend to transfer data from one OIBus instance to another using an 
[OIConnect North connector](../../guide/north-connectors/oibus.md), the resulting `name` query parameter is `MyFirstOIBus:MyOIConnect`.
Consequently, your external source configuration must also be defined as `MyFirstOIBus:MyOIConnect` to establish the 
connection between the two OIBus instances.

## Data from another application
### JSON payload
To transmit data to OIBus using a JSON payload, you can make an HTTP request with the following payload:
```json title=Payload example
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

```curl title="curl command"
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

This request will result in a successful response with a `204 No Content` status.

### File payload
To send a file to OIBus, you can utilize the following curl command:
```curl title="curl command"
curl --location 'http://localhost:2223/api/add-file?name=%27test%27' \
-u <username>:<password> \
--form 'file=@"<file-path>"'
```

This request will result in a successful response with a `204 No Content` status.
