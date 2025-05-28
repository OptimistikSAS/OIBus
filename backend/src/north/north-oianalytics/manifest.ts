import { NorthConnectorManifest } from '../../../shared/model/north-connector.model';

const manifest: NorthConnectorManifest = {
  id: 'oianalytics',
  category: 'api',
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
        referralPathFromRoot: 'useOiaModule',
        targetPathFromRoot: 'specificSettings',
        values: [false]
      }
    ],
    validators: [],
    attributes: [
      {
        type: 'boolean',
        key: 'useOiaModule',
        translationKey: 'configuration.oibus.manifest.north.oianalytics.use-oianalytics-module',
        defaultValue: true,
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          }
        ],
        displayProperties: {
          row: 0,
          columns: 3,
          displayInViewMode: true
        }
      },
      {
        type: 'number',
        key: 'timeout',
        translationKey: 'configuration.oibus.manifest.north.oianalytics.timeout',
        defaultValue: 30,
        unit: 's',
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
          row: 0,
          columns: 3,
          displayInViewMode: true
        }
      },
      {
        type: 'boolean',
        key: 'compress',
        translationKey: 'configuration.oibus.manifest.north.oianalytics.compress',
        defaultValue: false,
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          }
        ],
        displayProperties: {
          row: 0,
          columns: 3,
          displayInViewMode: true
        }
      },
      {
        type: 'object',
        key: 'specificSettings',
        translationKey: 'configuration.oibus.manifest.north.oianalytics.specific-settings',
        displayProperties: {
          visible: true,
          wrapInBox: false
        },
        enablingConditions: [
          {
            referralPathFromRoot: 'authentication',
            targetPathFromRoot: 'accessKey',
            values: ['basic']
          },
          {
            referralPathFromRoot: 'authentication',
            targetPathFromRoot: 'secretKey',
            values: ['basic']
          },
          {
            referralPathFromRoot: 'authentication',
            targetPathFromRoot: 'tenantId',
            values: ['aad-client-secret', 'aad-certificate']
          },
          {
            referralPathFromRoot: 'authentication',
            targetPathFromRoot: 'clientId',
            values: ['aad-client-secret', 'aad-certificate']
          },
          {
            referralPathFromRoot: 'authentication',
            targetPathFromRoot: 'clientSecret',
            values: ['aad-client-secret']
          },
          {
            referralPathFromRoot: 'authentication',
            targetPathFromRoot: 'certificateId',
            values: ['aad-certificate']
          },
          {
            referralPathFromRoot: 'authentication',
            targetPathFromRoot: 'scope',
            values: ['aad-certificate']
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
            translationKey: 'configuration.oibus.manifest.north.oianalytics.specific-settings.host',
            defaultValue: 'https://instance_name.oianalytics.fr',
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
              columns: 6,
              displayInViewMode: false
            }
          },
          {
            type: 'boolean',
            key: 'acceptUnauthorized',
            translationKey: 'configuration.oibus.manifest.north.oianalytics.specific-settings.accept-unauthorized',
            defaultValue: false,
            validators: [
              {
                type: 'REQUIRED',
                arguments: []
              }
            ],
            displayProperties: {
              row: 0,
              columns: 6,
              displayInViewMode: false
            }
          },
          {
            type: 'string-select',
            key: 'authentication',
            translationKey: 'configuration.oibus.manifest.north.oianalytics.specific-settings.authentication',
            validators: [
              {
                type: 'REQUIRED',
                arguments: []
              }
            ],
            defaultValue: 'basic',
            selectableValues: ['basic', 'aad-client-secret', 'aad-certificate'],
            displayProperties: {
              row: 1,
              columns: 6,
              displayInViewMode: false
            }
          },
          {
            type: 'string',
            key: 'accessKey',
            translationKey: 'configuration.oibus.manifest.north.oianalytics.specific-settings.access-key',
            defaultValue: null,
            validators: [
              {
                type: 'REQUIRED',
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
            type: 'secret',
            key: 'secretKey',
            translationKey: 'configuration.oibus.manifest.north.oianalytics.specific-settings.secret-key',
            validators: [],
            displayProperties: {
              row: 2,
              columns: 6,
              displayInViewMode: false
            }
          },
          {
            type: 'string',
            key: 'tenantId',
            translationKey: 'configuration.oibus.manifest.north.oianalytics.specific-settings.tenant-id',
            defaultValue: null,
            validators: [],
            displayProperties: {
              row: 2,
              columns: 3,
              displayInViewMode: false
            }
          },
          {
            type: 'string',
            key: 'clientId',
            translationKey: 'configuration.oibus.manifest.north.oianalytics.specific-settings.client-id',
            defaultValue: null,
            validators: [
              {
                type: 'REQUIRED',
                arguments: []
              }
            ],
            displayProperties: {
              row: 2,
              columns: 3,
              displayInViewMode: false
            }
          },
          {
            type: 'secret',
            key: 'clientSecret',
            translationKey: 'configuration.oibus.manifest.north.oianalytics.specific-settings.client-secret',
            validators: [],
            displayProperties: {
              row: 2,
              columns: 3,
              displayInViewMode: false
            }
          },
          {
            type: 'certificate',
            key: 'certificateId',
            translationKey: 'configuration.oibus.manifest.north.oianalytics.specific-settings.certificate-id',
            validators: [],
            displayProperties: {
              row: 2,
              columns: 3,
              displayInViewMode: false
            }
          },
          {
            type: 'string',
            key: 'scope',
            translationKey: 'configuration.oibus.manifest.north.oianalytics.specific-settings.scope',
            defaultValue: null,
            validators: [],
            displayProperties: {
              row: 2,
              columns: 3,
              displayInViewMode: false
            }
          },
          {
            type: 'boolean',
            key: 'useProxy',
            translationKey: 'configuration.oibus.manifest.north.oianalytics.specific-settings.use-proxy',
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
            translationKey: 'configuration.oibus.manifest.north.oianalytics.specific-settings.proxy-url',
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
            translationKey: 'configuration.oibus.manifest.north.oianalytics.specific-settings.proxy-username',
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
            translationKey: 'configuration.oibus.manifest.north.oianalytics.specific-settings.proxy-password',
            validators: [],
            displayProperties: {
              row: 3,
              columns: 3,
              displayInViewMode: true
            }
          }
        ]
      }
    ]
  }
};

export default manifest;
