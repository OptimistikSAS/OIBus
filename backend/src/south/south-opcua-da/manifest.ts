import { SouthConnectorManifest } from '../../../../shared/model/south-connector.model';

const manifest: SouthConnectorManifest = {
  name: 'OPCUA_DA',
  category: 'iot',
  description: 'OPCUA_DA description',
  modes: {
    subscription: false,
    lastPoint: true,
    lastFile: false,
    historyPoint: false,
    historyFile: false
  },
  settings: [
    {
      key: 'url',
      type: 'OibText',
      label: 'URL',
      defaultValue: 'opc.tcp://servername:port/endpoint',
      newRow: true,
      validators: [{ key: 'required' }, { key: 'pattern', params: { pattern: '^(http:\\/\\/|opc.tcp:\\/\\/).*' } }],
      readDisplay: true
    },
    {
      key: 'keepSessionAlive',
      type: 'OibCheckbox',
      label: 'Keep Session Alive',
      defaultValue: false,
      newRow: false,
      validators: [{ key: 'required' }],
      readDisplay: true
    },
    {
      key: 'readTimeout',
      type: 'OibNumber',
      label: 'Read timeout (ms)',
      defaultValue: 180_000,
      newRow: true,
      validators: [{ key: 'required' }, { key: 'min', params: { min: 100 } }, { key: 'max', params: { max: 3_600_000 } }],
      readDisplay: false
    },
    {
      key: 'retryInterval',
      type: 'OibNumber',
      label: 'Retry interval (ms)',
      defaultValue: 10_000,
      newRow: false,
      validators: [{ key: 'required' }, { key: 'min', params: { min: 100 } }, { key: 'max', params: { max: 3_600_000 } }],
      readDisplay: false
    },
    {
      key: 'username',
      type: 'OibText',
      label: 'Username',
      newRow: true,
      readDisplay: false
    },
    {
      key: 'password',
      type: 'OibSecret',
      label: 'Password',
      newRow: false,
      readDisplay: false
    },
    {
      key: 'securityMode',
      type: 'OibSelect',
      label: 'Security Mode',
      options: ['None', 'Sign', 'SignAndEncrypt'],
      defaultValue: 'None',
      validators: [{ key: 'required' }],
      newRow: true,
      readDisplay: true
    },
    {
      key: 'securityPolicy',
      type: 'OibSelect',
      label: 'Security Policy',
      options: [
        'None',
        'Basic128',
        'Basic192',
        'Basic256',
        'Basic128Rsa15',
        'Basic192Rsa15',
        'Basic256Rsa15',
        'Basic256Sha256',
        'Aes128_Sha256_RsaOaep',
        'PubSub_Aes128_CTR',
        'PubSub_Aes256_CTR'
      ],
      defaultValue: 'None',
      conditionalDisplay: { securityMode: ['Sign', 'SignAndEncrypt'] },
      validators: [{ key: 'required' }],
      newRow: false,
      readDisplay: true
    },
    {
      key: 'certFile',
      type: 'OibText',
      label: 'Cert File',
      defaultValue: '',
      newRow: true,
      readDisplay: false
    },
    {
      key: 'keyFile',
      type: 'OibText',
      label: 'Key File',
      defaultValue: '',
      newRow: false,
      readDisplay: false
    }
  ],
  items: {
    scanMode: {
      acceptSubscription: false,
      subscriptionOnly: false
    },
    settings: [
      {
        key: 'nodeId',
        type: 'OibText',
        label: 'Node ID',
        validators: [{ key: 'required' }],
        readDisplay: true
      }
    ]
  }
};
export default manifest;
