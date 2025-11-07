# Modbus

Modbus is a communication protocol utilized in PLC networks. Originally developed for serial interfaces like RS232,
RS422, and RS485, it was later expanded to include TCP mode. OIBus uses
the [jsmodbus](https://github.com/Cloud-Automation/node-modbus) library **in TCP mode only**.

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

## Item Settings

| Setting                | Description                                                                                                                                                                  | Example Value      |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| Address                | Hexadecimal address of the data within the device (without the data type digit).                                                                                             | `0x0001`           |
| Modbus type            | Specifies whether it's a _coil_, _discrete input_, _input register_, or _holding register_ (default).                                                                        | `Holding Register` |
| Data type              | Relevant for _holding registers_ or _input registers_. Defines the type of data fetched from the register (Bit, UInt16, Int16, UInt32, Int32, UInt64, Int64, Float, Double). | `UInt16`           |
| Bit index              | (_Bit data type only_) The index of the bit to retrieve from the read value (0 to 15).                                                                                       | `0` to `15`        |
| Multiplier Coefficient | Multiplies the retrieved value (default is 1).                                                                                                                               | `1`                |

:::info About Modbus Addresses
The address should match the variable's address in the PLC, represented in hexadecimal without the data type digit.

**Examples:**

- For _holding register_ data at 0x40001, input the address as **0x0001** and specify the Modbus type as
  _holdingRegister_
- For _coil_ data at 0x009C, use **0x009C** as the address and specify the Modbus type as _coil_

**Address Ranges (Modicon Convention Notation):**
| Type | Standard Range | Extended Range |
|--------------------|-------------------------|------------------------|
| Coil | 0x00001 - 0x09999 | 0x000001 - 0x065535 |
| Discrete Input | 0x10001 - 0x19999 | 0x100001 - 0x165535 |
| Input Register | 0x30001 - 0x39999 | 0x300001 - 0x365535 |
| Holding Register | 0x40001 - 0x49999 | 0x400001 - 0x465535 |

For more details, see the [Modicon Convention Notation (MCN)](https://www.modbus.org/docs/PI_MBUS_300.pdf).
:::
