import { SouthConnectorManifest } from '../../../shared/model/south-connector.model';

const manifest: SouthConnectorManifest = {
  id: 'mssql',
  category: 'database',
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
      translationKey: 'south.mssql.throttling.title',
      class: 'col',
      newRow: true,
      displayInViewMode: false,
      validators: [{ key: 'required' }],
      content: [
        {
          key: 'maxReadInterval',
          type: 'OibNumber',
          translationKey: 'south.mssql.throttling.max-read-interval',
          validators: [{ key: 'required' }, { key: 'min', params: { min: 0 } }],
          defaultValue: 3600,
          unitLabel: 's',
          displayInViewMode: true
        },
        {
          key: 'readDelay',
          type: 'OibNumber',
          translationKey: 'south.mssql.throttling.read-delay',
          validators: [{ key: 'required' }, { key: 'min', params: { min: 0 } }],
          defaultValue: 200,
          unitLabel: 'ms',
          displayInViewMode: true
        },
        {
          key: 'overlap',
          type: 'OibNumber',
          translationKey: 'south.mssql.throttling.overlap',
          validators: [{ key: 'required' }, { key: 'min', params: { min: 0 } }],
          defaultValue: 0,
          unitLabel: 'ms',
          displayInViewMode: true
        }
      ]
    },
    {
      key: 'host',
      type: 'OibText',
      translationKey: 'south.mssql.host',
      defaultValue: 'localhost',
      validators: [{ key: 'required' }],
      newRow: true,
      class: 'col-6',
      displayInViewMode: true
    },
    {
      key: 'port',
      type: 'OibNumber',
      translationKey: 'south.mssql.port',
      defaultValue: 1433,
      class: 'col-3',
      validators: [{ key: 'required' }, { key: 'min', params: { min: 1 } }, { key: 'max', params: { max: 65535 } }],
      displayInViewMode: true
    },
    {
      key: 'connectionTimeout',
      type: 'OibNumber',
      translationKey: 'south.mssql.connection-timeout',
      defaultValue: 5_000,
      unitLabel: 'ms',
      class: 'col-3',
      validators: [{ key: 'required' }, { key: 'min', params: { min: 100 } }, { key: 'max', params: { max: 30000 } }],
      displayInViewMode: false
    },
    {
      key: 'database',
      type: 'OibText',
      translationKey: 'south.mssql.database',
      defaultValue: 'db',
      newRow: true,
      class: 'col-6',
      validators: [{ key: 'required' }],
      displayInViewMode: true
    },
    {
      key: 'encryption',
      type: 'OibCheckbox',
      translationKey: 'south.mssql.encryption',
      defaultValue: false,
      validators: [{ key: 'required' }],
      class: 'col-3',
      displayInViewMode: true
    },
    {
      key: 'trustServerCertificate',
      type: 'OibCheckbox',
      translationKey: 'south.mssql.trust-server-certificate',
      defaultValue: false,
      class: 'col-3',
      validators: [{ key: 'required' }],
      displayInViewMode: false
    },
    {
      key: 'username',
      type: 'OibText',
      translationKey: 'south.mssql.username',
      newRow: true,
      displayInViewMode: true
    },
    {
      key: 'password',
      type: 'OibSecret',
      translationKey: 'south.mssql.password',
      displayInViewMode: false
    },
    {
      key: 'domain',
      type: 'OibText',
      translationKey: 'south.mssql.domain',
      displayInViewMode: true
    },
    {
      key: 'requestTimeout',
      type: 'OibNumber',
      translationKey: 'south.mssql.request-timeout',
      defaultValue: 15_000,
      unitLabel: 'ms',
      class: 'col-4',
      newRow: true,
      validators: [{ key: 'required' }, { key: 'min', params: { min: 100 } }, { key: 'max', params: { max: 3_600_000 } }],
      displayInViewMode: false
    }
  ],
  items: {
    scanMode: {
      acceptSubscription: false,
      subscriptionOnly: false
    },
    settings: [
      {
        key: 'query',
        type: 'OibCodeBlock',
        translationKey: 'south.items.mssql.query',
        contentType: 'sql',
        defaultValue:
          'SELECT level, message, timestamp, scope_name as scopeName FROM logs WHERE timestamp > @StartTime AND timestamp <= @EndTime',
        class: 'col-12 text-nowrap',
        validators: [{ key: 'required' }],
        displayInViewMode: true
      },
      {
        key: 'dateTimeFields',
        type: 'OibArray',
        translationKey: 'south.items.mssql.date-time-fields.date-time-field',
        content: [
          {
            key: 'fieldName',
            translationKey: 'south.items.mssql.date-time-fields.field-name',
            type: 'OibText',
            defaultValue: '',
            validators: [{ key: 'required' }],
            displayInViewMode: true
          },
          {
            key: 'useAsReference',
            translationKey: 'south.items.mssql.date-time-fields.use-as-reference',
            type: 'OibCheckbox',
            defaultValue: false,
            displayInViewMode: true,
            validators: [{ key: 'required' }]
          },
          {
            key: 'type',
            translationKey: 'south.items.mssql.date-time-fields.type',
            type: 'OibSelect',
            defaultValue: 'string',
            options: [
              'string',
              'Date',
              'DateTime',
              'DateTime2',
              'DateTimeOffset',
              'SmallDateTime',
              'iso-string',
              'unix-epoch',
              'unix-epoch-ms'
            ],
            displayInViewMode: true,
            validators: [{ key: 'required' }]
          },
          {
            key: 'timezone',
            translationKey: 'south.items.mssql.date-time-fields.timezone',
            type: 'OibTimezone',
            defaultValue: 'UTC',
            newRow: true,
            validators: [{ key: 'required' }],
            displayInViewMode: true,
            conditionalDisplay: { field: 'type', values: ['string', 'timestamp', 'DateTime', 'DateTime2', 'SmallDateTime', 'Date'] }
          },
          {
            key: 'format',
            translationKey: 'south.items.mssql.date-time-fields.format',
            type: 'OibText',
            defaultValue: 'yyyy-MM-dd HH:mm:ss.SSS',
            validators: [{ key: 'required' }],
            conditionalDisplay: { field: 'type', values: ['string'] }
          },
          {
            key: 'locale',
            translationKey: 'south.items.mssql.date-time-fields.locale',
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
        translationKey: 'south.items.mssql.serialization.title',
        newRow: true,
        displayInViewMode: false,
        validators: [{ key: 'required' }],
        content: [
          {
            key: 'type',
            type: 'OibSelect',
            translationKey: 'south.items.mssql.serialization.type',
            options: ['csv'],
            defaultValue: 'csv',
            newRow: true,
            displayInViewMode: false,
            validators: [{ key: 'required' }]
          },
          {
            key: 'filename',
            type: 'OibText',
            translationKey: 'south.items.mssql.serialization.filename',
            defaultValue: '@ConnectorName-@ItemName-@CurrentDate.csv',
            newRow: false,
            displayInViewMode: false,
            validators: [{ key: 'required' }]
          },
          {
            key: 'delimiter',
            type: 'OibSelect',
            translationKey: 'south.items.mssql.serialization.delimiter',
            options: ['DOT', 'SEMI_COLON', 'COLON', 'COMMA', 'NON_BREAKING_SPACE', 'SLASH', 'TAB', 'PIPE'],
            defaultValue: 'COMMA',
            newRow: false,
            displayInViewMode: false,
            validators: [{ key: 'required' }]
          },
          {
            key: 'compression',
            type: 'OibCheckbox',
            translationKey: 'south.items.mssql.serialization.compression',
            defaultValue: false,
            newRow: false,
            displayInViewMode: false,
            validators: [{ key: 'required' }]
          },
          {
            key: 'outputTimestampFormat',
            type: 'OibText',
            translationKey: 'south.items.mssql.serialization.output-timestamp-format',
            defaultValue: 'yyyy-MM-dd HH:mm:ss.SSS',
            newRow: true,
            displayInViewMode: false,
            validators: [{ key: 'required' }]
          },
          {
            key: 'outputTimezone',
            type: 'OibTimezone',
            translationKey: 'south.items.mssql.serialization.output-timezone',
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
