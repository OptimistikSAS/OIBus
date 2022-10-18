import React from 'react'
import { notEmpty, hasLengthBetween } from '../../service/validation.service'

const schema = { name: 'FileWriter' }
schema.form = {
  OIConnectSettings: {
    type: 'OibTitle',
    label: 'OIFileWriter settings',
    md: 12,
    children: (
      <p>
        FileWriter just writes what is received from the South on the specified folder.
      </p>
    ),
  },
  outputFolder: {
    type: 'OibText',
    valid: notEmpty(),
    defaultValue: './output',
    help: <div>Path to the output folder</div>,
  },
  prefixFileName: {
    type: 'OibText',
    defaultValue: '',
    help: <div>A prefix for the filename</div>,
    valid: hasLengthBetween(0, 256),
  },
  suffixFileName: {
    type: 'OibText',
    defaultValue: '',
    help: <div>A suffix for the filename</div>,
    valid: hasLengthBetween(0, 256),
  },
}
schema.category = 'FileIn'
export default schema
