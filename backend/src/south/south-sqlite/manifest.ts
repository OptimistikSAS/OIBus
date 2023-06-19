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
        type: 'OibDateTimeFields',
        label: 'Date time fields',
        class: 'col',
        newRow: true,
        readDisplay: false
      },
      {
        key: 'serialization',
        type: 'OibSerialization',
        label: 'Serialization',
        class: 'col',
        newRow: true,
        readDisplay: false
      }
    ]
  }
};

export default manifest;
