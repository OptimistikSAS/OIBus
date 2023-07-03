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
      displayInViewMode: true
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
      type: 'OibFormGroup',
      label: 'Authentication',
      class: 'col',
      newRow: true,
      displayInViewMode: false,
      validators: [{ key: 'required' }],
      content: [
        {
          key: 'type',
          type: 'OibSelect',
          label: 'Type',
          options: ['none', 'basic', 'bearer', 'api-key'],
          defaultValue: 'none',
          newRow: true,
          displayInViewMode: false
        },
        {
          key: 'username',
          type: 'OibText',
          label: 'Username',
          defaultValue: '',
          validators: [{ key: 'required' }],
          conditionalDisplay: { field: 'type', values: ['basic'] },
          displayInViewMode: false
        },
        {
          key: 'password',
          type: 'OibSecret',
          label: 'Password',
          defaultValue: '',
          validators: [{ key: 'required' }],
          conditionalDisplay: { field: 'type', values: ['basic'] },
          displayInViewMode: false
        },
        {
          key: 'token',
          type: 'OibSecret',
          label: 'Token',
          defaultValue: '',
          conditionalDisplay: { field: 'type', values: ['bearer'] },
          validators: [{ key: 'required' }],
          newRow: false,
          displayInViewMode: false
        },
        {
          key: 'apiKeyHeader',
          type: 'OibSecret',
          label: 'Api key header',
          defaultValue: '',
          conditionalDisplay: { field: 'type', values: ['api-key'] },
          newRow: false,
          displayInViewMode: false
        },
        {
          key: 'apiKey',
          type: 'OibSecret',
          label: 'Api key',
          defaultValue: '',
          conditionalDisplay: { field: 'type', values: ['api-key'] },
          newRow: false,
          displayInViewMode: false
        }
      ]
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
      },
      {
        key: 'timestampFormat',
        label: 'Format',
        type: 'OibText',
        validators: [{ key: 'required' }],
        conditionalDisplay: { field: 'type', values: ['string'] },
        newRow: true
      },
      {
        key: 'timezone',
        label: 'Timezone',
        type: 'OibTimezone',
        validators: [{ key: 'required' }],
        conditionalDisplay: { field: 'type', values: ['string'] }
      },
      {
        key: 'locale',
        label: 'Locale',
        defaultValue: 'en-En',
        type: 'OibText',
        validators: [{ key: 'required' }],
        conditionalDisplay: { field: 'type', values: ['string'] }
      },
      {
        key: 'serialization',
        type: 'OibFormGroup',
        label: 'Serialization',
        class: 'col',
        newRow: true,
        displayInViewMode: false,
        content: [
          {
            key: 'type',
            type: 'OibSelect',
            label: 'Type',
            options: ['csv', 'json'],
            defaultValue: 'csv',
            newRow: true,
            displayInViewMode: false
          },
          {
            key: 'filename',
            type: 'OibText',
            label: 'Filename',
            defaultValue: 'sql.csv',
            newRow: false,
            displayInViewMode: false
          },
          {
            key: 'delimiter',
            type: 'OibSelect',
            label: 'Delimiter',
            options: ['DOT', 'SEMI_COLON', 'COLON', 'COMMA', 'NON_BREAKING_SPACE', 'SLASH', 'TAB', 'PIPE'],
            defaultValue: ',',
            newRow: false,
            displayInViewMode: false
          },
          {
            key: 'compression',
            type: 'OibCheckbox',
            label: 'Compression',
            defaultValue: false,
            newRow: false,
            displayInViewMode: false
          },
          {
            key: 'outputTimestampFormat',
            type: 'OibText',
            label: 'Output date time format',
            defaultValue: 'yyyy-MM-dd HH:mm:ss.SSS',
            newRow: true,
            displayInViewMode: false
          },
          {
            key: 'outputTimezone',
            type: 'OibTimezone',
            label: 'Timezone',
            defaultValue: 'Europe/Paris',
            newRow: false,
            displayInViewMode: false
          }
        ]
      }
    ]
  }
};

export default manifest;
