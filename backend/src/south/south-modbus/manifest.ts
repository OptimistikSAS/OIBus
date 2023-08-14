import { SouthConnectorManifest } from '../../../../shared/model/south-connector.model';

const manifest: SouthConnectorManifest = {
  id: 'modbus',
  name: 'Modbus',
  category: 'iot',
  description: 'Access Modbus registers on a PLC',
  modes: {
    subscription: false,
    lastPoint: true,
    lastFile: false,
    history: false,
    forceMaxInstantPerItem: false
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
      displayInViewMode: true
    },
    {
      key: 'port',
      type: 'OibNumber',
      label: 'Port',
      defaultValue: 502,
      newRow: false,
      validators: [{ key: 'required' }, { key: 'min', params: { min: 1 } }, { key: 'max', params: { max: 65535 } }],
      displayInViewMode: true
    },
    {
      key: 'slaveId',
      type: 'OibNumber',
      label: 'Slave ID',
      defaultValue: 1,
      newRow: false,
      validators: [{ key: 'required' }, { key: 'min', params: { min: 1 } }, { key: 'max', params: { max: 65535 } }],
      displayInViewMode: true
    },
    {
      key: 'retryInterval',
      type: 'OibNumber',
      label: 'Retry interval',
      unitLabel: 'ms',
      defaultValue: 10000,
      newRow: true,
      class: 'col-4',
      validators: [{ key: 'required' }, { key: 'min', params: { min: 100 } }, { key: 'max', params: { max: 60_000 } }],
      displayInViewMode: false
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
      displayInViewMode: true
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
      displayInViewMode: true
    },
    {
      key: 'swapBytesInWords',
      type: 'OibCheckbox',
      label: 'Swap Bytes?',
      defaultValue: false,
      newRow: true,
      class: 'col-4',
      validators: [{ key: 'required' }],
      displayInViewMode: true
    },
    {
      key: 'swapWordsInDWords',
      type: 'OibCheckbox',
      label: 'Swap Words?',
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
        label: 'Address',
        defaultValue: '',
        validators: [{ key: 'required' }],
        displayInViewMode: true
      },
      {
        key: 'modbusType',
        type: 'OibSelect',
        options: ['coil', 'discreteInput', 'inputRegister', 'holdingRegister'],
        label: 'Modbus Type',
        defaultValue: 'holdingRegister',
        validators: [{ key: 'required' }],
        displayInViewMode: true
      },
      {
        key: 'dataType',
        type: 'OibSelect',
        options: ['UInt16', 'Int16', 'UInt32', 'Int32', 'BigUInt64', 'BigInt64', 'Float', 'Double'],
        label: 'Data Type',
        defaultValue: 'UInt16',
        validators: [{ key: 'required' }],
        conditionalDisplay: { field: 'modbusType', values: ['inputRegister', 'holdingRegister'] },
        displayInViewMode: false
      },
      {
        key: 'multiplierCoefficient',
        type: 'OibNumber',
        label: 'Multiplier Coefficient',
        defaultValue: 1,
        validators: [{ key: 'required' }],
        conditionalDisplay: { field: 'modbusType', values: ['inputRegister', 'holdingRegister'] },
        displayInViewMode: false
      }
    ]
  }
};
export default manifest;
