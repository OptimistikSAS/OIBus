import React from 'react'
import { notEmpty } from '../../services/validation.service'

const schema = { name: 'TimescaleDB' }
schema.form = {
  InfluxDBSection: {
    type: 'OIbTitle',
    newRow: true,
    md: 12,
    label: 'TimeScale parameters',
    help: (
      <>
        <p>TimeScaleDB North application is in Beta Mode</p>
        <p>
          Please enter here required information to access the database.
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
}

export default schema
