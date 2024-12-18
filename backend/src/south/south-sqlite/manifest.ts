import { SouthConnectorManifest } from '../../../shared/model/south-connector.model';

const manifest: SouthConnectorManifest = {
  id: 'sqlite',
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
      translationKey: 'south.sqlite.throttling.title',
      class: 'col',
      newRow: true,
      displayInViewMode: false,
      validators: [{ key: 'required' }],
      content: [
        {
          key: 'maxReadInterval',
          type: 'OibNumber',
          translationKey: 'south.sqlite.throttling.max-read-interval',
          validators: [{ key: 'required' }, { key: 'min', params: { min: 0 } }],
          defaultValue: 3600,
          unitLabel: 's',
          displayInViewMode: true
        },
        {
          key: 'readDelay',
          type: 'OibNumber',
          translationKey: 'south.sqlite.throttling.read-delay',
          validators: [{ key: 'required' }, { key: 'min', params: { min: 0 } }],
          defaultValue: 200,
          unitLabel: 'ms',
          displayInViewMode: true
        },
        {
          key: 'overlap',
          type: 'OibNumber',
          translationKey: 'south.sqlite.throttling.overlap',
          validators: [{ key: 'required' }, { key: 'min', params: { min: 0 } }],
          defaultValue: 0,
          unitLabel: 'ms',
          displayInViewMode: true
        }
      ]
    },
    {
      key: 'databasePath',
      type: 'OibText',
      translationKey: 'south.sqlite.database-path',
      defaultValue: './test.db',
      newRow: true,
      validators: [{ key: 'required' }],
      displayInViewMode: true
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
        translationKey: 'south.items.sqlite.query',
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
        translationKey: 'south.items.sqlite.date-time-fields.date-time-field',
        content: [
          {
            key: 'fieldName',
            translationKey: 'south.items.sqlite.date-time-fields.field-name',
            type: 'OibText',
            defaultValue: '',
            validators: [{ key: 'required' }],
            displayInViewMode: true
          },
          {
            key: 'useAsReference',
            translationKey: 'south.items.sqlite.date-time-fields.use-as-reference',
            type: 'OibCheckbox',
            defaultValue: false,
            displayInViewMode: true,
            validators: [{ key: 'required' }]
          },
          {
            key: 'type',
            translationKey: 'south.items.sqlite.date-time-fields.type',
            type: 'OibSelect',
            defaultValue: 'string',
            options: ['string', 'iso-string', 'unix-epoch', 'unix-epoch-ms'],
            displayInViewMode: true,
            validators: [{ key: 'required' }]
          },
          {
            key: 'timezone',
            translationKey: 'south.items.sqlite.date-time-fields.timezone',
            type: 'OibTimezone',
            defaultValue: 'UTC',
            newRow: true,
            validators: [{ key: 'required' }],
            displayInViewMode: true,
            conditionalDisplay: { field: 'type', values: ['string', 'timestamp', 'DateTime', 'DateTime2', 'SmallDateTime', 'Date'] }
          },
          {
            key: 'format',
            translationKey: 'south.items.sqlite.date-time-fields.format',
            type: 'OibText',
            defaultValue: 'yyyy-MM-dd HH:mm:ss.SSS',
            validators: [{ key: 'required' }],
            conditionalDisplay: { field: 'type', values: ['string'] }
          },
          {
            key: 'locale',
            translationKey: 'south.items.sqlite.date-time-fields.locale',
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
        translationKey: 'south.items.sqlite.serialization.title',
        newRow: true,
        displayInViewMode: false,
        validators: [{ key: 'required' }],
        content: [
          {
            key: 'type',
            type: 'OibSelect',
            translationKey: 'south.items.sqlite.serialization.type',
            options: ['csv'],
            defaultValue: 'csv',
            newRow: true,
            displayInViewMode: false,
            validators: [{ key: 'required' }]
          },
          {
            key: 'filename',
            type: 'OibText',
            translationKey: 'south.items.sqlite.serialization.filename',
            defaultValue: '@ConnectorName-@ItemName-@CurrentDate.csv',
            newRow: false,
            displayInViewMode: false,
            validators: [{ key: 'required' }]
          },
          {
            key: 'delimiter',
            type: 'OibSelect',
            translationKey: 'south.items.sqlite.serialization.delimiter',
            options: ['DOT', 'SEMI_COLON', 'COLON', 'COMMA', 'NON_BREAKING_SPACE', 'SLASH', 'TAB', 'PIPE'],
            defaultValue: 'COMMA',
            newRow: false,
            displayInViewMode: false,
            validators: [{ key: 'required' }]
          },
          {
            key: 'compression',
            type: 'OibCheckbox',
            translationKey: 'south.items.sqlite.serialization.compression',
            defaultValue: false,
            newRow: false,
            displayInViewMode: false,
            validators: [{ key: 'required' }]
          },
          {
            key: 'outputTimestampFormat',
            type: 'OibText',
            translationKey: 'south.items.sqlite.serialization.output-timestamp-format',
            defaultValue: 'yyyy-MM-dd HH:mm:ss.SSS',
            newRow: true,
            displayInViewMode: false,
            validators: [{ key: 'required' }]
          },
          {
            key: 'outputTimezone',
            type: 'OibTimezone',
            translationKey: 'south.items.sqlite.serialization.output-timezone',
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
