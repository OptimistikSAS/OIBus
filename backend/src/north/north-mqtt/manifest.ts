import { NorthConnectorManifest } from '../../../shared/model/north-connector.model';

const manifest: NorthConnectorManifest = {
  id: 'mqtt',
  category: 'iot',
  types: ['mqtt'],
  settings: [
    {
      key: 'url',
      type: 'OibText',
      translationKey: 'north.mqtt.url',
      defaultValue: '',
      newRow: true,
      validators: [
        { key: 'required' },
        { key: 'pattern', params: { pattern: '^(mqtt:\\/\\/|mqtts:\\/\\/|tcp:\\/\\/|tls:\\/\\/|ws:\\/\\/|wss:\\/\\/).*' } }
      ],
      class: 'col-6',
      displayInViewMode: true
    },
    {
      key: 'qos',
      type: 'OibSelect',
      options: ['0', '1', '2'],
      translationKey: 'north.mqtt.qos',
      defaultValue: '1',
      class: 'col-3',
      validators: [{ key: 'required' }],
      displayInViewMode: true
    },
    {
      key: 'persistent',
      type: 'OibCheckbox',
      translationKey: 'north.mqtt.persistent',
      defaultValue: false,
      class: 'col-3',
      conditionalDisplay: { field: 'qos', values: ['1', '2'] },
      validators: [{ key: 'required' }],
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
          translationKey: 'north.mqtt.authentication',
          options: ['none', 'basic', 'cert'],
          validators: [{ key: 'required' }],
          defaultValue: 'none',
          newRow: true,
          class: 'col-4',
          displayInViewMode: false
        },
        {
          key: 'username',
          type: 'OibText',
          translationKey: 'north.mqtt.username',
          defaultValue: '',
          newRow: true,
          class: 'col-4',
          validators: [{ key: 'required' }],
          conditionalDisplay: { field: 'type', values: ['basic'] },
          displayInViewMode: false
        },
        {
          key: 'password',
          type: 'OibSecret',
          translationKey: 'north.mqtt.password',
          defaultValue: '',
          class: 'col-4',
          conditionalDisplay: { field: 'type', values: ['basic'] },
          displayInViewMode: false
        },
        {
          key: 'certFilePath',
          type: 'OibText',
          translationKey: 'north.mqtt.cert-file-path',
          defaultValue: '',
          newRow: true,
          class: 'col-4',
          conditionalDisplay: { field: 'type', values: ['cert'] },
          validators: [{ key: 'required' }],
          displayInViewMode: false
        },
        {
          key: 'keyFilePath',
          type: 'OibText',
          translationKey: 'north.mqtt.key-file-path',
          defaultValue: '',
          conditionalDisplay: { field: 'type', values: ['cert'] },
          class: 'col-4',
          displayInViewMode: false
        },
        {
          key: 'caFilePath',
          type: 'OibText',
          translationKey: 'north.mqtt.ca-file-path',
          defaultValue: '',
          conditionalDisplay: { field: 'type', values: ['cert'] },
          class: 'col-4',
          displayInViewMode: false
        }
      ]
    },
    {
      key: 'rejectUnauthorized',
      type: 'OibCheckbox',
      translationKey: 'north.mqtt.reject-unauthorized',
      defaultValue: false,
      newRow: true,
      displayInViewMode: false,
      validators: [{ key: 'required' }]
    },
    {
      key: 'reconnectPeriod',
      type: 'OibNumber',
      translationKey: 'north.mqtt.reconnect-period',
      unitLabel: 'ms',
      defaultValue: 10000,
      newRow: false,
      validators: [{ key: 'required' }, { key: 'min', params: { min: 100 } }, { key: 'max', params: { max: 30_000 } }],
      displayInViewMode: false
    },
    {
      key: 'connectTimeout',
      type: 'OibNumber',
      translationKey: 'north.mqtt.connect-timeout',
      unitLabel: 'ms',
      defaultValue: 10000,
      newRow: false,
      validators: [{ key: 'required' }, { key: 'min', params: { min: 100 } }, { key: 'max', params: { max: 30_000 } }],
      displayInViewMode: false
    }
  ]
};
export default manifest;
