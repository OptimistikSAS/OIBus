import { NorthConnectorManifest } from '../../../shared/model/north-connector.model';

const manifest: NorthConnectorManifest = {
  id: 'mqtt',
  category: 'iot',
  types: ['mqtt'],
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
        referralPathFromRoot: 'sharedConnection',
        targetPathFromRoot: 'connectionSettings',
        values: [null]
      }
    ],
    validators: [],
    attributes: [
      {
        type: 'sharable-connector',
        key: 'sharedConnection',
        translationKey: 'configuration.oibus.manifest.north.mqtt.shared-connection',
        validators: [],
        displayProperties: {
          row: 0,
          columns: 8,
          displayInViewMode: false
        }
      },
      {
        type: 'number',
        key: 'retryInterval',
        translationKey: 'configuration.oibus.manifest.north.mqtt.retry-interval',
        unit: 'ms',
        defaultValue: 10_000,
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
          row: 0,
          columns: 4,
          displayInViewMode: true
        }
      },
      {
        type: 'object',
        key: 'connectionSettings',
        translationKey: 'configuration.oibus.manifest.north.mqtt.connection-settings.authentication.title',
        displayProperties: {
          visible: true,
          wrapInBox: false
        },
        enablingConditions: [],
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          }
        ],
        attributes: [
          {
            type: 'string',
            key: 'url',
            translationKey: 'configuration.oibus.manifest.north.mqtt.url',
            defaultValue: null,
            validators: [
              {
                type: 'REQUIRED',
                arguments: []
              },
              {
                type: 'PATTERN',
                arguments: ['^(mqtt:\\/\\/|mqtts:\\/\\/|tcp:\\/\\/|tls:\\/\\/|ws:\\/\\/|wss:\\/\\/).*']
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
            key: 'persistent',
            translationKey: 'configuration.oibus.manifest.north.mqtt.persistent',
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
            type: 'object',
            key: 'authentication',
            translationKey: 'configuration.oibus.manifest.north.mqtt.authentication.title',
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
              },
              {
                referralPathFromRoot: 'type',
                targetPathFromRoot: 'caFilePath',
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
                translationKey: 'configuration.oibus.manifest.north.mqtt.authentication',
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
                translationKey: 'configuration.oibus.manifest.north.mqtt.authentication.username',
                defaultValue: null,
                validators: [
                  {
                    type: 'REQUIRED',
                    arguments: []
                  }
                ],
                displayProperties: {
                  row: 1,
                  columns: 4,
                  displayInViewMode: true
                }
              },
              {
                type: 'secret',
                key: 'password',
                translationKey: 'configuration.oibus.manifest.north.mqtt.authentication.password',
                validators: [],
                displayProperties: {
                  row: 1,
                  columns: 4,
                  displayInViewMode: true
                }
              },
              {
                type: 'string',
                key: 'certFilePath',
                translationKey: 'configuration.oibus.manifest.north.mqtt.authentication.cert-file-path',
                defaultValue: null,
                validators: [
                  {
                    type: 'REQUIRED',
                    arguments: []
                  }
                ],
                displayProperties: {
                  row: 1,
                  columns: 4,
                  displayInViewMode: true
                }
              },
              {
                type: 'string',
                key: 'keyFilePath',
                translationKey: 'configuration.oibus.manifest.north.mqtt.authentication.key-file-path',
                defaultValue: null,
                validators: [
                  {
                    type: 'REQUIRED',
                    arguments: []
                  }
                ],
                displayProperties: {
                  row: 1,
                  columns: 4,
                  displayInViewMode: true
                }
              },
              {
                type: 'string',
                key: 'caFilePath',
                translationKey: 'configuration.oibus.manifest.north.mqtt.authentication.ca-file-path',
                defaultValue: null,
                validators: [
                  {
                    type: 'REQUIRED',
                    arguments: []
                  }
                ],
                displayProperties: {
                  row: 1,
                  columns: 4,
                  displayInViewMode: true
                }
              }
            ]
          },
          {
            type: 'boolean',
            key: 'rejectUnauthorized',
            translationKey: 'configuration.oibus.manifest.north.mqtt.reject-unauthorized',
            defaultValue: false,
            validators: [
              {
                type: 'REQUIRED',
                arguments: []
              }
            ],
            displayProperties: {
              row: 2,
              columns: 4,
              displayInViewMode: true
            }
          },
          {
            type: 'number',
            key: 'connectTimeout',
            translationKey: 'configuration.oibus.manifest.north.mqtt.connect-timeout',
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
              row: 2,
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
