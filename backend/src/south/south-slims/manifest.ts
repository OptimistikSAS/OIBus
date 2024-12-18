import { SouthConnectorManifest } from '../../../shared/model/south-connector.model';

const manifest: SouthConnectorManifest = {
  id: 'slims',
  category: 'api',
  modes: {
    subscription: false,
    lastPoint: false,
    lastFile: false,
    history: true
  },
  settings: [
    {
      key: 'throttling',
      type: 'OibFormGroup',
      translationKey: 'south.slims.throttling.title',
      class: 'col',
      newRow: true,
      displayInViewMode: false,
      validators: [{ key: 'required' }],
      content: [
        {
          key: 'maxReadInterval',
          type: 'OibNumber',
          translationKey: 'south.slims.throttling.max-read-interval',
          validators: [{ key: 'required' }, { key: 'min', params: { min: 0 } }],
          defaultValue: 3600,
          unitLabel: 's',
          displayInViewMode: true
        },
        {
          key: 'readDelay',
          type: 'OibNumber',
          translationKey: 'south.slims.throttling.read-delay',
          validators: [{ key: 'required' }, { key: 'min', params: { min: 0 } }],
          defaultValue: 200,
          unitLabel: 'ms',
          displayInViewMode: true
        },
        {
          key: 'overlap',
          type: 'OibNumber',
          translationKey: 'south.slims.throttling.overlap',
          validators: [{ key: 'required' }, { key: 'min', params: { min: 0 } }],
          defaultValue: 0,
          unitLabel: 'ms',
          displayInViewMode: true
        }
      ]
    },
    {
      key: 'url',
      type: 'OibText',
      translationKey: 'south.slims.host',
      defaultValue: 'http://localhost',
      newRow: true,
      validators: [{ key: 'required' }, { key: 'pattern', params: { pattern: '^(http:\\/\\/|https:\\/\\/|HTTP:\\/\\/|HTTPS:\\/\\/).*' } }],
      displayInViewMode: true,
      class: 'col-8'
    },
    {
      key: 'port',
      type: 'OibNumber',
      translationKey: 'south.slims.port',
      defaultValue: 80,
      validators: [{ key: 'required' }, { key: 'min', params: { min: 1 } }, { key: 'max', params: { max: 65535 } }],
      displayInViewMode: true,
      class: 'col-4'
    },
    {
      key: 'acceptUnauthorized',
      type: 'OibCheckbox',
      translationKey: 'south.slims.accept-unauthorized',
      validators: [{ key: 'required' }],
      defaultValue: false,
      displayInViewMode: true,
      newRow: true,
      class: 'col-6'
    },
    {
      key: 'timeout',
      type: 'OibNumber',
      translationKey: 'south.slims.timeout',
      defaultValue: 30,
      unitLabel: 's',
      validators: [{ key: 'required' }],
      class: 'col-6'
    },
    {
      key: 'username',
      type: 'OibText',
      translationKey: 'south.slims.username',
      defaultValue: '',
      validators: [{ key: 'required' }],
      newRow: true,
      class: 'col-6',
      displayInViewMode: false
    },
    {
      key: 'password',
      type: 'OibSecret',
      translationKey: 'south.slims.password',
      defaultValue: '',
      class: 'col-6',
      displayInViewMode: false
    },
    {
      key: 'useProxy',
      translationKey: 'south.slims.use-proxy',
      type: 'OibCheckbox',
      newRow: true,
      defaultValue: false,
      displayInViewMode: true,
      validators: [{ key: 'required' }]
    },
    {
      key: 'proxyUrl',
      translationKey: 'south.slims.proxy-url',
      type: 'OibText',
      validators: [{ key: 'required' }],
      conditionalDisplay: { field: 'useProxy', values: [true] }
    },
    {
      key: 'proxyUsername',
      translationKey: 'south.slims.proxy-username',
      type: 'OibText',
      conditionalDisplay: { field: 'useProxy', values: [true] }
    },
    {
      key: 'proxyPassword',
      translationKey: 'south.slims.proxy-password',
      type: 'OibSecret',
      conditionalDisplay: { field: 'useProxy', values: [true] }
    }
  ],
  items: {
    scanMode: {
      acceptSubscription: false,
      subscriptionOnly: false
    },
    settings: [
      {
        key: 'endpoint',
        type: 'OibText',
        translationKey: 'south.items.slims.endpoint',
        defaultValue: '/endpoint',
        validators: [{ key: 'required' }]
      },
      {
        key: 'body',
        type: 'OibCodeBlock',
        translationKey: 'south.items.slims.body',
        contentType: 'json',
        defaultValue: '',
        newRow: true
      },
      {
        key: 'queryParams',
        type: 'OibArray',
        translationKey: 'south.items.slims.query-params.query-param',
        content: [
          {
            key: 'key',
            translationKey: 'south.items.slims.query-params.key',
            type: 'OibText',
            defaultValue: '',
            validators: [{ key: 'required' }],
            displayInViewMode: true
          },
          {
            key: 'value',
            translationKey: 'south.items.slims.query-params.value',
            type: 'OibText',
            defaultValue: '',
            validators: [{ key: 'required' }],
            displayInViewMode: true
          }
        ],
        newRow: true,
        displayInViewMode: false
      },
      {
        key: 'dateTimeFields',
        type: 'OibArray',
        translationKey: 'south.items.slims.date-time-fields.date-time-field',
        content: [
          {
            key: 'fieldName',
            translationKey: 'south.items.slims.date-time-fields.field-name',
            type: 'OibText',
            defaultValue: '',
            validators: [{ key: 'required' }],
            displayInViewMode: true
          },
          {
            key: 'useAsReference',
            translationKey: 'south.items.slims.date-time-fields.use-as-reference',
            type: 'OibCheckbox',
            defaultValue: false,
            displayInViewMode: true,
            validators: [{ key: 'required' }]
          },
          {
            key: 'type',
            translationKey: 'south.items.slims.date-time-fields.type',
            type: 'OibSelect',
            defaultValue: 'string',
            options: ['string', 'iso-string', 'unix-epoch', 'unix-epoch-ms'],
            displayInViewMode: true,
            validators: [{ key: 'required' }]
          },
          {
            key: 'timezone',
            translationKey: 'south.items.slims.date-time-fields.timezone',
            type: 'OibTimezone',
            defaultValue: 'UTC',
            newRow: true,
            validators: [{ key: 'required' }],
            displayInViewMode: true,
            conditionalDisplay: { field: 'type', values: ['string', 'timestamp', 'DateTime', 'DateTime2', 'SmallDateTime', 'Date'] }
          },
          {
            key: 'format',
            translationKey: 'south.items.slims.date-time-fields.format',
            type: 'OibText',
            defaultValue: 'yyyy-MM-dd HH:mm:ss.SSS',
            validators: [{ key: 'required' }],
            conditionalDisplay: { field: 'type', values: ['string'] }
          },
          {
            key: 'locale',
            translationKey: 'south.items.slims.date-time-fields.locale',
            defaultValue: 'en-En',
            type: 'OibText',
            validators: [{ key: 'required' }],
            conditionalDisplay: { field: 'type', values: ['string'] }
          }
        ],
        class: 'col',
        newRow: true,
        displayInViewMode: false
      },
      {
        key: 'serialization',
        type: 'OibFormGroup',
        translationKey: 'south.items.slims.serialization.title',
        newRow: true,
        displayInViewMode: false,
        validators: [{ key: 'required' }],
        content: [
          {
            key: 'type',
            type: 'OibSelect',
            translationKey: 'south.items.slims.serialization.type',
            options: ['csv'],
            defaultValue: 'csv',
            newRow: true,
            displayInViewMode: false,
            validators: [{ key: 'required' }]
          },
          {
            key: 'filename',
            type: 'OibText',
            translationKey: 'south.items.slims.serialization.filename',
            defaultValue: '@ConnectorName-@ItemName-@CurrentDate.csv',
            newRow: false,
            displayInViewMode: false,
            validators: [{ key: 'required' }]
          },
          {
            key: 'delimiter',
            type: 'OibSelect',
            translationKey: 'south.items.slims.serialization.delimiter',
            options: ['DOT', 'SEMI_COLON', 'COLON', 'COMMA', 'NON_BREAKING_SPACE', 'SLASH', 'TAB', 'PIPE'],
            defaultValue: 'COMMA',
            newRow: false,
            displayInViewMode: false,
            validators: [{ key: 'required' }]
          },
          {
            key: 'compression',
            type: 'OibCheckbox',
            translationKey: 'south.items.slims.serialization.compression',
            defaultValue: false,
            newRow: false,
            displayInViewMode: false,
            validators: [{ key: 'required' }]
          },
          {
            key: 'outputTimestampFormat',
            type: 'OibText',
            translationKey: 'south.items.slims.serialization.output-timestamp-format',
            defaultValue: 'yyyy-MM-dd HH:mm:ss.SSS',
            newRow: true,
            displayInViewMode: false,
            validators: [{ key: 'required' }]
          },
          {
            key: 'outputTimezone',
            type: 'OibTimezone',
            translationKey: 'south.items.slims.serialization.output-timezone',
            defaultValue: 'Europe/Paris',
            newRow: false,
            displayInViewMode: false,
            validators: [{ key: 'required' }]
          }
        ]
      }
    ]
  }
};

export default manifest;
