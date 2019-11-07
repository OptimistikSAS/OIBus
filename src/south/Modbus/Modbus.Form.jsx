import React from 'react'

const schema = { name: 'Modbus' }
schema.form = {
  ModbusSettings: {
    type: 'OIbTitle',
    title: 'Modbus settings',
    newRow: true,
    children: (
      <p>This protocol is in restricted release. Please contact Optimistik</p>
    ),
  },
  host: {
    type: 'OIbText',
    newRow: true,
    md: 4,
    label: 'Host',
    valid: (val) => ((val && val.length > 2) ? null : 'Length should be greater than 2'),
    defaultValue: '',
    help: <div>IP address of the Modbus source</div>,
  },
  port: {
    type: 'OIbInteger',
    newRow: false,
    md: 4,
    label: 'Port',
    valid: (val) => (val >= 1 && val <= 65535 ? null : 'Port should be between 1 and 65535'),
    defaultValue: 502,
    help: <div>Port number of the Modbus source</div>,
  },
}

schema.points = {
  pointId: {
    type: 'OIbText',
    label: 'Point Id',
    valid: (val) => (val && val.length > 0 ? null : 'Point Id should not be empty'),
    defaultValue: '',
  },
  scanMode: { type: 'OIbScanMode', label: 'Scan Mode' },
  address: {
    type: 'OIbText',
    label: 'Address',
    defaultValue: '',
    valid: (val) => ((val && val.length > 0) || val === 0 || val >= 1 ? null : 'Value should not be empty'),
  },
  type: {
    type: 'OIbSelect',
    label: 'Type',
    options: ['boolean', 'number'],
    defaultValue: 'boolean',
    valid: (val) => (['boolean', 'number'].includes(val) ? null : 'Unknown type'),
  },
}

export default schema
