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
        label: 'Datetime type',
        defaultValue: {
          type: 'string',
          format: 'yyyy-MM-dd HH:mm:ss.SSS',
          timezone: 'UTC',
          locale: 'en-US',
          field: 'timestamp'
        },
        class: 'col',
        newRow: true,
        readDisplay: false
      },
      {
        key: 'filename',
        class: 'col-4',
        newRow: true,
        type: 'OibText',
        label: 'Filename',
        defaultValue: 'sql-@CurrentDate.csv',
        readDisplay: true
      },
      {
        key: 'delimiter',
        class: 'col-4',
        type: 'OibSelect',
        options: [',', ';', '|'],
        label: 'Delimiter',
        defaultValue: ',',
        readDisplay: false
      }
    ]
  }
};

export default manifest;
