import { SouthConnectorManifest } from '../../../shared/model/south-connector.model';

const manifest: SouthConnectorManifest = {
  id: 'mqtt',
  category: 'iot',
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
      translationKey: 'south.mqtt.url',
      defaultValue: '',
      newRow: true,
      validators: [
        { key: 'required' },
        { key: 'pattern', params: { pattern: '^(mqtt:\\/\\/|mqtts:\\/\\/|tcp:\\/\\/|tls:\\/\\/|ws:\\/\\/|wss:\\/\\/).*' } }
      ],
      class: 'col-6',
      displayInViewMode: true
    },
    {
      key: 'qos',
      type: 'OibSelect',
      options: ['0', '1', '2'],
      translationKey: 'south.mqtt.qos',
      defaultValue: '1',
      class: 'col-3',
      validators: [{ key: 'required' }],
      displayInViewMode: true
    },
    {
      key: 'persistent',
      type: 'OibCheckbox',
      translationKey: 'south.mqtt.persistent',
      defaultValue: false,
      class: 'col-3',
      conditionalDisplay: { field: 'qos', values: ['1', '2'] },
      validators: [{ key: 'required' }],
      displayInViewMode: true
    },
    {
      key: 'authentication',
      type: 'OibFormGroup',
      translationKey: '',
      class: 'col',
      newRow: true,
      displayInViewMode: false,
      validators: [{ key: 'required' }],
      content: [
        {
          key: 'type',
          type: 'OibSelect',
          translationKey: 'south.mqtt.authentication',
          options: ['none', 'basic', 'cert'],
          validators: [{ key: 'required' }],
          defaultValue: 'none',
          newRow: true,
          class: 'col-4',
          displayInViewMode: false
        },
        {
          key: 'username',
          type: 'OibText',
          translationKey: 'south.mqtt.username',
          defaultValue: '',
          newRow: true,
          class: 'col-4',
          validators: [{ key: 'required' }],
          conditionalDisplay: { field: 'type', values: ['basic'] },
          displayInViewMode: false
        },
        {
          key: 'password',
          type: 'OibSecret',
          translationKey: 'south.mqtt.password',
          defaultValue: '',
          class: 'col-4',
          conditionalDisplay: { field: 'type', values: ['basic'] },
          displayInViewMode: false
        },
        {
          key: 'certFilePath',
          type: 'OibText',
          translationKey: 'south.mqtt.cert-file-path',
          defaultValue: '',
          newRow: true,
          class: 'col-4',
          conditionalDisplay: { field: 'type', values: ['cert'] },
          validators: [{ key: 'required' }],
          displayInViewMode: false
        },
        {
          key: 'keyFilePath',
          type: 'OibText',
          translationKey: 'south.mqtt.key-file-path',
          defaultValue: '',
          conditionalDisplay: { field: 'type', values: ['cert'] },
          class: 'col-4',
          displayInViewMode: false
        },
        {
          key: 'caFilePath',
          type: 'OibText',
          translationKey: 'south.mqtt.ca-file-path',
          defaultValue: '',
          conditionalDisplay: { field: 'type', values: ['cert'] },
          class: 'col-4',
          displayInViewMode: false
        }
      ]
    },
    {
      key: 'rejectUnauthorized',
      type: 'OibCheckbox',
      translationKey: 'south.mqtt.reject-unauthorized',
      defaultValue: false,
      newRow: true,
      displayInViewMode: false,
      validators: [{ key: 'required' }]
    },
    {
      key: 'reconnectPeriod',
      type: 'OibNumber',
      translationKey: 'south.mqtt.reconnect-period',
      unitLabel: 'ms',
      defaultValue: 10000,
      newRow: false,
      validators: [{ key: 'required' }, { key: 'min', params: { min: 100 } }, { key: 'max', params: { max: 30_000 } }],
      displayInViewMode: false
    },
    {
      key: 'connectTimeout',
      type: 'OibNumber',
      translationKey: 'south.mqtt.connect-timeout',
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
        translationKey: 'south.items.mqtt.topic',
        validators: [{ key: 'required' }],
        displayInViewMode: true,
        class: 'col-8'
      },
      {
        key: 'valueType',
        type: 'OibSelect',
        translationKey: 'south.items.mqtt.value-type',
        options: ['number', 'string', 'json'],
        defaultValue: 'number',
        validators: [{ key: 'required' }],
        newRow: false,
        displayInViewMode: true,
        class: 'col-4'
      },
      {
        key: 'jsonPayload',
        type: 'OibFormGroup',
        translationKey: 'south.items.mqtt.json-payload.title',
        newRow: true,
        displayInViewMode: false,
        conditionalDisplay: { field: 'valueType', values: ['json'] },
        content: [
          {
            key: 'useArray',
            type: 'OibCheckbox',
            translationKey: 'south.items.mqtt.json-payload.use-array',
            defaultValue: false,
            class: 'col-4',
            validators: [{ key: 'required' }]
          },
          {
            key: 'dataArrayPath',
            type: 'OibText',
            translationKey: 'south.items.mqtt.json-payload.data-array-path',
            newRow: false,
            defaultValue: '',
            class: 'col-4',
            conditionalDisplay: { field: 'useArray', values: [true] }
          },
          {
            key: 'valuePath',
            type: 'OibText',
            translationKey: 'south.items.mqtt.json-payload.value-path',
            defaultValue: 'value',
            class: 'col-4',
            newRow: true,
            validators: [{ key: 'required' }]
          },
          {
            key: 'pointIdOrigin',
            type: 'OibSelect',
            translationKey: 'south.items.mqtt.json-payload.point-id-origin',
            options: ['oibus', 'payload'],
            defaultValue: 'oibus',
            class: 'col-4',
            newRow: true,
            validators: [{ key: 'required' }]
          },
          {
            key: 'pointIdPath',
            type: 'OibText',
            translationKey: 'south.items.mqtt.json-payload.point-id-path',
            defaultValue: 'name',
            class: 'col-4',
            conditionalDisplay: { field: 'pointIdOrigin', values: ['payload'] }
          },
          {
            key: 'timestampOrigin',
            type: 'OibSelect',
            translationKey: 'south.items.mqtt.json-payload.timestamp-origin',
            options: ['oibus', 'payload'],
            defaultValue: 'oibus',
            newRow: true,
            class: 'col-4',
            validators: [{ key: 'required' }]
          },
          {
            key: 'timestampPayload',
            type: 'OibFormGroup',
            translationKey: 'south.items.mqtt.json-payload.timestamp-payload.title',
            newRow: true,
            conditionalDisplay: { field: 'timestampOrigin', values: ['payload'] },
            content: [
              {
                key: 'timestampPath',
                translationKey: 'south.items.mqtt.json-payload.timestamp-payload.timestamp-path',
                type: 'OibText',
                defaultValue: '',
                validators: [{ key: 'required' }],
                displayInViewMode: true,
                class: 'col-4'
              },
              {
                key: 'timestampType',
                translationKey: 'south.items.mqtt.json-payload.timestamp-payload.timestamp-type',
                type: 'OibSelect',
                defaultValue: 'string',
                options: ['string', 'iso-string', 'unix-epoch', 'unix-epoch-ms'],
                validators: [{ key: 'required' }],
                class: 'col-4'
              },
              {
                key: 'timestampFormat',
                translationKey: 'south.items.mqtt.json-payload.timestamp-payload.timestamp-format',
                type: 'OibText',
                newRow: true,
                class: 'col-4',
                defaultValue: 'yyyy-MM-dd HH:mm:ss.SSS',
                conditionalDisplay: { field: 'timestampType', values: ['string'] },
                validators: [{ key: 'required' }]
              },
              {
                key: 'timezone',
                translationKey: 'south.items.mqtt.json-payload.timestamp-payload.timezone',
                type: 'OibTimezone',
                defaultValue: 'UTC',
                class: 'col-4',
                validators: [{ key: 'required' }],
                conditionalDisplay: { field: 'timestampType', values: ['string'] }
              }
            ]
          },
          {
            key: 'otherFields',
            type: 'OibArray',
            translationKey: 'south.items.mqtt.json-payload.other-fields.title',
            content: [
              {
                key: 'name',
                translationKey: 'south.items.mqtt.json-payload.other-fields.name',
                type: 'OibText',
                defaultValue: '',
                validators: [{ key: 'required' }],
                displayInViewMode: true
              },
              {
                key: 'path',
                translationKey: 'south.items.mqtt.json-payload.other-fields.path',
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
