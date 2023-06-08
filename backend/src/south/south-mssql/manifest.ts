import { SouthConnectorManifest } from '../../../../shared/model/south-connector.model';

const manifest: SouthConnectorManifest = {
  id: 'mssql',
  name: 'MSSQL',
  category: 'database',
  description: 'Request Microsoft SQL Server databases with SQL queries',
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
      key: 'database',
      type: 'OibText',
      label: 'Database',
      defaultValue: 'db',
      newRow: true,
      validators: [{ key: 'required' }],
      readDisplay: true
    },
    {
      key: 'username',
      type: 'OibText',
      label: 'Username',
      readDisplay: true
    },
    {
      key: 'password',
      type: 'OibSecret',
      label: 'Password',
      newRow: false,
      readDisplay: false
    },
    {
      key: 'domain',
      type: 'OibText',
      label: 'Domain',
      newRow: false,
      readDisplay: true
    },
    {
      key: 'encryption',
      type: 'OibCheckbox',
      label: 'Use encryption',
      defaultValue: false,
      newRow: true,
      readDisplay: true
    },
    {
      key: 'trustServerCertificate',
      type: 'OibCheckbox',
      label: 'Trust server certificate',
      defaultValue: false,
      validators: [{ key: 'required' }],
      readDisplay: false
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
    },
    {
      key: 'requestTimeout',
      type: 'OibNumber',
      label: 'Request timeout (ms)',
      defaultValue: 1000,
      class: 'col-4',
      validators: [{ key: 'required' }, { key: 'min', params: { min: 100 } }, { key: 'max', params: { max: 30000 } }],
      readDisplay: false
    },
    {
      key: 'compression',
      type: 'OibCheckbox',
      label: 'Compress File?',
      defaultValue: false,
      newRow: true,
      validators: [{ key: 'required' }],
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
        class: 'col-8',
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
