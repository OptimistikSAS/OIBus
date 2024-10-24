import { NorthConnectorManifest } from '../../../shared/model/north-connector.model';
import { proxy } from '../../../shared/model/manifest-factory';

const manifest: NorthConnectorManifest = {
  id: 'azure-blob',
  name: 'Azure Blob',
  category: 'file',
  description: 'Store files in Azure Blob',
  modes: {
    files: true,
    points: true
  },
  settings: [
    {
      key: 'useCustomUrl',
      type: 'OibCheckbox',
      label: 'Use Custom URL',
      validators: [{ key: 'required' }],
      defaultValue: false,
      displayInViewMode: true,
      class: 'col-3'
    },
    {
      key: 'account',
      type: 'OibText',
      label: 'Account',
      class: 'col-9',
      validators: [{ key: 'required' }],
      displayInViewMode: true,
      conditionalDisplay: { field: 'useCustomUrl', values: [false] }
    },
    {
      key: 'customUrl',
      type: 'OibText',
      label: 'Custom URL',
      class: 'col-9',
      validators: [
        { key: 'required' },
        {
          key: 'pattern',
          params: { pattern: '^(http:\\/\\/|https:\\/\\/|HTTP:\\/\\/|HTTPS:\\/\\/).*' }
        }
      ],
      displayInViewMode: true,
      conditionalDisplay: { field: 'useCustomUrl', values: [true] }
    },
    {
      key: 'container',
      type: 'OibText',
      label: 'Container',
      validators: [{ key: 'required' }],
      newRow: true,
      displayInViewMode: true
    },
    {
      key: 'path',
      type: 'OibText',
      label: 'Path',
      displayInViewMode: true
    },
    {
      key: 'authentication',
      type: 'OibSelect',
      options: ['accessKey', 'sasToken', 'aad', 'external'],
      label: 'Authentication',
      pipe: 'authentication',
      defaultValue: 'accessKey',
      newRow: true,
      validators: [{ key: 'required' }],
      displayInViewMode: true
    },
    {
      key: 'sasToken',
      type: 'OibSecret',
      label: 'Shared Access Signature token',
      conditionalDisplay: { field: 'authentication', values: ['sasToken'] }
    },
    {
      key: 'accessKey',
      type: 'OibSecret',
      label: 'Access key',
      conditionalDisplay: { field: 'authentication', values: ['accessKey'] }
    },
    {
      key: 'tenantId',
      type: 'OibText',
      label: 'Tenant ID',
      newRow: true,
      conditionalDisplay: { field: 'authentication', values: ['aad'] }
    },
    {
      key: 'clientId',
      type: 'OibText',
      label: 'Client ID',
      newRow: false,
      conditionalDisplay: { field: 'authentication', values: ['aad'] }
    },
    {
      key: 'clientSecret',
      type: 'OibSecret',
      label: 'Client secret',
      newRow: false,
      conditionalDisplay: { field: 'authentication', values: ['aad'] }
    },
    ...proxy
  ]
};

export default manifest;
