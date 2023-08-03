import { SouthConnectorManifest } from '../../../../shared/model/south-connector.model';
import { proxy, serialization } from '../../../../shared/model/manifest-factory';

const manifest: SouthConnectorManifest = {
  id: 'oianalytics',
  name: 'OIAnalytics',
  category: 'api',
  description: 'Request time values from OIAnalytics',
  modes: {
    subscription: false,
    lastPoint: false,
    lastFile: false,
    history: true,
    forceMaxInstantPerItem: false
  },
  settings: [
    {
      key: 'host',
      type: 'OibText',
      label: 'URL',
      defaultValue: 'http://localhost',
      newRow: true,
      validators: [{ key: 'required' }, { key: 'pattern', params: { pattern: '^(http:\\/\\/|https:\\/\\/|HTTP:\\/\\/|HTTPS:\\/\\/).*' } }],
      displayInViewMode: true
    },
    {
      key: 'accessKey',
      type: 'OibText',
      label: 'Access key',
      validators: [{ key: 'required' }],
      displayInViewMode: true
    },
    {
      key: 'secretKey',
      type: 'OibSecret',
      label: 'Secret key',
      displayInViewMode: false
    },
    {
      key: 'timeout',
      type: 'OibNumber',
      label: 'Timeout',
      newRow: true,
      defaultValue: 30_000,
      unitLabel: 'ms',
      validators: [{ key: 'required' }]
    },
    ...proxy,
    {
      key: 'acceptUnauthorized',
      type: 'OibCheckbox',
      label: 'Accept unauthorized certificate',
      validators: [{ key: 'required' }],
      defaultValue: false,
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
        key: 'endpoint',
        type: 'OibText',
        label: 'Endpoint',
        defaultValue: '/endpoint',
        validators: [{ key: 'required' }]
      },
      {
        key: 'requestTimeout',
        type: 'OibNumber',
        label: 'Request timeout (ms)',
        defaultValue: 3000,
        class: 'col-2',
        newRow: false,
        validators: [{ key: 'required' }, { key: 'min', params: { min: 100 } }, { key: 'max', params: { max: 60_000 } }]
      },
      {
        key: 'queryParams',
        type: 'OibArray',
        label: 'Query params',
        content: [
          {
            key: 'key',
            label: 'Key',
            type: 'OibText',
            defaultValue: '',
            validators: [{ key: 'required' }],
            displayInViewMode: true
          },
          {
            key: 'value',
            label: 'Value',
            type: 'OibText',
            defaultValue: '',
            validators: [{ key: 'required' }],
            displayInViewMode: true
          }
        ],
        class: 'col',
        newRow: true,
        displayInViewMode: false
      },
      serialization
    ]
  }
};

export default manifest;
