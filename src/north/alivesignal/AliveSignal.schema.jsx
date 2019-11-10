import React from 'react'
import { notEmpty } from '../../services/validation.service'

const schema = { name: 'CSV' }
schema.form = {
  host: {
    type: 'OIbText',
    newRow: true,
    md: 4,
    label: 'Host',
    valid: notEmpty(),
    defaultValue: '',
    help: <div>Path to the input folder</div>,
  },
  authentication: {
    type: 'OIbAuthentication',
    newRow: true,
    md: 12,
    label: 'Authentication',
    help: <div>Path to the archive folder</div>,
  },
  messageSection: {
    type: 'OIbTitle',
    newRow: true,
    md: 12,
    label: 'Message',
    help: <div>todo</div>,
  },
  id: {
    type: 'OIbText',
    newRow: true,
    md: 4,
    label: 'Id',
    valid: notEmpty(),
    defaultValue: '',
    help: <div>Message id</div>,
  },
  frequency: {
    type: 'OIbInteger',
    newRow: true,
    md: 4,
    label: 'Frequency',
    valid: (val) => (val >= 1000 ? null : 'Frequency should be greater or equal to 1000'),
    defaultValue: 10000,
    help: <div>Frequency</div>,
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
