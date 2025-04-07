import { SouthConnectorManifest } from '../../../shared/model/south-connector.model';

const manifest: SouthConnectorManifest = {
  id: 'postgresql',
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
      translationKey: 'south.postgresql.throttling.title',
      class: 'col',
      newRow: true,
      displayInViewMode: false,
      validators: [{ key: 'required' }],
      content: [
        {
          key: 'maxReadInterval',
          type: 'OibNumber',
          translationKey: 'south.postgresql.throttling.max-read-interval',
          validators: [{ key: 'required' }, { key: 'min', params: { min: 0 } }],
          defaultValue: 3600,
          unitLabel: 's',
          displayInViewMode: true
        },
        {
          key: 'readDelay',
          type: 'OibNumber',
          translationKey: 'south.postgresql.throttling.read-delay',
          validators: [{ key: 'required' }, { key: 'min', params: { min: 0 } }],
          defaultValue: 200,
          unitLabel: 'ms',
          displayInViewMode: true
        },
        {
          key: 'overlap',
          type: 'OibNumber',
          translationKey: 'south.postgresql.throttling.overlap',
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
      translationKey: 'south.postgresql.host',
      defaultValue: 'localhost',
      validators: [{ key: 'required' }],
      newRow: true,
      class: 'col-6',
      displayInViewMode: true
    },
    {
      key: 'port',
      type: 'OibNumber',
      translationKey: 'south.postgresql.port',
      defaultValue: 5432,
      class: 'col-3',
      validators: [{ key: 'required' }, { key: 'min', params: { min: 1 } }, { key: 'max', params: { max: 65535 } }],
      displayInViewMode: true
    },
    {
      key: 'connectionTimeout',
      type: 'OibNumber',
      translationKey: 'south.postgresql.connection-timeout',
      defaultValue: 10_000,
      class: 'col-3',
      validators: [{ key: 'required' }, { key: 'min', params: { min: 100 } }, { key: 'max', params: { max: 30000 } }],
      unitLabel: 'ms',
      displayInViewMode: false
    },
    {
      key: 'database',
      type: 'OibText',
      translationKey: 'south.postgresql.database',
      defaultValue: 'db',
      newRow: true,
      class: 'col-8',
      validators: [{ key: 'required' }],
      displayInViewMode: true
    },
    {
      key: 'requestTimeout',
      type: 'OibNumber',
      translationKey: 'south.postgresql.request-timeout',
      defaultValue: 10_000,
      class: 'col-4',
      validators: [{ key: 'required' }, { key: 'min', params: { min: 100 } }, { key: 'max', params: { max: 3_600_000 } }],
      unitLabel: 'ms',
      displayInViewMode: false
    },
    {
      key: 'username',
      type: 'OibText',
      translationKey: 'south.postgresql.username',
      displayInViewMode: true,
      newRow: true,
      class: 'col-6'
    },
    {
      key: 'password',
      type: 'OibSecret',
      translationKey: 'south.postgresql.password',
      displayInViewMode: false,
      class: 'col-6'
    }
  ],
  items: {
    scanMode: 'POLL',
    settings: [
      {
        key: 'query',
        type: 'OibCodeBlock',
        translationKey: 'south.items.postgresql.query',
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
        translationKey: 'south.items.postgresql.date-time-fields.date-time-field',
        allowRowDuplication: true,
        content: [
          {
            key: 'fieldName',
            translationKey: 'south.items.postgresql.date-time-fields.field-name',
            type: 'OibText',
            defaultValue: '',
            validators: [{ key: 'required' }],
            displayInViewMode: true
          },
          {
            key: 'useAsReference',
            translationKey: 'south.items.postgresql.date-time-fields.use-as-reference',
            type: 'OibCheckbox',
            defaultValue: false,
            displayInViewMode: true,
            validators: [{ key: 'required' }]
          },
          {
            key: 'type',
            translationKey: 'south.items.postgresql.date-time-fields.type',
            type: 'OibSelect',
            defaultValue: 'string',
            options: ['string', 'iso-string', 'unix-epoch', 'unix-epoch-ms', 'timestamp', 'timestamptz'],
            displayInViewMode: true,
            validators: [{ key: 'required' }]
          },
          {
            key: 'timezone',
            translationKey: 'south.items.postgresql.date-time-fields.timezone',
            type: 'OibTimezone',
            defaultValue: 'UTC',
            newRow: true,
            validators: [{ key: 'required' }],
            displayInViewMode: true,
            conditionalDisplay: { field: 'type', values: ['string', 'timestamp', 'DateTime', 'DateTime2', 'SmallDateTime', 'Date'] }
          },
          {
            key: 'format',
            translationKey: 'south.items.postgresql.date-time-fields.format',
            type: 'OibText',
            defaultValue: 'yyyy-MM-dd HH:mm:ss.SSS',
            validators: [{ key: 'required' }],
            conditionalDisplay: { field: 'type', values: ['string'] }
          },
          {
            key: 'locale',
            translationKey: 'south.items.postgresql.date-time-fields.locale',
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
        translationKey: 'south.items.postgresql.serialization.title',
        newRow: true,
        displayInViewMode: false,
        validators: [{ key: 'required' }],
        content: [
          {
            key: 'type',
            type: 'OibSelect',
            translationKey: 'south.items.postgresql.serialization.type',
            options: ['csv'],
            defaultValue: 'csv',
            newRow: true,
            displayInViewMode: false,
            validators: [{ key: 'required' }]
          },
          {
            key: 'filename',
            type: 'OibText',
            translationKey: 'south.items.postgresql.serialization.filename',
            defaultValue: '@ConnectorName-@ItemName-@CurrentDate.csv',
            newRow: false,
            displayInViewMode: false,
            validators: [{ key: 'required' }]
          },
          {
            key: 'delimiter',
            type: 'OibSelect',
            translationKey: 'south.items.postgresql.serialization.delimiter',
            options: ['DOT', 'SEMI_COLON', 'COLON', 'COMMA', 'NON_BREAKING_SPACE', 'SLASH', 'TAB', 'PIPE'],
            defaultValue: 'COMMA',
            newRow: false,
            displayInViewMode: false,
            validators: [{ key: 'required' }]
          },
          {
            key: 'compression',
            type: 'OibCheckbox',
            translationKey: 'south.items.postgresql.serialization.compression',
            defaultValue: false,
            newRow: false,
            displayInViewMode: false,
            validators: [{ key: 'required' }]
          },
          {
            key: 'outputTimestampFormat',
            type: 'OibText',
            translationKey: 'south.items.postgresql.serialization.output-timestamp-format',
            defaultValue: 'yyyy-MM-dd HH:mm:ss.SSS',
            newRow: true,
            displayInViewMode: false,
            validators: [{ key: 'required' }]
          },
          {
            key: 'outputTimezone',
            type: 'OibTimezone',
            translationKey: 'south.items.postgresql.serialization.output-timezone',
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
