import { NorthConnectorManifest } from '../../../shared/model/north-connector.model';

const manifest: NorthConnectorManifest = {
  id: 'opcua',
  category: 'iot',
  types: ['opcua'],
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
        referralPathFromRoot: 'securityMode',
        targetPathFromRoot: 'securityPolicy',
        values: ['sign', 'sign-and-encrypt']
      }
    ],
    validators: [],
    attributes: [
      {
        type: 'string',
        key: 'url',
        translationKey: 'configuration.oibus.manifest.north.opcua.url',
        defaultValue: 'opc.tcp://hostname:53530/OPCUA/SimulationServer',
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          },
          {
            type: 'PATTERN',
            arguments: ['^(http:\\/\\/|opc.tcp:\\/\\/).*']
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
        key: 'keepSessionAlive',
        translationKey: 'configuration.oibus.manifest.north.opcua.keep-session-alive',
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
        type: 'number',
        key: 'retryInterval',
        translationKey: 'configuration.oibus.manifest.north.opcua.retry-interval',
        unit: 'ms',
        defaultValue: 10000,
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          },
          {
            type: 'MINIMUM',
            arguments: ['100']
          },
          {
            type: 'MAXIMUM',
            arguments: ['30000']
          }
        ],
        displayProperties: {
          row: 1,
          columns: 4,
          displayInViewMode: true
        }
      },
      {
        type: 'string-select',
        key: 'securityMode',
        translationKey: 'configuration.oibus.manifest.north.opcua.security-mode',
        defaultValue: 'none',
        selectableValues: ['none', 'sign', 'sign-and-encrypt'],
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          }
        ],
        displayProperties: {
          row: 2,
          columns: 6,
          displayInViewMode: true
        }
      },
      {
        type: 'string-select',
        key: 'securityPolicy',
        translationKey: 'configuration.oibus.manifest.north.opcua.security-policy',
        defaultValue: 'none',
        selectableValues: [
          'none',
          'basic128',
          'basic192',
          'basic192-rsa15',
          'basic256-rsa15',
          'basic256-sha256',
          'aes128-sha256-rsa-oaep',
          'pub-sub-aes-128-ctr',
          'pub-sub-aes-256-ctr'
        ],
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          }
        ],
        displayProperties: {
          row: 2,
          columns: 6,
          displayInViewMode: true
        }
      },
      {
        type: 'object',
        key: 'authentication',
        translationKey: 'configuration.oibus.manifest.north.opcua.authentication.title',
        displayProperties: {
          visible: true,
          wrapInBox: false
        },
        enablingConditions: [
          {
            referralPathFromRoot: 'type',
            targetPathFromRoot: 'username',
            values: ['basic']
          },
          {
            referralPathFromRoot: 'type',
            targetPathFromRoot: 'password',
            values: ['basic']
          },
          {
            referralPathFromRoot: 'type',
            targetPathFromRoot: 'certFilePath',
            values: ['cert']
          },
          {
            referralPathFromRoot: 'type',
            targetPathFromRoot: 'keyFilePath',
            values: ['cert']
          }
        ],
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          }
        ],
        attributes: [
          {
            type: 'string-select',
            key: 'type',
            translationKey: 'configuration.oibus.manifest.north.opcua.authentication',
            defaultValue: 'none',
            selectableValues: ['none', 'basic', 'cert'],
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
            key: 'username',
            translationKey: 'configuration.oibus.manifest.north.opcua.username',
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
            type: 'secret',
            key: 'password',
            translationKey: 'configuration.oibus.manifest.north.opcua.password',
            validators: [],
            displayProperties: {
              row: 0,
              columns: 4,
              displayInViewMode: true
            }
          },
          {
            type: 'string',
            key: 'certFilePath',
            translationKey: 'configuration.oibus.manifest.north.opcua.cert-file-path',
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
            key: 'keyFilePath',
            translationKey: 'configuration.oibus.manifest.north.opcua.key-file-path',
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
    ]
  }
};
export default manifest;
