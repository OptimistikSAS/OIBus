import React from 'react'
import Modbus from './api.png'
import {
  inRange,
  isHost,
  notEmpty,
  isHexaOrDecimal,
  combinedValidations, minValue,
} from '../../services/validation.service'

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

        <p>The following settings apply to every points:</p>
        <ul>
          <li>
            addressOffset : Address offset to be applied for all points during requests
            (0 for the traditional Modbus protocol and 1 when using JBus)
          </li>
          <li>endianness : Endianness of the data to read</li>
          <li>Bytes swap : should reverse 16 bits data by group of 8 bits</li>
          <li>Words swap : should reverse 32 bits data by group of 16 bits</li>
          <li>
            multiplierCoefficient :
            Useful in case the value is stored as an integer while it is a decimal value, or to reverse the sign of the value
          </li>
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
  retryInterval: {
    type: 'OIbInteger',
    newRow: true,
    md: 2,
    valid: minValue(1000),
    defaultValue: 10000,
    help: <div>Retry Interval (ms)</div>,
  },
  addressOffset: {
    type: 'OIbSelect',
    md: 2,
    newRow: true,
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
    newRow: true,
    label: 'Swap Bytes ?',
    defaultValue: false,
    help: <div>Swap Bytes (8 bits) in groups of 16 bits?</div>,
  },
  swapWordsInDWords: {
    type: 'OIbCheckBox',
    md: 1,
    newRow: false,
    label: 'Swap Bytes ?',
    defaultValue: false,
    help: <div>Swap Bytes (16 bits) in groups of 32 bits?</div>,
  },
}

schema.points = {
  pointId: {
    type: 'OIbText',
    valid: notEmpty(),
    defaultValue: '',
    help: 'The id of the data. This id can then be used by another application where the data is sent by a north connector.',
  },
  address: {
    type: 'OIbText',
    defaultValue: '',
    valid: combinedValidations([isHexaOrDecimal(), notEmpty()]),
    help: 'The address must be in hexadecimal form, without the type number in front. '
      + 'For example, holdingRegister 400001 must be written 0x00001. '
      + 'The number "4" mst not be written since it will be infer from the modbus data typ field.',
  },
  modbusType: {
    type: 'OIbSelect',
    options: ['coil', 'discreteInput', 'inputRegister', 'holdingRegister'],
    label: 'Modbus type',
    defaultValue: 'holdingRegister',
    help: 'Modbus data type (Coil, DiscreteInput, InputRegister, HoldingRegister).',
  },
  dataType: {
    type: 'OIbSelect',
    options: ['UInt16', 'Int16', 'UInt32', 'Int32', 'UInt64', 'Int64', 'Float', 'Double'],
    label: 'Data type',
    defaultValue: 'Uint16',
    help: 'HoldingRegisters and inputRegisters can have one of the above types.'
      + 'Default type is UInt16. This field does not apply for coils and discreteInputs.',
  },
  multiplierCoefficient: {
    type: 'OIbText',
    label: 'Multiplier Coefficient',
    valid: combinedValidations([notEmpty(), inRange(-1000, 1000)]),
    defaultValue: 1,
    help: 'Multiply retrieved data by a coefficient\n'
      + 'Useful in case the value is stored as an integer while it is a decimal value, or to reverse the sign of the value.',
  },
  scanMode: {
    type: 'OIbScanMode',
    label: 'Scan Mode',
  },
}

schema.image = Modbus

export default schema
