import React from 'react'
import { notEmpty, inRange, minLength } from '../../services/validation.service.js'

const schema = { name: 'OPCUA' }
schema.form = {
  opcuaSettings: {
    type: 'OIbTitle',
    label: 'OPCUA Settings',
    children: <p>This protocol is in restricted release. Please contact Optimistik</p>,
  },
  host: {
    type: 'OIbText',
    label: 'Host',
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
    valid: notEmpty(),
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
    label: 'End point',
    valid: notEmpty(),
    defaultValue: '',
    help: <div>OPCUA end point</div>,
  },
  timeOrigin: {
    type: 'OIbSelect',
    options: ['server', 'oibus'],
    label: 'Time Origin',
    defaultValue: 'server',
  },
}

schema.points = {
  pointId: {
    type: 'OIbText',
    label: 'Point Id',
    valid: notEmpty,
    defaultValue: '',
  },
  scanMode: { type: 'OIbScanMode', label: 'Scan Mode' },
  ns: {
    type: 'OIbText',
    label: 'Point Id',
    valid: notEmpty,
    defaultValue: '',
  },
  s: {
    type: 'OIbText',
    label: 'Point Id',
    valid: notEmpty,
    defaultValue: '',
  },
}

export default schema
