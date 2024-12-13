import { SouthConnectorManifest } from '../../../shared/model/south-connector.model';

const manifest: SouthConnectorManifest = {
  id: 'opcua',
  name: 'OPC UA™',
  category: 'iot',
  description: 'Query data from OPC UA™ server',
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
      label: 'Throttling',
      class: 'col',
      newRow: true,
      displayInViewMode: false,
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
      key: 'sharedConnection',
      type: 'OibCheckbox',
      label: 'Share the session with other connectors?',
      defaultValue: false,
      newRow: true,
      validators: [{ key: 'required' }],
      displayInViewMode: false
    },
    {
      key: 'url',
      type: 'OibText',
      label: 'URL',
      defaultValue: 'opc.tcp://servername:port/endpoint',
      newRow: true,
      class: 'col-8',
      validators: [{ key: 'required' }, { key: 'pattern', params: { pattern: '^(http:\\/\\/|opc.tcp:\\/\\/).*' } }],
      displayInViewMode: true
    },
    {
      key: 'keepSessionAlive',
      type: 'OibCheckbox',
      label: 'Keep session alive',
      defaultValue: false,
      newRow: false,
      class: 'col-4',
      validators: [{ key: 'required' }],
      displayInViewMode: true
    },
    {
      key: 'readTimeout',
      type: 'OibNumber',
      label: 'Read timeout',
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
      label: 'Retry interval',
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
      label: 'Security mode',
      options: ['none', 'sign', 'sign-and-encrypt'],
      defaultValue: 'none',
      validators: [{ key: 'required' }],
      newRow: true,
      displayInViewMode: true
    },
    {
      key: 'securityPolicy',
      type: 'OibSelect',
      label: 'Security policy',
      options: [
        'none',
        'basic128',
        'basic192',
        'basic192-rsa15',
        'basic256-rsa15',
        'basic256-sha256',
        'aes128-sha256-rsa-oaep',
        'aes256-sha256-rsa-pss',
        'pub-sub-aes-128-ctr',
        'pub-sub-aes-256-ctr'
      ],
      defaultValue: 'none',
      conditionalDisplay: { field: 'securityMode', values: ['sign', 'sign-and-encrypt'] },
      newRow: false,
      displayInViewMode: true
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
          options: ['none', 'basic', 'cert'],
          pipe: 'authentication',
          defaultValue: 'none',
          validators: [{ key: 'required' }],
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
          conditionalDisplay: { field: 'type', values: ['basic'] },
          displayInViewMode: false
        },
        {
          key: 'certFilePath',
          type: 'OibText',
          label: 'Cert file path',
          defaultValue: '',
          conditionalDisplay: { field: 'type', values: ['cert'] },
          validators: [{ key: 'required' }],
          newRow: false,
          displayInViewMode: false
        },
        {
          key: 'keyFilePath',
          type: 'OibText',
          label: 'Key file path',
          defaultValue: '',
          conditionalDisplay: { field: 'type', values: ['cert'] },
          newRow: false,
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
        label: 'Node ID',
        validators: [{ key: 'required' }],
        displayInViewMode: true
      },
      {
        key: 'mode',
        type: 'OibSelect',
        label: 'Mode',
        options: ['ha', 'da'],
        defaultValue: 'ha',
        validators: [{ key: 'required' }],
        displayInViewMode: true
      },
      {
        key: 'haMode',
        type: 'OibFormGroup',
        label: '',
        newRow: true,
        displayInViewMode: false,
        conditionalDisplay: { field: 'mode', values: ['ha'] },
        content: [
          {
            key: 'aggregate',
            type: 'OibSelect',
            label: 'Aggregate',
            pipe: 'aggregates',
            options: ['raw', 'average', 'minimum', 'maximum', 'count'],
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
            conditionalDisplay: { field: 'aggregate', values: ['average', 'minimum', 'maximum', 'count'] },
            displayInViewMode: true
          }
        ]
      }
    ]
  }
};
export default manifest;
