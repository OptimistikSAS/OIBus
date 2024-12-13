import { SouthConnectorManifest } from '../../../shared/model/south-connector.model';
import { buildDateTimeFieldsFormControl, buildSerializationFormControl } from '../../../shared/model/manifest-factory';

const manifest: SouthConnectorManifest = {
  id: 'odbc',
  name: 'ODBC',
  category: 'database',
  description: 'Query SQL databases with an ODBC driver or OIBus Agent',
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
      key: 'remoteAgent',
      type: 'OibCheckbox',
      label: 'Use remote agent',
      defaultValue: false,
      newRow: true,
      class: 'col-3',
      validators: [{ key: 'required' }],
      displayInViewMode: true
    },
    {
      key: 'agentUrl',
      type: 'OibText',
      label: 'Remote agent URL',
      defaultValue: 'http://ip-adress-or-host:2224',
      class: 'col-9',
      validators: [{ key: 'required' }],
      conditionalDisplay: { field: 'remoteAgent', values: [true] }
    },
    {
      key: 'connectionTimeout',
      type: 'OibNumber',
      label: 'Connection timeout',
      defaultValue: 15_000,
      unitLabel: 'ms',
      newRow: true,
      class: 'col-4',
      validators: [{ key: 'required' }, { key: 'min', params: { min: 100 } }, { key: 'max', params: { max: 30_000 } }]
    },
    {
      key: 'retryInterval',
      type: 'OibNumber',
      label: 'Retry interval',
      defaultValue: 10_000,
      unitLabel: 'ms',
      class: 'col-4',
      validators: [{ key: 'required' }, { key: 'min', params: { min: 100 } }, { key: 'max', params: { max: 30_000 } }]
    },
    {
      key: 'requestTimeout',
      type: 'OibNumber',
      label: 'Request timeout',
      defaultValue: 15_000,
      unitLabel: 'ms',
      class: 'col-4',
      validators: [{ key: 'required' }, { key: 'min', params: { min: 100 } }, { key: 'max', params: { max: 3_600_000 } }],
      conditionalDisplay: { field: 'remoteAgent', values: [true] }
    },
    {
      key: 'connectionString',
      type: 'OibText',
      label: 'Connection string',
      defaultValue: 'localhost',
      newRow: true,
      validators: [{ key: 'required' }],
      class: 'col-9',
      displayInViewMode: true
    },
    {
      key: 'password',
      type: 'OibSecret',
      label: 'Password',
      class: 'col-3',
      newRow: false,
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
      buildDateTimeFieldsFormControl(['string', 'iso-string', 'unix-epoch', 'unix-epoch-ms']),
      buildSerializationFormControl(['csv'])
    ]
  }
};

export default manifest;
