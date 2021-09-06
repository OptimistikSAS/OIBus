import React from 'react'
import AmazonS3 from './db-in.png'
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
schema.image = AmazonS3

export default schema
