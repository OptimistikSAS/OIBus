import React from 'react'
import { notEmpty, minValue, optional } from '../../services/validation.service'

const schema = { name: 'OPCUA_DA' }
schema.form = {
  opcuaSettings: {
    type: 'OIbTitle',
    children: (
      <>
        <p>This protocol is in restricted release. Please contact Optimistik</p>
        <p>
          <b>Retry interval:</b>
          Retry interval before trying to connect again
        </p>
      </>
    ),
  },
  url: {
    type: 'OIbLink',
    protocols: ['http', 'opc.tcp'],
    defaultValue: 'opc.tcp://servername:port/endpoint',
    help: <div>The URL of OPC-UA server</div>,
    md: 6,
  },
  retryInterval: {
    type: 'OIbInteger',
    newRow: false,
    md: 2,
    valid: minValue(1000),
    defaultValue: 10000,
    help: <div>Retry Interval (ms)</div>,
  },
  username: {
    type: 'OIbText',
    newRow: true,
    md: 2,
    valid: optional(),
    defaultValue: '',
    help: <div>authorized user</div>,
  },
  password: {
    type: 'OIbPassword',
    newRow: false,
    md: 2,
    valid: optional(),
    defaultValue: '',
    help: <div>password</div>,
  },
}

schema.points = {
  pointId: {
    type: 'OIbText',
    valid: notEmpty(),
    defaultValue: '',
    help: (
      <div>The pointId for OPCUA represents the NodeId</div>
    ),
  },
  scanMode: { type: 'OIbScanMode', label: 'Scan Mode' },
}
schema.category = 'IoT'

export default schema
