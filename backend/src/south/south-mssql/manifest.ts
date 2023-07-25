import { SouthConnectorManifest } from '../../../../shared/model/south-connector.model';
import { buildDateTimeFieldsFormControl, serialization } from '../../../../shared/model/manifest-factory';

const manifest: SouthConnectorManifest = {
  id: 'mssql',
  name: 'MSSQL',
  category: 'database',
  description: 'Request Microsoft SQL Server databases with SQL queries',
  modes: {
    subscription: false,
    lastPoint: false,
    lastFile: false,
    history: true,
    forceMaxInstantPerItem: true
  },
  settings: [
    {
      key: 'host',
      type: 'OibText',
      label: 'Host',
      defaultValue: 'localhost',
      newRow: true,
      validators: [{ key: 'required' }],
      displayInViewMode: true
    },
    {
      key: 'port',
      type: 'OibNumber',
      label: 'Port',
      defaultValue: 1433,
      newRow: false,
      class: 'col-2',
      validators: [{ key: 'required' }, { key: 'min', params: { min: 1 } }, { key: 'max', params: { max: 65535 } }],
      displayInViewMode: true
    },
    {
      key: 'database',
      type: 'OibText',
      label: 'Database',
      defaultValue: 'db',
      newRow: true,
      validators: [{ key: 'required' }],
      displayInViewMode: true
    },
    {
      key: 'username',
      type: 'OibText',
      label: 'Username',
      displayInViewMode: true
    },
    {
      key: 'password',
      type: 'OibSecret',
      label: 'Password',
      newRow: false,
      displayInViewMode: false
    },
    {
      key: 'domain',
      type: 'OibText',
      label: 'Domain',
      newRow: false,
      displayInViewMode: true
    },
    {
      key: 'encryption',
      type: 'OibCheckbox',
      label: 'Use encryption',
      defaultValue: false,
      newRow: true,
      displayInViewMode: true
    },
    {
      key: 'trustServerCertificate',
      type: 'OibCheckbox',
      label: 'Trust server certificate',
      defaultValue: false,
      validators: [{ key: 'required' }],
      displayInViewMode: false
    },
    {
      key: 'connectionTimeout',
      type: 'OibNumber',
      label: 'Connection timeout',
      defaultValue: 1000,
      unitLabel: 'ms',
      newRow: true,
      class: 'col-4',
      validators: [{ key: 'required' }, { key: 'min', params: { min: 100 } }, { key: 'max', params: { max: 30000 } }],
      displayInViewMode: false
    },
    {
      key: 'requestTimeout',
      type: 'OibNumber',
      label: 'Request timeout',
      defaultValue: 15_000,
      unitLabel: 'ms',
      class: 'col-4',
      validators: [{ key: 'required' }, { key: 'min', params: { min: 100 } }, { key: 'max', params: { max: 30000 } }],
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
        label: 'Query',
        contentType: 'sql',
        defaultValue: 'SELECT * FROM Table WHERE timestamp > @StartTime',
        class: 'col-12 text-nowrap',
        validators: [{ key: 'required' }],
        displayInViewMode: true
      },
      buildDateTimeFieldsFormControl([
        'string',
        'Date',
        'DateTime',
        'DateTime2',
        'DateTimeOffset',
        'SmallDateTime',
        'iso-string',
        'unix-epoch',
        'unix-epoch-ms'
      ]),
      serialization
    ]
  }
};

export default manifest;
