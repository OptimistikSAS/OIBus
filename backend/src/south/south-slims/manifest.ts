import { SouthConnectorManifest } from '../../../../shared/model/south-connector.model';
import { buildDateTimeFieldsFormControl, serialization } from '../../../../shared/model/manifest-factory';

const manifest: SouthConnectorManifest = {
  id: 'slims',
  name: 'SLIMS',
  category: 'api',
  description: 'Connect to SLIMS application',
  modes: {
    subscription: false,
    lastPoint: false,
    lastFile: false,
    history: true,
    forceMaxInstantPerItem: true
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
          key: 'username',
          type: 'OibText',
          label: 'Username',
          defaultValue: '',
          validators: [{ key: 'required' }],
          displayInViewMode: false
        },
        {
          key: 'password',
          type: 'OibSecret',
          label: 'Password',
          defaultValue: '',
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
        key: 'body',
        type: 'OibCodeBlock',
        label: 'Body',
        contentType: 'json',
        defaultValue: '',
        newRow: true
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
            validators: [{ key: 'required' }]
          },
          {
            key: 'value',
            label: 'Value',
            type: 'OibText',
            defaultValue: '',
            validators: [{ key: 'required' }]
          }
        ],
        class: 'col',
        newRow: false,
        displayInViewMode: false
      },
      buildDateTimeFieldsFormControl(['string', 'iso-string', 'unix-epoch', 'unix-epoch-ms']),
      serialization
    ]
  }
};

export default manifest;
