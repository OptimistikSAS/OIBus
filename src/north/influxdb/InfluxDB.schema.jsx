import React from 'react'
import influxDB from './db-in.png'
import { notEmpty, hasLengthBetween } from '../../services/validation.service'

const schema = { name: 'InfluxDB' }
schema.form = {
  InfluxdbParameters: {
    type: 'OIbTitle',
    children: (
      <>
        <p>InfluxDB North application is in Beta Mode</p>
        <p>
          Please enter here required information to access the database. The precision configuration setting determines
          how much timestamp precision is retained with points.
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
    type: 'OIbLink',
    protocols: ['http'],
    defaultValue: 'http://localhost:8086',
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
    options: ['ns', 'u', 'ms', 's', 'm', 'h'],
  },
  pointIdParameters: {
    type: 'OIbTitle',
    children: (
      <>
        <p>Regexp will be used to identify token in the pointId that will be used to build the InfluxDB query.</p>
        <ul>
          <li>
            {'(.*)\\/(.{2})(.)(.*)'}
            This example will split into 4 groups: MMMMM/SSNCCC...CC gives %1=MMMMM %2=SS %3=N %4=CCC...CC
          </li>
          <li>(.*) This example will split into 1 group: MMMMM/SSNCCC...CC gives %1=MMMMM/SSNCCC...CC</li>
        </ul>
      </>
    ),
  },
  regExp: {
    type: 'OIbText',
    valid: notEmpty(),
    defaultValue: '(.*)',
    help: 'for example (.*)\\/(.{2})(.)(.*) to split in 4 groups',
  },
  measurement: {
    type: 'OIbText',
    valid: notEmpty(),
    defaultValue: '%1$s',
  },
  tags: {
    type: 'OIbText',
    defaultValue: '',
    valid: hasLengthBetween(0, 256),
    newRow: false,
    help: 'for example, site=%2$s,unit=%3$s,sensor=%4$s',
  },
}
schema.image = influxDB

export default schema
