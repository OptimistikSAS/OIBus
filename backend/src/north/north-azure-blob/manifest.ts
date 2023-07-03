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
      newRow: false,
      validators: [{ key: 'required' }],
      displayInViewMode: true
    },
    {
      key: 'authentication',
      type: 'OibSelect',
      options: ['sasToken', 'accessKey', 'aad'],
      label: 'Authentication',
      defaultValue: 'accessKey',
      newRow: false,
      validators: [{ key: 'required' }],
      displayInViewMode: true
    },
    {
      key: 'sasToken',
      type: 'OibSecret',
      label: 'Shared Access Signature Token',
      newRow: true,
      conditionalDisplay: { field: 'authentication', values: ['sasToken'] },
      displayInViewMode: true
    },
    {
      key: 'accessKey',
      type: 'OibSecret',
      label: 'Access Key',
      newRow: true,
      conditionalDisplay: { field: 'authentication', values: ['accessKey'] },
      displayInViewMode: true
    },
    {
      key: 'tenantId',
      type: 'OibText',
      label: 'Tenant ID',
      newRow: true,
      conditionalDisplay: { field: 'authentication', values: ['aad'] },
      displayInViewMode: true
    },
    {
      key: 'clientId',
      type: 'OibText',
      label: 'Client ID',
      newRow: false,
      validators: [{ key: 'required' }],
      conditionalDisplay: { field: 'authentication', values: ['aad'] },
      displayInViewMode: true
    },
    {
      key: 'clientSecret',
      type: 'OibSecret',
      label: 'Client Secret',
      newRow: false,
      validators: [{ key: 'required' }],
      conditionalDisplay: { field: 'authentication', values: ['aad'] },
      displayInViewMode: true
    }
  ]
};

export default manifest;
