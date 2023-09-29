import { NorthConnectorManifest } from '../../../../shared/model/north-connector.model';

const manifest: NorthConnectorManifest = {
  id: 'azure-blob',
  name: 'Azure Blob',
  category: 'file',
  description: 'Store files in Azure Blob',
  modes: {
    files: true,
    points: false
  },
  settings: [
    {
      key: 'account',
      type: 'OibText',
      label: 'Account',
      newRow: true,
      validators: [{ key: 'required' }],
      displayInViewMode: true
    },
    {
      key: 'container',
      type: 'OibText',
      label: 'Container',
      validators: [{ key: 'required' }],
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
      options: ['accessKey', 'sasToken', 'aad', 'external', 'powershell'],
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
    }
  ]
};

export default manifest;
