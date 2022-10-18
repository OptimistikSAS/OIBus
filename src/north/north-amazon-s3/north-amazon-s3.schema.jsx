import React from 'react'
import { notEmpty, optional } from '../../service/validation.service'

const schema = { name: 'CSV' }
schema.form = {
  AmazonS3Settings: {
    type: 'OibTitle',
    label: 'Amazon S3 settings',
    md: 12,
  },
  bucket: {
    type: 'OibText',
    md: 4,
    valid: notEmpty(),
    defaultValue: '',
  },
  region: {
    type: 'OibText',
    md: 4,
    newRow: false,
    valid: optional(),
    defaultValue: '',
  },
  folder: {
    type: 'OibText',
    md: 4,
    newRow: false,
    valid: notEmpty(),
    defaultValue: '',
  },
  authentication: {
    type: 'OibAuthentication',
    mode: 'API Key',
  },
  networkSection: {
    type: 'OibTitle',
    label: 'Network',
    children: (
      <>
        <p>Please specify here the proxy name to use</p>
        <p>(proxy names are defined in the Engine page)</p>
      </>
    ),
  },
  proxy: { type: 'OibProxy' },
}
schema.category = 'FileIn'

export default schema
