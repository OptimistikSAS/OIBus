import { SouthConnectorManifest } from '../../../../shared/model/south-connector.model';

const manifest: SouthConnectorManifest = {
  id: 'opcua',
  name: 'OPC UA',
  category: 'iot',
  description: 'Request data from OPC UA server',
  modes: {
    subscription: true,
    lastPoint: true,
    lastFile: false,
    history: true,
    forceMaxInstantPerItem: false
  },
  settings: [
    {
      key: 'url',
      type: 'OibText',
      label: 'URL',
      defaultValue: 'opc.tcp://servername:port/endpoint',
      newRow: true,
      validators: [{ key: 'required' }, { key: 'pattern', params: { pattern: '^(http:\\/\\/|opc.tcp:\\/\\/).*' } }],
      displayInViewMode: true
    },
    {
      key: 'keepSessionAlive',
      type: 'OibCheckbox',
      label: 'Keep Session Alive',
      defaultValue: false,
      newRow: false,
      validators: [{ key: 'required' }],
      displayInViewMode: true
    },
    {
      key: 'readTimeout',
      type: 'OibNumber',
      label: 'Read timeout',
      unitLabel: 'ms',
      defaultValue: 15_000,
      newRow: false,
      validators: [{ key: 'required' }, { key: 'min', params: { min: 100 } }, { key: 'max', params: { max: 3_600_000 } }],
      displayInViewMode: false
    },
    {
      key: 'retryInterval',
      type: 'OibNumber',
      label: 'Retry interval',
      unitLabel: 'ms',
      defaultValue: 5_000,
      newRow: false,
      validators: [{ key: 'required' }, { key: 'min', params: { min: 100 } }, { key: 'max', params: { max: 3_600_000 } }],
      displayInViewMode: false
    },
    {
      key: 'securityMode',
      type: 'OibSelect',
      label: 'Security Mode',
      options: ['None', 'Sign', 'SignAndEncrypt'],
      defaultValue: 'None',
      validators: [{ key: 'required' }],
      newRow: true,
      displayInViewMode: true
    },
    {
      key: 'securityPolicy',
      type: 'OibSelect',
      label: 'Security Policy',
      options: [
        'None',
        'Basic128',
        'Basic192',
        'Basic256',
        'Basic128Rsa15',
        'Basic192Rsa15',
        'Basic256Rsa15',
        'Basic256Sha256',
        'Aes128_Sha256_RsaOaep',
        'PubSub_Aes128_CTR',
        'PubSub_Aes256_CTR'
      ],
      defaultValue: 'None',
      conditionalDisplay: { field: 'securityMode', values: ['Sign', 'SignAndEncrypt'] },
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
        options: ['HA', 'DA'],
        defaultValue: 'HA',
        validators: [{ key: 'required' }],
        displayInViewMode: true
      },
      {
        key: 'haMode',
        type: 'OibFormGroup',
        label: '',
        newRow: true,
        displayInViewMode: false,
        conditionalDisplay: { field: 'mode', values: ['HA'] },
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
            options: ['none', 'second', '10Seconds', '30Seconds', 'minute', 'hour', 'day'],
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
