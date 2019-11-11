import React from 'react'
import { notEmpty } from '../../services/validation.service'

const schema = { name: 'CSV' }
schema.form = {
  bucket: {
    type: 'OIbText',
    label: 'Host',
    valid: notEmpty(),
    defaultValue: '',
    help: <div>Path to the input folder</div>,
  },
  folder: {
    type: 'OIbText',
    label: 'Folder',
    valid: notEmpty(),
    defaultValue: '',
    help: <div>Path to the folder</div>,
  },
  authentication: {
    type: 'OIbAuthentication',
    mode: 'accessKey',
    label: 'Authentication',
  },
  networkSection: {
    type: 'OIbTitle',
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
    label: 'Proxy',
  },
}

export default schema
