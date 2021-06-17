import React from 'react'
import { inRange, minValue, notEmpty } from '../../services/validation.service'

const schema = { name: 'RestApi' }
schema.form = {
  RestApiSettings: {
    type: 'OIbTitle',
    label: 'REST API',
    md: 12,
    children: (
      <>
        <p>
          TODO
        </p>
      </>
    ),
  },
  apiType: {
    type: 'OIbSelect',
    md: 2,
    options: ['octopus', 'custom'],
    label: 'Select your API',
    defaultValue: 'octopus',
    help: <div>API to implement</div>,
  },
  host: {
    type: 'OIbText',
    defaultValue: 'https://185.253.39.139',
    valid: notEmpty(),
    help: <div>IP address of the API server</div>,
  },
  port: {
    type: 'OIbInteger',
    newRow: false,
    md: 2,
    valid: inRange(0, 65535),
    defaultValue: 8443,
    help: <div>Port number of the API server</div>,
  },
  entity: {
    type: 'OIbText',
    md: 3,
    defaultValue: 'mac_148285',
    valid: notEmpty(),
    help: <div>Name of the entity to request</div>,
  },
  authentication: { type: 'OIbAuthentication' },
  connectionTimeout: {
    type: 'OIbInteger',
    label: 'Connection timeout (ms)',
    valid: minValue(0),
    defaultValue: 1000,
    md: 3,
  },
  requestTimeout: {
    type: 'OIbInteger',
    label: 'Request timeout (ms)',
    newRow: false,
    valid: minValue(0),
    defaultValue: 1000,
    md: 3,
  },
}
schema.points = {
  pointId: {
    type: 'OIbText',
    valid: notEmpty(),
    unique: true,
    defaultValue: '',
    help: (
      <ul>
        <li>
          Point Id should be unique.
        </li>
        <li>
          Ex.
          <b> point.# </b>
          covers
          <b> point.id</b>
        </li>
      </ul>
    ),
  },
  scanMode: {
    type: 'OIbScanMode',
    label: 'Scan Mode',
    valid: notEmpty(),
  },
}

export default schema
