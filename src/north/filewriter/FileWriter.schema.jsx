import React from 'react'
import { notEmpty } from '../../services/validation.service'

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
  },
  suffixFileName: {
    type: 'OIbText',
    defaultValue: '',
    help: <div>A suffix for the filename</div>,
  },
}
export default schema
