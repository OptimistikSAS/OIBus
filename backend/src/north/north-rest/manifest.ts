import { NorthConnectorManifest } from '../../../shared/model/north-connector.model';

const manifest: NorthConnectorManifest = {
  id: 'rest',
  category: 'file',
  types: ['any', 'time-values'],
  settings: {
    type: 'object',
    key: 'settings',
    translationKey: 'configuration.oibus.manifest.north.settings',
    displayProperties: {
      visible: true,
      wrapInBox: false
    },
    enablingConditions: [
      {
        referralPathFromRoot: 'authType',
        targetPathFromRoot: 'basicAuthUsername',
        values: ['basic']
      },
      {
        referralPathFromRoot: 'authType',
        targetPathFromRoot: 'basicAuthPassword',
        values: ['basic']
      },
      {
        referralPathFromRoot: 'authType',
        targetPathFromRoot: 'bearerAuthToken',
        values: ['bearer']
      },
      {
        referralPathFromRoot: 'useProxy',
        targetPathFromRoot: 'proxyUrl',
        values: [true]
      },
      {
        referralPathFromRoot: 'useProxy',
        targetPathFromRoot: 'proxyUsername',
        values: [true]
      },
      {
        referralPathFromRoot: 'useProxy',
        targetPathFromRoot: 'proxyPassword',
        values: [true]
      }
    ],
    validators: [],
    attributes: [
      {
        type: 'string',
        key: 'host',
        translationKey: 'configuration.oibus.manifest.north.rest.specific-settings.host',
        defaultValue: 'https://instance_name.fr',
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          },
          {
            type: 'PATTERN',
            arguments: ['^(http:\\/\\/|https:\\/\\/|HTTP:\\/\\/|HTTPS:\\/\\/).*']
          }
        ],
        displayProperties: {
          row: 0,
          columns: 8,
          displayInViewMode: true
        }
      },
      {
        type: 'boolean',
        key: 'acceptUnauthorized',
        translationKey: 'configuration.oibus.manifest.north.rest.accept-unauthorized',
        defaultValue: false,
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          }
        ],
        displayProperties: {
          row: 0,
          columns: 4,
          displayInViewMode: true
        }
      },
      {
        type: 'string',
        key: 'endpoint',
        translationKey: 'configuration.oibus.manifest.north.rest.endpoint',
        defaultValue: '/endpoint',
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          }
        ],
        displayProperties: {
          row: 1,
          columns: 6,
          displayInViewMode: true
        }
      },
      {
        type: 'string',
        key: 'testPath',
        translationKey: 'configuration.oibus.manifest.north.rest.test-endpoint',
        defaultValue: '/',
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          }
        ],
        displayProperties: {
          row: 1,
          columns: 6,
          displayInViewMode: true
        }
      },
      {
        type: 'number',
        key: 'timeout',
        translationKey: 'configuration.oibus.manifest.north.rest.timeout',
        unit: 's',
        defaultValue: 30,
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          },
          {
            type: 'POSITIVE_INTEGER',
            arguments: []
          }
        ],
        displayProperties: {
          row: 2,
          columns: 6,
          displayInViewMode: false
        }
      },
      {
        type: 'string-select',
        key: 'authType',
        translationKey: 'configuration.oibus.manifest.north.rest.auth.auth-type',
        defaultValue: 'basic',
        selectableValues: ['basic', 'bearer'],
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          }
        ],
        displayProperties: {
          row: 3,
          columns: 4,
          displayInViewMode: true
        }
      },

      {
        type: 'secret',
        key: 'bearerAuthToken',
        translationKey: 'configuration.oibus.manifest.north.rest.auth.bearer-token',
        validators: [],
        displayProperties: {
          row: 3,
          columns: 4,
          displayInViewMode: true
        }
      },
      {
        type: 'string',
        key: 'basicAuthUsername',
        translationKey: 'configuration.oibus.manifest.north.rest.auth.basic-username',
        defaultValue: null,
        validators: [{ type: 'REQUIRED', arguments: [] }],
        displayProperties: {
          row: 3,
          columns: 4,
          displayInViewMode: true
        }
      },
      {
        type: 'secret',
        key: 'basicAuthPassword',
        translationKey: 'configuration.oibus.manifest.north.rest.auth.basic-password',
        validators: [],
        displayProperties: {
          row: 3,
          columns: 4,
          displayInViewMode: true
        }
      },
      {
        type: 'array',
        key: 'queryParams',
        translationKey: 'configuration.oibus.manifest.north.rest.query-params',
        paginate: false,
        numberOfElementPerPage: 0,
        validators: [],
        rootAttribute: {
          type: 'object',
          key: 'queryParam',
          translationKey: 'configuration.oibus.manifest.north.rest.query-params.query-param',
          displayProperties: {
            visible: true,
            wrapInBox: false
          },
          enablingConditions: [],
          validators: [],
          attributes: [
            {
              type: 'string',
              key: 'key',
              translationKey: 'configuration.oibus.manifest.north.rest.query-params.key',
              defaultValue: null,
              validators: [
                {
                  type: 'REQUIRED',
                  arguments: []
                }
              ],
              displayProperties: {
                row: 0,
                columns: 4,
                displayInViewMode: true
              }
            },
            {
              type: 'string',
              key: 'value',
              translationKey: 'configuration.oibus.manifest.north.rest.query-params.value',
              defaultValue: null,
              validators: [
                {
                  type: 'REQUIRED',
                  arguments: []
                }
              ],
              displayProperties: {
                row: 0,
                columns: 4,
                displayInViewMode: true
              }
            }
          ]
        }
      },
      {
        type: 'boolean',
        key: 'useProxy',
        translationKey: 'configuration.oibus.manifest.north.rest.use-proxy',
        defaultValue: false,
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          }
        ],
        displayProperties: {
          row: 3,
          columns: 3,
          displayInViewMode: true
        }
      },
      {
        type: 'string',
        key: 'proxyUrl',
        translationKey: 'configuration.oibus.manifest.north.rest.proxy-url',
        defaultValue: null,
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          }
        ],
        displayProperties: {
          row: 3,
          columns: 3,
          displayInViewMode: true
        }
      },
      {
        type: 'string',
        key: 'proxyUsername',
        translationKey: 'configuration.oibus.manifest.north.rest.proxy-username',
        defaultValue: null,
        validators: [],
        displayProperties: {
          row: 3,
          columns: 3,
          displayInViewMode: true
        }
      },
      {
        type: 'secret',
        key: 'proxyPassword',
        translationKey: 'configuration.oibus.manifest.north.rest.proxy-password',
        validators: [],
        displayProperties: {
          row: 3,
          columns: 3,
          displayInViewMode: true
        }
      }
    ]
  }
};

export default manifest;
