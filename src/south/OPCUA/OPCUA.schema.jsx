import React from 'react'
import { notEmpty, inRange, minLength } from '../../services/validation.service'

const schema = { name: 'OPCUA' }
schema.form = {
  opcuaSettings: {
    type: 'OIbTitle',
    children: <p>This protocol is in restricted release. Please contact Optimistik</p>,
  },
  host: {
    type: 'OIbText',
    valid: minLength(2),
    defaultValue: '',
    help: <div>IP address of the OPC-UA server</div>,
  },
  opcuaPort: {
    type: 'OIbInteger',
    newRow: false,
    md: 2,
    label: 'HTTP Port',
    defaultValue: 8888,
    valid: inRange(0, 65535),
    help: <div>Port number of the OPCUA server</div>,
  },
  httpsPort: {
    type: 'OIbInteger',
    newRow: false,
    md: 2,
    label: 'HTTPS Port',
    defaultValue: 8889,
    help: <div>HTTPS port number</div>,
    valid: inRange(0, 65535),
  },
  endPoint: {
    type: 'OIbText',
    valid: notEmpty(),
    defaultValue: '',
    help: <div>OPCUA end point</div>,
  },
  timeOrigin: {
    type: 'OIbSelect',
    options: ['server', 'oibus'],
    defaultValue: 'server',
  },
}

schema.points = {
  pointId: {
    type: 'OIbText',
    valid: notEmpty(),
    defaultValue: '',
  },
  scanMode: { type: 'OIbScanMode', label: 'Scan Mode' },
  ns: {
    type: 'OIbText',
    valid: notEmpty(),
    defaultValue: '',
  },
  s: {
    type: 'OIbText',
    valid: notEmpty(),
    defaultValue: '',
  },
}

export default schema
