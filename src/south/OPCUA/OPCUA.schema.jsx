import React from 'react'
import { notEmpty, minValue, minLength } from '../../services/validation.service'

const schema = { name: 'OPCUA' }
schema.form = {
  opcuaSettings: {
    type: 'OIbTitle',
    children: <p>This protocol is in restricted release. Please contact Optimistik</p>,
  },
  url: {
    type: 'OIbText',
    valid: minLength(2),
    defaultValue: '',
    help: <div>IP address of the OPC-UA server</div>,
  },
  maxAge: {
    type: 'OIbInteger',
    valid: minValue(0),
    defaultValue: '',
    help: <div>IP address of the OPC-UA server</div>,
  },
  timeOrigin: {
    type: 'OIbSelect',
    options: ['server', 'source'],
    defaultValue: 'server',
  },
}

schema.points = {
  nodeId: {
    type: 'OIbText',
    valid: notEmpty(),
    defaultValue: '',
  },
  scanMode: { type: 'OIbScanMode', label: 'Scan Mode' },
}

export default schema
