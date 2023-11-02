import { SouthConnectorManifest } from '../../../../shared/model/south-connector.model';

const manifest: SouthConnectorManifest = {
  id: 'opc-hda',
  name: 'OPC HDA',
  category: 'iot',
  description: 'Connect to OIBus agent to retrieve data from OPC HDA server through COM/DCOM communication ports',
  modes: {
    subscription: false,
    lastPoint: false,
    lastFile: false,
    history: true,
    forceMaxInstantPerItem: false
  },
  settings: [
    {
      key: 'agentUrl',
      type: 'OibText',
      label: 'Remote agent URL',
      defaultValue: 'http://ip-adress-or-host:2224',
      validators: [{ key: 'required' }],
      displayInViewMode: true
    },
    {
      key: 'retryInterval',
      type: 'OibNumber',
      label: 'Connection timeout',
      defaultValue: 1000,
      unitLabel: 'ms',
      class: 'col-3',
      validators: [{ key: 'required' }, { key: 'min', params: { min: 100 } }, { key: 'max', params: { max: 30_000 } }]
    },
    {
      key: 'host',
      type: 'OibText',
      label: 'Server URL (from the agent)',
      defaultValue: 'localhost',
      class: 'col-4',
      newRow: true,
      validators: [{ key: 'required' }],
      displayInViewMode: true
    },
    {
      key: 'serverName',
      type: 'OibText',
      label: 'Server name',
      defaultValue: 'Matrikon.OPC.Simulation',
      class: 'col-4',
      newRow: false,
      validators: [{ key: 'required' }],
      displayInViewMode: true
    },
    {
      key: 'readTimeout',
      type: 'OibNumber',
      label: 'Read timeout (s)',
      defaultValue: 180,
      class: 'col-2',
      newRow: false,
      validators: [{ key: 'required' }, { key: 'min', params: { min: 100 } }, { key: 'max', params: { max: 3_600_000 } }],
      displayInViewMode: false
    },
    {
      key: 'maxReturnValues',
      type: 'OibNumber',
      label: 'Max return values',
      defaultValue: 1000,
      class: 'col-2',
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
        key: 'nodeId',
        type: 'OibText',
        label: 'Node ID',
        validators: [{ key: 'required' }],
        displayInViewMode: true
      },
      {
        key: 'aggregate',
        type: 'OibSelect',
        label: 'Aggregate',
        pipe: 'aggregates',
        options: ['raw', 'average', 'minimum', 'maximum'],
        defaultValue: 'raw',
        validators: [{ key: 'required' }],
        displayInViewMode: true
      },
      {
        key: 'resampling',
        type: 'OibSelect',
        label: 'Resampling',
        pipe: 'resampling',
        options: ['none', 'second', '10Seconds', '30Seconds', 'minute', 'hour', 'day'],
        defaultValue: 'none',
        validators: [{ key: 'required' }],
        conditionalDisplay: { field: 'aggregate', values: ['average', 'minimum', 'maximum', 'count'] },
        displayInViewMode: true
      }
    ]
  }
};
export default manifest;
