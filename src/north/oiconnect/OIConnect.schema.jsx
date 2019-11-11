import React from 'react'
import { notEmpty } from '../../services/validation.service'

const schema = { name: 'OIConnect' }
schema.form = {
  endPointSection: {
    type: 'OIbTitle',
    label: 'End Point',
    help: <p>endpoint for OIBus</p>,
  },
  host: {
    type: 'OIbText',
    label: 'Host',
    valid: notEmpty(),
    defaultValue: '',
    help: <div>Name of the host</div>,
  },
  endpoint: {
    type: 'OIbText',
    label: 'End Point',
    valid: notEmpty(),
    defaultValue: '',
    help: <div>End Point</div>,
  },
  authentication: {
    type: 'OIbAuthentication',
    label: 'Authentication',
  },
  networkSection: {
    type: 'OIbTitle',
    label: 'Network',
    help: (
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
  proxy: {
    type: 'OIbProxy',
    label: 'Proxy',
  },
  stack: {
    type: 'OIbSelect',
    label: 'stack',
    options: ['axios', 'request', 'fetch'],
    defaultValue: 'fetch',
    help: <div>Stack</div>,
  },
}

export default schema
