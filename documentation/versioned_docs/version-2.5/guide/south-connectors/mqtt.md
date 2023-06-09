---
sidebar_position: 8
---

# MQTT
MQTT (Message Queuing Telemetry Transport) is a real-time messaging protocol for exchanging data by topic with a 
_publish / subscribe_ approach. A topic is a point (or a set of points) representing a piece of data (or a set of data).

The MQTT protocol is made up of two main types of entities:
- The MQTT broker: collects and makes available the requested data. It plays the role of server.
- The MQTT client: it can publish data to a broker and subscribe topics to receive data from a broker. 
 
OIBus is a MQTT client and uses the [MQTT.js](https://github.com/mqttjs/MQTT.js) library.

## Connection settings
### Connection
To connect to a broker, the MQTT connector requires some information:
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
- **Persistence**: Both QoS1 and QoS2 allow persistent connections. A persistent connection allows the broker to keep a 
certain number of messages in memory (set on the broker) until the client reconnects in case of connection loss. 
Persistence is ignored for QoS 0.

### Network
Several options are available to better manage network failure or inactivity:
- **Keep alive interval**: time to send a keep alive signal to the broker (in ms)
- **Reconnect period**: in case of connection failure, time to wait before reconnecting (in ms)
- **Connect timeout**: time to wait before aborting connection (in ms) 

### Authentication
#### Basic
If only the username and password fields are filled, the MQTT connector will connect to the broker using username and 
password only. The username must be defined on the broker. 

#### Certificates
A certificate file can be used with `mqtts://` protocol to secure the communication:
- Cert file: signed file to authenticate OIBus from the broker. The certificate must be accepted by the broker.
- Key file: the key used to sign the certificate (cert file)
- CA file: the certificate authority used to generate the cert file. If empty, the cert file is considered as 
self-signed.

The broker also uses certificates. An option to **reject unauthorized connection** can be used to reject self-signed 
certificates or obsolete certificates from the broker.

#### None
If no username / password and no certificates are specified, an anonymous connection will be established (if authorized 
on the broker).

## Points and topics
### Address space
The MQTT connector retrieves values from specific topics. These can be added in the _Points section_ (in the upper right
corner). A topic is the address associated to a data in the broker space address.

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

### Subscriptions
When a MQTT client subscribes to a data item on the broker, the broker sends the new values as soon as they are 
available for each client subscribing to this data. The scan mode is therefore always **listen**. It is a subscription 
of the MQTT client, which waits for the broker to send him new values.

Once the value is retrieved, it is associated to the point ID (which can be different from the topic). Ths point ID
will then be used to the North connectors to which it will be sent.

When subscribing to a set of points as with `France/#`, then the list of topic retrieved will be:
- France:Paris/temperatureTank1
- France:Paris/temperatureTank2
- France:Chambery/temperatureTank1
- France:Chambery/temperatureTank2

## Payload and timestamp
The payload contained in the messages sent by the broker may differ from broker to broker. The OIBus MQTT client can 
adapt to this payload through the **MQTT payload** section:

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
- **Data array path**: _Ø_
- **Value path**: _value_
- **Point ID path**: _Ø_ (default is pointId)
- **Timestamp path**: _timestamp_
- **Quality path**: _quality_

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
- **Data array path**: _metrics_. Each element of the _metrics_ array will be parse with the following fields.
- **Value path**: _customValue_
- **Point ID path**: _customName_
- **Timestamp path**: _customTimestamp_
- **Quality path**: _customQuality_

Sometimes, the timestamp is not in the payload. In this case, the _OIBus_ option can be selected in the **timestamp 
origin** field. The resulting timestamp will be the one from the OIBus machine in UTC format.

When the timestamp is retrieved from the payload, it is parsed according to the specified **timestamp format**, and 
convert to UTC from the specified **timestamp timezone**. 
