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
    },
    {
      key: 'compression',
      type: 'OibCheckbox',
      label: 'Compress File?',
      defaultValue: false,
      validators: [{ key: 'required' }],
      readDisplay: false,
      newRow: true
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
        key: 'dateTimeFormat',
        type: 'OibDateTimeFormat',
        label: 'Input binding (@StartTime or @EndTime)',
        defaultValue: {
          type: 'string',
          format: 'yyyy-MM-dd HH:mm:ss.SSS',
          timezone: 'UTC',
          locale: 'en-US',
          field: 'timestamp'
        },
        conditionalDisplay: { query: '@StartTime|@EndTime' },
        class: 'col',
        newRow: true,
        readDisplay: false
      },
      {
        key: 'serialization',
        type: 'OibSerialization',
        label: 'Serialization',
        defaultValue: {
          type: 'file',
          filename: 'sql-@CurrentDate.csv',
          delimiter: 'COMMA'
        },
        class: 'col',
        newRow: true,
        readDisplay: false
      }
    ]
  }
};

export default manifest;
