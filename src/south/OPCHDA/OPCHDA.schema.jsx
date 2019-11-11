import React from 'react'
import { notEmpty, inRange, minLength } from '../../services/validation.service.js'


const schema = { name: 'OPCHDA' }
schema.form = {
  agentFilename: {
    type: 'OIbText',
    valid: notEmpty(),
    defaultValue: '/HdaAgent/HdaAgent.exe',
    help: <div>Path to the HDA Agent</div>,
  },
  tcpPort: {
    type: 'OIbInteger',
    newRow: false,
    label: 'TCP Port',
    valid: inRange(1, 65535),
    defaultValue: '2224',
    help: <div>TCP Port of the HDA Agent executable</div>,
  },
  logLevel: {
    type: 'OIbSelect',
    label: 'Agent Logging Level',
    options: ['silly', 'debug', 'info', 'warning', 'error'],
    defaultValue: 'debug',
    help: <div>Logging Level</div>,
  },
  host: {
    type: 'OIbText',
    valid: minLength(2),
    defaultValue: '',
    help: <div>IP address or hostname of the HDA server</div>,
  },
  serverName: {
    type: 'OIbText',
    newRow: false,
    valid: notEmpty(),
    defaultValue: '1',
    help: <div>Name of the HDA server</div>,
  },
  retryInterval: {
    type: 'OIbInteger',
    newRow: false,
    valid: (val) => (val > 0 ? null : 'Retry interval should be greater than 0'),
    defaultValue: 10000,
    help: <div>Retry Interval</div>,
  },
  scanGroupsSection: {
    type: 'OIbTitle',
    label: 'ScanGroups',
    md: 12,
    children: (
      <p>
        OPCHDA application will request all points in the same scanMode. OPCHDA can query raw values but can also
        aggregate points on a given period. if an aggregate is chosen, the resampling period must also be selected.
        Important: a point with a scanMode without the corresponding scangroup will not be requested
      </p>
    ),
  },
  scanGroups: {
    type: 'OIbTable',
    rows: {
      scanMode: { type: 'OIbScanMode', label: 'Scan Mode' },
      Aggregate: {
        type: 'OIbSelect',
        options: ['Raw', 'Average', 'Minimum', 'Maximum', 'Start', 'End'],
        defaultValue: 'Raw',
      },
      resampling: {
        type: 'OIbSelect',
        options: ['None', 'Minute', 'Hour', 'Day'],
        defaultValue: 'None',
      },
    },
  },
}

schema.points = {
  pointId: {
    type: 'OIbText',
    valid: (val) => (val && val.length > 0 ? null : 'Point Id should not be empty'),
    defaultValue: '',
  },
  scanMode: { type: 'OIbScanMode' },
}

export default schema
