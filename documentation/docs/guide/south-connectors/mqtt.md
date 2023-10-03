---
sidebar_position: 6
---

# MQTT
MQTT (Message Queuing Telemetry Transport) is a protocol designed for real-time messaging and data exchange using a 
publish/subscribe model. In MQTT, data is organized into topics, and clients can publish or subscribe to these topics to 
exchange information.

The MQTT protocol consists of two primary components:
- **MQTT Broker**: This acts as the server and is responsible for collecting and distributing data. It manages the topics 
and facilitates communication between clients.
- **MQTT Client**: Clients can publish data to a broker by specifying a topic, and they can also subscribe to topics to 
receive data from the broker.

OIBus functions as an MQTT client and utilizes the [MQTT.js](https://github.com/mqttjs/MQTT.js) library to interact with 
MQTT brokers for data exchange.

## Specific settings
MQTT is a versatile protocol for exchanging data, and OIBus provides various configuration options to tailor its behavior 
to your needs. Here are some of the key configuration parameters for MQTT connections in OIBus:
- **URL**: This specifies the address of the MQTT broker, typically in the format `mqtt://address:port`. The default MQTT 
port is 1883, but it may vary depending on the broker's configuration.
- **Quality of Service** (QoS): MQTT offers three levels of QoS for message delivery:
  - QoS 0: At most once. Messages are sent once, but there's no guarantee of successful receipt.
  - QoS 1: At least once. Messages are sent multiple times until the recipient acknowledges receipt. Some duplicates may 
occur.
  - QoS 2: Exactly once. Messages are sent only once, and retries are attempted until the recipient confirms successful 
receipt. No duplicates are expected.
- **Persistence**: QoS 1 and QoS 2 allow for persistent connections. This means that the broker can retain a certain number 
of messages in memory until the client reconnects, ensuring that no data is lost in case of connection interruptions.
- **Authentication**:
  - None: No authentication is required.
  - Basic: Authenticate using a username and password.
  - Certificate: Authenticate using certificates.
    - Cert file path: Path to the signed certificate file used to authenticate OIBus with the broker.
    - Key file path: Path to the key file used to sign the certificate.
    - CA file path: Path to the certificate authority file used to generate the certificate. If empty, the certificate is considered self-signed.
- **Reject unauthorized connection**: Decide whether to reject connections that cannot be verified, such as those with 
self-signed certificates from the broker.
- **Reconnect period**: The time to wait before attempting to reconnect the socket in case of a connection loss.
- **Connect timeout**: The maximum time to wait for a connection to be established before it is considered a failure.

These configuration options provide flexibility in setting up MQTT connections in OIBus to suit your specific requirements 
and security needs.

## Item settings
### Address space and topic
MQTT connectors in OIBus use a subscription-based approach, which means there's no need to set scan modes for these items. 
Instead, you specify the topics you want to subscribe to, and the MQTT connector retrieves data published to those topics 
by the broker.

Topics in MQTT are structured hierarchically, organized in a tree-like structure. Topics are used to address specific 
data points or information within the MQTT broker's address space.
```text title="Topic structure example"
France
    | -> Paris
        | -> temperatureTank1
        | -> temperatureTank2
    | -> Chambery
        | -> temperatureTank1
        | -> temperatureTank2
```

When you subscribe to a dataset in MQTT, you can use wildcard characters to specify the topics you're interested in. 
Here are some examples:
- Using # (hash) as a wildcard:
  - France/# will subscribe to all topics under the "France" branch, including all subtopics and their data points.
  - France/Chambery/# will subscribe to all topics under "France/Chambery," including all subtopics and data points specific to Chambery.
- Using specific topic paths:
  - France/Paris/temperatureTank1 will subscribe to only the data point "temperatureTank1" in the "France/Paris" branch.

## Payload and timestamp
### Data types
When you subscribe to an MQTT topic and receive a payload, the payload can contain various types of data, such as numbers, 
strings, or JSON objects. Depending on the type of data you receive, you may need to parse the payload to extract the 
information you want to store in OIBus North caches.

Here are some common scenarios for parsing MQTT payloads:
- **Number**: If the payload contains a single numeric value, you can parse it directly as a number and store it in 
North caches. For example, if you receive a payload like `25.5`, you can parse it as a floating-point number and store 
it as a numeric data point.
- **String**: If the payload is a string, you can store it as-is in North caches. For example, if you receive a payload 
like `Hello, MQTT!`, you can store it as a string data point.
- **JSON**: If the payload is a JSON object, you'll need to specify the payload format it to extract the relevant data 
fields. 

#### JSON object
Below is a JSON payload format example where data must be extracted.
```json title="JSON payload format example"
{
    "pointId": "point1",
    "value": "666.666",
    "timestamp": "2020-02-02 02:02:02",
    "quality": "true"
}
```

Then the following configuration must be applied:
- **Payload in array**: _false_
- **Point ID origin**: _payload_ (it will override the name of the item as reference)
- **Timestamp origin**: _payload_
- **Value path**: _value_
- **Point ID path**: _pointId_
- **Timestamp path**: _timestamp_
- **Type**: _String_
- **Timezone**: _UTC_ (if the broker is in UTC timezone)
- **Timestamp format**: _yyyy-MM-dd HH:mm:ss_

You can retrieve additional fields, such as the quality field, by clicking on the `+` button on the last section.
- **Field name in output**: _quality_
- **Path in the retrieved payload**: _quality_

#### JSON array
Below is another example with an array.
```json title="JSON payload with array format example"
{
  "metrics": [
    {
      "customValue": "666.666",
      "customTimestamp": "2020-02-02 02:02:02",
      "customQuality": "true"
    }
  ]
}
```

Then the following configuration must be applied:
- **Values in array**: _true_
- **Array path**: _metrics_
- **Point ID origin**: _oibus_ (the name of the item will be taken as point ID reference)
- **Timestamp origin**: _payload_
- **Value path**: _customValue_
- **Timestamp path**: _customTimestamp_
- **Type**: _String_
- **Timezone**: _UTC_ (if the broker is in UTC timezone)
- **Timestamp format**: _yyyy-MM-dd HH:mm:ss_

Here, the quality field can be added with:
- **Field name in output**: _quality_
- **Path in the retrieved payload**: _customQuality_


### Timestamp
You can either extract the timestamp from the payload or you can use the current UTC timestamp provided by OIBus. The
choice between these two approaches depends on how timestamps are provided by your MQTT source. OIBus allows you to
configure these options to suit your data source's requirements.

#### Current OIBus Timestamp
If the MQTT payload doesn't contain a timestamp or if you prefer to use the current timestamp from OIBus, you can 
configure OIBus to use the current UTC timestamp. In this case, OIBus will automatically generate a UTC timestamp when 
processing the MQTT payload, and you don't need to extract it from the payload.

#### Timestamp in Payload
Alternatively, if the MQTT payload contains a timestamp, specify the **Timestamp path** to retrieve it and specify its 
type (String, ISO8601, UNIX Epoch (s) or UNIX Epoch (ms)). String timestamp can be parsed with the specified**timezone**
and **timestamp format**.


