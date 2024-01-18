import { SouthConnectorManifest } from '../../../../shared/model/south-connector.model';
import { buildDateTimeFieldsFormControl, buildSerializationFormControl } from '../../../../shared/model/manifest-factory';

const manifest: SouthConnectorManifest = {
  id: 'oracle',
  name: 'Oracle',
  category: 'database',
  description: 'Request Oracle databases with SQL queries',
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
      validators: [{ key: 'required' }],
      displayInViewMode: true
    },
    {
      key: 'port',
      type: 'OibNumber',
      label: 'Port',
      defaultValue: 1521,
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
      label: 'Username'
    },
    {
      key: 'password',
      type: 'OibSecret',
      label: 'Password'
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
      {
        key: 'requestTimeout',
        type: 'OibNumber',
        label: 'Request timeout',
        defaultValue: 1000,
        class: 'col-4',
        unitLabel: 'ms',
        newRow: true,
        validators: [{ key: 'required' }, { key: 'min', params: { min: 100 } }, { key: 'max', params: { max: 3_600_000 } }],
        displayInViewMode: false
      },
      buildDateTimeFieldsFormControl(['string', 'iso-string', 'unix-epoch', 'unix-epoch-ms']),
      buildSerializationFormControl(['csv'])
    ]
  }
};

export default manifest;
