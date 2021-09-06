import React from 'react'
import FileWriter from './file-in.png'
import { notEmpty, hasLengthBetween } from '../../services/validation.service'

const schema = { name: 'FileWriter' }
schema.form = {
  OIConnectSettings: {
    type: 'OIbTitle',
    label: 'OIFileWriter settings',
    md: 12,
    children: (
      <>
        <p>
          FileWriter just writes what is received from the South on the specified folder.
        </p>
      </>
    ),
  },
  outputFolder: {
    type: 'OIbText',
    valid: notEmpty(),
    defaultValue: './output',
    help: <div>Path to the output folder</div>,
  },
  prefixFileName: {
    type: 'OIbText',
    defaultValue: '',
    help: <div>A prefix for the filename</div>,
    valid: hasLengthBetween(0, 256),
  },
  suffixFileName: {
    type: 'OIbText',
    defaultValue: '',
    help: <div>A suffix for the filename</div>,
    valid: hasLengthBetween(0, 256),
  },
}
schema.image = FileWriter
export default schema
