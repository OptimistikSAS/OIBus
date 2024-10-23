import { SouthConnectorManifest } from '../../../shared/model/south-connector.model';
import { buildDateTimeFieldsFormControl, buildSerializationFormControl, proxy } from '../../../shared/model/manifest-factory';

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
      displayInViewMode: true,
      class: 'col-4'
    },
    {
      key: 'port',
      type: 'OibNumber',
      label: 'Port',
      defaultValue: 80,
      validators: [{ key: 'required' }, { key: 'min', params: { min: 1 } }, { key: 'max', params: { max: 65535 } }],
      displayInViewMode: true,
      class: 'col-2'
    },
    {
      key: 'acceptUnauthorized',
      type: 'OibCheckbox',
      label: 'Accept unauthorized certificate',
      validators: [{ key: 'required' }],
      defaultValue: false,
      displayInViewMode: true,
      class: 'col-3'
    },
    {
      key: 'timeout',
      type: 'OibNumber',
      label: 'Timeout',
      defaultValue: 30,
      unitLabel: 's',
      validators: [{ key: 'required' }],
      class: 'col-3'
    },
    {
      key: 'username',
      type: 'OibText',
      label: 'Username',
      defaultValue: '',
      validators: [{ key: 'required' }],
      newRow: true,
      displayInViewMode: false
    },
    {
      key: 'password',
      type: 'OibSecret',
      label: 'Password',
      defaultValue: '',
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
        newRow: false,
        displayInViewMode: false
      },
      buildDateTimeFieldsFormControl(['string', 'iso-string', 'unix-epoch', 'unix-epoch-ms']),
      buildSerializationFormControl(['csv'])
    ]
  }
};

export default manifest;
