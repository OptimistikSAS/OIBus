import React from 'react'
import { notEmpty, minValue, optional } from '../../services/validation.service'
import validation from '../../client/South/Form/South.validation'

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
          example: starTime: &quot;2020-01-15T23:59:00.000Z&quot;
          Please use the ISO format even if other format are supported.
        </p>
        <p>
          <b>Retry interval:</b>
          Retry interval before trying to connect again
        </p>
        <p>
          <b>Max read interval:</b>
          Max read interval will divide a huge request (for example 1 year of data) into smaller
          requests (for example only one hour if maxReadInterval is 3600).
        </p>
        <p>
          <b>Read interval delay:</b>
          A delay (in ms) used to wait between two read intervals. Useful when large amount of data are requested in
          several requests. The larger the data requested, the bigger the delay should be to avoid cache congestion.
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
  username: {
    type: 'OIbText',
    newRow: false,
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
  retryInterval: {
    type: 'OIbInteger',
    newRow: true,
    md: 2,
    valid: minValue(1000),
    defaultValue: 10000,
    help: <div>Retry Interval (ms)</div>,
  },
  maxReadInterval: {
    type: 'OIbInteger',
    newRow: false,
    md: 2,
    valid: minValue(60),
    defaultValue: 3600,
    help: <div>Max read interval (s)</div>,
  },
  readIntervalDelay: {
    type: 'OIbInteger',
    newRow: false,
    md: 2,
    valid: minValue(0),
    defaultValue: 200,
    help: <div>Time to wait between the read interval iterations (ms)</div>,
  },
  maxReturnValues: {
    type: 'OIbInteger',
    newRow: false,
    md: 2,
    valid: minValue(0),
    defaultValue: 1000,
    help: <div>Max return values</div>,
  },
  readTimeout: {
    type: 'OIbInteger',
    newRow: false,
    md: 2,
    valid: minValue(0),
    defaultValue: 180000,
    help: <div>Read timeout</div>,
  },
  scanGroupsSection: {
    type: 'OIbTitle',
    label: 'ScanGroups',
    md: 12,
    children: (
      <p>
        OPCUA application will request all points in the same scanMode. OPCUA can query raw values but can also
        aggregate points on a given period. if an aggregate is chosen, the resampling period must also be selected.
        Important: a point with a scanMode without the corresponding scangroup will not be requested
      </p>
    ),
  },
  scanGroups: {
    type: 'OIbTable',
    rows: {
      scanMode: {
        type: 'OIbScanMode',
        label: 'Scan Mode',
        valid: validation.scanMode.isSelectedOnce,
      },
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
    md: 6,
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
