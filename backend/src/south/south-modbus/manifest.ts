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
  settings: [
    {
      key: 'host',
      type: 'OibText',
      translationKey: 'south.modbus.host',
      defaultValue: '127.0.0.1',
      class: 'col-4',
      validators: [{ key: 'required' }],
      displayInViewMode: true
    },
    {
      key: 'port',
      type: 'OibNumber',
      translationKey: 'south.modbus.port',
      defaultValue: 502,
      validators: [{ key: 'required' }, { key: 'min', params: { min: 1 } }, { key: 'max', params: { max: 65535 } }],
      displayInViewMode: true
    },
    {
      key: 'retryInterval',
      type: 'OibNumber',
      translationKey: 'south.modbus.retry-interval',
      unitLabel: 'ms',
      defaultValue: 10000,
      class: 'col-4',
      validators: [{ key: 'required' }, { key: 'min', params: { min: 100 } }, { key: 'max', params: { max: 60_000 } }],
      displayInViewMode: false
    },
    {
      key: 'slaveId',
      type: 'OibNumber',
      translationKey: 'south.modbus.slave-id',
      defaultValue: 1,
      newRow: true,
      class: 'col-4',
      validators: [{ key: 'required' }, { key: 'min', params: { min: 1 } }, { key: 'max', params: { max: 65535 } }],
      displayInViewMode: true
    },
    {
      key: 'addressOffset',
      type: 'OibSelect',
      options: ['modbus', 'jbus'],
      translationKey: 'south.modbus.address-offset',
      defaultValue: 'modbus',
      class: 'col-4',
      validators: [{ key: 'required' }],
      displayInViewMode: true
    },
    {
      key: 'endianness',
      type: 'OibSelect',
      options: ['big-endian', 'little-endian'],
      translationKey: 'south.modbus.endianness',
      defaultValue: 'big-endian',
      class: 'col-4',
      validators: [{ key: 'required' }],
      displayInViewMode: true
    },
    {
      key: 'swapBytesInWords',
      type: 'OibCheckbox',
      translationKey: 'south.modbus.swap-bytes-in-words',
      defaultValue: false,
      newRow: true,
      class: 'col-4',
      validators: [{ key: 'required' }],
      displayInViewMode: true
    },
    {
      key: 'swapWordsInDWords',
      type: 'OibCheckbox',
      translationKey: 'south.modbus.swap-words-in-dwords',
      defaultValue: false,
      newRow: false,
      class: 'col-4',
      validators: [{ key: 'required' }],
      displayInViewMode: true
    }
  ],
  items: {
    scanMode: {
      acceptSubscription: false,
      subscriptionOnly: false
    },
    settings: [
      {
        key: 'address',
        type: 'OibText',
        translationKey: 'south.items.modbus.address',
        defaultValue: '0x0001',
        class: 'col-6',
        validators: [{ key: 'required' }],
        displayInViewMode: true
      },
      {
        key: 'modbusType',
        type: 'OibSelect',
        options: ['coil', 'discrete-input', 'input-register', 'holding-register'],
        translationKey: 'south.items.modbus.modbus-type',
        defaultValue: 'holding-register',
        class: 'col-6',
        validators: [{ key: 'required' }],
        displayInViewMode: true
      },
      {
        key: 'data',
        type: 'OibFormGroup',
        translationKey: '',
        newRow: true,
        displayInViewMode: false,
        validators: [{ key: 'required' }],
        conditionalDisplay: { field: 'modbusType', values: ['input-register', 'holding-register'] },
        content: [
          {
            key: 'dataType',
            type: 'OibSelect',
            options: ['uint16', 'int16', 'uint32', 'int32', 'big-uint64', 'big-int64', 'float', 'double', 'bit'],
            translationKey: 'south.items.modbus.data.data-type',
            defaultValue: 'uint16',
            validators: [{ key: 'required' }],
            class: 'col-4',
            displayInViewMode: false
          },
          {
            key: 'bitIndex',
            type: 'OibNumber',
            translationKey: 'south.items.modbus.data.bit-index',
            defaultValue: 1,
            validators: [{ key: 'required' }, { key: 'min', params: { min: 0 } }, { key: 'max', params: { max: 15 } }],
            conditionalDisplay: { field: 'dataType', values: ['bit'] },
            class: 'col-4',
            displayInViewMode: false
          },
          {
            key: 'multiplierCoefficient',
            type: 'OibNumber',
            translationKey: 'south.items.modbus.data.multiplier-coefficient',
            defaultValue: 1,
            validators: [{ key: 'required' }],
            class: 'col-4',
            displayInViewMode: false
          }
        ]
      }
    ]
  }
};
export default manifest;
