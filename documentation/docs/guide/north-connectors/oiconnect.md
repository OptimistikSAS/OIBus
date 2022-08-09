---
sidebar_position: 3
---

# OIConnect
OIConnect is a North connector used to send both files and JSON payloads to a REST API endpoint (one for JSON, one for
files). The files are not transformed, they are sent as they are received by the North (compressed or not).


## Connection
To send data (JSON or files) to OIAnalytics, the following fields must be filled:
- **Host**: the hostname of the SaaS application (example: `https://myapp.mycompany.com`)
- **Values endpoint**: the endpoint that will receive JSON payloads [(see JSON payload section)](#json-payload)
- **File endpoint**: the endpoint that will receive files
- **Host**: the hostname of the SaaS application (example: `https://myapp.mycompany.com`)
- **Authentication type**: Basic, Bearer, Api key (custom)
- **Username** (for _Basic_): the username to connect to
- **Password** (for _Basic_): the password associated to the username
- **Token** (for _Bearer_): The token to use in the HTTP header
- **Key** (for _API key_): the name of the key field in the HTTP header
- **Secret** (for _API key_): the value associated to the key field in the HTTP header

## JSON payload
The target application must be able to manage the payload that OIConnect send. Here is a payload example:
````json
[
  {
    "timestamp": "2020-01-01T00:00:00.000Z",
    "data": "{ value: 28 }",
    "pointId": "MyPointId1"
  }
]
````

## Query param
A query param is added to the HTTP query. It is called _name_ and can be used to identify the source of the data.
Its value is in the form of _`<oibus-name>:<north-connector-name>`_.

Example of an HTTP query: `http://1.2.3.4:2223/engine/addValues?name=MyOIBus:MyOIConnect`


## Connecting two OIBus together
See [this doc](docs/guide/advanced/oibus-to-oibus.md) to learn more on how to connect one OIBus to another.
