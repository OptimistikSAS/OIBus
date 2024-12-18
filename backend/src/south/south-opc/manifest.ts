import { SouthConnectorManifest } from '../../../shared/model/south-connector.model';

const manifest: SouthConnectorManifest = {
  id: 'opc',
  category: 'iot',
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
      translationKey: 'south.opc.throttling.title',
      class: 'col',
      newRow: true,
      displayInViewMode: false,
      validators: [{ key: 'required' }],
      content: [
        {
          key: 'maxReadInterval',
          type: 'OibNumber',
          translationKey: 'south.opc.throttling.max-read-interval',
          validators: [{ key: 'required' }, { key: 'min', params: { min: 0 } }],
          defaultValue: 3600,
          unitLabel: 's',
          displayInViewMode: true
        },
        {
          key: 'readDelay',
          type: 'OibNumber',
          translationKey: 'south.opc.throttling.read-delay',
          validators: [{ key: 'required' }, { key: 'min', params: { min: 0 } }],
          defaultValue: 200,
          unitLabel: 'ms',
          displayInViewMode: true
        },
        {
          key: 'overlap',
          type: 'OibNumber',
          translationKey: 'south.opc.throttling.overlap',
          validators: [{ key: 'required' }, { key: 'min', params: { min: 0 } }],
          defaultValue: 0,
          unitLabel: 'ms',
          displayInViewMode: true
        },
        {
          key: 'maxInstantPerItem',
          type: 'OibCheckbox',
          translationKey: 'south.opc.throttling.max-instant-per-item',
          defaultValue: false,
          validators: [{ key: 'required' }],
          displayInViewMode: true
        }
      ]
    },
    {
      key: 'agentUrl',
      type: 'OibText',
      translationKey: 'south.opc.agent-url',
      defaultValue: 'http://ip-adress-or-host:2224',
      validators: [{ key: 'required' }],
      newRow: true,
      displayInViewMode: true
    },
    {
      key: 'retryInterval',
      type: 'OibNumber',
      translationKey: 'south.opc.retry-interval',
      defaultValue: 10_000,
      unitLabel: 'ms',
      class: 'col-3',
      validators: [{ key: 'required' }, { key: 'min', params: { min: 100 } }, { key: 'max', params: { max: 30_000 } }]
    },
    {
      key: 'host',
      type: 'OibText',
      translationKey: 'south.opc.host',
      defaultValue: 'localhost',
      class: 'col-7',
      newRow: true,
      validators: [{ key: 'required' }],
      displayInViewMode: true
    },
    {
      key: 'serverName',
      type: 'OibText',
      translationKey: 'south.opc.server-name',
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
        translationKey: 'south.items.opc.node-id',
        validators: [{ key: 'required' }],
        displayInViewMode: true
      },
      {
        key: 'aggregate',
        type: 'OibSelect',
        translationKey: 'south.items.opc.aggregate',
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
        translationKey: 'south.items.opc.resampling',
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
