---
sidebar_position: 6
---

# Modbus

Modbus is a communication protocol used for PLC networks. Historically, it was designed for communication on a serial 
interface (RS232, RS422,RS485) and was extended to support the TCP mode.

OIBus uses the [jsmodbus](https://github.com/Cloud-Automation/node-modbus) library **in TCP mode only**.

## Connection settings
In this TCP mode, Modbus sets up a client-server connection: the server provides data referenced by addresses but
remains passive. It is the Modbus client that fetches the data values. The Modbus connector is a Modbus client. It is
therefore necessary to indicate to the connector:
- The **host** (IP address or hostname of the Modbus server machine)
- The **port** (502 by default)
- The **slave ID** to identify the Modbus source machine if necessary (1 by default).


## PLC settings
Depending on the PLC, several settings are possible on how to access the data. These settings are common to the whole
PLC. Here are the following parameters:
- **Address offset**: For most of the PLCs, there is no offset (_Modbus_ option). Some PLCs start the address range at 1 
instead of 0 (_JBus_ option).
- **Endianness**: Indicates the type of bit encoding (Big Endian or LittleEndian)
- **Swap Bytes**: Indicates whether the bytes within a group of 16 bits (a word) should be inverted or not
- **Swap Words**: Indicates whether the words (16-bit group) should be inverted or not within a 32-bit group.

## Points and Modbus addresses
The Modbus connector retrieves values from specific addresses. These can be added in the Points section (in the upper right
corner).

In this list, points can be added with:
- **Point ID**: the name of the data in the result (example: `My point variable`)
- **Address**: the address of the data in the machine
- **Modbus type**: _coil_, _discrete input_, _input register_ or _holding register_ (default)
- **Data type**: Used in case of _holding registers_ or _input registers_ (ignored otherwise). This parameter indicates
the type of data retrieved from the register: UInt16 (default), Int16, UInt32, Int32, UInt64, Int64, Float or Double.
- **Multiplier Coefficient** (default 1)
- **Scan mode**: the request frequency. To define more scan modes, see [Engine settings](docs/guide/engine/scan-modes.md).  

The address corresponds to the address of the variable in the PLC, **in hexadecimal without the data type digit**. For
example:
- For the _holding register_ data 0x40001, enter the address 0x0001 (omit the digit `4`) and specify the Modbus type
  _holdingRegister_.
- For the _coil_ data 0x009C, enter 0x009C and specify the Modbus type _coil_.

Modbus data addresses follow the [**Modicon Convention Notation** (MCN)](https://www.modbus.org/docs/PI_MBUS_300.pdf):
- Coil: `[0x00001 - 0x09999]` ; from 1 to 39,321
- Discrete Input: `[0x10001 - 0x19999]` ; from 65,537 to 104,857
- Input Register: `[0x30001 - 0x39999]` ; from 196,609 to 235,929
- Holding Register: `[0x40001 - 0x49999]` ; from 262,145 to 301,465

An extended version of MCN allows the user to specify larger address spaces:
- Coil: `[0x000001 - 0x065535]`
- Discrete Input: `[0x100001 - 0x165535]`
- Input Register: `[0x300001 - 0x365535]`
- Holding Register: `[0x400001 - 0x465535]`



