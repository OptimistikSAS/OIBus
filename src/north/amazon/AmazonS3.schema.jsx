import React from 'react'
import { notEmpty } from '../../services/validation.service'

const schema = { name: 'CSV' }
schema.form = {
  bucket: {
    type: 'OIbText',
    valid: notEmpty(),
    defaultValue: '',
  },
  folder: {
    type: 'OIbText',
    newRow: false,
    valid: notEmpty(),
    defaultValue: '',
  },
  authentication: {
    type: 'OIbAuthentication',
    mode: 'accessKey',
  },
  networkSection: {
    type: 'OIbTitle',
    label: 'Network',
    children: (
      <>
        <p>Please specify here the proxy name to use</p>
        <p>(proxy names are defined in the Engine page)</p>
      </>
    ),
  },
  proxy: { type: 'OIbProxy' },
}

export default schema
