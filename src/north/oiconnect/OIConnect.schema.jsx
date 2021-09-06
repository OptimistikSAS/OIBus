import React from 'react'
import OIConnect from './oi.png'
import { notEmpty } from '../../services/validation.service'

const schema = { name: 'OIConnect' }
schema.form = {
  OIConnectSettings: {
    type: 'OIbTitle',
    label: 'OIConnect settings',
    md: 12,
    children: (
      <>
        <p>
          OIConnect sends values to an another OIBus or OIAnalytics instance. The target OIBus instance will handle the
          received data the same way as the data coming from its own South. It can be useful in situation when multiple
          OIBus installations are present on the same network but only one of them has access to the internet.
        </p>
        <p>Endpoint for OIBus is /engine/addValues</p>
        <p>Endpoint for OIAnalytics is /api/optimistik/oibus/data/time_values</p>
      </>
    ),
  },
  host: {
    type: 'OIbLink',
    defaultValue: '',
  },
  valuesEndpoint: {
    type: 'OIbText',
    label: 'Values endpoint',
    newRow: false,
    valid: notEmpty(),
    defaultValue: '/engine/addValues',
  },
  fileEndpoint: {
    type: 'OIbText',
    label: 'File endpoint',
    newRow: false,
    valid: notEmpty(),
    defaultValue: '/engine/addFile',
  },
  authentication: { type: 'OIbAuthentication' },
  networkSection: {
    type: 'OIbTitle',
    label: 'Network',
    children: (
      <>
        <div>Please specify here network specific parameters</div>
        <ul>
          <li>Proxy: proxy name to use (proxy parameters are defined in the Engine page)</li>
        </ul>
      </>
    ),
  },
  proxy: { type: 'OIbProxy' },
}
schema.image = OIConnect

export default schema
