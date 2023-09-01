import { SouthConnectorManifest } from '../../../../shared/model/south-connector.model';
import { buildSerializationFormControl, proxy } from '../../../../shared/model/manifest-factory';

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
      validators: [{ key: 'required' }, { key: 'pattern', params: { pattern: '^(http:\\/\\/|https:\\/\\/|HTTP:\\/\\/|HTTPS:\\/\\/).*' } }],
      displayInViewMode: true
    },
    {
      key: 'acceptUnauthorized',
      type: 'OibCheckbox',
      label: 'Accept unauthorized certificate',
      validators: [{ key: 'required' }],
      defaultValue: false,
      displayInViewMode: true
    },
    {
      key: 'accessKey',
      type: 'OibText',
      label: 'Access key',
      newRow: true,
      validators: [{ key: 'required' }],
      displayInViewMode: true
    },
    {
      key: 'secretKey',
      type: 'OibSecret',
      label: 'Secret key',
      displayInViewMode: false
    },
    ...proxy
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
      buildSerializationFormControl(['csv'])
    ]
  }
};

export default manifest;
