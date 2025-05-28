import { NorthConnectorManifest } from '../../../shared/model/north-connector.model';

const manifest: NorthConnectorManifest = {
  id: 'azure-blob',
  category: 'file',
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
        referralPathFromRoot: 'useCustomUrl',
        targetPathFromRoot: 'account',
        values: [false]
      },
      {
        referralPathFromRoot: 'useCustomUrl',
        targetPathFromRoot: 'customUrl',
        values: [true]
      },
      {
        referralPathFromRoot: 'authentication',
        targetPathFromRoot: 'accessKey',
        values: ['access-key']
      },
      {
        referralPathFromRoot: 'authentication',
        targetPathFromRoot: 'sasToken',
        values: ['sas-token']
      },
      {
        referralPathFromRoot: 'authentication',
        targetPathFromRoot: 'tenantId',
        values: ['aad']
      },
      {
        referralPathFromRoot: 'authentication',
        targetPathFromRoot: 'clientId',
        values: ['aad']
      },
      {
        referralPathFromRoot: 'authentication',
        targetPathFromRoot: 'clientSecret',
        values: ['aad']
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
        type: 'boolean',
        key: 'useADLS',
        translationKey: 'configuration.oibus.manifest.north.azure-blob.use-adls',
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
        type: 'boolean',
        key: 'useCustomUrl',
        translationKey: 'configuration.oibus.manifest.north.azure-blob.use-custom-url',
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
        type: 'string',
        key: 'account',
        translationKey: 'configuration.oibus.manifest.north.azure-blob.account',
        defaultValue: null,
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
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
        key: 'customUrl',
        translationKey: 'configuration.oibus.manifest.north.azure-blob.custom-url',
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
        key: 'container',
        translationKey: 'configuration.oibus.manifest.north.azure-blob.container',
        defaultValue: null,
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
        key: 'path',
        translationKey: 'configuration.oibus.manifest.north.azure-blob.path',
        defaultValue: null,
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
        type: 'string-select',
        key: 'authentication',
        translationKey: 'configuration.oibus.manifest.north.azure-blob.authentication',
        defaultValue: 'access-key',
        selectableValues: ['access-key', 'sas-token', 'aad', 'external'],
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
        type: 'secret',
        key: 'accessKey',
        translationKey: 'configuration.oibus.manifest.north.azure-blob.access-key',
        validators: [],
        displayProperties: {
          row: 2,
          columns: 3,
          displayInViewMode: true
        }
      },
      {
        type: 'secret',
        key: 'sasToken',
        translationKey: 'configuration.oibus.manifest.north.azure-blob.sas-token',
        validators: [],
        displayProperties: {
          row: 2,
          columns: 3,
          displayInViewMode: false
        }
      },
      {
        type: 'string',
        key: 'tenantId',
        translationKey: 'configuration.oibus.manifest.north.azure-blob.tenant-id',
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
        translationKey: 'configuration.oibus.manifest.north.azure-blob.client-id',
        defaultValue: null,
        validators: [],
        displayProperties: {
          row: 2,
          columns: 3,
          displayInViewMode: true
        }
      },
      {
        type: 'secret',
        key: 'clientSecret',
        translationKey: 'configuration.oibus.manifest.north.azure-blob.client-secret',
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
        translationKey: 'configuration.oibus.manifest.north.azure-blob.use-proxy',
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
        translationKey: 'configuration.oibus.manifest.north.azure-blob.proxy-url',
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
        translationKey: 'configuration.oibus.manifest.north.azure-blob.proxy-username',
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
        translationKey: 'configuration.oibus.manifest.north.azure-blob.proxy-password',
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
