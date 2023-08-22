import { NorthConnectorManifest } from '../../../../shared/model/north-connector.model';
import { proxy } from '../../../../shared/model/manifest-factory';

const manifest: NorthConnectorManifest = {
  id: 'oianalytics',
  name: 'OIAnalytics',
  category: 'api',
  description: 'Send files and values to OIAnalytics application',
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
      defaultValue: 'https://instance_name.oianalytics.fr',
      displayInViewMode: true,
      class: 'col-6'
    },
    {
      key: 'acceptUnauthorized',
      type: 'OibCheckbox',
      label: 'Accept unauthorized certificate',
      validators: [{ key: 'required' }],
      defaultValue: false,
      displayInViewMode: true,
      class: 'col-3'
    },
    {
      key: 'timeout',
      type: 'OibNumber',
      label: 'Timeout',
      defaultValue: 30,
      unitLabel: 's',
      validators: [{ key: 'required' }],
      class: 'col-3'
    },
    {
      key: 'authentication',
      type: 'OibSelect',
      options: ['basic', 'aad-client-secret', 'aad-certificate'],
      label: 'Authentication',
      pipe: 'authentication',
      defaultValue: 'basic',
      newRow: true,
      validators: [{ key: 'required' }],
      displayInViewMode: true
    },
    {
      key: 'accessKey',
      type: 'OibText',
      label: 'Access key',
      validators: [{ key: 'required' }],
      conditionalDisplay: { field: 'authentication', values: ['basic'] },
      newRow: true,
      displayInViewMode: true
    },
    {
      key: 'secretKey',
      type: 'OibSecret',
      label: 'Secret key',
      conditionalDisplay: { field: 'authentication', values: ['basic'] },
      displayInViewMode: false
    },
    {
      key: 'tenantId',
      type: 'OibText',
      label: 'Tenant ID',
      newRow: true,
      conditionalDisplay: { field: 'authentication', values: ['aad-client-secret', 'aad-certificate'] },
      displayInViewMode: true
    },
    {
      key: 'clientId',
      type: 'OibText',
      label: 'Client ID',
      newRow: false,
      validators: [{ key: 'required' }],
      conditionalDisplay: { field: 'authentication', values: ['aad-client-secret', 'aad-certificate'] },
      displayInViewMode: true
    },
    {
      key: 'clientSecret',
      type: 'OibSecret',
      label: 'Client secret',
      newRow: false,
      conditionalDisplay: { field: 'authentication', values: ['aad-client-secret'] }
    },
    {
      key: 'certificateId',
      type: 'OibCertificate',
      label: 'Certificate',
      newRow: false,
      conditionalDisplay: { field: 'authentication', values: ['aad-certificate'] }
    },
    {
      key: 'scope',
      type: 'OibText',
      label: 'Scope',
      newRow: false,
      conditionalDisplay: { field: 'authentication', values: ['aad', 'aad-certificate'] }
    },
    ...proxy
  ]
};

export default manifest;
