import React from 'react'
import { notEmpty } from '../../services/validation.service'

const schema = { name: 'InfluxDB' }
schema.form = {
  InfluxDBSection: {
    type: 'OIbTitle',
    newRow: true,
    md: 12,
    label: 'InfluxDB parameters',
    help: (
      <>
        <p>InfluxDB North application is in Beta Mode</p>
        <p>
          Please enter here required information to access the database.
          The precision configuration setting determines how much timestamp precision
          is retained with points.
        </p>
      </>
    ),
  },
  user: {
    type: 'OIbText',
    newRow: true,
    md: 4,
    label: 'User Name',
    valid: notEmpty(),
    defaultValue: '',
    help: <div>User Name</div>,
  },
  password: {
    type: 'OIbPassword',
    newRow: false,
    md: 4,
    label: 'Password',
    valid: notEmpty(),
    defaultValue: '',
    help: <div>Password</div>,
  },
  host: {
    type: 'OIbText',
    newRow: true,
    md: 4,
    label: 'Host',
    valid: notEmpty(),
    defaultValue: '',
    help: <div>Host</div>,
  },
  db: {
    type: 'OIbText',
    newRow: false,
    md: 4,
    label: 'Database',
    valid: notEmpty(),
    defaultValue: '',
    help: <div>Database</div>,
  },
  precision: {
    type: 'OIbSelect',
    newRow: true,
    md: 4,
    label: 'Precision',
    defaultValue: 's',
    options: ['ns', 'us', 'µs', 'ms', 's'],
    help: <div>Frequency</div>,
  },
}

export default schema
