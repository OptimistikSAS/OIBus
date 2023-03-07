import { SouthConnectorManifest } from '../../../../shared/model/south-connector.model';

const manifest: SouthConnectorManifest = {
  name: 'OPCHDA',
  category: 'iot',
  description: 'OPCHDA description',
  modes: {
    subscription: false,
    lastPoint: false,
    lastFile: false,
    historyPoint: true,
    historyFile: false
  },
  settings: [
    {
      key: 'agentFilename',
      type: 'OibText',
      label: 'Agent file path',
      defaultValue: '\\HdaAgent\\HdaAgent.exe',
      newRow: true,
      validators: [{ key: 'required' }],
      readDisplay: true
    },
    {
      key: 'tcpPort',
      type: 'OibNumber',
      label: 'HDA Agent Port',
      defaultValue: 2224,
      newRow: false,
      validators: [{ key: 'required' }, { key: 'min', params: { min: 1 } }, { key: 'max', params: { max: 65535 } }],
      readDisplay: true
    },
    {
      key: 'logLevel',
      type: 'OibSelect',
      label: 'Agent log level',
      options: ['trace', 'debug', 'info', 'warning', 'error'],
      defaultValue: 'debug',
      newRow: false,
      validators: [{ key: 'required' }],
      readDisplay: false
    },
    {
      key: 'host',
      type: 'OibText',
      label: 'Host',
      newRow: true,
      validators: [{ key: 'required' }],
      readDisplay: false
    },
    {
      key: 'serverName',
      type: 'OibText',
      label: 'Server name',
      newRow: false,
      validators: [{ key: 'required' }],
      readDisplay: false
    },
    {
      key: 'readTimeout',
      type: 'OibNumber',
      label: 'Read timeout (ms)',
      defaultValue: 180_000,
      newRow: true,
      validators: [{ key: 'required' }, { key: 'min', params: { min: 100 } }, { key: 'max', params: { max: 3_600_000 } }],
      readDisplay: false
    },
    {
      key: 'retryInterval',
      type: 'OibNumber',
      label: 'Retry interval (ms)',
      defaultValue: 10_000,
      newRow: false,
      validators: [{ key: 'required' }, { key: 'min', params: { min: 100 } }, { key: 'max', params: { max: 3_600_000 } }],
      readDisplay: false
    },
    {
      key: 'maxReadInterval',
      type: 'OibNumber',
      label: 'Max read interval (s)',
      newRow: true,
      validators: [{ key: 'required' }],
      readDisplay: false
    },
    {
      key: 'readIntervalDelay',
      type: 'OibNumber',
      label: 'Read interval delay (ms)',
      defaultValue: 200,
      newRow: false,
      validators: [{ key: 'required' }, { key: 'min', params: { min: 100 } }, { key: 'max', params: { max: 3_600_000 } }],
      readDisplay: false
    },
    {
      key: 'maxReturnValues',
      type: 'OibNumber',
      label: 'Max return values',
      defaultValue: 1000,
      newRow: false,
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
        key: 'aggregate',
        type: 'OibSelect',
        label: 'Aggregate',
        options: ['Raw', 'Average', 'Minimum', 'Maximum', 'Count'],
        defaultValue: 'Raw',
        validators: [{ key: 'required' }],
        readDisplay: true
      },
      {
        key: 'resampling',
        type: 'OibSelect',
        label: 'Resampling',
        options: ['None', 'Second', '10 Seconds', '30 Seconds', 'Minute', 'Hour', 'Day'],
        defaultValue: 'None',
        readDisplay: true
      },
      {
        key: 'nodeId',
        type: 'OibText',
        label: 'Node ID',
        validators: [{ key: 'required' }],
        readDisplay: true
      }
    ]
  }
};
export default manifest;
