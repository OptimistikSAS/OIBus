import React from 'react'
import { notEmpty, minValue, optional } from '../../services/validation.service'

const schema = { name: 'OPCUA_DA' }
schema.form = {
  opcuaNetworkSettings: {
    type: 'OIbTitle',
    children: (
      <p>
        <b>Retry interval:</b>
        Retry interval before trying to connect again
      </p>
    ),
  },
  url: {
    type: 'OIbLink',
    protocols: ['http', 'opc.tcp'],
    defaultValue: 'opc.tcp://servername:port/endpoint',
    help: <div>The URL of the OPCUA server</div>,
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
    valid: minValue(1000),
    defaultValue: 10000,
    help: <div>Retry Interval (ms)</div>,
  },
  opcuaSecuritySettings: {
    type: 'OIbTitle',
    children: (
      <>
      </>
    ),
  },
  username: {
    type: 'OIbText',
    md: 2,
    valid: optional(),
    defaultValue: '',
  },
  password: {
    type: 'OIbPassword',
    newRow: false,
    md: 2,
    valid: optional(),
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
    valid: optional(),
    defaultValue: '',
    help: <div>Client certificate (PEM format)</div>,
  },
  keyFile: {
    type: 'OIbText',
    label: 'Key File',
    newRow: false,
    valid: optional(),
    defaultValue: '',
    help: <div>OPCUA client private key (PEM format)</div>,
  },
}

schema.points = {
  nodeId: {
    type: 'OIbText',
    valid: notEmpty(),
    defaultValue: '',
  },
  scanMode: { type: 'OIbScanMode', label: 'Scan Mode' },
}
schema.category = 'IoT'

export default schema
