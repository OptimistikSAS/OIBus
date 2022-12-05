import React from 'react'
import { notEmpty, startsWith, combinedValidations } from '../../service/validation.service.js'
import userpass from './userpass.png'
import oiaApiKeyGen from './oia-api-key-gen.png'

const schema = { name: 'OIAnalytics' }
schema.form = {
  OIAnalyticsSettings: {
    type: 'OibTitle',
    label: 'OIAnalytics Settings',
    md: 12,
    children: (
      <>
        <p>
          OIAnalytics sends the received values/file to OIAnalytics.
        </p>
        <p>To fill the username and password:</p>
        <ul>
          <li>Connect to OIAnalytics using your account</li>
          <li>Go to Configuration -&gt; Users</li>
          <li>
            Click on the key icon for the user you want to create an API key to.
            The user must have API access. We suggest a dedicated user with API access only.
          </li>
          <li>
            Create an API key. It will generate an API key. It is the only time you can download and copy the password.
            Be sure to store it securely somewhere.
          </li>
          <img src={oiaApiKeyGen} alt="OIAnalytics KeyGen" style={{ width: '600px' }} />
          <li>
            If you downloaded the key and its password, the string contain the username (key) and the password like
            this:
            {' '}
            <i>username:password</i>
          </li>
          <img src={userpass} alt="user password" style={{ width: '300px' }} />
          <li>Fill the encoded user and password in OIBus</li>
        </ul>
      </>
    ),
  },
  host: {
    type: 'OibLink',
    label: 'Host',
    valid: combinedValidations([notEmpty('Host'), startsWith('http', 'Host')]),
    defaultValue: '',
    help: <p>Host for OIAnalytics is https://_account_.oianalytics.fr</p>,
  },
  authentication: { type: 'OibAuthentication', label: 'Authentication' },
  networkSection: {
    type: 'OibTitle',
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
  proxy: { type: 'OibProxy', label: 'Proxy' },
}
schema.category = 'Optimistik'

export default schema
