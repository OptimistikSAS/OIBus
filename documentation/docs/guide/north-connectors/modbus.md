# Modbus

The **Modbus North Connector** enables OIBus to **write data to Modbus-compatible devices**, allowing seamless integration with PLCs, RTUs, and other industrial equipment that supports the Modbus protocol.

**Example Use Cases**

- **Process Control**: Write setpoints and control values to PLCs
- **Configuration Management**: Update device parameters remotely
- **System Integration**: Bridge OIBus data with Modbus-compatible equipment

## Specific Settings

### Connection Configuration

| Setting            | Description                                                   |
| ------------------ | ------------------------------------------------------------- |
| **Host**           | IP address of the Modbus server/device (e.g., `127.0.0.1`)    |
| **Port**           | Port number for the Modbus connection (default: `502`)        |
| **Retry interval** | Delay between retries for failed operations (in milliseconds) |
| **Slave ID**       | Modbus slave device ID (typically `1` for master devices)     |
| **Address offset** | Address offset type (Modbus, JBus)                            |

### Data Format Options

| Setting        | Description                                                    |
| -------------- | -------------------------------------------------------------- |
| **Endianness** | Byte order for multi-byte values (Big endian or Little endian) |
| **Swap Bytes** | Enable to swap byte order in 16-bit registers                  |
| **Swap Words** | Enable to swap word order in 32-bit registers                  |
