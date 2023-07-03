import { SouthConnectorManifest } from '../../../../shared/model/south-connector.model';

const manifest: SouthConnectorManifest = {
  id: 'opc-hda',
  name: 'OPC HDA',
  category: 'iot',
  description: 'Retrieve data from OPC HDA server through COM/DCOM communication ports (Windows only)',
  modes: {
    subscription: false,
    lastPoint: false,
    lastFile: false,
    history: true
  },
  settings: [
    {
      key: 'agentFilename',
      type: 'OibText',
      label: 'Agent file path',
      defaultValue: '\\HdaAgent\\HdaAgent.exe',
      newRow: true,
      validators: [{ key: 'required' }],
      displayInViewMode: true
    },
    {
      key: 'tcpPort',
      type: 'OibNumber',
      label: 'HDA Agent Port',
      defaultValue: 2224,
      newRow: false,
      validators: [{ key: 'required' }, { key: 'min', params: { min: 1 } }, { key: 'max', params: { max: 65535 } }],
      displayInViewMode: true
    },
    {
      key: 'logLevel',
      type: 'OibSelect',
      label: 'Agent log level',
      options: ['trace', 'debug', 'info', 'warning', 'error'],
      defaultValue: 'debug',
      newRow: false,
      validators: [{ key: 'required' }],
      displayInViewMode: false
    },
    {
      key: 'host',
      type: 'OibText',
      label: 'Host',
      newRow: true,
      validators: [{ key: 'required' }],
      displayInViewMode: false
    },
    {
      key: 'serverName',
      type: 'OibText',
      label: 'Server name',
      newRow: false,
      validators: [{ key: 'required' }],
      displayInViewMode: false
    },
    {
      key: 'readTimeout',
      type: 'OibNumber',
      label: 'Read timeout (ms)',
      defaultValue: 180_000,
      newRow: true,
      validators: [{ key: 'required' }, { key: 'min', params: { min: 100 } }, { key: 'max', params: { max: 3_600_000 } }],
      displayInViewMode: false
    },
    {
      key: 'retryInterval',
      type: 'OibNumber',
      label: 'Retry interval (ms)',
      defaultValue: 10_000,
      newRow: false,
      validators: [{ key: 'required' }, { key: 'min', params: { min: 100 } }, { key: 'max', params: { max: 3_600_000 } }],
      displayInViewMode: false
    },
    {
      key: 'maxReturnValues',
      type: 'OibNumber',
      label: 'Max return values',
      defaultValue: 1000,
      newRow: false,
      validators: [{ key: 'required' }],
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
        key: 'aggregate',
        type: 'OibSelect',
        label: 'Aggregate',
        options: ['Raw', 'Average', 'Minimum', 'Maximum', 'Count'],
        defaultValue: 'Raw',
        validators: [{ key: 'required' }],
        displayInViewMode: true
      },
      {
        key: 'resampling',
        type: 'OibSelect',
        label: 'Resampling',
        options: ['None', 'Second', '10 Seconds', '30 Seconds', 'Minute', 'Hour', 'Day'],
        defaultValue: 'None',
        displayInViewMode: true
      },
      {
        key: 'nodeId',
        type: 'OibText',
        label: 'Node ID',
        validators: [{ key: 'required' }],
        displayInViewMode: true
      }
    ]
  }
};
export default manifest;
