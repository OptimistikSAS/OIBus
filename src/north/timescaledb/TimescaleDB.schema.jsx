import React from 'react'
import { notEmpty } from '../../services/validation.service'

const schema = { name: 'TimescaleDB' }
schema.form = {
  InfluxDBSection: {
    type: 'OIbTitle',
    label: 'TimeScale parameters',
    children: (
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
    valid: notEmpty(),
    defaultValue: '',
  },
  password: {
    type: 'OIbPassword',
    newRow: false,
    valid: notEmpty(),
    defaultValue: '',
  },
  host: {
    type: 'OIbText',
    valid: notEmpty(),
    defaultValue: '',
  },
  db: {
    type: 'OIbText',
    newRow: false,
    label: 'Database',
    valid: notEmpty(),
    defaultValue: '',
  },
}

export default schema
