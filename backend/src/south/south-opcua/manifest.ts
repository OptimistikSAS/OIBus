import { SouthConnectorManifest } from '../../../shared/model/south-connector.model';

const manifest: SouthConnectorManifest = {
  id: 'opcua',
  category: 'iot',
  modes: {
    subscription: true,
    lastPoint: true,
    lastFile: false,
    history: true
  },
  settings: {
    type: 'object',
    key: 'settings',
    translationKey: 'configuration.oibus.manifest.south.settings',
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
        type: 'object',
        key: 'throttling',
        translationKey: 'configuration.oibus.manifest.south.opcua.throttling.title',
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
            type: 'number',
            key: 'maxReadInterval',
            translationKey: 'configuration.oibus.manifest.south.opcua.throttling.max-read-interval',
            unit: 's',
            defaultValue: 3600,
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
            type: 'number',
            key: 'readDelay',
            translationKey: 'configuration.oibus.manifest.south.opcua.throttling.read-delay',
            unit: 'ms',
            defaultValue: 200,
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
            type: 'number',
            key: 'overlap',
            translationKey: 'configuration.oibus.manifest.south.opcua.throttling.overlap',
            unit: 'ms',
            defaultValue: 0,
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
            key: 'maxInstantPerItem',
            translationKey: 'configuration.oibus.manifest.south.opcua.throttling.max-instant-per-item',
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
          }
        ]
      },
      {
        type: 'boolean',
        key: 'sharedConnection',
        translationKey: 'configuration.oibus.manifest.south.opcua.shared-connection',
        defaultValue: false,
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          }
        ],
        displayProperties: {
          row: 0,
          columns: 8,
          displayInViewMode: false
        }
      },
      {
        type: 'string',
        key: 'url',
        translationKey: 'configuration.oibus.manifest.south.opcua.url',
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
          row: 1,
          columns: 8,
          displayInViewMode: true
        }
      },
      {
        type: 'boolean',
        key: 'keepSessionAlive',
        translationKey: 'configuration.oibus.manifest.south.opcua.keep-session-alive',
        defaultValue: false,
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
        type: 'number',
        key: 'readTimeout',
        translationKey: 'configuration.oibus.manifest.south.opcua.read-timeout',
        unit: 'ms',
        defaultValue: 15000,
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
            arguments: ['3600000']
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
        key: 'retryInterval',
        translationKey: 'configuration.oibus.manifest.south.opcua.retry-interval',
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
      },
      {
        type: 'number',
        key: 'maxNumberOfMessages',
        translationKey: 'configuration.oibus.manifest.south.opcua.max-number-of-messages',
        defaultValue: 1000,
        unit: null,
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          },
          {
            type: 'MINIMUM',
            arguments: ['1']
          },
          {
            type: 'MAXIMUM',
            arguments: ['1000000']
          }
        ],
        displayProperties: {
          row: 3,
          columns: 4,
          displayInViewMode: true
        }
      },
      {
        type: 'number',
        key: 'flushMessageTimeout',
        translationKey: 'configuration.oibus.manifest.south.opcua.flush-message-timeout',
        unit: 'ms',
        defaultValue: 1000,
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          },
          {
            type: 'MINIMUM',
            arguments: ['1']
          },
          {
            type: 'MAXIMUM',
            arguments: ['1000000']
          }
        ],
        displayProperties: {
          row: 3,
          columns: 4,
          displayInViewMode: true
        }
      },
      {
        type: 'string-select',
        key: 'securityMode',
        translationKey: 'configuration.oibus.manifest.south.opcua.security-mode',
        defaultValue: 'none',
        selectableValues: ['none', 'sign', 'sign-and-encrypt'],
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          }
        ],
        displayProperties: {
          row: 4,
          columns: 6,
          displayInViewMode: true
        }
      },
      {
        type: 'string-select',
        key: 'securityPolicy',
        translationKey: 'configuration.oibus.manifest.south.opcua.security-policy',
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
          row: 4,
          columns: 6,
          displayInViewMode: true
        }
      },
      {
        type: 'object',
        key: 'authentication',
        translationKey: 'configuration.oibus.manifest.south.opcua.authentication.title',
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
            translationKey: 'configuration.oibus.manifest.south.opcua.authentication',
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
            translationKey: 'configuration.oibus.manifest.south.opcua.username',
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
            translationKey: 'configuration.oibus.manifest.south.opcua.password',
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
            translationKey: 'configuration.oibus.manifest.south.opcua.cert-file-path',
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
            translationKey: 'configuration.oibus.manifest.south.opcua.key-file-path',
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
  },
  items: {
    type: 'array',
    key: 'items',
    translationKey: 'configuration.oibus.manifest.south.items',
    paginate: true,
    numberOfElementPerPage: 20,
    validators: [],
    rootAttribute: {
      type: 'object',
      key: 'item',
      translationKey: 'configuration.oibus.manifest.south.items.item',
      displayProperties: {
        visible: true,
        wrapInBox: false
      },
      enablingConditions: [],
      validators: [],
      attributes: [
        {
          type: 'string',
          key: 'name',
          translationKey: 'configuration.oibus.manifest.south.items.name',
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
          type: 'boolean',
          key: 'enabled',
          translationKey: 'configuration.oibus.manifest.south.items.enabled',
          defaultValue: true,
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
          type: 'scan-mode',
          key: 'scanMode',
          acceptableType: 'SUBSCRIPTION_AND_POLL',
          translationKey: 'configuration.oibus.manifest.south.items.scan-mode',
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
          key: 'settings',
          translationKey: 'configuration.oibus.manifest.south.items.settings',
          displayProperties: {
            visible: true,
            wrapInBox: true
          },
          enablingConditions: [
            {
              referralPathFromRoot: 'mode',
              targetPathFromRoot: 'haMode',
              values: ['ha']
            },
            {
              referralPathFromRoot: 'mode',
              targetPathFromRoot: 'timestampOrigin',
              values: ['da']
            }
          ],
          validators: [],
          attributes: [
            {
              type: 'string',
              key: 'nodeId',
              translationKey: 'configuration.oibus.manifest.south.items.opcua.node-id',
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
              type: 'string-select',
              key: 'mode',
              translationKey: 'configuration.oibus.manifest.south.items.opcua.mode',
              defaultValue: 'ha',
              selectableValues: ['ha', 'da'],
              validators: [
                {
                  type: 'REQUIRED',
                  arguments: []
                }
              ],
              displayProperties: {
                row: 0,
                columns: 4,
                displayInViewMode: false
              }
            },
            {
              type: 'object',
              key: 'haMode',
              translationKey: 'configuration.oibus.manifest.south.items.opcua.ha-mode.title',
              displayProperties: {
                visible: true,
                wrapInBox: false
              },
              enablingConditions: [
                {
                  referralPathFromRoot: 'aggregate',
                  targetPathFromRoot: 'resampling',
                  values: ['average', 'minimum', 'maximum', 'count']
                }
              ],
              validators: [],
              attributes: [
                {
                  type: 'string-select',
                  key: 'aggregate',
                  translationKey: 'configuration.oibus.manifest.south.items.opcua.ha-mode.aggregate',
                  defaultValue: 'raw',
                  selectableValues: ['raw', 'average', 'minimum', 'maximum', 'count'],
                  validators: [
                    {
                      type: 'REQUIRED',
                      arguments: []
                    }
                  ],
                  displayProperties: {
                    row: 0,
                    columns: 4,
                    displayInViewMode: false
                  }
                },
                {
                  type: 'string-select',
                  key: 'resampling',
                  translationKey: 'configuration.oibus.manifest.south.items.opcua.ha-mode.resampling',
                  defaultValue: 'raw',
                  selectableValues: ['none', '1s', '10s', '30s', '1min', '1h', '1d'],
                  validators: [
                    {
                      type: 'REQUIRED',
                      arguments: []
                    }
                  ],
                  displayProperties: {
                    row: 0,
                    columns: 4,
                    displayInViewMode: false
                  }
                }
              ]
            },
            {
              type: 'string-select',
              key: 'timestampOrigin',
              translationKey: 'configuration.oibus.manifest.south.items.opcua.timestamp-origin',
              defaultValue: 'oibus',
              selectableValues: ['oibus', 'point', 'server'],
              validators: [
                {
                  type: 'REQUIRED',
                  arguments: []
                }
              ],
              displayProperties: {
                row: 0,
                columns: 4,
                displayInViewMode: false
              }
            }
          ]
        }
      ]
    }
  }
};
export default manifest;
