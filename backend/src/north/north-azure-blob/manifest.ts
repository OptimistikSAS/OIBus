import { NorthConnectorManifest } from '../../../../shared/model/north-connector.model';

const manifest: NorthConnectorManifest = {
  name: 'AzureBlob',
  category: 'file',
  description: 'Azure Blob description',
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
      readDisplay: true
    },
    {
      key: 'container',
      type: 'OibText',
      label: 'Container',
      newRow: false,
      validators: [{ key: 'required' }],
      readDisplay: true
    },
    {
      key: 'authentication',
      type: 'OibSelect',
      options: ['sasToken', 'accessKey', 'aad'],
      label: 'Authentication',
      defaultValue: 'accessKey',
      newRow: false,
      validators: [{ key: 'required' }],
      readDisplay: true
    },
    {
      key: 'sasToken',
      type: 'OibSecret',
      label: 'Shared Access Signature Token',
      newRow: true,
      conditionalDisplay: { authentication: ['sasToken'] },
      readDisplay: true
    },
    {
      key: 'accessKey',
      type: 'OibSecret',
      label: 'Access Key',
      newRow: true,
      conditionalDisplay: { authentication: ['accessKey'] },
      readDisplay: true
    },
    {
      key: 'tenantId',
      type: 'OibText',
      label: 'Tenant ID',
      newRow: true,
      conditionalDisplay: { authentication: ['aad'] },
      readDisplay: true
    },
    {
      key: 'clientId',
      type: 'OibText',
      label: 'Client ID',
      newRow: false,
      validators: [{ key: 'required' }],
      conditionalDisplay: { authentication: ['aad'] },
      readDisplay: true
    },
    {
      key: 'clientSecret',
      type: 'OibSecret',
      label: 'Client Secret',
      newRow: false,
      validators: [{ key: 'required' }],
      conditionalDisplay: { authentication: ['aad'] },
      readDisplay: true
    }
  ]
};

export default manifest;
