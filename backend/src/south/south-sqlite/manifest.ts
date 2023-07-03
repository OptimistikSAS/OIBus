import { SouthConnectorManifest } from '../../../../shared/model/south-connector.model';

const manifest: SouthConnectorManifest = {
  id: 'sqlite',
  name: 'SQLite',
  category: 'database',
  description: 'Request SQLite databases with SQL queries',
  modes: {
    subscription: false,
    lastPoint: false,
    lastFile: false,
    history: true
  },
  settings: [
    {
      key: 'databasePath',
      type: 'OibText',
      label: 'Database path',
      defaultValue: './test.db',
      newRow: true,
      validators: [{ key: 'required' }],
      readDisplay: true
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
        label: 'Query',
        contentType: 'sql',
        defaultValue: 'SELECT * FROM Table WHERE timestamp > @StartTime',
        class: 'col-12 text-nowrap',
        validators: [{ key: 'required' }],
        readDisplay: true
      },
      {
        key: 'dateTimeFields',
        type: 'OibFormArray',
        label: 'Date time fields',
        content: [
          {
            key: 'fieldName',
            label: 'Field name',
            type: 'OibText',
            defaultValue: '',
            validators: [{ key: 'required' }],
            readDisplay: true
          },
          {
            key: 'useAsReference',
            label: 'Reference field',
            type: 'OibCheckbox',
            defaultValue: false,
            readDisplay: true,
            validators: [{ key: 'required' }]
          },
          {
            key: 'type',
            label: 'Type',
            type: 'OibSelect',
            defaultValue: 'string',
            options: ['string', 'iso-string', 'unix-epoch', 'unix-epoch-ms'],
            validators: [{ key: 'required' }]
          },
          {
            key: 'timezone',
            label: 'Timezone',
            type: 'OibTimezone',
            validators: [{ key: 'required' }],
            conditionalDisplay: { field: 'type', values: ['string'] }
          },
          {
            key: 'format',
            label: 'Format',
            type: 'OibText',
            validators: [{ key: 'required' }],
            conditionalDisplay: { field: 'type', values: ['string'] }
          },
          {
            key: 'locale',
            label: 'Locale',
            defaultValue: 'en-En',
            type: 'OibText',
            validators: [{ key: 'required' }],
            conditionalDisplay: { field: 'type', values: ['string'] }
          }
        ],
        class: 'col',
        newRow: true,
        readDisplay: false
      },
      {
        key: 'serialization',
        type: 'OibFormGroup',
        label: 'Serialization',
        class: 'col',
        newRow: true,
        readDisplay: false,
        content: [
          {
            key: 'type',
            type: 'OibSelect',
            label: 'Type',
            options: ['csv', 'json'],
            defaultValue: 'csv',
            newRow: true,
            readDisplay: false
          },
          {
            key: 'filename',
            type: 'OibText',
            label: 'Filename',
            defaultValue: 'sql.csv',
            newRow: false,
            readDisplay: false
          },
          {
            key: 'delimiter',
            type: 'OibSelect',
            label: 'Delimiter',
            options: ['DOT', 'SEMI_COLON', 'COLON', 'COMMA', 'NON_BREAKING_SPACE', 'SLASH', 'TAB', 'PIPE'],
            defaultValue: ',',
            newRow: false,
            readDisplay: false
          },
          {
            key: 'compression',
            type: 'OibCheckbox',
            label: 'Compression',
            defaultValue: false,
            newRow: false,
            readDisplay: false
          },
          {
            key: 'outputTimestampFormat',
            type: 'OibText',
            label: 'Output date time format',
            defaultValue: 'yyyy-MM-dd HH:mm:ss.SSS',
            newRow: true,
            readDisplay: false
          },
          {
            key: 'outputTimezone',
            type: 'OibTimezone',
            label: 'Timezone',
            defaultValue: 'Europe/Paris',
            newRow: false,
            readDisplay: false
          }
        ]
      }
    ]
  }
};

export default manifest;
