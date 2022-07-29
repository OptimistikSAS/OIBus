const schema = {
  name: 'OPCUA_DA',
  category: 'IoT',
  supportListen: false,
  supportLastPoint: true,
  supportFiles: false,
  supportHistory: false,
  supportPoints: true,
}
schema.form = {
  opcuaNetworkSettings: {
    type: 'OIbTitle',
    children: `
      <p>
        <b>Retry interval:</b>
        Retry interval before trying to connect again
      </p>
    `,
  },
  url: {
    type: 'OIbLink',
    protocols: ['http', 'opc.tcp'],
    defaultValue: 'opc.tcp://servername:port/endpoint',
    help: 'The URL of the OPCUA server</div>',
    md: 6,
  },
  keepSessionAlive: {
    type: 'OIbCheckBox',
    md: 1,
    newRow: false,
    defaultValue: false,
  },
  retryInterval: {
    type: 'OIbInteger',
    md: 2,
    valid: 'minValue(1000)',
    defaultValue: 10000,
    help: 'Retry Interval (ms)</div>',
  },
  opcuaSecuritySettings: {
    type: 'OIbTitle',
    children: `
      <div>
      </div>
    `,
  },
  username: {
    type: 'OIbText',
    md: 2,
    valid: 'optional',
    defaultValue: '',
  },
  password: {
    type: 'OIbPassword',
    newRow: false,
    md: 2,
    valid: 'optional',
    defaultValue: '',
  },
  securityMode: {
    type: 'OIbSelect',
    newRow: false,
    md: 2,
    options: ['None', 'Sign', 'SignAndEncrypt'],
    defaultValue: 'None',
  },
  securityPolicy: {
    type: 'OIbSelect',
    newRow: false,
    md: 2,
    options: [
      'None',
      'Basic128',
      'Basic192',
      'Basic192Rsa15',
      'Basic256Rsa15',
      'Basic256Sha256',
      'Aes128_Sha256_RsaOaep',
      'PubSub_Aes128_CTR',
      'PubSub_Aes256_CTR',
    ],
    defaultValue: 'None',
  },
  certFile: {
    type: 'OIbText',
    label: 'Cert File',
    valid: 'optional',
    defaultValue: '',
    help: 'Client certificate (PEM format)</div>',
  },
  keyFile: {
    type: 'OIbText',
    label: 'Key File',
    newRow: false,
    valid: 'optional',
    defaultValue: '',
    help: 'OPCUA client private key (PEM format)</div>',
  },
}

schema.points = {
  pointId: {
    type: 'OIbText',
    valid: 'notEmpty',
    defaultValue: '',
    unique: true,
    help: `
      <div>The pointId to used to send the data</div>
    `,
  },
  nodeId: {
    type: 'OIbText',
    valid: 'notEmpty',
    defaultValue: '',
    unique: true,
    help: `
      <div>The nodeId referenced in the OPCUA server</div>
    `,
  },
  scanMode: { type: 'OIbScanMode', label: 'Scan Mode' },
}

module.exports = schema
