import { NorthConnectorManifest } from '../../../shared/model/north-connector.model';

const manifest: NorthConnectorManifest = {
  id: 'modbus',
  category: 'iot',
  types: ['modbus'],
  settings: {
    type: 'object',
    key: 'settings',
    translationKey: 'configuration.oibus.manifest.north.settings',
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
        translationKey: 'configuration.oibus.manifest.north.modbus.host',
        defaultValue: '127.0.0.1',
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          }
        ],
        displayProperties: {
          row: 0,
          columns: 9,
          displayInViewMode: true
        }
      },
      {
        type: 'number',
        key: 'port',
        translationKey: 'configuration.oibus.manifest.north.modbus.port',
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
        key: 'retryInterval',
        translationKey: 'configuration.oibus.manifest.north.modbus.retry-interval',
        defaultValue: 10000,
        unit: 'ms',
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
          columns: 3,
          displayInViewMode: true
        }
      },
      {
        type: 'number',
        key: 'slaveId',
        translationKey: 'configuration.oibus.manifest.north.modbus.slave-id',
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
            type: 'MAXIMUM',
            arguments: ['255']
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
        key: 'addressOffset',
        translationKey: 'configuration.oibus.manifest.north.modbus.address-offset',
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
        translationKey: 'configuration.oibus.manifest.north.modbus.endianness',
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
        translationKey: 'configuration.oibus.manifest.north.modbus.swap-bytes-in-words',
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
        translationKey: 'configuration.oibus.manifest.north.modbus.swap-words-in-dwords',
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
  }
};
export default manifest;
