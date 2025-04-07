import { NorthConnectorManifest } from '../../../shared/model/north-connector.model';

const manifest: NorthConnectorManifest = {
  id: 'oianalytics',
  category: 'api',
  types: ['any', 'time-values'],
  settings: [
    {
      key: 'useOiaModule',
      type: 'OibCheckbox',
      translationKey: 'north.oianalytics.use-oia-module',
      validators: [{ key: 'required' }],
      defaultValue: true,
      displayInViewMode: true,
      class: 'col-3'
    },
    {
      key: 'timeout',
      type: 'OibNumber',
      translationKey: 'north.oianalytics.timeout',

      defaultValue: 30,
      unitLabel: 's',
      validators: [{ key: 'required' }],
      class: 'col-3'
    },
    {
      key: 'compress',
      type: 'OibCheckbox',
      translationKey: 'north.oianalytics.compress',
      validators: [{ key: 'required' }],
      defaultValue: false,
      displayInViewMode: true,
      class: 'col-3'
    },
    {
      key: 'specificSettings',
      type: 'OibFormGroup',
      translationKey: '',
      newRow: true,
      conditionalDisplay: { field: 'useOiaModule', values: [false] },
      content: [
        {
          key: 'host',
          type: 'OibText',
          translationKey: 'north.oianalytics.specific-settings.host',
          validators: [
            { key: 'required' },
            {
              key: 'pattern',
              params: { pattern: '^(http:\\/\\/|https:\\/\\/|HTTP:\\/\\/|HTTPS:\\/\\/).*' }
            }
          ],
          defaultValue: 'https://instance_name.oianalytics.fr',
          displayInViewMode: true,
          newRow: true,
          class: 'col-6'
        },
        {
          key: 'acceptUnauthorized',
          type: 'OibCheckbox',
          translationKey: 'north.oianalytics.specific-settings.accept-unauthorized',
          validators: [{ key: 'required' }],
          defaultValue: false,
          displayInViewMode: true,
          class: 'col-3'
        },
        {
          key: 'authentication',
          type: 'OibSelect',
          options: ['basic', 'aad-client-secret', 'aad-certificate'],
          translationKey: 'north.oianalytics.specific-settings.authentication',
          defaultValue: 'basic',
          newRow: true,
          validators: [{ key: 'required' }],
          displayInViewMode: true
        },
        {
          key: 'accessKey',
          type: 'OibText',
          translationKey: 'north.oianalytics.specific-settings.access-key',
          validators: [{ key: 'required' }],
          conditionalDisplay: { field: 'authentication', values: ['basic'] },
          newRow: true,
          displayInViewMode: true
        },
        {
          key: 'secretKey',
          type: 'OibSecret',
          translationKey: 'north.oianalytics.specific-settings.secret-key',
          conditionalDisplay: { field: 'authentication', values: ['basic'] },
          displayInViewMode: false
        },
        {
          key: 'tenantId',
          type: 'OibText',
          translationKey: 'north.oianalytics.specific-settings.tenant-id',
          newRow: true,
          conditionalDisplay: { field: 'authentication', values: ['aad-client-secret', 'aad-certificate'] },
          displayInViewMode: true
        },
        {
          key: 'clientId',
          type: 'OibText',
          translationKey: 'north.oianalytics.specific-settings.client-id',
          newRow: false,
          validators: [{ key: 'required' }],
          conditionalDisplay: { field: 'authentication', values: ['aad-client-secret', 'aad-certificate'] },
          displayInViewMode: true
        },
        {
          key: 'clientSecret',
          type: 'OibSecret',
          translationKey: 'north.oianalytics.specific-settings.client-secret',
          newRow: false,
          conditionalDisplay: { field: 'authentication', values: ['aad-client-secret'] }
        },
        {
          key: 'certificateId',
          type: 'OibCertificate',
          translationKey: 'north.oianalytics.specific-settings.certificate-id',
          newRow: false,
          conditionalDisplay: { field: 'authentication', values: ['aad-certificate'] }
        },
        {
          key: 'scope',
          type: 'OibText',
          translationKey: 'north.oianalytics.specific-settings.scope',
          newRow: false,
          conditionalDisplay: { field: 'authentication', values: ['aad', 'aad-certificate'] }
        },
        {
          key: 'useProxy',
          translationKey: 'north.oianalytics.specific-settings.use-proxy',
          type: 'OibCheckbox',
          newRow: true,
          defaultValue: false,
          displayInViewMode: true,
          validators: [{ key: 'required' }]
        },
        {
          key: 'proxyUrl',
          translationKey: 'north.oianalytics.specific-settings.proxy-url',
          type: 'OibText',
          validators: [{ key: 'required' }],
          conditionalDisplay: { field: 'useProxy', values: [true] }
        },
        {
          key: 'proxyUsername',
          translationKey: 'north.oianalytics.specific-settings.proxy-username',
          type: 'OibText',
          conditionalDisplay: { field: 'useProxy', values: [true] }
        },
        {
          key: 'proxyPassword',
          translationKey: 'north.oianalytics.specific-settings.proxy-password',
          type: 'OibSecret',
          conditionalDisplay: { field: 'useProxy', values: [true] }
        }
      ]
    }
  ]
};

export default manifest;
