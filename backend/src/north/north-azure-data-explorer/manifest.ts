import { NorthConnectorManifest } from '../../../shared/model/north-connector.model';

const manifest: NorthConnectorManifest = {
  id: 'azure-data-explorer',
  category: 'database',
  types: ['any'],
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
        referralPathFromRoot: 'authentication',
        targetPathFromRoot: 'tenantId',
        values: ['aad-app-secret', 'aad-app-certificate']
      },
      {
        referralPathFromRoot: 'authentication',
        targetPathFromRoot: 'clientId',
        values: ['aad-app-secret', 'aad-app-certificate']
      },
      {
        referralPathFromRoot: 'authentication',
        targetPathFromRoot: 'clientSecret',
        values: ['aad-app-secret']
      },
      {
        referralPathFromRoot: 'authentication',
        targetPathFromRoot: 'certificateId',
        values: ['aad-app-certificate']
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
        key: 'clusterUrl',
        translationKey: 'configuration.oibus.manifest.north.azure-data-explorer.cluster-url',
        defaultValue: null,
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
          displayInViewMode: true
        }
      },
      {
        type: 'string',
        key: 'database',
        translationKey: 'configuration.oibus.manifest.north.azure-data-explorer.database',
        defaultValue: null,
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
        type: 'string',
        key: 'table',
        translationKey: 'configuration.oibus.manifest.north.azure-data-explorer.table',
        defaultValue: null,
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
        type: 'string-select',
        key: 'authentication',
        translationKey: 'configuration.oibus.manifest.north.azure-data-explorer.authentication',
        defaultValue: 'aad-app-secret',
        selectableValues: ['aad-app-secret', 'aad-app-certificate', 'managed-identity'],
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          }
        ],
        displayProperties: {
          row: 1,
          columns: 3,
          displayInViewMode: true
        }
      },
      {
        type: 'string',
        key: 'tenantId',
        translationKey: 'configuration.oibus.manifest.north.azure-data-explorer.tenant-id',
        defaultValue: null,
        validators: [],
        displayProperties: {
          row: 1,
          columns: 3,
          displayInViewMode: true
        }
      },
      {
        type: 'string',
        key: 'clientId',
        translationKey: 'configuration.oibus.manifest.north.azure-data-explorer.client-id',
        defaultValue: null,
        validators: [],
        displayProperties: {
          row: 1,
          columns: 3,
          displayInViewMode: true
        }
      },
      {
        type: 'secret',
        key: 'clientSecret',
        translationKey: 'configuration.oibus.manifest.north.azure-data-explorer.client-secret',
        validators: [],
        displayProperties: {
          row: 1,
          columns: 3,
          displayInViewMode: false
        }
      },
      {
        type: 'certificate',
        key: 'certificateId',
        translationKey: 'configuration.oibus.manifest.north.azure-data-explorer.certificate-id',
        validators: [],
        displayProperties: {
          row: 1,
          columns: 3,
          displayInViewMode: false
        }
      },
      {
        type: 'string-select',
        key: 'dataFormat',
        translationKey: 'configuration.oibus.manifest.north.azure-data-explorer.data-format',
        defaultValue: 'csv',
        selectableValues: ['csv', 'json', 'multijson'],
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          }
        ],
        displayProperties: {
          row: 2,
          columns: 3,
          displayInViewMode: true
        }
      },
      {
        type: 'string',
        key: 'ingestionMappingName',
        translationKey: 'configuration.oibus.manifest.north.azure-data-explorer.ingestion-mapping-name',
        defaultValue: null,
        validators: [],
        displayProperties: {
          row: 2,
          columns: 3,
          displayInViewMode: true
        }
      },
      {
        type: 'boolean',
        key: 'useProxy',
        translationKey: 'configuration.oibus.manifest.north.azure-data-explorer.use-proxy',
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
        translationKey: 'configuration.oibus.manifest.north.azure-data-explorer.proxy-url',
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
        translationKey: 'configuration.oibus.manifest.north.azure-data-explorer.proxy-username',
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
        translationKey: 'configuration.oibus.manifest.north.azure-data-explorer.proxy-password',
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
