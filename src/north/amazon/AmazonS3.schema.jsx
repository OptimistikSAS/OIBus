import React from 'react'
import { notEmpty } from '../../services/validation.service'

const schema = { name: 'CSV' }
schema.form = {
  bucket: {
    type: 'OIbText',
    newRow: true,
    md: 4,
    label: 'Host',
    valid: notEmpty(),
    defaultValue: '',
    help: <div>Path to the input folder</div>,
  },
  folder: {
    type: 'OIbText',
    newRow: true,
    md: 4,
    label: 'Folder',
    valid: notEmpty(),
    defaultValue: '',
    help: <div>Path to the folder</div>,
  },
  authentication: {
    type: 'OIbAuthentication',
    newRow: true,
    md: 12,
    mode: 'accessKey',
    label: 'Authentication',
  },
  networkSection: {
    type: 'OIbTitle',
    newRow: true,
    md: 12,
    label: 'Network',
    help: (
      <>
        <p>Please specify here the proxy name to use</p>
        <p>(proxy names are defined in the Engine page)</p>
      </>
    ),
  },
  proxy: {
    type: 'OIbProxy',
    newRow: true,
    md: 4,
    label: 'Proxy',
  },
}

export default schema
