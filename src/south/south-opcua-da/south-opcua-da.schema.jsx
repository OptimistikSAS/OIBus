import React from 'react'
import { notEmpty, minValue, optional } from '../../service/validation.service.js'

const schema = { name: 'OPCUA_DA' }
schema.form = {
  opcuaNetworkSettings: {
    type: 'OibTitle',
    label: 'OPCUA Network Settings',
    children: (
      <p>
        <b>Retry interval:</b>
        Retry interval before trying to connect again
      </p>
    ),
  },
  url: {
    type: 'OibLink',
    label: 'URL',
    protocols: ['http', 'opc.tcp'],
    defaultValue: 'opc.tcp://servername:port/endpoint',
    help: <div>The URL of the OPCUA server</div>,
    md: 6,
  },
  keepSessionAlive: {
    type: 'OibCheckbox',
    label: 'Keep Session Alive',
    md: 1,
    newRow: false,
    defaultValue: false,
  },
  retryInterval: {
    type: 'OibInteger',
    label: 'Retry interval (ms)',
    md: 2,
    valid: minValue(1000),
    defaultValue: 10000,
  },
  opcuaSecuritySettings: {
    type: 'OibTitle',
    label: 'OPCUA Security Settings',
    children: (
      <>
      </>
    ),
  },
  username: {
    type: 'OibText',
    label: 'Username',
    md: 2,
    valid: optional(),
    defaultValue: '',
  },
  password: {
    type: 'OibPassword',
    label: 'Password',
    newRow: false,
    md: 2,
    valid: optional(),
    defaultValue: '',
  },
  securityMode: {
    type: 'OibSelect',
    label: 'Security Mode',
    newRow: false,
    md: 2,
    options: ['None', 'Sign', 'SignAndEncrypt'],
    defaultValue: 'None',
  },
  securityPolicy: {
    type: 'OibSelect',
    label: 'Security Policy',
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
    type: 'OibText',
    label: 'Cert File',
    valid: optional(),
    defaultValue: '',
    help: <div>Client certificate (PEM format)</div>,
  },
  keyFile: {
    type: 'OibText',
    label: 'Key File',
    newRow: false,
    valid: optional(),
    defaultValue: '',
    help: <div>OPCUA client private key (PEM format)</div>,
  },
}

schema.points = {
  pointId: {
    type: 'OibText',
    label: 'Point ID',
    valid: notEmpty(),
    defaultValue: '',
    unique: true,
    help: (
      <div>The pointId to used to send the data</div>
    ),
  },
  nodeId: {
    type: 'OibText',
    label: 'Node ID',
    valid: notEmpty(),
    defaultValue: '',
    unique: true,
    help: (
      <div>The nodeId referenced in the OPCUA server</div>
    ),
  },
  scanMode: { type: 'OibScanMode', label: 'Scan Mode' },
}
schema.category = 'IoT'

export default schema
