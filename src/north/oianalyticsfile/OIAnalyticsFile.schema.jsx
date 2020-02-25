import React from 'react'
import { notEmpty, notEndsWith, startsWith, combinedValidations } from '../../services/validation.service'

const schema = { name: 'OIAnalyticsFile' }
schema.form = {
  OIAnalyticsFileSettings: {
    type: 'OIbTitle',
    label: 'OIAnalyticsFile settings',
    md: 12,
    children: (
      <>
        <p>
          OIAnalyticsFile sends the received file to OIAnalytics.
        </p>
      </>
    ),
  },
  endPointSection: {
    type: 'OIbTitle',
    label: 'End Point',
    help: <p>default endpoint for OIAnalytics is /api/optimistik/data/values/upload</p>,
  },
  host: {
    type: 'OIbText',
    valid: combinedValidations([notEmpty('Host'), notEndsWith('/', 'Host')]),
    defaultValue: '',
  },
  endpoint: {
    type: 'OIbText',
    label: 'End Point',
    valid: combinedValidations([notEmpty('End Point'), startsWith('/', 'End Point')]),
    defaultValue: '/api/optimistik/data/values/upload',
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
export default schema
