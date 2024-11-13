import { SouthConnectorManifest } from '../../../shared/model/south-connector.model';

const manifest: SouthConnectorManifest = {
  id: 'modbus',
  name: 'Modbus',
  category: 'iot',
  description: 'Access Modbus registers on a PLC',
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
      label: 'Host',
      defaultValue: '127.0.0.1',
      class: 'col-4',
      validators: [{ key: 'required' }],
      displayInViewMode: true
    },
    {
      key: 'port',
      type: 'OibNumber',
      label: 'Port',
      defaultValue: 502,
      validators: [{ key: 'required' }, { key: 'min', params: { min: 1 } }, { key: 'max', params: { max: 65535 } }],
      displayInViewMode: true
    },
    {
      key: 'retryInterval',
      type: 'OibNumber',
      label: 'Retry interval',
      unitLabel: 'ms',
      defaultValue: 10000,
      class: 'col-4',
      validators: [{ key: 'required' }, { key: 'min', params: { min: 100 } }, { key: 'max', params: { max: 60_000 } }],
      displayInViewMode: false
    },
    {
      key: 'slaveId',
      type: 'OibNumber',
      label: 'Slave ID',
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
      label: 'Address offset',
      defaultValue: 'modbus',
      class: 'col-4',
      validators: [{ key: 'required' }],
      displayInViewMode: true
    },
    {
      key: 'endianness',
      type: 'OibSelect',
      options: ['big-endian', 'little-endian'],
      label: 'Endianness',
      defaultValue: 'big-endian',
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
        options: ['coil', 'discrete-input', 'input-register', 'holding-register'],
        label: 'Modbus type',
        defaultValue: 'holding-register',
        validators: [{ key: 'required' }],
        displayInViewMode: true
      },
      {
        key: 'data',
        type: 'OibFormGroup',
        label: '',
        newRow: true,
        displayInViewMode: false,
        validators: [{ key: 'required' }],
        conditionalDisplay: { field: 'modbusType', values: ['input-register', 'holding-register'] },
        content: [
          {
            key: 'dataType',
            type: 'OibSelect',
            options: ['uint16', 'int16', 'uint32', 'int32', 'big-uint64', 'big-int64', 'float', 'double', 'bit'],
            label: 'Data type',
            defaultValue: 'uint16',
            validators: [{ key: 'required' }],
            displayInViewMode: false
          },
          {
            key: 'bitIndex',
            type: 'OibNumber',
            label: 'Bit index',
            defaultValue: 1,
            validators: [{ key: 'required' }, { key: 'min', params: { min: 0 } }, { key: 'max', params: { max: 15 } }],
            conditionalDisplay: { field: 'dataType', values: ['bit'] },
            displayInViewMode: false
          },
          {
            key: 'multiplierCoefficient',
            type: 'OibNumber',
            label: 'Multiplier coefficient',
            defaultValue: 1,
            validators: [{ key: 'required' }],
            displayInViewMode: false
          }
        ]
      }
    ]
  }
};
export default manifest;
