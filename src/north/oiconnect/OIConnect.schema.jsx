import React from 'react'
import { minValue, notEmpty } from '../../services/validation.service'

const schema = { name: 'OIConnect' }
schema.form = {
  endPointSection: {
    type: 'OIbTitle',
    label: 'End Point',
    children: <p>endpoint for OIBus</p>,
  },
  host: {
    type: 'OIbText',
    valid: notEmpty(),
    defaultValue: '',
  },
  endpoint: {
    type: 'OIbText',
    label: 'End Point',
    newRow: false,
    valid: notEmpty(),
    defaultValue: '',
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
          <li>
            Stack: OIBus can use several IP stacks to communicate with the host. In certain network configuration
            (firewall settings for example), it might be useful to try a different stack. We generally advise to
            leave &apos;fetch&apos; as it is the native nodej stack but we also use axios as it reports good
            messages to diagnostic network errors.
          </li>
        </ul>
      </>
    ),
  },
  proxy: { type: 'OIbProxy' },
  stack: {
    type: 'OIbSelect',
    newRow: false,
    md: 2,
    options: ['axios', 'request', 'fetch'],
    defaultValue: 'fetch',
  },
  timeout: {
    type: 'OIbInteger',
    newRow: false,
    md: 2,
    valid: minValue(1000),
    defaultValue: 60000,
  },
}

export default schema
