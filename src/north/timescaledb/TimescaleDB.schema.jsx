import React from 'react'
import { notEmpty, hasLengthBetween } from '../../services/validation.service'

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
    valid: hasLengthBetween(0, 256),
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
