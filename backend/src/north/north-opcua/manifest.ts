import { NorthConnectorManifest } from '../../../shared/model/north-connector.model';

const manifest: NorthConnectorManifest = {
  id: 'opcua',
  category: 'iot',
  types: ['time-values'],
  settings: [
    {
      key: 'url',
      type: 'OibText',
      translationKey: 'north.opcua.url',
      defaultValue: 'opc.tcp://servername:port/endpoint',
      newRow: true,
      class: 'col-8',
      validators: [{ key: 'required' }, { key: 'pattern', params: { pattern: '^(http:\\/\\/|opc.tcp:\\/\\/).*' } }],
      displayInViewMode: true
    },
    {
      key: 'keepSessionAlive',
      type: 'OibCheckbox',
      translationKey: 'north.opcua.keep-session-alive',
      defaultValue: false,
      newRow: false,
      class: 'col-4',
      validators: [{ key: 'required' }],
      displayInViewMode: true
    },
    {
      key: 'readTimeout',
      type: 'OibNumber',
      translationKey: 'north.opcua.read-timeout',
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
      translationKey: 'north.opcua.retry-interval',
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
      translationKey: 'north.opcua.security-mode',
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
      translationKey: 'north.opcua.security-policy',
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
          translationKey: 'north.opcua.authentication',
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
          translationKey: 'north.opcua.username',
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
          translationKey: 'north.opcua.password',
          defaultValue: '',
          class: 'col-6',
          conditionalDisplay: { field: 'type', values: ['basic'] },
          displayInViewMode: false
        },
        {
          key: 'certFilePath',
          type: 'OibText',
          translationKey: 'north.opcua.cert-file-path',
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
          translationKey: 'north.opcua.key-file-path',
          defaultValue: '',
          conditionalDisplay: { field: 'type', values: ['cert'] },
          class: 'col-6',
          displayInViewMode: false
        }
      ]
    }
  ]
};
export default manifest;
