import { SouthConnectorManifest } from '../../../shared/model/south-connector.model';

const manifest: SouthConnectorManifest = {
  id: 'opcua',
  category: 'iot',
  modes: {
    subscription: true,
    lastPoint: true,
    lastFile: false,
    history: true
  },
  settings: [
    {
      key: 'throttling',
      type: 'OibFormGroup',
      translationKey: 'south.opcua.throttling.title',
      class: 'col',
      newRow: true,
      displayInViewMode: false,
      validators: [{ key: 'required' }],
      content: [
        {
          key: 'maxReadInterval',
          type: 'OibNumber',
          translationKey: 'south.opcua.throttling.max-read-interval',
          validators: [{ key: 'required' }, { key: 'min', params: { min: 0 } }],
          defaultValue: 3600,
          unitLabel: 's',
          displayInViewMode: true
        },
        {
          key: 'readDelay',
          type: 'OibNumber',
          translationKey: 'south.opcua.throttling.read-delay',
          validators: [{ key: 'required' }, { key: 'min', params: { min: 0 } }],
          defaultValue: 200,
          unitLabel: 'ms',
          displayInViewMode: true
        },
        {
          key: 'overlap',
          type: 'OibNumber',
          translationKey: 'south.opcua.throttling.overlap',
          validators: [{ key: 'required' }, { key: 'min', params: { min: 0 } }],
          defaultValue: 0,
          unitLabel: 'ms',
          displayInViewMode: true
        },
        {
          key: 'maxInstantPerItem',
          type: 'OibCheckbox',
          translationKey: 'south.opcua.throttling.max-instant-per-item',
          defaultValue: false,
          validators: [{ key: 'required' }],
          displayInViewMode: true
        }
      ]
    },
    {
      key: 'sharedConnection',
      type: 'OibCheckbox',
      translationKey: 'south.opcua.shared-connection',
      defaultValue: false,
      newRow: true,
      validators: [{ key: 'required' }],
      displayInViewMode: false
    },
    {
      key: 'url',
      type: 'OibText',
      translationKey: 'south.opcua.url',
      defaultValue: 'opc.tcp://servername:port/endpoint',
      newRow: true,
      class: 'col-8',
      validators: [{ key: 'required' }, { key: 'pattern', params: { pattern: '^(http:\\/\\/|opc.tcp:\\/\\/).*' } }],
      displayInViewMode: true
    },
    {
      key: 'keepSessionAlive',
      type: 'OibCheckbox',
      translationKey: 'south.opcua.keep-session-alive',
      defaultValue: false,
      newRow: false,
      class: 'col-4',
      validators: [{ key: 'required' }],
      displayInViewMode: true
    },
    {
      key: 'readTimeout',
      type: 'OibNumber',
      translationKey: 'south.opcua.read-timeout',
      unitLabel: 'ms',
      defaultValue: 15_000,
      newRow: true,
      class: 'col-4',
      validators: [{ key: 'required' }, { key: 'min', params: { min: 100 } }, { key: 'max', params: { max: 3_600_000 } }],
      displayInViewMode: false
    },
    {
      key: 'retryInterval',
      type: 'OibNumber',
      translationKey: 'south.opcua.retry-interval',
      unitLabel: 'ms',
      defaultValue: 10_000,
      newRow: false,
      class: 'col-4',
      validators: [{ key: 'required' }, { key: 'min', params: { min: 100 } }, { key: 'max', params: { max: 3_600_000 } }],
      displayInViewMode: false
    },
    {
      key: 'securityMode',
      type: 'OibSelect',
      translationKey: 'south.opcua.security-mode',
      options: ['none', 'sign', 'sign-and-encrypt'],
      defaultValue: 'none',
      validators: [{ key: 'required' }],
      class: 'col-6',
      newRow: true,
      displayInViewMode: true
    },
    {
      key: 'securityPolicy',
      type: 'OibSelect',
      translationKey: 'south.opcua.security-policy',
      options: [
        'none',
        'basic128',
        'basic192',
        'basic192-rsa15',
        'basic256-rsa15',
        'basic256-sha256',
        'aes128-sha256-rsa-oaep',
        'pub-sub-aes-128-ctr',
        'pub-sub-aes-256-ctr'
      ],
      defaultValue: 'none',
      conditionalDisplay: { field: 'securityMode', values: ['sign', 'sign-and-encrypt'] },
      class: 'col-6',
      displayInViewMode: true
    },
    {
      key: 'authentication',
      type: 'OibFormGroup',
      translationKey: '',
      class: 'col',
      newRow: true,
      displayInViewMode: false,
      validators: [{ key: 'required' }],
      content: [
        {
          key: 'type',
          type: 'OibSelect',
          translationKey: 'south.opcua.authentication',
          options: ['none', 'basic', 'cert'],
          defaultValue: 'none',
          validators: [{ key: 'required' }],
          newRow: true,
          class: 'col-6',
          displayInViewMode: false
        },
        {
          key: 'username',
          type: 'OibText',
          translationKey: 'south.opcua.username',
          defaultValue: '',
          newRow: true,
          class: 'col-6',
          validators: [{ key: 'required' }],
          conditionalDisplay: { field: 'type', values: ['basic'] },
          displayInViewMode: false
        },
        {
          key: 'password',
          type: 'OibSecret',
          translationKey: 'south.opcua.password',
          defaultValue: '',
          class: 'col-6',
          conditionalDisplay: { field: 'type', values: ['basic'] },
          displayInViewMode: false
        },
        {
          key: 'certFilePath',
          type: 'OibText',
          translationKey: 'south.opcua.cert-file-path',
          defaultValue: '',
          conditionalDisplay: { field: 'type', values: ['cert'] },
          validators: [{ key: 'required' }],
          newRow: true,
          class: 'col-6',
          displayInViewMode: false
        },
        {
          key: 'keyFilePath',
          type: 'OibText',
          translationKey: 'south.opcua.key-file-path',
          defaultValue: '',
          conditionalDisplay: { field: 'type', values: ['cert'] },
          class: 'col-6',
          displayInViewMode: false
        }
      ]
    }
  ],
  items: {
    scanMode: {
      acceptSubscription: true,
      subscriptionOnly: false
    },
    settings: [
      {
        key: 'nodeId',
        type: 'OibText',
        translationKey: 'south.items.opcua.node-id',
        validators: [{ key: 'required' }],
        displayInViewMode: true
      },
      {
        key: 'mode',
        type: 'OibSelect',
        translationKey: 'south.items.opcua.mode',
        options: ['ha', 'da'],
        defaultValue: 'ha',
        validators: [{ key: 'required' }],
        displayInViewMode: true
      },
      {
        key: 'haMode',
        type: 'OibFormGroup',
        translationKey: 'south.items.opcua.ha-mode.title',
        newRow: true,
        displayInViewMode: false,
        conditionalDisplay: { field: 'mode', values: ['ha'] },
        content: [
          {
            key: 'aggregate',
            type: 'OibSelect',
            translationKey: 'south.items.opcua.ha-mode.aggregate',
            options: ['raw', 'average', 'minimum', 'maximum', 'count'],
            defaultValue: 'raw',
            validators: [{ key: 'required' }],
            displayInViewMode: true
          },
          {
            key: 'resampling',
            type: 'OibSelect',
            translationKey: 'south.items.opcua.ha-mode.resampling',
            options: ['none', '1s', '10s', '30s', '1min', '1h', '1d'],
            defaultValue: 'none',
            validators: [{ key: 'required' }],
            conditionalDisplay: { field: 'aggregate', values: ['average', 'minimum', 'maximum', 'count'] },
            displayInViewMode: true
          }
        ]
      }
    ]
  }
};
export default manifest;
