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
    history: false,
    forceMaxInstantPerItem: false
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
      displayInViewMode: true
    },
    {
      key: 'qos',
      type: 'OibSelect',
      options: ['0', '1', '2'],
      label: 'QoS',
      defaultValue: '1',
      newRow: false,
      validators: [{ key: 'required' }],
      displayInViewMode: true
    },
    {
      key: 'persistent',
      type: 'OibCheckbox',
      label: 'Persistent',
      defaultValue: false,
      newRow: false,
      conditionalDisplay: { field: 'qos', values: ['2'] },
      validators: [{ key: 'required' }],
      displayInViewMode: true
    },
    {
      key: 'authentication',
      type: 'OibFormGroup',
      label: 'Authentication',
      class: 'col',
      newRow: true,
      displayInViewMode: false,
      validators: [{ key: 'required' }],
      content: [
        {
          key: 'type',
          type: 'OibSelect',
          label: 'Type',
          options: ['none', 'basic', 'cert'],
          pipe: 'authentication',
          validators: [{ key: 'required' }],
          defaultValue: 'none',
          newRow: true,
          displayInViewMode: false
        },
        {
          key: 'username',
          type: 'OibText',
          label: 'Username',
          defaultValue: '',
          validators: [{ key: 'required' }],
          conditionalDisplay: { field: 'type', values: ['basic'] },
          displayInViewMode: false
        },
        {
          key: 'password',
          type: 'OibSecret',
          label: 'Password',
          defaultValue: '',
          conditionalDisplay: { field: 'type', values: ['basic'] },
          displayInViewMode: false
        },
        {
          key: 'certFilePath',
          type: 'OibText',
          label: 'Cert file path',
          defaultValue: '',
          conditionalDisplay: { field: 'type', values: ['cert'] },
          validators: [{ key: 'required' }],
          newRow: false,
          displayInViewMode: false
        },
        {
          key: 'keyFilePath',
          type: 'OibText',
          label: 'Key file path',
          defaultValue: '',
          conditionalDisplay: { field: 'type', values: ['cert'] },
          newRow: false,
          displayInViewMode: false
        },
        {
          key: 'caFilePath',
          type: 'OibText',
          label: 'CA file path',
          defaultValue: '',
          conditionalDisplay: { field: 'type', values: ['cert'] },
          newRow: false,
          displayInViewMode: false
        }
      ]
    },
    {
      key: 'rejectUnauthorized',
      type: 'OibCheckbox',
      label: 'Reject Unauthorized Connection',
      defaultValue: false,
      newRow: true,
      displayInViewMode: false,
      validators: [{ key: 'required' }]
    },
    {
      key: 'reconnectPeriod',
      type: 'OibNumber',
      label: 'Reconnect period',
      unitLabel: 'ms',
      defaultValue: 1000,
      newRow: false,
      validators: [{ key: 'required' }, { key: 'min', params: { min: 100 } }, { key: 'max', params: { max: 30_000 } }],
      displayInViewMode: false
    },
    {
      key: 'connectTimeout',
      type: 'OibNumber',
      label: 'Connect Timeout',
      unitLabel: 'ms',
      defaultValue: 30000,
      newRow: false,
      validators: [{ key: 'required' }, { key: 'min', params: { min: 100 } }, { key: 'max', params: { max: 30_000 } }],
      displayInViewMode: false
    },
    {
      key: 'dataArrayPath',
      type: 'OibText',
      label: 'Data array path',
      newRow: true,
      displayInViewMode: false
    },
    {
      key: 'valuePath',
      type: 'OibText',
      label: 'Value path',
      defaultValue: 'value',
      validators: [{ key: 'required' }],
      newRow: false,
      displayInViewMode: false
    },
    {
      key: 'pointIdPath',
      type: 'OibText',
      label: 'Point ID path',
      defaultValue: 'pointId',
      validators: [{ key: 'required' }],
      newRow: false,
      displayInViewMode: false
    },
    {
      key: 'qualityPath',
      type: 'OibText',
      label: 'Quality path',
      defaultValue: '',
      newRow: false,
      displayInViewMode: false
    },
    {
      key: 'timestampOrigin',
      type: 'OibSelect',
      label: 'Timestamp origin',
      options: ['payload', 'oibus'],
      defaultValue: 'oibus',
      validators: [{ key: 'required' }],
      newRow: true,
      displayInViewMode: false
    },
    {
      key: 'timestampPath',
      type: 'OibText',
      label: 'Timestamp path',
      defaultValue: 'timestamp',
      validators: [{ key: 'required' }],
      conditionalDisplay: { field: 'timestampOrigin', values: ['payload'] },
      newRow: false,
      displayInViewMode: false
    },
    {
      key: 'timestampFormat',
      type: 'OibText',
      label: 'Timestamp format',
      defaultValue: 'yyyy-MM-dd HH:mm:ss.SSS',
      validators: [{ key: 'required' }],
      conditionalDisplay: { field: 'timestampOrigin', values: ['payload'] },
      newRow: false,
      displayInViewMode: false
    },
    {
      key: 'timestampTimezone',
      type: 'OibTimezone',
      label: 'Timezone',
      defaultValue: 'Europe/Paris',
      validators: [{ key: 'required' }],
      conditionalDisplay: { field: 'timestampOrigin', values: ['payload'] },
      newRow: false,
      displayInViewMode: false
    }
  ],
  items: {
    scanMode: {
      acceptSubscription: true,
      subscriptionOnly: true
    },
    settings: [
      {
        key: 'topic',
        type: 'OibText',
        label: 'Topic',
        validators: [{ key: 'required' }],
        displayInViewMode: true
      }
    ]
  }
};
export default manifest;
