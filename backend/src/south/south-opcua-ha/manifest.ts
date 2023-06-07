import { SouthConnectorManifest } from '../../../../shared/model/south-connector.model';

const manifest: SouthConnectorManifest = {
  id: 'opcua-ha',
  name: 'OPCUA HA',
  category: 'iot',
  description: 'Request data from OPCUA server on Historical Access (HA) mode',
  modes: {
    subscription: false,
    lastPoint: false,
    lastFile: false,
    history: true
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
      defaultValue: 10_000,
      newRow: true,
      validators: [{ key: 'required' }, { key: 'min', params: { min: 1000 } }, { key: 'max', params: { max: 3_600_000 } }],
      readDisplay: false
    },
    {
      key: 'retryInterval',
      type: 'OibNumber',
      label: 'Retry interval (ms)',
      defaultValue: 5_000,
      newRow: false,
      validators: [{ key: 'required' }, { key: 'min', params: { min: 100 } }, { key: 'max', params: { max: 3_600_000 } }],
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
      newRow: false,
      readDisplay: true
    },
    { key: 'authentication', type: 'OibAuthentication', label: 'Authentication', newRow: true, authTypes: ['none', 'basic', 'cert'] }
  ],
  items: {
    scanMode: {
      acceptSubscription: false,
      subscriptionOnly: false
    },
    settings: [
      {
        key: 'aggregate',
        type: 'OibSelect',
        label: 'Aggregate',
        options: ['Raw', 'Average', 'Minimum', 'Maximum', 'Count'],
        defaultValue: 'Raw',
        validators: [{ key: 'required' }],
        readDisplay: true
      },
      {
        key: 'resampling',
        type: 'OibSelect',
        label: 'Resampling',
        options: ['None', 'Second', '10 Seconds', '30 Seconds', 'Minute', 'Hour', 'Day'],
        defaultValue: 'None',
        readDisplay: true
      },
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
