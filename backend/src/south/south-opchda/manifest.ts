import { SouthConnectorManifest } from '../../../shared/model/south-connector.model';

const manifest: SouthConnectorManifest = {
  id: 'opc-hda',
  name: 'OPC HDA',
  category: 'iot',
  description: 'Connect to OIBus agent to retrieve data from OPC HDA server through COM/DCOM communication ports',
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
      displayInViewMode: true,
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
        },
        {
          key: 'maxInstantPerItem',
          type: 'OibCheckbox',
          label: 'Max instant per item',
          defaultValue: false,
          validators: [{ key: 'required' }],
          displayInViewMode: true
        }
      ]
    },
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
      label: 'Retry interval',
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
      class: 'col-7',
      newRow: true,
      validators: [{ key: 'required' }],
      displayInViewMode: true
    },
    {
      key: 'serverName',
      type: 'OibText',
      label: 'Server name',
      defaultValue: 'Matrikon.OPC.Simulation',
      class: 'col-5',
      newRow: false,
      validators: [{ key: 'required' }],
      displayInViewMode: true
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
        options: [
          'raw',
          'interpolative',
          'total',
          'average',
          'time-average',
          'count',
          'stdev',
          'minimum-actual-time',
          'minimum',
          'maximum-actual-time',
          'maximum',
          'start',
          'end',
          'delta',
          'reg-slope',
          'reg-const',
          'reg-dev',
          'variance',
          'range',
          'duration-good',
          'duration-bad',
          'percent-good',
          'percent-bad',
          'worst-quality',
          'annotations'
        ],
        defaultValue: 'raw',
        validators: [{ key: 'required' }],
        displayInViewMode: true
      },
      {
        key: 'resampling',
        type: 'OibSelect',
        label: 'Resampling',
        pipe: 'resampling',
        options: ['none', '1s', '10s', '30s', '1min', '1h', '1d'],
        defaultValue: 'none',
        validators: [{ key: 'required' }],
        conditionalDisplay: {
          field: 'aggregate',
          values: [
            'interpolative',
            'total',
            'average',
            'time-average',
            'count',
            'stdev',
            'minimum-actual-time',
            'minimum',
            'maximum-actual-time',
            'maximum',
            'start',
            'end',
            'delta',
            'reg-slope',
            'reg-const',
            'reg-dev',
            'variance',
            'range',
            'duration-good',
            'duration-bad',
            'percent-good',
            'percent-bad',
            'worst-quality'
          ]
        },
        displayInViewMode: true
      }
    ]
  }
};
export default manifest;
