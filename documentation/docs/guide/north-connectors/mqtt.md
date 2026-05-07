# MQTT

The **MQTT North Connector** enables OIBus to **publish data to MQTT brokers**, allowing seamless integration with IoT platforms, message queues, and MQTT-compatible systems.

**Example Use Cases**

- **IoT Platform Integration**: Publish sensor data to cloud IoT platforms
- **Real-time Notifications**: Send alerts and events to subscribed systems
- **Edge Device Control**: Send commands to edge devices via MQTT topics

## Specific Settings

### Connection Configuration

| Setting                            | Description                                                                            | Example Value                    |
| ---------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------- |
| **URL**                            | URL of the MQTT broker.                                                                | `mqtt://broker.example.com:1883` |
| **QoS**                            | Quality of Service level: `0` (at most once), `1` (at least once), `2` (exactly once). | `0`, `1`, `2`                    |
| **Reject unauthorized connection** | Reject connections that cannot be authorized.                                          | Enabled/Disabled                 |
| **Reconnect period**               | Time interval between reconnection attempts (in milliseconds).                         | `5000`                           |
| **Connect timeout**                | Maximum time to wait for a connection (in milliseconds).                               | `30000`                          |
| **Persistent**                     | Enable for persistent sessions that survive broker restarts.                           | Enabled/Disabled                 |

### Authentication

| Setting            | Description                                                                      | Example Value                              |
| ------------------ | -------------------------------------------------------------------------------- | ------------------------------------------ |
| **Authentication** | Authentication method.                                                           | `None`, `Username/Password`, `Certificate` |
| **Username**       | Username for broker authentication. Required for Username/Password.              | `mqtt_user`                                |
| **Password**       | Password for broker authentication. Required for Username/Password.              | `••••••••`                                 |
| **Cert file path** | Path to the signed certificate file. Required for Certificate authentication.    | `/path/to/cert.pem`                        |
| **Key file path**  | Path to the private key file. Required for Certificate authentication.           | `/path/to/key.pem`                         |
| **CA file path**   | Path to the certificate authority file. Required for Certificate authentication. | `/path/to/ca.pem`                          |
