import { NorthConnectorManifest } from '../../../shared/model/north-connector.model';

const manifest: NorthConnectorManifest = {
  id: 'rest',
  category: 'file',
  modes: {
    files: true,
    points: false
  },
  settings: [
    {
      key: 'endpoint',
      type: 'OibText',
      newRow: true,
      translationKey: 'north.rest.endpoint',
      defaultValue: '',
      displayInViewMode: true,
      validators: [{ key: 'required' }]
    },
    {
      key: 'testPath',
      type: 'OibText',
      translationKey: 'north.rest.test-path',
      defaultValue: '/',
      validators: [{ key: 'required' }],
      class: 'col-3'
    },
    {
      key: 'timeout',
      type: 'OibNumber',
      translationKey: 'north.rest.timeout',
      defaultValue: 30,
      unitLabel: 's',
      validators: [{ key: 'required' }],
      class: 'col-3'
    },
    {
      key: 'authType',
      type: 'OibSelect',
      newRow: true,
      translationKey: 'north.rest.auth.auth-type',
      defaultValue: 'basic',
      displayInViewMode: true,
      validators: [{ key: 'required' }],
      options: ['basic', 'bearer']
    },
    {
      key: 'bearerAuthToken',
      type: 'OibSecret',
      translationKey: 'north.rest.auth.bearer-token',
      defaultValue: '',
      conditionalDisplay: { field: 'authType', values: ['bearer'] }
    },
    {
      key: 'basicAuthUsername',
      type: 'OibText',
      translationKey: 'north.rest.auth.basic-username',
      defaultValue: '',
      validators: [{ key: 'required' }],
      conditionalDisplay: { field: 'authType', values: ['basic'] }
    },
    {
      key: 'basicAuthPassword',
      type: 'OibSecret',
      translationKey: 'north.rest.auth.basic-password',
      defaultValue: '',
      conditionalDisplay: { field: 'authType', values: ['basic'] }
    },
    {
      key: 'queryParams',
      type: 'OibArray',
      translationKey: 'north.rest.query-params.query-param',
      content: [
        {
          key: 'key',
          translationKey: 'north.rest.query-params.key',
          type: 'OibText',
          defaultValue: '',
          validators: [{ key: 'required' }],
          displayInViewMode: true
        },
        {
          key: 'value',
          translationKey: 'north.rest.query-params.value',
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
      key: 'useProxy',
      translationKey: 'north.rest.use-proxy',
      type: 'OibCheckbox',
      newRow: true,
      defaultValue: false,
      displayInViewMode: true,
      validators: [{ key: 'required' }]
    },
    {
      key: 'proxyUrl',
      translationKey: 'north.rest.proxy-url',
      type: 'OibText',
      validators: [{ key: 'required' }],
      conditionalDisplay: { field: 'useProxy', values: [true] }
    },
    {
      key: 'proxyUsername',
      translationKey: 'north.rest.proxy-username',
      type: 'OibText',
      conditionalDisplay: { field: 'useProxy', values: [true] }
    },
    {
      key: 'proxyPassword',
      translationKey: 'north.rest.proxy-password',
      type: 'OibSecret',
      conditionalDisplay: { field: 'useProxy', values: [true] }
    }
  ]
};

export default manifest;
