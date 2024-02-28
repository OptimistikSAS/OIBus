---
sidebar_position: 4
---

# Modbus
Modbus is a communication protocol utilized in PLC networks. Originally, it was developed for serial interfaces like 
RS232, RS422, and RS485, and later expanded to include support for TCP mode. 

OIBus uses the [jsmodbus](https://github.com/Cloud-Automation/node-modbus) library **in TCP mode only**.

## Specific settings
Here are the Modbus connector settings:
- **Host**: IP address or hostname of the Modbus server machine.
- **Port**: The port to use for connection (502 by default).
- **Retry interval**: Time to wait between reconnections after a connection failure.
- **Slave ID**: Identifies the Modbus source machine, default is 1.
- **Address Offset**: For most PLCs, there is no offset (Modbus option). Some PLCs may start the address range at 1 instead of 0 (JBus option).
- **Endianness**: Specifies the type of bit encoding (Big Endian or Little Endian).
- **Swap Bytes**: Determines whether the bytes within a group of 16 bits (a word) should be inverted or not.
- **Swap Words**: Indicates whether the words (16-bit groups) should be inverted or not within a 32-bit group.

## Item settings
- **Address**: The hexadecimal address of the data within the device.
- **Modbus type**: Specifies whether it's a _coil_, _discrete input_, _input register_, or _holding register_ (default).
- **Data type**: Relevant for _holding registers_ or _input registers_. It defines the type of data fetched from the 
register, with options such as Bit, UInt16 (default), Int16, UInt32, Int32, UInt64, Int64, Float, or Double.
- **Bit index** (Bit data type only): The index of the bit to retrieve from the read value.
- **Multiplier Coefficient**: Multiplies the retrieved value (default is 1).

### About the Modbus address
The address should match the variable's address in the PLC, represented in hexadecimal without the data type digit. For 
instance:
- For _holding register_ data at 0x40001, input the address as **0x0001** (excluding the digit `4`) and specify the 
Modbus type as _holdingRegister_.
- For _coil_ data at 0x009C, use **0x009C** as the address and specify the Modbus type as _coil_.

Modbus data addresses are structured according to the [Modicon Convention Notation (MCN)](https://www.modbus.org/docs/PI_MBUS_300.pdf):
- Coil: `[0x00001 - 0x09999]` (1 to 39,321)
- Discrete Input: `[0x10001 - 0x19999]` (65,537 to 104,857)
- Input Register: `[0x30001 - 0x39999]` (196,609 to 235,929)
- Holding Register: `[0x40001 - 0x49999]` (262,145 to 301,465)

An extended version of MCN allows for larger address spaces:
- Coil: `[0x000001 - 0x065535]`
- Discrete Input: `[0x100001 - 0x165535]`
- Input Register: `[0x300001 - 0x365535]`
- Holding Register: `[0x400001 - 0x465535]`






