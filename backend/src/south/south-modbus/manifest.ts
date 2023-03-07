import { SouthConnectorManifest } from '../../../../shared/model/south-connector.model';

const manifest: SouthConnectorManifest = {
  name: 'Modbus',
  category: 'iot',
  description: 'Modbus description',
  modes: {
    subscription: false,
    lastPoint: true,
    lastFile: false,
    historyPoint: false,
    historyFile: false
  },
  settings: [
    {
      key: 'host',
      type: 'OibText',
      label: 'Host',
      defaultValue: '127.0.0.1',
      newRow: true,
      class: 'col-4',
      validators: [{ key: 'required' }],
      readDisplay: true
    },
    {
      key: 'port',
      type: 'OibNumber',
      label: 'Port',
      defaultValue: 502,
      newRow: false,
      validators: [{ key: 'required' }, { key: 'min', params: { min: 1 } }, { key: 'max', params: { max: 65535 } }],
      readDisplay: true
    },
    {
      key: 'slaveId',
      type: 'OibNumber',
      label: 'Slave ID',
      defaultValue: 1,
      newRow: false,
      validators: [{ key: 'required' }, { key: 'min', params: { min: 1 } }, { key: 'max', params: { max: 65535 } }],
      readDisplay: true
    },
    {
      key: 'retryInterval',
      type: 'OibNumber',
      label: 'Retry interval (ms)',
      defaultValue: 10000,
      newRow: true,
      class: 'col-2',
      validators: [{ key: 'required' }, { key: 'min', params: { min: 100 } }, { key: 'max', params: { max: 60_000 } }],
      readDisplay: false
    },
    {
      key: 'addressOffset',
      type: 'OibSelect',
      options: ['Modbus', 'JBus'],
      label: 'Address Offset',
      defaultValue: 'Modbus',
      newRow: true,
      class: 'col-4',
      validators: [{ key: 'required' }],
      readDisplay: true
    },
    {
      key: 'endianness',
      type: 'OibSelect',
      options: ['Big Endian', 'Little Endian'],
      label: 'Endianness',
      defaultValue: 'Big Endian',
      newRow: false,
      class: 'col-4',
      validators: [{ key: 'required' }],
      readDisplay: true
    },
    {
      key: 'swapBytesInWords',
      type: 'OibCheckbox',
      label: 'Swap Bytes?',
      defaultValue: false,
      newRow: true,
      class: 'col-4',
      validators: [{ key: 'required' }],
      readDisplay: true
    },
    {
      key: 'swapWordsInDWords',
      type: 'OibCheckbox',
      label: 'Swap Words?',
      defaultValue: false,
      newRow: false,
      class: 'col-4',
      validators: [{ key: 'required' }],
      readDisplay: true
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
        label: 'Address',
        defaultValue: '',
        validators: [{ key: 'required' }],
        readDisplay: true
      },
      {
        key: 'modbusType',
        type: 'OibSelect',
        options: ['coil', 'discreteInput', 'inputRegister', 'holdingRegister'],
        label: 'Modbus Type',
        defaultValue: 'holdingRegister',
        validators: [{ key: 'required' }],
        readDisplay: true
      },
      {
        key: 'dataType',
        type: 'OibSelect',
        options: ['UInt16', 'Int16', 'UInt32', 'Int32', 'BigUInt64', 'BigInt64', 'Float', 'Double'],
        label: 'Data Type',
        defaultValue: 'UInt16',
        validators: [{ key: 'required' }],
        readDisplay: false
      },
      {
        key: 'multiplierCoefficient',
        type: 'OibText',
        label: 'Multiplier Coefficient',
        defaultValue: '1',
        validators: [{ key: 'required' }],
        readDisplay: false
      }
    ]
  }
};
export default manifest;
