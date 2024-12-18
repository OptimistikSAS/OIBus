import { SouthConnectorManifest } from '../../../shared/model/south-connector.model';

const manifest: SouthConnectorManifest = {
  id: 'oianalytics',
  category: 'api',
  modes: {
    subscription: false,
    lastPoint: false,
    lastFile: false,
    history: true
  },
  settings: [
    {
      key: 'throttling',
      type: 'OibFormGroup',
      translationKey: 'south.oianalytics.throttling.title',
      class: 'col',
      newRow: true,
      displayInViewMode: false,
      validators: [{ key: 'required' }],
      content: [
        {
          key: 'maxReadInterval',
          type: 'OibNumber',
          translationKey: 'south.oianalytics.throttling.max-read-interval',
          validators: [{ key: 'required' }, { key: 'min', params: { min: 0 } }],
          defaultValue: 3600,
          unitLabel: 's',
          displayInViewMode: true
        },
        {
          key: 'readDelay',
          type: 'OibNumber',
          translationKey: 'south.oianalytics.throttling.read-delay',
          validators: [{ key: 'required' }, { key: 'min', params: { min: 0 } }],
          defaultValue: 200,
          unitLabel: 'ms',
          displayInViewMode: true
        },
        {
          key: 'overlap',
          type: 'OibNumber',
          translationKey: 'south.oianalytics.throttling.overlap',
          validators: [{ key: 'required' }, { key: 'min', params: { min: 0 } }],
          defaultValue: 0,
          unitLabel: 'ms',
          displayInViewMode: true
        }
      ]
    },
    {
      key: 'useOiaModule',
      type: 'OibCheckbox',
      translationKey: 'south.oianalytics.use-oia-module',
      validators: [{ key: 'required' }],
      newRow: true,
      defaultValue: true,
      displayInViewMode: true,
      class: 'col-3'
    },
    {
      key: 'timeout',
      type: 'OibNumber',
      translationKey: 'south.oianalytics.timeout',
      defaultValue: 30,
      unitLabel: 's',
      validators: [{ key: 'required' }],
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
          translationKey: 'south.oianalytics.specific-settings.host',
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
          translationKey: 'south.oianalytics.specific-settings.accept-unauthorized',
          validators: [{ key: 'required' }],
          defaultValue: false,
          displayInViewMode: true,
          class: 'col-3'
        },
        {
          key: 'authentication',
          type: 'OibSelect',
          options: ['basic', 'aad-client-secret', 'aad-certificate'],
          translationKey: 'south.oianalytics.specific-settings.authentication',
          defaultValue: 'basic',
          newRow: true,
          validators: [{ key: 'required' }],
          displayInViewMode: true
        },
        {
          key: 'accessKey',
          type: 'OibText',
          translationKey: 'south.oianalytics.specific-settings.access-key',
          validators: [{ key: 'required' }],
          conditionalDisplay: { field: 'authentication', values: ['basic'] },
          newRow: true,
          displayInViewMode: true
        },
        {
          key: 'secretKey',
          type: 'OibSecret',
          translationKey: 'south.oianalytics.specific-settings.secret-key',
          conditionalDisplay: { field: 'authentication', values: ['basic'] },
          displayInViewMode: false
        },
        {
          key: 'tenantId',
          type: 'OibText',
          translationKey: 'south.oianalytics.specific-settings.tenant-id',
          newRow: true,
          conditionalDisplay: { field: 'authentication', values: ['aad-client-secret', 'aad-certificate'] },
          displayInViewMode: true
        },
        {
          key: 'clientId',
          type: 'OibText',
          translationKey: 'south.oianalytics.specific-settings.client-id',
          newRow: false,
          validators: [{ key: 'required' }],
          conditionalDisplay: { field: 'authentication', values: ['aad-client-secret', 'aad-certificate'] },
          displayInViewMode: true
        },
        {
          key: 'clientSecret',
          type: 'OibSecret',
          translationKey: 'south.oianalytics.specific-settings.client-secret',
          newRow: false,
          conditionalDisplay: { field: 'authentication', values: ['aad-client-secret'] }
        },
        {
          key: 'certificateId',
          type: 'OibCertificate',
          translationKey: 'south.oianalytics.specific-settings.certificate-id',
          newRow: false,
          conditionalDisplay: { field: 'authentication', values: ['aad-certificate'] }
        },
        {
          key: 'scope',
          type: 'OibText',
          translationKey: 'south.oianalytics.specific-settings.scope',
          newRow: false,
          conditionalDisplay: { field: 'authentication', values: ['aad-certificate'] }
        },
        {
          key: 'useProxy',
          translationKey: 'south.oianalytics.specific-settings.use-proxy',
          type: 'OibCheckbox',
          newRow: true,
          defaultValue: false,
          displayInViewMode: true,
          validators: [{ key: 'required' }]
        },
        {
          key: 'proxyUrl',
          translationKey: 'south.oianalytics.specific-settings.proxy-url',
          type: 'OibText',
          validators: [{ key: 'required' }],
          conditionalDisplay: { field: 'useProxy', values: [true] }
        },
        {
          key: 'proxyUsername',
          translationKey: 'south.oianalytics.specific-settings.proxy-username',
          type: 'OibText',
          conditionalDisplay: { field: 'useProxy', values: [true] }
        },
        {
          key: 'proxyPassword',
          translationKey: 'south.oianalytics.specific-settings.proxy-password',
          type: 'OibSecret',
          conditionalDisplay: { field: 'useProxy', values: [true] }
        }
      ]
    }
  ],
  items: {
    scanMode: {
      acceptSubscription: false,
      subscriptionOnly: false
    },
    settings: [
      {
        key: 'endpoint',
        type: 'OibText',
        translationKey: 'south.items.oianalytics.endpoint',
        defaultValue: '/endpoint',
        validators: [{ key: 'required' }]
      },
      {
        key: 'queryParams',
        type: 'OibArray',
        translationKey: 'south.items.oianalytics.query-params.query-param',
        content: [
          {
            key: 'key',
            translationKey: 'south.items.oianalytics.query-params.key',
            type: 'OibText',
            defaultValue: '',
            validators: [{ key: 'required' }],
            displayInViewMode: true
          },
          {
            key: 'value',
            translationKey: 'south.items.oianalytics.query-params.value',
            type: 'OibText',
            defaultValue: '',
            validators: [{ key: 'required' }],
            displayInViewMode: true
          }
        ],
        class: 'col',
        newRow: true,
        displayInViewMode: false
      },
      {
        key: 'serialization',
        type: 'OibFormGroup',
        translationKey: 'south.items.oianalytics.serialization.title',
        newRow: true,
        displayInViewMode: false,
        validators: [{ key: 'required' }],
        content: [
          {
            key: 'type',
            type: 'OibSelect',
            translationKey: 'south.items.oianalytics.serialization.type',
            options: ['csv'],
            defaultValue: 'csv',
            newRow: true,
            displayInViewMode: false,
            validators: [{ key: 'required' }]
          },
          {
            key: 'filename',
            type: 'OibText',
            translationKey: 'south.items.oianalytics.serialization.filename',
            defaultValue: '@ConnectorName-@ItemName-@CurrentDate.csv',
            newRow: false,
            displayInViewMode: false,
            validators: [{ key: 'required' }]
          },
          {
            key: 'delimiter',
            type: 'OibSelect',
            translationKey: 'south.items.oianalytics.serialization.delimiter',
            options: ['DOT', 'SEMI_COLON', 'COLON', 'COMMA', 'NON_BREAKING_SPACE', 'SLASH', 'TAB', 'PIPE'],
            defaultValue: 'COMMA',
            newRow: false,
            displayInViewMode: false,
            validators: [{ key: 'required' }]
          },
          {
            key: 'compression',
            type: 'OibCheckbox',
            translationKey: 'south.items.oianalytics.serialization.compression',
            defaultValue: false,
            newRow: false,
            displayInViewMode: false,
            validators: [{ key: 'required' }]
          },
          {
            key: 'outputTimestampFormat',
            type: 'OibText',
            translationKey: 'south.items.oianalytics.serialization.output-timestamp-format',
            defaultValue: 'yyyy-MM-dd HH:mm:ss.SSS',
            newRow: true,
            displayInViewMode: false,
            validators: [{ key: 'required' }]
          },
          {
            key: 'outputTimezone',
            type: 'OibTimezone',
            translationKey: 'south.items.oianalytics.serialization.output-timezone',
            defaultValue: 'Europe/Paris',
            newRow: false,
            displayInViewMode: false,
            validators: [{ key: 'required' }]
          }
        ]
      }
    ]
  }
};

export default manifest;
