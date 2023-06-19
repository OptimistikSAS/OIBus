import { SouthConnectorManifest } from '../../../../shared/model/south-connector.model';

const manifest: SouthConnectorManifest = {
  id: 'mqtt',
  name: 'MQTT',
  category: 'iot',
  description: 'Subscribe to MQTT broker topics',
  modes: {
    subscription: true,
    lastPoint: false,
    lastFile: false,
    history: false
  },
  settings: [
    {
      key: 'url',
      type: 'OibText',
      label: 'URL',
      defaultValue: '',
      newRow: true,
      validators: [
        { key: 'required' },
        { key: 'pattern', params: { pattern: '^(mqtt:\\/\\/|mqtts:\\/\\/|tcp:\\/\\/|tls:\\/\\/|ws:\\/\\/|wss:\\/\\/).*' } }
      ],
      readDisplay: true
    },
    {
      key: 'qos',
      type: 'OibSelect',
      options: ['0', '1', '2'],
      label: 'QoS',
      defaultValue: '1',
      newRow: false,
      validators: [{ key: 'required' }],
      readDisplay: true
    },
    {
      key: 'persistent',
      type: 'OibCheckbox',
      label: 'Persistent',
      defaultValue: false,
      newRow: false,
      conditionalDisplay: { qos: ['2'] },
      validators: [{ key: 'required' }],
      readDisplay: true
    },
    { key: 'authentication', type: 'OibAuthentication', label: 'Authentication', newRow: true, authTypes: ['none', 'basic', 'cert'] },
    {
      key: 'caFile',
      type: 'OibText',
      label: 'CA File',
      defaultValue: '',
      conditionalDisplay: { authentication: ['cert'] },
      newRow: false,
      readDisplay: false
    },
    {
      key: 'rejectUnauthorized',
      type: 'OibCheckbox',
      label: 'Reject Unauthorized Connection',
      defaultValue: false,
      newRow: false,
      readDisplay: false,
      validators: [{ key: 'required' }]
    },
    {
      key: 'reconnectPeriod',
      type: 'OibNumber',
      label: 'Reconnect period (ms)',
      defaultValue: 1000,
      newRow: false,
      validators: [{ key: 'required' }, { key: 'min', params: { min: 100 } }, { key: 'max', params: { max: 30_000 } }],
      readDisplay: false
    },
    {
      key: 'connectTimeout',
      type: 'OibNumber',
      label: 'Connect Timeout (ms)',
      defaultValue: 30000,
      newRow: false,
      validators: [{ key: 'required' }, { key: 'min', params: { min: 100 } }, { key: 'max', params: { max: 30_000 } }],
      readDisplay: false
    },
    {
      key: 'dataArrayPath',
      type: 'OibText',
      label: 'Data array path',
      newRow: true,
      readDisplay: false
    },
    {
      key: 'valuePath',
      type: 'OibText',
      label: 'Value path',
      defaultValue: 'value',
      newRow: false,
      readDisplay: false
    },
    {
      key: 'pointIdPath',
      type: 'OibText',
      label: 'Point ID path',
      defaultValue: '',
      newRow: false,
      readDisplay: false
    },
    {
      key: 'qualityPath',
      type: 'OibText',
      label: 'Quality path',
      defaultValue: 'quality',
      newRow: false,
      readDisplay: false
    },
    {
      key: 'timestampOrigin',
      type: 'OibSelect',
      label: 'Timestamp origin',
      options: ['payload', 'oibus'],
      defaultValue: 'oibus',
      validators: [{ key: 'required' }],
      newRow: true,
      readDisplay: false
    },
    {
      key: 'timestampPath',
      type: 'OibText',
      label: 'Timestamp path',
      defaultValue: 'timestamp',
      conditionalDisplay: { timestampOrigin: ['payload'] },
      newRow: false,
      readDisplay: false
    },
    {
      key: 'timestampFormat',
      type: 'OibText',
      label: 'Timestamp format',
      defaultValue: 'yyyy-MM-dd HH:mm:ss.SSS',
      conditionalDisplay: { timestampOrigin: ['payload'] },
      newRow: false,
      readDisplay: false
    },
    {
      key: 'timestampTimezone',
      type: 'OibTimezone',
      label: 'Timezone',
      defaultValue: 'Europe/Paris',
      conditionalDisplay: { timestampOrigin: ['payload'] },
      newRow: false,
      readDisplay: false
    }
  ],
  items: {
    scanMode: {
      acceptSubscription: false,
      subscriptionOnly: true
    },
    settings: [
      {
        key: 'topic',
        type: 'OibText',
        label: 'Topic',
        validators: [{ key: 'required' }],
        readDisplay: true
      }
    ]
  }
};
export default manifest;
