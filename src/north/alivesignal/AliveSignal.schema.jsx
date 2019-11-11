import React from 'react'
import { notEmpty } from '../../services/validation.service'

const schema = { name: 'CSV' }
schema.form = {
  host: {
    type: 'OIbText',
    label: 'Host',
    valid: notEmpty(),
    defaultValue: '',
    help: <div>Path to the input folder</div>,
  },
  authentication: {
    type: 'OIbAuthentication',
    label: 'Authentication',
    help: <div>Path to the archive folder</div>,
  },
  messageSection: {
    type: 'OIbTitle',
    label: 'Message',
    help: <div>todo</div>,
  },
  id: {
    type: 'OIbText',
    label: 'Id',
    valid: notEmpty(),
    defaultValue: '',
    help: <div>Message id</div>,
  },
  frequency: {
    type: 'OIbInteger',
    label: 'Frequency',
    valid: (val) => (val >= 1000 ? null : 'Frequency should be greater or equal to 1000'),
    defaultValue: 10000,
    help: <div>Frequency</div>,
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
