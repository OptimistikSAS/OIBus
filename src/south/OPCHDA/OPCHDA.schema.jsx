import React from 'react'
import { notEmpty, inRange, minLength } from '../../services/validation.service.js'


const schema = { name: 'OPCHDA' }
schema.form = {
  agentFilename: {
    type: 'OIbText',
    newRow: true,
    md: 4,
    label: 'Agent Filename',
    valid: notEmpty(),
    defaultValue: '/HdaAgent/HdaAgent.exe',
    help: <div>Path to the HDA Agent</div>,
  },
  tcpPort: {
    type: 'OIbInteger',
    newRow: false,
    md: 4,
    label: 'TCP Port',
    valid: inRange(1, 65535),
    defaultValue: '2224',
    help: <div>TCP Port of the HDA Agent executable</div>,
  },
  logLevel: {
    type: 'OIbSelect',
    newRow: true,
    md: 4,
    label: 'Agent Logging Level',
    options: ['silly', 'debug', 'info', 'warning', 'error'],
    defaultValue: 'debug',
    help: <div>Logging Level</div>,
  },
  host: {
    type: 'OIbText',
    newRow: true,
    md: 4,
    label: 'Host',
    valid: minLength(2),
    defaultValue: '',
    help: <div>IP address or hostname of the HDA server</div>,
  },
  serverName: {
    type: 'OIbText',
    newRow: false,
    md: 4,
    label: 'Server Name',
    valid: notEmpty(),
    defaultValue: '1',
    help: <div>Name of the HDA server</div>,
  },
  retryInterval: {
    type: 'OIbInteger',
    newRow: false,
    md: 4,
    label: 'Retry interval',
    valid: (val) => (val > 0 ? null : 'Retry interval should be greater than 0'),
    defaultValue: 10000,
    help: <div>Retry Interval</div>,
  },
  scanGroups: {
    type: 'OIbTable',
    label: 'Scan Groups',
    help: (
      <p>
        OPCHDA application will request all points in the same scanMode. OPCHDA can query raw values but can also
        aggregate points on a given period. if an aggregate is chosen, the resampling period must also be selected.
        Important: a point with a scanMode without the corresponding scangroup will not be requested
      </p>
    ),
    newRow: true,
    md: 10,
    rows: {
      scanMode: { type: 'OIbScanMode', label: 'Scan Mode' },
      Aggregate: {
        type: 'OIbSelect',
        label: 'Aggregate',
        options: ['Raw', 'Average', 'Minimum', 'Maximum', 'Start', 'End'],
        defaultValue: 'Raw',
      },
      resampling: {
        type: 'OIbSelect',
        label: 'Resampling',
        options: ['None', 'Minute', 'Hour', 'Day'],
        defaultValue: 'None',
      },
    },
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
}

export default schema
