---
sidebar_position: 4
---

# Modbus

Modbus is a communication protocol used for PLC networks. Historically, it was designed for communication on a serial 
interface (RS232, RS422,RS485) and was extended to support the TCP mode.

OIBus uses the [jsmodbus](https://github.com/Cloud-Automation/node-modbus) library **in TCP mode only**.

## Specific settings
- **Host**: IP address or hostname of the Modbus server machine.
- **Port**: 502 by default.
- **Slave ID**: Identify the Modbus source machine if necessary (1 by default).
- **Retry interval**: Time to wait between a reconnection upon a connection failure.
- **Address Offset**: For most of the PLCs, there is no offset (_Modbus_ option). Some PLCs start the address range at 1
  instead of 0 (_JBus_ option).
- **Endianness**: Indicates the type of bit encoding (Big Endian or LittleEndian).
- **Swap Bytes**: Indicates whether the bytes within a group of 16 bits (a word) should be inverted or not.
- **Swap Words**: Indicates whether the words (16-bit group) should be inverted or not within a 32-bit group.

## Item settings
- **Address**: the hexadecimal address of the data in the machine
- **Modbus type**: _coil_, _discrete input_, _input register_ or _holding register_ (default)
- **Data type**: Used in case of _holding registers_ or _input registers_ (ignored otherwise). This parameter indicates
the type of data retrieved from the register: UInt16 (default), Int16, UInt32, Int32, UInt64, Int64, Float or Double.
- **Multiplier Coefficient** (default 1)

### About the Modbus address
The address corresponds to the address of the variable in the PLC, **in hexadecimal without the data type digit**. For
example:
- For the _holding register_ data 0x40001, enter the address 0x0001 (omit the digit `4`) and specify the Modbus type
  _holdingRegister_.
- For the _coil_ data 0x009C, enter 0x009C and specify the Modbus type _coil_.

Modbus' data addresses follow the [**Modicon Convention Notation** (MCN)](https://www.modbus.org/docs/PI_MBUS_300.pdf):
- Coil: `[0x00001 - 0x09999]` ; from 1 to 39,321
- Discrete Input: `[0x10001 - 0x19999]` ; from 65,537 to 104,857
- Input Register: `[0x30001 - 0x39999]` ; from 196,609 to 235,929
- Holding Register: `[0x40001 - 0x49999]` ; from 262,145 to 301,465

An extended version of MCN allows the user to specify larger address spaces:
- Coil: `[0x000001 - 0x065535]`
- Discrete Input: `[0x100001 - 0x165535]`
- Input Register: `[0x300001 - 0x365535]`
- Holding Register: `[0x400001 - 0x465535]`



