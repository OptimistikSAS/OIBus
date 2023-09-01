import { NorthConnectorManifest } from '../../../../shared/model/north-connector.model';
import { proxy } from '../../../../shared/model/manifest-factory';

const manifest: NorthConnectorManifest = {
  id: 'rest-api',
  name: 'Rest API',
  category: 'api',
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
      validators: [
        { key: 'required' },
        {
          key: 'pattern',
          params: { pattern: '^(http:\\/\\/|https:\\/\\/|HTTP:\\/\\/|HTTPS:\\/\\/).*' }
        }
      ],
      displayInViewMode: true
    },
    {
      key: 'acceptUnauthorized',
      type: 'OibCheckbox',
      label: 'Accept unauthorized certificate',
      validators: [{ key: 'required' }],
      defaultValue: false,
      displayInViewMode: true
    },
    {
      key: 'valuesEndpoint',
      type: 'OibText',
      label: 'Values endpoint',
      defaultValue: '/engine/add-values',
      newRow: true,
      validators: [{ key: 'required' }],
      displayInViewMode: true
    },
    {
      key: 'fileEndpoint',
      type: 'OibText',
      label: 'File endpoint',
      defaultValue: '/engine/add-file',
      newRow: false,
      validators: [{ key: 'required' }],
      displayInViewMode: true
    },
    ...proxy,
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
          pipe: 'authentication',
          validators: [{ key: 'required' }],
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
          conditionalDisplay: { field: 'type', values: ['basic'] },
          displayInViewMode: false
        },
        {
          key: 'token',
          type: 'OibSecret',
          label: 'Token',
          defaultValue: '',
          conditionalDisplay: { field: 'type', values: ['bearer'] },
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
  ]
};

export default manifest;
