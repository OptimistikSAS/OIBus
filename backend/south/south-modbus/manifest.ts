import { SouthConnectorManifest } from '../../../shared/model/south-connector.model';
import Joi from 'joi';

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
  schema: Joi.object({
    host: Joi.string().required(),
    port: Joi.number().required().port(),
    slaveId: Joi.number().integer().required().min(1).max(65535),
    retryInterval: Joi.number().integer().required().min(100).max(60_000),
    addressOffset: Joi.string().required().valid('Modbus', 'JBus'),
    endianness: Joi.string().required().valid('Big Endian', 'Little Endian'),
    swapBytesInWords: Joi.boolean().required(),
    swapWordsInDWords: Joi.boolean().required()
  }),
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
    ],
    schema: Joi.object({
      address: Joi.string().required(),
      modbusType: Joi.string().required().valid('coil', 'discreteInput', 'inputRegister', 'holdingRegister'),
      dataType: Joi.string().required().valid('UInt16', 'Int16', 'UInt32', 'Int32', 'BigUInt64', 'BigInt64', 'Float', 'Double'),
      multiplierCoefficient: Joi.string().required()
    })
  }
};
export default manifest;
