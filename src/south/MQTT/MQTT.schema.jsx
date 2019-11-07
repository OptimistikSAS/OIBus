import React from 'react'

const schema = { name: 'MQTT' }
schema.form = {
  MQTTsettings: {
    type: 'OIbTitle',
    label: 'MQTT settings',
    newRow: true,
    children: (
      <div>
        <p>This protocol is in restricted release. Please contact Optimistik</p>
        <ul>
          <li>
            <b>Protocol:</b>
            Network protocol used by MQTT client to connect with MQTT broker. OIBus supports MQTT, and MQTTS.
          </li>
          <li>
            <b>Host and Port:</b>
            MQTT host to connect. Make sure you specify right host and port number depending on MQTT connection protocol
            you selected. MQTT client may not get connected if you mention wrong port number or interchange port
            numbers.
          </li>
          <li>
            <b>Username:</b>
            Username required by broker, if any. MQTT allows to send username for authenticating and authorization of
            client.
          </li>
          <li>
            <b>Password:</b>
            Password required by broker, if any. MQTT allows to send password for authenticating and authorization of
            client.
          </li>
        </ul>
      </div>
    ),
  },
  server: {
    type: 'OIbText',
    newRow: true,
    md: 4,
    label: 'Server',
    valid: (val) => ((val && val.length > 0) ? null : 'Server should not be empty'),
    defaultValue: '',
    help: <div>MQTT server address</div>,
  },
  port: {
    type: 'OIbText',
    newRow: false,
    md: 4,
    label: 'Port',
    valid: (val) => (val >= 1 && val <= 65535 ? null : 'Value should be between 1 and 65535'),
    defaultValue: 8883,
    help: <div>MQTT server port</div>,
  },
  mqttProtocol: {
    type: 'OIbSelect',
    options: ['mqtt', 'mqtts', 'tcp', 'tls', 'ws', 'wss'],
    newRow: true,
    md: 4,
    label: 'MQTT protocol',
    valid: (val) => (['mqtt', 'mqtts', 'tcp', 'tls', 'ws', 'wss'].includes(val) ? null : 'Unknown protocol'),
    defaultValue: 'mqtts',
    help: <div>MQTT protocol</div>,
  },
  username: {
    type: 'OIbText',
    newRow: true,
    md: 4,
    label: 'Username',
    valid: (val) => ((val && val.length > 0) ? null : 'Username should not be empty'),
    defaultValue: '',
    help: <div>authorized user</div>,
  },
  password: {
    type: 'OIbPassword',
    newRow: false,
    md: 4,
    label: 'Password',
    valid: (val) => ((val && val.length > 0) ? null : 'Password should not be empty'),
    defaultValue: '',
    help: <div>password</div>,
  },
}

schema.points = {
  pointId: {
    type: 'OIbText',
    label: 'Point Id',
    valid: (val) => (val && val.length > 0 ? null : 'Point Id should not be empty'),
    defaultValue: '',
  },
  scanMode: { type: 'OIbScanMode', label: 'Scan Mode' },
  topic: {
    type: 'OIbText',
    label: 'Topic',
    defaultValue: '',
    valid: (val) => ((val && val.length > 0) || val === 0 || val >= 1 ? null : 'Topic should not be empty'),
  },
}

export default schema
