import { SouthConnectorManifest } from '../../../shared/model/south-connector.model';

const manifest: SouthConnectorManifest = {
  id: 'modbus',
  category: 'iot',
  modes: {
    subscription: false,
    lastPoint: true,
    lastFile: false,
    history: false
  },
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
        key: 'host',
        translationKey: 'configuration.oibus.manifest.south.modbus.host',
        defaultValue: '127.0.0.1',
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
        key: 'port',
        translationKey: 'configuration.oibus.manifest.south.modbus.port',
        defaultValue: 502,
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
            type: 'MINIMUM',
            arguments: ['65535']
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
        translationKey: 'configuration.oibus.manifest.south.modbus.retry-interval',
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
            type: 'MINIMUM',
            arguments: ['60000']
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
        key: 'slaveId',
        translationKey: 'configuration.oibus.manifest.south.modbus.slave-id',
        defaultValue: 1,
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
            type: 'MINIMUM',
            arguments: ['65535']
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
        key: 'addressOffset',
        translationKey: 'configuration.oibus.manifest.south.modbus.address-offset',
        defaultValue: 'modbus',
        selectableValues: ['modbus', 'jbus'],
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
        type: 'string-select',
        key: 'endianness',
        translationKey: 'configuration.oibus.manifest.south.modbus.endianness',
        defaultValue: 'big-endian',
        selectableValues: ['big-endian', 'little-endian'],
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
        type: 'boolean',
        key: 'swapBytesInWords',
        translationKey: 'configuration.oibus.manifest.south.modbus.swap-bytes-in-words',
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
        type: 'boolean',
        key: 'swapWordsInDWords',
        translationKey: 'configuration.oibus.manifest.south.modbus.swap-words-in-dwords',
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
          acceptableType: 'POLL',
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
              referralPathFromRoot: 'modbusType',
              targetPathFromRoot: 'data',
              values: ['input-register', 'holding-register']
            }
          ],
          validators: [],
          attributes: [
            {
              type: 'string',
              key: 'address',
              translationKey: 'configuration.oibus.manifest.south.items.modbus.address',
              defaultValue: '0x0001',
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
              type: 'string-select',
              key: 'modbusType',
              translationKey: 'configuration.oibus.manifest.south.items.modbus.modbus-type',
              defaultValue: 'holding-register',
              selectableValues: ['coil', 'discrete-input', 'input-register', 'holding-register'],
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
              type: 'object',
              key: 'data',
              translationKey: 'configuration.oibus.manifest.south.items.modbus.data',
              displayProperties: {
                visible: true,
                wrapInBox: false
              },
              enablingConditions: [
                {
                  referralPathFromRoot: 'dataType',
                  targetPathFromRoot: 'bitIndex',
                  values: ['bit']
                }
              ],
              validators: [],
              attributes: [
                {
                  type: 'string-select',
                  key: 'dataType',
                  translationKey: 'configuration.oibus.manifest.south.items.modbus.data.data-type',
                  defaultValue: 'uint16',
                  selectableValues: ['uint16', 'int16', 'uint32', 'int32', 'big-uint64', 'big-int64', 'float', 'double', 'bit'],
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
                  type: 'number',
                  key: 'bitIndex',
                  translationKey: 'configuration.oibus.manifest.south.items.modbus.data.bit-index',
                  defaultValue: 1,
                  unit: null,
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
                  key: 'multiplierCoefficient',
                  translationKey: 'configuration.oibus.manifest.south.items.modbus.data.multiplier-coefficient',
                  defaultValue: 1,
                  unit: null,
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
      ]
    }
  }
};
export default manifest;
