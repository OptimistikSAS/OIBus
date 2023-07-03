import { NorthConnectorManifest } from '../../../../shared/model/north-connector.model';

const manifest: NorthConnectorManifest = {
  id: 'oiconnect',
  name: 'OIConnect',
  category: 'oi',
  description: 'Send files and values to REST API HTTP endpoints',
  modes: {
    files: true,
    points: true
  },
  settings: [
    {
      key: 'host',
      type: 'OibText',
      label: 'Host',
      validators: [{ key: 'required' }, { key: 'pattern', params: { pattern: '^(http:\\/\\/|https:\\/\\/|HTTP:\\/\\/|HTTPS:\\/\\/).*' } }],
      readDisplay: true
    },
    {
      key: 'acceptUnauthorized',
      type: 'OibCheckbox',
      label: 'Accept unauthorized certificate',
      validators: [{ key: 'required' }],
      defaultValue: false,
      readDisplay: true
    },
    {
      key: 'valuesEndpoint',
      type: 'OibText',
      label: 'Values endpoint',
      defaultValue: '/engine/add-values',
      newRow: true,
      validators: [{ key: 'required' }],
      readDisplay: true
    },
    {
      key: 'fileEndpoint',
      type: 'OibText',
      label: 'File endpoint',
      defaultValue: '/engine/add-file',
      newRow: false,
      validators: [{ key: 'required' }],
      readDisplay: true
    },
    { key: 'timeout', type: 'OibNumber', label: 'Timeout', newRow: true },
    { key: 'proxyId', type: 'OibProxy', label: 'Proxy', newRow: true },
    {
      key: 'authentication',
      type: 'OibFormGroup',
      label: 'Authentication',
      class: 'col',
      newRow: true,
      readDisplay: false,
      content: [
        {
          key: 'type',
          type: 'OibSelect',
          label: 'Type',
          options: ['none', 'basic', 'bearer', 'api-key'],
          defaultValue: 'none',
          newRow: true,
          readDisplay: false
        },
        {
          key: 'username',
          type: 'OibText',
          label: 'Username',
          defaultValue: '',
          validators: [{ key: 'required' }],
          conditionalDisplay: { field: 'type', values: ['basic'] },
          readDisplay: false
        },
        {
          key: 'password',
          type: 'OibSecret',
          label: 'Password',
          defaultValue: '',
          validators: [{ key: 'required' }],
          conditionalDisplay: { field: 'type', values: ['basic'] },
          readDisplay: false
        },
        {
          key: 'token',
          type: 'OibSecret',
          label: 'Token',
          defaultValue: '',
          conditionalDisplay: { field: 'type', values: ['bearer'] },
          validators: [{ key: 'required' }],
          newRow: false,
          readDisplay: false
        },
        {
          key: 'apiKeyHeader',
          type: 'OibSecret',
          label: 'Api key header',
          defaultValue: '',
          conditionalDisplay: { field: 'type', values: ['api-key'] },
          newRow: false,
          readDisplay: false
        },
        {
          key: 'apiKey',
          type: 'OibSecret',
          label: 'Api key',
          defaultValue: '',
          conditionalDisplay: { field: 'type', values: ['api-key'] },
          newRow: false,
          readDisplay: false
        }
      ]
    }
  ]
};

export default manifest;
