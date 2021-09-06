import React from 'react'
import MongoDB from './db-in.png'
import { notEmpty, hasLengthBetween } from '../../services/validation.service'

const schema = { name: 'MongoDB' }
schema.form = {
  InfluxdbParameters: {
    type: 'OIbTitle',
    children: (
      <>
        <p>MongoDB North application is in Beta Mode</p>
        <ul>
          <li>
            <b>Host and Port:</b>
            MongoDB host to connect. Make sure you specify right host and port number depending on MongoDB connection protocol
            you selected.
          </li>
          <li>
            <b>Username:</b>
            Username required by MongoDB server, if any. MongoDB allows to send username for authenticating and authorization of
            client.
          </li>
          <li>
            <b>Password:</b>
            Password required by MongoDB Server, if any. MongoDB allows to send password for authenticating and authorization of
            client.
          </li>
        </ul>
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
    help: <div>The host is only the mongoDB server (it not includes mongodb:// protocol)</div>,
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
  indexFields: {
    type: 'OIbText',
    defaultValue: '',
    valid: hasLengthBetween(0, 256),
    newRow: false,
    help: 'for example, site:%2$s,unit:%3$s,sensor:%4$s',
  },
  createCollection: {
    type: 'OIbCheckBox',
    label: 'Create collection when collection does not exist',
    defaultValue: false,
  },
  createCollectionIndex: {
    type: 'OIbCheckBox',
    label: 'Create collection index when collection is created',
    defaultValue: false,
  },
  addTimestampToIndex: {
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
schema.image = MongoDB

export default schema
