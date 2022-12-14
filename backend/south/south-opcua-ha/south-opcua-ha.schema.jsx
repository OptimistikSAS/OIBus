import React from 'react'
import { notEmpty, minValue, optional } from '../../service/validation.service.js'
import validation from '../../frontend/south/form/south.validation.js'
import manifest from './manifest.js'

const schema = { ...manifest }
schema.form = {
  opcuaNetworkSettings: {
    type: 'OibTitle',
    label: 'OPCUA Network Settings',
    children: (
      <>
        <p>
          By default, when you restart, OPCUA-HA South will query from the last successful timestamp (for each scan group)
          so we dont loose values during the time the HDA was not active. if the cache is deleted (or on the first
          startup), the default start time will be the current time except if a key &apos;startTime&apos; (only
          accessible by editing manually the OIBus configuration time) indicates a different start time. This feature
          has been added to be allow recovering of values from the past when needed.
          Example: starTime: &quot;2020-01-15T23:59:00.000Z&quot;
          Please use the ISO format even if other format are supported.
        </p>
        <p>
          <b>URL:</b>
          The url of the OPCUA server, including the endpoint and the port. For example: opc.tcp://localhost:53530/OPCUA/SimulationServer.
          {' '}
          <br />
          Note that opc.https is not supported for now.
          Moreover, you may need to trust the OIBus client certificate at the first connection on the OPCUA server.
        </p>
        <p>
          <b>Retry interval:</b>
          Retry interval before trying to connect again
        </p>
        <p>
          <b>Max read interval:</b>
          Max read interval will divide a huge request (for example 1 year of data) into smaller
          requests (for example only one hour if maxReadInterval is 3600). It is useful when requesting from a startTime
          or when reconnecting to a server after a while.
        </p>
        <p>
          <b>Read interval delay:</b>
          A delay (in ms) used to wait between two read intervals. Useful when large amount of data are requested in
          several requests. The larger the data requested, the bigger the delay should be to avoid cache congestion.
        </p>
        <p>
          <b>Max return values:</b>
          Max return values is a parameter allowing to indicate the maximum number of values that can be
          returned in a single read request. A low value requires the server to split a single reply in multiple chunks
          creating more network traffic.
        </p>
        <p>
          <b>Read timeout:</b>
          This timeout in milliseconds is used in the Client side Communication Stack to set the timeout on a per-call base.
        </p>
      </>
    ),
  },
  url: {
    type: 'OibLink',
    label: 'URL',
    protocols: ['http', 'opc.tcp'],
    defaultValue: 'opc.tcp://servername:port/endpoint',
    help: <div>The URL of the OPCUA server</div>,
    md: 6,
  },
  keepSessionAlive: {
    type: 'OibCheckbox',
    label: 'Keep Session Alive',
    md: 1,
    newRow: false,
    defaultValue: false,
  },
  readTimeout: {
    type: 'OibInteger',
    label: 'Read timeout (ms)',
    newRow: true,
    md: 2,
    valid: minValue(0),
    defaultValue: 180000,
  },
  retryInterval: {
    type: 'OibInteger',
    newRow: false,
    label: 'Retry interval (ms)',
    md: 2,
    valid: minValue(1000),
    defaultValue: 10000,
  },
  maxReadInterval: {
    type: 'OibInteger',
    newRow: true,
    label: 'Max read interval (s)',
    md: 2,
    valid: minValue(60),
    defaultValue: 3600,
    help: <div>Split the time interval into smaller intervals of this duration (in s).</div>,
  },
  readIntervalDelay: {
    type: 'OibInteger',
    label: 'Read interval delay (ms)',
    newRow: false,
    md: 2,
    valid: minValue(0),
    defaultValue: 200,
    help: <div>Time to wait between the read interval iterations (ms)</div>,
  },
  maxReturnValues: {
    type: 'OibInteger',
    newRow: false,
    md: 2,
    valid: minValue(0),
    defaultValue: 1000,
    help: <div>Max number of values returned for one point during a read interval</div>,
  },
  opcuaSecuritySettings: {
    type: 'OibTitle',
    label: 'OPCUA Security Settings',
    children: (
      <>
      </>
    ),
  },
  username: {
    type: 'OibText',
    label: 'Username',
    md: 2,
    valid: optional(),
    defaultValue: '',
  },
  password: {
    type: 'OibPassword',
    label: 'Password',
    newRow: false,
    md: 2,
    valid: optional(),
    defaultValue: '',
  },
  securityMode: {
    type: 'OibSelect',
    label: 'Security Mode',
    newRow: false,
    md: 2,
    options: ['None', 'Sign', 'SignAndEncrypt'],
    defaultValue: 'None',
  },
  securityPolicy: {
    type: 'OibSelect',
    label: 'Security Policy',
    newRow: false,
    md: 2,
    options: [
      'None',
      'Basic128',
      'Basic192',
      'Basic256',
      'Basic128Rsa15',
      'Basic192Rsa15',
      'Basic256Rsa15',
      'Basic256Sha256',
      'Aes128_Sha256_RsaOaep',
      'PubSub_Aes128_CTR',
      'PubSub_Aes256_CTR',
    ],
    defaultValue: 'None',
  },
  certFile: {
    type: 'OibText',
    label: 'Cert File',
    valid: optional(),
    defaultValue: '',
    help: <div>Client certificate (PEM format)</div>,
  },
  keyFile: {
    type: 'OibText',
    label: 'Key File',
    newRow: false,
    valid: optional(),
    defaultValue: '',
    help: <div>OPCUA client private key (PEM format)</div>,
  },
  scanGroupsSection: {
    type: 'OibTitle',
    label: 'Scan Groups',
    md: 12,
    children: (
      <p>
        OPCUA HA application will request all points in the same scanMode. OPCUA HA can query raw values but can also
        aggregate points on a given period. If an aggregate is chosen, the resampling period must also be selected.
        Important: a point with a scanMode without the corresponding scangroup will not be requested.
        <br />
        <b>In the current version, aggregates are NOT supported for production mode. Please use &quot;Raw&quot;</b>
      </p>
    ),
  },
  scanGroups: {
    type: 'OibTable',
    rows: {
      scanMode: {
        type: 'OibScanMode',
        label: 'Scan Mode',
        valid: validation.scanMode.isSelectedOnce,
      },
      aggregate: {
        type: 'OibSelect',
        label: 'Aggregate',
        options: ['Raw', 'Average', 'Minimum', 'Maximum', 'Count'],
        defaultValue: 'Raw',
      },
      resampling: {
        type: 'OibSelect',
        label: 'Resampling',
        options: ['None', 'Second', '10 Seconds', '30 Seconds', 'Minute', 'Hour', 'Day'],
        defaultValue: 'None',
      },
    },
    md: 6,
  },
}
schema.points = {
  pointId: {
    type: 'OibText',
    label: 'Point ID',
    valid: notEmpty(),
    defaultValue: '',
    unique: true,
    help: <div>The pointId to used to send the data</div>,
  },
  nodeId: {
    type: 'OibText',
    label: 'Node ID',
    valid: notEmpty(),
    defaultValue: '',
    unique: true,
    help: <div>The nodeId referenced in the OPCUA server</div>,
  },
  scanMode: {
    type: 'OibScanMode',
    label: 'Scan Group',
    help: (
      <div>
        <ul>
          <li>Only scan modes set in scan groups are displayed</li>
          <li>A new scan group must be added to be able to select other scan modes</li>
        </ul>
      </div>
    ),
  },
}

export default schema
