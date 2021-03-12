import React from 'react'
import { inRange, isHost, notEmpty, isHexaOrDecimal, combinedValidations } from '../../services/validation.service'

const schema = { name: 'Modbus' }
schema.form = {
  ModbusSettings: {
    type: 'OIbTitle',
    children: (
      <div>
        <p>The Modbus address scheme follows the Modicon Convention Notation.</p>
        <ul>
          <li>Coil = [0x00001 - 0x09999 (=39321)]</li>
          <li>Discrete Input = [0x10001 (=65537) - 0x19999 (=104857)]</li>
          <li>Input Register = [0x30001 (=196609) - 0x39999 (=235929)]</li>
          <li>Holding Register = [0x40001 (=262145) - 0x49999 (=301465)]</li>
        </ul>
        <p>An extended version of the Modicon Convention Notation allow the user to specify bigger address spaces :</p>
        <ul>
          <li>Coil = [0x000001 - 0x065535]</li>
          <li>Discrete Input = [0x100001 - 0x165535]</li>
          <li>Input Register = [0x300001 - 0x365535]</li>
          <li>Holding Register = [0x400001 - 0x465535]</li>
        </ul>
        <p>
          When adding a new point, please be sure that your point address (which you can enter in decimal or hexadecimal) includes the Modicon
          Convention Notation. For example:
        </p>

        <ul>
          <li>Holding Register 16001 (0x3E81), enter 403E81 for an extended Modicon Notation or enter 43E81 for a standard Modicon Notation.</li>
          <li>Coil 156 (0x9C), enter 0x00009C for an extended Modicon Notation or enter 0x9C or 0x0009C for a standard Modicon Notation</li>
        </ul>

        <p>For each point you can specify extra configuration :</p>
        <ul>
          <li>
            addressOffset : Address offset to be applied for all points during requests
            (0 for the traditionnal Modbus protocol and 1 when using JBus)
          </li>
          <li>modbusType : Modbus data type (Coil, DiscreteInput, InputRegister, HoldingRegister)</li>
          <li>
            dataType : HoldingRegisters and inputRegisters can have one of the above types.
            Default type is UInt16. This field does not apply for coils and discreteInputs.
          </li>
          <li>endianness : Endianness of the data to read</li>
        </ul>
      </div>
    ),
  },
  host: {
    type: 'OIbText',
    defaultValue: '127.0.0.1',
    valid: isHost(),
    help: <div>IP address of the Modbus source</div>,
  },
  port: {
    type: 'OIbInteger',
    newRow: false,
    valid: inRange(1, 65535),
    defaultValue: 502,
    help: <div>Port number of the Modbus source</div>,
  },
  slaveId: {
    type: 'OIbInteger',
    newRow: false,
    valid: inRange(1, 255),
    defaultValue: 1,
    help: <div>Slave ID of the Modbus source</div>,
  },
  addressOffset: {
    type: 'OIbSelect',
    md: 2,
    newRow: false,
    options: ['Modbus', 'JBus'],
    label: 'Address Offset',
    defaultValue: 'Modbus',
  },
  endianness: {
    type: 'OIbSelect',
    md: 2,
    newRow: false,
    options: ['Big Endian', 'Little Endian'],
    label: 'Endianness',
    defaultValue: 'Big Endian',
  },
  swapBytesinWords: {
    type: 'OIbCheckBox',
    md: 1,
    newRow: false,
    label: 'Swap Bytes (8 bits) in groups of 16 bits ?',
    defaultValue: false,
  },
  swapWordsInDWords: {
    type: 'OIbCheckBox',
    md: 1,
    newRow: false,
    label: 'Swap Words (16 bits) in groups of 32 bits ?',
    defaultValue: false,
  },
}

schema.points = {
  pointId: {
    type: 'OIbText',
    valid: notEmpty(),
    defaultValue: '',
  },
  address: {
    type: 'OIbText',
    defaultValue: '',
    valid: combinedValidations([isHexaOrDecimal(), notEmpty()]),
  },
  modbusType: {
    type: 'OIbSelect',
    options: ['coil', 'discreteInput', 'inputRegister', 'holdingRegister'],
    label: 'Modbus type',
    defaultValue: 'holdingRegister',
  },
  dataType: {
    type: 'OIbSelect',
    options: ['UInt16', 'Int16', 'UInt32', 'Int32', 'UInt64', 'Int64', 'Float', 'Double'],
    label: 'Data type',
    defaultValue: 'Uint16',
  },
  scanMode: {
    type: 'OIbScanMode',
    label: 'Scan Mode',
  },
}

export default schema
