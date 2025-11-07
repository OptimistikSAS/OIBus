# MQTT

MQTT (Message Queuing Telemetry Transport) is a lightweight protocol designed for real-time messaging using a
publish/subscribe model. OIBus acts as an MQTT client using the [MQTT.js](https://github.com/mqttjs/MQTT.js) library to
interact with MQTT brokers.

## Specific Settings

### Connection

| Setting             | Description                                                                         | Example Value                    |
| ------------------- | ----------------------------------------------------------------------------------- | -------------------------------- |
| URL                 | Address of the MQTT broker (format: `mqtt://address:port`). Default port is `1883`. | `mqtt://broker.example.com:1883` |
| Reconnect period    | Time (in milliseconds) to wait before reconnection attempts                         | `5000`                           |
| Connect timeout     | Maximum time (in milliseconds) to wait for connection establishment                 | `30000`                          |
| Reject unauthorized | Reject connections with unverified certificates (e.g., self-signed)                 | Enabled/Disabled                 |

### Quality of Service

| QoS Level | Description                                              | Example Use Case                        |
| --------- | -------------------------------------------------------- | --------------------------------------- |
| 0         | At most once (no guarantee of delivery)                  | Sensor data with high frequency updates |
| 1         | At least once (guaranteed delivery, possible duplicates) | Important notifications                 |
| 2         | Exactly once (guaranteed single delivery)                | Critical commands                       |

:::info Persistence
QoS levels 1 and 2 support persistent connections, allowing the broker to retain messages for clients that reconnect after disconnection.
:::

### Authentication

#### No Authentication

| Setting | Description                               | Example Value |
| ------- | ----------------------------------------- | ------------- |
| (None)  | No authentication required for connection | -             |

#### Username / Password

| Setting  | Description                        | Example Value |
| -------- | ---------------------------------- | ------------- |
| Username | Username for broker authentication | `mqtt_user`   |
| Password | Password for broker authentication | `••••••••`    |

#### Certificate Authentication

| Setting        | Description                                                                | Example Value       |
| -------------- | -------------------------------------------------------------------------- | ------------------- |
| Cert file path | Path to the signed certificate file                                        | `/path/to/cert.pem` |
| Key file path  | Path to the private key file                                               | `/path/to/key.pem`  |
| CA file path   | Path to the certificate authority file. Leave empty for self-signed certs. | `/path/to/ca.pem`   |

### Data Throttling

| Setting                         | Description                                                                    | Example Value |
| ------------------------------- | ------------------------------------------------------------------------------ | ------------- |
| Number of messages before flush | Number of messages to accumulate before flushing to North caches               | `1000`        |
| Delay between flush             | Time delay (in milliseconds) between automatic flushes of accumulated messages | `1000`        |

## Item Settings

### Topic Subscription

MQTT uses a hierarchical topic structure with wildcard support:

| Wildcard | Description           | Example                 |
| -------- | --------------------- | ----------------------- |
| `#`      | Multi-level wildcard  | `sensors/#`             |
| `+`      | Single-level wildcard | `sensors/+/temperature` |

**Example Topic Structure:**

- root/
  - location1/
    - sensor1
    - sensor2
  - location2/
    - sensor1
    - sensor2

### Payload Configuration

#### Basic Settings

| Setting          | Description                                 | Example Value |
| ---------------- | ------------------------------------------- | ------------- |
| Payload in array | Whether payload contains an array of values | `false`       |
| Point ID origin  | Source of point ID (`payload` or `oibus`)   | `payload`     |
| Timestamp origin | Source of timestamp (`payload` or `oibus`)  | `payload`     |

#### Value Extraction

| Setting       | Description                                      | Example Value |
| ------------- | ------------------------------------------------ | ------------- |
| Value path    | JSON path to the value                           | `value`       |
| Point ID path | JSON path to point ID (required if from payload) | `pointId`     |
| Array path    | JSON path to array (if payload is array)         | `metrics`     |

#### Timestamp Configuration

| Setting          | Description                    | Example Value         |
| ---------------- | ------------------------------ | --------------------- |
| Timestamp path   | JSON path to timestamp         | `timestamp`           |
| Type             | Timestamp data type            | `ISO8601`             |
| Timezone         | Timezone for string timestamps | `UTC`                 |
| Timestamp format | Format for string timestamps   | `yyyy-MM-dd HH:mm:ss` |

### Payload Examples

#### Single Object

```json
{
  "pointId": "temperature1",
  "value": 23.5,
  "timestamp": "2023-01-01T12:00:00Z",
  "quality": "good"
}
```

#### Array of Objects

```json
{
  "readings": [
    {
      "id": "temp1",
      "value": 22.0,
      "time": "2023-01-01T12:00:00Z"
    }
  ]
}
```

#### Additional Fields

To add extra fields from payload:

| Setting           | Description                   | Example Value |
| ----------------- | ----------------------------- | ------------- |
| Output field name | Name for additional field     | `quality`     |
| Payload path      | JSON path to field in payload | `quality`     |
