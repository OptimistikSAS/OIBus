import React from 'react'
import { notEmpty, optional } from '../../service/validation.service.js'
import manifest from './manifest.js'

const schema = { ...manifest }
schema.form = {
  AmazonS3Settings: {
    type: 'OibTitle',
    label: 'Amazon S3 Settings',
    md: 12,
  },
  bucket: {
    type: 'OibText',
    label: 'Bucket',
    md: 4,
    valid: notEmpty(),
    defaultValue: '',
  },
  region: {
    type: 'OibText',
    label: 'Region',
    md: 4,
    newRow: false,
    valid: optional(),
    defaultValue: '',
  },
  folder: {
    type: 'OibText',
    label: 'Folder',
    md: 4,
    newRow: false,
    valid: notEmpty(),
    defaultValue: '',
  },
  authentication: {
    type: 'OibAuthentication',
    label: 'Authentication',
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
  proxy: { type: 'OibProxy', label: 'Proxy' },
}

export default schema
