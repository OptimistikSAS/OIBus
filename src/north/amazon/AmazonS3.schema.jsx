import React from 'react'
import { notEmpty, optional } from '../../services/validation.service'

const schema = { name: 'CSV' }
schema.form = {
  AmazonS3Settings: {
    type: 'OIbTitle',
    label: 'Amazon S3 settings',
    md: 12,
  },
  bucket: {
    type: 'OIbText',
    md: 4,
    valid: notEmpty(),
    defaultValue: '',
  },
  region: {
    type: 'OIbText',
    md: 4,
    newRow: false,
    valid: optional(),
    defaultValue: '',
  },
  folder: {
    type: 'OIbText',
    md: 4,
    newRow: false,
    valid: notEmpty(),
    defaultValue: '',
  },
  authentication: {
    type: 'OIbAuthentication',
    mode: 'API Key',
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
schema.category = 'FileIn'

export default schema
