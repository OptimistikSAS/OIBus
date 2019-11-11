import React from 'react'
import { notEmpty } from '../../services/validation.service'

const schema = { name: 'InfluxDB' }
schema.form = {
  InfluxdbParameters: {
    type: 'OIbTitle',
    children: (
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
  precision: {
    type: 'OIbSelect',
    defaultValue: 's',
    options: ['ns', 'us', 'µs', 'ms', 's'],
  },
}

export default schema
