import React from 'react'
import { inRange, minValue, notEmpty, optional, startsWith } from '../../services/validation.service'

const schema = { name: 'RestApi' }
schema.form = {
  RestApiSettings: {
    type: 'OIbTitle',
    label: 'REST API',
    md: 12,
    children: (
      <p>
        TODO
      </p>
    ),
  },
  requestMethod: {
    type: 'OIbSelect',
    options: ['GET', 'POST', 'PUT', 'PATCH'],
    md: 2,
    defaultValue: 'GET',
  },
  host: {
    type: 'OIbText',
    newRow: false,
    md: 4,
    defaultValue: 'http://localhost',
    valid: notEmpty(),
    help: <div>IP address or host name of the API server</div>,
  },
  port: {
    type: 'OIbInteger',
    newRow: false,
    md: 2,
    valid: inRange(0, 65535),
    defaultValue: 8443,
    help: <div>Port number of the API server</div>,
  },
  endpoint: {
    type: 'OIbText',
    newRow: false,
    md: 4,
    valid: startsWith('/'),
    help: <div>Endpoint to request</div>,
  },
  scanGroupsSection: {
    type: 'OIbTitle',
    label: 'Query params and body',
    md: 12,
    children: (
      <p>
        You can add query params directly from the table, or enter a body in a json format.
      </p>
    ),
  },
  queryParams: {
    type: 'OIbTable',
    rows: {
      queryParamKey: {
        type: 'OIbText',
        label: 'Key',
        valid: notEmpty(),
        defaultValue: '',
      },
      queryParamValue: {
        type: 'OIbText',
        label: 'Value',
        valid: notEmpty(),
        defaultValue: '',
      },
    },
    md: 6,
  },
  body: {
    md: 6,
    newRow: false,
    type: 'OIbTextArea',
    contentType: 'json',
    defaultValue: '',
    valid: optional(),
  },
  authentication: { type: 'OIbAuthentication' },
  acceptSelfSigned: {
    type: 'OIbCheckBox',
    label: 'Accept rejected certificates ?',
    md: 2,
    defaultValue: false,
  },
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
  payloadParser: {
    type: 'OIbSelect',
    options: ['Raw', 'OIAnalytics time values', 'SLIMS'],
    md: 2,
    defaultValue: 'Raw',
  },
  convertToCsv: {
    type: 'OIbCheckBox',
    label: 'Convert payload into CSV ?',
    md: 2,
    defaultValue: true,
  },
  delimiter: {
    type: 'OIbText',
    defaultValue: ',',
    valid: notEmpty(),
    help: <div>Delimiter in the CSV file</div>,
    md: 1,
  },
  dateFormat: {
    newRow: false,
    type: 'OIbText',
    defaultValue: 'YYYY-MM-DD HH:mm:ss.SSS',
    valid: notEmpty(),
    help: <div>Date Format</div>,
    md: 2,
  },
  fileName: {
    type: 'OIbText',
    defaultValue: 'rast-api-results_@CurrentDate.csv',
    valid: notEmpty(),
    help: <div>The name of the CSV file containing the results</div>,
    md: 3,
  },
  timeColumn: {
    type: 'OIbText',
    md: 2,
    defaultValue: 'timestamp',
    valid: notEmpty(),
    help: <div>Time Column</div>,
  },
  timezone: {
    type: 'OIbTimezone',
    newRow: false,
    md: 2,
  },
  compression: {
    type: 'OIbCheckBox',
    label: 'Compress File?',
    md: 2,
    defaultValue: false,
  },
}

schema.category = 'IoT'

export default schema
