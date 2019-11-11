import React from 'react'
import { notEmpty, minValue } from '../../services/validation.service'

const schema = { name: 'CSV' }
schema.form = {
  messageSection: {
    type: 'OIbTitle',
    label: 'Message',
    children: <div>This protocol allows to send a alive signal on a given frequency to the chosen host</div>,
  },
  host: {
    type: 'OIbText',
    valid: notEmpty(),
    defaultValue: '',
  },
  id: {
    type: 'OIbText',
    newRow: false,
    md: 2,
    valid: notEmpty(),
    defaultValue: '',
    label: 'Message id',
  },
  frequency: {
    type: 'OIbInteger',
    newRow: false,
    md: 2,
    valid: minValue(1000),
    defaultValue: 10000,
  },
  authentication: { type: 'OIbAuthentication' },
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
