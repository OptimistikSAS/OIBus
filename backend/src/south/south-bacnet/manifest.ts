import { SouthConnectorManifest } from '../../../shared/model/south-connector.model';

const manifest: SouthConnectorManifest = {
  id: 'bacnet',
  category: 'iot',
  modes: {
    subscription: true,
    lastPoint: true,
    lastFile: false,
    history: false
  },
  explore: true,
  beta: true,
  settings: {
    type: 'object',
    key: 'settings',
    translationKey: 'configuration.oibus.manifest.south.settings',
    displayProperties: {
      visible: true,
      wrapInBox: false
    },
    enablingConditions: [],
    validators: [],
    attributes: [
      {
        type: 'string',
        key: 'localInterface',
        translationKey: 'configuration.oibus.manifest.south.bacnet.local-interface',
        defaultValue: '',
        validators: [],
        displayProperties: {
          row: 0,
          columns: 6,
          displayInViewMode: false
        }
      },
      {
        type: 'number',
        key: 'port',
        translationKey: 'configuration.oibus.manifest.south.bacnet.port',
        unit: null,
        defaultValue: 47808,
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
            arguments: ['65535']
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
        key: 'apduTimeout',
        translationKey: 'configuration.oibus.manifest.south.bacnet.apdu-timeout',
        unit: 'ms',
        defaultValue: 6000,
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
            arguments: ['60000']
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
        key: 'broadcastAddress',
        translationKey: 'configuration.oibus.manifest.south.bacnet.broadcast-address',
        defaultValue: '255.255.255.255',
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          },
          {
            type: 'PATTERN',
            arguments: ['^\\d{1,3}(\\.\\d{1,3}){3}$']
          }
        ],
        displayProperties: {
          row: 1,
          columns: 6,
          displayInViewMode: false
        }
      },
      {
        type: 'number',
        key: 'retryInterval',
        translationKey: 'configuration.oibus.manifest.south.bacnet.retry-interval',
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
            arguments: ['60000']
          }
        ],
        displayProperties: {
          row: 1,
          columns: 3,
          displayInViewMode: true
        }
      },
      {
        type: 'number',
        key: 'maxParallelRun',
        translationKey: 'configuration.oibus.manifest.south.bacnet.max-parallel-run',
        unit: null,
        defaultValue: 1,
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
            arguments: ['16']
          }
        ],
        displayProperties: {
          row: 1,
          columns: 3,
          displayInViewMode: false
        }
      },
      {
        type: 'string',
        key: 'discoveryTargetAddress',
        translationKey: 'configuration.oibus.manifest.south.bacnet.discovery-target-address',
        defaultValue: null,
        validators: [
          {
            type: 'PATTERN',
            arguments: ['^\\d{1,3}(\\.\\d{1,3}){3}(:\\d{1,5})?$']
          }
        ],
        displayProperties: {
          row: 2,
          columns: 8,
          displayInViewMode: false
        }
      },
      {
        type: 'number',
        key: 'covDefaultLifetime',
        translationKey: 'configuration.oibus.manifest.south.bacnet.cov-default-lifetime',
        unit: 's',
        defaultValue: 300,
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          },
          {
            type: 'MINIMUM',
            arguments: ['0']
          },
          {
            type: 'MAXIMUM',
            arguments: ['86400']
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
        key: 'covRenewalMargin',
        translationKey: 'configuration.oibus.manifest.south.bacnet.cov-renewal-margin',
        unit: 's',
        defaultValue: 60,
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          },
          {
            type: 'MINIMUM',
            arguments: ['5']
          },
          {
            type: 'MAXIMUM',
            arguments: ['3600']
          }
        ],
        displayProperties: {
          row: 3,
          columns: 4,
          displayInViewMode: false
        }
      },
      {
        type: 'number',
        key: 'maxObjectsPerRequest',
        translationKey: 'configuration.oibus.manifest.south.bacnet.max-objects-per-request',
        unit: null,
        defaultValue: 20,
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
            arguments: ['100']
          }
        ],
        displayProperties: {
          row: 3,
          columns: 4,
          displayInViewMode: false
        }
      },
      {
        type: 'number',
        key: 'maxNumberOfMessages',
        translationKey: 'configuration.oibus.manifest.south.bacnet.max-number-of-messages',
        unit: null,
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
          row: 4,
          columns: 6,
          displayInViewMode: false
        }
      },
      {
        type: 'number',
        key: 'flushMessageTimeout',
        translationKey: 'configuration.oibus.manifest.south.bacnet.flush-message-timeout',
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
          row: 4,
          columns: 6,
          displayInViewMode: false
        }
      },
      {
        type: 'object',
        key: 'bbmd',
        translationKey: 'configuration.oibus.manifest.south.bacnet.bbmd.title',
        displayProperties: {
          visible: true,
          wrapInBox: true
        },
        enablingConditions: [
          {
            referralPathFromRoot: 'enabled',
            targetPathFromRoot: 'address',
            values: [true]
          },
          {
            referralPathFromRoot: 'enabled',
            targetPathFromRoot: 'foreignDeviceTtl',
            values: [true]
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
            type: 'boolean',
            key: 'enabled',
            translationKey: 'configuration.oibus.manifest.south.bacnet.bbmd.enabled',
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
              displayInViewMode: false
            }
          },
          {
            type: 'string',
            key: 'address',
            translationKey: 'configuration.oibus.manifest.south.bacnet.bbmd.address',
            defaultValue: null,
            validators: [
              {
                type: 'REQUIRED',
                arguments: []
              },
              {
                type: 'PATTERN',
                arguments: ['^\\d{1,3}(\\.\\d{1,3}){3}(:\\d{1,5})?$']
              }
            ],
            displayProperties: {
              row: 0,
              columns: 5,
              displayInViewMode: false
            }
          },
          {
            type: 'number',
            key: 'foreignDeviceTtl',
            translationKey: 'configuration.oibus.manifest.south.bacnet.bbmd.foreign-device-ttl',
            unit: 's',
            defaultValue: 900,
            validators: [
              {
                type: 'REQUIRED',
                arguments: []
              },
              {
                type: 'MINIMUM',
                arguments: ['60']
              },
              {
                type: 'MAXIMUM',
                arguments: ['86400']
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
          enablingConditions: [],
          validators: [],
          attributes: [
            {
              type: 'string',
              key: 'deviceAddress',
              translationKey: 'configuration.oibus.manifest.south.items.bacnet.device-address',
              defaultValue: null,
              validators: [
                {
                  type: 'REQUIRED',
                  arguments: []
                },
                {
                  type: 'PATTERN',
                  arguments: ['^\\d{1,3}(\\.\\d{1,3}){3}(:\\d{1,5})?$']
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
              key: 'deviceInstance',
              translationKey: 'configuration.oibus.manifest.south.items.bacnet.device-instance',
              unit: null,
              defaultValue: null,
              validators: [
                {
                  type: 'REQUIRED',
                  arguments: []
                },
                {
                  type: 'MINIMUM',
                  arguments: ['0']
                },
                {
                  type: 'MAXIMUM',
                  arguments: ['4194303']
                }
              ],
              displayProperties: {
                row: 0,
                columns: 2,
                displayInViewMode: true
              }
            },
            {
              type: 'string-select',
              key: 'objectType',
              translationKey: 'configuration.oibus.manifest.south.items.bacnet.object-type',
              defaultValue: 'analog-input',
              selectableValues: [
                'analog-input',
                'analog-output',
                'analog-value',
                'binary-input',
                'binary-output',
                'binary-value',
                'multi-state-input',
                'multi-state-output',
                'multi-state-value'
              ],
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
              key: 'objectInstance',
              translationKey: 'configuration.oibus.manifest.south.items.bacnet.object-instance',
              unit: null,
              defaultValue: null,
              validators: [
                {
                  type: 'REQUIRED',
                  arguments: []
                },
                {
                  type: 'MINIMUM',
                  arguments: ['0']
                },
                {
                  type: 'MAXIMUM',
                  arguments: ['4194303']
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
              key: 'propertyIdentifier',
              translationKey: 'configuration.oibus.manifest.south.items.bacnet.property-identifier',
              defaultValue: 'present-value',
              selectableValues: ['present-value', 'status-flags', 'reliability', 'out-of-service', 'units'],
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
        }
      ]
    }
  }
};
export default manifest;
