# OPC UA™

The **OPC UA™ North Connector** enables OIBus to **write data to OPC UA servers**, allowing seamless integration with
industrial systems, PLCs, and other OPC UA-compatible devices. Unlike
the [OPC UA South Connector](../south-connectors/opcua.mdx) which reads data from OPC UA servers, this North connector
**sends data** from OIBus to OPC UA servers.

**Example Use Cases**

- **Process Control**: Write setpoints to PLCs
- **Configuration Management**: Update device parameters from centralized systems

## Specific Settings

### Connection Configuration

| Setting                | Description                                                 |
| ---------------------- | ----------------------------------------------------------- |
| **Endpoint URL**       | URL of the OPC UA server (e.g., `opc.tcp://localhost:4840`) |
| **Keep session alive** | Keep session alive between messages                         |
| **Retry Interval**     | Delay between retries (in milliseconds)                     |

### Security Settings

| Setting             | Description                                                              |
| ------------------- | ------------------------------------------------------------------------ |
| **Security Mode**   | Security mode for the connection (None, Sign, SignAndEncrypt)            |
| **Security Policy** | Security policy for the connection (None, Basic128Rsa15, Basic256, etc.) |

### Authentication Methods

| Method                | Description                                | Required Parameters             |
| --------------------- | ------------------------------------------ | ------------------------------- |
| **Anonymous**         | Connect without authentication.            | None                            |
| **Username/Password** | Standard username/password authentication. | Username, Password              |
| **Certificate**       | Authentication using client certificates.  | Client Certificate, Private Key |
