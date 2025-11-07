# MQTT

The **MQTT North Connector** enables OIBus to **publish data to MQTT brokers**, allowing seamless integration with IoT platforms, message queues, and MQTT-compatible systems.

**Example Use Cases**

- **IoT Platform Integration**: Publish sensor data to cloud IoT platforms
- **Real-time Notifications**: Send alerts and events to subscribed systems
- **Edge Device Control**: Send commands to edge devices via MQTT topics

## Specific Settings

### Connection Configuration

| Setting                            | Description                                                                                   |
| ---------------------------------- | --------------------------------------------------------------------------------------------- |
| **URL**                            | URL of the MQTT broker (e.g., `mqtt://broker.example.com` or `ssl://broker.example.com:8883`) |
| **QoS**                            | Quality of Service level for message delivery (0, 1, or 2)                                    |
| **Reject unauthorized connection** | Reject connections that cannot be authorized                                                  |
| **Reconnect period**               | Time interval between reconnection attempts (in milliseconds)                                 |
| **Connect timeout**                | Maximum time to wait for a connection (in milliseconds)                                       |
| **Persistent**                     | Enable for persistent sessions that survive broker restarts (toggle option)                   |

:::tip QoS (Quality of Service)

- **QoS 0**: Fire and forget (no acknowledgment)
- **QoS 1**: Acknowledged delivery (at least once)
- **QoS 2**: Assured delivery (exactly once)
  :::

### Authentication Methods

| Method                | Description                                        | Required Parameters                         |
| --------------------- | -------------------------------------------------- | ------------------------------------------- |
| **None**              | No authentication (not recommended for production) | None                                        |
| **Username/Password** | Standard username/password authentication          | Username, Password                          |
| **Certificate**       | Certificate-based authentication (most secure)     | Cert file path, Key file path, CA file path |
