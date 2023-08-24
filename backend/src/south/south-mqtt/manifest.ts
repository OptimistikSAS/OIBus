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
      label: 'Reject unauthorized connection',
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
      label: 'Connect timeout',
      unitLabel: 'ms',
      defaultValue: 10000,
      newRow: false,
      validators: [{ key: 'required' }, { key: 'min', params: { min: 100 } }, { key: 'max', params: { max: 30_000 } }],
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
      },
      {
        key: 'valueType',
        type: 'OibSelect',
        label: 'Value type',
        options: ['number', 'string', 'json'],
        defaultValue: 'number',
        validators: [{ key: 'required' }],
        newRow: false,
        displayInViewMode: true
      },
      {
        key: 'jsonPayload',
        type: 'OibFormGroup',
        label: 'JSON payload',
        newRow: true,
        displayInViewMode: false,
        conditionalDisplay: { field: 'valueType', values: ['json'] },
        content: [
          {
            key: 'useArray',
            type: 'OibCheckbox',
            label: 'Values in array',
            defaultValue: false,
            class: 'col-4',
            validators: [{ key: 'required' }]
          },
          {
            key: 'dataArrayPath',
            type: 'OibText',
            label: 'Array path',
            newRow: false,
            defaultValue: '',
            class: 'col-4',
            conditionalDisplay: { field: 'useArray', values: [true] }
          },
          {
            key: 'pointIdOrigin',
            type: 'OibSelect',
            label: 'Point ID origin',
            options: ['oibus', 'payload'],
            defaultValue: 'oibus',
            class: 'col-4',
            newRow: true,
            validators: [{ key: 'required' }]
          },
          {
            key: 'timestampOrigin',
            type: 'OibSelect',
            label: 'Timestamp origin',
            options: ['oibus', 'payload'],
            defaultValue: 'oibus',
            class: 'col-4',
            validators: [{ key: 'required' }]
          },
          {
            key: 'valuePath',
            type: 'OibText',
            label: 'Value path',
            defaultValue: 'value',
            class: 'col-4',
            newRow: true,
            validators: [{ key: 'required' }]
          },
          {
            key: 'pointIdPath',
            type: 'OibText',
            label: 'Point ID path',
            defaultValue: 'name',
            class: 'col-4',
            conditionalDisplay: { field: 'pointIdOrigin', values: ['payload'] }
          },
          {
            key: 'timestampPayload',
            type: 'OibFormGroup',
            label: '',
            newRow: true,
            conditionalDisplay: { field: 'timestampOrigin', values: ['payload'] },
            content: [
              {
                key: 'timestampPath',
                label: 'Timestamp path',
                type: 'OibText',
                defaultValue: '',
                validators: [{ key: 'required' }],
                displayInViewMode: true
              },
              {
                key: 'timestampType',
                label: 'Type',
                type: 'OibSelect',
                defaultValue: 'string',
                options: ['string', 'iso-string', 'unix-epoch', 'unix-epoch-ms'],
                validators: [{ key: 'required' }],
                pipe: 'dateTimeType'
              },
              {
                key: 'timezone',
                label: 'Timezone',
                type: 'OibTimezone',
                defaultValue: 'UTC',
                validators: [{ key: 'required' }],
                conditionalDisplay: { field: 'timestampType', values: ['string'] }
              },
              {
                key: 'timestampFormat',
                label: 'Timestamp format',
                type: 'OibText',
                defaultValue: 'yyyy-MM-dd HH:mm:ss',
                conditionalDisplay: { field: 'timestampType', values: ['string'] },
                validators: [{ key: 'required' }]
              }
            ]
          },
          {
            key: 'otherFields',
            type: 'OibArray',
            label: 'Additional fields',
            content: [
              {
                key: 'name',
                label: 'Field name in output',
                type: 'OibText',
                defaultValue: '',
                validators: [{ key: 'required' }],
                displayInViewMode: true
              },
              {
                key: 'path',
                label: 'Path in the retrieved payload',
                type: 'OibText',
                defaultValue: '*',
                validators: [{ key: 'required' }],
                displayInViewMode: true
              }
            ],
            class: 'col',
            newRow: true,
            displayInViewMode: false
          }
        ]
      }
    ]
  }
};
export default manifest;
