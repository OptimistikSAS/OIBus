import { SouthConnectorManifest } from '../../../shared/model/south-connector.model';

const manifest: SouthConnectorManifest = {
  id: 'oledb',
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
      translationKey: 'south.oledb.throttling.title',
      class: 'col',
      newRow: true,
      displayInViewMode: false,
      validators: [{ key: 'required' }],
      content: [
        {
          key: 'maxReadInterval',
          type: 'OibNumber',
          translationKey: 'south.oledb.throttling.max-read-interval',
          validators: [{ key: 'required' }, { key: 'min', params: { min: 0 } }],
          defaultValue: 3600,
          unitLabel: 's',
          displayInViewMode: true
        },
        {
          key: 'readDelay',
          type: 'OibNumber',
          translationKey: 'south.oledb.throttling.read-delay',
          validators: [{ key: 'required' }, { key: 'min', params: { min: 0 } }],
          defaultValue: 200,
          unitLabel: 'ms',
          displayInViewMode: true
        },
        {
          key: 'overlap',
          type: 'OibNumber',
          translationKey: 'south.oledb.throttling.overlap',
          validators: [{ key: 'required' }, { key: 'min', params: { min: 0 } }],
          defaultValue: 0,
          unitLabel: 'ms',
          displayInViewMode: true
        }
      ]
    },
    {
      key: 'agentUrl',
      type: 'OibText',
      translationKey: 'south.oledb.agent-url',
      defaultValue: 'http://ip-adress-or-host:2224',
      newRow: true,
      validators: [{ key: 'required' }]
    },
    {
      key: 'connectionTimeout',
      type: 'OibNumber',
      translationKey: 'south.oledb.connection-timeout',
      defaultValue: 15_000,
      unitLabel: 'ms',
      newRow: true,
      class: 'col-4',
      validators: [{ key: 'required' }, { key: 'min', params: { min: 100 } }, { key: 'max', params: { max: 30_000 } }]
    },
    {
      key: 'retryInterval',
      type: 'OibNumber',
      translationKey: 'south.oledb.retry-interval',
      defaultValue: 10_000,
      unitLabel: 'ms',
      class: 'col-4',
      validators: [{ key: 'required' }, { key: 'min', params: { min: 100 } }, { key: 'max', params: { max: 30_000 } }]
    },
    {
      key: 'requestTimeout',
      type: 'OibNumber',
      translationKey: 'south.oledb.request-timeout',
      defaultValue: 15_000,
      unitLabel: 'ms',
      class: 'col-4',
      validators: [{ key: 'required' }, { key: 'min', params: { min: 100 } }, { key: 'max', params: { max: 30000 } }]
    },
    {
      key: 'connectionString',
      type: 'OibText',
      translationKey: 'south.oledb.connection-string',
      defaultValue: 'localhost',
      newRow: true,
      validators: [{ key: 'required' }],
      displayInViewMode: true
    }
  ],
  items: {
    scanMode: 'POLL',
    settings: [
      {
        key: 'query',
        type: 'OibCodeBlock',
        translationKey: 'south.items.oledb.query',
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
        translationKey: 'south.items.oledb.date-time-fields.date-time-field',
        content: [
          {
            key: 'fieldName',
            translationKey: 'south.items.oledb.date-time-fields.field-name',
            type: 'OibText',
            defaultValue: '',
            validators: [{ key: 'required' }],
            displayInViewMode: true
          },
          {
            key: 'useAsReference',
            translationKey: 'south.items.oledb.date-time-fields.use-as-reference',
            type: 'OibCheckbox',
            defaultValue: false,
            displayInViewMode: true,
            validators: [{ key: 'required' }]
          },
          {
            key: 'type',
            translationKey: 'south.items.oledb.date-time-fields.type',
            type: 'OibSelect',
            defaultValue: 'string',
            options: ['string', 'iso-string', 'unix-epoch', 'unix-epoch-ms'],
            displayInViewMode: true,
            validators: [{ key: 'required' }]
          },
          {
            key: 'timezone',
            translationKey: 'south.items.oledb.date-time-fields.timezone',
            type: 'OibTimezone',
            defaultValue: 'UTC',
            newRow: true,
            validators: [{ key: 'required' }],
            displayInViewMode: true,
            conditionalDisplay: { field: 'type', values: ['string', 'timestamp', 'DateTime', 'DateTime2', 'SmallDateTime', 'Date'] }
          },
          {
            key: 'format',
            translationKey: 'south.items.oledb.date-time-fields.format',
            type: 'OibText',
            defaultValue: 'yyyy-MM-dd HH:mm:ss.fff',
            validators: [{ key: 'required' }],
            conditionalDisplay: { field: 'type', values: ['string'] }
          },
          {
            key: 'locale',
            translationKey: 'south.items.oledb.date-time-fields.locale',
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
        translationKey: 'south.items.oledb.serialization.title',
        newRow: true,
        displayInViewMode: false,
        validators: [{ key: 'required' }],
        content: [
          {
            key: 'type',
            type: 'OibSelect',
            translationKey: 'south.items.oledb.serialization.type',
            options: ['csv'],
            defaultValue: 'csv',
            newRow: true,
            displayInViewMode: false,
            validators: [{ key: 'required' }]
          },
          {
            key: 'filename',
            type: 'OibText',
            translationKey: 'south.items.oledb.serialization.filename',
            defaultValue: '@ConnectorName-@ItemName-@CurrentDate.csv',
            newRow: false,
            displayInViewMode: false,
            validators: [{ key: 'required' }]
          },
          {
            key: 'delimiter',
            type: 'OibSelect',
            translationKey: 'south.items.oledb.serialization.delimiter',
            options: ['DOT', 'SEMI_COLON', 'COLON', 'COMMA', 'NON_BREAKING_SPACE', 'SLASH', 'TAB', 'PIPE'],
            defaultValue: 'COMMA',
            newRow: false,
            displayInViewMode: false,
            validators: [{ key: 'required' }]
          },
          {
            key: 'compression',
            type: 'OibCheckbox',
            translationKey: 'south.items.oledb.serialization.compression',
            defaultValue: false,
            newRow: false,
            displayInViewMode: false,
            validators: [{ key: 'required' }]
          },
          {
            key: 'outputTimestampFormat',
            type: 'OibText',
            translationKey: 'south.items.oledb.serialization.output-timestamp-format',
            defaultValue: 'yyyy-MM-dd HH:mm:ss.fff',
            newRow: true,
            displayInViewMode: false,
            validators: [{ key: 'required' }]
          },
          {
            key: 'outputTimezone',
            type: 'OibTimezone',
            translationKey: 'south.items.oledb.serialization.output-timezone',
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
