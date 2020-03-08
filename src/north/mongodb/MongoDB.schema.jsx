import React from 'react'
import { notEmpty, hasLengthBetween } from '../../services/validation.service'

const schema = { name: 'MongoDB' }
schema.form = {
  InfluxdbParameters: {
    type: 'OIbTitle',
    children: (
      <>
        <p>MongoDB North application is in Beta Mode</p>
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
  pointIdParameters: {
    type: 'OIbTitle',
    children: (
      <>
        <p>Regexp will be used to identify token in the pointId that will be used to build the MongoDB query.</p>
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
  collection: {
    type: 'OIbText',
    valid: notEmpty(),
    defaultValue: '%1$s',
  },
  indexfields: {
    type: 'OIbText',
    defaultValue: '',
    valid: hasLengthBetween(0, 256),
    newRow: false,
    help: 'for example, site:%2$s,unit:%3$s,sensor:%4$s',
  },
  createcollection: {
    type: 'OIbCheckBox',
    label: 'Create collection when collection does not exist',
    defaultValue: false,
  },
  createcollectionindex: {
    type: 'OIbCheckBox',
    label: 'Create collection index when collection is created',
    defaultValue: false,
  },
  addtimestamptoindex: {
    type: 'OIbCheckBox',
    label: 'Add timestamp field to index fields',
    defaultValue: false,
  },
  timeStampKey: {
    type: 'OIbText',
    valid: notEmpty(),
    newRow: false,
    defaultValue: 'timestamp',
    help: <div>field in engine data which contain timestamp value</div>,
  },
}

export default schema
