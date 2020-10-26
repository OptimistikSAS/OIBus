import React from 'react'
import { notEmpty, minValue } from '../../services/validation.service'

const schema = { name: 'OPCUA' }
schema.form = {
  opcuaSettings: {
    type: 'OIbTitle',
    children: (
      <>
        <p>This protocol is in restricted release. Please contact Optimistik</p>
        <p>
          By default, when you restart, OPCUA South will query from the last succesful timestamp (for each scan group)
          so we dont loose values during the time the HDA was not active. if the cache is deleted (or on the first
          startup), the default start time will be the current time except if a key &apos;startTime&apos; (only
          accessible by editing manually the oibus configuration time) indicates a different start time. This feature
          has been added to be allow recovering of values from the past when needed.
        </p>
      </>
    ),
  },
  url: {
    type: 'OIbLink',
    protocols: ['http', 'opc.tcp'],
    defaultValue: 'opc.tcp://servername:port/endpoint',
    help: <div>The URL of OPC-UA server</div>,
  },
  retryInterval: {
    type: 'OIbInteger',
    newRow: true,
    md: 2,
    valid: minValue(1000),
    defaultValue: 10000,
    help: <div>Retry Interval (ms)</div>,
  },
  maxReturnValues: {
    type: 'OIbInteger',
    newRow: false,
    md: 2,
    valid: minValue(0),
    defaultValue: 0,
    help: <div>Max return values</div>,
  },
  maxReadInterval: {
    type: 'OIbInteger',
    newRow: false,
    md: 2,
    valid: minValue(60),
    defaultValue: 3600,
    help: <div>Max read interval (s)</div>,
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
      scanMode: { type: 'OIbScanMode', label: 'Scan Mode', scanGroup: true },
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
  nodeId: {
    type: 'OIbText',
    valid: notEmpty(),
    defaultValue: '',
  },
  scanMode: { type: 'OIbScanMode', label: 'Scan Mode' },
}

export default schema
