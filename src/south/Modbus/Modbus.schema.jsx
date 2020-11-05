import React from 'react'
import { inRange, notEmpty } from '../../services/validation.service'

const schema = { name: 'Modbus' }
schema.form = {
  ModbusSettings: {
    type: 'OIbTitle',
    children: (
      <p>This protocol is in restricted release. Please contact Optimistik</p>
    ),
  },
  host: {
    type: 'OIbIpAddress',
    defaultValue: '',
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
    options: ['boolean', 'number'],
    defaultValue: 'boolean',
  },
}

export default schema
