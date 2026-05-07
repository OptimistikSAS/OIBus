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

| Setting                | Description                              | Example Value              |
| ---------------------- | ---------------------------------------- | -------------------------- |
| **Endpoint URL**       | URL of the OPC UA server.                | `opc.tcp://localhost:4840` |
| **Keep session alive** | Keep the session alive between messages. | Enabled/Disabled           |
| **Retry Interval**     | Delay between retries (in milliseconds). | `5000`                     |

### Security Settings

| Setting             | Description                                                       | Example Value                                       |
| ------------------- | ----------------------------------------------------------------- | --------------------------------------------------- |
| **Security Mode**   | Security mode for the connection.                                 | `None`, `Sign`, `Sign and encrypt`                  |
| **Security Policy** | Security policy for the connection. See note below for full list. | `None`, `Basic256-SHA256`, `AES128-SHA256-RSA-OAEP` |

:::note Security Policy values

| Value                  | Description                                                                                                                 |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| None                   | No security. Data is transmitted unencrypted with no message authentication.                                                |
| Basic128               | AES-128 encryption, HMAC-SHA1 signing, RSA-1024 key exchange.                                                               |
| Basic192               | AES-192 encryption, HMAC-SHA1 signing, RSA-1024 key exchange.                                                               |
| Basic256               | ⚠️ **Deprecated.** AES-256 encryption, HMAC-SHA1 signing. Avoid — SHA-1 is cryptographically weak.                          |
| Basic128-RSA15         | ⚠️ **Deprecated.** AES-128 encryption, HMAC-SHA1 signing, RSA PKCS#1 v1.5 padding. Avoid — both SHA-1 and RSA-1.5 are weak. |
| Basic192-RSA15         | AES-192 encryption, HMAC-SHA1 signing, RSA PKCS#1 v1.5 padding.                                                             |
| Basic256-RSA15         | AES-256 encryption, HMAC-SHA1 signing, RSA PKCS#1 v1.5 padding.                                                             |
| Basic256-SHA256        | AES-256 encryption, HMAC-SHA256 signing, RSA-OAEP padding. **Recommended** for most deployments.                            |
| AES128-SHA256-RSA-OAEP | AES-128 encryption, SHA-256 signing, RSA-OAEP padding. Modern standard (OPC UA Part 2 rev. 1.05).                           |
| PubSub AES-128-CTR     | AES-128-CTR symmetric encryption for OPC UA Pub/Sub mode.                                                                   |
| PubSub AES-256-CTR     | AES-256-CTR symmetric encryption for OPC UA Pub/Sub mode.                                                                   |

:::

### Authentication

| Setting            | Description                                                            | Example Value                              |
| ------------------ | ---------------------------------------------------------------------- | ------------------------------------------ |
| **Authentication** | Authentication method.                                                 | `None`, `Username/Password`, `Certificate` |
| **Username**       | Username for Username/Password authentication.                         | `opc_user`                                 |
| **Password**       | Password for Username/Password authentication.                         | `••••••••`                                 |
| **Cert file path** | Client certificate file path. Required for Certificate authentication. | `/path/to/cert.pem`                        |
| **Key file path**  | Private key file path. Required for Certificate authentication.        | `/path/to/key.pem`                         |
