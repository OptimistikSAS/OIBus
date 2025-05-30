import { NorthConnectorManifest } from '../../../shared/model/north-connector.model';

const manifest: NorthConnectorManifest = {
  id: 'modbus',
  category: 'iot',
  types: ['modbus'],
  settings: [
    {
      key: 'host',
      type: 'OibText',
      translationKey: 'north.modbus.host',
      defaultValue: '127.0.0.1',
      class: 'col-4',
      validators: [{ key: 'required' }],
      displayInViewMode: true
    },
    {
      key: 'port',
      type: 'OibNumber',
      translationKey: 'north.modbus.port',
      defaultValue: 502,
      validators: [{ key: 'required' }, { key: 'min', params: { min: 1 } }, { key: 'max', params: { max: 65535 } }],
      displayInViewMode: true
    },
    {
      key: 'retryInterval',
      type: 'OibNumber',
      translationKey: 'north.modbus.retry-interval',
      unitLabel: 'ms',
      defaultValue: 10000,
      class: 'col-4',
      validators: [{ key: 'required' }, { key: 'min', params: { min: 100 } }, { key: 'max', params: { max: 60_000 } }],
      displayInViewMode: false
    },
    {
      key: 'slaveId',
      type: 'OibNumber',
      translationKey: 'north.modbus.slave-id',
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
      translationKey: 'north.modbus.address-offset',
      defaultValue: 'modbus',
      class: 'col-4',
      validators: [{ key: 'required' }],
      displayInViewMode: true
    },
    {
      key: 'endianness',
      type: 'OibSelect',
      options: ['big-endian', 'little-endian'],
      translationKey: 'north.modbus.endianness',
      defaultValue: 'big-endian',
      class: 'col-4',
      validators: [{ key: 'required' }],
      displayInViewMode: true
    },
    {
      key: 'swapBytesInWords',
      type: 'OibCheckbox',
      translationKey: 'north.modbus.swap-bytes-in-words',
      defaultValue: false,
      newRow: true,
      class: 'col-4',
      validators: [{ key: 'required' }],
      displayInViewMode: true
    },
    {
      key: 'swapWordsInDWords',
      type: 'OibCheckbox',
      translationKey: 'north.modbus.swap-words-in-dwords',
      defaultValue: false,
      newRow: false,
      class: 'col-4',
      validators: [{ key: 'required' }],
      displayInViewMode: true
    }
  ]
};
export default manifest;
