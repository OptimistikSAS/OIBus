import { NorthConnectorManifest } from '../../../shared/model/north-connector.model';

const manifest: NorthConnectorManifest = {
  id: 'azure-blob',
  category: 'file',
  modes: {
    files: true,
    points: true
  },
  settings: [
    {
      key: 'useADLS',
      type: 'OibCheckbox',
      translationKey: 'Use Data Lake',
      validators: [{ key: 'required' }],
      defaultValue: false,
      displayInViewMode: true,
      class: 'col-3'
    },
    {
      key: 'useCustomUrl',
      type: 'OibCheckbox',
      translationKey: 'north.azure-blob.use-custom-url',
      validators: [{ key: 'required' }],
      defaultValue: false,
      displayInViewMode: true,
      class: 'col-3'
    },
    {
      key: 'account',
      type: 'OibText',
      translationKey: 'north.azure-blob.account',
      class: 'col-9',
      validators: [{ key: 'required' }],
      displayInViewMode: true,
      conditionalDisplay: { field: 'useCustomUrl', values: [false] }
    },
    {
      key: 'customUrl',
      type: 'OibText',
      translationKey: 'north.azure-blob.custom-url',
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
      translationKey: 'north.azure-blob.container',
      class: 'col-6',
      validators: [{ key: 'required' }],
      newRow: true,
      displayInViewMode: true
    },
    {
      key: 'path',
      type: 'OibText',
      translationKey: 'north.azure-blob.path',
      class: 'col-6',
      displayInViewMode: true
    },
    {
      key: 'authentication',
      type: 'OibSelect',
      options: ['access-key', 'sas-token', 'aad', 'external'],
      translationKey: 'north.azure-blob.authentication',
      defaultValue: 'access-key',
      newRow: true,
      class: 'col-3',
      validators: [{ key: 'required' }],
      displayInViewMode: true
    },
    {
      key: 'sasToken',
      type: 'OibSecret',
      translationKey: 'north.azure-blob.sas-token',
      class: 'col-3',
      conditionalDisplay: { field: 'authentication', values: ['sas-token'] }
    },
    {
      key: 'accessKey',
      type: 'OibSecret',
      translationKey: 'north.azure-blob.access-key',
      class: 'col-3',
      conditionalDisplay: { field: 'authentication', values: ['access-key'] }
    },
    {
      key: 'tenantId',
      type: 'OibText',
      translationKey: 'north.azure-blob.tenant-id',
      newRow: true,
      class: 'col-3',
      conditionalDisplay: { field: 'authentication', values: ['aad'] }
    },
    {
      key: 'clientId',
      type: 'OibText',
      translationKey: 'north.azure-blob.client-id',
      newRow: false,
      class: 'col-3',
      conditionalDisplay: { field: 'authentication', values: ['aad'] }
    },
    {
      key: 'clientSecret',
      type: 'OibSecret',
      translationKey: 'north.azure-blob.client-secret',
      newRow: false,
      class: 'col-3',
      conditionalDisplay: { field: 'authentication', values: ['aad'] }
    },
    {
      key: 'useProxy',
      translationKey: 'north.azure-blob.use-proxy',
      type: 'OibCheckbox',
      newRow: true,
      defaultValue: false,
      displayInViewMode: true,
      validators: [{ key: 'required' }]
    },
    {
      key: 'proxyUrl',
      translationKey: 'north.azure-blob.proxy-url',
      type: 'OibText',
      validators: [{ key: 'required' }],
      conditionalDisplay: { field: 'useProxy', values: [true] }
    },
    {
      key: 'proxyUsername',
      translationKey: 'north.azure-blob.proxy-username',
      type: 'OibText',
      conditionalDisplay: { field: 'useProxy', values: [true] }
    },
    {
      key: 'proxyPassword',
      translationKey: 'north.azure-blob.proxy-password',
      type: 'OibSecret',
      conditionalDisplay: { field: 'useProxy', values: [true] }
    }
  ]
};

export default manifest;
