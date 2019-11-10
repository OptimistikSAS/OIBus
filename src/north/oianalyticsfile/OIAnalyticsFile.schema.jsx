import React from 'react'
import { notEmpty } from '../../services/validation.service'

const schema = { name: 'OIAnalyticsFile' }
schema.form = {
  endPointSection: {
    type: 'OIbTitle',
    newRow: true,
    md: 12,
    label: 'End Point',
    help: <p>default endpoint for OIAnalytics is /api/optimistik/data/values/upload</p>,
  },
  host: {
    type: 'OIbText',
    newRow: true,
    md: 4,
    label: 'Host',
    valid: notEmpty(),
    defaultValue: '',
    help: <div>Path to the input folder</div>,
  },
  endpoint: {
    type: 'OIbText',
    newRow: true,
    md: 4,
    label: 'End Point',
    valid: notEmpty(),
    defaultValue: '',
    help: <div>End Point</div>,
  },
  authentication: {
    type: 'OIbAuthentication',
    newRow: true,
    md: 12,
    label: 'Authentication',
  },
  networkSection: {
    type: 'OIbTitle',
    newRow: true,
    md: 12,
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
    newRow: true,
    md: 4,
    label: 'Proxy',
  },
  stack: {
    type: 'OIbSelect',
    newRow: true,
    md: 4,
    label: 'stack',
    options: ['axios', 'request', 'fetch'],
    defaultValue: 'fetch',
    help: <div>Stack</div>,
  },
}
export default schema
