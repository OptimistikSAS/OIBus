import React from 'react'
import { inRange, optional, notEmpty, minValue, isAdsNetId } from '../../services/validation.service'

const schema = { name: 'ADS' }
schema.form = {
  AdsSettings: {
    type: 'OIbTitle',
    children: (
      <div>
        <p>
          ADS is a protocol used with TwinCAT to communicate with Beckhoff PLCs.
          <br />
          The ADS protocol communicates with an AMS router which then transmits messages to the PLC with the correct
          protocol.
        </p>
        <p>
          When OIBus is installed on the same machine than the AMS router, only the Net Id and Port must be set.
          <br />
          The ADS protocol will look by default to localhost for AMS router and automatically set client ams net id and port.
        </p>
        <p>
          When OIBus is installed in a distant machine (physical or virtual), the address of the AMS router and its port must be set.
          By default, AMS router port is 48898.
        </p>
        <p>
          The client ams net id must be set beforehand.
          See the official
          {' '}
          <a href="https://optimistik.fr/oibus/" rel="noreferrer" target="_blank">OIBus</a>
          {' '}
          documentation for more information.
        </p>
      </div>
    ),
  },
  netId: {
    type: 'OIbText',
    defaultValue: '127.0.0.1.1.1',
    valid: isAdsNetId(),
    help: <div>The ADS net id of the PLC</div>,
  },
  port: {
    type: 'OIbInteger',
    newRow: false,
    valid: inRange(1, 65535),
    defaultValue: 851,
    help: <div>Port number of the ADS source</div>,
  },

  routerAddress: {
    type: 'OIbText',
    valid: optional(),
    help: <div>The IP address where the AMS router is</div>,
  },
  routerTcpPort: {
    type: 'OIbInteger',
    newRow: false,
    valid: optional(),
    defaultValue: '',
    help: <div>Port number of the AMS router</div>,
  },

  clientAmsNetId: {
    type: 'OIbText',
    valid: optional(),
    help: <div>The AMS net id set to this client from the AMS router settings</div>,
  },
  clientAdsPort: {
    type: 'OIbInteger',
    newRow: false,
    valid: optional(),
    defaultValue: '',
    help: <div>Port number that will be set for this client (must be unused on the server side)</div>,
  },

  retryInterval: {
    type: 'OIbInteger',
    newRow: true,
    md: 2,
    valid: minValue(1000),
    defaultValue: 10000,
    help: <div>Retry Interval (ms)</div>,
  },
}

schema.points = {
  pointId: {
    type: 'OIbText',
    valid: notEmpty(),
    defaultValue: '',
  },
  address: {
    type: 'OIbText',
    valid: notEmpty(),
    defaultValue: '',
  },
  scanMode: {
    type: 'OIbScanMode',
    label: 'Scan Mode',
  },
}

export default schema
