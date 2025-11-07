# Modbus

The **Modbus North Connector** enables OIBus to **write data to Modbus-compatible devices**, allowing seamless integration with PLCs, RTUs, and other industrial equipment that supports the Modbus protocol.

**Example Use Cases**

- **Process Control**: Write setpoints and control values to PLCs
- **Configuration Management**: Update device parameters remotely
- **System Integration**: Bridge OIBus data with Modbus-compatible equipment

## Specific Settings

### Connection Configuration

| Setting            | Description                                                                                                              | Example Value   |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------ | --------------- |
| **Host**           | IP address or hostname of the Modbus server machine.                                                                     | `192.168.1.100` |
| **Port**           | Port to use for connection (502 by default).                                                                             | `502`           |
| **Retry interval** | Time to wait (in ms) between reconnections after a connection failure.                                                   | `5000`          |
| **Slave ID**       | Identifies the Modbus source machine (default is 1).                                                                     | `1`             |
| **Address offset** | For most PLCs, there is no offset (Modbus option). Some PLCs may start the address range at 1 instead of 0 (JBus option) | `Modbus`        |

### Data Format Options

| Setting        | Description                                                                                  |                  |
| -------------- | -------------------------------------------------------------------------------------------- | ---------------- |
| **Endianness** | Specifies the type of bit encoding (Big Endian or Little Endian).                            | `Big Endian`     |
| **Swap Bytes** | Determines whether the bytes within a group of 16 bits (a word) should be inverted or not.   | Enabled/Disabled |
| **Swap Words** | Indicates whether the words (16-bit groups) should be inverted or not within a 32-bit group. | Enabled/Disabled |
