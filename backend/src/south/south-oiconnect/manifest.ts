import { SouthConnectorManifest } from '../../../../shared/model/south-connector.model';

const manifest: SouthConnectorManifest = {
  id: 'oiconnect',
  name: 'OIConnect',
  category: 'api',
  description: 'REST API connector to fetch data from HTTP endpoints',
  modes: {
    subscription: false,
    lastPoint: false,
    lastFile: false,
    history: true
  },
  settings: [
    {
      key: 'url',
      type: 'OibText',
      label: 'URL',
      defaultValue: 'http://localhost',
      newRow: true,
      validators: [{ key: 'required' }, { key: 'pattern', params: { pattern: '^(http:\\/\\/|https:\\/\\/|HTTP:\\/\\/|HTTPS:\\/\\/).*' } }],
      readDisplay: true
    },
    {
      key: 'port',
      type: 'OibNumber',
      label: 'Port',
      defaultValue: 80,
      newRow: false,
      validators: [{ key: 'required' }, { key: 'min', params: { min: 1 } }, { key: 'max', params: { max: 65535 } }]
    },
    {
      key: 'acceptSelfSigned',
      type: 'OibCheckbox',
      label: 'Accept rejected certificates?',
      defaultValue: false,
      newRow: false,
      validators: [{ key: 'required' }],
      class: 'col-4'
    },
    {
      key: 'authentication',
      type: 'OibAuthentication',
      label: 'Authentication',
      newRow: true,
      authTypes: ['none', 'basic', 'bearer', 'api-key']
    }
  ],
  items: {
    scanMode: {
      acceptSubscription: false,
      subscriptionOnly: false
    },
    settings: [
      {
        key: 'requestMethod',
        type: 'OibSelect',
        options: ['GET', 'POST', 'PUT', 'PATCH'],
        label: 'HTTP Method',
        defaultValue: 'GET',
        newRow: false,
        validators: [{ key: 'required' }]
      },
      {
        key: 'endpoint',
        type: 'OibText',
        label: 'Endpoint',
        defaultValue: '/endpoint',
        validators: [{ key: 'required' }]
      },
      {
        key: 'payloadParser',
        type: 'OibSelect',
        label: 'Payload parser',
        options: ['raw', 'oianalytics-time-values', 'slims'],
        defaultValue: 'raw',
        class: 'col-4',
        newRow: true,
        validators: [{ key: 'required' }]
      },
      {
        key: 'requestTimeout',
        type: 'OibNumber',
        label: 'Request timeout (ms)',
        defaultValue: 3000,
        class: 'col-2',
        validators: [{ key: 'required' }, { key: 'min', params: { min: 100 } }, { key: 'max', params: { max: 60_000 } }]
      },
      {
        key: 'body',
        type: 'OibCodeBlock',
        label: 'Body',
        contentType: 'json',
        defaultValue: '',
        newRow: true
      }
    ]
  }
};

export default manifest;
