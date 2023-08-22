---
sidebar_position: 6
---

# MQTT
MQTT (Message Queuing Telemetry Transport) is a real-time messaging protocol for exchanging data by topic with a 
_publish / subscribe_ approach. A topic is a point (or a set of points) representing a piece of data (or a set of data).

The MQTT protocol is made up of two main types of entities:
- The MQTT broker: collects and makes available the requested data. It plays the role of server.
- The MQTT client: it can publish data to a broker and subscribe topics to receive data from a broker. 
 
OIBus is a MQTT client and uses the [MQTT.js](https://github.com/mqttjs/MQTT.js) library.

## Specific settings
### Connection
- **URL**: of the form `mqtt://address:1883`. The default MQTT port is 1883 but may differ depending on the broker’s 
configuration.
- **Quality of service (QoS)**: agreement between the sender of a message and the receiver of a message that defines the
guarantee of delivery for a specific message. Three modes are available:
  - QoS 0: at most once. This means that the message is sent once but MQTT does not guarantee that the message will be 
received correctly. Good reception will depend on the quality of the underlying network of MQTT.
  - QoS 1: at least once. This means that the message is sent multiple times as duplicates until the client validates 
the correct receipt of at least one of the duplicates. In some cases, the client may receive the same message more than
once.
  - QoS 2: exactly once. This means that the message is sent only once, and a new attempt to send the message takes 
place after a certain time until the client confirms the good reception. There is no risk of multiple receptions in this
case.
- **Persistence** (QoS1 and QoS2): Both QoS1 and QoS2 allow persistent connections. A persistent connection allows the 
broker to keep a certain number of messages in memory (set on the broker) until the client reconnects in case of 
connection loss.
- **Authentication**:
  - None: no authentication.
  - Username and password authentication.
  - Certificate based:
    - **Cert file path**: signed file to authenticate OIBus from the broker. The certificate must be accepted by the broker.
    - **Key file path**: the key used to sign the certificate
    - **CA file path**: the certificate authority used to generate the cert file. If empty, the cert file is considered as
      self-signed.
- **Reject unauthorized connection**: Reject connection that can not be verified (because of a self-signed certificate 
from the broker for example).
- **Reconnect period**: Time to wait before reconnection the socket on connection loss.
- **Connect timeout**: Time to wait before the connection fails.

## Item settings
### Address space and topic
MQTT uses subscription only. No scan mode can be set for these items.

The MQTT connector retrieves values from specific topics. A topic is the address associated to a data in the broker 
space address. 

The broker organizes the data by tree structures. Here is an example:
````
France
    | -> Paris
        | -> temperatureTank1
        | -> temperatureTank2
    | -> Chambery
        | -> temperatureTank1
        | -> temperatureTank2
````
It is then possible to subscribe to a dataset by entering a parent node, for example `France/#` or `France/Chambery/#`. 
It is also possible to directly enter a complete path, for example `France/Paris/temperatureTank1` to subscribe to only 
one data.

When a MQTT client subscribes to a data item on the broker, the broker sends the new values as soon as they are 
available for each client subscribing to this data.

Once the value is retrieved, it is associated to the point ID (which can be different from the topic). Ths point ID
will then be used to the North connectors to which it will be sent.

When subscribing to a set of points as with `France/#`, then the list of topic retrieved will be:
- France:Paris/temperatureTank1
- France:Paris/temperatureTank2
- France:Chambery/temperatureTank1
- France:Chambery/temperatureTank2

## Payload and timestamp
The MQTT payload can be of different type: number, string or json.

For the last case, it is possible to parse the payload to form the data that OIBus will store in North caches.

For example, if the payload is:
````
{
    "pointId": "point1",
    "value": "666.666",
    "timestamp": "2020-02-02 02:02:02",
    "quality": "true"
}
````

Then the following configuration must be applied:
- **Values in array**: _false_
- **Value path**: _value_
- **Timestamp origin**: _payload_
- **Timestamp path**: _timestamp_
- **Type**: _String_
- **Timezone**: _UTC_ (if the broker is in UTC timezone)
- **Timestamp format**: _yyyy-MM-dd HH:mm:ss_

Other fields can be added in the OIBus data object. Add them in the Additional fields section. Here, with the quality field:
- Field name in output: _quality_
- Path in the retrieved payload: _quality_

Another example, with a payload such as:
````
"metrics": [
    {
        "customName": "point1",
        "customValue": "666.666",
        "customTimestamp": "2020-02-02 02:02:02",
        "customQuality": "true"
    }
]
````

Then the following configuration must be applied:
- **Values in array**: _true_
- **Array path**: _metrics_
- **Value path**: _customValue_
- **Timestamp origin**: _payload_
- **Timestamp path**: _customTimestamp_
- **Type**: _String_
- **Timezone**: _UTC_ (if the broker is in UTC timezone)
- **Timestamp format**: _yyyy-MM-dd HH:mm:ss_

Here, the quality field can be added with:
- Field name in output: _quality_
- Path in the retrieved payload: _customQuality_


When the timestamp is retrieved from the payload, it is parsed according to the specified **timestamp format**, and
convert to UTC from the specified **timestamp timezone**.

Otherwise, it is possible to retrieve the timestamp from OIBus. The value will take the current timestamp in UTC format.

