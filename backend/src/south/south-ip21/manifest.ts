import { SouthConnectorManifest } from '../../../../shared/model/south-connector.model';

const manifest: SouthConnectorManifest = {
  id: 'ip21',
  name: 'IP21',
  category: 'database',
  description: 'Request AspenTech IP21 databases with the AspenTech SQL plus ODBC driver',
  modes: {
    subscription: false,
    lastPoint: false,
    lastFile: false,
    history: true
  },
  settings: [
    {
      key: 'host',
      type: 'OibText',
      label: 'Host',
      defaultValue: 'localhost',
      newRow: true,
      validators: [{ key: 'required' }],
      readDisplay: true
    },
    {
      key: 'port',
      type: 'OibNumber',
      label: 'Port',
      defaultValue: 1433,
      newRow: false,
      class: 'col-2',
      validators: [{ key: 'required' }, { key: 'min', params: { min: 1 } }, { key: 'max', params: { max: 65535 } }],
      readDisplay: true
    },
    {
      key: 'connectionTimeout',
      type: 'OibNumber',
      label: 'Connection timeout (ms)',
      defaultValue: 1000,
      newRow: true,
      class: 'col-4',
      validators: [{ key: 'required' }, { key: 'min', params: { min: 100 } }, { key: 'max', params: { max: 30000 } }],
      readDisplay: false
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
        allowedDateObjectTypes: [],
        class: 'col',
        newRow: true,
        readDisplay: false
      },
      {
        key: 'serialization',
        type: 'FormGroup',
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
            options: [',', ';'],
            newRow: false,
            readDisplay: false
          },
          {
            key: 'outputDateTimeFormat',
            type: 'OibText',
            label: 'Output date time format',
            defaultValue: 'yyyy-MM-dd HH:mm:ss.SSS',
            newRow: false,
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
