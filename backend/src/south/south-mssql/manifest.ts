import { SouthConnectorManifest } from '../../../shared/model/south-connector.model';
import { buildDateTimeFieldsFormControl, buildSerializationFormControl } from '../../../shared/model/manifest-factory';

const manifest: SouthConnectorManifest = {
  id: 'mssql',
  name: 'MSSQL',
  category: 'database',
  description: 'Query Microsoft SQL Server™ databases',
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
      label: 'Throttling',
      class: 'col',
      newRow: true,
      displayInViewMode: false,
      validators: [{ key: 'required' }],
      content: [
        {
          key: 'maxReadInterval',
          type: 'OibNumber',
          label: 'Max read interval',
          validators: [{ key: 'required' }, { key: 'min', params: { min: 0 } }],
          defaultValue: 3600,
          unitLabel: 's',
          displayInViewMode: true
        },
        {
          key: 'readDelay',
          type: 'OibNumber',
          label: 'Read delay',
          validators: [{ key: 'required' }, { key: 'min', params: { min: 0 } }],
          defaultValue: 200,
          unitLabel: 'ms',
          displayInViewMode: true
        },
        {
          key: 'overlap',
          type: 'OibNumber',
          label: 'Overlap',
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
      label: 'Host',
      defaultValue: 'localhost',
      validators: [{ key: 'required' }],
      newRow: true,
      displayInViewMode: true
    },
    {
      key: 'port',
      type: 'OibNumber',
      label: 'Port',
      defaultValue: 1433,
      class: 'col-2',
      validators: [{ key: 'required' }, { key: 'min', params: { min: 1 } }, { key: 'max', params: { max: 65535 } }],
      displayInViewMode: true
    },
    {
      key: 'connectionTimeout',
      type: 'OibNumber',
      label: 'Connection timeout',
      defaultValue: 1000,
      unitLabel: 'ms',
      class: 'col-3',
      validators: [{ key: 'required' }, { key: 'min', params: { min: 100 } }, { key: 'max', params: { max: 30000 } }],
      displayInViewMode: false
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
      displayInViewMode: false
    },
    {
      key: 'domain',
      type: 'OibText',
      label: 'Domain',
      displayInViewMode: true
    },
    {
      key: 'encryption',
      type: 'OibCheckbox',
      label: 'Use encryption',
      defaultValue: false,
      validators: [{ key: 'required' }],
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
      key: 'requestTimeout',
      type: 'OibNumber',
      label: 'Request timeout',
      defaultValue: 15_000,
      unitLabel: 'ms',
      class: 'col-4',
      newRow: true,
      validators: [{ key: 'required' }, { key: 'min', params: { min: 100 } }, { key: 'max', params: { max: 3_600_000 } }],
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
        defaultValue:
          'SELECT level, message, timestamp, scope_name as scopeName FROM logs WHERE timestamp > @StartTime AND timestamp <= @EndTime',
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
      buildSerializationFormControl(['csv'])
    ]
  }
};

export default manifest;
