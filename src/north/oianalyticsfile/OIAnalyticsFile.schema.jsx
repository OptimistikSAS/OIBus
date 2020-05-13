import React from 'react'
import { notEmpty, startsWith, combinedValidations } from '../../services/validation.service'
import screenshot from './screenshot.png'
import userpass from './userpass.png'

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
        <p>To fill the user and password :</p>
        <ul>
          <li>Connect to OIAnalytics using your account</li>
          <li>Go to &apos;User Management&apos;</li>
          <li>Select the user &apos;Api&apos;</li>
          <li>Click on the key icon in the top left corner</li>
          <img src={screenshot} alt="OIanalytics screenshot" style={{ width: '600px' }} />
          <li>This will download a text file containing an encoded string</li>
          <li>The string contain the user name and the password like this : username:password</li>
          <img src={userpass} alt="user password" style={{ width: '300px' }} />
          <li>Fill the encoded user and password in OIBus</li>
        </ul>
      </>
    ),
  },
  endPointSection: {
    type: 'OIbTitle',
    label: 'End Point',
    help: <p>default endpoint for OIAnalytics is /api/optimistik/data/values/upload</p>,
  },
  host: {
    type: 'OIbLink',
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
