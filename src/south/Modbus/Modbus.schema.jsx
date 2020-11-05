import React from 'react'
import { inRange, notEmpty } from '../../services/validation.service'

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
        <p>
          When adding a new point, please be sure that your point address (which you can enter in decimal or hexadecimal) includes the Modicon
          Convention Notation.
        </p>
      </div>
    ),
  },
  host: {
    type: 'OIbIpAddress',
    defaultValue: '127.0.0.1',
    help: <div>IP address of the Modbus source</div>,
  },
  port: {
    type: 'OIbInteger',
    newRow: false,
    valid: inRange(1, 65535),
    defaultValue: 502,
    help: <div>Port number of the Modbus source</div>,
  },
}

schema.points = {
  pointId: {
    type: 'OIbText',
    valid: notEmpty(),
    defaultValue: '',
  },
  scanMode: { type: 'OIbScanMode' },
  address: {
    type: 'OIbText',
    defaultValue: '',
    valid: notEmpty(),
  },
  type: {
    type: 'OIbSelect',
    options: ['number', 'boolean'],
    defaultValue: 'number',
  },
}

export default schema
